/**
 * link-nobel-openalex.ts
 *
 * Links active Nobel laureate claims (nobel_v1, wikidata_nobel_v1) to their
 * most-cited papers in our openalex_v1 corpus.
 *
 * Strategy:
 *   1. Load science-category laureates (Chemistry / Physics / Physiology or Medicine /
 *      Economic Sciences) from both Nobel pipelines. Literature & Peace are skipped —
 *      laureates in those categories rarely have OpenAlex publications.
 *   2. For each unique laureate name, query OpenAlex
 *      /authors?filter=display_name.search:<name>&per-page=10. Match candidate
 *      authors via token-set on normalized names; pick the highest-cited candidate.
 *   3. Fetch /works?filter=author.id:<authorId>&sort=cited_by_count:desc&per-page=25.
 *   4. For every work whose externalId ("openalex_<workId>") exists as a Claim in
 *      our DB, create a ClaimRelation { from: paper, to: laureate, type: "AUTHORED_BY" }
 *      with confidence metadata in followUpContext.
 *
 * Run:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/link-nobel-openalex.ts --dry-run
 *   ALLOW_EDITS=true npx dotenv-cli -e .env.local -- npx tsx scripts/link-nobel-openalex.ts
 *
 * Flags:
 *   --dry-run      no DB writes (default unless ALLOW_EDITS=true)
 *   --limit=N      cap unique laureate names processed (default: all)
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DRY_RUN = !process.env.ALLOW_EDITS || process.argv.includes("--dry-run");
const LIMIT_ARG = process.argv.find((a) => a.startsWith("--limit="));
const LAUREATE_LIMIT = LIMIT_ARG ? parseInt(LIMIT_ARG.split("=")[1], 10) : Infinity;
const MAILTO = process.env.OPENALEX_MAILTO || "robert.contofalsky@rutgers.edu";
const REQUEST_DELAY_MS = 350;

const SCIENCE_CATEGORIES = new Set([
  "Chemistry",
  "Physics",
  "Physiology or Medicine",
  "Economic Sciences",
]);

interface Laureate {
  claimId: string;
  name: string;
  category: string;
  year: number;
  pipeline: "nobel_v1" | "wikidata_nobel_v1";
}

function normalizeName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function nameTokenSetMatch(a: string, b: string): boolean {
  const aTokens = new Set(normalizeName(a).split(/[\s-]+/).filter((t) => t.length > 1));
  const bTokens = new Set(normalizeName(b).split(/[\s-]+/).filter((t) => t.length > 1));
  let common = 0;
  for (const t of aTokens) if (bTokens.has(t)) common++;
  const needed = Math.min(2, Math.min(aTokens.size, bTokens.size));
  return common >= needed && common >= 2;
}

async function loadLaureates(): Promise<Laureate[]> {
  const result: Laureate[] = [];

  const nobel = await prisma.claim.findMany({
    where: {
      ingestedBy: "nobel_v1",
      deleted: false,
      verificationStatus: { not: "DEPRECATED" },
    },
    select: { id: true, text: true, metadata: true },
  });
  for (const c of nobel) {
    const meta = c.metadata as Record<string, unknown> | null;
    const category = typeof meta?.category === "string" ? meta.category : null;
    const yearStr = typeof meta?.awardYear === "string" ? meta.awardYear : null;
    const year = yearStr ? parseInt(yearStr, 10) : null;
    if (!category || !year || !SCIENCE_CATEGORIES.has(category)) continue;
    const m = c.text.match(/^(.+?) was awarded /);
    if (!m) continue;
    const name = m[1].trim();
    if (/\b(Institute|Programme|Office|Committee|Organisation|Organization)\b/i.test(name)) continue;
    result.push({ claimId: c.id, name, category, year, pipeline: "nobel_v1" });
  }

  const wd = await prisma.claim.findMany({
    where: {
      ingestedBy: "wikidata_nobel_v1",
      deleted: false,
      verificationStatus: { not: "DEPRECATED" },
    },
    select: { id: true, metadata: true },
  });
  for (const c of wd) {
    const meta = c.metadata as Record<string, unknown> | null;
    const name = typeof meta?.name === "string" ? meta.name : null;
    const category = typeof meta?.category === "string" ? meta.category : null;
    const year = typeof meta?.year === "number" ? meta.year : null;
    if (!name || !category || !year || !SCIENCE_CATEGORIES.has(category)) continue;
    result.push({ claimId: c.id, name, category, year, pipeline: "wikidata_nobel_v1" });
  }

  return result;
}

interface OAAuthor {
  id: string;
  display_name: string;
  cited_by_count: number;
  works_count: number;
}

interface OAWork {
  id: string;
  cited_by_count: number;
  doi: string | null;
  title: string | null;
}

async function fetchJson<T>(url: string): Promise<T | null> {
  const u = new URL(url);
  if (!u.searchParams.has("mailto")) u.searchParams.set("mailto", MAILTO);
  for (let attempt = 0; attempt < 3; attempt++) {
    let res: Response;
    try {
      res = await fetch(u, {
        headers: { "User-Agent": `epistemic-receipts/nobel-linker (${MAILTO})` },
      });
    } catch (e) {
      console.warn(`    network error (${(e as Error).message}); retrying in 5s`);
      await new Promise((r) => setTimeout(r, 5000));
      continue;
    }
    if (res.status === 429 || res.status === 503) {
      const retryAfter = parseInt(res.headers.get("retry-after") || "10", 10);
      console.warn(`    HTTP ${res.status}; sleeping ${retryAfter}s`);
      await new Promise((r) => setTimeout(r, retryAfter * 1000));
      continue;
    }
    if (!res.ok) {
      console.warn(`    HTTP ${res.status} ${u.pathname}`);
      return null;
    }
    return (await res.json()) as T;
  }
  return null;
}

async function findAuthor(laureate: Laureate): Promise<OAAuthor | null> {
  const url = `https://api.openalex.org/authors?filter=display_name.search:${encodeURIComponent(
    laureate.name
  )}&per-page=10`;
  const data = await fetchJson<{ results: OAAuthor[] }>(url);
  if (!data?.results?.length) return null;
  const matches = data.results.filter((a) => nameTokenSetMatch(a.display_name, laureate.name));
  if (!matches.length) return null;
  matches.sort((a, b) => b.cited_by_count - a.cited_by_count);
  return matches[0];
}

async function fetchAuthorWorks(authorId: string): Promise<OAWork[]> {
  const url = `https://api.openalex.org/works?filter=author.id:${encodeURIComponent(
    authorId
  )}&sort=cited_by_count:desc&per-page=25`;
  const data = await fetchJson<{ results: OAWork[] }>(url);
  return data?.results ?? [];
}

function workIdFromUrl(url: string): string | null {
  const m = url.match(/openalex\.org\/(W\d+)$/i);
  return m ? m[1] : null;
}

async function main() {
  console.log(`\nlink-nobel-openalex.ts — ${DRY_RUN ? "DRY RUN" : "LIVE"}\n`);

  const laureates = await loadLaureates();
  console.log(`  Loaded ${laureates.length} active science Nobel laureate claims`);

  const byName = new Map<string, Laureate[]>();
  for (const l of laureates) {
    const key = normalizeName(l.name);
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key)!.push(l);
  }
  console.log(`  Unique laureate names: ${byName.size}`);
  if (LAUREATE_LIMIT !== Infinity) {
    console.log(`  --limit=${LAUREATE_LIMIT} active`);
  }

  let processed = 0;
  let authorMatches = 0;
  let workMatches = 0;
  let inserted = 0;
  let updated = 0;
  let noAuthor = 0;
  let noOurWorks = 0;

  for (const [, claimsForName] of byName.entries()) {
    if (processed >= LAUREATE_LIMIT) break;
    processed++;
    const primary = claimsForName[0];
    console.log(
      `\n[${processed}/${Math.min(byName.size, LAUREATE_LIMIT)}] ${primary.name} (${primary.category} ${primary.year}) — ${claimsForName.length} claim(s)`
    );

    const author = await findAuthor(primary);
    await new Promise((r) => setTimeout(r, REQUEST_DELAY_MS));
    if (!author) {
      noAuthor++;
      console.log(`    no OpenAlex author match`);
      continue;
    }
    authorMatches++;
    console.log(
      `    matched author: ${author.display_name} (${author.id.replace("https://openalex.org/", "")}) — ${author.cited_by_count.toLocaleString()} cites, ${author.works_count} works`
    );

    const works = await fetchAuthorWorks(author.id);
    await new Promise((r) => setTimeout(r, REQUEST_DELAY_MS));
    if (!works.length) {
      console.log(`    no works returned`);
      continue;
    }
    const workIds = works
      .map((w) => workIdFromUrl(w.id))
      .filter((x): x is string => !!x);
    const externalIds = workIds.map((w) => `openalex_${w}`);

    const ourWorks = await prisma.claim.findMany({
      where: {
        ingestedBy: "openalex_v1",
        deleted: false,
        externalId: { in: externalIds },
      },
      select: { id: true, externalId: true },
    });
    if (!ourWorks.length) {
      noOurWorks++;
      console.log(`    0/${workIds.length} top works in our DB`);
      continue;
    }
    console.log(`    ${ourWorks.length}/${workIds.length} top works in our DB`);

    const workById = new Map(works.map((w) => [workIdFromUrl(w.id) ?? "", w]));
    for (const ow of ourWorks) {
      const workId = ow.externalId!.replace(/^openalex_/, "");
      const w = workById.get(workId);
      if (!w) continue;
      workMatches++;
      for (const nobelClaim of claimsForName) {
        if (nobelClaim.claimId === ow.id) continue;
        const followUpContext: Record<string, unknown> = {
          openalexAuthorId: author.id,
          openalexAuthorName: author.display_name,
          openalexAuthorCitedBy: author.cited_by_count,
          openalexWorkId: workId,
          workCitedByCount: w.cited_by_count,
          workTitle: w.title,
          heuristic: "openalex_author_search_top_token_match",
          confidence: "medium",
          laureateName: nobelClaim.name,
          category: nobelClaim.category,
          year: nobelClaim.year,
          nobelPipeline: nobelClaim.pipeline,
        };
        if (DRY_RUN) {
          inserted++;
          continue;
        }
        try {
          await prisma.claimRelation.create({
            data: {
              fromClaimId: ow.id,
              toClaimId: nobelClaim.claimId,
              relationType: "AUTHORED_BY",
              followUpContext,
            },
          });
          inserted++;
        } catch (e: unknown) {
          if ((e as { code?: string })?.code === "P2002") {
            await prisma.claimRelation.updateMany({
              where: {
                fromClaimId: ow.id,
                toClaimId: nobelClaim.claimId,
                relationType: "AUTHORED_BY",
              },
              data: { followUpContext },
            });
            updated++;
          } else throw e;
        }
      }
    }
  }

  console.log(`\n  Processed: ${processed} unique laureate names`);
  console.log(
    `  OpenAlex author matched: ${authorMatches} · no author: ${noAuthor} · no works in DB: ${noOurWorks}`
  );
  console.log(`  Work matches across all laureates: ${workMatches}`);
  console.log(
    `  Relations inserted: ${inserted} · updated: ${updated} · mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}`
  );

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
