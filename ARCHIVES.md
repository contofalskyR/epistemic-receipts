# Archival Sources — Epistemic Receipts

Comprehensive breakdown of declassified / digitized archival collections by region, with access quality and ingestion notes. These are **background-tier** sources — they produce case studies that cite analyses, document collections, or aggregated views, not individual records from a bulk ingest. Where a clean structured API exists, upgrade to reference-tier and add to ROADMAP.md.

Last updated: 2026-05-23

---

## Access Quality Legend

- 🟢 **API / Structured** — JSON or XML API, machine-readable, ingestible
- 🟡 **Semi-structured** — finding aids online, limited bulk access, some metadata
- 🔴 **Manual / On-site** — no API, physical access or limited digital
- ⭐ **High editorial value** — directly anchors major case studies

---

## Americas

### United States 🟢⭐
- **NARA (National Archives)** — [archives.gov](https://www.archives.gov)
  - CIA records, State Department cables, DoD declassified, JFK files, Church Committee
  - Structured finding aids; some collections via [archives.gov API](https://www.archives.gov/developer)
  - *Status: Building pipeline (P110 adjacent)*
- **CIA Reading Room** — [cia.gov/readingroom](https://www.cia.gov/readingroom)
  - MKULTRA docs, Cold War National Intelligence Estimates, clandestine ops
  - No bulk API; search interface only
- **State Department FOIA Virtual Reading Room** — [foia.state.gov](https://foia.state.gov)
  - Cables, diplomatic correspondence, post-1990 partial digitization

### Canada 🟡
- **Library and Archives Canada** — [bac-lac.gc.ca](https://www.bac-lac.gc.ca)
  - Cold War-era RCMP files, Cabinet Conclusions back to 1944
  - Structured finding aids, some API access

### Argentina 🟡⭐
- **CONADEP — Nunca Más Archive** — digitized
  - State terrorism records 1976–1983 (military dictatorship)
- **Memory, Truth and Justice Archive** — desaparecidos documentation
  - Structurally complete; access via Argentine government portals

### Brazil 🟡⭐
- **National Archive (AN)** — [an.gov.br](https://www.an.gov.br)
  - Military dictatorship era (1964–1985)
  - Digitized via **Memórias Reveladas** project

### Chile 🟡⭐
- **Rettig Commission documents** — partially digitized
  - Human rights violations under Pinochet
- **Valech Commission (political prisoners)** — structured data
  - 40,000+ detainee records, torture documentation

### Guatemala 🟢⭐
- **Historical Archive of the National Police (AHPN)** — [ahpn.lib.utexas.edu](https://ahpn.lib.utexas.edu)
  - ~80 million pages, fully digitized
  - Hosted via University of Texas
  - **One of the most complete digitized police archives in the world**
  - Police records covering civil war era and genocide documentation

### Mexico 🟡
- **AGN (National General Archive)** — [gob.mx/agn](https://www.gob.mx/agn)
  - Dirección Federal de Seguridad (secret police) files — partially available
  - "Dirty War" era documentation

---

## Europe — Western

### United Kingdom 🟢⭐
- **National Archives Discovery API** — [nationalarchives.gov.uk](https://www.nationalarchives.gov.uk)
  - Collections: CAB (Cabinet minutes to 1970s), FCO (Foreign Office), PREM (PM files), MI5/MI6 released files
  - **Excellent structured API** — one of the best in the world
  - *Legislation already shipped (`uk_legislation_v1`); vote enrichment complete*

### Germany 🟢⭐
- **Bundesarchiv-BStU (Stasi Records)** — [bstu.de](https://www.bstu.de)
  - East German secret police records — ~111 km of files, partially digitized
  - **One of the largest declassified intelligence archives in the world**
  - Searchable online database
- **Bundesarchiv (Federal Archives)** — [bundesarchiv.de](https://www.bundesarchiv.de)
  - Federal records 1945–present; WWII-era documentation

### France 🟡
- **Archives nationales** — [archives-nationales.culture.gouv.fr](https://www.archives-nationales.culture.gouv.fr)
  - Limited API; WWII-era and colonial records partially digitized
- **SHAT (Service Historique de la Défense)** — military archives
  - Colonial war documentation; partially accessible

### Italy 🟡
- **Archivio Centrale dello Stato** — [acs.beniculturali.it](https://www.acs.beniculturali.it)
  - Finding aids online; limited structured data
  - Fascism-era documentation, postwar republic records

### Netherlands 🟡
- **Nationaal Archief** — [nationaalarchief.nl](https://www.nationaalarchief.nl)
  - Reasonable online finding aids
  - Colonial-era records (Dutch East Indies), WWII occupation

### Spain 🟡⭐
- **Centro Documental de la Memoria Histórica** — [culturaydeporte.gob.es/memoriademocratica](https://www.culturaydeporte.gob.es/memoriademocratica)
  - Spanish Civil War and Franco dictatorship records — digitized
- **AGA (General Administration Archive)** — broad government records

### Portugal 🟡⭐
- **PIDE/DGS records (Torre do Tombo)** — [digitarq.arquivos.pt](https://digitarq.arquivos.pt)
  - Secret police under Salazar; files now in national archive
  - Partially digitized — Estado Novo era (1933–1974)

### Switzerland 🟡
- **Swiss Federal Archives** — [bar.admin.ch](https://www.bar.admin.ch)
  - Cold War neutrality documentation; WWII-era financial records
  - Some records pertaining to Nazi gold, Red Cross operations

---

## Europe — Eastern (Highest value for Cold War)

### Poland 🟢⭐
- **IPN (Institute of National Remembrance)** — [ipn.gov.pl](https://ipn.gov.pl)
  - **Best structured API in Eastern Europe**
  - Communist-era Security Bureau (SB) files; directly searchable
  - Martial law (1981), Solidarity, postwar Stalinist terror

### Czech Republic 🟢⭐
- **ABS (Security Services Archive)** — [abscr.cz](https://www.abscr.cz)
  - StB (Czechoslovak secret police) files
  - Structured online database — searchable by name and event

### Slovakia 🟡
- **UPN (Nation's Memory Institute)** — [upn.gov.sk](https://www.upn.gov.sk)
  - Similar structure to ABS; overlapping era coverage

### Hungary 🟡⭐
- **ÁBTL (Historical Archives of the Hungarian State Security)** — [abtl.hu](https://www.abtl.hu)
  - AVO/ÁVH secret police records; 1956 revolution documentation
  - Partially digitized; searchable finding aids
- **MNL (National Archives)** — broader government records

### Romania 🟡⭐
- **CNSAS (Council for the Study of Securitate Archives)** — [cnsas.ro](https://www.cnsas.ro)
  - Securitate (Ceaușescu-era secret police) files
  - Searchable online database

### Bulgaria 🔴
- **State Agency for National Security archives**
  - Partially released; limited structured access
  - DS (secret police) files from communist era

### East Germany (GDR) — see Bundesarchiv-BStU above ⭐

### Ukraine 🟡⭐
- **SBU (Security Service) Archive** — [sbu.gov.ua](https://www.sbu.gov.ua)
  - KGB files transferred post-1991; significant releases post-2014 and post-2022
  - Holodomor documentation, Soviet-era political repressions
  - *Access currently complicated by ongoing war*

### Baltic States 🟡⭐
- **Estonia** — [vabamu.ee](https://www.vabamu.ee) + VABABAD database
  - KGB occupation-era files; well-digitized
  - Estonian VABABAD database covers Soviet-era political repression
- **Latvia** — [lna.gov.lv](https://www.lna.gov.lv) — KGB files, partially accessible
- **Lithuania** — [genocid.lt](https://www.genocid.lt) — Genocide and Resistance Research Centre

---

## Cold War Supranational Archives ⭐⭐⭐

### Wilson Center Digital Archive (CWIHP) 🟢⭐⭐⭐
- **URL:** [digitalarchive.wilsoncenter.org](https://digitalarchive.wilsoncenter.org)
- **Status in ROADMAP:** P110 — script built (`ingest-wilson-center.ts`), dry-run blocked by DNS failure. Retry pending.
- **Coverage (Soviet + partner bloc primary sources, translated to English):**
  - Soviet Politburo and CPSU records
  - Warsaw Pact documents
  - Cuban Missile Crisis (Soviet + Cuban side)
  - Korean War (Chinese/Soviet perspective)
  - Vietnam War (North Vietnamese/Soviet/Chinese records)
  - Hungarian Revolution 1956
  - Prague Spring 1968
  - Polish Solidarity 1980–81
  - Cold War Sino-Soviet split
  - Yom Kippur War, Angola, Ethiopia/Ogaden
- **Why it matters:** primary source documents translated into English from Russian, Chinese, East German, Cuban, etc. archives — the definitive Cold War primary source hub.

### Parallel History Project (PHP) 🟡⭐
- **URL:** [php.isn.ethz.ch](http://www.php.isn.ethz.ch) (ETH Zurich)
- Warsaw Pact military planning documents
- Simultaneous NATO + Warsaw Pact perspectives
- Declassified together by both alliance archives

---

## Asia

### China 🔴
- **No open national archive** — provincial archives partially accessible in person
- **Wilson Center** covers Chinese Communist Party documents via partner translations (see above)
- **Taiwan (ROC) National Archives** — [archives.gov.tw](https://www.archives.gov.tw)
  - Good digital access; ROC-era records, some cross-strait documentation

### Japan 🟢⭐
- **JACAR (Japan Center for Asian Historical Records)** — [jacar.archives.go.jp](https://www.jacar.archives.go.jp)
  - **Excellent structured API**
  - WWII military records, colonial administration, diplomatic cables
  - **One of the best-structured Asian archives in the world**

### South Korea 🟡
- **National Archives of Korea** — [archives.go.kr](https://www.archives.go.kr)
  - Some English-language finding aids
  - Korean War-era documents, democratization records

### India 🔴
- **National Archives of India** — [nationalarchives.nic.in](https://nationalarchives.nic.in)
  - Limited digital access; mainly accessible on-site in New Delhi
  - Post-independence government records, partition documentation

---

## Ingestion Priority Notes

| Archive | Access | Editorial value | Next step |
|---------|--------|----------------|-----------|
| Wilson Center CWIHP | 🟢 API | ⭐⭐⭐ | Retry DNS; `ingest-wilson-center.ts` exists |
| NARA | 🟡 Semi | ⭐⭐⭐ | Script needed; no bulk API |
| Bundesarchiv-BStU (Stasi) | 🟢 DB | ⭐⭐ | Script needed; name-search API |
| IPN Poland | 🟢 API | ⭐⭐ | Script needed |
| JACAR Japan | 🟢 API | ⭐⭐ | Script needed |
| AHPN Guatemala | 🟢 UT-hosted | ⭐⭐ | Script needed |
| ABS Czech | 🟢 DB | ⭐⭐ | Script needed |
| CNSAS Romania | 🟡 DB | ⭐ | Script needed |
| ÁBTL Hungary | 🟡 Partial | ⭐ | Script needed |
| CIA Reading Room | 🔴 Search only | ⭐⭐ | Manual; no bulk path |

---

## Reference-Tier Test

Per `AGENTS.md` rule: before building a bulk ingest for any of these, ask: *of the next 20 case studies that cite this archive, would individual records be directly cited, or would case studies cite analyses and curated collections?*

- **Wilson Center CWIHP** → individual documents would be cited directly (e.g. "Soviet Politburo minutes, Oct 22 1962") → **reference-tier → build ingest**
- **NARA bulk** → case studies would cite specific document series, not individual boxes → **background-tier → add as Sources within case studies**
- **CIA Reading Room** → specific MKULTRA documents would be cited directly → **reference-tier → build if bulk API exists**
