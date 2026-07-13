import type { Metadata } from "next";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "API Docs — Epistemic Receipts",
  description:
    "Public API v1 for the Epistemic Receipts corpus — read-only, cursor-paginated endpoints for claims, trajectories, sources, search, and retractions.",
  alternates: { canonical: "/docs/api" },
};

export default function ApiDocsPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-12 prose prose-neutral dark:prose-invert">
      <h1>Epistemic Receipts — Public API v1</h1>

      <p>
        A read-only, authenticated API for accessing the Epistemic Receipts corpus.
        All endpoints return JSON. Errors use{" "}
        <a href="https://www.rfc-editor.org/rfc/rfc7807" target="_blank" rel="noreferrer">
          RFC 7807
        </a>{" "}
        problem details.
      </p>

      <h2>Authentication</h2>
      <p>
        Every request requires a bearer token in the <code>Authorization</code> header:
      </p>
      <pre>
        <code>Authorization: Bearer er_live_...</code>
      </pre>
      <p>
        Free-tier keys are available by contacting{" "}
        <a href="mailto:api@epistemic-receipts.app">api@epistemic-receipts.app</a>.
      </p>

      <h2>Rate Limits</h2>
      <table>
        <thead>
          <tr>
            <th>Tier</th>
            <th>Requests / min</th>
            <th>Requests / day</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>Free</td><td>60</td><td>10,000</td></tr>
          <tr><td>Pro</td><td>600</td><td>100,000</td></tr>
          <tr><td>Team</td><td>3,000</td><td>1,000,000</td></tr>
          <tr><td>Enterprise</td><td>Custom</td><td>Custom</td></tr>
        </tbody>
      </table>

      <h2>Provenance Grades</h2>
      <p>
        Every claim in the API carries a <code>provenanceGrade</code> field that grades{" "}
        <em>documentation depth</em> — not whether the claim is true.
      </p>
      <table>
        <thead>
          <tr><th>Grade</th><th>Meaning</th></tr>
        </thead>
        <tbody>
          <tr><td>A</td><td>Human-reviewed with ≥2 primary-source edges</td></tr>
          <tr><td>B</td><td>Verified pipeline with ≥1 primary-source edge</td></tr>
          <tr><td>C</td><td>Auto-approved or bulk-ingested; no primary-source edges</td></tr>
          <tr><td>D</td><td>Provisional — documentation incomplete</td></tr>
          <tr><td>X</td><td>Deprecated or abandoned — included for traceability only</td></tr>
        </tbody>
      </table>

      <h2>Endpoints</h2>

      <h3>GET /api/v1/claims</h3>
      <p>Cursor-paginated list of claims.</p>
      <p><strong>Query params:</strong> <code>pipeline</code>, <code>epistemicAxis</code>, <code>claimType</code>, <code>verificationStatus</code>, <code>emergedAfter</code>, <code>emergedBefore</code>, <code>topic</code>, <code>cursor</code>, <code>limit</code> (≤200)</p>

      <h3>GET /api/v1/claims/&#123;id&#125;</h3>
      <p>Full claim detail with provenance, edges, statusHistory, relations, and topics.</p>

      <h3>GET /api/v1/sources</h3>
      <p>Cursor-paginated list of sources.</p>

      <h3>GET /api/v1/sources/&#123;id&#125;</h3>
      <p>Source detail with credibility events and relationships.</p>

      <h3>GET /api/v1/trajectories/&#123;claimId&#125;</h3>
      <p>Ordered status-history transitions for a claim, with marker sources.</p>

      <h3>GET /api/v1/search?q=</h3>
      <p>Hybrid tsvector + vector search over claims. Returns ranked results with provenance grades.</p>

      <h3>GET /api/v1/verify?statement=</h3>
      <p>Submit a statement (≤500 chars) to find the top-10 most similar documented claims. Returns provenance grade, receipts (FOR/AGAINST/CONTRADICTS edge counts), and statusHistory summary.</p>

      <h3>GET /api/v1/retractions/since/&#123;date&#125;</h3>
      <p>Retraction claims with <code>createdAt &gt; date</code>. Includes DOI, original paper metadata, and CONTRADICTS edge targets.</p>

      <h3>GET /api/v1/manifest</h3>
      <p>Pipeline manifest — corpus statistics by pipeline. No auth required.</p>

      <h3>GET /api/v1/changelog</h3>
      <p>Static JSON list of API changes by version.</p>

      <h2>Pagination</h2>
      <p>
        All list endpoints return an opaque <code>nextCursor</code> string. Pass it as{" "}
        <code>?cursor=...</code> to fetch the next page. A <code>null</code> nextCursor means
        the last page.
      </p>

      <h2>Caching</h2>
      <p>
        Detail endpoints carry <code>Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400</code>{" "}
        and an ETag. Send <code>If-None-Match</code> to get 304 responses on unchanged resources.
      </p>

      <h2>Quickstart</h2>
      <pre>
        <code>{`# Search for a claim
curl -H "Authorization: Bearer er_live_YOUR_KEY" \\
  "https://epistemic-receipts.app/api/v1/search?q=mRNA+vaccine+efficacy"

# Verify a statement
curl -H "Authorization: Bearer er_live_YOUR_KEY" \\
  "https://epistemic-receipts.app/api/v1/verify?statement=mRNA+vaccines+were+approved+by+the+FDA"

# Get retractions since 2024
curl -H "Authorization: Bearer er_live_YOUR_KEY" \\
  "https://epistemic-receipts.app/api/v1/retractions/since/2024-01-01"`}
        </code>
      </pre>
    </main>
  );
}
