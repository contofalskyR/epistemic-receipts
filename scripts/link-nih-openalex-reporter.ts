/**
 * link-nih-openalex-reporter.ts
 *
 * Builds FUNDED_BY ClaimRelation rows using NIH Reporter + PubMed APIs.
 * Avoids the OpenAlex daily rate limit entirely.
 *
 * Three-phase strategy:
 *   Phase 1: Query NIH Reporter /v2/publications/search by core project num
 *            → collect Map<pmid, Set<core_project_num>>
 *   Phase 2: Query PubMed esummary in batches of 500 PMIDs
 *            → collect Map<pmid, doi>
 *   Phase 3: DOI → OpenAlex claim → create FUNDED_BY relations
 *
 * Run:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/link-nih-openalex-reporter.ts --dry-run
 *   ALLOW_EDITS=true npx dotenv-cli -e .env.local -- npx tsx scripts/link-nih-openalex-reporter.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const REPORTER_BASE = "https://api.reporter.nih.gov/v2";
const PUBMED_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const MAILTO = "robert.contofalsky@rutgers.edu";
const TOOL = "epistemic-receipts";

const REPORTER_INTERVAL_MS = 300; // ~3 req/sec
const PUBMED_INTERVAL_MS = 400; // ~2.5 req/sec (conservative, no API key)
const REPORTER_BATCH = 10; // core_project_nums per NIH Reporter request
const PUBMED_BATCH = 400; // PMIDs per PubMed esummary request
const REPORTER_PER_PAGE = 500;

const DRY_RUN = !process.env.ALLOW_EDITS || process.argv.includes("--dry-run");

// ── Grant number helpers ──────────────────────────────────────────────────────

const PROJECT_NUM_RE = /^(\d)?([A-Z][A-Z0-9]{2})([A-Z]{2})(\d{6})(.*)$/;

function toCoreProjectNum(projectNum: string): string | null {
  const m = projectNum.match(PROJECT_NUM_RE);
  if (!m) return null;
  const [, , activity, institute, serial] = m;
  return `${activity}${institute}${serial}`;
}

function normalizeDoi(doi: string | null | undefined): string | null {
  if (!doi) return null;
  const cleaned = doi
    .replace(/^https?:\/\/doi\.org\//i, "")
    .toLowerCase()
    .trim();
  return cleaned || null;
}

// ── Rate limiting ─────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function makeThrottle(intervalMs: number) {
  let lastReqAt = 0;
  return async function throttle() {
    const wait = intervalMs - (Date.now() - lastReqAt);
    if (wait > 0) await sleep(wait);
    lastReqAt = Date.now();
  };
}

const reporterThrottle = makeThrottle(REPORTER_INTERVAL_MS);
const pubmedThrottle = makeThrottle(PUBMED_INTERVAL_MS);

// ── NIH Reporter API ──────────────────────────────────────────────────────────

interface ReporterPub {
  pmid?: number | null;
  coreproject?: string | null;
}
interface ReporterResp {
  meta?: { total?: number };
  results?: ReporterPub[];
}

async function fetchReporterPubs(
  coreNums: string[],
  offset: number,
  retries = 3,
): Promise<ReporterResp | null> {
  let delay = 2000;
  for (let attempt = 0; attempt <= retries; attempt++) {
    await reporterThrottle();
    let res: Response;
    try {
      res = await fetch(`${REPORTER_BASE}/publications/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          criteria: { core_project_nums: coreNums },
          fields: ["pmid", "coreproject"],
          offset,
          limit: REPORTER_PER_PAGE,
          sort_field: "coreproject",
          sort_order: "desc",
        }),
      });
    } catch (err) {
      if (attempt >= retries) {
        console.warn(`  Reporter fetch error: ${(err as Error).message}`);
        return null;
      }
      await sleep(delay);
      delay *= 2;
      continue;
    }
    if ([429, 502, 503, 504].includes(res.status) && attempt < retries) {
      const ra = parseInt(res.headers.get("retry-after") ?? "0", 10);
      const wait = ra > 0 ? Math.min(ra * 1000, 120_000) : delay;
      console.warn(`  Reporter HTTP ${res.status} — waiting ${wait}ms`);
      await sleep(wait);
      delay *= 2;
      continue;
    }
    if (!res.ok) {
      console.warn(`  Reporter HTTP ${res.status}`);
      return null;
    }
    try {
      return (await res.json()) as ReporterResp;
    } catch {
      return null;
    }
  }
  return null;
}

// ── PubMed esummary API ───────────────────────────────────────────────────────

interface PubmedSummary {
  uid?: string;
  articleids?: Array<{ idtype?: string; value?: string }>;
}
interface PubmedSummaryResp {
  result?: Record<string, PubmedSummary | "ERROR">;
}

async function fetchPubmedDois(
  pmids: number[],
  retries = 3,
): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  if (pmids.length === 0) return out;

  let delay = 2000;
  const url =
    `${PUBMED_BASE}/esummary.fcgi?db=pubmed` +
    `&id=${pmids.join(",")}` +
    `&retmode=json` +
    `&tool=${encodeURIComponent(TOOL)}` +
    `&email=${encodeURIComponent(MAILTO)}`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    await pubmedThrottle();
    let res: Response;
    try {
      res = await fetch(url);
    } catch (err) {
      if (attempt >= retries) {
        console.warn(`  PubMed fetch error: ${(err as Error).message}`);
        return out;
      }
      await sleep(delay);
      delay *= 2;
      continue;
    }
    if ([429, 429, 503].includes(res.status) && attempt < retries) {
      const ra = parseInt(res.headers.get("retry-after") ?? "0", 10);
      const wait = ra > 0 ? Math.min(ra * 1000, 30_000) : delay;
      console.warn(`  PubMed HTTP ${res.status} — waiting ${wait}ms`);
      await sleep(wait);
      delay *= 2;
      continue;
    }
    if (!res.ok) {
      console.warn(`  PubMed HTTP ${res.status}`);
      return out;
    }
    let data: PubmedSummaryResp;
    try {
      data = (await res.json()) as PubmedSummaryResp;
    } catch {
      return out;
    }
    for (const [pmidStr, summary] of Object.entries(data.result ?? {})) {
      if (summary === "ERROR" || !summary || pmidStr === "uids") continue;
      const doi = summary.articleids
        ?.find((a) => a.idtype === "doi")
        ?.value?.trim();
      const normalized = normalizeDoi(doi);
      if (normalized) out.set(Number(pmidStr), normalized);
    }
    return out;
  }
  return out;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(
    `\nlink-nih-openalex-reporter.ts — ${DRY_RUN ? "DRY RUN" : "LIVE"}\n`,
  );

  // 1. Build DOI → claimId index from OpenAlex claims.
  console.log("  Loading OpenAlex claims (DOI index)...");
  const oaClaims = await prisma.claim.findMany({
    where: { deleted: false, ingestedBy: "openalex_v1" },
    select: { id: true, metadata: true },
  });
  const doiToClaimId = new Map<string, string>();
  let doiMissing = 0;
  for (const c of oaClaims) {
    const meta = c.metadata as Record<string, unknown> | null;
    const doi = normalizeDoi(meta?.doi as string | null | undefined);
    if (!doi) {
      doiMissing++;
      continue;
    }
    doiToClaimId.set(doi, c.id);
  }
  console.log(
    `  ${doiToClaimId.size} OpenAlex claims indexed by DOI (${doiMissing} without DOI)`,
  );

  // 2. Load NIH claims → group by core_project_num.
  console.log("  Loading NIH grant claims...");
  const nihClaims = await prisma.claim.findMany({
    where: { deleted: false, ingestedBy: "nih_reporter_v1" },
    select: { id: true, externalId: true },
  });
  const coreToNihIds = new Map<string, string[]>();
  let parseFail = 0;
  for (const c of nihClaims) {
    if (!c.externalId) continue;
    const projectNum = c.externalId.replace(/^nih_grant_/, "");
    const core = toCoreProjectNum(projectNum);
    if (!core) {
      parseFail++;
      continue;
    }
    if (!coreToNihIds.has(core)) coreToNihIds.set(core, []);
    coreToNihIds.get(core)!.push(c.id);
  }
  const uniqueCores = Array.from(coreToNihIds.keys());
  console.log(
    `  ${nihClaims.length} NIH claims → ${uniqueCores.length} unique core project nums` +
      ` (${parseFail} unparseable)`,
  );

  // 3. Load existing FUNDED_BY relations.
  const existingRels = await prisma.claimRelation.findMany({
    where: { relationType: "FUNDED_BY" },
    select: { fromClaimId: true, toClaimId: true },
  });
  const existingSet = new Set(
    existingRels.map((r) => `${r.fromClaimId}|${r.toClaimId}`),
  );
  console.log(`  ${existingSet.size} FUNDED_BY relations already in DB`);

  // ── Phase 1: NIH Reporter → collect pmid→core mappings ────────────────────

  console.log("\n  [Phase 1] Querying NIH Reporter publications...");
  const pmidToCores = new Map<number, Set<string>>();
  const batches: string[][] = [];
  for (let i = 0; i < uniqueCores.length; i += REPORTER_BATCH) {
    batches.push(uniqueCores.slice(i, i + REPORTER_BATCH));
  }

  let batchNum = 0;
  let pubsReturned = 0;
  for (const batch of batches) {
    batchNum++;
    let offset = 0;
    let total = Infinity;

    while (offset < total) {
      const resp = await fetchReporterPubs(batch, offset);
      if (!resp || !resp.results) break;
      total = resp.meta?.total ?? 0;
      pubsReturned += resp.results.length;

      for (const pub of resp.results) {
        const pmid = pub.pmid;
        const core = (pub.coreproject ?? "").toUpperCase().trim();
        if (!pmid || !core || !coreToNihIds.has(core)) continue;
        if (!pmidToCores.has(pmid)) pmidToCores.set(pmid, new Set());
        pmidToCores.get(pmid)!.add(core);
      }

      offset += resp.results.length;
      if (resp.results.length < REPORTER_PER_PAGE) break;
    }

    if (batchNum % 50 === 0 || batchNum === batches.length) {
      console.log(
        `    [${batchNum}/${batches.length}] batches · pubs=${pubsReturned}` +
          ` · unique pmids=${pmidToCores.size}`,
      );
    }
  }
  console.log(
    `  Phase 1 done: ${pubsReturned} publications · ${pmidToCores.size} unique PMIDs`,
  );

  // ── Phase 2: PubMed esummary → PMID → DOI ─────────────────────────────────

  console.log("\n  [Phase 2] Querying PubMed esummary for DOIs...");
  const allPmids = Array.from(pmidToCores.keys());
  const pmidToDoi = new Map<number, string>();
  const pubmedBatches: number[][] = [];
  for (let i = 0; i < allPmids.length; i += PUBMED_BATCH) {
    pubmedBatches.push(allPmids.slice(i, i + PUBMED_BATCH));
  }

  let pmidBatchNum = 0;
  for (const pmidBatch of pubmedBatches) {
    pmidBatchNum++;
    const dois = await fetchPubmedDois(pmidBatch);
    for (const [pmid, doi] of dois) {
      pmidToDoi.set(pmid, doi);
    }
    if (pmidBatchNum % 10 === 0 || pmidBatchNum === pubmedBatches.length) {
      console.log(
        `    [${pmidBatchNum}/${pubmedBatches.length}] batches` +
          ` · dois resolved=${pmidToDoi.size}`,
      );
    }
  }
  const doiHitRate = allPmids.length > 0
    ? ((pmidToDoi.size / allPmids.length) * 100).toFixed(1)
    : "0";
  console.log(
    `  Phase 2 done: ${pmidToDoi.size}/${allPmids.length} PMIDs resolved to DOI (${doiHitRate}%)`,
  );

  // ── Phase 3: Match DOIs → create FUNDED_BY relations ──────────────────────

  console.log("\n  [Phase 3] Matching DOIs to OpenAlex claims...");
  let doiMatched = 0;
  let inserted = 0;
  let skipped = 0;

  for (const [pmid, doi] of pmidToDoi) {
    const oaClaimId = doiToClaimId.get(doi);
    if (!oaClaimId) continue;
    doiMatched++;

    const cores = pmidToCores.get(pmid) ?? new Set();
    for (const core of cores) {
      const nihIds = coreToNihIds.get(core) ?? [];
      for (const nihClaimId of nihIds) {
        const key = `${oaClaimId}|${nihClaimId}`;
        if (existingSet.has(key)) {
          skipped++;
          continue;
        }
        existingSet.add(key);

        if (DRY_RUN) {
          inserted++;
          continue;
        }
        try {
          await prisma.claimRelation.create({
            data: {
              fromClaimId: oaClaimId,
              toClaimId: nihClaimId,
              relationType: "FUNDED_BY",
              followUpContext: {
                pmid,
                coreProjectNum: core,
                doi,
                heuristic: "nih_reporter_publications+pubmed_doi",
                confidence: "high",
                pipeline_from: "openalex_v1",
                pipeline_to: "nih_reporter_v1",
              },
            },
          });
          inserted++;
        } catch (e: unknown) {
          if ((e as { code?: string })?.code === "P2002") {
            skipped++;
          } else throw e;
        }
      }
    }
  }

  console.log(
    `\n  DOI matched in DB      : ${doiMatched}` +
      `\n  ClaimRelations ${DRY_RUN ? "would-insert" : "inserted"}: ${inserted}` +
      `\n  Already existed        : ${skipped}` +
      `\n  Mode                   : ${DRY_RUN ? "DRY RUN" : "LIVE"}`,
  );

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
