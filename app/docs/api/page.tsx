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

      <h2>Embeds &amp; badges</h2>
      <p>
        Three read-only endpoints let you embed epistemic status into external pages.
        No API key required — all three are publicly accessible.
      </p>

      <h3>iframe embed (curated trajectories)</h3>
      <p>
        Any of the 13 curated trajectories can be embedded as a self-contained iframe. The embed
        shows the claim text, settling-curve rail, current axis, and latest year. No site chrome,
        no auth cookie, no JavaScript (server-rendered SVG).
      </p>
      <pre><code>{`<iframe
  src="https://epistemic-receipts.vercel.app/embed/trajectory/hpylori-ulcers"
  width="100%"
  height="200"
  style="border:0"
  loading="lazy"
  title="H. pylori &amp; peptic ulcers — settling curve"
></iframe>`}</code></pre>
      <p>
        Supported slugs: <code>semaglutide-glp1</code>, <code>smoking-lung-cancer</code>,{" "}
        <code>hpylori-ulcers</code>, <code>stress-acid-ulcers</code>,{" "}
        <code>dietary-fat-heart</code>, <code>oxycontin-reduced-abuse-liability-1995</code>,{" "}
        <code>continental-drift</code>, <code>cold-fusion</code>, <code>cfc-ozone-depletion</code>,{" "}
        <code>pluto-discovery-1930</code>, <code>civil-rights-act-1964</code>,{" "}
        <code>clean-air-act-1970</code>, <code>voting-rights-act-1965</code>.
        Any other slug returns 404.
      </p>
      <p>
        Framing headers: <code>X-Frame-Options: ALLOWALL</code> and{" "}
        <code>Content-Security-Policy: frame-ancestors *</code> are set on all <code>/embed/*</code>{" "}
        responses. Global <code>frame-ancestors &apos;none&apos;</code> applies everywhere else.
      </p>

      <h3>Claim badge (any non-deprecated claim)</h3>
      <p>
        A shields-style SVG badge showing the claim&apos;s current epistemic axis and year.
        Colored by the canonical axis palette in <code>lib/status.ts</code>.
      </p>
      <pre><code>{`[![Epistemic status](https://epistemic-receipts.vercel.app/api/badge/claim/CLAIMID.svg)](https://epistemic-receipts.vercel.app/claims/CLAIMID)`}</code></pre>
      <p>
        Replace <code>CLAIMID</code> with a cuid (e.g. <code>cmpixrswa83s6plo7eoxhvok4</code>).
        Unknown, soft-deleted, or DEPRECATED claims return a gray &ldquo;unknown&rdquo; badge with 404.
        Cache headers: <code>public, s-maxage=3600, stale-while-revalidate=86400</code>.
      </p>

      <h3>Trajectory badge (curated slugs)</h3>
      <p>
        Same shield format as the claim badge, but resolved by curated trajectory slug.
        Shows the trajectory&apos;s latest axis and year.
      </p>
      <pre><code>{`<img src="https://epistemic-receipts.vercel.app/api/badge/trajectory/smoking-lung-cancer" alt="Epistemic status" />`}</code></pre>
      <p>
        Only curated slugs are supported (same list as iframe embed). Non-curated slugs return
        gray &ldquo;unknown&rdquo; badge with 404.
      </p>

      <h3>oEmbed</h3>
      <p>
        An oEmbed endpoint wraps trajectory and story URLs in a rich embed JSON response.
        Trajectory and story pages include a{" "}
        <code>&lt;link rel=&quot;alternate&quot; type=&quot;application/json+oembed&quot;&gt;</code>{" "}
        tag so oEmbed-aware consumers discover it automatically.
      </p>
      <pre><code>{`GET /api/oembed?url=https://epistemic-receipts.vercel.app/settling-curve/smoking-lung-cancer`}</code></pre>
      <p>Returns:</p>
      <pre><code>{`{
  "version": "1.0",
  "type": "rich",
  "provider_name": "Epistemic Receipts",
  "provider_url": "https://epistemic-receipts.vercel.app",
  "title": "settling curve — smoking lung cancer",
  "html": "<iframe src=\\"...\\" width=\\"600\\" height=\\"200\\" ...></iframe>",
  "width": 600,
  "height": 200
}`}</code></pre>
      <p>
        The <code>url</code> parameter must be a <code>https://epistemic-receipts.vercel.app</code>{" "}
        URL matching <code>/settling-curve/&#123;curated-slug&#125;</code> or{" "}
        <code>/stories/&#123;slug&#125;</code>. All other URLs return 404.
        This is a lookup — no external fetches are made.
      </p>
    </main>
  );
}
