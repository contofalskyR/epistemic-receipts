# Legislative Pipeline Queue

Two agents run at a time. Spin up next pair when a slot opens.
Last updated: 2026-05-19

## Status Key
- ✅ Done (committed + ingested)
- 🔄 Running now
- ⏳ Queued

---

## Completed
| P# | Country / Body | Tag | Claims |
|----|----------------|-----|--------|
| 1 | US Congress | congress_v1 | ~10k |
| 16 | EU Legislation | eu_legislation_v1 | 827 |
| 17 | NATO | nato_official_texts_v1 | 454 |
| 18 | EEC Council | eec_council_v1 | 8,933 |
| 19 | Sweden (Riksdag) | riksdag_v1 | 9,989 |
| 20 | Netherlands (Tweedekamer) | tweedekamer_v1 | 1,530 |
| 21 | Germany (Bundestag) | bundestag_v1 | 6,343 |
| 22 | Austria (Nationalrat) | nationalrat_v1 | 3,868 |
| 24 | Canada | canada_bills_v1 | 1,067 |
| 25 | Ireland (Oireachtas) | oireachtas_v1 | 4,040 |

## Running
| P# | Country | Tag | Notes |
|----|---------|-----|-------|
| 23 | UK | uk_legislation_v1 | ~6k/11.7k ingesting |
| 26 | Australia | australia_legislation_v1 | Building now |
| 27 | New Zealand | nz_legislation_v1 | Building now |

## Queue — English / Easy APIs
| P# | Country | API | Lang |
|----|---------|-----|------|
| 28 | Norway | stortinget.no | EN |
| 29 | India | sansad.nic.in | EN |
| 30 | Singapore | statutes.agc.gov.sg | EN |
| 31 | Iceland | althingi.is | EN |
| 32 | Denmark | ft.dk | DA (good API) |
| 33 | Finland | eduskunta.fi | FI/EN |
| 34 | Switzerland | fedlex.admin.ch | DE/FR/IT |
| 35 | Portugal | dre.pt | PT |
| 36 | Belgium | ejustice.just.fgov.be | FR/NL |
| 37 | Spain | boe.es | ES |
| 38 | Italy | normattiva.it | IT |
| 39 | Poland | sejm.gov.pl | PL |
| 40 | Taiwan | lis.ly.gov.tw | ZH |
| 41 | Japan | kokkai.ndl.go.jp | JA (partial EN) |
| 42 | South Korea | assembly.go.kr | KO |
| 43 | Argentina | infoleg.gob.ar | ES |
| 44 | Chile | bcn.cl | ES |
| 45 | Mexico | diputados.gob.mx | ES |
| 46 | Colombia | congreso.gov.co | ES |
| 47 | Brazil | camara.leg.br | PT |
| 48 | Philippines | congress.gov.ph | EN |
| 49 | South Africa | parliament.gov.za | EN |
| 50 | Bangladesh | bdlaws.minlaw.gov.bd | EN |
| 51 | France | legifrance.gouv.fr | FR (OAuth) |
| 52 | Russia | api.duma.gov.ru | RU |
