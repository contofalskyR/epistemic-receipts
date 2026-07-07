# epistemic-receipts-mcp

MCP server exposing the [Epistemic Receipts](https://epistemic-receipts.vercel.app) claim graph to AI agents.

Thin wrapper over the `/v1` API — no logic that isn't in the API. Provenance grades measure documentation depth, not truth.

## Quick start (stdio — Claude Desktop / Claude Code / Cursor)

### Claude Code

Add to your `claude.json` (or `~/.claude.json`):

```json
{
  "mcpServers": {
    "epistemic-receipts": {
      "command": "npx",
      "args": ["-y", "epistemic-receipts-mcp"],
      "env": {
        "EPISTEMIC_RECEIPTS_API_KEY": "er_live_your_key_here"
      }
    }
  }
}
```

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "epistemic-receipts": {
      "command": "npx",
      "args": ["-y", "epistemic-receipts-mcp"],
      "env": {
        "EPISTEMIC_RECEIPTS_API_KEY": "er_live_your_key_here"
      }
    }
  }
}
```

### Cursor

In `.cursor/mcp.json` in your project root:

```json
{
  "mcpServers": {
    "epistemic-receipts": {
      "command": "npx",
      "args": ["-y", "epistemic-receipts-mcp"],
      "env": {
        "EPISTEMIC_RECEIPTS_API_KEY": "er_live_your_key_here"
      }
    }
  }
}
```

### Environment variables

| Variable | Required | Description |
|---|---|---|
| `EPISTEMIC_RECEIPTS_API_KEY` | Yes | API key (`er_live_…`). Get one at [epistemic-receipts.vercel.app/docs/api](https://epistemic-receipts.vercel.app/docs/api#signup) |
| `EPISTEMIC_RECEIPTS_API_BASE_URL` | No | Override API base URL (default: `https://epistemic-receipts.vercel.app`) |

## Hosted transport (Streamable HTTP)

The server is also available as a hosted MCP endpoint at:

```
https://epistemic-receipts.vercel.app/api/mcp
```

Configure in Claude Code:

```json
{
  "mcpServers": {
    "epistemic-receipts": {
      "type": "http",
      "url": "https://epistemic-receipts.vercel.app/api/mcp",
      "headers": {
        "Authorization": "Bearer er_live_your_key_here"
      }
    }
  }
}
```

## Tools

### `search_claims(query, axis?, limit?)`

Full-text and semantic search over the claim graph.

```
query   — Search terms. Example: "mRNA vaccine effectiveness 2021"
axis    — Filter: SETTLED | CONTESTED | RECORDED | OPEN | UNRESOLVABLE
limit   — Results count (1–50, default 10)
```

Returns: Matching claims with epistemic axis, provenance grade (A–X), and direct links.

### `get_claim_with_receipts(claim_id)`

Full provenance record for a single claim.

```
claim_id — From search_claims or a receipt URL
```

Returns: Claim text, axis, provenance grade + description, edges grouped by type (FOR / AGAINST / CONTRADICTS / QUALIFIES) with source names, dates, and URLs, status timeline. Edges capped at 15 per call; use the API directly for full sets.

### `get_trajectory(claim_id)`

How consensus moved on a claim over time.

```
claim_id — Claim to trace
```

Returns: Ordered axis transitions (e.g. OPEN → CONTESTED → SETTLED) with dates, communities, and marker sources.

### `verify_statement(statement, limit?)`

Find documented claims similar to a statement.

```
statement — Text to match (10–500 chars)
limit     — Results (1–10, default 5)
```

**Important:** Returns *documentation status*, not truth verdicts. `epistemicAxis` reflects how the claim is documented, not a judgment about your statement.

### `state_of_knowledge(topic, as_of_date?)`

State of documented knowledge on a topic as of an optional date.

```
topic       — Topic to assess. Example: "semaglutide weight loss"
as_of_date  — Snapshot date YYYY-MM-DD. Example: "2019-12-31"
```

Returns: Top claims on the topic with their documented axis at the given date.

Note: Currently implemented as search + trajectory filtering. A dedicated `/v1/state-of-knowledge` endpoint will replace this in a future version.

### `list_datasets()`

List all data pipelines feeding the corpus with claim counts and last-run timestamps.

---

## Provenance grades

Every response includes a `provenanceGrade` measuring documentation depth — **not truth**:

| Grade | Meaning |
|---|---|
| A | Human-reviewed with ≥2 primary-source edges |
| B | Verified pipeline with ≥1 primary-source edge |
| C | Auto-approved or bulk-ingested |
| D | Provisional — incomplete documentation |
| X | Deprecated / abandoned |

## Attribution

All tool responses include:
```
Source: Epistemic Receipts (epistemic-receipts.vercel.app) — provenance grades measure documentation depth, not truth.
```

## Rate limits

| Tier | Rate |
|---|---|
| Free | 60 req/min, 10k/day |
| Pro | 600 req/min |
| Team | 3000 req/min |

On rate limit, tools return a helpful message with retry timing rather than crashing.

## Local development

```bash
git clone https://github.com/your-org/epistemic-receipts
cd packages/mcp-server
npm install
EPISTEMIC_RECEIPTS_API_KEY=er_live_... npm run dev
```

## License

MIT
