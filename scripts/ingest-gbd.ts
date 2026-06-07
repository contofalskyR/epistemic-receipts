// Pipeline — IHME Global Burden of Disease (gbd_v1)
// STATUS: BLOCKED 2026-06-07 — no unauthenticated path to GBD cause-specific
// mortality data. Do not run this script until access is restored.
//
// Brief specified primary endpoint `https://api.healthdata.org/sdg/v1/`. That
// hostname does not resolve (NXDOMAIN). The other documented entry points are
// all behind login:
//
//   - vizhub.healthdata.org/gbd-results/        → Azure B2C login
//   - ghdx.healthdata.org/record/ihme-data/...  → /download-access/login
//   - OurWorldInData mirrors                    → HTTP 403 (IHME forbids
//                                                 redistribution)
//
// Until an IHME account with the GBD-Results-Tool API key is provisioned, or
// until IHME ships a public download URL for cause-of-death CSVs, no records
// can be ingested under this project's rules (verifiable external source per
// AGENTS.md "Curated lists require verifiable sources").
//
// When access is unblocked, this file should be expanded into a real ingester
// following the WHO GHO ingester pattern (scripts/ingest-who-gho.ts):
//   - one Source per (cause, location, year) batch
//   - Claim.text = "<cause> caused <val> deaths per 100k in <location> (<year>)"
//   - Claim.metadata.dataset = 'gbd_v1' with raw IHME fields preserved
//   - HARD_FACT / EMPIRICAL / VERIFIED — same as WHO GHO
//   - After ingest: link to who_gho_v1 by (country, year, cause keyword)
//     via CORROBORATES MetaEdge — see CONSULTANT.md changelog 2026-06-07.
//
// Running the file now exits non-zero with the blocked reason so CI cannot
// silently treat it as a no-op success.

const BLOCKED_REASON = [
  'IHME GBD is gated. Probed 2026-06-07:',
  '  - api.healthdata.org             NXDOMAIN',
  '  - ghdx.healthdata.org/gbd-results 404',
  '  - vizhub.healthdata.org           Azure B2C login required',
  '  - GHDx record downloads          /download-access/login required',
  '  - OWID grapher CSV mirrors        HTTP 403 (non-redistributable)',
  '',
  'Next steps:',
  '  1. Register at https://ghdx.healthdata.org/download-access/login',
  '  2. Once logged in, the GBD Results Tool exposes a download API key',
  '     in the user profile — store as GBD_API_KEY in .env.local.',
  '  3. Re-implement this script using the WHO GHO pattern.',
].join('\n')

console.error(BLOCKED_REASON)
process.exit(1)
