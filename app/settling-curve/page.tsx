import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const revalidate = 3600;

interface TimelineEvent {
  year: number;
  date: string;
  label: string;
  description: string;
  claimId: string | null;
  badge: { text: string; style: string };
  status: "trial" | "approval" | "signal" | "expansion" | "monitoring";
}

const STATUS_COLOR: Record<string, string> = {
  trial:      "bg-blue-500",
  approval:   "bg-emerald-500",
  signal:     "bg-orange-500",
  expansion:  "bg-teal-500",
  monitoring: "bg-yellow-500",
};

const STATUS_LINE: Record<string, string> = {
  trial:      "border-blue-800",
  approval:   "border-emerald-800",
  signal:     "border-orange-800",
  expansion:  "border-teal-800",
  monitoring: "border-yellow-800",
};

async function getClaimById(id: string): Promise<string | null> {
  const c = await prisma.claim.findUnique({ where: { id }, select: { id: true } });
  return c?.id ?? null;
}

async function getFirstApproval(drugName: string, year: number): Promise<string | null> {
  const c = await prisma.claim.findFirst({
    where: {
      ingestedBy: "drugsatfda_v1",
      text: { contains: drugName, mode: "insensitive" },
      claimEmergedAt: { gte: new Date(`${year}-01-01`), lte: new Date(`${year}-12-31`) },
    },
    select: { id: true },
  });
  return c?.id ?? null;
}

async function getFaers(drugName: string): Promise<{ id: string; reports: number } | null> {
  const c = await prisma.claim.findFirst({
    where: { ingestedBy: "faers_normalized_drugs_v1", text: { contains: drugName, mode: "insensitive" } },
    select: { id: true, metadata: true },
  });
  if (!c) return null;
  const meta = c.metadata as { total_reports?: number } | null;
  return { id: c.id, reports: meta?.total_reports ?? 0 };
}

async function getFirstTrial(drugName: string): Promise<{ id: string; text: string; year: number } | null> {
  const c = await prisma.claim.findFirst({
    where: { ingestedBy: "clinicaltrials_v1", text: { contains: drugName, mode: "insensitive" } },
    select: { id: true, text: true, claimEmergedAt: true },
    orderBy: { claimEmergedAt: "asc" },
  });
  if (!c) return null;
  return {
    id: c.id,
    text: c.text,
    year: c.claimEmergedAt ? new Date(c.claimEmergedAt).getFullYear() : 0,
  };
}

function formatReports(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
}

export default async function SettlingCurvePage() {
  const [
    ozempicId,
    rybelsusId,
    wegovyId,
    wegovy2025Id,
    faersData,
    trial,
  ] = await Promise.all([
    getFirstApproval("OZEMPIC", 2017),
    getFirstApproval("RYBELSUS", 2019),
    getFirstApproval("WEGOVY", 2021),
    getFirstApproval("WEGOVY", 2025),
    getFaers("SEMAGLUTIDE"),
    getFirstTrial("semaglutide"),
  ]);

  const events = ([
    {
      year: trial?.year ?? 2019,
      date: trial ? `${trial.year}` : "2019",
      label: "Phase 3 trials begin",
      description: "SUSTAIN and SCALE trials establish cardiovascular benefit and weight-loss efficacy. The first clinical trial registrations enter the public record.",
      claimId: trial?.id ?? null,
      badge: { text: "Registered Trial", style: "bg-blue-900/70 text-blue-300 border border-blue-700/50" },
      status: "trial",
    },
    {
      year: 2017,
      date: "December 5, 2017",
      label: "Ozempic: FDA approves for Type 2 Diabetes",
      description: "Novo Nordisk's once-weekly injectable semaglutide (Ozempic) receives FDA approval under NDA 209637 as a GLP-1 receptor agonist for blood-sugar control. First formal epistemic anchor: this drug works for this indication.",
      claimId: ozempicId,
      badge: { text: "FDA Approved", style: "bg-emerald-900/70 text-emerald-300 border border-emerald-700/50" },
      status: "approval",
    },
    {
      year: 2019,
      date: "September 20, 2019",
      label: "Rybelsus: first oral GLP-1 approved",
      description: "FDA approves an oral formulation (NDA 213051) — a significant delivery breakthrough. Evidence base expands from the injectable to the pill. The drug is no longer a single product.",
      claimId: rybelsusId,
      badge: { text: "FDA Approved", style: "bg-emerald-900/70 text-emerald-300 border border-emerald-700/50" },
      status: "expansion",
    },
    {
      year: 2021,
      date: "June 4, 2021",
      label: "Wegovy: approved for chronic weight management",
      description: "At the higher 2.4 mg dose, semaglutide receives approval under NDA 215256 as Wegovy — the first anti-obesity medication to produce trial weight loss comparable to surgery. The indication shifts from glycemic control to obesity itself. Epistemic status: confirmed across two separate indication buckets.",
      claimId: wegovyId,
      badge: { text: "FDA Approved", style: "bg-emerald-900/70 text-emerald-300 border border-emerald-700/50" },
      status: "approval",
    },
    {
      year: 2023,
      date: "2023",
      label: `Adverse event reports: ${faersData ? formatReports(faersData.reports) : "—"} and rising`,
      description: `As of mid-2026, FDA FAERS contains ${faersData ? faersData.reports.toLocaleString() : "—"} adverse event reports associated with semaglutide — voluntary submissions from clinicians and patients. The most frequently reported: nausea, vomiting, diarrhea (GI effects). Signal for rare but serious events (gastroparesis, thyroid tumors) under active monitoring. Reports are not confirmed causation.`,
      claimId: faersData?.id ?? null,
      badge: { text: "Adverse Events", style: "bg-orange-900/70 text-orange-300 border border-orange-700/50" },
      status: "signal",
    },
    {
      year: 2025,
      date: "December 22, 2025",
      label: "Wegovy oral tablet approved",
      description: "FDA approves an oral tablet formulation of Wegovy (NDA 218316) — the obesity indication now available in pill form. A new approval while prior safety signals remain under monitoring. The epistemic arc continues: each milestone adds evidence, not closure.",
      claimId: wegovy2025Id,
      badge: { text: "FDA Approved", style: "bg-emerald-900/70 text-emerald-300 border border-emerald-700/50" },
      status: "monitoring",
    },
  ] as TimelineEvent[]).sort((a, b) => a.year - b.year);

  return (
    <div className="max-w-2xl space-y-10">

      {/* Header */}
      <div className="space-y-3">
        <p className="text-xs text-gray-600 font-mono uppercase tracking-widest">Settling Curve Demo</p>
        <h1 className="text-2xl font-semibold text-white leading-snug">
          How Semaglutide became one of the most prescribed drugs in history
        </h1>
        <p className="text-sm text-gray-400 leading-relaxed">
          A settling curve traces how scientific confidence in a claim builds — or unravels — over time.
          Each point is a receipt: a datable event backed by a primary source in this database.
          This one follows semaglutide (Ozempic, Wegovy, Rybelsus) from its first trials
          through FDA approval to its current status as a blockbuster under active safety surveillance.
        </p>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        {[
          { dot: "bg-blue-500",    label: "Trial registration" },
          { dot: "bg-emerald-500", label: "FDA approval" },
          { dot: "bg-orange-500",  label: "Adverse event signal" },
          { dot: "bg-teal-500",    label: "New indication" },
          { dot: "bg-yellow-500",  label: "Ongoing monitoring" },
        ].map(({ dot, label }) => (
          <span key={label} className="flex items-center gap-1.5 text-gray-400">
            <span className={`w-2 h-2 rounded-full ${dot} shrink-0`} />
            {label}
          </span>
        ))}
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-3 top-2 bottom-2 w-px bg-gray-800" />

        <div className="space-y-0">
          {events.map((ev, i) => (
            <div key={i} className="relative pl-10 pb-10 last:pb-0">
              {/* Dot */}
              <div className={`absolute left-0 top-1.5 w-7 h-7 rounded-full ${STATUS_COLOR[ev.status]} flex items-center justify-center shadow-lg ring-4 ring-gray-950`}>
                <span className="text-white font-bold text-[10px] leading-none">{ev.year % 100}</span>
              </div>

              {/* Event card */}
              <div className={`rounded-lg border ${STATUS_LINE[ev.status]} bg-gray-900/60 px-4 py-4 space-y-2`}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="space-y-0.5">
                    <p className="text-xs text-gray-600 font-mono">{ev.date}</p>
                    <h3 className="text-sm font-semibold text-white leading-snug">{ev.label}</h3>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${ev.badge.style}`}>
                    {ev.badge.text}
                  </span>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed">{ev.description}</p>
                {ev.claimId ? (
                  <Link
                    href={`/claims/${ev.claimId}`}
                    className="inline-flex items-center gap-1 text-xs text-gray-600 hover:text-gray-300 transition-colors mt-1"
                  >
                    View source claim →
                  </Link>
                ) : (
                  <span className="text-xs text-gray-700 mt-1 italic">No linked claim</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Interpretation */}
      <div className="rounded-lg border border-gray-800 bg-gray-900/40 px-5 py-5 space-y-3 text-sm text-gray-400 leading-relaxed">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">What this curve shows</h2>
        <p>
          A claim doesn&apos;t settle when it&apos;s first published — it settles when independent
          evidence accumulates, replications succeed, and regulators formalize their judgment.
          Semaglutide followed the canonical path: Phase 3 trials, FDA approval, post-market
          surveillance. The {faersData ? faersData.reports.toLocaleString() : "76,000+"} adverse
          event reports are not evidence of failure; they&apos;re evidence of a functioning
          pharmacovigilance system. The drug is still being watched.
        </p>
        <p>
          Compare this to the Vioxx (rofecoxib) arc — approved 1999, withdrawn 2004 after
          FAERS signals of cardiovascular events were confirmed in the APPROVe trial.
          That curve started the same way and broke differently. The receipt system
          captures both. Neither story is visible from a single data point.
        </p>
        <div className="flex items-center gap-3 pt-2 border-t border-gray-800 flex-wrap">
          <Link href="/search?q=semaglutide" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
            Search all semaglutide claims →
          </Link>
          <Link href="/search?q=retracted" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
            Browse retracted papers →
          </Link>
          <Link href="/about" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
            About this project →
          </Link>
        </div>
      </div>

    </div>
  );
}
