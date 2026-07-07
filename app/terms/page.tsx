import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — Epistemic Receipts",
  description: "Terms governing use of the Epistemic Receipts database and API.",
};

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <div className="inline-block bg-yellow-900/30 border border-yellow-700/50 text-yellow-400 text-xs px-3 py-1 rounded mb-4">
          DRAFT — not yet reviewed by counsel
        </div>
        <h1 className="text-2xl font-bold text-gray-100 mb-2">Terms of Service</h1>
        <p className="text-gray-500 text-xs">Effective date: [DATE] · Last updated: July 2026 (draft)</p>
      </div>

      <div className="text-gray-400 text-sm space-y-6">
        <section>
          <h2 className="text-base font-semibold text-gray-200 mb-2">1. About the service</h2>
          <p>
            Epistemic Receipts is a public database of sourced factual claims drawn from legislation, court decisions,
            scientific literature, government records, and other primary sources. These Terms govern your access to
            and use of the site, the API, and any data you obtain from them.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-gray-200 mb-2">2. Acceptance</h2>
          <p>
            By accessing or using Epistemic Receipts you agree to these Terms. We may update these Terms;
            continued use after an update constitutes acceptance.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-gray-200 mb-2">3. Data licence</h2>
          <p>
            Use of data from Epistemic Receipts is governed by the{" "}
            <a href="/license" className="text-blue-400 underline hover:text-blue-300">ER-Community-1.0 License</a>{" "}
            for non-commercial use, or a separate commercial licence agreement. By accessing API data, you agree to those terms.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-gray-200 mb-2">4. Data accuracy</h2>
          <p>
            Claims are sourced from third-party data providers. We do not guarantee that every claim is accurate,
            current, or complete. Epistemic status labels reflect our editorial assessment, not legal determinations.
            The site does not provide legal, medical, financial, or other professional advice.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-gray-200 mb-2">5. Prohibited uses</h2>
          <ul className="list-disc list-inside space-y-1 mt-2">
            <li>Use the site or API for any unlawful purpose or to generate spam.</li>
            <li>Systematically download the entire database in circumvention of the licence.</li>
            <li>Attempt to gain unauthorised access to the admin interface or restricted endpoints.</li>
            <li>Introduce malicious code or attempt to intercept or corrupt data.</li>
            <li>Use automated tools to submit bulk feedback or subscribe-requests.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-gray-200 mb-2">6. Disclaimer of warranties</h2>
          <p>
            The service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without warranty of any kind.
            We do not warrant that the service will be uninterrupted, error-free, or free from harmful components.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-gray-200 mb-2">7. Limitation of liability</h2>
          <p>
            To the maximum extent permitted by applicable law, Epistemic Receipts shall not be liable for any
            indirect, incidental, special, consequential, or punitive damages arising from your use of the service.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-gray-200 mb-2">8. Governing law</h2>
          <p>These Terms are governed by the laws of <strong>[JURISDICTION — to be decided]</strong>.</p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-gray-200 mb-2">9. Contact</h2>
          <p>Questions: <a href="mailto:legal@epistemic-receipts.vercel.app" className="text-blue-400 underline hover:text-blue-300">legal@epistemic-receipts.vercel.app</a> (placeholder)</p>
        </section>
      </div>

      <div className="border-t border-gray-800 pt-6 mt-8 text-xs text-gray-600 space-y-1">
        <p>
          <a href="/license" className="underline hover:text-gray-400">License</a>
          {" · "}
          <a href="/privacy" className="underline hover:text-gray-400">Privacy Policy</a>
        </p>
        <p className="text-yellow-800">DRAFT — not yet reviewed by counsel.</p>
      </div>
    </div>
  );
}
