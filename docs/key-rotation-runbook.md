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
**Identified 2026-06-09.** The Azure key in question is `COLOMBIA_SEARCH_KEY`,
an **Azure Cognitive Search** admin/query key for the SUIN-Juriscol index at
`searchmjd.search.windows.net`. It is consumed by
`scripts/ingest-colombia-legislation.ts` (read from `process.env.COLOMBIA_SEARCH_KEY`;
the script exits if it is missing — no hardcoded fallback). The earlier note that
"`grep -i azure` is clean" was wrong: it matched only the literal env-var read, not
the substring `azure` — the resource is the `*.search.windows.net` endpoint.

The key is **not leaked in tracked code** (the script requires it from the
environment), so unlike NYT it is not known-compromised. Rotate it only if Robert
wants defence-in-depth or suspects exposure; otherwise this half can be left as-is.
`COLOMBIA_SEARCH_KEY` is also one of the env vars in the separate "Set … in Vercel
env vars" blocked task.

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

## What the worker already did (code-side)
- **2026-06-09 (earlier):** Removed the hardcoded live NYT key fallback from
  `scripts/populate-bill-coverage.ts`; the key is now required from the
  environment. Authored this runbook.
- **2026-06-09 (later):** Found the live NYT key was **still present** in the
  working tree at `CONSULTANT.md:1653` (a seed-command example) — the earlier pass
  scrubbed only the script. Redacted it. Also identified the "Azure" key as
  `COLOMBIA_SEARCH_KEY` (Azure Cognitive Search) and corrected the Azure section
  above, which had wrongly reported Azure as unused.

The **dashboard rotation itself remains open** and is Robert's to perform.
Because the leaked NYT key is in git history (and was in `CONSULTANT.md` until
today), it must still be treated as compromised and regenerated.
