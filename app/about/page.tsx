export const metadata = {
  title: 'About — Epistemic Receipts',
  description:
    'Epistemic Receipts is a claim-provenance tool: it tracks how consensus on a claim gets made and unmade — the sources for and against, when they emerged, and what shifted over time.',
};

export default function AboutPage() {
  return (
    <div className="max-w-xl space-y-6 text-sm text-gray-300 leading-relaxed">
      <h1 className="text-lg font-semibold text-white">About</h1>

      <p>
        Epistemic Receipts is a claim-provenance tool. It tracks how consensus on a claim gets
        made and unmade — the sources that argued for or against it, when those arguments emerged,
        and what shifted over time.
      </p>

      <p>
        It is not a fact-checker. The tool does not render verdicts; it preserves the record.
        Disputed claims stay disputed. Claims that never resolve are tracked as such.
      </p>

      <p>
        The site contains two kinds of claims. Reference claims are bulk-imported from
        authoritative sources (FDA drug approvals, Supreme Court rulings) — these are scaffolding.
        Curated case studies are manually built with full receipts: Korematsu and its 70-year arc
        through coram nobis and the Civil Liberties Act, smoking and the tobacco industry&apos;s
        &ldquo;doubt is our product&rdquo; memo, the lab leak debate, Japan&apos;s surrender,
        Pluto&apos;s reclassification, Ozempic&apos;s approval. The case studies are what the
        tool is for.
      </p>

      <p>
        The architecture defends editorial scope by what it doesn&apos;t ingest: no celebrity
        news, no engagement-driven content, no market commentary or investment signal. Financial
        records appear only as accountability instruments — STOCK Act disclosures, SEC enforcement
        filings, campaign finance, macroeconomic series — because they document how power works,
        not how to trade. The domain taxonomies (statistics, finance, sport science, and others)
        are navigation aids for searching the graph; they are curated reference maps, not ingested
        claims. The inclusion test is unchanged: does receipt-and-provenance treatment of a claim
        help someone make a better decision about their life, politics, health, or understanding
        of how power works?
      </p>

      <p className="text-gray-400">
        Auditability is the principle. The receipts are the product.
      </p>

      <p className="text-gray-500 text-xs">
        Ingestion pipelines, data enrichment, and continuous development are powered by{' '}
        <a href="https://openclaw.ai" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-300 transition-colors">OpenClaw</a>
        {' '}— an AI agent runtime for autonomous research workflows.
      </p>
    </div>
  );
}
