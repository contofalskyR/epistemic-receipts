#!/usr/bin/env python3.14
"""Extract per (state, year, topic) constituent-opinion aggregates from the CCES
cumulative Common Content .dta file (Harvard Dataverse doi:10.7910/DVN/II2DB6).

The cumulative file carries standardized demographics plus ideo5 (5-point
ideology) and pid3 (3-point party ID), which we treat as constituent signal:

  liberal_pct        = % ideo5 in {1, 2} (Very Liberal / Liberal)
  dem_pct            = % pid3 == 1 (Democrat)
  rep_pct            = % pid3 == 2 (Republican)
  uninsured_pct      = % no_healthins == 1
  union_pct          = % union == 1 or union_hh == 1
  evangelical_pct    = % relig_bornagain == 1

For most LegislativeVote topic slugs (taxation, immigration, ...) we emit a
ConstituentOpinion row whose supportPct = the share of constituents supporting
the *liberal-coded* direction on that topic (typically liberal_pct, but
dem_pct for party-coded topics, union_pct for labor, etc.).

DIRECT POLICY ITEMS (health & foreign_policy)
---------------------------------------------
For `health` and `foreign_policy` we prefer *actual* year-specific CCES policy
items over the pid3 proxy, where they exist. These items are not in the
cumulative Common Content; they live in the companion "Cumulative CES Policy
Preferences" dataset (Dagonel 2023, doi:10.7910/DVN/OSXDQO), which harmonizes
year-specific question items across waves and merges to the cumulative file on
(year, case_id).

  health           -> healthcare_aca  ("Repeal the Affordable Care Act",
                      coded 1=Support, 2=Oppose). Liberal-coded direction is
                      OPPOSE repeal (= support the ACA), so
                        health_support_pct = % healthcare_aca == 2.
                      Available 2012-2021. Years without it (2009-2011,
                      2022-2024) fall back to pid3 (dem_pct).

  foreign_policy   -> military_terroristcamp ("Approve of use of U.S. military
                      force to destroy a terrorist camp", coded 1=Support,
                      2=Oppose). This is the harmonized analog of the
                      CC16_415r / CC18_415r "use of US military force to combat
                      terrorism overseas" item. The Democratic / liberal-coded
                      foreign-policy direction is military restraint, i.e.
                      OPPOSE the use of force, so
                        foreign_policy_support_pct = % military_terroristcamp == 2.
                      Available 2006-2008, 2010-2016, 2020. Other years (2009,
                      2017-2019, 2021-2024) fall back to pid3 (dem_pct).

The per-(state, year) ConstituentOpinion row records the specific
year-specific original variable code (e.g. CC18_327c for 2018 health) in
`questionCode` when a direct item is used, and "dem" when it falls back to
pid3.

Output: /tmp/cces/cces_aggregates.json — a list of {state, year, topicSlug,
supportPct, sampleSize, questionCode, metadata} objects ready to be upserted
into ConstituentOpinion.
"""
from __future__ import annotations

import json
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any

import pyreadstat  # type: ignore[import-untyped]

DTA_PATH = Path("/tmp/cces/cumulative.dta")
# Cumulative CES Policy Preferences (Dagonel 2023, doi:10.7910/DVN/OSXDQO).
# Harmonized year-specific policy items, merges to cumulative on (year, case_id).
POLICY_PATH = Path("/tmp/cces/policy_prefs.tab")
OUT_PATH = Path("/tmp/cces/cces_aggregates.json")

# Map each LegislativeVote topic slug (snake_case, as it appears in
# LegislativeVote.topics JSON) to which CCES per-state aggregate represents
# the liberal-coded direction on that topic.
#
# "liberal" = treat liberal_pct as constituent support for the liberal-coded
# direction. "dem" = treat dem_pct as the analog. "uninsured"/"union"/
# "evangelical" = use that direct demographic proxy. "conservative" =
# conservative_pct.
#
# `health` and `foreign_policy` are handled specially below: a direct
# year-specific policy item is used where available, with "dem" as fallback.
TOPIC_DIRECTION: dict[str, str] = {
    "taxation": "liberal",
    "appropriations": "dem",
    "foreign_policy": "dem",  # fallback only; direct item used where available
    "military": "conservative",
    "banking_finance": "liberal",
    "labor": "union",
    "infrastructure": "dem",
    "judiciary": "dem",
    "social_welfare": "liberal",
    "public_lands": "liberal",
    "defense": "conservative",
    "tariff_trade": "liberal",
    "education": "liberal",
    "agriculture": "dem",
    "health": "dem",  # fallback only; direct item used where available
    "housing": "liberal",
    "native_affairs": "liberal",
    "postal": "dem",
    "environment": "liberal",
    "civil_rights": "liberal",
    "immigration": "liberal",
    "technology": "dem",
    "prohibition": "conservative",
    "slavery": "liberal",
    "war": "conservative",
    "economy": "dem",
}

# Direct year-specific policy items for health & foreign_policy.
#
# For each topic we record the harmonized variable in the policy file, the
# response value that codes the *liberal* direction, and the per-year original
# CCES variable code (used as questionCode). Years not listed fall back to pid3.
HEALTH_VAR = "healthcare_aca"            # "Repeal the ACA"; liberal = Oppose (2)
HEALTH_LIBERAL_VALUE = 2
FP_VAR = "military_terroristcamp"        # "Use force to destroy terrorist camp"; liberal = Oppose (2)
FP_LIBERAL_VALUE = 2

# year -> original year-specific CCES variable code, per the Dagonel guide
# (doi:10.7910/DVN/OSXDQO). Used to populate questionCode for direct-item rows.
HEALTH_QCODE_BY_YEAR: dict[int, str] = {
    2012: "CC332G", 2013: "CC332C", 2014: "CC14_324_1", 2015: "CC15_327A",
    2016: "CC16_351I", 2017: "CC17_340A", 2018: "CC18_327c", 2019: "CC19_327d",
    2020: "CC20_327d", 2021: "CC21_320b",
}
FP_QCODE_BY_YEAR: dict[int, str] = {
    2006: "v3030", 2007: "CC06_V3030", 2008: "cc418_2", 2010: "cc414_2",
    2011: "CC356_2", 2012: "CC414_2", 2013: "CC322_2", 2014: "CC414_2",
    2015: "CC15_324_2", 2016: "CC16_414_2", 2020: "CC20_420_2",
}

# FIPS code -> 2-letter postal abbreviation. CCES `state` is numeric FIPS;
# `st` is the abbreviation. We prefer `st` but fall back to FIPS.
FIPS_TO_ABBR: dict[int, str] = {
    1: "AL", 2: "AK", 4: "AZ", 5: "AR", 6: "CA", 8: "CO", 9: "CT", 10: "DE",
    11: "DC", 12: "FL", 13: "GA", 15: "HI", 16: "ID", 17: "IL", 18: "IN",
    19: "IA", 20: "KS", 21: "KY", 22: "LA", 23: "ME", 24: "MD", 25: "MA",
    26: "MI", 27: "MN", 28: "MS", 29: "MO", 30: "MT", 31: "NE", 32: "NV",
    33: "NH", 34: "NJ", 35: "NM", 36: "NY", 37: "NC", 38: "ND", 39: "OH",
    40: "OK", 41: "OR", 42: "PA", 44: "RI", 45: "SC", 46: "SD", 47: "TN",
    48: "TX", 49: "UT", 50: "VT", 51: "VA", 53: "WA", 54: "WV", 55: "WI",
    56: "WY",
}

# Columns we actually need from the cumulative file. Reading a narrow slice
# keeps memory bounded for the 700MB .dta file (~700k rows).
WANTED_COLS = [
    "year", "case_id", "st", "state",
    "ideo5", "pid3",
    "no_healthins", "union", "union_hh",
    "relig_bornagain",
    "weight_cumulative",
]

# Columns we need from the policy-preferences file.
POLICY_COLS = ["year", "case_id", HEALTH_VAR, FP_VAR]


def to_int(v: Any) -> int | None:
    try:
        if v is None:
            return None
        f = float(v)
        if f != f:  # NaN
            return None
        return int(f)
    except (TypeError, ValueError):
        return None


def to_str(v: Any) -> str | None:
    if v is None:
        return None
    s = str(v).strip()
    if not s or s.lower() == "nan":
        return None
    return s


def load_policy_items() -> dict[tuple[int, int], tuple[int | None, int | None]]:
    """Return {(year, case_id): (health_val, fp_val)} from the policy file.

    Values are the raw numeric responses (1=Support, 2=Oppose) or None.
    """
    if not POLICY_PATH.exists():
        print(
            f"WARNING: {POLICY_PATH} not found — health/foreign_policy will use "
            f"the pid3 fallback for ALL years.",
            file=sys.stderr,
        )
        return {}

    print(f"[cces] reading policy items {POLICY_PATH} ...", file=sys.stderr)
    pdf, _ = pyreadstat.read_dta(
        str(POLICY_PATH), usecols=POLICY_COLS, disable_datetime_conversion=True
    )
    print(f"[cces] policy file: {len(pdf):,} rows", file=sys.stderr)

    items: dict[tuple[int, int], tuple[int | None, int | None]] = {}
    for row in pdf.itertuples(index=False):
        year = to_int(getattr(row, "year", None))
        cid = to_int(getattr(row, "case_id", None))
        if year is None or cid is None:
            continue
        items[(year, cid)] = (
            to_int(getattr(row, HEALTH_VAR, None)),
            to_int(getattr(row, FP_VAR, None)),
        )
    print(f"[cces] indexed {len(items):,} (year, case_id) policy rows", file=sys.stderr)
    return items


def main() -> int:
    if not DTA_PATH.exists():
        print(f"ERROR: {DTA_PATH} not found. Download it first.", file=sys.stderr)
        return 1

    policy = load_policy_items()

    print(f"[cces] reading {DTA_PATH} (this is ~700k rows, takes ~60s)...", file=sys.stderr)
    df, meta = pyreadstat.read_dta(
        str(DTA_PATH),
        usecols=WANTED_COLS,
        disable_datetime_conversion=True,
    )
    print(f"[cces] loaded {len(df):,} rows × {len(df.columns)} cols", file=sys.stderr)

    # Tally per (state, year) counts.
    buckets: dict[tuple[str, int], dict[str, float]] = defaultdict(
        lambda: {
            "n": 0,
            "ideo_n": 0, "lib": 0, "con": 0,
            "pid_n": 0, "dem": 0, "rep": 0,
            "health_n": 0, "unins": 0,
            "union_n": 0, "union_yes": 0,
            "evang_n": 0, "evang_yes": 0,
            # Direct policy items (joined from the Dagonel policy file).
            "aca_n": 0, "aca_lib": 0,          # healthcare_aca (oppose repeal)
            "fpforce_n": 0, "fpforce_lib": 0,  # military_terroristcamp (oppose force)
        }
    )

    for row in df.itertuples(index=False):
        year = to_int(getattr(row, "year", None))
        if year is None:
            continue
        st_raw = to_str(getattr(row, "st", None))
        if st_raw and len(st_raw) == 2 and st_raw.isalpha():
            state = st_raw.upper()
        else:
            fips = to_int(getattr(row, "state", None))
            if fips is None or fips not in FIPS_TO_ABBR:
                continue
            state = FIPS_TO_ABBR[fips]

        key = (state, year)
        b = buckets[key]
        b["n"] += 1

        ideo5 = to_int(getattr(row, "ideo5", None))
        if ideo5 is not None and 1 <= ideo5 <= 5:
            b["ideo_n"] += 1
            if ideo5 <= 2:
                b["lib"] += 1
            elif ideo5 >= 4:
                b["con"] += 1

        pid3 = to_int(getattr(row, "pid3", None))
        if pid3 is not None and 1 <= pid3 <= 3:
            b["pid_n"] += 1
            if pid3 == 1:
                b["dem"] += 1
            elif pid3 == 2:
                b["rep"] += 1

        no_health = to_int(getattr(row, "no_healthins", None))
        if no_health is not None and no_health in (1, 2):
            b["health_n"] += 1
            if no_health == 1:
                b["unins"] += 1

        union = to_int(getattr(row, "union", None))
        union_hh = to_int(getattr(row, "union_hh", None))
        if union is not None or union_hh is not None:
            b["union_n"] += 1
            if (union == 1) or (union_hh == 1):
                b["union_yes"] += 1

        evang = to_int(getattr(row, "relig_bornagain", None))
        if evang is not None and evang in (1, 2):
            b["evang_n"] += 1
            if evang == 1:
                b["evang_yes"] += 1

        # Direct policy items, joined on (year, case_id).
        cid = to_int(getattr(row, "case_id", None))
        if cid is not None:
            pol = policy.get((year, cid))
            if pol is not None:
                health_val, fp_val = pol
                if health_val in (1, 2):
                    b["aca_n"] += 1
                    if health_val == HEALTH_LIBERAL_VALUE:
                        b["aca_lib"] += 1
                if fp_val in (1, 2):
                    b["fpforce_n"] += 1
                    if fp_val == FP_LIBERAL_VALUE:
                        b["fpforce_lib"] += 1

    print(f"[cces] aggregated into {len(buckets):,} (state, year) buckets", file=sys.stderr)

    out: list[dict[str, Any]] = []

    def pct(num: float, den: float) -> float | None:
        if den <= 0:
            return None
        return round(100.0 * num / den, 3)

    direct_health = 0
    direct_fp = 0
    fallback_health = 0
    fallback_fp = 0

    for (state, year), b in sorted(buckets.items()):
        liberal_pct = pct(b["lib"], b["ideo_n"])
        conservative_pct = pct(b["con"], b["ideo_n"])
        dem_pct = pct(b["dem"], b["pid_n"])
        uninsured_pct = pct(b["unins"], b["health_n"])
        union_pct = pct(b["union_yes"], b["union_n"])
        evangelical_pct = pct(b["evang_yes"], b["evang_n"])
        aca_support_pct = pct(b["aca_lib"], b["aca_n"])
        fp_restraint_pct = pct(b["fpforce_lib"], b["fpforce_n"])

        # Skip buckets with no meaningful sample
        if int(b["n"]) < 30:
            continue

        meta_blob = {
            "respondents": int(b["n"]),
            "liberalPct": liberal_pct,
            "conservativePct": conservative_pct,
            "demPct": dem_pct,
            "uninsuredPct": uninsured_pct,
            "unionPct": union_pct,
            "evangelicalPct": evangelical_pct,
            # Direct-item shares (null where the item was not asked that year).
            "acaSupportPct": aca_support_pct,
            "acaSampleSize": int(b["aca_n"]) or None,
            "fpRestraintPct": fp_restraint_pct,
            "fpSampleSize": int(b["fpforce_n"]) or None,
        }

        for topic, direction in TOPIC_DIRECTION.items():
            support: float | None
            sample = int(b["n"])
            qcode = direction

            if topic == "health":
                # Prefer the direct ACA item where available with a usable sample.
                if aca_support_pct is not None and int(b["aca_n"]) >= 20:
                    support = aca_support_pct
                    sample = int(b["aca_n"])
                    qcode = HEALTH_QCODE_BY_YEAR.get(year, HEALTH_VAR)
                    direct_health += 1
                else:
                    support = dem_pct
                    sample = int(b["pid_n"])
                    qcode = "dem"
                    fallback_health += 1
            elif topic == "foreign_policy":
                if fp_restraint_pct is not None and int(b["fpforce_n"]) >= 20:
                    support = fp_restraint_pct
                    sample = int(b["fpforce_n"])
                    qcode = FP_QCODE_BY_YEAR.get(year, FP_VAR)
                    direct_fp += 1
                else:
                    support = dem_pct
                    sample = int(b["pid_n"])
                    qcode = "dem"
                    fallback_fp += 1
            elif direction == "liberal":
                support = liberal_pct
                sample = int(b["ideo_n"])
            elif direction == "conservative":
                support = conservative_pct
                sample = int(b["ideo_n"])
            elif direction == "dem":
                support = dem_pct
                sample = int(b["pid_n"])
            elif direction == "uninsured":
                support = uninsured_pct
                sample = int(b["health_n"])
            elif direction == "union":
                support = union_pct
                sample = int(b["union_n"])
            elif direction == "evangelical":
                support = evangelical_pct
                sample = int(b["evang_n"])
            else:
                continue

            if support is None or sample < 20:
                continue
            out.append({
                "state": state,
                "district": None,
                "year": year,
                "topicSlug": topic,
                "supportPct": support,
                "sampleSize": sample,
                "source": "cces_cumulative_2006_2024",
                "questionCode": qcode,
                "metadata": meta_blob,
            })

    print(
        f"[cces] health: direct-item rows={direct_health} pid3-fallback rows={fallback_health}",
        file=sys.stderr,
    )
    print(
        f"[cces] foreign_policy: direct-item rows={direct_fp} pid3-fallback rows={fallback_fp}",
        file=sys.stderr,
    )
    print(f"[cces] writing {len(out):,} rows to {OUT_PATH}", file=sys.stderr)
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUT_PATH.open("w") as fh:
        json.dump(out, fh)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
