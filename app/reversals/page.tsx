import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import DomainCurveRail from "../components/DomainCurveRail";
import { FieldGuideBanner } from "@/components/FieldGuideBanner";

export const revalidate = 86400; // ISR: rebuild at most once per day

export const metadata: Metadata = {
  title: "Court Reversals — Epistemic Receipts",
  description:
    "Landmark Supreme Court and ECHR doctrines that were later overruled — Plessy to Brown, Roe to Dobbs, Chevron to Loper Bright. Each arc traces a definitive SETTLED ruling to its definitive REVERSED one, receipt by receipt.",
};

type ReversalArc = {
  slug: string;
  settledCase: string;
  settledYear: number;
  reversedCase: string;
  reversedYear: number;
  summary: string;
};

// Hand-curated from scripts/seed-court-reversals.ts — 8 doctrines settled by one
// ruling and later reversed by another, both ratified by the JUDICIAL community.
// Roe→Dobbs leads: it is the most legible reversal to a general audience.
const CURATED_ARCS: ReversalArc[] = [
  {
    slug: "roe-dobbs",
    settledCase: "Roe v. Wade",
    settledYear: 1973,
    reversedCase: "Dobbs v. Jackson Women's Health Organization",
    reversedYear: 2022,
    summary: "A constitutional right to abortion, recognized in 1973 and reaffirmed in Casey (1992), was overruled 49 years later.",
  },
  {
    slug: "plessy-brown",
    settledCase: "Plessy v. Ferguson",
    settledYear: 1896,
    reversedCase: "Brown v. Board of Education",
    reversedYear: 1954,
    summary: "\"Separate but equal\" racial segregation in public schools, upheld in 1896, was declared inherently unequal 58 years later.",
  },
  {
    slug: "chevron-loper-bright",
    settledCase: "Chevron U.S.A. v. NRDC",
    settledYear: 1984,
    reversedCase: "Loper Bright Enterprises v. Raimondo",
    reversedYear: 2024,
    summary: "Mandatory judicial deference to reasonable agency statutory interpretations, established in 1984, was overruled 40 years later.",
  },
  {
    slug: "korematsu-trump-hawaii",
    settledCase: "Korematsu v. United States",
    settledYear: 1944,
    reversedCase: "Trump v. Hawaii",
    reversedYear: 2018,
    summary: "Wartime internment on grounds of military necessity, upheld in 1944, was repudiated as \"gravely wrong the day it was decided\" 74 years later.",
  },
  {
    slug: "abood-janus",
    settledCase: "Abood v. Detroit Board of Education",
    settledYear: 1977,
    reversedCase: "Janus v. AFSCME",
    reversedYear: 2018,
    summary: "Public-sector union agency fees on non-members, upheld in 1977, were held to violate the First Amendment 41 years later.",
  },
  {
    slug: "bowers-lawrence",
    settledCase: "Bowers v. Hardwick",
    settledYear: 1986,
    reversedCase: "Lawrence v. Texas",
    reversedYear: 2003,
    summary: "State criminalization of private same-sex intimacy, upheld in 1986, was overruled 17 years later.",
  },
  {
    slug: "adkins-west-coast-hotel",
    settledCase: "Adkins v. Children's Hospital",
    settledYear: 1923,
    reversedCase: "West Coast Hotel Co. v. Parrish",
    reversedYear: 1937,
    summary: "Minimum-wage laws struck down as violating \"liberty of contract\" in 1923 were upheld 14 years later, ending the Lochner era.",
  },
  {
    slug: "rees-goodwin-echr",
    settledCase: "Rees v. United Kingdom",
    settledYear: 1986,
    reversedCase: "Christine Goodwin v. United Kingdom",
    reversedYear: 2002,
    summary: "The European Court of Human Rights held the Convention required no legal recognition of gender reassignment in 1986, then reversed course 16 years later.",
  },
];

export default function ReversalsPage() {
  const [featured, ...rest] = CURATED_ARCS;

  return (
    <div className="max-w-4xl mx-auto px-6 py-16 space-y-12">
      <FieldGuideBanner
        domain="Court Reversals"
        curatedHref="/settling-curve?t=roe-dobbs"
        curatedLabel="Roe v. Wade → Dobbs trajectory"
      />
      <header className="space-y-3">
        <p className="text-xs text-gray-600 font-mono uppercase tracking-widest">
          Judicial arcs
        </p>
        <h1 className="text-3xl sm:text-4xl font-bold text-white leading-tight">
          Court Reversals
        </h1>
        <p className="text-gray-400 text-base max-w-2xl leading-relaxed">
          Judicial reversals are the clearest case of epistemic settling: a court
          rules, the ruling is SETTLED doctrine — and decades later, another court
          reverses it. Unlike a slow drift in scientific consensus, each side of the
          arc is a single, dated, citable event. No inference is required to say
          when the law changed: the opinion says so on its face.
        </p>
      </header>

      {/* Featured: Roe → Dobbs */}
      <Link
        href={`/settling-curve?t=${featured.slug}`}
        className="group block rounded-xl bg-gray-900/70 border border-gray-800 hover:border-amber-500/60 px-6 py-6 transition-colors"
      >
        <span className="text-[10px] font-mono uppercase tracking-widest text-amber-500">
          Most-traced reversal
        </span>
        <p className="mt-2 text-white font-semibold text-xl leading-snug group-hover:text-amber-300 transition-colors">
          {featured.settledCase} ({featured.settledYear}) → {featured.reversedCase} ({featured.reversedYear})
        </p>
        <p className="mt-2 text-gray-400 text-sm leading-relaxed max-w-2xl">
          {featured.summary}
        </p>
        <span className="mt-3 inline-block text-xs font-mono text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity">
          trace the full arc →
        </span>
      </Link>

      {/* Curated list */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-white">
          Eight landmark overruling arcs
        </h2>
        <ul className="space-y-3">
          {rest.map((arc) => (
            <li key={arc.slug}>
              <Link
                href={`/settling-curve?t=${arc.slug}`}
                className="group flex flex-col sm:flex-row sm:items-start gap-3 rounded-lg bg-gray-900/50 border border-gray-800 hover:border-gray-600 px-5 py-4 transition-colors"
              >
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="text-white font-medium text-sm leading-snug group-hover:text-amber-300 transition-colors">
                    {arc.settledCase} → {arc.reversedCase}
                  </p>
                  <p className="text-gray-500 text-xs leading-relaxed">{arc.summary}</p>
                </div>
                <span className="shrink-0 font-mono text-[11px] text-gray-500">
                  {arc.settledYear} → {arc.reversedYear}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Dynamic rail: the 8 curated arcs above plus SCOTUS overruling-table arcs
          detected against courtlistener_scotus_v1 (event:scotus_overrulings_v1). */}
      <Suspense fallback={null}>
        <DomainCurveRail
          title="All judicial reversal arcs"
          subtitle="Curated trajectories above, plus every Supreme Court opinion matched against the Library of Congress Constitution Annotated Table of Decisions Overruled — each with its own settling curve."
          pipelines={["seed-court-reversals", "courtlistener_scotus_v1"]}
          limit={20}
        />
      </Suspense>

      <footer className="pt-4 border-t border-gray-800 flex gap-6 text-sm text-gray-500">
        <Link href="/settling-curve" className="hover:text-amber-400 transition-colors">
          Browse all trajectories →
        </Link>
        <Link href="/opinions" className="hover:text-amber-400 transition-colors">
          Court opinions →
        </Link>
        <Link href="/law-settler" className="hover:text-amber-400 transition-colors">
          Law Settler Curve →
        </Link>
      </footer>
    </div>
  );
}
