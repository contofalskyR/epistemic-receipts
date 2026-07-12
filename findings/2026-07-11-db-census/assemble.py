#!/usr/bin/env python3
"""Assemble findings/2026-07-11-db-census/{report.md,data.csv} from raw/*.out.

Input: raw/ dir with the census outputs. Aggregate numbers only — no row-level
records are read or emitted."""
import json, csv, re, sys, os
from pathlib import Path

RAW = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("raw")
OUT = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(".")

def jload(name):
    p = RAW / name
    if not p.exists(): return None
    txt = p.read_text()
    # tolerate trailing non-JSON lines (corpus-analysis prints a footer)
    start = txt.find("{")
    if start < 0: return None
    depth = 0; end = None
    for i, ch in enumerate(txt[start:], start):
        if ch == "{": depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0: end = i + 1; break
    try: return json.loads(txt[start:end])
    except Exception: return None

agg   = jload("census-aggregates.out")
cstat = jload("corpus-stats.out")
quick = jload("db-quick-check.out")
cana  = jload("corpus-analysis.out")

if not agg:
    sys.exit("census-aggregates.out missing or unparseable — cannot assemble")

# --- text extracts -----------------------------------------------------------
def head_lines(name, n):
    p = RAW / name
    return p.read_text().splitlines()[:n] if p.exists() else []

# test-curve-stats: only TASK 1 aggregate lines
tcs = {}
for ln in head_lines("test-curve-stats.out", 12):
    m = re.match(r"^(total|valid|indeterminate):\s*(\d+)", ln.strip())
    if m: tcs[m.group(1)] = int(m.group(2))

# census-dateless: headline + per-pipeline aggregate rows
dateless_head, dateless_rows = None, []
p = RAW / "census-dateless.out"
if p.exists():
    for ln in p.read_text().splitlines():
        if ln.startswith("TOTAL curve-less:"): dateless_head = ln.strip()
        m = re.match(r"^(\S+)\s+noHistory\s+([\d,]+)\s+·\s+dateless\s+([\d,]+)\s+·\s+dated-untemplated\s+([\d,]+)", ln.strip())
        if m:
            dateless_rows.append({"pipeline": m.group(1),
                                  "noHistory": int(m.group(2).replace(",", "")),
                                  "dateless": int(m.group(3).replace(",", "")),
                                  "datedUntemplated": int(m.group(4).replace(",", ""))})

# chain-integrity: per-check counts (text scrape, counts only)
chain_lines = []
p = RAW / "chain-integrity.out"
if p.exists():
    for ln in p.read_text().splitlines():
        # summary lines ONLY (never the per-row violation examples):
        #   "  E1  entry-row count != 1 ... 0  (3.9s)"  /  "Scope: ..."  /  "N hard violations, M warnings."
        if re.match(r"^\s*(E1|C1|C2|D2|S1|A1|V1)\s{2}", ln) and "\u2026" in ln:
            chain_lines.append(ln.strip())
        elif re.match(r"^Scope:", ln.strip()) or re.search(r"hard violations", ln):
            chain_lines.append(ln.strip())

# --- data.csv ----------------------------------------------------------------
rows = []
def add(section, dimension, key, value):
    rows.append({"section": section, "dimension": dimension, "key": key, "value": value})

c = agg["claims"]
add("claims", "totals", "total_live", c["total_live"])
add("claims", "totals", "total_live_excl_deprecated", c["total_live_excl_deprecated"])
add("claims", "totals", "deprecated_live", c["deprecated_live"])
add("claims", "totals", "deleted", c["deleted"])
for r in agg["by_verification_status"]:
    add("claims", "by_verification_status", r["status"], r["count"])
for r in agg["by_source_category"]:
    add("claims", "by_source_category", r["category"], r["claims"])
    add("claims", "sources_per_category", r["category"], r["sources"])
for r in agg.get("source_category_unmapped", []):
    add("claims", "by_source_category_unmapped", r["tag"], r["count"])
for r in agg["by_ingested_by"]:
    add("claims", "by_ingested_by", r["tag"], r["count"])
for k, v in agg["curves_all"].items():
    add("curves", "all_claims", k, v)
for k, v in agg["curves_curated_trajectory_subset"].items():
    add("curves", "curated_trajectory_subset", k, v)
for r in agg["transition_count_distribution"]:
    add("curves", "transition_count_distribution", r["transitions"], r["claims"])
ht = agg["history_totals"]
add("curves", "history_totals", "rows", ht["rows"])
add("curves", "history_totals", "distinct_claims", ht["distinct_claims"])
for r in agg["transition_matrix_top25"]:
    add("curves", "transition_matrix", f"{r['from']}->{r['to']}", r["count"])
ra = agg["reversal_arcs"]
add("arcs", "reversal", "claims_with_reversed_transition", ra["claims_with_reversed_transition"])
for r in ra["by_community"]:
    add("arcs", "reversed_by_community", r["community"], r["claims"])
rp = ra["retraction_pairs_expert_literature"]
for k, v in rp.items():
    add("arcs", "retraction_pairs_expert_literature", k, v)
for k, v in ra["court_reversals"].items():
    add("arcs", "court_reversals", k, v)
for r in agg["seeded_trajectories"]:
    add("seeds", r["tag"], "claims", r["claims"])
    add("seeds", r["tag"], "with_history", r["with_history"])
s = agg["sources"]
add("sources", "totals", "total_live", s["total_live"])
for r in s["by_methodology_type"]:
    add("sources", "by_methodology_type", r["type"], r["count"])
if quick:
    for k in ("claims","deletedClaims","edges","sources","books","votes","polities","historicalEvents","nullVerification","orphanedClaims","dupExternalIds","sourcesNoEdge"):
        if k in quick: add("db_quick_check", "totals", k, quick[k])
if tcs:
    for k, v in tcs.items(): add("arcs", "test_curve_stats_task1", k, v)
if cstat:
    add("trajectory_subset", "totals", "curated_trajectory_claims", cstat.get("total"))
if cana:
    for k in ("total_trajectories","avg_depth","reversal_rate_pct","ever_settled_n","ever_reversed_after_settle_n",
              "contestation_rate_pct","detour_rate_pct","settlement_velocity_median_years","settlement_velocity_n"):
        if k in cana: add("trajectory_subset", "corpus_analysis", k, cana[k])
    for k, v in (cana.get("endpoint_distribution") or {}).items():
        add("trajectory_subset", "endpoint_distribution", k, v)
for r in dateless_rows:
    add("coverage", "curveless_by_pipeline_noHistory", r["pipeline"], r["noHistory"])

with open(OUT / "data.csv", "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=["section", "dimension", "key", "value"])
    w.writeheader(); w.writerows(rows)

# --- report.md ---------------------------------------------------------------
def fmt(n):
    return f"{n:,}" if isinstance(n, (int, float)) and n == int(n) else str(n)

L = []
A = L.append
A("# DB census — corpus & arc numbers (live Neon DB)")
A("")
A(f"Generated: {agg.get('generatedAt', 'unknown')} · read-only · aggregate-only")
A("")
A("Regenerate with:")
A("")
A("```bash")
A("cd ~/Projects/epistemic-receipts && bash findings/2026-07-11-db-census/run-census.sh")
A("# then rebuild report.md + data.csv from raw/:")
A("python3 findings/2026-07-11-db-census/assemble.py findings/2026-07-11-db-census/raw findings/2026-07-11-db-census")
A("```")
A("")
A("All numbers below are COUNTs/GROUP BYs from the live DB. Basis: `deleted = false` unless noted. ")
A("Machine-readable copy of every figure: `data.csv`.")
A("")
A("## 1. Claims")
A("")
A(f"- **Total live claims:** {fmt(c['total_live'])}")
A(f"- Excl. DEPRECATED: {fmt(c['total_live_excl_deprecated'])} (DEPRECATED: {fmt(c['deprecated_live'])})")
A(f"- Soft-deleted (excluded everywhere): {fmt(c['deleted'])}")
A("")
A("### 1.1 By verificationStatus (incl. NULL)")
A("")
A("| verificationStatus | claims |")
A("|---|---:|")
for r in agg["by_verification_status"]:
    A(f"| {r['status']} | {fmt(r['count'])} |")
A("")
A("### 1.2 By source category (SOURCE_REGISTRY rollup, site basis: excl. DEPRECATED)")
A("")
A("| category | sources (tags) | claims |")
A("|---|---:|---:|")
for r in agg["by_source_category"]:
    A(f"| {r['category']} | {r['sources']} | {fmt(r['claims'])} |")
un = agg.get("source_category_unmapped", [])
if un:
    A(f"| _Unmapped tags ({len(un)})_ | {len(un)} | {fmt(sum(u['count'] for u in un))} |")
A("")
if un:
    A("Unmapped ingestedBy tags (not in SOURCE_REGISTRY): " + ", ".join(f"`{u['tag']}` ({fmt(u['count'])})" for u in un[:12]) + ("…" if len(un) > 12 else ""))
    A("")
A("### 1.3 By ingestedBy (top 20 of full list — complete distribution in data.csv)")
A("")
A("| ingestedBy | claims |")
A("|---|---:|")
for r in agg["by_ingested_by"][:20]:
    A(f"| {r['tag']} | {fmt(r['count'])} |")
A("")
A("## 2. Curves (ClaimStatusHistory)")
A("")
ca = agg["curves_all"]; ct = agg["curves_curated_trajectory_subset"]
A(f"History rows: {fmt(ht['rows'])} across {fmt(ht['distinct_claims'])} distinct claims (incl. deleted/deprecated parents).")
A("")
A("Population below: live claims, excl. DEPRECATED.")
A("")
A("| metric | all claims | curated `trajectory:*` |")
A("|---|---:|---:|")
A(f"| claims with any history | {fmt(ca['claims_with_history'])} | {fmt(ct['claims_with_history'])} |")
A(f"| multi-step (≥2 transitions) | {fmt(ca['multi_step'])} | {fmt(ct['multi_step'])} |")
A(f"| **spanning >1 distinct date (real movement)** | {fmt(ca['span_gt1_date'])} | {fmt(ct['span_gt1_date'])} |")
A(f"| multi-community (>1 community) | {fmt(ca['multi_community'])} | {fmt(ct['multi_community'])} |")
A(f"| **followable arcs** | {fmt(ca['followable'])} | {fmt(ct['followable'])} |")
A(f"| &nbsp;&nbsp;… via ≥3 transitions | {fmt(ca['followable_via_3plus'])} | {fmt(ct['followable_via_3plus'])} |")
A(f"| &nbsp;&nbsp;… via 2 transitions + >1 date + >1 community | {fmt(ca['followable_via_2span_multicommunity'])} | {fmt(ct['followable_via_2span_multicommunity'])} |")
A("")
A("Followable arc = ≥3 transitions, OR ≥2 transitions spanning >1 distinct date AND >1 community.")
A("")
A("### 2.1 Transition-count distribution (live claims with history)")
A("")
A("| transitions | claims |")
A("|---|---:|")
for r in agg["transition_count_distribution"]:
    A(f"| {r['transitions']} | {fmt(r['claims'])} |")
A("")
A("### 2.2 Top transitions (full ClaimStatusHistory)")
A("")
A("| from → to | rows |")
A("|---|---:|")
for r in agg["transition_matrix_top25"][:12]:
    A(f"| {r['from']} → {r['to']} | {fmt(r['count'])} |")
A("")
A("## 3. Reversal / retraction / court arcs")
A("")
A(f"- Claims with a REVERSED transition: **{fmt(ra['claims_with_reversed_transition'])}**")
_bycomm_sum = sum(r["claims"] for r in ra["by_community"])
_overlap = _bycomm_sum - ra["claims_with_reversed_transition"]
_overlap_note = f" (per-community distinct counts sum to {fmt(_bycomm_sum)}; {fmt(_overlap)} claim(s) reversed in >1 community)" if _overlap else ""
A("  - by community: " + ", ".join(f"{r['community']} {fmt(r['claims'])}" for r in ra["by_community"]) + _overlap_note)
A(f"- Retraction pairs (RECORDED→REVERSED, EXPERT_LITERATURE): total {fmt(rp['total'])}, "
  f"valid survival>0: {fmt(rp['valid_positive_survival'])}, indeterminate: {fmt(rp['indeterminate'])}")
if tcs:
    A(f"  - cross-check via scripts/test-curve-stats.ts: total {fmt(tcs.get('total'))}, valid {fmt(tcs.get('valid'))}, indeterminate {fmt(tcs.get('indeterminate'))}")
cr = ra["court_reversals"]
A(f"- Court-reversal arcs: JUDICIAL claims with REVERSED transition **{fmt(cr['judicial_reversed_claims'])}** "
  f"(SETTLED→REVERSED: {fmt(cr['judicial_settled_to_reversed_claims'])}); "
  f"`seed-court-reversals` claims: {fmt(cr['seed_court_reversals_claims'])}")
A("")
A("## 4. Seeded trajectories by seed tag")
A("")
A("| tag | claims | with history |")
A("|---|---:|---:|")
for r in agg["seeded_trajectories"]:
    A(f"| {r['tag']} | {fmt(r['claims'])} | {fmt(r['with_history'])} |")
A("")
if cana:
    A("## 5. Curated trajectory corpus (corpus-analysis.ts)")
    A("")
    A(f"- Curated `trajectory:*` claims: {fmt(cana.get('total_trajectories'))}")
    A(f"- Avg depth: {cana.get('avg_depth')} transitions; detour rate {cana.get('detour_rate_pct')}%; contestation rate {cana.get('contestation_rate_pct')}%")
    A(f"- Reversal rate among ever-SETTLED: {cana.get('reversal_rate_pct')}% ({fmt(cana.get('ever_reversed_after_settle_n'))}/{fmt(cana.get('ever_settled_n'))})")
    A(f"- Median settlement velocity: {cana.get('settlement_velocity_median_years')} years (n={fmt(cana.get('settlement_velocity_n'))})")
    ep = cana.get("endpoint_distribution") or {}
    if ep:
        A("- Endpoint distribution: " + ", ".join(f"{k} {fmt(v)}" for k, v in sorted(ep.items(), key=lambda kv: -kv[1])))
    A("")
if dateless_head or dateless_rows:
    A("## 6. Curve coverage (census-dateless-claims.ts)")
    A("")
    if dateless_head: A(f"- {dateless_head}")
    A("")
    if dateless_rows:
        A("| pipeline | noHistory | dateless | dated-untemplated |")
        A("|---|---:|---:|---:|")
        for r in dateless_rows:
            A(f"| {r['pipeline']} | {fmt(r['noHistory'])} | {fmt(r['dateless'])} | {fmt(r['datedUntemplated'])} |")
        A("")
if chain_lines:
    A("## 7. Chain integrity (audit-chain-integrity.ts, read mode)")
    A("")
    for ln in chain_lines[:20]: A(f"    {ln}")
    A("")
if quick:
    A("## 8. Top-line table counts (_db-quick-check.ts)")
    A("")
    A("| table/metric | count |")
    A("|---|---:|")
    label = {"claims":"Claims (live)","deletedClaims":"Claims (deleted)","edges":"Edges (live)","sources":"Sources (live)",
             "books":"Books","votes":"LegislativeVotes","polities":"Polities","historicalEvents":"HistoricalEvents",
             "nullVerification":"Claims with NULL verificationStatus","orphanedClaims":"Claims with no Edge",
             "dupExternalIds":"Duplicate externalIds","sourcesNoEdge":"Sources with no Edge"}
    for k, lab in label.items():
        if k in quick: A(f"| {lab} | {fmt(quick[k])} |")
    A("")
A("---")
A("Raw script outputs: `raw/` (kept local to the repo). Person-bearing tables were only ever COUNTed; no row-level records appear in this report or data.csv.")

(OUT / "report.md").write_text("\n".join(L) + "\n")
print(f"wrote {OUT/'report.md'} ({len(L)} lines) and {OUT/'data.csv'} ({len(rows)} rows)")
