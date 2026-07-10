import type { ClaimDetail } from "@/lib/claim-detail";
import type { TrajectoryDetail } from "@/lib/trajectory-detail";
import { resolveDisplayAxis } from "@/lib/transition-contract";
import { SITE_URL } from "@/lib/site";

// ── JSON-LD builders (briefing 04, task 5) ────────────────────────────────────
// Vocabulary choice: no fake ClaimReview ratings. A claim record is honestly a
// schema.org `Claim` (CreativeWork subtype) with dated status assertions in the
// description; a settling curve is honestly a `Dataset` of dated transitions.
// Fields that don't map cleanly (epistemicAxis as a rating, community as a
// publisher) stay in free text rather than being shoehorned into typed slots.

/** JSON.stringify safe for inline <script> — escapes `<` so claim/source text
 *  can never break out via `</script>`. */
export function serializeJsonLd(obj: object): string {
  return JSON.stringify(obj).replace(/</g, "\\u003c");
}

/** ISO-8601 date string honest about precision: YEAR → "1912", MONTH →
 *  "1912-04", otherwise full date. Never claims day precision we don't have. */
function isoDate(iso: string, precision: string | null): string {
  const d = iso.slice(0, 10);
  if (precision === "YEAR") return d.slice(0, 4);
  if (precision === "QUARTER" || precision === "MONTH") return d.slice(0, 7);
  return d;
}

function compact<T extends object>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== null && v !== undefined && v !== "" &&
      !(Array.isArray(v) && v.length === 0)),
  ) as T;
}

export function claimJsonLd(claim: ClaimDetail): object {
  const url = `${SITE_URL}/claims/${claim.id}`;
  const latest = claim.statusHistory[0] ?? null;

  // Dated status assertion — the honest core of the markup. Display axis, not
  // the stored column (leak site #5): a reversed claim must not tell crawlers
  // it is still SETTLED/CONTESTED.
  const statusBits = [
    `Epistemic status: ${resolveDisplayAxis(claim) ?? "unclassified"}` +
      (latest ? ` as of ${isoDate(latest.occurredAt, latest.datePrecision)}` : ""),
    latest
      ? `Latest transition: ${latest.fromAxis ? `${latest.fromAxis} → ` : ""}${latest.toAxis}`
      : null,
    `${claim._count.statusHistory} recorded status ${claim._count.statusHistory === 1 ? "transition" : "transitions"}`,
  ].filter(Boolean);

  // One citation per unique source; DOI-backed sources are ScholarlyArticles
  // (the openalex corpus), everything else stays a plain CreativeWork.
  const seen = new Set<string>();
  const citations = claim.edges
    .filter(e => (seen.has(e.source.id) ? false : (seen.add(e.source.id), true)))
    .map(e => compact({
      "@type": e.source.url?.startsWith("https://doi.org/") ? "ScholarlyArticle" : "CreativeWork",
      name: e.source.name,
      url: e.source.url ?? undefined,
      datePublished: e.source.publishedAt ? e.source.publishedAt.slice(0, 10) : undefined,
    }));

  return compact({
    "@context": "https://schema.org",
    "@type": "Claim",
    "@id": url,
    url,
    text: claim.text,
    description: statusBits.join(". ") + ".",
    datePublished: claim.claimEmergedAt
      ? isoDate(claim.claimEmergedAt, claim.claimEmergedPrecision)
      : undefined,
    dateCreated: claim.createdAt.slice(0, 10),
    // Task spec: dateModified = latest transition date (falls back to record creation).
    dateModified: latest ? isoDate(latest.occurredAt, latest.datePrecision) : claim.createdAt.slice(0, 10),
    keywords: claim.topics.map(t => t.topic.name),
    citation: citations,
    isPartOf: {
      "@type": "Dataset",
      name: "Epistemic Receipts",
      url: SITE_URL,
    },
  });
}

export function trajectoryJsonLd(traj: TrajectoryDetail, permalinkId: string): object {
  const url = `${SITE_URL}/settling-curve/${permalinkId}`;
  const first = traj.transitions[0] ?? null;
  const last = traj.transitions[traj.transitions.length - 1] ?? null;

  return compact({
    "@context": "https://schema.org",
    "@type": "Dataset",
    "@id": url,
    url,
    name: `Settling curve — ${traj.claimText.length > 90 ? traj.claimText.slice(0, 89).trimEnd() + "…" : traj.claimText}`,
    description:
      `${traj.transitions.length} dated epistemic status ${traj.transitions.length === 1 ? "transition" : "transitions"} ` +
      `for the claim: ${traj.claimText}`,
    temporalCoverage: first && last
      ? `${isoDate(first.occurredAt, first.datePrecision)}/${isoDate(last.occurredAt, last.datePrecision)}`
      : undefined,
    dateModified: last ? isoDate(last.occurredAt, last.datePrecision) : undefined,
    about: {
      "@type": "Claim",
      "@id": `${SITE_URL}/claims/${traj.claimId}`,
      url: `${SITE_URL}/claims/${traj.claimId}`,
      text: traj.claimText,
    },
    // Each transition as a dated CreativeWork part — structured, no invented
    // rating vocabulary. Community + reason stay in text fields.
    hasPart: traj.transitions.map(t => compact({
      "@type": "CreativeWork",
      name: `${t.fromAxis ? `${t.fromAxis} → ` : ""}${t.toAxis}`,
      datePublished: isoDate(t.occurredAt, t.datePrecision),
      description: [
        `Community: ${t.community.replace(/_/g, " ").toLowerCase()}`,
        t.reason,
      ].filter(Boolean).join(". "),
      citation: t.markerSource
        ? compact({
            "@type": "CreativeWork",
            name: t.markerSource.name,
            url: t.markerSource.url ?? undefined,
          })
        : undefined,
    })),
  });
}
