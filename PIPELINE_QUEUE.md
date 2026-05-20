# Legislative Pipeline Queue

Two agents run at a time. Spin up next pair when a slot opens.
Last updated: 2026-05-20

## Status Key
- ✅ Done (committed + ingested)
- 🔄 Running now
- ⏳ Queued

---

## Completed
| P# | Country / Body | Tag | Claims |
|----|----------------|-----|--------|
| 1 | US Congress | congress_v1 | 10,360 |
| 16 | EU Legislation | eu_legislation_v1 | 2,052 |
| 17 | NATO | nato_official_texts_v1 | 454 |
| 18 | EEC Council | eec_council_v1 | 8,933 |
| 19 | Sweden (Riksdag) | riksdag_v1 | 9,989 |
| 20 | Netherlands (Tweedekamer) | tweedekamer_v1 | 1,530 |
| 21 | Germany (Bundestag) | bundestag_v1 | 6,343 |
| 22 | Austria (Nationalrat) | nationalrat_v1 | 3,868 |
| 23 | UK | uk_legislation_v1 | 11,777 |
| 24 | Canada | canada_bills_v1 | 1,067 |
| 25 | Ireland (Oireachtas) | oireachtas_v1 | 4,040 |
| 26 | Australia | australia_legislation_v1 | 4,734 |
| 28 | Norway | norway_legislation_v1 | 2,609 |
| 29 | India | india_legislation_v1 | 3,540 |
| 30 | Singapore | singapore_legislation_v1 | 507 |
| 31 | Iceland | iceland_legislation_v1 | 1,068 |
| 32 | Denmark | denmark_legislation_v1 | 4,550 |
| 33 | Finland | finland_legislation_v1 | 1,651 |
| 34 | Switzerland | switzerland_legislation_v1 | 2,407 |
| 35 | Portugal | portugal_legislation_v1 | 1,292 |
| 36 | Belgium | belgium_legislation_v1 | 7,826 |
| 37 | Spain | spain_legislation_v1 | 2,045 |
| 38 | Italy (Parlamento) | italy_legislation_v1 | 16,929 |
| 39 | Poland | poland_legislation_v1 | 6,438 |
| 40 | Taiwan (Legislative Yuan) | taiwan_legislation_v1 | 1,015 |
| 41 | Japan | japan_legislation_v1 | 2,077 |
| 43 | Argentina | argentina_legislation_v1 | 25,824 |
| 45 | Mexico | mexico_legislation_v1 | 308 |
| 44 | Chile | chile_legislation_v1 | 15,881 |
| 46 | Colombia | colombia_legislation_v1 | 8,159 |
| 47 | Brazil | brazil_legislation_v1 | 10,966 |
| 48 | Philippines | philippines_legislation_v1 | 11,703 |
| 50 | Bangladesh | bangladesh_legislation_v1 | 1,610 |
| 49 | South Africa | south_africa_legislation_v1 | 557 |
| 51 | France | france_legislation_v1 | 3,046 |
| 54 | Israel (Knesset) | israel_knesset_v1 | 2,009 |

## Missing / Skipped
| P# | Country | Blocker | Resolution |
|----|---------|---------|------------|
| 27 | New Zealand | `NZ_LEGISLATION_API_KEY` not set — PCO API requires browser registration | Register at legislation.govt.nz, add key to .env.local, script ready |
| 42 | South Korea | law.go.kr DRF API requires IP-registered Open API key | Register at open.law.go.kr, add key to .env.local, script ready |
| 52 | Russia | kremlin.ru IP-blocked; api.duma.gov.ru + pravo.gov.ru geo-blocked | Retry when IP ban lifts — script exists at ingest-russia-legislation.ts |
| 66 | Czech Republic | psp.cz returns HTML only, no JSON API | No path forward currently |
| 67 | Ukraine | zakon.rada.gov.ua 403s non-UA IPs | Retry via Ukrainian IP/proxy, or wait for public API |
| 68 | Hungary | njt.hu API endpoint 404 | No path forward currently |
| 69 | Romania | cdep.ro connection timeout | No path forward currently |
| 70 | Slovakia | nrsr.sk returns HTML only | No path forward currently |
| 71 | Vietnam | vbpl.vn connection timeout | No path forward currently |
| 72 | Pakistan | na.gov.pk connection timeout | No path forward currently |

## Queue
| P# | Country | API | Lang |
|----|---------|-----|------|
