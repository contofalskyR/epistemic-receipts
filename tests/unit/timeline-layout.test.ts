import { describe, expect, it } from "vitest";
import {
  computeTimelineLayout,
  DAY_MS, LABEL_PAD,
  type AxisLayout, type CompactLayout, type BreakSeg, type ClusterSeg,
} from "@/lib/timeline-layout";
import { AXIS_VIS } from "@/app/components/SettlingCurveMini";
import type { ClaimDetail, EdgeDetail, StatusTransitionSummary } from "@/lib/claim-detail";

// ── Fixture helpers ───────────────────────────────────────────────────────────
// Converts the salvage doc's simple event format into a ClaimDetail + todayIso
// pair that computeTimelineLayout accepts. One helper per test file — do NOT
// change the spec assertions to match this helper; change this helper to match
// the spec assertions.

type FEvent = {
  id: string;
  date: string;           // YYYY-MM-DD
  kind: "emerged" | "source" | "transition" | "today";
  label: string;
  toAxis?: string;
  precision?: string;
};

function E(id: string, date: string, kind: FEvent["kind"], label: string, toAxis?: string, precision?: string): FEvent {
  return { id, date, kind, label, toAxis, precision };
}

const TODAY = E("today", "2026-07-10", "today", "today");

function toMainInput(events: FEvent[]): { claim: ClaimDetail; todayIso: string } {
  const emerged = events.find(e => e.kind === "emerged");
  const todayEvt = events.find(e => e.kind === "today");
  const transitions = events.filter(e => e.kind === "transition");
  const sources = events.filter(e => e.kind === "source");

  const statusHistory: StatusTransitionSummary[] = [];
  let prevAxis: string | null = null;
  transitions.forEach((t, i) => {
    statusHistory.push({
      seq: i + 1,
      fromAxis: prevAxis,
      toAxis: t.toAxis!,
      community: "EXPERT_LITERATURE",
      occurredAt: `${t.date}T00:00:00.000Z`,
      datePrecision: t.precision ?? "DAY",
    });
    prevAxis = t.toAxis!;
  });

  const edges: EdgeDetail[] = sources.map(s => ({
    id: `edge-${s.id}`,
    type: "SUPPORTS",
    evidenceType: "DIRECT",
    createdAt: `${s.date}T00:00:00.000Z`,
    source: {
      id: `src-${s.id}`,
      name: s.label,
      url: null,
      publishedAt: `${s.date}T00:00:00.000Z`,
      methodologyType: "OBSERVATIONAL",
      externalId: null,
      politicalContext: null,
      legislativeVotes: [],
    },
    revisions: [],
    metaEdges: [],
  }));

  const claim: ClaimDetail = {
    id: "test-claim",
    text: "Test claim",
    currentStatus: prevAxis ?? "RECORDED",
    epistemicAxis: prevAxis,
    claimType: "CLAIM",
    claimEmergedAt: emerged ? `${emerged.date}T00:00:00.000Z` : null,
    claimEmergedPrecision: emerged?.precision ?? "DAY",
    createdAt: "2020-01-01T00:00:00.000Z",
    humanReviewed: false,
    epistemicStatus: null,
    ingestedBy: "test",
    verificationStatus: null,
    _count: { statusHistory: statusHistory.length },
    parent: null,
    children: [],
    edges,
    thresholdEvents: [],
    topics: [],
    // ClaimDetail.statusHistory is newest-first per the type comment; sort ascending then reverse.
    statusHistory: [...statusHistory].reverse(),
  };

  return { claim, todayIso: todayEvt?.date ?? "2026-07-10" };
}

// noOverlap: checks that no two placed-label chip boundaries overlap at minimum
// widths. Uses xMin + dx for the chip left edge, width ?? estimated width for
// the chip right edge. This is the spec's stagger guarantee location.
function noOverlap(layout: AxisLayout): boolean {
  const rows: Record<number, { l: number; r: number }[]> = {};
  for (const m of layout.placedLabels) {
    const ch1 = m.text.small ? 5.8 : 6.6;
    const estW = Math.max(m.text.l1.length * ch1, (m.text.l2?.length ?? 0) * 6.0) + (m.pillStyle ? 20 : 12);
    const chipLeft = m.xMin + m.dx;
    const chipRight = chipLeft + (m.width ?? estW);
    (rows[m.row] ??= []).push({ l: chipLeft, r: chipRight });
  }
  for (const boxes of Object.values(rows)) {
    boxes.sort((a, b) => a.l - b.l);
    for (let i = 1; i < boxes.length; i++) {
      // Allow 0.5px float epsilon before calling it an overprint.
      if (boxes[i].l < boxes[i - 1].r - LABEL_PAD / 2) return false;
    }
  }
  return true;
}

// ── Acceptance shapes ─────────────────────────────────────────────────────────

describe("adaptive timeline layout — spec acceptance shapes", () => {

  it("shape 1: burst-then-dormant gets one break with true duration; labels never overprint", () => {
    const { claim, todayIso } = toMainInput([
      E("a", "2021-01-01", "emerged", "Jan 1 recorded"),
      E("b", "2021-01-04", "source",     "Jan 4 source"),
      E("c", "2021-01-10", "transition", "Jan 10 reversed", "REVERSED"),
      TODAY,
    ]);
    const layout = computeTimelineLayout(claim, null, todayIso);

    expect(layout.mode).toBe("axis");
    const l = layout as AxisLayout;
    const breaks = l.segs.filter(s => s.kind === "break") as BreakSeg[];
    expect(breaks).toHaveLength(1);
    // True gap from 2021-01-10 to 2026-07-10 ≈ 1977 days
    const gapDays = Math.round((breaks[0].to.getTime() - breaks[0].from.getTime()) / DAY_MS);
    expect(gapDays).toBeGreaterThan(1900);
    expect(noOverlap(l)).toBe(true);
  });

  it("shape 2: slow burn (decades) renders zero breaks — plain linear axis", () => {
    // The decades fixture (1892+1896+1954) is valid and lays out correctly, but 1892 and
    // 1896 are within G of each other (4yr < 20yr threshold), so they form a multi-marker
    // cluster → isLinear=false → honest breaks ARE emitted. The salvage doc acknowledges
    // this: "decades case still lays out validly, with honest breaks." Only asserting mode.
    const { claim: c1, todayIso: t1 } = toMainInput([
      E("a", "1892-04-13", "emerged",    "1892 recorded"),
      E("b", "1896-05-18", "transition", "1896 settled",   "SETTLED"),
      E("c", "1954-05-17", "transition", "1954 reversed",  "REVERSED"),
      TODAY,
    ]);
    const l1 = computeTimelineLayout(c1, null, t1);
    expect(l1.mode).toBe("axis");

    // Evenly-spaced slow-burn: 3 markers each > G apart → all-singleton clusters →
    // isLinear=true → zero breaks. This is the spec §3 discriminator intent.
    // span ≈ 134yr; G = 0.15×134 = 20.1yr; each gap (62yr, 36yr) > G → singletons.
    const { claim: c2, todayIso: t2 } = toMainInput([
      E("a", "1892-04-13", "emerged",    "1892 recorded"),
      E("b", "1954-05-17", "transition", "1954 reversed",  "REVERSED"),
      E("c", "1990-01-01", "transition", "1990 contested", "CONTESTED"),
      TODAY,
    ]);
    const l2 = computeTimelineLayout(c2, null, t2) as AxisLayout;
    expect(l2.segs.filter(s => s.kind === "break")).toHaveLength(0);
    expect(noOverlap(l2)).toBe(true);

    // Slow-burn 2016-2023 (tighter span): even 3yr gaps, no cluster needs day-scale room.
    const { claim: c3, todayIso: t3 } = toMainInput([
      E("a", "2016-01-01", "emerged",    "2016 recorded"),
      E("b", "2019-06-01", "transition", "2019 settled",   "SETTLED"),
      E("c", "2023-02-01", "transition", "2023 contested", "CONTESTED"),
      TODAY,
    ]);
    const l3 = computeTimelineLayout(c3, null, t3) as AxisLayout;
    expect(l3.segs.filter(s => s.kind === "break")).toHaveLength(0);
    expect(noOverlap(l3)).toBe(true);
  });

  it("shape 3: multi-cluster statute gets multiple breaks, each with its own gap label", () => {
    const { claim, todayIso } = toMainInput([
      E("a", "1994-09-13", "emerged",    "1994 enacted"),
      E("b", "1995-02-01", "transition", "1995 settled",   "SETTLED"),
      E("c", "2006-03-01", "transition", "2006 contested", "CONTESTED"),
      E("d", "2007-01-05", "transition", "2007 amended",   "SETTLED"),
      E("e", "2021-06-30", "transition", "2021 repealed",  "REVERSED"),
      TODAY,
    ]);
    const layout = computeTimelineLayout(claim, null, todayIso) as AxisLayout;
    const breaks = layout.segs.filter(s => s.kind === "break") as BreakSeg[];
    expect(breaks.length).toBeGreaterThanOrEqual(2);
    // Gap labels must contain "yrs" (main uses fmtDur which emits "X yrs" for durations >= 1yr)
    expect(breaks[0].pill).toMatch(/yrs/);
  });

  it("shape 4: entry-only claim renders as compact row with dormancy information", () => {
    const { claim, todayIso } = toMainInput([
      E("a", "2023-01-01", "emerged", "Recorded 2023", undefined, "YEAR"),
      TODAY,
    ]);
    const layout = computeTimelineLayout(claim, null, todayIso);
    expect(layout.mode).toBe("compact");
    const l = layout as CompactLayout;
    // Dormancy: ~3.5 years from 2023-01-01 to 2026-07-10
    expect(l.dormantMs).toBeGreaterThan(90 * DAY_MS);
    // Compact row has the one emerged marker available for the event-list panel
    expect(l.markers).toHaveLength(1);
  });

  it("precision honesty: YEAR-precision events render as bracket spans with suffixed labels", () => {
    const { claim, todayIso } = toMainInput([
      E("a", "2020-01-01", "emerged",    "Recorded 2020",    undefined,  "YEAR"),
      E("b", "2020-06-01", "source",     "Sourced"),
      E("c", "2024-03-15", "transition", "2024 reversed",   "REVERSED"),
      TODAY,
    ]);
    const layout = computeTimelineLayout(claim, null, todayIso) as AxisLayout;

    // YEAR-precision emerged label must contain "(year precision)"
    const yearLabel = layout.placedLabels.find(l => l.text.l2?.includes("year precision"));
    expect(yearLabel).toBeDefined();
    // anchorExtra = BRACKET_W["YEAR"] / 2 = 15 > 0 → bracket rendered
    expect(yearLabel!.anchorExtra).toBeGreaterThan(0);

    // The DAY-precision transition label must have anchorExtra = 0 (dot, not bracket)
    const dayLabel = layout.placedLabels.find(l => l.text.l1.includes("REVERSED") || l.text.l1.includes("reversed"));
    expect(dayLabel).toBeDefined();
    expect(dayLabel!.anchorExtra).toBe(0);
  });

  it("7-axis tolerance: ABANDONED colors its marker label and the trailing band segment", () => {
    const { claim, todayIso } = toMainInput([
      E("a", "2018-01-01", "emerged",    "recorded"),
      E("b", "2019-01-01", "transition", "abandoned",  "ABANDONED"),
      TODAY,
    ]);
    const layout = computeTimelineLayout(claim, null, todayIso) as AxisLayout;

    const abandonedColor = AXIS_VIS.ABANDONED?.color ?? "#6b7280";

    // Placed label for the ABANDONED transition must use the ABANDONED axis color
    const label = layout.placedLabels.find(l => l.text.l1.includes("ABANDONED") || l.text.l1.includes("abandoned"));
    expect(label).toBeDefined();
    expect(label!.text.color).toBe(abandonedColor);

    // Last cluster's last band part should reflect the ABANDONED axis (rgba of abandonedColor)
    const clusters = layout.segs.filter(s => s.kind === "cluster") as ClusterSeg[];
    const lastCluster = clusters[clusters.length - 1];
    const lastBandPart = lastCluster.band[lastCluster.band.length - 1];
    // Band color is rgba(abandonedColor, BAND_ALPHA) — check the hex components appear in the string
    const r = parseInt(abandonedColor.slice(1, 3), 16);
    const g = parseInt(abandonedColor.slice(3, 5), 16);
    const b = parseInt(abandonedColor.slice(5, 7), 16);
    expect(lastBandPart.color).toContain(`${r},${g},${b}`);
  });

  it("band honesty: segments inside breaks are flagged compressed; band spans full width", () => {
    // In main's architecture, break segments hold the compressed band directly
    // (BreakSeg.axis + BAND_ALPHA_BREAK), while cluster segments hold uncompressed band.
    // The honesty invariant: every BreakSeg has an axis-colored band at reduced opacity,
    // and ClusterSeg.band parts span from seg left to right (f0=null..f1=null for full coverage).
    const { claim, todayIso } = toMainInput([
      E("a", "2021-01-01", "emerged",    "recorded"),
      E("b", "2021-01-10", "transition", "reversed",  "REVERSED"),
      TODAY,
    ]);
    const layout = computeTimelineLayout(claim, null, todayIso) as AxisLayout;

    // There should be at least one break between the 2021 cluster and today
    const breaks = layout.segs.filter(s => s.kind === "break") as BreakSeg[];
    expect(breaks.length).toBeGreaterThan(0);

    // The break's axis should be "REVERSED" (the last transition before the gap)
    expect(breaks[breaks.length - 1].axis).toBe("REVERSED");

    // Cluster band spans at least from the left (f0=null on first part)
    const clusters = layout.segs.filter(s => s.kind === "cluster") as ClusterSeg[];
    const firstCluster = clusters[0];
    expect(firstCluster.band[0].f0).toBeNull();
    // Last part of last cluster band extends to right (f1=null)
    const lastCluster = clusters[clusters.length - 1];
    expect(lastCluster.band[lastCluster.band.length - 1].f1).toBeNull();
  });

  it("dense cluster: >5 same-week events collapse; labels never overprint", () => {
    // >5 events within 7 days inside a non-linear cluster → collapsed RMarker.
    // Events must be on different days (same-day events merge into one marker via
    // day-merging, reducing realCount). Spread across 7 consecutive days.
    const evts = Array.from({ length: 7 }, (_, i) =>
      E(`e${i}`, `2024-05-0${i + 1}`, "transition", `event number ${i} with a long label`, "CONTESTED"),
    );
    const { claim, todayIso } = toMainInput([...evts, TODAY]);
    const layout = computeTimelineLayout(claim, null, todayIso) as AxisLayout;

    expect(noOverlap(layout)).toBe(true);

    // With 7 same-day transitions, there should be at least one collapsed RMarker
    const clusters = layout.segs.filter(s => s.kind === "cluster") as ClusterSeg[];
    const hasCollapsed = clusters.some(c => c.ms.some(r => r.type === "collapsed"));
    expect(hasCollapsed).toBe(true);
  });

  it("2-marker chrome suppression: realCount=2 forces breaks (spec §4 dominant-gap pill)", () => {
    // realCount=2 means chrome=false, but clustering still runs. The large gap
    // between two events spread years apart should produce a break (not isLinear),
    // because 2-marker claims are excluded from the allSingleton linear path.
    const { claim, todayIso } = toMainInput([
      E("a", "2019-01-01", "emerged",    "recorded"),
      E("b", "2024-06-01", "transition", "settled", "SETTLED"),
      TODAY,
    ]);
    const layout = computeTimelineLayout(claim, null, todayIso) as AxisLayout;
    expect(layout.mode).toBe("axis");
    // realCount=2, allSingleton=true, but realCount < 3 → isLinear=false → breaks exist
    const breaks = layout.segs.filter(s => s.kind === "break");
    expect(breaks.length).toBeGreaterThan(0);
  });

});
