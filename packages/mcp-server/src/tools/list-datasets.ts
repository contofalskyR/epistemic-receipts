import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ApiConfig, McpApiError, listDatasets } from "../client.js";
import { ATTRIBUTION } from "./format.js";

export function registerListDatasets(server: McpServer, config: ApiConfig): void {
  server.registerTool(
    "list_datasets",
    {
      title: "List available datasets (pipelines) in the Epistemic Receipts corpus",
      description:
        "Returns a summary of all data pipelines feeding the Epistemic Receipts corpus: " +
        "name, upstream source, ingestion method, cadence, claim counts, and last-run timestamp. " +
        "Use this to understand what sources are available and filter search_claims by pipeline name.",
      inputSchema: {},
    },
    async () => {
      try {
        const datasets = await listDatasets(config);
        const active = datasets.filter(d => !d.retired);
        const retired = datasets.filter(d => d.retired);

        const formatDataset = (d: (typeof datasets)[0]): string => {
          const lines = [
            `• ${d.name} [${d.tag}]`,
            `  Source: ${d.upstreamName ?? "—"}${d.upstreamUrl ? ` (${d.upstreamUrl})` : ""}`,
            `  Method: ${d.method ?? "—"}  |  Cadence: ${d.cadence ?? "—"}`,
            `  Claims: ${d.counts.total} total, ${d.counts.humanReviewed} human-reviewed`,
            `  Last run: ${d.lastRunAt?.slice(0, 10) ?? "never"}`,
          ];
          if (d.caveats) lines.push(`  Caveats: ${d.caveats}`);
          return lines.join("\n");
        };

        const parts = [
          `Epistemic Receipts Datasets — ${datasets.length} pipelines (${active.length} active, ${retired.length} retired)`,
          "",
        ];

        if (active.length > 0) {
          parts.push("Active:");
          parts.push(active.map(formatDataset).join("\n\n"));
        }
        if (retired.length > 0) {
          parts.push("", "Retired:");
          parts.push(retired.map(formatDataset).join("\n\n"));
        }

        parts.push("", `citation: https://epistemic-receipts.vercel.app/datasets`, ATTRIBUTION);

        return { content: [{ type: "text", text: parts.join("\n") }] };
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
    return { content: [{ type: "text", text: `API error ${err.status}: ${err.detail}` }] };
  }
  const msg = err instanceof Error ? err.message : String(err);
  return { content: [{ type: "text", text: `Unexpected error: ${msg}` }] };
}
