# Spec 22 — MCP Server

Phase 2 · Depends on: 20 · Model: Sonnet 5 · Scope: ~1–2 agent sessions

## Objective
An MCP server exposing the claim graph to AI agents — the cheapest distribution channel to AI developers. Thin wrapper over /v1; no logic that isn't in the API.

## Design (decided)
- Location: `packages/mcp-server/` in this repo, published to npm as `epistemic-receipts-mcp` (unscoped unless the org name is free). TypeScript, official `@modelcontextprotocol/sdk`.
- Transports: stdio (local, `npx epistemic-receipts-mcp`) AND Streamable HTTP hosted at `/api/mcp` on the site (same middleware rules; MCP POST requests need a `PUBLIC_WRITE_PATHS` entry gated by API-key auth inside the handler + rate limit rule — coordinate with the Spec 20 limiter, MCP calls count against the key's quota).
- Auth: `EPISTEMIC_RECEIPTS_API_KEY` env var → forwarded as the /v1 key. Keyless = free-tier limits with a nudge in tool descriptions.
- **Tools** (names and schemas are the product — write descriptions for an agent audience, with argument examples):
  - `search_claims(query, filters?)` → /v1/search
  - `get_claim_with_receipts(claim_id)` → /v1/claims/{id}, formatted: claim text, axis, provenance grade, edges grouped FOR/AGAINST/CONTRADICTS with source names+dates+URLs, status timeline
  - `get_trajectory(claim_id)` → /v1/trajectories — "how consensus moved," ordered transitions with communities and marker sources
  - `verify_statement(statement)` → /v1/verify — top matches with grades; description must say it returns *documentation status*, not truth verdicts
  - `state_of_knowledge(topic, as_of_date)` → until Spec 40's endpoint exists, implement as: search topic → for each hit, trajectory filtered to transitions ≤ date + only sources published ≤ date; note in code to swap to the real endpoint later
  - `list_datasets()` → /v1/manifest summarized
- Every tool response ends with a `citation` field (canonical claim URL(s)) and the attribution line. Responses are compact structured text, not raw JSON dumps (token-respectful: cap edges at 15 per claim with a "N more" note).
- Errors from /v1 surface as helpful tool errors (rate-limited → say so and when to retry), never crashes.

## Deliverables
1. The package (tools, transports, README with Claude Desktop/Claude Code/Cursor config snippets).
2. Hosted endpoint wired into the app.
3. `npm publish` workflow (manual dispatch) + version pinned to /v1 (it's additive-only, so pin major).
4. Registry listings checklist: MCP registry, Smithery, PulseMCP — file `packages/mcp-server/LISTINGS.md` with submission status (human completes accounts where needed).
5. Eval transcript: 10 scripted agent tasks ("what's the status of the lab-leak claim and how did it change?", "was this paper retracted?", "state of knowledge on semaglutide as of 2019") run against the local server, saved to `packages/mcp-server/examples/`.

## Out of scope
Write tools of any kind. Sampling/prompts features. OAuth (API key is the model until Spec 30 matures).

## Acceptance criteria
- Works in Claude Code via stdio config from the README, verbatim (paste transcript of `search_claims` + `get_claim_with_receipts` round-trip).
- Hosted transport: same two calls succeed against staging URL with a key; 401 without when quota exceeded; MCP traffic appears in ApiUsage metering.
- Token discipline: `get_claim_with_receipts` on the heaviest claim in DB (find it: max edge count) stays under 4k tokens output.
- All 10 eval transcripts produce grounded answers with citation fields present.

## Verification
Paste: stdio transcript, hosted-transport curl/inspector output, metering rows, heavy-claim token count.
