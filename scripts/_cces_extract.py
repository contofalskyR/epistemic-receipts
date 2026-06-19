#!/usr/bin/env python3.14
"""Extract per (state, year, topic) constituent-opinion aggregates from the CCES
cumulative Common Content .dta file (Harvard Dataverse doi:10.7910/DVN/II2DB6).

The cumulative file does not carry year-specific policy yes/no questions — those
live in each year's annual file. Instead, it carries standardized demographics
plus ideo5 (5-point ideology) and pid3 (3-point party ID), which we treat as
constituent signal:

  liberal_pct        = % ideo5 in {1, 2} (Very Liberal / Liberal)
  dem_pct            = % pid3 == 1 (Democrat)
  rep_pct            = % pid3 == 2 (Republican)
  uninsured_pct      = % no_healthins == 1
  union_pct          = % union == 1 or union_hh == 1
  evangelical_pct    = % relig_bornagain == 1

For every LegislativeVote topic slug (taxation, health, immigration, ...) we
emit a ConstituentOpinion row whose supportPct = the share of constituents
supporting the *liberal-coded* direction on that topic (typically
liberal_pct, but dem_pct for party-coded topics like health, foreign_policy,
appropriations, infrastructure; and union_pct for labor).

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
OUT_PATH = Path("/tmp/cces/cces_aggregates.json")

# Map each LegislativeVote topic slug (snake_case, as it appears in
# LegislativeVote.topics JSON) to which CCES per-state aggregate represents
# the liberal-coded direction on that topic.
#
# "liberal" = treat liberal_pct as constituent support for the liberal-coded
# direction (e.g. immigration leniency, gun control, environmental protection,
# civil-rights expansion, social-welfare expansion, abortion access, higher
# taxes on the wealthy).
#
# "dem" = treat dem_pct as the analog where ideology is too blunt (party ID is
# a better proxy for Democratic-coded procedural votes like appropriations,
# infrastructure, judiciary nominations).
#
# "uninsured" / "union" / "evangelical" = use that direct demographic proxy.
TOPIC_DIRECTION: dict[str, str] = {
    "taxation": "liberal",
    "appropriations": "dem",
    "foreign_policy": "dem",
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
    "health": "dem",
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

# Columns we actually need. Reading a narrow slice keeps memory bounded for
# the 675MB .dta file (~700k rows).
WANTED_COLS = [
    "year", "st", "state",
    "ideo5", "pid3",
    "no_healthins", "union", "union_hh",
    "relig_bornagain",
    "weight_cumulative",
]


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


def main() -> int:
    if not DTA_PATH.exists():
        print(f"ERROR: {DTA_PATH} not found. Download it first.", file=sys.stderr)
        return 1

    # Use chunked reader to keep memory bounded. pyreadstat returns a generator
    # of (df, meta) tuples — but we're avoiding pandas to keep deps minimal,
    # so use the underlying read_file_multiprocessing-style read with `row_offset`
    # and `row_limit`. Simplest: read in one shot and select columns.
    print(f"[cces] reading {DTA_PATH} (this is ~700k rows, takes ~60s)...", file=sys.stderr)
    df, meta = pyreadstat.read_dta(
        str(DTA_PATH),
        usecols=WANTED_COLS,
        disable_datetime_conversion=True,
    )
    print(f"[cces] loaded {len(df):,} rows × {len(df.columns)} cols", file=sys.stderr)

    # Tally per (state, year) counts.
    # bucket[(state, year)] = {n, lib, con, dem, rep, unins, union, evang, total_*_n}
    buckets: dict[tuple[str, int], dict[str, float]] = defaultdict(
        lambda: {
            "n": 0,
            "ideo_n": 0, "lib": 0, "con": 0,
            "pid_n": 0, "dem": 0, "rep": 0,
            "health_n": 0, "unins": 0,
            "union_n": 0, "union_yes": 0,
            "evang_n": 0, "evang_yes": 0,
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

    print(f"[cces] aggregated into {len(buckets):,} (state, year) buckets", file=sys.stderr)

    # Build per-topic output rows.
    out: list[dict[str, Any]] = []

    def pct(num: float, den: float) -> float | None:
        if den <= 0:
            return None
        return round(100.0 * num / den, 3)

    for (state, year), b in sorted(buckets.items()):
        liberal_pct = pct(b["lib"], b["ideo_n"])
        conservative_pct = pct(b["con"], b["ideo_n"])
        dem_pct = pct(b["dem"], b["pid_n"])
        uninsured_pct = pct(b["unins"], b["health_n"])
        union_pct = pct(b["union_yes"], b["union_n"])
        evangelical_pct = pct(b["evang_yes"], b["evang_n"])

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
        }

        for topic, direction in TOPIC_DIRECTION.items():
            support: float | None
            sample = int(b["n"])
            if direction == "liberal":
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
                "questionCode": direction,
                "metadata": meta_blob,
            })

    print(f"[cces] writing {len(out):,} rows to {OUT_PATH}", file=sys.stderr)
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUT_PATH.open("w") as fh:
        json.dump(out, fh)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
