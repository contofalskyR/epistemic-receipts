import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { buildConfig, type ApiConfig } from "./client.js";
import { registerSearchClaims } from "./tools/search-claims.js";
import { registerGetClaimWithReceipts } from "./tools/get-claim.js";
import { registerGetTrajectory } from "./tools/get-trajectory.js";
import { registerVerifyStatement } from "./tools/verify-statement.js";
import { registerStateOfKnowledge } from "./tools/state-of-knowledge.js";
import { registerListDatasets } from "./tools/list-datasets.js";

export function createServer(config?: ApiConfig): McpServer {
  const cfg = config ?? buildConfig();

  const server = new McpServer({
    name: "epistemic-receipts",
    version: "1.0.0",
  });

  registerSearchClaims(server, cfg);
  registerGetClaimWithReceipts(server, cfg);
  registerGetTrajectory(server, cfg);
  registerVerifyStatement(server, cfg);
  registerStateOfKnowledge(server, cfg);
  registerListDatasets(server, cfg);

  return server;
}
