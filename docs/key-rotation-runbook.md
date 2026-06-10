# Key Rotation Runbook — NYT + Azure

**Status:** ⏸ Awaiting Robert. The dashboard steps below require authenticated
human access to external provider portals and **cannot be performed by the
autonomous worker.** This document exists so the rotation can be done quickly
and verifiably when Robert picks it up.

Last updated: 2026-06-09

---

## Why these keys need rotating

### NYT
A live NYT Article Search API key was committed to the repository as a hardcoded
fallback in `scripts/populate-bill-coverage.ts`:

```
const NYT_KEY = process.env.NYT_API_KEY ?? 'K7ulaKJJ...<redacted>'
```

Because it lives in git history, the key must be treated as **compromised** and
rotated — removing it from the working tree does not un-leak it. The worker has
already removed the hardcoded fallback (commit on 2026-06-09); the script now
requires `NYT_API_KEY` from the environment and exits if it is missing, matching
the pattern in `scripts/enrich-media-coverage.ts`.

### Azure
Listed alongside NYT in the original blocked task. No Azure key is currently
referenced in tracked code (`grep -i azure` over `*.ts`/`*.tsx` is clean as of
2026-06-09). Confirm whether an Azure key exists in any untracked `.env*` file or
deployment provider before rotating, and record what it is used for here once
identified. If no Azure key is actually in use, this half of the task can be
struck rather than rotated.

---

## Rotation steps (human-only)

### NYT Developer Portal
1. Sign in at https://developer.nytimes.com/ → **Apps**.
2. Open the app whose key is `K7ulaKJJ...` (Article Search API enabled).
3. **Regenerate / re-roll the API key** (or delete the app and create a new one
   if regeneration is unavailable). This invalidates the leaked key.
4. Copy the new key.
5. Update `NYT_API_KEY` everywhere it lives:
   - `.env.local` (local dev)
   - Vercel project env vars (see related blocked task — "Set CRON_SECRET,
     TELEGRAM_CHAT_ID, NYT_API_KEY, COLOMBIA_SEARCH_KEY in Vercel env vars")
6. Verify the old key is dead and the new one works:
   ```
   npx dotenv-cli -e .env.local -- npx tsx scripts/populate-bill-coverage.ts --dry-run --limit 2
   ```
   A dry-run with the **old** key should now 401/403; with the new key it should
   return article counts.

### Azure Portal
1. Identify the resource (Azure OpenAI / Cognitive Services / Storage / etc.)
   and confirm it is actually used by this project first.
2. Azure Portal → resource → **Keys and Endpoint**.
3. Click **Regenerate Key1** (rotate the secondary first if both are in use, swap
   consumers over, then rotate the primary — zero-downtime two-key rotation).
4. Update the corresponding env var locally and in Vercel.
5. Verify the dependent code path works with the new key.

---

## Post-rotation checklist
- [ ] NYT key regenerated at developer.nytimes.com
- [ ] Old NYT key confirmed dead (dry-run 401/403)
- [ ] `NYT_API_KEY` updated in `.env.local` + Vercel
- [ ] Azure key existence confirmed (or task half struck as N/A)
- [ ] Azure key rotated (if applicable) + env updated
- [ ] Consider scrubbing the leaked NYT key from git history
      (`git filter-repo` / BFG) — optional but recommended since the repo may be
      shared. Rotation alone makes the leaked key useless, which is sufficient
      for security; history rewrite is hygiene.
- [ ] Check off the rotation task in `TASK_QUEUE.md`.

---

## What the worker already did (code-side, 2026-06-09)
- Removed the hardcoded live NYT key fallback from
  `scripts/populate-bill-coverage.ts`; the key is now required from the
  environment.
- Authored this runbook.

The **dashboard rotation itself remains open** and is Robert's to perform.
