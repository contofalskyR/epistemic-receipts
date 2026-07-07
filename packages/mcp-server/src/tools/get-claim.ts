import { z } from "zod/v4";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ApiConfig, McpApiError, getClaimWithReceipts, Edge } from "../client.js";
import { claimUrl, formatAxis, formatGrade, capped, ATTRIBUTION } from "./format.js";

const MAX_EDGES = 15;

const InputSchema = {
  claim_id: z.string().describe(
    'Claim ID from search_claims or a receipt URL. Example: "cljk2x8r10000abcd1234"',
  ),
};

export function registerGetClaimWithReceipts(server: McpServer, config: ApiConfig): void {
  server.registerTool(
    "get_claim_with_receipts",
    {
      title: "Get a claim with its full provenance receipts",
      description:
        "Retrieves a single claim with its complete provenance record: claim text, " +
        "epistemic axis (SETTLED / CONTESTED / RECORDED / OPEN / UNRESOLVABLE), " +
        "provenance grade (A–X measuring documentation depth — not truth), " +
        "supporting and contradicting edges grouped by type (FOR / AGAINST / CONTRADICTS / QUALIFIES), " +
        "each with source name, date, and URL, plus a status-change timeline. " +
        "Use search_claims to find the claim ID first. " +
        "Edge list is capped at 15 per claim to respect token budgets; " +
        "use the API directly for complete edge sets.",
      inputSchema: InputSchema,
    },
    async ({ claim_id }) => {
      try {
        const claim = await getClaimWithReceipts(config, claim_id);

        // Group edges
        const groups: Record<string, Edge[]> = {};
        for (const edge of claim.edges) {
          const key = edge.type ?? "OTHER";
          groups[key] = groups[key] ?? [];
          groups[key].push(edge);
        }

        const edgeLines: string[] = [];
        let totalEdges = 0;
        let hiddenEdges = 0;
        for (const [type, edges] of Object.entries(groups)) {
          totalEdges += edges.length;
          const { items, note } = capped(edges, MAX_EDGES);
          if (note) hiddenEdges += edges.length - items.length;
          edgeLines.push(`  ${type} (${edges.length}):`);
          for (const e of items) {
            const pub = e.source.publishedAt ? ` [${e.source.publishedAt.slice(0, 10)}]` : "";
            const url = e.source.url ? ` — ${e.source.url}` : "";
            edgeLines.push(`    • ${e.source.name}${pub}${url}`);
          }
          if (note) edgeLines.push(`    ${note}`);
        }

        const timelineLines = claim.statusHistory.map(h => {
          const from = h.fromAxis ?? "—";
          const to = h.toAxis ?? "—";
          const date = h.occurredAt.slice(0, 10);
          const community = h.community ? ` [${h.community}]` : "";
          const reason = h.reason ? `: ${h.reason}` : "";
          return `  ${date}${community} ${from} → ${to}${reason}`;
        });

        const url = claimUrl(claim.id);

        const parts = [
          `Claim: ${claim.text}`,
          `ID: ${claim.id}`,
          `Axis: ${formatAxis(claim.epistemicAxis)}`,
          `Provenance Grade: ${formatGrade(claim.provenanceGrade)}`,
          `  ${claim.provenanceDetail.description}`,
          `  Primary sources: ${claim.provenanceDetail.primarySourceEdgeCount}`,
          `Pipeline: ${claim.ingestedBy ?? "unknown"}  |  Human-reviewed: ${claim.humanReviewed}`,
          claim.claimEmergedAt
            ? `Emerged: ${claim.claimEmergedAt.slice(0, 10)}`
            : null,
          `Topics: ${claim.topics.map(t => t.name).join(", ") || "none"}`,
          "",
          `Receipts (${totalEdges} edges${hiddenEdges > 0 ? `, ${hiddenEdges} hidden` : ""}):`,
          ...edgeLines,
          "",
          `Status Timeline (${claim.statusHistory.length} transitions):`,
          ...timelineLines,
          "",
          `citation: ${url}`,
          ATTRIBUTION,
        ]
          .filter(l => l !== null)
          .join("\n");

        return { content: [{ type: "text", text: parts }] };
      } catch (err) {
        return formatError(err);
      }
    },
  );
}

function formatError(err: unknown): { content: Array<{ type: "text"; text: string }> } {
  if (err instanceof McpApiError) {
    if (err.status === 404) {
      return {
        content: [{ type: "text", text: `Claim not found. ${err.detail}` }],
      };
    }
    if (err.status === 429) {
      return {
        content: [
          {
            type: "text",
            text: `Rate limit exceeded. Retry after ${err.retryAfter ?? 60}s. ${err.detail}`,
          },
        ],
      };
    }
    if (err.status === 401) {
      return {
        content: [
          {
            type: "text",
            text: `Authentication required. Set EPISTEMIC_RECEIPTS_API_KEY. ${err.detail}`,
          },
        ],
      };
    }
    return { content: [{ type: "text", text: `API error ${err.status}: ${err.detail}` }] };
  }
  const msg = err instanceof Error ? err.message : String(err);
  return { content: [{ type: "text", text: `Unexpected error: ${msg}` }] };
}
