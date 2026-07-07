#!/usr/bin/env node
/**
 * Epistemic Receipts MCP Server — stdio entry point.
 *
 * Usage: npx epistemic-receipts-mcp
 * Config: set EPISTEMIC_RECEIPTS_API_KEY in env (free tier: rate-limited)
 *         set EPISTEMIC_RECEIPTS_API_BASE_URL to override production URL
 */
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";

const server = createServer();
const transport = new StdioServerTransport();

server.connect(transport).catch((err: unknown) => {
  process.stderr.write(
    `epistemic-receipts-mcp: fatal error: ${err instanceof Error ? err.message : String(err)}\n`,
  );
  process.exit(1);
});
