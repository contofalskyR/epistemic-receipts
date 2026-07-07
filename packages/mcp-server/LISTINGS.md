# MCP Registry Listings

Track submission status for `epistemic-receipts-mcp` across registries.
**Human completes account creation and submission steps.**

## MCP.so (modelcontextprotocol.io)

- Submission URL: https://modelcontextprotocol.io/registry
- Status: [ ] Not submitted
- Notes: Submit after first npm publish. Needs GitHub URL, npm package name, description, and tool list.

## Smithery

- Submission URL: https://smithery.ai/submit
- Status: [ ] Not submitted
- Notes: Smithery requires a GitHub repo + `smithery.yaml` config file. Create `packages/mcp-server/smithery.yaml` before submitting.

### Smithery config to add

```yaml
# packages/mcp-server/smithery.yaml
name: epistemic-receipts
description: Expose the Epistemic Receipts claim graph to AI agents. Search documented claims, get provenance receipts, trace consensus trajectories.
license: MIT
configSchema:
  type: object
  properties:
    apiKey:
      type: string
      description: "Epistemic Receipts API key (er_live_...)"
  required:
    - apiKey
startCommand:
  type: stdio
  command: npx
  args: ["-y", "epistemic-receipts-mcp"]
  env:
    EPISTEMIC_RECEIPTS_API_KEY: "{{apiKey}}"
```

## PulseMCP

- Submission URL: https://www.pulsemcp.com/submit
- Status: [ ] Not submitted
- Notes: Requires npm package URL and description. Submit after first publish.

## Glama

- Submission URL: https://glama.ai/mcp/servers/submit
- Status: [ ] Not submitted

---

## Pre-submission checklist

- [ ] `npm publish` completed (first version on npm)
- [ ] GitHub repo URL confirmed public
- [ ] README has working Claude Desktop config snippet
- [ ] At least one eval transcript in `examples/`
- [ ] Smithery config file created

## Publish instructions (owner-executed)

```bash
cd packages/mcp-server
npm run build
npm publish --access public
```

Or use the GitHub Actions workflow (`.github/workflows/mcp-publish.yml`) via manual dispatch.
