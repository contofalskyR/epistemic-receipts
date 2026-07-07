import { z } from "zod/v4";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ApiConfig, McpApiError, verifyStatement } from "../client.js";
import { claimUrl, formatAxis, ATTRIBUTION } from "./format.js";

const InputSchema = {
  statement: z.string().min(10).max(500).describe(
    'Statement to match against the corpus. Example: "mRNA vaccines cause myocarditis in young males"',
  ),
  limit: z.number().int().min(1).max(10).optional().default(5).describe(
    "Number of similar claims to return (1–10). Default 5.",
  ),
};

export function registerVerifyStatement(server: McpServer, config: ApiConfig): void {
  server.registerTool(
    "verify_statement",
    {
      title: "Find documented claims similar to a statement",
      description:
        "Finds the most semantically similar documented claims in the Epistemic Receipts corpus. " +
        "IMPORTANT: This returns *documentation status* — not truth verdicts. " +
        "The epistemicAxis field reflects how the claim is documented (SETTLED / CONTESTED / etc.), " +
        "not a judgment on whether your statement is true or false. " +
        "Use this to check whether a statement has been studied, what the documented consensus is, " +
        "and what provenance is available. " +
        "Follow up with get_claim_with_receipts on interesting IDs for full detail.",
      inputSchema: InputSchema,
    },
    async ({ statement, limit }) => {
      try {
        const res = await verifyStatement(config, statement, limit ?? 5);

        if (res.results.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: [
                  `No documented claims found similar to: "${statement}"`,
                  "",
                  `Disclaimer: ${res.disclaimer}`,
                  "",
                  ATTRIBUTION,
                ].join("\n"),
              },
            ],
          };
        }

        const lines = res.results.map((r, i) => {
          const url = claimUrl(r.id);
          const sim = (r.similarity * 100).toFixed(1);
          return [
            `${i + 1}. [${r.id}] ${r.text}`,
            `   Axis: ${formatAxis(r.epistemicAxis)}  |  Similarity: ${sim}%`,
            `   URL: ${url}`,
          ].join("\n");
        });

        const text = [
          `Statement: "${statement}"`,
          `Disclaimer: ${res.disclaimer}`,
          "",
          `Top ${res.results.length} similar documented claims:`,
          "",
          lines.join("\n\n"),
          "",
          `citation: ${res.results.map(r => claimUrl(r.id)).join(", ")}`,
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
