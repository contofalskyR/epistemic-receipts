# AA-1 primary-source verification (hand checks, 2026-07-11)

Per AGENTS.md's "curated lists require verifiable sources" rule, every source
used in the proposed transitions was checked against a live fetch or search
result during this session — not recalled from training data. One correction
was caught in the process (see check 1).

## 1. Müller 1939 — DOI/URL (⚠️ brief's guess was wrong, corrected)

- **Claim:** Franz H. Müller, "Tabakmissbrauch und Lungencarcinom," Zeitschrift
  für Krebsforschung 49 (1939): 57–85.
- **Worker brief's suggested URL** (`https://link.springer.com/article/10.1007/BF01623984`)
  **does not resolve to this article** — that DOI prefix pattern was a guess.
- **Verified DOI:** `10.1007/BF01633114` — confirmed via web search hit titled
  "Tabakmißbrauch und Lungencarcinom | Journal of Cancer Research and Clinical
  Oncology | Springer Nature Link" at
  https://link.springer.com/article/10.1007/BF01633114, and independently
  confirmed via the citation given in the open-access commentary at
  https://pmc.ncbi.nlm.nih.gov/articles/PMC3640840/ ("Mueller F. Tabakmissbrauch
  und Lungencarcinom. Z. Krebsforsch. 1939;49:57–85" — submitted Dec 24, 1938,
  published 1939).
- **Used in script as:** `src:muller-krebsforsch-1939`,
  `url: 'https://link.springer.com/article/10.1007/BF01633114'`.

## 2. Surgeon General 1964 — archive URL

- **Claim:** "Smoking and Health: Report of the Advisory Committee to the
  Surgeon General of the Public Health Service," issued January 11, 1964.
- **Verified URL:** https://profiles.nlm.nih.gov/spotlight/nn/catalog/nlm:nlmuid-101584932X202-doc
  — appeared verbatim in web search results as "Smoking and Health - Reports
  of the Surgeon General - Profiles in Science" (NLM's own Profiles in Science
  archive). Corroborating detail confirmed by search: "the report was issued
  on January 11, 1964, and the committee reviewed more than 7,000 scientific
  articles with the help of over 150 consultants."
- This is the **same URL already used** for `src:surgeon-general-1964` in
  `scripts/seed-trajectories.ts` (line ~106) and for `src7` in the existing
  (unmodified) part of `scripts/seed-smoking-cancer.ts` (line ~176) — internally
  consistent, not a new guess.

## 3. Doll & Hill 1950 — DOI + citation

- **Claim:** Doll R, Hill AB. "Smoking and carcinoma of the lung; preliminary
  report." BMJ 1950;2(4682):739–748.
- **Verified DOI:** `10.1136/bmj.2.4682.739` (matches the brief exactly).
- **Verified date:** published September 30, 1950 — matches the `publishedAt`
  already used for `src1`/`src:doll-hill-bmj-1950` in the existing scripts.
- **PMC copy confirmed reachable:** https://www.ncbi.nlm.nih.gov/pmc/articles/PMC2038856/
  (PMCID PMC2038856), returned directly in search results.

## 4. 1954 "A Frank Statement to Cigarette Smokers" — archive location

- **Claim:** industry-wide newspaper ad, published January 4, 1954, reaching
  ~43 million readers across 400+ newspapers, marking the start of the
  organized doubt campaign.
- **Verified archive:** UCSF Truth Tobacco Industry Documents Library —
  https://www.industrydocuments.ucsf.edu/docs/#id=fxmh0055 (catalog entry,
  Lorillard Records collection) and the scanned original at
  https://download.industrydocuments.ucsf.edu/y/t/v/n/ytvn0058/ytvn0058.pdf.
  Date and reach corroborated by search snippet ("published on January 4,
  1954... reached an estimated 43 million people through more than 400
  newspapers").
- **Not currently used in the proposed transitions** (no CONTESTED phase was
  re-inserted — see diagnosis.md's rationale) but confirmed here in case
  Robert wants a MetaEdge on either whitepaper claim later, mirroring the
  existing `src13`/MetaEdge-1 pattern in `seed-smoking-cancer.ts`.

## 5. Tobacco Master Settlement Agreement (1998) — reused source

- **Claim:** MSA between 46 state AGs and major tobacco companies, signed
  November 23, 1998.
- **URL reused as-is** from the existing, unmodified `src8` in
  `seed-smoking-cancer.ts` and `src:tobacco-msa-1998` in
  `seed-trajectories.ts`: https://www.naag.org/our-work/naag-center-for-tobacco-and-public-health/the-master-settlement-agreement/.
  Not re-fetched this session (already load-bearing, unchanged, existing
  production data) — flagged here only for completeness of the transition
  chain's provenance.

## Not independently re-verified this session

- `src:doll-hill-bmj-1950`, `src:surgeon-general-1964`, `src:tobacco-msa-1998`
  Source **name/publishedAt fields** are reused verbatim from
  `seed-trajectories.ts` rather than re-typed — if that script's data is
  wrong, this inherits the error. Since `emitTransition`'s Source upsert never
  clobbers an existing row (`update: {}`), whatever is already in the DB under
  those `externalId`s wins over what's in this script regardless.
