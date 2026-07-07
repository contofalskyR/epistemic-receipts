import { z } from "zod/v4";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ApiConfig, McpApiError, getTrajectory } from "../client.js";
import { claimUrl, ATTRIBUTION } from "./format.js";

const InputSchema = {
  claim_id: z.string().describe(
    'Claim ID to retrieve consensus trajectory for. Get IDs from search_claims.',
  ),
};

export function registerGetTrajectory(server: McpServer, config: ApiConfig): void {
  server.registerTool(
    "get_trajectory",
    {
      title: "Get how consensus moved on a claim over time",
      description:
        "Returns the documented trajectory of a claim — ordered axis transitions " +
        "(e.g. OPEN → CONTESTED → SETTLED) with dates, communities that drove the shift, " +
        "and the marker sources (papers, reports, rulings) that documented each change. " +
        "Shows how scientific or institutional consensus evolved, not a current verdict. " +
        "Use search_claims to find the claim ID first.",
      inputSchema: InputSchema,
    },
    async ({ claim_id }) => {
      try {
        const traj = await getTrajectory(config, claim_id);
        const url = claimUrl(claim_id);

        if (traj.statusHistory.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: [
                  `Claim: ${traj.claimText}`,
                  "No documented trajectory transitions yet.",
                  "",
                  `citation: ${url}`,
                  ATTRIBUTION,
                ].join("\n"),
              },
            ],
          };
        }

        const lines = traj.statusHistory.map((h, i) => {
          const from = h.fromAxis ?? "—";
          const to = h.toAxis ?? "—";
          const date = h.occurredAt.slice(0, 10);
          const community = h.community ? ` [community: ${h.community}]` : "";
          const reason = h.reason ? `\n   Reason: ${h.reason}` : "";
          const source = h.markerSource
            ? `\n   Marker: ${h.markerSource.name}${h.markerSource.url ? ` — ${h.markerSource.url}` : ""}`
            : "";
          return `${i + 1}. ${date}${community}\n   ${from} → ${to}${reason}${source}`;
        });

        const summary =
          traj.statusHistory.length > 1
            ? `(${traj.statusHistory[0].fromAxis ?? "?"} → ... → ${traj.statusHistory[traj.statusHistory.length - 1].toAxis ?? "?"})`
            : "";

        const text = [
          `Claim: ${traj.claimText}`,
          `ID: ${claim_id}`,
          `Trajectory: ${traj.statusHistory.length} documented transitions ${summary}`,
          "",
          lines.join("\n\n"),
          "",
          `citation: ${url}`,
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
    if (err.status === 404) {
      return { content: [{ type: "text", text: `Claim not found. ${err.detail}` }] };
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
