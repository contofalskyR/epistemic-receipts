/**
 * link-nih-openalex.ts
 *
 * Builds FUNDED_BY ClaimRelation rows from OpenAlex publication claims (fromClaim)
 * to NIH Reporter grant claims (toClaim) by querying the OpenAlex /works API with
 * the `awards.funder_award_id` filter.
 *
 * Grant identifier strategy:
 *   NIH project_num format: [type:1d]? [activity:3 chars] [institute:2 letters] [serial:6 digits] - [year:2d] [amend]?
 *   Examples:
 *     5DP1DK130689-03 → activity=DP1, institute=DK, serial=130689 → AIS "DP1DK130689", suffix "-03"
 *     1R01GM123456-01A1 → AIS "R01GM123456", suffix "-01A1"
 *
 *   OpenAlex stores `awards.funder_award_id` as the literal string the publisher
 *   reported. Common forms: "R01GM126567", "R01GM126567-01", "PHS R01 GM126567-01".
 *   The filter is exact-match (no substring/search variant exists for this field),
 *   so per grant we OR the base AIS plus every year-suffix we have in our DB.
 *
 * The activity-institute-serial (AIS) groups multi-year iterations of the same
 * grant. All NIH claims sharing an AIS represent renewals of one funded program,
 * so a matching paper is linked to every NIH claim in that group.
 *
 * Run:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/link-nih-openalex.ts --dry-run
 *   ALLOW_EDITS=true npx dotenv-cli -e .env.local -- npx tsx scripts/link-nih-openalex.ts --limit 500
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const OA_BASE = "https://api.openalex.org";
const MAILTO = "robert.contofalsky@rutgers.edu";
const UA = `epistemic-receipts/1.0 (mailto:${MAILTO})`;
const MIN_INTERVAL_MS = 110; // ~9 req/sec — under the 10/sec polite ceiling
const MAX_WORKS_PER_GRANT = 200;
const PER_PAGE = 100;

const DRY_RUN = !process.env.ALLOW_EDITS || process.argv.includes("--dry-run");

function parseArgs() {
  const args = process.argv.slice(2);
  const limitIdx = args.indexOf("--limit");
  const limit =
    limitIdx !== -1 ? parseInt(args[limitIdx + 1] ?? "0", 10) || 0 : 0;
  return { limit };
}

// ── Rate limiting + fetch ────────────────────────────────────────────────────
let lastReqAt = 0;
function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}
async function throttle() {
  const wait = MIN_INTERVAL_MS - (Date.now() - lastReqAt);
  if (wait > 0) await sleep(wait);
  lastReqAt = Date.now();
}

async function fetchJson<T = unknown>(
  url: string,
  retries = 3,
): Promise<T | null> {
  let delay = 1000;
  for (let attempt = 0; attempt <= retries; attempt++) {
    await throttle();
    let res: Response;
    try {
      res = await fetch(url, {
        headers: { "User-Agent": UA, Accept: "application/json" },
      });
    } catch (err) {
      if (attempt >= retries) {
        console.warn(
          `  fetch error after ${retries} retries: ${(err as Error).message}`,
        );
        return null;
      }
      await sleep(delay);
      delay *= 2;
      continue;
    }
    if (res.status === 404) return null;
    if ([429, 502, 503, 504].includes(res.status) && attempt < retries) {
      const retryAfter = parseInt(res.headers.get("retry-after") ?? "0", 10);
      const wait = retryAfter > 0 ? retryAfter * 1000 : delay;
      console.warn(`  HTTP ${res.status} — waiting ${wait}ms`);
      await sleep(wait);
      delay *= 2;
      continue;
    }
    if (!res.ok) {
      console.warn(`  HTTP ${res.status} ${url}`);
      return null;
    }
    try {
      return (await res.json()) as T;
    } catch {
      return null;
    }
  }
  return null;
}

// ── Grant id parsing ─────────────────────────────────────────────────────────

const PROJECT_NUM_RE = /^(\d)?([A-Z][A-Z0-9]{2})([A-Z]{2})(\d{6})(.*)$/;

function parseProjectNum(
  projectNum: string,
): { ais: string; suffix: string } | null {
  const m = projectNum.match(PROJECT_NUM_RE);
  if (!m) return null;
  const [, , activity, institute, serial, suffix] = m;
  return {
    ais: `${activity}${institute}${serial}`,
    suffix: suffix ?? "",
  };
}

function extractWorkId(idOrUrl: string | null | undefined): string | null {
  if (!idOrUrl) return null;
  const m = /\/W(\d+)$/i.exec(idOrUrl) || /^W(\d+)$/i.exec(idOrUrl);
  return m ? `W${m[1]}` : null;
}

// ── OpenAlex query (OR-multi-variant filter, cursor-paginated) ───────────────

interface OAWorkAward {
  funder_award_id?: string;
  funder_id?: string;
  funder_display_name?: string;
}
interface OAWork {
  id?: string;
  awards?: OAWorkAward[];
}
interface OAResp {
  meta?: { count?: number; next_cursor?: string | null };
  results?: OAWork[];
}

async function fetchWorksForGrant(
  ais: string,
  suffixes: Set<string>,
): Promise<Array<{ workId: string; matchedAwardId: string }>> {
  // Build OR'd value list: AIS, then AIS+each suffix we have in our DB.
  const variants = [ais];
  for (const s of suffixes) {
    if (s) variants.push(`${ais}${s}`);
  }
  const filterValue = variants.join("|");

  const out: Array<{ workId: string; matchedAwardId: string }> = [];
  let cursor: string | null = "*";
  let pages = 0;

  while (cursor && out.length < MAX_WORKS_PER_GRANT) {
    const url =
      `${OA_BASE}/works?filter=awards.funder_award_id:${encodeURIComponent(filterValue)}` +
      `&per-page=${PER_PAGE}&cursor=${encodeURIComponent(cursor)}` +
      `&mailto=${encodeURIComponent(MAILTO)}` +
      `&select=id,awards`;
    const resp = await fetchJson<OAResp>(url);
    if (!resp || !resp.results) break;

    const variantSet = new Set(variants);
    for (const w of resp.results) {
      const wid = extractWorkId(w.id);
      if (!wid) continue;
      // Find which of OUR variants this work's awards matched on.
      let matched = "";
      for (const a of w.awards ?? []) {
        if (a.funder_award_id && variantSet.has(a.funder_award_id)) {
          matched = a.funder_award_id;
          break;
        }
      }
      out.push({ workId: wid, matchedAwardId: matched });
    }
    cursor = resp.meta?.next_cursor ?? null;
    pages++;
    if (pages >= 2) break;
  }
  return out;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const { limit } = parseArgs();
  console.log(
    `\nlink-nih-openalex.ts — ${DRY_RUN ? "DRY RUN" : "LIVE"}` +
      (limit ? ` · limit=${limit} grants` : "") +
      `\n`,
  );

  // 1. Load NIH grant claims; group by activity+institute+serial.
  const nihClaims = await prisma.claim.findMany({
    where: { deleted: false, ingestedBy: "nih_reporter_v1" },
    select: { id: true, externalId: true },
  });
  console.log(`  ${nihClaims.length} active NIH grant claims`);

  type AisGroup = {
    nihClaimIds: string[];
    suffixes: Set<string>;
  };
  const aisGroups = new Map<string, AisGroup>();
  let parsedOk = 0;
  let parseFail = 0;

  for (const c of nihClaims) {
    if (!c.externalId) continue;
    const projectNum = c.externalId.replace(/^nih_grant_/, "");
    const parsed = parseProjectNum(projectNum);
    if (!parsed) {
      parseFail++;
      continue;
    }
    parsedOk++;
    const g = aisGroups.get(parsed.ais) ?? {
      nihClaimIds: [],
      suffixes: new Set<string>(),
    };
    g.nihClaimIds.push(c.id);
    g.suffixes.add(parsed.suffix);
    aisGroups.set(parsed.ais, g);
  }
  console.log(
    `  Parsed ${parsedOk} project_nums (${parseFail} unparseable) → ${aisGroups.size} unique activity+institute+serial groups`,
  );

  // 2. OpenAlex W-id → claim_id map (active claims only).
  const oaClaims = await prisma.claim.findMany({
    where: { deleted: false, ingestedBy: "openalex_v1" },
    select: { id: true, externalId: true },
  });
  const workIdToClaimId = new Map<string, string>();
  for (const c of oaClaims) {
    if (!c.externalId) continue;
    const wid = c.externalId.replace(/^openalex_/, "");
    if (/^W\d+$/.test(wid)) workIdToClaimId.set(wid, c.id);
  }
  console.log(
    `  ${workIdToClaimId.size} active OpenAlex claims indexed by W-id`,
  );

  // 3. Iterate grants, query OpenAlex, accumulate candidate pairs.
  const aisList = Array.from(aisGroups.keys());
  const queryList = limit > 0 ? aisList.slice(0, limit) : aisList;

  type Candidate = {
    nihClaimId: string;
    openalexClaimId: string;
    ais: string;
    workId: string;
    matchedAwardId: string;
  };
  const seenPairs = new Set<string>();
  const candidates: Candidate[] = [];

  let grantsProcessed = 0;
  let grantsWithResults = 0;
  let openalexWorksReturned = 0;
  let openalexWorksMatchedToDb = 0;

  for (const ais of queryList) {
    grantsProcessed++;
    const group = aisGroups.get(ais)!;
    const hits = await fetchWorksForGrant(ais, group.suffixes);
    openalexWorksReturned += hits.length;
    if (hits.length > 0) grantsWithResults++;

    for (const { workId, matchedAwardId } of hits) {
      const oaClaimId = workIdToClaimId.get(workId);
      if (!oaClaimId) continue;
      openalexWorksMatchedToDb++;
      for (const nihClaimId of group.nihClaimIds) {
        const key = `${oaClaimId}|${nihClaimId}`;
        if (seenPairs.has(key)) continue;
        seenPairs.add(key);
        candidates.push({
          nihClaimId,
          openalexClaimId: oaClaimId,
          ais,
          workId,
          matchedAwardId,
        });
      }
    }

    if (grantsProcessed % 25 === 0) {
      console.log(
        `  [${grantsProcessed}/${queryList.length}] grants · ${grantsWithResults} with results · ${candidates.length} candidate relations so far`,
      );
    }
  }

  console.log(
    `\n  Grants queried: ${grantsProcessed}` +
      ` · with OpenAlex results: ${grantsWithResults}` +
      ` · OA works returned: ${openalexWorksReturned}` +
      ` · OA works matching DB: ${openalexWorksMatchedToDb}`,
  );
  console.log(`  Unique candidate (paper→grant) pairs: ${candidates.length}`);

  // 4. Insert FUNDED_BY relations.
  let inserted = 0;
  let skipped = 0;
  for (const c of candidates) {
    const followUpContext = {
      activityInstituteSerial: c.ais,
      matchedAwardId: c.matchedAwardId,
      openalexWorkId: c.workId,
      heuristic: "openalex_awards_funder_award_id",
      confidence: "high",
      pipeline_from: "openalex_v1",
      pipeline_to: "nih_reporter_v1",
    };
    if (DRY_RUN) {
      inserted++;
      continue;
    }
    try {
      await prisma.claimRelation.create({
        data: {
          fromClaimId: c.openalexClaimId,
          toClaimId: c.nihClaimId,
          relationType: "FUNDED_BY",
          followUpContext,
        },
      });
      inserted++;
    } catch (e: unknown) {
      if ((e as { code?: string })?.code === "P2002") {
        skipped++;
      } else throw e;
    }
  }

  console.log(
    `\n  ClaimRelations ${DRY_RUN ? "would-be-inserted" : "inserted"}: ${inserted}` +
      ` · already-existed: ${skipped}` +
      ` · mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}`,
  );

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
