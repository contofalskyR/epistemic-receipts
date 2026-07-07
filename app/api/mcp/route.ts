/**
 * Hosted MCP endpoint — Streamable HTTP transport.
 *
 * Auth: `Authorization: Bearer er_live_<key>` (same key format as /v1 API).
 * MCP traffic is metered against the key's quota via verifyApiKey.
 * Each request creates a fresh stateless transport (Vercel-safe).
 */
import { NextRequest } from "next/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp";
import { z } from "zod";
import { verifyApiKey, isAuthError } from "@/lib/v1/auth";
import { v1Error } from "@/lib/v1/respond";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

// Build the API config for tools: uses SITE_URL so calls stay in-process in dev
// and go to the deployed service in production.
function buildToolConfig(apiKey: string): { baseUrl: string; apiKey: string } {
  return {
    baseUrl: SITE_URL,
    apiKey,
  };
}

async function callV1(
  cfg: { baseUrl: string; apiKey: string },
  path: string,
): Promise<unknown> {
  const res = await fetch(`${cfg.baseUrl}/api/v1${path}`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${cfg.apiKey}`,
    },
  });
  if (!res.ok) {
    const retryAfter = res.headers.get("Retry-After");
    let title = res.statusText;
    let detail = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as Record<string, unknown>;
      if (typeof body.title === "string") title = body.title;
      if (typeof body.detail === "string") detail = body.detail;
    } catch { /* ignore */ }
    const err = { status: res.status, title, detail, retryAfter: retryAfter ? Number(retryAfter) : undefined };
    throw err;
  }
  return res.json();
}

function handleApiError(err: unknown): { content: Array<{ type: "text"; text: string }> } {
  if (err && typeof err === "object" && "status" in err) {
    const e = err as { status: number; title: string; detail: string; retryAfter?: number };
    if (e.status === 429) {
      return { content: [{ type: "text", text: `Rate limit exceeded. Retry after ${e.retryAfter ?? 60}s. ${e.detail}` }] };
    }
    return { content: [{ type: "text", text: `API error ${e.status}: ${e.detail}` }] };
  }
  const msg = err instanceof Error ? err.message : String(err);
  return { content: [{ type: "text", text: `Unexpected error: ${msg}` }] };
}

const ATTRIBUTION =
  "Source: Epistemic Receipts (epistemic-receipts.vercel.app) — provenance grades measure documentation depth, not truth.";

function claimUrl(id: string): string {
  return `${SITE_URL}/claims/${id}`;
}

const AXIS_LABELS: Record<string, string> = {
  SETTLED: "Settled (broad consensus)",
  CONTESTED: "Contested (active debate)",
  RECORDED: "Recorded (documented occurrence)",
  OPEN: "Open (insufficient evidence)",
  UNRESOLVABLE: "Unresolvable (inherently contested)",
  ABANDONED: "Abandoned / deprecated",
};
function fmtAxis(a: string | null): string { return (a && AXIS_LABELS[a]) ?? a ?? "unknown"; }

const GRADE_LABELS: Record<string, string> = {
  A: "A — Human-reviewed, ≥2 primary sources",
  B: "B — Verified pipeline, ≥1 primary source",
  C: "C — Auto-approved / bulk-ingested",
  D: "D — Provisional",
  X: "X — Deprecated / abandoned",
};
function fmtGrade(g: string | null): string { return (g && GRADE_LABELS[g]) ?? g ?? "?"; }

function createMcpServer(cfg: { baseUrl: string; apiKey: string }): McpServer {
  const server = new McpServer({ name: "epistemic-receipts", version: "1.0.0" });

  // search_claims
  server.tool(
    "search_claims",
    "Full-text and semantic search over the Epistemic Receipts claim graph. Returns matching claims with epistemic axis, provenance grade (documentation depth — not truth), and links. Entry point to find claim IDs for follow-up tools.",
    {
      query: z.string().min(3).max(500).describe('Search terms. Example: "mRNA vaccine effectiveness 2021"'),
      axis: z.enum(["SETTLED", "CONTESTED", "RECORDED", "OPEN", "UNRESOLVABLE"]).optional(),
      limit: z.number().int().min(1).max(50).optional().default(10),
    },
    async ({ query, axis, limit }) => {
      try {
        const params = new URLSearchParams({ q: query });
        if (axis) params.set("axis", axis);
        params.set("limit", String(limit ?? 10));
        const res = await callV1(cfg, `/search?${params}`) as {
          total: number; data: Array<{id: string; text: string; epistemicAxis: string|null; ingestedBy: string|null; provenanceGrade: string}>;
        };
        if (!res.data.length) {
          return { content: [{ type: "text" as const, text: `No claims found for "${query}".\n\n${ATTRIBUTION}` }] };
        }
        const lines = res.data.map((c, i) =>
          [`${i+1}. [${c.id}] ${c.text}`, `   Axis: ${fmtAxis(c.epistemicAxis)}`, `   Grade: ${fmtGrade(c.provenanceGrade)}  |  Pipeline: ${c.ingestedBy ?? "?"}`, `   URL: ${claimUrl(c.id)}`].join("\n")
        );
        return { content: [{ type: "text" as const, text: [`Search: "${query}" — ${res.total} total`, "", lines.join("\n\n"), "", `citation: ${res.data.map(c => claimUrl(c.id)).join(", ")}`, ATTRIBUTION].join("\n") }] };
      } catch(err) { return handleApiError(err); }
    },
  );

  // get_claim_with_receipts
  server.tool(
    "get_claim_with_receipts",
    "Retrieves a single claim with provenance record: epistemic axis, grade (A–X), edges grouped by type (FOR/AGAINST/CONTRADICTS) with source names and dates, and status timeline. Use search_claims first to get the ID.",
    { claim_id: z.string().describe("Claim ID from search_claims") },
    async ({ claim_id }) => {
      try {
        const claim = await callV1(cfg, `/claims/${encodeURIComponent(claim_id)}`) as {
          id: string; text: string; epistemicAxis: string|null; provenanceGrade: string;
          provenanceDetail: {description: string; primarySourceEdgeCount: number};
          ingestedBy: string|null; humanReviewed: boolean; claimEmergedAt: string|null;
          edges: Array<{type: string; source: {name: string; url: string|null; publishedAt: string|null}}>;
          statusHistory: Array<{fromAxis: string|null; toAxis: string|null; community: string|null; reason: string|null; occurredAt: string}>;
          topics: Array<{name: string}>;
        };
        const groups: Record<string, typeof claim.edges> = {};
        for (const e of claim.edges) { const k = e.type ?? "OTHER"; (groups[k] ??= []).push(e); }
        const MAX = 15;
        const edgeLines: string[] = [];
        let hidden = 0;
        for (const [type, edges] of Object.entries(groups)) {
          edgeLines.push(`  ${type} (${edges.length}):`);
          edges.slice(0, MAX).forEach(e => {
            const pub = e.source.publishedAt ? ` [${e.source.publishedAt.slice(0,10)}]` : "";
            edgeLines.push(`    • ${e.source.name}${pub}${e.source.url ? ` — ${e.source.url}` : ""}`);
          });
          if (edges.length > MAX) { hidden += edges.length - MAX; edgeLines.push(`    (${edges.length - MAX} more — use the API for full results)`); }
        }
        const timeline = claim.statusHistory.map(h =>
          `  ${h.occurredAt.slice(0,10)}${h.community ? ` [${h.community}]` : ""} ${h.fromAxis ?? "—"} → ${h.toAxis ?? "—"}${h.reason ? `: ${h.reason}` : ""}`
        );
        const url = claimUrl(claim.id);
        const parts = [
          `Claim: ${claim.text}`, `ID: ${claim.id}`,
          `Axis: ${fmtAxis(claim.epistemicAxis)}`,
          `Grade: ${fmtGrade(claim.provenanceGrade)}`, `  ${claim.provenanceDetail.description}`,
          `Pipeline: ${claim.ingestedBy ?? "?"}  |  Human-reviewed: ${claim.humanReviewed}`,
          claim.claimEmergedAt ? `Emerged: ${claim.claimEmergedAt.slice(0,10)}` : null,
          `Topics: ${claim.topics.map(t => t.name).join(", ") || "none"}`,
          "",
          `Receipts (${claim.edges.length} edges${hidden > 0 ? `, ${hidden} hidden` : ""}):`,
          ...edgeLines,
          "",
          `Status Timeline (${claim.statusHistory.length} transitions):`,
          ...timeline,
          "", `citation: ${url}`, ATTRIBUTION,
        ].filter(l => l !== null).join("\n");
        return { content: [{ type: "text" as const, text: parts }] };
      } catch(err) { return handleApiError(err); }
    },
  );

  // get_trajectory
  server.tool(
    "get_trajectory",
    "Returns the documented trajectory of a claim — ordered axis transitions (e.g. OPEN → CONTESTED → SETTLED) with dates, communities, and marker sources. Shows how consensus evolved over time.",
    { claim_id: z.string().describe("Claim ID to retrieve trajectory for") },
    async ({ claim_id }) => {
      try {
        const traj = await callV1(cfg, `/trajectories/${encodeURIComponent(claim_id)}`) as {
          claimId: string; claimText: string;
          statusHistory: Array<{fromAxis: string|null; toAxis: string|null; community: string|null; reason: string|null; occurredAt: string; markerSource: {name: string; url: string|null} | null}>;
        };
        const url = claimUrl(claim_id);
        if (!traj.statusHistory.length) {
          return { content: [{ type: "text" as const, text: [`Claim: ${traj.claimText}`, "No documented trajectory transitions yet.", "", `citation: ${url}`, ATTRIBUTION].join("\n") }] };
        }
        const lines = traj.statusHistory.map((h, i) => {
          const src = h.markerSource ? `\n   Marker: ${h.markerSource.name}${h.markerSource.url ? ` — ${h.markerSource.url}` : ""}` : "";
          return `${i+1}. ${h.occurredAt.slice(0,10)}${h.community ? ` [${h.community}]` : ""}\n   ${h.fromAxis ?? "—"} → ${h.toAxis ?? "—"}${h.reason ? `\n   Reason: ${h.reason}` : ""}${src}`;
        });
        const first = traj.statusHistory[0];
        const last = traj.statusHistory[traj.statusHistory.length - 1];
        return { content: [{ type: "text" as const, text: [`Claim: ${traj.claimText}`, `Trajectory: ${traj.statusHistory.length} transitions (${first.fromAxis ?? "?"} → ... → ${last.toAxis ?? "?"})`, "", lines.join("\n\n"), "", `citation: ${url}`, ATTRIBUTION].join("\n") }] };
      } catch(err) { return handleApiError(err); }
    },
  );

  // verify_statement
  server.tool(
    "verify_statement",
    "Finds the most semantically similar documented claims. IMPORTANT: returns documentation status, NOT truth verdicts. epistemicAxis reflects documented status — not a judgment about the statement.",
    {
      statement: z.string().min(10).max(500).describe('Statement to match. Example: "mRNA vaccines cause myocarditis"'),
      limit: z.number().int().min(1).max(10).optional().default(5),
    },
    async ({ statement, limit }) => {
      try {
        const params = new URLSearchParams({ text: statement, limit: String(limit ?? 5) });
        const res = await callV1(cfg, `/verify?${params}`) as {
          text: string; disclaimer: string;
          results: Array<{id: string; text: string; epistemicAxis: string|null; similarity: number}>;
        };
        if (!res.results.length) {
          return { content: [{ type: "text" as const, text: [`No documented claims found similar to: "${statement}"`, "", `Disclaimer: ${res.disclaimer}`, "", ATTRIBUTION].join("\n") }] };
        }
        const lines = res.results.map((r, i) =>
          [`${i+1}. [${r.id}] ${r.text}`, `   Axis: ${fmtAxis(r.epistemicAxis)}  |  Similarity: ${(r.similarity*100).toFixed(1)}%`, `   URL: ${claimUrl(r.id)}`].join("\n")
        );
        return { content: [{ type: "text" as const, text: [`Statement: "${statement}"`, `Disclaimer: ${res.disclaimer}`, "", ...lines, "", `citation: ${res.results.map(r => claimUrl(r.id)).join(", ")}`, ATTRIBUTION].join("\n") }] };
      } catch(err) { return handleApiError(err); }
    },
  );

  // state_of_knowledge
  // NOTE: Synthetic endpoint (search + trajectory filter). Swap to /v1/state-of-knowledge when Spec 40 lands.
  server.tool(
    "state_of_knowledge",
    "Summarises the documented state of knowledge on a topic as of an optional cutoff date. Useful for historical research: 'what was known about X in 2019?'",
    {
      topic: z.string().min(3).max(200).describe('Topic. Example: "semaglutide weight loss"'),
      as_of_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Snapshot date YYYY-MM-DD"),
    },
    async ({ topic, as_of_date }) => {
      try {
        const cutoff = as_of_date ? new Date(as_of_date) : null;
        const searchRes = await callV1(cfg, `/search?${new URLSearchParams({q: topic, limit: "10"})}`) as {
          total: number; data: Array<{id: string; text: string; epistemicAxis: string|null; provenanceGrade: string}>;
        };
        if (!searchRes.data.length) {
          return { content: [{ type: "text" as const, text: `No documented claims found for topic: "${topic}".\n\n${ATTRIBUTION}` }] };
        }
        const summaries: string[] = [];
        const citations: string[] = [];
        for (const claim of searchRes.data.slice(0, 8)) {
          const url = claimUrl(claim.id);
          citations.push(url);
          let trajNote = `Axis: ${fmtAxis(claim.epistemicAxis)}`;
          try {
            const traj = await callV1(cfg, `/trajectories/${encodeURIComponent(claim.id)}`) as {
              statusHistory: Array<{toAxis: string|null; occurredAt: string}>;
            };
            const relevant = cutoff ? traj.statusHistory.filter(h => new Date(h.occurredAt) <= cutoff) : traj.statusHistory;
            if (relevant.length > 0) {
              const last = relevant[relevant.length - 1];
              const axisAtDate = last.toAxis ?? claim.epistemicAxis;
              trajNote = cutoff
                ? `Axis at ${as_of_date}: ${fmtAxis(axisAtDate)} (${relevant.length} transitions to date)`
                : `Axis: ${fmtAxis(claim.epistemicAxis)} (${traj.statusHistory.length} total transitions)`;
            }
          } catch { /* ignore trajectory errors */ }
          summaries.push([`• [${claim.id}] ${claim.text}`, `  ${trajNote}`, `  Grade: ${fmtGrade(claim.provenanceGrade)}`, `  URL: ${url}`].join("\n"));
        }
        const header = cutoff
          ? `State of knowledge on "${topic}" as of ${as_of_date}`
          : `Current state of knowledge on "${topic}"`;
        return { content: [{ type: "text" as const, text: [header, `(${searchRes.total} corpus matches; showing ${summaries.length})`, "", summaries.join("\n\n"), "", `citation: ${citations.join(", ")}`, ATTRIBUTION].join("\n") }] };
      } catch(err) { return handleApiError(err); }
    },
  );

  // list_datasets
  server.tool(
    "list_datasets",
    "Lists all data pipelines in the corpus: name, upstream source, method, cadence, claim counts, and last-run time. Use to understand what sources are available and filter search_claims by pipeline.",
    {},
    async () => {
      try {
        const datasets = await callV1(cfg, "/manifest") as Array<{
          tag: string; name: string; retired: boolean; upstreamName: string|null; upstreamUrl: string|null;
          method: string|null; cadence: string|null; caveats: string|null;
          counts: {total: number; humanReviewed: number};
          lastRunAt: string|null;
        }>;
        const active = datasets.filter(d => !d.retired);
        const retired = datasets.filter(d => d.retired);
        const fmt = (d: typeof datasets[0]): string => [
          `• ${d.name} [${d.tag}]`,
          `  Source: ${d.upstreamName ?? "—"}${d.upstreamUrl ? ` (${d.upstreamUrl})` : ""}`,
          `  Method: ${d.method ?? "—"}  |  Cadence: ${d.cadence ?? "—"}`,
          `  Claims: ${d.counts.total} total, ${d.counts.humanReviewed} human-reviewed`,
          `  Last run: ${d.lastRunAt?.slice(0,10) ?? "never"}`,
          ...(d.caveats ? [`  Caveats: ${d.caveats}`] : []),
        ].join("\n");
        const parts = [`Epistemic Receipts Datasets — ${datasets.length} pipelines`, ""];
        if (active.length) { parts.push("Active:", active.map(fmt).join("\n\n")); }
        if (retired.length) { parts.push("", "Retired:", retired.map(fmt).join("\n\n")); }
        parts.push("", `citation: ${SITE_URL}/datasets`, ATTRIBUTION);
        return { content: [{ type: "text" as const, text: parts.join("\n") }] };
      } catch(err) { return handleApiError(err); }
    },
  );

  return server;
}

export async function POST(req: NextRequest): Promise<Response> {
  // Verify API key and meter usage before handing off to MCP transport.
  const auth = await verifyApiKey(req, "mcp");
  if (isAuthError(auth)) return v1Error(auth.body, auth.headers);

  // Extract the raw key to forward to /v1 tool calls.
  const rawKey = (req.headers.get("authorization") ?? "").slice(7).trim();
  const cfg = buildToolConfig(rawKey);

  const server = createMcpServer(cfg);
  const transport = new WebStandardStreamableHTTPServerTransport({
    // Stateless mode: no session ID, safe for Vercel serverless
  });

  await server.connect(transport);
  return transport.handleRequest(req);
}

export async function GET(_req: NextRequest): Promise<Response> {
  // SSE stream resumption is not supported in stateless mode.
  return new Response(
    JSON.stringify({ error: "GET not supported on stateless MCP endpoint. Use POST." }),
    { status: 405, headers: { "Content-Type": "application/json" } },
  );
}

export async function DELETE(): Promise<Response> {
  return new Response(null, { status: 405 });
}
