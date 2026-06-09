import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';

const prisma = new PrismaClient();
const DB_PAGE_SIZE = 500;
const API_MINI_BATCH = 50;
const API_DELAY_MS = 100;
const LOG_EVERY = 250;
const USER_AGENT = 'mailto:robert.contofalsky@gmail.com';

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

// Normalize any openAlexId format to a bare W-id like "W2741809807"
function toWorkId(raw: string): string {
  const m = /\/(W\d+)/i.exec(raw) ?? /^(W\d+)$/i.exec(raw);
  return m ? m[1] : raw;
}

interface OpenAlexWork {
  authorships?: {
    institutions?: {
      ror?: string;
    }[];
  }[];
}

// ROR API v2 response structure
interface RorGeonamesDetails {
  lat?: number;
  lng?: number;
  name?: string;
  country_code?: string;
}

interface RorOrg {
  locations?: { geonames_details?: RorGeonamesDetails }[];
}

interface RorLocation {
  lat: number;
  lon: number;
  city?: string;
  countryCode?: string;
}

// Cache ROR lookups to avoid duplicate API calls for same institution
const rorCache = new Map<string, RorLocation | null>();

// Converts a ROR URL (https://ror.org/XXXX) to the API endpoint
function rorUrlToApiUrl(rorId: string): string {
  const id = rorId.replace('https://ror.org/', '').replace(/\/$/, '');
  return `https://api.ror.org/organizations/${id}`;
}

async function fetchRorLocation(rorId: string): Promise<RorLocation | null> {
  if (rorCache.has(rorId)) {
    return rorCache.get(rorId)!;
  }

  try {
    const apiUrl = rorUrlToApiUrl(rorId);
    const res = await fetch(apiUrl, {
      headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' },
    });
    if (!res.ok) {
      rorCache.set(rorId, null);
      return null;
    }
    const data = (await res.json()) as RorOrg;
    // ROR API v2: locations[0].geonames_details.{lat, lng, name, country_code}
    const geo = data.locations?.[0]?.geonames_details;
    if (!geo || geo.lat == null || geo.lng == null) {
      rorCache.set(rorId, null);
      return null;
    }
    const loc: RorLocation = {
      lat: geo.lat,
      lon: geo.lng,
      city: geo.name ?? undefined,
      countryCode: geo.country_code ?? undefined,
    };
    rorCache.set(rorId, loc);
    return loc;
  } catch {
    rorCache.set(rorId, null);
    return null;
  }
}

async function fetchRorIdFromOpenAlex(openAlexId: string): Promise<string | null> {
  const wid = toWorkId(openAlexId);
  const url = `https://api.openalex.org/works/${wid}?select=id,authorships`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as OpenAlexWork;
    const ror = data.authorships?.[0]?.institutions?.[0]?.ror;
    return ror ?? null;
  } catch {
    return null;
  }
}

async function main() {
  console.log('Starting OpenAlex/ROR institutions ClaimLocation backfill (Stage 5)...');

  const total = await prisma.claim.count({
    where: {
      deleted: false,
      ingestedBy: { startsWith: 'openalex' },
    },
  });
  console.log(`Total OpenAlex claims: ${total}`);

  // Load set of claimIds that already have an openalex_ror ClaimLocation row
  // Use cursor pagination on the ClaimLocation PK (id) to avoid memory blow-up
  console.log('Loading already-backfilled claim IDs...');
  const alreadyDone = new Set<string>();
  let clCursor: string | undefined;
  while (true) {
    const rows = await prisma.claimLocation.findMany({
      where: { source: 'openalex_ror' },
      select: { id: true, claimId: true },
      take: 10000,
      ...(clCursor ? { cursor: { id: clCursor }, skip: 1 } : {}),
      orderBy: { id: 'asc' },
    });
    if (rows.length === 0) break;
    for (const r of rows) alreadyDone.add(r.claimId);
    clCursor = rows[rows.length - 1].id;
    if (rows.length < 10000) break;
  }
  console.log(`Already have openalex_ror ClaimLocation rows: ${alreadyDone.size}`);

  let dbCursor: string | undefined;
  let totalProcessed = 0;
  let inserted = 0;
  let skipped = 0;
  let noRor = 0;
  let errors = 0;

  while (true) {
    // Cursor-based DB pagination over Claims
    const claims = await prisma.claim.findMany({
      where: {
        deleted: false,
        ingestedBy: { startsWith: 'openalex' },
        openAlexId: { not: null },
      },
      select: { id: true, openAlexId: true },
      take: DB_PAGE_SIZE,
      ...(dbCursor ? { cursor: { id: dbCursor }, skip: 1 } : {}),
      orderBy: { id: 'asc' },
    });

    if (claims.length === 0) break;
    dbCursor = claims[claims.length - 1].id;

    // Process in mini-batches of API_MINI_BATCH to be polite to APIs
    for (let i = 0; i < claims.length; i += API_MINI_BATCH) {
      const miniBatch = claims.slice(i, i + API_MINI_BATCH);
      const toInsert: {
        claimId: string;
        lat: number;
        lon: number;
        city?: string;
        countryCode?: string;
        source: string;
        precision: string;
        externalRef?: string;
      }[] = [];

      for (const claim of miniBatch) {
        if (alreadyDone.has(claim.id)) {
          skipped++;
          totalProcessed++;
          continue;
        }

        if (!claim.openAlexId) {
          noRor++;
          totalProcessed++;
          continue;
        }

        await sleep(API_DELAY_MS);

        try {
          const rorId = await fetchRorIdFromOpenAlex(claim.openAlexId);
          if (!rorId) {
            noRor++;
            totalProcessed++;
            continue;
          }

          const loc = await fetchRorLocation(rorId);
          if (!loc) {
            noRor++;
            totalProcessed++;
            continue;
          }

          toInsert.push({
            claimId: claim.id,
            lat: loc.lat,
            lon: loc.lon,
            city: loc.city,
            countryCode: loc.countryCode,
            source: 'openalex_ror',
            precision: 'INSTITUTION',
            externalRef: rorId,
          });
        } catch (err) {
          errors++;
          console.warn(
            `  Error for claim ${claim.id} / openAlexId ${claim.openAlexId}: ${(err as Error).message}`
          );
        }

        totalProcessed++;
      }

      if (toInsert.length > 0) {
        await prisma.claimLocation.createMany({
          data: toInsert,
          skipDuplicates: true,
        });
        inserted += toInsert.length;
      }

      if (totalProcessed % LOG_EVERY < API_MINI_BATCH || totalProcessed >= total) {
        console.log(
          `Progress: ${totalProcessed}/${total} processed | ${inserted} inserted | ${skipped} skipped | ${noRor} no-ROR | ${errors} errors | ROR cache: ${rorCache.size}`
        );
      }
    }

    if (claims.length < DB_PAGE_SIZE) break;
  }

  console.log(
    `\nDone. Inserted: ${inserted} | Skipped (existed): ${skipped} | No ROR/coords: ${noRor} | Errors: ${errors}`
  );
  return inserted;
}

main()
  .then((inserted) => {
    try {
      execSync(
        `/opt/homebrew/bin/openclaw message send "📚 Stage 5 complete: OpenAlex/ROR institutions backfill done. ${inserted} ClaimLocation rows inserted."`,
        { stdio: 'inherit' }
      );
    } catch {
      console.warn('Could not send Telegram notification.');
    }
    process.exit(0);
  })
  .catch((e) => {
    console.error('Fatal error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
