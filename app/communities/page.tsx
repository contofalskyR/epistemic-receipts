import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Ratifying Communities — Epistemic Receipts",
  description:
    "What the five ratifying communities are, what ratification means in each one, and live counts of claims and transitions tracked per community.",
  openGraph: {
    title: "Ratifying Communities — Epistemic Receipts",
    description:
      "Expert literature, institutional, judicial, public, and market — what ratification means in each community and how many claims each tracks.",
    url: "/communities",
    siteName: "Epistemic Receipts",
  },
};

// Communities in enum order from prisma/schema.prisma:
//   EXPERT_LITERATURE | INSTITUTIONAL | JUDICIAL | PUBLIC | MARKET
// Never recall from memory — read from schema directly on edit.
const COMMUNITY_DEFS: {
  key: string;
  label: string;
  short: string;
  what: string;
  ratification: string;
  notes: string;
  exemplarSlug: string;
  exemplarTitle: string;
  exemplarArc: string;
}[] = [
  {
    key: "EXPERT_LITERATURE",
    label: "Expert Literature",
    short: "EL",
    what:
      "Peer-reviewed journals, preprints, systematic reviews, and the scholarly record. Claims here come from academic publications, meta-analyses, and the scientific community's own publication machinery.",
    ratification:
      "A transition is recorded when the published record moves — a landmark study establishes a claim (RECORDED → SETTLED), a systematic review opens it to dispute (SETTLED → CONTESTED), or a formal retraction withdraws it (SETTLED → REVERSED). The ratifying act is publication in the scholarly record.",
    notes:
      "The largest community by transition count. Includes retraction records via CrossRef/Retraction Watch and open academic catalogs via OpenAlex. A retracted paper moves to REVERSED — the journal's or authors' formal withdrawal, not an external judgment.",
    exemplarSlug: "smoking-lung-cancer",
    exemplarTitle: "Cigarette smoking causes lung cancer",
    exemplarArc: "CONTESTED → SETTLED (1950 → 1998)",
  },
  {
    key: "INSTITUTIONAL",
    label: "Institutional",
    short: "IN",
    what:
      "Government agencies, regulatory bodies, international organizations, and formal intergovernmental institutions. Transitions here are official regulatory decisions, legislative enactments, policy adoptions, or formal approvals.",
    ratification:
      "An institution ratifies a claim by acting on it: an FDA approval (RECORDED → SETTLED), a drug withdrawal (SETTLED → REVERSED), or a regulatory challenge (SETTLED → CONTESTED). The ratifying act is a formal institutional decision with traceable authority.",
    notes:
      "The largest community by claim count (~1.1M). Includes FDA drug approvals, congressional enactments, UN resolutions, EU regulations, and dozens of national legislative corpora. An institutional record does not require scientific consensus — regulatory decisions sometimes precede or contradict the expert-literature consensus.",
    exemplarSlug: "laiv-flumist-acip-not-recommended-reversal-2016",
    exemplarTitle: "FluMist (LAIV) not recommended — ACIP reversal",
    exemplarArc: "SETTLED → REVERSED (2003 → 2016 → 2018)",
  },
  {
    key: "JUDICIAL",
    label: "Judicial",
    short: "JU",
    what:
      "Courts of law: trial courts, appellate courts, and supreme courts at national and international levels. Claims here are established as legal precedent, overruled, or held as contested by dissent.",
    ratification:
      "A court ratifies a legal claim by ruling on it. A majority opinion settles the claim within that jurisdiction (RECORDED → SETTLED); a subsequent ruling by a higher court or the same court can reverse it (SETTLED → REVERSED). Dissents and cert-denials can mark it contested without settling.",
    notes:
      "Includes SCOTUS opinions, lower federal courts, international courts, and legislative votes. Precedential scope is jurisdiction-bound — a claim settled by one court may remain open in another. REVERSED here means overruled, not retracted.",
    exemplarSlug: "miranda-rights",
    exemplarTitle: "Police must inform suspects in custody of their constitutional rights",
    exemplarArc: "RECORDED → SETTLED (1966)",
  },
  {
    key: "PUBLIC",
    label: "Public Record",
    short: "PU",
    what:
      "The documented public record: well-attested events, journalistic record, and public institutional acts that do not require expert or regulatory authority to be recognized. Claims here are widely documented and sourced.",
    ratification:
      "Public-record ratification happens when an event is sufficiently documented across authoritative sources that its occurrence is no longer in question. An Apollo landing, a mine rescue, a treaty signing — these become SETTLED in the public record when the documentation is thorough and uncontested.",
    notes:
      "Smallest community by transition count. Includes publicly documented events that do not fit neatly into expert-literature or institutional categories. The bar is documentation quality, not scientific or legal authority.",
    exemplarSlug: "apollo11-moon-landing",
    exemplarTitle: "Apollo 11 humans first set foot on the Moon",
    exemplarArc: "RECORDED → SETTLED (1969)",
  },
  {
    key: "MARKET",
    label: "Market",
    short: "MK",
    what:
      "Commercial adoption, product launches, and market milestones. Claims here are ratified when a technology, product, or commercial entity reaches a documented market state — launch, adoption, discontinuation, or market exit.",
    ratification:
      "A market transition records a commercial fact: a product introduction (RECORDED → SETTLED), a commercial discontinuation (SETTLED → REVERSED), or a contested market claim (SETTLED → CONTESTED). The ratifying act is a documented commercial event with traceable sourcing.",
    notes:
      "Smallest community by claim count (~91 claims). Includes technology product launches and commercial milestones. Market ratification is distinct from expert-literature consensus — a product can be commercially settled (widely adopted) while scientifically contested.",
    exemplarSlug: "ibm-pc-introduced-1981",
    exemplarTitle: "IBM introduced the IBM Personal Computer",
    exemplarArc: "RECORDED → SETTLED (1981)",
  },
];

type CommunityCounts = {
  community: string;
  claims: bigint;
  transitions: bigint;
};

export default async function CommunitiesPage() {
  // Live counts from DB — never fabricated
  const rows = await prisma.$queryRaw<CommunityCounts[]>(
    Prisma.sql`
      SELECT
        community::text AS community,
        COUNT(DISTINCT "claimId") AS claims,
        COUNT(*) AS transitions
      FROM "ClaimStatusHistory"
      GROUP BY community
      ORDER BY COUNT(*) DESC
    `
  );

  const countMap = new Map(
    rows.map((r) => [r.community, { claims: Number(r.claims), transitions: Number(r.transitions) }])
  );

  return (
    <div className="max-w-4xl mx-auto px-6 py-12 space-y-12">
      {/* Header */}
      <header className="space-y-4">
        <p className="text-[11px] font-mono uppercase tracking-widest text-amber-400">
          Ratifying Communities
        </p>
        <h1 className="text-3xl font-bold text-white leading-tight">
          Who records what — and what that means
        </h1>
        <p className="text-gray-400 text-sm max-w-2xl leading-relaxed">
          A claim&apos;s epistemic status is community-relative. The five ratifying communities
          each have their own criteria for what counts as a settled, contested, or reversed
          claim. A transition is recorded when the relevant community acts — not when an
          outside observer judges it.
        </p>
        <p className="text-xs text-gray-600 max-w-xl">
          Community membership comes from{" "}
          <code className="text-[10px] text-gray-500">ClaimStatusHistory.community</code>{" "}
          (enum{" "}
          <code className="text-[10px] text-gray-500">RatifyingCommunity</code>{" "}
          in the schema). Counts below are live.
        </p>
      </header>

      {/* Community cards */}
      <div className="space-y-10">
        {COMMUNITY_DEFS.map((def) => {
          const counts = countMap.get(def.key);
          return (
            <section
              key={def.key}
              id={def.key.toLowerCase()}
              className="rounded-xl border border-gray-800 bg-gray-900/30 overflow-hidden"
            >
              {/* Header bar */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800 bg-gray-900/50">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-gray-800 text-gray-400">
                    {def.key}
                  </span>
                  <h2 className="text-base font-semibold text-white">{def.label}</h2>
                </div>
                {counts ? (
                  <div className="text-right shrink-0">
                    <p className="text-xs font-mono text-gray-300">
                      {counts.claims.toLocaleString()} claims
                    </p>
                    <p className="text-[10px] font-mono text-gray-600">
                      {counts.transitions.toLocaleString()} transitions
                    </p>
                  </div>
                ) : (
                  <p className="text-xs font-mono text-gray-600">no transitions recorded</p>
                )}
              </div>

              {/* Body */}
              <div className="px-5 py-4 space-y-4">
                <div className="space-y-1">
                  <p className="text-[10px] font-mono uppercase tracking-widest text-gray-600">
                    What this community is
                  </p>
                  <p className="text-sm text-gray-300 leading-relaxed">{def.what}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-mono uppercase tracking-widest text-gray-600">
                    What ratification means here
                  </p>
                  <p className="text-sm text-gray-400 leading-relaxed">{def.ratification}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-mono uppercase tracking-widest text-gray-600">
                    Notes
                  </p>
                  <p className="text-xs text-gray-500 leading-relaxed">{def.notes}</p>
                </div>

                {/* Exemplar */}
                <div className="border border-gray-700/50 rounded-lg p-3 space-y-1 bg-gray-900/50">
                  <p className="text-[10px] font-mono uppercase tracking-widest text-gray-600">
                    Exemplar arc
                  </p>
                  <Link
                    href={`/settling-curve/${def.exemplarSlug}`}
                    className="text-sm text-gray-300 hover:text-amber-300 transition-colors block"
                  >
                    {def.exemplarTitle}
                  </Link>
                  <p className="text-[10px] font-mono text-gray-600">{def.exemplarArc}</p>
                </div>
              </div>
            </section>
          );
        })}
      </div>

      {/* Footer */}
      <footer className="pt-6 border-t border-gray-800 space-y-4">
        <p className="text-xs text-gray-600 max-w-xl leading-relaxed">
          Communities are not ranked. Each has a different evidentiary standard and a
          different claim corpus. Where communities disagree, that disagreement is the
          data — not a defect.
        </p>
        <div className="flex flex-wrap gap-4 text-xs text-gray-600">
          <Link href="/split-ledger" className="hover:text-gray-400 transition-colors">
            Split Ledger — where communities disagree →
          </Link>
          <Link href="/methodology" className="hover:text-gray-400 transition-colors">
            Methodology →
          </Link>
          <Link href="/settling-curve" className="hover:text-gray-400 transition-colors">
            Settling Curve Explorer →
          </Link>
        </div>
      </footer>
    </div>
  );
}
