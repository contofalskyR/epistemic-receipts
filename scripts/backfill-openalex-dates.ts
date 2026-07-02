/**
 * Backfill claimEmergedAt for openalex_v1 claims that have an openAlexId
 * but no publication date. Batches OpenAlex API calls at 50 per request.
 *
 * Usage:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/backfill-openalex-dates.ts [--dry-run] [--limit N]
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry-run");
const LIMIT = (() => {
  const i = process.argv.indexOf("--limit");
  return i !== -1 ? parseInt(process.argv[i + 1]) : Infinity;
})();
const BATCH = 50; // OpenAlex allows up to 50 filter values per request

async function fetchPublicationDates(ids: string[]): Promise<Map<string, Date>> {
  // ids already have W prefix (e.g. "W3125364203")
  const filter = ids.join("|");
  const url = `https://api.openalex.org/works?filter=ids.openalex:${filter}&select=id,publication_date&per_page=${ids.length}&mailto=contact@epistemicreceipts.com`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`OpenAlex API error: ${res.status} ${await res.text()}`);

  const data = await res.json() as { results: { id: string; publication_date: string | null }[] };
  const map = new Map<string, Date>();

  for (const work of data.results) {
    if (!work.publication_date) continue;
    // work.id is like "https://openalex.org/W3125364203" — extract W-prefixed ID
    const rawId = work.id.replace("https://openalex.org/", "");
    const date = new Date(work.publication_date);
    if (!isNaN(date.getTime())) {
      map.set(rawId, date);
    }
  }

  return map;
}

async function fetchDateFromCrossRef(doi: string): Promise<Date | null> {
  try {
    const clean = doi.replace("https://doi.org/", "");
    const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(clean)}?mailto=contact@epistemicreceipts.com`);
    if (!res.ok) return null;
    const data = await res.json() as { message: { published?: { "date-parts": number[][] } } };
    const parts = data.message?.published?.["date-parts"]?.[0];
    if (!parts || !parts[0]) return null;
    const [y, m = 1, d = 1] = parts;
    const date = new Date(`${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
    return isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

async function main() {
  // Find all openalex_v1 claims with openAlexId but no claimEmergedAt
  const claims = await prisma.claim.findMany({
    where: {
      ingestedBy: "openalex_v1",
      claimEmergedAt: null,
      openAlexId: { not: null },
      deleted: false,
    },
    select: { id: true, openAlexId: true, metadata: true },
    orderBy: { id: "asc" },
    take: LIMIT === Infinity ? undefined : LIMIT,
  });

  console.log(`Found ${claims.length} openalex_v1 claims with no date`);
  if (DRY_RUN) console.log("(dry-run — no writes)");

  let updated = 0;
  let notFound = 0;
  let errors = 0;

  for (let i = 0; i < claims.length; i += BATCH) {
    const batch = claims.slice(i, i + BATCH);
    const ids = batch.map(c => c.openAlexId!);

    try {
      const dates = await fetchPublicationDates(ids);

      for (const claim of batch) {
        let date = dates.get(claim.openAlexId!);

        // OpenAlex didn't have the date — try CrossRef via DOI
        if (!date) {
          const meta = claim.metadata as Record<string, unknown> | null;
          const doi = meta?.doi as string | undefined;
          if (doi) {
            date = (await fetchDateFromCrossRef(doi)) ?? undefined;
            if (date) await new Promise(r => setTimeout(r, 100)); // CrossRef rate limit
          }
        }

        if (!date) { notFound++; continue; }

        if (!DRY_RUN) {
          await prisma.claim.update({
            where: { id: claim.id },
            data: { claimEmergedAt: date, claimEmergedPrecision: "DAY" },
          });
        }
        updated++;
      }

      console.log(`Batch ${Math.floor(i / BATCH) + 1}: +${dates.size} dates (${updated} total, ${notFound} not found)`);

      // Polite rate limiting — OpenAlex allows 10 req/sec without key
      await new Promise(r => setTimeout(r, 120));
    } catch (e) {
      console.error(`Batch ${Math.floor(i / BATCH) + 1} error:`, (e as Error).message);
      errors++;
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  console.log(`\nDone. Updated: ${updated} | Not found in API: ${notFound} | Errors: ${errors}`);
  if (DRY_RUN) console.log("(dry-run — no rows written)");
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
