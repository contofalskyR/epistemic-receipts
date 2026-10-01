# Build Brief #7 — Owner Report

**Branch:** `loop/site-b7-2026-07-14`  
**Date:** 2026-07-14  
**Scope:** Security remediation and launch close-outs

---

## Phases

### B7-1 ✅ — PUBLIC_ROUTES additions (pre-existing commit)
Added `/terms`, `/privacy`, `/license` to `PUBLIC_ROUTES` in `lib/publicEdition.ts`. These footer-linked legal pages now resolve on the public edition without auth.

### B7-2 ✅ — Gitleaks pre-push hook (pre-existing commit)
Added local `gitleaks` pre-push hook to prevent secrets entering the repo. Untracked junk files cleaned.

### B7-3 ✅ — Dependency cleanup
- Removed `@xenova/transformers` (MiniLM embedding path was abandoned; dead code)
- Bumped `@sentry/nextjs` from `^9.47.1` → `^10.65.0`
- Deleted `scripts/populate-trajectory-embeddings.ts` (dead script)
- Regenerated `package-lock.json`
- `npx tsc --noEmit` clean — no type errors from Sentry v10 upgrade

### B7-4 ✅ — Auth hygiene audit (no changes needed)
Full audit of middleware, publicEdition routes, and API route auth guards:
- `middleware.ts` gates all mutations via `PUBLIC_WRITE_PATHS` allowlist + `isAdminRequest`
- All cron routes (`/api/cron/*`) check `CRON_SECRET`
- Ingest routes (`/api/ingest/*`) check `CRON_SECRET`
- Session-auth routes (collections, alerts, litigation, stripe) call `await auth()` in-handler
- No hardcoded credentials found (test tokens in test files are non-secret by design)
- `PUBLIC_ROUTES` list is minimal and intentional

### B7-5 ✅ — CSP cleanup
- Removed stale `@xenova/transformers` from `serverExternalPackages` in `next.config.ts`
- `connect-src 'self' https:` left intentionally broad: globe.gl loads external map textures,
  `vercel.live` script injected by Vercel may beacon; no concrete client-side external API calls found
- `script-src` retains `'unsafe-inline'` (required for Next.js RSC streaming hydration)
- Sentry browser SDK routes through `/api/sentry-tunnel` (self) — no `sentry.io` in connect-src needed

### B7-6 ✅ — Workflow hardening
- Added `permissions: contents: read` to 10 of 11 workflow files that lacked a permissions block
  (only `mcp-publish.yml` already had one with `id-token: write`)
- All GitHub Actions already SHA-pinned with version comments — no floating `@v3`/`@v4` tags found

### B7-7 ✅ — Whitepaper close-out
- `WHITEPAPER.md` exists in the repo root and **is tracked by git** (not in `.gitignore`)
- No `/whitepaper` app route exists — the document is repo-only (not served publicly)
- No whitepaper-related API route found

---

## What Robert needs to verify post-merge

1. **WHITEPAPER.md tracking** — Decide: should it stay tracked in git (fine for a public doc), or be added to `.gitignore` if it's internal-only? Currently it's tracked, which means it's public once the repo is public.

2. **Whitepaper claim IDs** — The brief asked to verify that claims `cmqwoxe6l07dy8o0y6xrs8xnv` and `cmqoappnu03yxsadpa90nu942` exist in the DB (no 404 on `/claims/<id>`). DATABASE_URL is not available on the VPS (Neon creds are Vercel-only), so this check must be done post-merge via the deployed preview URL or a Neon console query:
   ```sql
   SELECT id, title FROM "Claim" WHERE id IN ('cmqwoxe6l07dy8o0y6xrs8xnv', 'cmqoappnu03yxsadpa90nu942');
   ```

3. **Sentry v10 on Vercel preview** — The Sentry bump is a major version. Watch the Vercel preview build for any Sentry-related warnings; the local `tsc --noEmit` was clean but Vercel's edge compilation is the real test.

4. **Workflow permissions** — The `permissions: contents: read` addition is conservative (read-only). If any workflow needs to push, create releases, or write to GitHub packages, a job-level override will be needed. Review workflows that run on `push` to `main` if they fail.

---

## Files changed this brief

- `lib/publicEdition.ts` — B7-1: PUBLIC_ROUTES additions
- `middleware.ts` — B7-1 related (pre-existing)
- `package.json` — B7-3: remove @xenova/transformers, bump @sentry/nextjs
- `package-lock.json` — B7-3: regenerated
- `scripts/populate-trajectory-embeddings.ts` — B7-3: deleted
- `next.config.ts` — B7-5: remove stale serverExternalPackages entry
- `.github/workflows/*.yml` (10 files) — B7-6: add permissions block
- `B7-REPORT.md` — this file
- `CONSULTANT.md` — B7 section appended
