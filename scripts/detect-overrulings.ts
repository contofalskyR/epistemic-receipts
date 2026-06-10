/**
 * detect-overrulings.ts  (Settling Curve — Phase B2)
 *
 * READ-ONLY candidate detector. Scans existing judicial opinion claims for
 * self-overruling language, attempts to resolve the overruled case against
 * other opinion claims in the DB, and emits a JSON report.
 *
 *   ⚠️  This script NEVER writes ClaimStatusHistory (or any other) rows.
 *       Its sole output is /tmp/overruling-candidates.json. Promoting any
 *       candidate to a live trajectory is a separate, human-reviewed step.
 *
 * Detection patterns (per brief):
 *   /\b(we |hereby )?overrul/i     — "we overrule", "hereby overruling", "overruled"
 *   /is overruled/i
 *   /abrogat/i                     — "abrogated", "abrogating"
 *
 * Scope: claims ingested by a courtlistener_* or echr_* pipeline (the judicial
 * corpora). For each claim we search its own text AND its primary Source's name
 * (the citation line), since this corpus stores templated case-name claims rather
 * than full opinion bodies. Restricting to judicial corpora avoids false hits
 * from legislative "abrogato/abrogación" titles and parliamentary "overruled the
 * chair" vote descriptions.
 *
 * Resolution: opinion claims are indexed by every "X v. Y" case name parsed from
 * their text/source name. For each detected hit we extract candidate case names
 * mentioned in the matched text and look them up in that index.
 *
 * Run:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/detect-overrulings.ts
 */

import { PrismaClient } from "@prisma/client";
import * as fs from "fs";

const prisma = new PrismaClient();
const REPORT_PATH = "/tmp/overruling-candidates.json";

const PATTERNS: Array<{ label: string; re: RegExp }> = [
  { label: "overrule", re: /\b(?:we\s+|hereby\s+)?overrul/i },
  { label: "is-overruled", re: /is\s+overruled/i },
  { label: "abrogate", re: /abrogat/i },
];

// Parse "X v. Y" (or "X v Y") case names out of a blob of text.
const CASE_NAME_RE = /([A-Z][A-Za-z.'&-]+(?:\s+[A-Z][A-Za-z.'&-]+){0,5})\s+v\.?\s+([A-Z][A-Za-z.'&-]+(?:\s+[A-Z][A-Za-z.'&-]+){0,5})/g;

function normalizeCaseName(a: string, b: string): string {
  return `${a.trim().toLowerCase()} v ${b.trim().toLowerCase()}`.replace(/\s+/g, " ");
}

function extractCaseNames(text: string): Array<{ raw: string; norm: string }> {
  const out: Array<{ raw: string; norm: string }> = [];
  CASE_NAME_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = CASE_NAME_RE.exec(text)) !== null) {
    out.push({ raw: `${m[1]} v. ${m[2]}`, norm: normalizeCaseName(m[1], m[2]) });
  }
  return out;
}

interface OpinionClaim {
  claimId: string;
  externalId: string | null;
  ingestedBy: string;
  claimText: string;
  sourceName: string | null;
  sourceUrl: string | null;
}

async function main() {
  console.log("detect-overrulings.ts — READ-ONLY candidate scan");

  const claims = await prisma.claim.findMany({
    where: {
      deleted: false,
      OR: [{ ingestedBy: { contains: "courtlistener" } }, { ingestedBy: { contains: "echr" } }],
    },
    select: {
      id: true,
      externalId: true,
      ingestedBy: true,
      text: true,
      edges: {
        where: { deleted: false },
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { source: { select: { name: true, url: true } } },
      },
    },
  });
  console.log(`  Scanning ${claims.length} judicial opinion claims (courtlistener_* + echr_*)`);

  const opinions: OpinionClaim[] = claims.map((c) => ({
    claimId: c.id,
    externalId: c.externalId,
    ingestedBy: c.ingestedBy,
    claimText: c.text,
    sourceName: c.edges[0]?.source?.name ?? null,
    sourceUrl: c.edges[0]?.source?.url ?? null,
  }));

  // Index opinions by normalized case name for overruled-case resolution.
  const caseIndex = new Map<string, OpinionClaim[]>();
  for (const op of opinions) {
    const blob = `${op.claimText} ${op.sourceName ?? ""}`;
    for (const { norm } of extractCaseNames(blob)) {
      const arr = caseIndex.get(norm) ?? [];
      arr.push(op);
      caseIndex.set(norm, arr);
    }
  }
  console.log(`  Indexed ${caseIndex.size} distinct case names for resolution.`);

  interface Candidate {
    overrulingClaimId: string;
    overrulingExternalId: string | null;
    overrulingCorpus: string;
    overrulingCaseText: string;
    matchedPattern: string;
    matchedField: "claim_text" | "source_name";
    matchedSnippet: string;
    referencedCaseNames: string[];
    resolvedOverruled: Array<{ caseName: string; claimId: string; externalId: string | null }>;
  }

  const candidates: Candidate[] = [];
  const patternCounts: Record<string, number> = {};

  for (const op of opinions) {
    const fields: Array<{ field: "claim_text" | "source_name"; text: string | null }> = [
      { field: "claim_text", text: op.claimText },
      { field: "source_name", text: op.sourceName },
    ];
    for (const { field, text } of fields) {
      if (!text) continue;
      for (const pat of PATTERNS) {
        const m = pat.re.exec(text);
        if (!m) continue;
        patternCounts[pat.label] = (patternCounts[pat.label] ?? 0) + 1;

        // Snippet around the match for human review.
        const idx = m.index;
        const snippet = text.slice(Math.max(0, idx - 80), idx + 120).replace(/\s+/g, " ").trim();

        // Resolve any referenced case names (excluding this opinion's own name).
        const ownNames = new Set(extractCaseNames(`${op.claimText} ${op.sourceName ?? ""}`).map((c) => c.norm));
        const referenced = extractCaseNames(text).filter((c) => !ownNames.has(c.norm));
        const resolved: Candidate["resolvedOverruled"] = [];
        for (const ref of referenced) {
          const hits = caseIndex.get(ref.norm) ?? [];
          for (const h of hits) {
            if (h.claimId === op.claimId) continue;
            resolved.push({ caseName: ref.raw, claimId: h.claimId, externalId: h.externalId });
          }
        }

        candidates.push({
          overrulingClaimId: op.claimId,
          overrulingExternalId: op.externalId,
          overrulingCorpus: op.ingestedBy,
          overrulingCaseText: op.claimText.slice(0, 160),
          matchedPattern: pat.label,
          matchedField: field,
          matchedSnippet: snippet,
          referencedCaseNames: referenced.map((c) => c.raw),
          resolvedOverruled: resolved,
        });
      }
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    scope: "courtlistener_* + echr_* opinion claims (judicial corpora)",
    scannedClaims: opinions.length,
    indexedCaseNames: caseIndex.size,
    patterns: PATTERNS.map((p) => ({ label: p.label, regex: p.re.source })),
    patternCounts,
    candidateCount: candidates.length,
    resolvedCount: candidates.filter((c) => c.resolvedOverruled.length > 0).length,
    note:
      "READ-ONLY. No ClaimStatusHistory rows are written by this script. This corpus stores " +
      "templated case-name claims (e.g. 'The U.S. Supreme Court in X v. Y (YEAR) issued a ruling…'), " +
      "not full opinion bodies, so self-overruling language is rarely present in the stored text. " +
      "A low/zero candidate count is the honest result for the current corpus, not a bug. To mine " +
      "actual overrulings, ingest full opinion text first, then re-run.",
    candidates,
  };

  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), "utf8");

  console.log(`\n=== Report ===`);
  console.log(`  Scanned claims:   ${report.scannedClaims}`);
  console.log(`  Pattern hits:     ${JSON.stringify(patternCounts)}`);
  console.log(`  Candidates:       ${report.candidateCount} (resolved overruled case: ${report.resolvedCount})`);
  console.log(`  ClaimStatusHistory rows written: 0 (read-only detector)`);
  console.log(`  Report → ${REPORT_PATH}`);
  if (candidates.length) {
    console.log(`\n  Sample candidates (up to 5):`);
    for (const c of candidates.slice(0, 5)) {
      console.log(`   - [${c.matchedPattern}/${c.matchedField}] ${c.overrulingCaseText}`);
      console.log(`     snippet: "${c.matchedSnippet}"`);
      console.log(`     resolved: ${c.resolvedOverruled.map((r) => r.caseName).join(", ") || "(none)"}`);
    }
  } else {
    console.log(`\n  No overruling candidates detected in the current (templated-text) corpus.`);
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
