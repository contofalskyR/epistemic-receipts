/**
 * link-congress-outcomes.ts
 *
 * Pipeline 4 of the follow-up linker batch.
 *
 * Two relation types:
 *
 *   OUTCOME — Congress enacted bill → NARA archival record that references that bill
 *     by Public Law number or act name. NARA records were ingested as
 *     nara_catalog_v1 (137,913 claims). The reliable signal here is an act-name
 *     match between NARA text and a congress_v1 short title.
 *
 *   SUPERSEDED_BY — earlier congress bill → later congress bill that amends it.
 *     Patterns: "to amend section X of [Act]", "to amend [Act], Public Law N-M",
 *     "amend Public Law N-M". When the referenced act name is present in the
 *     short-title index of congress_v1, the pair gets linked.
 *
 * Run:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/link-congress-outcomes.ts --dry-run
 *   ALLOW_EDITS=true npx dotenv-cli -e .env.local -- npx tsx scripts/link-congress-outcomes.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DRY_RUN = !process.env.ALLOW_EDITS || process.argv.includes("--dry-run");

// Extract the short title from congress_v1 text:
//   "H.R. 901 (101st Congress) enacted — Veterans' Benefits Amendments of 1989"
const TITLE_RE = /enacted\s+[—\-]\s+(.+)$/;

// Strip common prefixes when normalizing for matching:
//   "To amend section X of " · "A bill to amend " · "A joint resolution to "
const LEADING_PREFIX_RE =
  /^(?:A\s+(?:bill|joint\s+resolution|act|resolution)\s+(?:to\s+)?|To\s+(?:amend|make|provide|establish|authorize|reauthorize|extend|repeal|require|prohibit|direct|clarify|correct|remove)\s+)/i;

function normalizeTitle(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.,;:].*$/, "") // drop everything after first heavy punctuation
    .replace(/\s+/g, " ")
    .trim();
}

// Match patterns that reference an existing act by name
const REF_PATTERNS: RegExp[] = [
  /to amend\s+(?:the\s+)?([A-Z][A-Za-z'’\- ]+?Act(?:\s+of\s+\d{4})?)\b/,
  /amend section\s+\S+\s+of\s+(?:the\s+)?([A-Z][A-Za-z'’\- ]+?Act(?:\s+of\s+\d{4})?)\b/i,
  /amend(?:s)? Public Law\s+(\d+[-–]\d+)/i,
  /\(the\s+([A-Z][A-Za-z'’\- ]+?Act(?:\s+of\s+\d{4})?),\s*Public Law/i,
  /Public Law\s+\d+[-–]\d+\s*\(?\s*the\s+([A-Z][A-Za-z'’\- ]+?Act(?:\s+of\s+\d{4})?)/i,
];

interface CongressIndex {
  byShortTitle: Map<string, string>; // normalized title → claim id
  byActName: Map<string, string>;     // any "X Act of YYYY" extracted from short title
}

function indexCongress(rows: Array<{ id: string; text: string }>): CongressIndex {
  const byShortTitle = new Map<string, string>();
  const byActName = new Map<string, string>();

  for (const row of rows) {
    const m = row.text.match(TITLE_RE);
    if (!m) continue;
    const title = m[1].replace(/^\s+|\s+$/g, "");
    const norm = normalizeTitle(title);
    if (norm.length > 4) {
      if (!byShortTitle.has(norm)) byShortTitle.set(norm, row.id);
      // Also pull out trailing "X Act of YYYY" fragments
      const actMatch = title.match(/([A-Z][A-Za-z'’\- ]+?Act(?:\s+of\s+\d{4})?)/);
      if (actMatch) {
        const an = normalizeTitle(actMatch[1]);
        if (an.length > 8 && !byActName.has(an)) byActName.set(an, row.id);
      }
    }
  }

  return { byShortTitle, byActName };
}

function lookupAct(idx: CongressIndex, name: string): string | null {
  const n = normalizeTitle(name);
  if (n.length < 8) return null;
  return idx.byActName.get(n) ?? idx.byShortTitle.get(n) ?? null;
}

async function upsertRelation(
  fromClaimId: string,
  toClaimId: string,
  relationType: "OUTCOME" | "SUPERSEDED_BY",
  followUpContext: Record<string, unknown>
): Promise<"inserted" | "updated"> {
  if (DRY_RUN) return "inserted";
  try {
    await prisma.claimRelation.create({
      data: { fromClaimId, toClaimId, relationType, followUpContext },
    });
    return "inserted";
  } catch (e: unknown) {
    if ((e as { code?: string })?.code === "P2002") {
      await prisma.claimRelation.updateMany({
        where: { fromClaimId, toClaimId, relationType },
        data: { followUpContext },
      });
      return "updated";
    }
    throw e;
  }
}

async function main() {
  console.log(`\nlink-congress-outcomes.ts — ${DRY_RUN ? "DRY RUN" : "LIVE"}\n`);

  // 1. Build congress_v1 index
  const congress = await prisma.claim.findMany({
    where: { deleted: false, ingestedBy: "congress_v1" },
    select: { id: true, text: true, metadata: true },
  });
  const idx = indexCongress(congress);
  console.log(
    `  Indexed ${congress.length} congress_v1 claims · short titles: ${idx.byShortTitle.size} · act names: ${idx.byActName.size}`
  );

  // 2. Pass A — SUPERSEDED_BY between bills via amendment-reference patterns
  let supInserted = 0;
  let supUpdated = 0;
  let supCandidates = 0;
  for (const bill of congress) {
    let referencedActName: string | null = null;
    let publicLawRef: string | null = null;
    for (const re of REF_PATTERNS) {
      const m = bill.text.match(re);
      if (m) {
        // The "amends Public Law N-M" variant captures a PL number, not an act name
        if (/Public Law/.test(re.source)) {
          if (!referencedActName) publicLawRef = m[1];
        } else {
          referencedActName = m[1];
          break;
        }
      }
    }
    if (!referencedActName) continue;
    supCandidates++;
    const parentId = lookupAct(idx, referencedActName);
    if (!parentId || parentId === bill.id) continue;

    const followUpContext: Record<string, unknown> = {
      country: "United States",
      corpus: "congress_v1",
      amendmentType: /repeal/i.test(bill.text) ? "repeals" : "amends",
      referencedAct: referencedActName,
      publicLawRef,
      heuristic: "congress_amend_act_name",
      confidence: "medium",
    };

    const r = await upsertRelation(parentId, bill.id, "SUPERSEDED_BY", followUpContext);
    if (r === "inserted") supInserted++;
    else supUpdated++;
  }
  console.log(
    `  Pass A — SUPERSEDED_BY: candidates=${supCandidates} inserted=${supInserted} updated=${supUpdated}`
  );

  // 3. Pass B — OUTCOME: NARA archival records that mention a congress_v1 act name
  // Pull NARA claims that have any of the recognized reference patterns
  // (Public Law N-M, or "X Act of YYYY" embedded in NARA text/scopeNote).
  const naraRefs = await prisma.$queryRaw<
    Array<{ id: string; text: string; scope_note: string | null }>
  >`
    SELECT id, text, metadata->>'scopeNote' AS scope_note
    FROM "Claim"
    WHERE "ingestedBy" = 'nara_catalog_v1'
      AND deleted = false
      AND (
        text ~* 'Public Law\\s+\\d+[\\-–]\\d+'
        OR text ~* '[A-Z][a-zA-Z]+\\s+(?:[A-Za-z]+\\s+){0,5}Act\\s+of\\s+\\d{4}'
        OR metadata->>'scopeNote' ~* 'Public Law\\s+\\d+[\\-–]\\d+'
      )
  `;
  console.log(`  NARA candidates referencing Public Law / Act-of-YYYY: ${naraRefs.length}`);

  const NARA_ACT_RE = /([A-Z][A-Za-z'’\- ]+?Act(?:\s+of\s+\d{4}))/;

  let outInserted = 0;
  let outUpdated = 0;
  let outMatched = 0;
  for (const nara of naraRefs) {
    const blob = `${nara.text} ${nara.scope_note ?? ""}`;
    const acts = new Set<string>();
    const allMatches = blob.match(/[A-Z][A-Za-z'’\- ]+?Act\s+of\s+\d{4}/g);
    if (allMatches) for (const a of allMatches) acts.add(a.trim());

    for (const act of acts) {
      const billId = lookupAct(idx, act);
      if (!billId) continue;
      outMatched++;
      const followUpContext: Record<string, unknown> = {
        outcomeType: "archival_record",
        actName: act,
        heuristic: "nara_act_name_match",
        confidence: "medium",
        pipeline_from: "congress_v1",
        pipeline_to: "nara_catalog_v1",
      };
      const r = await upsertRelation(billId, nara.id, "OUTCOME", followUpContext);
      if (r === "inserted") outInserted++;
      else outUpdated++;
    }
  }
  console.log(
    `  Pass B — OUTCOME (Congress→NARA): matched=${outMatched} inserted=${outInserted} updated=${outUpdated}`
  );

  console.log(
    `\n  Total · inserted=${supInserted + outInserted} updated=${supUpdated + outUpdated} (mode: ${DRY_RUN ? "DRY RUN" : "LIVE"})`
  );

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
