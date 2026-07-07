import { z } from "zod/v4";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ApiConfig, McpApiError, searchClaims, getTrajectory } from "../client.js";
import { claimUrl, formatAxis, formatGrade, ATTRIBUTION } from "./format.js";

// NOTE: This is a synthetic endpoint implemented as search + trajectory filtering.
// When Spec 40's dedicated /v1/state-of-knowledge endpoint lands, swap to that.
const InputSchema = {
  topic: z.string().min(3).max(200).describe(
    'Topic to assess. Example: "semaglutide weight loss" or "SARS-CoV-2 lab origin"',
  ),
  as_of_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD")
    .optional()
    .describe(
      "Snapshot date (YYYY-MM-DD). Returns the state of knowledge as documented up to this date. " +
        "Example: \"2019-12-31\"",
    ),
};

export function registerStateOfKnowledge(server: McpServer, config: ApiConfig): void {
  server.registerTool(
    "state_of_knowledge",
    {
      title: "State of documented knowledge on a topic as of a given date",
      description:
        "Summarises the documented state of knowledge on a topic as of an optional cutoff date. " +
        "Searches the corpus for claims on the topic, then for each claim shows the documented " +
        "epistemic axis and trajectory transitions that occurred on or before as_of_date. " +
        "Useful for historical research: 'what was known about X in 2019?' " +
        "NOTE: This synthesises search + trajectory data. " +
        "A dedicated endpoint will replace this logic in a future API version.",
      inputSchema: InputSchema,
    },
    async ({ topic, as_of_date }) => {
      try {
        const cutoff = as_of_date ? new Date(as_of_date) : null;
        const searchRes = await searchClaims(config, topic, { limit: 10 });

        if (searchRes.data.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: [
                  `No documented claims found for topic: "${topic}"`,
                  cutoff ? `As of: ${as_of_date}` : "",
                  "",
                  ATTRIBUTION,
                ]
                  .filter(Boolean)
                  .join("\n"),
              },
            ],
          };
        }

        const claimSummaries: string[] = [];
        const citationUrls: string[] = [];

        for (const claim of searchRes.data.slice(0, 8)) {
          const url = claimUrl(claim.id);
          citationUrls.push(url);

          // Fetch trajectory to filter by date
          let trajNote = "";
          try {
            const traj = await getTrajectory(config, claim.id);
            const relevantTransitions = cutoff
              ? traj.statusHistory.filter(h => new Date(h.occurredAt) <= cutoff)
              : traj.statusHistory;

            if (relevantTransitions.length > 0) {
              const last = relevantTransitions[relevantTransitions.length - 1];
              const axisAtDate = last.toAxis ?? claim.epistemicAxis;
              trajNote = cutoff
                ? `Axis at ${as_of_date}: ${formatAxis(axisAtDate)} (${relevantTransitions.length} transitions to date)`
                : `Axis: ${formatAxis(claim.epistemicAxis)} (${traj.statusHistory.length} transitions total)`;
            } else {
              trajNote = cutoff
                ? `No trajectory transitions before ${as_of_date}; current axis: ${formatAxis(claim.epistemicAxis)}`
                : `Axis: ${formatAxis(claim.epistemicAxis)} (no transitions)`;
            }
          } catch {
            trajNote = `Axis: ${formatAxis(claim.epistemicAxis)}`;
          }

          claimSummaries.push(
            [
              `• [${claim.id}] ${claim.text}`,
              `  ${trajNote}`,
              `  Grade: ${formatGrade(claim.provenanceGrade)}`,
              `  URL: ${url}`,
            ].join("\n"),
          );
        }

        const header = cutoff
          ? `State of knowledge on "${topic}" as of ${as_of_date}`
          : `Current state of knowledge on "${topic}"`;

        const text = [
          header,
          `(${searchRes.total} total corpus matches; showing top ${claimSummaries.length})`,
          "",
          claimSummaries.join("\n\n"),
          "",
          `citation: ${citationUrls.join(", ")}`,
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
