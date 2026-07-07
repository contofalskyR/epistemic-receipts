import { z } from "zod/v4";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ApiConfig, McpApiError, searchClaims } from "../client.js";
import { claimUrl, formatAxis, formatGrade, ATTRIBUTION } from "./format.js";

const InputSchema = {
  query: z.string().min(3).max(500).describe(
    'Search terms. Example: "mRNA vaccine effectiveness 2021"',
  ),
  axis: z
    .enum(["SETTLED", "CONTESTED", "RECORDED", "OPEN", "UNRESOLVABLE"])
    .optional()
    .describe("Filter by epistemic axis (consensus status)."),
  limit: z.number().int().min(1).max(50).optional().default(10).describe(
    "Number of results (1–50). Default 10.",
  ),
};

export function registerSearchClaims(server: McpServer, config: ApiConfig): void {
  server.registerTool(
    "search_claims",
    {
      title: "Search claims in the Epistemic Receipts corpus",
      description:
        "Full-text and semantic search over the Epistemic Receipts claim graph. " +
        "Returns matching claims with their epistemic axis (SETTLED / CONTESTED / RECORDED / OPEN / UNRESOLVABLE), " +
        "provenance grade (A–X, measuring documentation depth — not truth), and direct links. " +
        "Use this as the entry point to find claim IDs for follow-up tools. " +
        "Keyless access returns 401; set EPISTEMIC_RECEIPTS_API_KEY for authenticated access.",
      inputSchema: InputSchema,
    },
    async ({ query, axis, limit }) => {
      try {
        const res = await searchClaims(config, query, { axis, limit: limit ?? 10 });

        if (res.data.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `No claims found for "${query}". Try broader terms or remove filters.\n\n${ATTRIBUTION}`,
              },
            ],
          };
        }

        const lines = res.data.map((c, i) => {
          const url = claimUrl(c.id);
          return [
            `${i + 1}. [${c.id}] ${c.text}`,
            `   Axis: ${formatAxis(c.epistemicAxis)}`,
            `   Grade: ${formatGrade(c.provenanceGrade)}  |  Pipeline: ${c.ingestedBy ?? "unknown"}`,
            `   URL: ${url}`,
          ].join("\n");
        });

        const text = [
          `Search: "${query}" — ${res.total} total results (showing ${res.data.length})`,
          "",
          lines.join("\n\n"),
          "",
          `citation: ${res.data.map(c => claimUrl(c.id)).join(", ")}`,
          ATTRIBUTION,
        ].join("\n");

        return { content: [{ type: "text", text }] };
      } catch (err) {
        return formatError(err);
      }
    },
  );
}

function formatError(err: unknown): { content: Array<{ type: "text"; text: string }> } {
  if (err instanceof McpApiError) {
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
