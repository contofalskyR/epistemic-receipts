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
        through coram nobis and the Civil Liberties Act, smoking and the tobacco industry's
        &ldquo;doubt is our product&rdquo; memo, the lab leak debate, Japan&apos;s surrender,
        Pluto&apos;s reclassification, Ozempic&apos;s approval. The case studies are what the
        tool is for.
      </p>

      <p>
        The architecture defends editorial scope by what it doesn&apos;t ingest: no sports, no
        celebrity news, no pure financial claims, no engagement-driven content. The inclusion test
        is whether receipt-and-provenance treatment of a claim helps someone make a better decision
        about their life, politics, health, or understanding of how power works.
      </p>

      <p className="text-gray-400">
        Auditability is the principle. The receipts are the product.
      </p>
    </div>
  );
}
