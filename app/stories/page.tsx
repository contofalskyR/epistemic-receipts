import type { Metadata } from "next";
import Link from "next/link";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Stories — Epistemic Receipts",
  description:
    "Editorial narratives tracing how specific claims moved through the epistemic graph — from first record to contested to settled (or abandoned). Each sentence traces to a receipt already in the database.",
  alternates: { canonical: "/stories" },
};

const STORIES: {
  href: string;
  eyebrow: string;
  title: string;
  summary: string;
  arc: string;
}[] = [
  {
    href: "/stories/h-pylori",
    eyebrow: "Medicine",
    title: "H. pylori: one conference, two verdicts",
    summary:
      "The 1994 NIH Consensus Conference ratified the bacterial theory of ulcers and reversed the stress/acid theory it replaced — in the same statement.",
    arc: "CONTESTED → SETTLED + REVERSED",
  },
  {
    href: "/stories/smoking-lung-cancer",
    eyebrow: "Epidemiology",
    title: "Smoke and Evidence",
    summary:
      "Doll & Hill's 1950 BMJ study linked cigarettes to lung cancer. It took fourteen more years for the U.S. Surgeon General to settle the consensus.",
    arc: "CONTESTED → SETTLED (1950–1998)",
  },
  {
    href: "/stories/continental-drift",
    eyebrow: "Earth sciences",
    title: "The Long Abandonment of Wegener",
    summary:
      "Wegener proposed continental drift in 1915. Mainstream geology abandoned it in 1926. Vine and Matthews resurrected it with seafloor magnetic data in 1963.",
    arc: "CONTESTED → ABANDONED → SETTLED",
  },
  {
    href: "/stories/cold-fusion",
    eyebrow: "Physics",
    title: "Eight Months from Announcement to Abandonment",
    summary:
      "Fleischmann and Pons announced cold fusion in April 1989. By November, the DOE advisory board found no convincing evidence. The arc closed in under a year.",
    arc: "CONTESTED → ABANDONED (1989)",
  },
  {
    href: "/stories/semaglutide-glp1",
    eyebrow: "Pharmacology",
    title: "From Lab Target to Ozempic: GLP-1's 25-Year Arc",
    summary:
      "A 1996 Nature paper identified GLP-1's appetite-suppressing role in rats. Semaglutide reached FDA approval in 2017 — and a second approval for obesity in 2021.",
    arc: "RECORDED → SETTLED (1996–2021)",
  },
  {
    href: "/stories/cfc-ozone-depletion",
    eyebrow: "Atmospheric chemistry",
    title: "The Ozone Claim: From Chemistry to Treaty",
    summary:
      "Molina and Rowland's 1974 prediction that CFCs destroy stratospheric ozone was contested for over a decade before the Montreal Protocol ratified it in 1987.",
    arc: "CONTESTED → SETTLED (1974–1995)",
  },
  {
    href: "/stories/dietary-fat-heart",
    eyebrow: "Nutrition science",
    title: "The Dietary Fat Hypothesis: Settled, Then Contested Again",
    summary:
      "Ancel Keys's 1953 analysis linking saturated fat to heart disease settled with the 1980 Dietary Guidelines — then a 2010 meta-analysis returned it to CONTESTED.",
    arc: "CONTESTED → SETTLED → CONTESTED",
  },
  {
    href: "/stories/voting-rights-act-1965",
    eyebrow: "Constitutional law",
    title: "The Voting Rights Act: Settlement and Partial Reversal",
    summary:
      "Enacted in 1965 and upheld unanimously by the Supreme Court in 1966, the VRA's preclearance mechanism was reversed by Shelby County v. Holder in 2013.",
    arc: "RECORDED → SETTLED → REVERSED",
  },
];

export default function StoriesIndexPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-16 space-y-12">
      <header className="space-y-3">
        <p className="text-xs text-gray-600 font-mono uppercase tracking-widest">
          Editorial
        </p>
        <h1 className="text-3xl sm:text-4xl font-bold text-white leading-tight">
          Stories
        </h1>
        <p className="text-gray-400 text-base max-w-2xl leading-relaxed">
          Each story traces a specific claim through the epistemic graph — from first
          record through contested, settled, or abandoned. Every factual sentence
          links to a receipt already in the database. These are editorial syntheses,
          not independent research.
        </p>
      </header>

      <ul className="space-y-4">
        {STORIES.map((s) => (
          <li key={s.href}>
            <Link
              href={s.href}
              className="group block rounded-xl bg-gray-900/70 border border-gray-800 hover:border-amber-500/50 px-6 py-5 transition-colors space-y-2"
            >
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-[10px] font-mono uppercase tracking-widest text-gray-500">
                  {s.eyebrow}
                </span>
                <span className="text-[10px] font-mono text-gray-600">·</span>
                <span className="text-[10px] font-mono text-amber-500/80">
                  {s.arc}
                </span>
              </div>
              <p className="text-white font-semibold text-base leading-snug group-hover:text-amber-300 transition-colors">
                {s.title}
              </p>
              <p className="text-gray-500 text-sm leading-relaxed max-w-2xl">
                {s.summary}
              </p>
              <span className="text-xs font-mono text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity">
                read the arc →
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <footer className="pt-4 border-t border-gray-800 flex gap-6 text-sm text-gray-500">
        <Link href="/settling-curve" className="hover:text-amber-400 transition-colors">
          Browse all trajectories →
        </Link>
        <Link href="/trajectories" className="hover:text-amber-400 transition-colors">
          Trajectory encyclopedia →
        </Link>
      </footer>
    </div>
  );
}
