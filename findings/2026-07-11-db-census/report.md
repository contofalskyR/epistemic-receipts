# DB census — corpus & arc numbers (live Neon DB)

Generated: 2026-07-12T00:45:48.261Z · read-only · aggregate-only

Regenerate with:

```bash
cd ~/Projects/epistemic-receipts && bash findings/2026-07-11-db-census/run-census.sh
# then rebuild report.md + data.csv from raw/:
python3 findings/2026-07-11-db-census/assemble.py findings/2026-07-11-db-census/raw findings/2026-07-11-db-census
```

All numbers below are COUNTs/GROUP BYs from the live DB. Basis: `deleted = false` unless noted. 
Machine-readable copy of every figure: `data.csv`.

## 1. Claims

- **Total live claims:** 1,757,943
- Excl. DEPRECATED: 1,757,761 (DEPRECATED: 182)
- Soft-deleted (excluded everywhere): 21

### 1.1 By verificationStatus (incl. NULL)

| verificationStatus | claims |
|---|---:|
| VERIFIED | 1,386,803 |
| PROVISIONAL | 220,686 |
| NULL | 138,010 |
| DISPUTED | 11,319 |
| HARD_FACT | 943 |
| DEPRECATED | 182 |

### 1.2 By source category (SOURCE_REGISTRY rollup, site basis: excl. DEPRECATED)

| category | sources (tags) | claims |
|---|---:|---:|
| US Federal Government | 18 | 490,768 |
| Science & Medicine | 26 | 488,285 |
| National Parliaments / Legislation | 86 | 405,642 |
| Pharmaceutical & Health | 10 | 147,880 |
| International Organizations | 12 | 134,485 |
| Archives & Historical | 8 | 69,074 |
| Courts & Legal | 14 | 15,956 |
| Editorial / Curated | 10 | 5,580 |
| _Unmapped tags (2)_ | 2 | 91 |

Unmapped ingestedBy tags (not in SOURCE_REGISTRY): `event:exoplanet_retractions_v1` (75), `book-analysis:cmppvaz700000sal1cnyfutdx` (16)

### 1.3 By ingestedBy (top 20 of full list — complete distribution in data.csv)

| ingestedBy | claims |
|---|---:|
| openalex_v1 | 318,775 |
| nara_catalog_v1 | 308,051 |
| voteview_v1 | 113,319 |
| openfda_labels_v1 | 85,068 |
| hungary_legislation_v1 | 69,441 |
| chebi_v1 | 62,000 |
| worldbank_v1 | 54,567 |
| drugsatfda_v1 | 46,255 |
| jacar_v1 | 44,600 |
| who_gho_v1 | 33,714 |
| crossref_retractions_v1 | 26,624 |
| argentina_legislation_v1 | 25,824 |
| openalex_journals_v1 | 25,687 |
| czech_legislation_v1 | 24,173 |
| vdem_v1 | 19,777 |
| ofac_sdn_v1 | 19,034 |
| congress_bills_tracker_v1 | 17,280 |
| italy_legislation_v1 | 16,934 |
| chile_legislation_v1 | 15,889 |
| rxnorm_v1 | 14,632 |

## 2. Curves (ClaimStatusHistory)

History rows: 1,821,999 across 1,579,951 distinct claims (incl. deleted/deprecated parents).

Population below: live claims, excl. DEPRECATED.

| metric | all claims | curated `trajectory:*` |
|---|---:|---:|
| claims with any history | 1,579,930 | 5,557 |
| multi-step (≥2 transitions) | 241,084 | 5,210 |
| **spanning >1 distinct date (real movement)** | 34,292 | 5,068 |
| multi-community (>1 community) | 3,333 | 3,203 |
| **followable arcs** | 3,516 | 3,381 |
| &nbsp;&nbsp;… via ≥3 transitions | 881 | 763 |
| &nbsp;&nbsp;… via 2 transitions + >1 date + >1 community | 2,635 | 2,618 |

Followable arc = ≥3 transitions, OR ≥2 transitions spanning >1 distinct date AND >1 community.

### 2.1 Transition-count distribution (live claims with history)

| transitions | claims |
|---|---:|
| 1 | 1,338,846 |
| 2 | 240,203 |
| 3 | 831 |
| 4 | 46 |
| 5 | 3 |
| 6 | 1 |

### 2.2 Top transitions (full ClaimStatusHistory)

| from → to | rows |
|---|---:|
| ∅ → RECORDED | 1,070,939 |
| ∅ → SETTLED | 495,993 |
| RECORDED → SETTLED | 209,983 |
| RECORDED → REVERSED | 29,392 |
| ∅ → REVERSED | 12,781 |
| SETTLED → REVERSED | 903 |
| RECORDED → CONTESTED | 432 |
| CONTESTED → SETTLED | 323 |
| SETTLED → CONTESTED | 316 |
| SETTLED → SETTLED | 233 |
| ∅ → CONTESTED | 164 |
| CONTESTED → REVERSED | 139 |

## 3. Reversal / retraction / court arcs

- Claims with a REVERSED transition: **43,214**
  - by community: EXPERT_LITERATURE 38,183, INSTITUTIONAL 4,914, JUDICIAL 97, MARKET 16, PUBLIC 14 (per-community distinct counts sum to 43,224; 10 claim(s) reversed in >1 community)
- Retraction pairs (RECORDED→REVERSED, EXPERT_LITERATURE): total 29,292, valid survival>0: 28,330, indeterminate: 962
  - cross-check via scripts/test-curve-stats.ts: total 29,292, valid 28,330, indeterminate 962
- Court-reversal arcs: JUDICIAL claims with REVERSED transition **97** (SETTLED→REVERSED: 68); `seed-court-reversals` claims: 8

## 4. Seeded trajectories by seed tag

| tag | claims | with history |
|---|---:|---:|
| seed:human-history-trajectories | 3,465 | 3,465 |
| seed:medicine-trajectories | 1,782 | 1,782 |
| law-settler | 189 | 189 |
| seed:astronomy-trajectories | 32 | 32 |
| seed:nutrition-trajectories | 30 | 30 |
| seed:climate-trajectories | 30 | 30 |
| seed-trajectories | 11 | 11 |
| seed:historical-trajectories | 10 | 10 |
| seed-court-reversals | 8 | 8 |

## 5. Curated trajectory corpus (corpus-analysis.ts)

- Curated `trajectory:*` claims: 5,557
- Avg depth: 2.084 transitions; detour rate 13.73%; contestation rate 14.09%
- Reversal rate among ever-SETTLED: 3.72% (186/5,005)
- Median settlement velocity: 6.6 years (n=4,064)
- Endpoint distribution: SETTLED 4,610, REVERSED 470, CONTESTED 313, RECORDED 128, ABANDONED 28, UNRESOLVABLE 4, OPEN 4

## 6. Curve coverage (census-dateless-claims.ts)

- TOTAL curve-less: 177,831 claims (177,771 dateless, 60 dated-but-untemplated)

| pipeline | noHistory | dateless | dated-untemplated |
|---|---:|---:|---:|
| nara_catalog_v1 | 91,788 | 91,788 | 0 |
| chebi_v1 | 36,591 | 36,591 | 0 |
| jacar_v1 | 30,767 | 30,767 | 0 |
| rxnorm_v1 | 14,632 | 14,632 | 0 |
| omim_v1 | 1,512 | 1,512 | 0 |
| ofac_sdn_v1 | 1,311 | 1,311 | 0 |
| pubchem_v1 | 355 | 355 | 0 |
| impact_craters_v1 | 214 | 214 | 0 |
| wikidata_chips_v1 | 132 | 132 | 0 |
| periodic_table_v1 | 119 | 119 | 0 |
| africanlii_v1 | 70 | 70 | 0 |
| paclii_legislation_v1 | 64 | 64 | 0 |

## 7. Chain integrity (audit-chain-integrity.ts, read mode)

    Scope: 1,579,930 claims, 1,821,950 transitions.
    E1  entry-row count ≠ 1 … ✓ 0  (3.9s)
    C1  chain break (fromAxis ≠ prior toAxis) … 5  (21.7s)
    C2  seq inconsistency (partial stamp / non-contiguous / not 1..n) … ✓ 0  (2.7s)
    D2  non-entry row precedes claimEmergedAt beyond its precision (warning) … 270  (2.1s)
    S1  sourceId does not resolve to a Source … ✓ 0  (1.0s)
    A1  degenerate row (same axis AND same community as prior) … 143  (7.3s)
    V1  axis value outside FactStatus vocabulary … ✓ 0  (0.5s)
    148 hard violations, 270 warnings.

## 8. Top-line table counts (_db-quick-check.ts)

| table/metric | count |
|---|---:|
| Claims (live) | 1,757,943 |
| Claims (deleted) | 21 |
| Edges (live) | 1,718,420 |
| Sources (live) | 1,686,671 |
| Books | 7 |
| LegislativeVotes | 140,491 |
| Polities | 2,361 |
| HistoricalEvents | 9 |
| Claims with NULL verificationStatus | 138,010 |
| Claims with no Edge | 46,589 |
| Duplicate externalIds | 0 |
| Sources with no Edge | 30,285 |

---
Raw script outputs: `raw/` (kept local to the repo). Person-bearing tables were only ever COUNTed; no row-level records appear in this report or data.csv.
