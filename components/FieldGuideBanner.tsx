import Link from "next/link";

type Props = {
  domain: string;
  curatedHref?: string;
  curatedLabel?: string;
  className?: string;
};

export function FieldGuideBanner({ domain, curatedHref, curatedLabel, className = "" }: Props) {
  return (
    <div className={`rounded-lg border border-dashed border-gray-700/60 bg-gray-900/40 px-4 py-3 flex items-start justify-between gap-4 flex-wrap ${className}`}>
      <div className="space-y-0.5">
        <p className="text-[11px] font-mono uppercase tracking-widest text-gray-500">
          Field guide — {domain}
        </p>
        <p className="text-xs text-gray-600">
          A navigation aid into the claim graph, not ingested receipts. Entries here link to verified claims; the graph may contain more.
        </p>
      </div>
      {curatedHref && curatedLabel && (
        <Link
          href={curatedHref}
          className="text-[11px] font-mono text-amber-400/70 hover:text-amber-300 whitespace-nowrap transition-colors shrink-0"
        >
          see the trajectory →
        </Link>
      )}
    </div>
  );
}
