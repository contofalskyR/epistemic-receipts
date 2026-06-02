/**
 * link-clinicaltrials-outcomes.ts
 *
 * Builds an NCT → trial-claim index from clinicaltrials_v1, then scans OpenAlex
 * claim text AND the linked Source.url field for NCT references. Writes OUTCOME
 * ClaimRelation rows: trial claim → results-paper claim.
 *
 * Also inspects each trial's text for "primary completion <month year>" and
 * notes inferred completion status in followUpContext when a paper is linked.
 *
 * The initial pass of this linker (in link-claim-followups.ts) found 32 links —
 * this version broadens the NCT regex (allows whitespace between NCT and digits),
 * scans Source.url in addition to text, and adds completion-status context.
 *
 * Run:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/link-clinicaltrials-outcomes.ts --dry-run
 *   ALLOW_EDITS=true npx dotenv-cli -e .env.local -- npx tsx scripts/link-clinicaltrials-outcomes.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DRY_RUN = !process.env.ALLOW_EDITS || process.argv.includes("--dry-run");

const NCT_TEXT_RE = /NCT[\s_-]?(\d{8})/gi;
const PRIMARY_COMPLETION_RE = /primary completion\s+([A-Za-z]+)\s+(\d{4})/i;

const MONTHS: Record<string, number> = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
};

interface CompletionInfo {
  primaryCompletion: string; // "April 2026"
  inferredStatus: "completed_past" | "ongoing_future" | "unknown";
}

function parseCompletion(text: string): CompletionInfo | null {
  const m = text.match(PRIMARY_COMPLETION_RE);
  if (!m) return null;
  const monthName = m[1].toLowerCase();
  const year = parseInt(m[2], 10);
  const monthIdx = MONTHS[monthName];
  if (monthIdx === undefined) return null;
  const completionDate = new Date(year, monthIdx, 28);
  const now = new Date();
  const inferredStatus = completionDate < now ? "completed_past" : "ongoing_future";
  return { primaryCompletion: `${m[1]} ${m[2]}`, inferredStatus };
}

async function main() {
  console.log(`\nlink-clinicaltrials-outcomes.ts — ${DRY_RUN ? "DRY RUN" : "LIVE"}\n`);

  // 1. Build NCT → trial info index
  const trials = await prisma.claim.findMany({
    where: { deleted: false, ingestedBy: "clinicaltrials_v1" },
    select: { id: true, externalId: true, text: true, metadata: true },
  });
  const nctToTrial = new Map<
    string,
    { id: string; completion: CompletionInfo | null }
  >();
  for (const t of trials) {
    const m = t.externalId?.match(/NCT\d{8}/i);
    if (!m) continue;
    nctToTrial.set(m[0].toUpperCase(), {
      id: t.id,
      completion: parseCompletion(t.text),
    });
  }
  console.log(`  Indexed ${nctToTrial.size} trial claims by NCT id`);

  let withCompletion = 0;
  let pastCompletion = 0;
  for (const v of nctToTrial.values()) {
    if (v.completion) {
      withCompletion++;
      if (v.completion.inferredStatus === "completed_past") pastCompletion++;
    }
  }
  console.log(
    `  Completion-date parseable: ${withCompletion} (${pastCompletion} past completion / ${withCompletion - pastCompletion} future)`
  );

  // 2. Scan OpenAlex claim text for NCT ids (broader pattern: optional whitespace/separator)
  const textHits = await prisma.$queryRaw<Array<{ id: string; text: string }>>`
    SELECT id, text FROM "Claim"
    WHERE "ingestedBy" = 'openalex_v1'
      AND deleted = false
      AND text ~* 'NCT[\\s_-]?[0-9]{8}'
  `;
  console.log(`  ${textHits.length} OpenAlex claims contain NCT pattern in text`);

  // 3. Scan OpenAlex source URLs for NCT ids (clinical trial paper landing pages etc.)
  const urlHits = await prisma.$queryRaw<
    Array<{ claim_id: string; url: string }>
  >`
    SELECT DISTINCT c.id AS claim_id, s.url
    FROM "Claim" c
    JOIN "Edge" e ON e."claimId" = c.id
    JOIN "Source" s ON s.id = e."sourceId"
    WHERE c."ingestedBy" = 'openalex_v1'
      AND c.deleted = false
      AND s.url ~* 'NCT[0-9]{8}'
  `;
  console.log(`  ${urlHits.length} OpenAlex claims have NCT in source URL`);

  // 4. Collect candidate (trialId, paperClaimId, nctId, source: text|url) tuples
  type Candidate = {
    trialId: string;
    paperId: string;
    nct: string;
    via: "text" | "source_url";
  };
  const seenPairs = new Set<string>();
  const candidates: Candidate[] = [];

  function add(trialId: string, paperId: string, nct: string, via: "text" | "source_url") {
    const key = `${trialId}|${paperId}`;
    if (seenPairs.has(key)) return;
    seenPairs.add(key);
    candidates.push({ trialId, paperId, nct, via });
  }

  for (const paper of textHits) {
    const matches = paper.text.match(NCT_TEXT_RE);
    if (!matches) continue;
    for (const raw of matches) {
      const nct = raw.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
      const trial = nctToTrial.get(nct);
      if (trial) add(trial.id, paper.id, nct, "text");
    }
  }
  for (const row of urlHits) {
    const m = row.url.match(/NCT\d{8}/i);
    if (!m) continue;
    const nct = m[0].toUpperCase();
    const trial = nctToTrial.get(nct);
    if (trial) add(trial.id, row.claim_id, nct, "source_url");
  }

  console.log(`  ${candidates.length} unique trial→paper candidates`);

  // 5. Insert OUTCOME relations
  let inserted = 0;
  let skipped = 0;
  for (const c of candidates) {
    const trialInfo = nctToTrial.get(c.nct);
    const followUpContext: Record<string, unknown> = {
      nctId: c.nct,
      outcomeType: "results_paper",
      via: c.via,
      heuristic: "nct_id_match",
      confidence: c.via === "source_url" ? "very_high" : "high",
      pipeline_from: "clinicaltrials_v1",
      pipeline_to: "openalex_v1",
    };
    if (trialInfo?.completion) {
      followUpContext.primaryCompletion = trialInfo.completion.primaryCompletion;
      followUpContext.inferredStatus = trialInfo.completion.inferredStatus;
    }

    if (DRY_RUN) {
      inserted++;
      continue;
    }
    try {
      await prisma.claimRelation.create({
        data: {
          fromClaimId: c.trialId,
          toClaimId: c.paperId,
          relationType: "OUTCOME",
          followUpContext,
        },
      });
      inserted++;
    } catch (e: unknown) {
      if ((e as { code?: string })?.code === "P2002") {
        // Existing relation from the prior linker pass — refresh followUpContext
        // so completion-status info lands on every trial→paper link.
        await prisma.claimRelation.updateMany({
          where: {
            fromClaimId: c.trialId,
            toClaimId: c.paperId,
            relationType: "OUTCOME",
          },
          data: { followUpContext },
        });
        skipped++;
      } else throw e;
    }
  }

  console.log(
    `\n  Inserted: ${inserted} · skipped (already existed): ${skipped} · mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}`
  );
  console.log(
    `  Note: clinicaltrials_v1 metadata is null on all ${trials.length} claims — status tagging via metadata.status is not possible, so completion is parsed from claim text instead.`
  );

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
