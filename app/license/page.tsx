import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "License — Epistemic Receipts",
  description: "Community license terms, attribution guide, and commercial licensing information for the Epistemic Receipts database.",
};

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mb-10 scroll-mt-20">
      <h2 className="text-lg font-semibold text-gray-100 mb-3 border-b border-gray-800 pb-2">{title}</h2>
      {children}
    </section>
  );
}

function Code({ children }: { children: string }) {
  return (
    <pre className="bg-gray-900 border border-gray-700 rounded p-4 text-xs text-gray-300 overflow-x-auto whitespace-pre-wrap">
      {children}
    </pre>
  );
}

export default function LicensePage() {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <div className="inline-block bg-yellow-900/30 border border-yellow-700/50 text-yellow-400 text-xs px-3 py-1 rounded mb-4">
          DRAFT — not yet reviewed by counsel
        </div>
        <h1 className="text-2xl font-bold text-gray-100 mb-2">License</h1>
        <p className="text-gray-400 text-sm">
          Epistemic Receipts is free to use for research and non-commercial purposes under the{" "}
          <strong className="text-gray-300">ER-Community-1.0</strong> license.
          Commercial use requires a separate agreement.
        </p>
      </div>

      <Section id="community" title="Community License (ER-Community-1.0)">
        <p className="text-gray-400 text-sm mb-4">
          You may freely access, query, and use Epistemic Receipts data for{" "}
          <strong className="text-gray-300">research, personal, educational, or other non-commercial purposes</strong>,
          subject to the following conditions.
        </p>

        <h3 className="text-sm font-semibold text-gray-200 mb-2">What you can do</h3>
        <ul className="text-sm text-gray-400 space-y-1 mb-4 list-disc list-inside">
          <li>Query the API and use results in research papers, reports, and non-commercial applications.</li>
          <li>Reproduce small extracts with attribution.</li>
          <li>Cite individual claims by their canonical URL (URLs are stable identifiers — we commit to maintaining them).</li>
        </ul>

        <h3 className="text-sm font-semibold text-gray-200 mb-2">Conditions</h3>
        <ul className="text-sm text-gray-400 space-y-1 mb-4 list-disc list-inside">
          <li><strong className="text-gray-300">Attribution required</strong> — see the <a href="#attribution" className="underline hover:text-gray-200">attribution section</a> below.</li>
          <li><strong className="text-gray-300">No bulk redistribution</strong> — you may not redistribute the database as a whole or any substantial extract.</li>
          <li><strong className="text-gray-300">No training data use</strong> — you may not use this data to train, fine-tune, or pre-train any machine-learning model without a separate written agreement.</li>
          <li><strong className="text-gray-300">Non-commercial only</strong> — commercial use requires the commercial license (see below).</li>
          <li><strong className="text-gray-300">Upstream terms apply</strong> — some data originates from third-party sources with their own terms.</li>
        </ul>

        <p className="text-xs text-gray-500">
          Full license text: <code className="bg-gray-800 px-1 rounded">legal/LICENSE-community.md</code> in the repository.
        </p>
      </Section>

      <Section id="attribution" title="Attribution">
        <p className="text-gray-400 text-sm mb-4">
          When you use data from Epistemic Receipts, include one of the following attributions.
        </p>

        <h3 className="text-sm font-semibold text-gray-200 mb-2">Plain text / Markdown</h3>
        <Code>{`Data: [Epistemic Receipts](https://epistemic-receipts.vercel.app)`}</Code>

        <h3 className="text-sm font-semibold text-gray-200 mt-4 mb-2">HTML</h3>
        <Code>{`<a href="https://epistemic-receipts.vercel.app" rel="noreferrer">Data: Epistemic Receipts</a>`}</Code>

        <h3 className="text-sm font-semibold text-gray-200 mt-4 mb-2">BibTeX (citing the site)</h3>
        <Code>{`@misc{epistemic_receipts,
  title        = {Epistemic Receipts},
  howpublished = {\\url{https://epistemic-receipts.vercel.app}},
  note         = {Accessed: \\today},
  year         = {2025}
}`}</Code>

        <h3 className="text-sm font-semibold text-gray-200 mt-4 mb-2">BibTeX (citing a specific claim)</h3>
        <Code>{`@misc{er_claim,
  title        = {[Claim title]},
  howpublished = {Epistemic Receipts, \\url{https://epistemic-receipts.vercel.app/claims/[id]}},
  note         = {Accessed: \\today},
  year         = {[year]}
}`}</Code>

        <h3 className="text-sm font-semibold text-gray-200 mt-4 mb-2">JSON metadata</h3>
        <Code>{`{
  "source": "Epistemic Receipts",
  "source_url": "https://epistemic-receipts.vercel.app",
  "license": "ER-Community-1.0"
}`}</Code>

        <p className="text-xs text-gray-500 mt-4">
          Claim URLs are stable identifiers. We commit to maintaining them as canonical, permanent links.
        </p>
      </Section>

      <Section id="commercial" title="Commercial Licensing">
        <p className="text-gray-400 text-sm mb-4">
          Commercial use — including use in products or services that generate revenue, use by for-profit entities
          for internal business purposes, training data use, and bulk redistribution — requires a separate commercial licence.
        </p>
        <p className="text-gray-400 text-sm mb-4">
          Commercial licences are available for the following use cases:
        </p>
        <ul className="text-sm text-gray-400 space-y-1 mb-4 list-disc list-inside">
          <li>Grounding / RAG — use as a retrieval corpus for AI systems</li>
          <li>Training data — inclusion in ML training datasets</li>
          <li>Redistribution — re-publishing extracts in downstream products</li>
          <li>Enterprise API access — dedicated access with SLA and higher rate limits</li>
        </ul>
        <p className="text-gray-400 text-sm mb-4">
          Pricing is based on use case, volume, and freshness requirements. Flat, per-seat, and per-request models are available.
        </p>
        <a
          href="mailto:commercial@epistemic-receipts.vercel.app"
          className="inline-block bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm px-4 py-2 rounded transition-colors"
        >
          Contact for commercial licensing →
        </a>
        <p className="text-xs text-gray-500 mt-3">
          Skeleton term sheet: <code className="bg-gray-800 px-1 rounded">legal/LICENSE-commercial.md</code> in the repository.
        </p>
      </Section>

      <Section id="upstream" title="Upstream Data Sources">
        <p className="text-gray-400 text-sm mb-4">
          Epistemic Receipts compiles data from many upstream sources, each with its own terms.
          Some upstream sources prohibit redistribution or commercial use.
        </p>
        <p className="text-xs text-gray-500">
          Upstream licence audit: <code className="bg-gray-800 px-1 rounded">legal/upstream-licenses.md</code> in the repository.
        </p>
      </Section>

      <div className="border-t border-gray-800 pt-6 mt-6 text-xs text-gray-600 space-y-1">
        <p>
          <a href="/terms" className="underline hover:text-gray-400">Terms of Service</a>
          {" · "}
          <a href="/privacy" className="underline hover:text-gray-400">Privacy Policy</a>
          {" · "}
          <a href="/corrections" className="underline hover:text-gray-400">Corrections</a>
        </p>
        <p className="text-yellow-800">
          All legal documents on this site are DRAFTs pending attorney review. Do not rely on them until counsel has approved.
        </p>
      </div>
    </div>
  );
}
