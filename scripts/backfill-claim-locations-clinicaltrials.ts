import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BATCH_SIZE = 50;
const API_DELAY_MS = 200;

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

interface CTLocation {
  facility?: string;
  city?: string;
  country?: string;
  geoPoint?: { lat?: number; lon?: number };
}

interface CTStudyResponse {
  protocolSection?: {
    contactsLocationsModule?: {
      locations?: CTLocation[];
    };
  };
}

async function fetchLocationsForNCT(nctId: string): Promise<CTLocation[]> {
  const url = `https://clinicaltrials.gov/api/v2/studies/${nctId}?fields=protocolSection.contactsLocationsModule.locations`;
  const res = await fetch(url, {
    headers: { 'Accept': 'application/json' },
  });
  if (!res.ok) {
    if (res.status === 404) return [];
    throw new Error(`HTTP ${res.status} for ${nctId}`);
  }
  const data = (await res.json()) as CTStudyResponse;
  return data.protocolSection?.contactsLocationsModule?.locations ?? [];
}

function pickBestLocation(locations: CTLocation[]): CTLocation | null {
  if (locations.length === 0) return null;
  // Prefer US location with coords
  const usWithCoords = locations.find(
    (l) =>
      l.country?.toLowerCase().includes('united states') &&
      l.geoPoint?.lat != null &&
      l.geoPoint?.lon != null
  );
  if (usWithCoords) return usWithCoords;

  // Any US location
  const us = locations.find((l) => l.country?.toLowerCase().includes('united states'));
  if (us) return us;

  // Any location with coords
  const anyWithCoords = locations.find(
    (l) => l.geoPoint?.lat != null && l.geoPoint?.lon != null
  );
  if (anyWithCoords) return anyWithCoords;

  // First location
  return locations[0];
}

function countryToCode(country: string | undefined): string | null {
  if (!country) return null;
  const lower = country.toLowerCase();
  if (lower.includes('united states')) return 'US';
  if (lower.includes('united kingdom')) return 'GB';
  if (lower.includes('canada')) return 'CA';
  if (lower.includes('germany')) return 'DE';
  if (lower.includes('france')) return 'FR';
  if (lower.includes('australia')) return 'AU';
  if (lower.includes('japan')) return 'JP';
  if (lower.includes('china')) return 'CN';
  if (lower.includes('italy')) return 'IT';
  if (lower.includes('spain')) return 'ES';
  if (lower.includes('netherlands')) return 'NL';
  if (lower.includes('sweden')) return 'SE';
  if (lower.includes('denmark')) return 'DK';
  if (lower.includes('norway')) return 'NO';
  if (lower.includes('switzerland')) return 'CH';
  if (lower.includes('belgium')) return 'BE';
  if (lower.includes('austria')) return 'AT';
  if (lower.includes('brazil')) return 'BR';
  if (lower.includes('india')) return 'IN';
  if (lower.includes('israel')) return 'IL';
  if (lower.includes('south korea') || lower.includes('korea, republic')) return 'KR';
  if (lower.includes('poland')) return 'PL';
  if (lower.includes('czechia') || lower.includes('czech republic')) return 'CZ';
  if (lower.includes('hungary')) return 'HU';
  if (lower.includes('turkey')) return 'TR';
  if (lower.includes('mexico')) return 'MX';
  if (lower.includes('argentina')) return 'AR';
  if (lower.includes('south africa')) return 'ZA';
  if (lower.includes('new zealand')) return 'NZ';
  if (lower.includes('singapore')) return 'SG';
  if (lower.includes('taiwan')) return 'TW';
  if (lower.includes('russia') || lower.includes('russian federation')) return 'RU';
  return null;
}

async function main() {
  console.log('Starting ClinicalTrials.gov ClaimLocation backfill (Stage 4)...');

  // Get all clinicaltrials claims
  const total = await prisma.claim.count({
    where: { ingestedBy: 'clinicaltrials_v1', deleted: false },
  });
  console.log(`Total clinicaltrials_v1 claims: ${total}`);

  // Get claims already backfilled
  const alreadyDone = new Set(
    (
      await prisma.claimLocation.findMany({
        where: { source: 'ctgov_site' },
        select: { claimId: true },
      })
    ).map((r) => r.claimId)
  );
  console.log(`Already have ctgov_site ClaimLocation rows: ${alreadyDone.size}`);

  let offset = 0;
  let inserted = 0;
  let skipped = 0;
  let noLocation = 0;
  let errors = 0;

  while (true) {
    const claims = await prisma.claim.findMany({
      where: { ingestedBy: 'clinicaltrials_v1', deleted: false },
      select: { id: true, externalId: true },
      skip: offset,
      take: BATCH_SIZE,
      orderBy: { id: 'asc' },
    });

    if (claims.length === 0) break;

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

    for (const claim of claims) {
      if (alreadyDone.has(claim.id)) {
        skipped++;
        continue;
      }

      // externalId is 'nct_NCTXXXXXXXX'
      const nctId = claim.externalId?.replace(/^nct_/, '');
      if (!nctId) {
        noLocation++;
        continue;
      }

      await sleep(API_DELAY_MS);

      try {
        const locations = await fetchLocationsForNCT(nctId);
        const best = pickBestLocation(locations);

        if (!best) {
          noLocation++;
          continue;
        }

        const lat = best.geoPoint?.lat;
        const lon = best.geoPoint?.lon;

        if (lat == null || lon == null) {
          // No coordinates — skip (no fallback geocoder available)
          noLocation++;
          continue;
        }

        toInsert.push({
          claimId: claim.id,
          lat,
          lon,
          city: best.city ?? undefined,
          countryCode: countryToCode(best.country) ?? undefined,
          source: 'ctgov_site',
          precision: 'CITY',
          externalRef: nctId,
        });
      } catch (err) {
        errors++;
        console.warn(`  Error fetching ${nctId}: ${(err as Error).message}`);
      }
    }

    if (toInsert.length > 0) {
      await prisma.claimLocation.createMany({
        data: toInsert,
        skipDuplicates: true,
      });
      inserted += toInsert.length;
    }

    offset += claims.length;

    if (offset % 100 === 0 || claims.length < BATCH_SIZE) {
      console.log(
        `Progress: ${offset}/${total} processed | ${inserted} inserted | ${skipped} skipped | ${noLocation} no-location | ${errors} errors`
      );
    }

    if (claims.length < BATCH_SIZE) break;
  }

  console.log(
    `\nDone. Inserted: ${inserted} | Skipped (existed): ${skipped} | No location: ${noLocation} | Errors: ${errors}`
  );

  return inserted;
}

main()
  .then((inserted) => {
    // Send Telegram notification
    const { execSync } = require('child_process');
    try {
      execSync(
        `/opt/homebrew/bin/openclaw message send "🏥 Stage 4 complete: ClinicalTrials sites backfill done. ${inserted} ClaimLocation rows inserted."`,
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
