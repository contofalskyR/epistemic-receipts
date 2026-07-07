# Cost Baseline — Monthly Infrastructure Spend

Last updated: [TBD — human fills]

## Current Monthly Costs

| Service | Plan | Monthly Cost | Notes |
|---------|------|-------------|-------|
| Vercel (production) | [FILL: Pro / Hobby] | $[FILL] | Include seat count if Pro |
| Vercel (staging) | [FILL: same plan] | $[FILL] | Second project on same team |
| Neon (production) | [FILL: Free / Scale / Business] | $[FILL] | |
| Neon (staging branch) | included above | — | Branch compute billed separately on paid plans |
| Resend | [FILL: Free / Starter / Pro] | $[FILL] | Free tier: 3,000 emails/month |
| Sentry | [FILL: Free / Team] | $[FILL] | Free tier: 5k errors/month |
| Domain registrar | [FILL] | $[FILL]/yr | Amortized monthly: $[FILL] |
| **Total** | | **$[FILL]/month** | |

## Neon Egress Notes

- Neon charges for **data transfer out** on paid plans (currently $0.09/GB after free tier).
- The Neon adapter uses WebSocket pooling — most reads go through the pooler endpoint
  which has lower latency but same egress billing.
- Bulk ingest scripts use `DIRECT_URL` (bypasses pooler) — these are the highest-egress
  operations. Monitor via Neon Console → Metrics → Data Transfer.
- The `/api/glob*`, `/api/search`, and `/api/claims` routes are the highest read-path
  sources. Each response payload should stay under 50 KB.

## Vercel Egress Notes

- Vercel Pro: 1 TB bandwidth/month included.
- The heaviest routes by byte count are: `/api/glob*` (globe data), `/api/search`,
  and static assets (Three.js bundle ~1 MB gzip).
- Monitor via Vercel dashboard → Usage → Bandwidth.

## Repricing Rule

Review and update this table when:
1. A service tier changes (upgrade or downgrade)
2. Monthly cost for any single service changes by more than **2×** (either direction)
3. A new billed service is added (e.g., a paid uptime monitoring plan)

The owner reviews this file before each monthly billing cycle.

## Free-tier Limits to Watch

| Service | Limit | Current Usage |
|---------|-------|---------------|
| Neon Free | 512 MB storage, 24h PITR | [FILL] |
| Resend Free | 3,000 emails/month | [FILL] |
| Sentry Free | 5,000 errors/month | [FILL] |
| Vercel Hobby | 100 GB bandwidth | [FILL] |

> If any usage exceeds 80% of a free-tier limit, upgrade the plan before it becomes
> an incident. The reconcile-pipelines cron and topic-alerts cron are the main
> email consumers — monitor Resend dashboard monthly.
