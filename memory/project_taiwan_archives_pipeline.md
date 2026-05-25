---
name: taiwan-archives-pipeline-121
description: Taiwan ROC National Archives Pipeline 121 — 4.8M records, HTML scraping approach, ROC date conversion
metadata:
  type: project
---

Pipeline 121 | `taiwan_archives_v1` | script: `scripts/ingest-taiwan-archives.ts`

**Why:** Taiwan Archives has no public REST/JSON API. The public portal at `aa.archives.gov.tw` is an ASP.NET MVC app with server-rendered HTML search results.

**How to apply:** For future maintenance or expansion, the API endpoint is `/ELK/SimpSearch?q=&PageNow=N&DisplayNumber=20`. The script uses HTML regex parsing, not JSON.

Key technical details:
- API: `https://aa.archives.gov.tw/ELK/SimpSearch?q=&PageNow=N&DisplayNumber=20`
- Records identified by 10-digit numeric SystemID (e.g., `0000009022`)
- Viewer URL: `https://aa.archives.gov.tw/ELK/SearchDetailed?SystemID=BASE64(numericId)`
- Dates in ROC (Minguo) calendar: 民國N年 = N+1911 CE
- Total available: ~4.8M records, API caps at 10,000 per empty-keyword query
- Dry-run passed 2026-05-23 with 20 records
- Awaiting full-run approval from Robert
