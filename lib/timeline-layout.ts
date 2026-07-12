// ── Adaptive claim timeline geometry engine ───────────────────────────────────
// Pure layout logic extracted from AdaptiveClaimTimeline.tsx so it can be
// unit-tested against the spec's acceptance shapes independently of React.
//
// Callers:
//   app/claims/[id]/AdaptiveClaimTimeline.tsx — thin JSX renderer
//   tests/unit/timeline-layout.test.ts — acceptance suite
//
// import type avoids triggering server-only at runtime.
import type { ClaimDetail, EdgeDetail, StatusTransitionSummary } from "@/lib/claim-detail";
import { AXIS_VIS } from "@/app/components/SettlingCurveMini";
import { AXIS_CONFIG } from "@/components/EpistemicAxisBadge";
import { formatEmerged, type EmergedPrecision } from "@/lib/claimAge";

// ── Constants ─────────────────────────────────────────────────────────────────

export const DAY_MS = 86_400_000;

export const SLOT = 52;
export const BREAK_W = 34;
export const MIN_CLUSTER = 64;
export const LINEAR_MIN = 320;
export const EDGE = 26;
export const LABEL_PAD = 8;

export const STRIP_H = 154;
export const AXIS_Y = 104;
export const ROW_H = 28;
export const LABEL_BOTTOM = 88;
export const BAND_Y = 124;
export const BAND_H = 7;
export const SUB_Y = 134;

export const BLUE = "#60a5fa";
export const SLATE = "#94a3b8";
export const AMBER = "#f0a000";
export const MUT = "#888898";
export const DIM = "#3a3a55";
export const DATE_C = "#b0b0c8";
export const CARD_BG = "#0e0e1c";
export const BORDER = "#1e1e38";
export const AXIS_LINE = "#26263f";
export const PRE_BAND = "rgba(100,116,139,0.10)";
export const BAND_ALPHA = 0.5;
export const BAND_ALPHA_BREAK = 0.25;

type Prec = EmergedPrecision;
export const PREC_RANK: Record<Prec, number> = { DAY: 0, MONTH: 1, QUARTER: 2, YEAR: 3 };
export const BRACKET_W: Record<Prec, number> = { DAY: 0, MONTH: 14, QUARTER: 20, YEAR: 30 };

// ── Types ─────────────────────────────────────────────────────────────────────

export type Marker = {
  key: string;
  date: Date;
  prec: Prec;
  emerged: boolean;
  emergedPrec: Prec;
  transitions: StatusTransitionSummary[];
  sources: EdgeDetail[];
  isToday: boolean;
};

export type LabelText = { l1: string; l2?: string; color: string; small?: boolean };

export type RMarker =
  | { type: "m"; m: Marker }
  | { type: "collapsed"; members: Marker[]; date: Date; count: number };

export type BandPart = {
  f0: number | null;
  f1: number | null;
  color: string;
  title: string;
};

export type ClusterSeg = {
  kind: "cluster";
  minPx: number;
  grow: number;
  t0: number;
  t1: number;
  ms: RMarker[];
  fracs: number[];
  band: BandPart[];
  sublabel: string | null;
  todayFrac: number | null;
};

export type BreakSeg = {
  kind: "break";
  from: Date;
  to: Date;
  trailing: boolean;
  axis: string | null;
  pill: string;
  title: string;
};

export type Seg = ClusterSeg | BreakSeg;

export type PlacedLabel = {
  segIdx: number;
  frac: number;
  anchorExtra: number;
  xMin: number;
  row: number;
  dx: number;
  width: number | null;
  text: LabelText;
  title: string;
  leader: boolean;
  leaderColor: string;
  pillStyle?: boolean;
};

// ── Return types ──────────────────────────────────────────────────────────────

export type CompactLayout = {
  mode: "compact";
  dotColor: string;
  primary: string;
  dateLabel: string | null;
  dormantMs: number;
  dormantWord: string;
  title: string;
  markers: Marker[];
};

export type AxisLayout = {
  mode: "axis";
  segs: Seg[];
  segX0: number[];
  totalMin: number;
  placedLabels: PlacedLabel[];
  sublabelFits: boolean[];
  pillDxBySeg: Map<number, number>;
  ticks: { frac: number; year: number }[];
  isLinear: boolean;
  chrome: boolean;
  realCount: number;
  markers: Marker[];
  ariaLabel: string;
};

export type TimelineLayout = CompactLayout | AxisLayout;

// ── Small helpers ─────────────────────────────────────────────────────────────

export function toPrec(p: string | null | undefined): Prec {
  return p === "MONTH" || p === "QUARTER" || p === "YEAR" ? p : "DAY";
}

export function rgba(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export function axisColor(axis: string | null | undefined): string {
  return (axis && AXIS_VIS[axis]?.color) || SLATE;
}

export function axisLabelText(axis: string | null | undefined): string {
  if (!axis) return "Unclassified";
  return AXIS_CONFIG[axis]?.label ?? AXIS_VIS[axis]?.label ?? axis;
}

export function fmtDay(d: Date): string {
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
}

export function fmtPrec(d: Date, prec: Prec): string {
  return prec === "DAY" ? fmtDay(d) : formatEmerged(d.toISOString(), prec);
}

export function labelDate(d: Date, prec: Prec): string {
  return prec === "YEAR" ? `${fmtPrec(d, prec)} (year precision)` : fmtPrec(d, prec);
}

export function hoverDate(d: Date, prec: Prec): string {
  return prec === "DAY" ? fmtDay(d) : `${fmtPrec(d, prec)} (${prec.toLowerCase()} precision)`;
}

export function fmtDur(ms: number): string {
  const days = ms / DAY_MS;
  if (days < 365.25) return `${Math.max(1, Math.round(days / 30.44))} mo`;
  const r = Math.round((days / 365.25) * 10) / 10;
  return `${Number.isInteger(r) ? r.toFixed(0) : r.toFixed(1)} yrs`;
}

export function voteText(e: EdgeDetail): string | null {
  const v = e.source.legislativeVotes?.[0];
  if (!v) return null;
  return `${v.yesCount ?? 0}–${v.noCount ?? 0}${v.passageType ? ` · ${v.passageType}` : ""}`;
}

export function transitionChain(t: StatusTransitionSummary): string {
  return `${t.fromAxis ? `${t.fromAxis} → ` : "→ "}${t.toAxis}`;
}

/** CSS anchor calc — exported so the renderer can use it without re-deriving EDGE. */
export function anchorCalc(frac: number, extra = 0): string {
  return `calc(${(frac * 100).toFixed(3)}% + ${(EDGE + extra - frac * 2 * EDGE).toFixed(2)}px)`;
}

// ── Event model ───────────────────────────────────────────────────────────────

export function buildMarkers(claim: ClaimDetail): Marker[] {
  const byDay = new Map<string, Marker>();
  const get = (key: string): Marker => {
    let m = byDay.get(key);
    if (!m) {
      m = {
        key,
        date: new Date(`${key}T00:00:00.000Z`),
        prec: "DAY",
        emerged: false,
        emergedPrec: "DAY",
        transitions: [],
        sources: [],
        isToday: false,
      };
      byDay.set(key, m);
    }
    return m;
  };

  if (claim.claimEmergedAt) {
    const m = get(claim.claimEmergedAt.slice(0, 10));
    m.emerged = true;
    m.emergedPrec = toPrec(claim.claimEmergedPrecision);
    if (PREC_RANK[m.emergedPrec] > PREC_RANK[m.prec]) m.prec = m.emergedPrec;
  }

  const transitionsAsc = [...claim.statusHistory].sort(
    (a, b) =>
      (a.seq ?? Infinity) - (b.seq ?? Infinity) ||
      new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime(),
  );
  for (const t of transitionsAsc) {
    const m = get(t.occurredAt.slice(0, 10));
    m.transitions.push(t);
    const p = toPrec(t.datePrecision);
    if (PREC_RANK[p] > PREC_RANK[m.prec]) m.prec = p;
  }

  for (const e of claim.edges) {
    if (!e.source.publishedAt) continue;
    get(e.source.publishedAt.slice(0, 10)).sources.push(e);
  }

  return [...byDay.values()].sort((a, b) => a.date.getTime() - b.date.getTime());
}

export function markerEventCount(m: Marker): number {
  return m.transitions.length + m.sources.length + (m.emerged ? 1 : 0);
}

export function markerTitle(m: Marker): string {
  if (m.isToday) return `Today — page rendered ${fmtDay(m.date)}`;
  const lines: string[] = [];
  if (m.emerged) lines.push(`Claim emerged ${hoverDate(m.date, m.emergedPrec)}`);
  for (const t of m.transitions) {
    lines.push(
      `${transitionChain(t)} · ${hoverDate(new Date(t.occurredAt), toPrec(t.datePrecision))} · ${t.community.replace(/_/g, " ")}`,
    );
  }
  for (const e of m.sources) {
    const v = voteText(e);
    lines.push(`Source: ${e.source.name}${v ? ` · ${v}` : ""} · ${fmtDay(new Date(e.source.publishedAt!))}`);
  }
  return lines.join("\n");
}

export function markerLabel(m: Marker): LabelText {
  if (m.isToday) return { l1: "today", l2: fmtDay(m.date), color: AMBER };
  const lastT = m.transitions[m.transitions.length - 1];
  if (lastT) {
    const chain = transitionChain(lastT);
    const l1 = m.emerged ? (lastT.fromAxis ? `Emerged · ${chain}` : `Emerged ${chain}`) : chain;
    return { l1, l2: labelDate(m.date, m.prec), color: axisColor(lastT.toAxis) };
  }
  if (m.emerged) return { l1: "Emerged", l2: labelDate(m.date, m.emergedPrec), color: BLUE };
  if (m.sources.length > 1) return { l1: `${m.sources.length} sources`, l2: fmtDay(m.date), color: SLATE };
  return { l1: fmtDay(m.date), color: SLATE, small: true };
}

// ── Render markers ────────────────────────────────────────────────────────────

export function rDate(r: RMarker): Date {
  return r.type === "m" ? r.m.date : r.date;
}

export function rPrec(r: RMarker): Prec {
  return r.type === "m" ? r.m.prec : "DAY";
}

export function collapsedRange(members: Marker[]): string {
  const a = members[0].date;
  const b = members[members.length - 1].date;
  if (a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth()) {
    const mo = a.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
    return `${mo} ${a.getUTCDate()}–${b.getUTCDate()}, ${a.getUTCFullYear()}`;
  }
  return `${fmtDay(a)} – ${fmtDay(b)}`;
}

export function rLabel(r: RMarker): LabelText {
  if (r.type === "m") return markerLabel(r.m);
  const lastT = [...r.members].reverse().find(m => m.transitions.length > 0)?.transitions.slice(-1)[0];
  return {
    l1: `${r.count} events`,
    l2: collapsedRange(r.members),
    color: lastT ? axisColor(lastT.toAxis) : SLATE,
  };
}

export function rTitle(r: RMarker): string {
  if (r.type === "m") return markerTitle(r.m);
  return `${r.count} events · ${collapsedRange(r.members)} — click to expand the list below`;
}

// ── Label placement ───────────────────────────────────────────────────────────

type LabelInput = {
  segIdx: number;
  frac: number;
  anchorExtra: number;
  xMin: number;
  text: LabelText;
  title: string;
  leader: boolean;
  leaderColor: string;
  pillStyle?: boolean;
};

/** Greedy 3-row label stagger at minimum widths. Flex growth only increases
 *  pairwise marker distances, so no-overlap here means no-overlap at every
 *  wider rendering — the spec's acceptance criterion, made deterministic. */
export function placeLabels(labels: LabelInput[], totalMin: number): PlacedLabel[] {
  const rows: Array<Array<[number, number]>> = [[], [], []];
  const out: PlacedLabel[] = [];

  for (const l of [...labels].sort((a, b) => a.xMin - b.xMin)) {
    const ch1 = l.text.small ? 5.8 : 6.6;
    const estW =
      Math.max(l.text.l1.length * ch1, (l.text.l2?.length ?? 0) * 6.0) + (l.pillStyle ? 20 : 12);
    let x0 = l.xMin - estW / 2;
    if (x0 < 2) x0 = 2;
    if (x0 + estW > totalMin - 2) x0 = totalMin - 2 - estW;
    const x1 = x0 + estW;

    let placed = false;
    for (let r = 0; r < 3 && !placed; r++) {
      if (rows[r].every(([a, b]) => x1 + LABEL_PAD <= a || x0 - LABEL_PAD >= b)) {
        rows[r].push([x0, x1]);
        out.push({ ...l, row: r, dx: x0 - l.xMin, width: null });
        placed = true;
      }
    }
    if (placed) continue;

    let best: { row: number; lo: number; hi: number } | null = null;
    for (let r = 0; r < 3; r++) {
      let lo = 2;
      let hi = totalMin - 2;
      let blocked = false;
      for (const [a, b] of rows[r]) {
        if (a - LABEL_PAD <= l.xMin && l.xMin <= b + LABEL_PAD) { blocked = true; break; }
        if (b + LABEL_PAD <= l.xMin) lo = Math.max(lo, b + LABEL_PAD);
        if (a - LABEL_PAD >= l.xMin) hi = Math.min(hi, a - LABEL_PAD);
      }
      if (blocked) continue;
      if (!best || hi - lo > best.hi - best.lo) best = { row: r, lo, hi };
    }
    if (best && best.hi - best.lo >= 30) {
      const w = Math.min(estW, best.hi - best.lo);
      const left = Math.min(Math.max(l.xMin - w / 2, best.lo), best.hi - w);
      rows[best.row].push([left, left + w]);
      out.push({ ...l, row: best.row, dx: left - l.xMin, width: w });
    }
  }
  return out;
}

// ── Main export ───────────────────────────────────────────────────────────────

export function computeTimelineLayout(
  claim: ClaimDetail,
  displayAxis: string | null,
  todayIso: string,
): TimelineLayout {
  const markers = buildMarkers(claim);
  const realCount = markers.length;
  const today = new Date(todayIso);
  const dormantWord = displayAxis === "REVERSED" ? "unchallenged" : "no new activity";

  const transitionsAsc = markers.flatMap(m => m.transitions);
  const stateAt = (t: number): string | null => {
    let axis: string | null = null;
    for (const tr of transitionsAsc) {
      if (new Date(tr.occurredAt).getTime() <= t) axis = tr.toAxis;
      else break;
    }
    return axis;
  };

  // ── Compact row: 0–1 real events ─────────────────────────────────────────────
  if (realCount <= 1) {
    const m = markers[0];
    const dormantMs = m ? today.getTime() - m.date.getTime() : 0;
    const lastT = m?.transitions[m.transitions.length - 1];
    const primary = m
      ? lastT
        ? axisLabelText(lastT.toAxis)
        : m.emerged
          ? "Emerged"
          : "Source published"
      : "No dated events yet";
    const title = m
      ? `${markerTitle(m)}\nNo other dated events on record.`
      : "Dates appear here once sources carry publication dates or the claim has recorded status transitions.";
    return {
      mode: "compact",
      dotColor: m ? axisColor(displayAxis ?? lastT?.toAxis) : "#4b5563",
      primary,
      dateLabel: m ? labelDate(m.date, m.prec) : null,
      dormantMs,
      dormantWord,
      title,
      markers,
    };
  }

  // ── Clustering ────────────────────────────────────────────────────────────────
  const todayMarker: Marker = {
    key: "today",
    date: today,
    prec: "DAY",
    emerged: false,
    emergedPrec: "DAY",
    transitions: [],
    sources: [],
    isToday: true,
  };
  const all = [...markers, todayMarker].sort(
    (a, b) => a.date.getTime() - b.date.getTime() || (a.isToday ? 1 : 0) - (b.isToday ? 1 : 0),
  );
  const first = all[0];
  const last = all[all.length - 1];
  const spanMs = Math.max(last.date.getTime() - first.date.getTime(), 1);
  const G = Math.max(90 * DAY_MS, 0.15 * spanMs);

  const clusters: Marker[][] = [];
  for (const m of all) {
    const cur = clusters[clusters.length - 1];
    if (!cur || m.date.getTime() - cur[cur.length - 1].date.getTime() > G) clusters.push([m]);
    else cur.push(m);
  }

  const allSingleton = clusters.every(c => c.length === 1);
  const isLinear = clusters.length === 1 || (allSingleton && realCount >= 3);
  const chrome = realCount >= 3;
  const clusterGroups: Marker[][] = isLinear ? [all] : clusters;

  const toRMarkers = (group: Marker[]): RMarker[] => {
    const real = group.filter(m => !m.isToday);
    const groupSpan =
      real.length > 1 ? real[real.length - 1].date.getTime() - real[0].date.getTime() : 0;
    const eventCount = real.reduce((n, m) => n + markerEventCount(m), 0);
    if (!isLinear && real.length > 5 && groupSpan <= 7 * DAY_MS) {
      const rep: RMarker = {
        type: "collapsed",
        members: real,
        date: real[Math.floor(real.length / 2)].date,
        count: eventCount,
      };
      const rest: RMarker[] = group.filter(m => m.isToday).map(m => ({ type: "m" as const, m }));
      return [rep, ...rest];
    }
    return group.map(m => ({ type: "m" as const, m }));
  };

  // ── Build segments ────────────────────────────────────────────────────────────
  const clusterSpans = clusterGroups.map(g =>
    g[g.length - 1].date.getTime() - g[0].date.getTime(),
  );
  const spanSum = clusterSpans.reduce((a, b) => a + b, 0);

  const segs: Seg[] = [];
  clusterGroups.forEach((group, ci) => {
    if (ci > 0) {
      const prev = clusterGroups[ci - 1];
      const from = prev[prev.length - 1].date;
      const to = group[0].date;
      const trailing = ci === clusterGroups.length - 1 && group.every(m => m.isToday);
      const axis = stateAt(from.getTime());
      const dur = fmtDur(to.getTime() - from.getTime());
      segs.push({
        kind: "break",
        from,
        to,
        trailing,
        axis,
        pill: trailing ? `${dur} · ${dormantWord}` : dur,
        title: `Compressed gap: ${fmtDay(from)} → ${trailing ? "today" : fmtDay(to)} (${dur})${axis ? ` · status throughout: ${axisLabelText(axis)}` : ""}`,
      });
    }

    const ms = toRMarkers(group);
    const t0 = group[0].date.getTime();
    const t1 = group[group.length - 1].date.getTime();
    const segSpan = t1 - t0;
    const n = ms.length;
    const minPx = isLinear ? Math.max(LINEAR_MIN, n * SLOT) : Math.max(MIN_CLUSTER, n * SLOT);
    const fracs = ms.map((r, i) =>
      segSpan >= DAY_MS ? (rDate(r).getTime() - t0) / segSpan : n === 1 ? 0.5 : (i + 0.5) / n,
    );

    const band: BandPart[] = [];
    const boundaries: { frac: number; axis: string; at: Date; prec: Prec }[] = [];
    group.forEach(m => {
      if (m.transitions.length === 0) return;
      const lastT = m.transitions[m.transitions.length - 1];
      const idx = ms.findIndex(
        r => (r.type === "m" && r.m === m) || (r.type === "collapsed" && r.members.includes(m)),
      );
      if (idx === -1) return;
      boundaries.push({ frac: fracs[idx], axis: lastT.toAxis, at: m.date, prec: m.prec });
    });
    let curAxis = stateAt(t0 - 1);
    let curFrom: { at: Date; prec: Prec } | null = null;
    let curF: number | null = null;
    if (transitionsAsc.length === 0) {
      band.push({
        f0: null,
        f1: null,
        color: displayAxis ? rgba(axisColor(displayAxis), BAND_ALPHA * 0.7) : PRE_BAND,
        title: displayAxis
          ? `${axisLabelText(displayAxis)} (no dated transitions on record)`
          : "No recorded status transitions",
      });
    } else {
      for (const b of boundaries) {
        band.push({
          f0: curF,
          f1: b.frac,
          color: curAxis ? rgba(axisColor(curAxis), BAND_ALPHA) : PRE_BAND,
          title: curAxis
            ? `${axisLabelText(curAxis)}${curFrom ? ` · since ${hoverDate(curFrom.at, curFrom.prec)}` : ""} · until ${hoverDate(b.at, b.prec)}`
            : `No recorded status until ${hoverDate(b.at, b.prec)}`,
        });
        curAxis = b.axis;
        curFrom = { at: b.at, prec: b.prec };
        curF = b.frac;
      }
      band.push({
        f0: curF,
        f1: null,
        color: curAxis ? rgba(axisColor(curAxis), BAND_ALPHA) : PRE_BAND,
        title: curAxis
          ? `${axisLabelText(curAxis)}${curFrom ? ` · since ${hoverDate(curFrom.at, curFrom.prec)}` : ""}`
          : "No recorded status transitions yet",
      });
    }

    const realYears = group.filter(m => !m.isToday).map(m => m.date.getUTCFullYear());
    const y0 = realYears[0];
    const y1 = realYears[realYears.length - 1];
    const todayIdx = ms.findIndex(r => r.type === "m" && r.m.isToday);
    segs.push({
      kind: "cluster",
      minPx,
      grow: spanSum > 0 ? Math.max(segSpan / spanSum, 0.04) : 1,
      t0,
      t1,
      ms,
      fracs,
      band,
      sublabel:
        chrome && !isLinear && realYears.length > 0 && !ms.some(r => r.type === "collapsed")
          ? y0 === y1
            ? `${y0}`
            : `${y0}–${y1}`
          : null,
      todayFrac: todayIdx >= 0 ? fracs[todayIdx] : null,
    });
  });

  // ── Minimum-width x positions ─────────────────────────────────────────────────
  const segX0: number[] = [];
  let acc = 0;
  segs.forEach(s => {
    segX0.push(acc);
    acc += s.kind === "cluster" ? s.minPx : BREAK_W;
  });
  const totalMin = acc;

  const anchorX = (segIdx: number, frac: number, extra: number): number => {
    const s = segs[segIdx] as ClusterSeg;
    return segX0[segIdx] + EDGE + frac * (s.minPx - 2 * EDGE) + extra;
  };

  const labelInputs: LabelInput[] = [];
  segs.forEach((s, si) => {
    if (s.kind !== "cluster") return;
    s.ms.forEach((r, i) => {
      const extra = BRACKET_W[rPrec(r)] / 2;
      labelInputs.push({
        segIdx: si,
        frac: s.fracs[i],
        anchorExtra: extra,
        xMin: anchorX(si, s.fracs[i], extra),
        text: rLabel(r),
        title: rTitle(r),
        leader: true,
        leaderColor:
          r.type === "m" && r.m.isToday
            ? AMBER
            : rLabel(r).color,
      });
    });
  });

  if (isLinear) {
    const lastReal = markers[markers.length - 1];
    const gap = today.getTime() - lastReal.date.getTime();
    if (gap > G) {
      const seg = segs[0] as ClusterSeg;
      const midFrac =
        ((lastReal.date.getTime() + today.getTime()) / 2 - seg.t0) / Math.max(seg.t1 - seg.t0, 1);
      labelInputs.push({
        segIdx: 0,
        frac: midFrac,
        anchorExtra: 0,
        xMin: anchorX(0, midFrac, 0),
        text: { l1: `${fmtDur(gap)} · ${dormantWord}`, color: AMBER },
        title: `No dated events between ${fmtDay(lastReal.date)} and today (${fmtDur(gap)})`,
        leader: false,
        leaderColor: AMBER,
        pillStyle: true,
      });
    }
  }

  const placedLabels = placeLabels(labelInputs, totalMin);

  // ── Sub-row ───────────────────────────────────────────────────────────────────
  const subIntervals: Array<[number, number]> = [];
  const pillDxBySeg = new Map<number, number>();
  segs.forEach((s, si) => {
    if (s.kind !== "break") return;
    const center = segX0[si] + BREAK_W / 2;
    const w = s.pill.length * 6.0 + 18;
    let x0 = center - w / 2;
    if (x0 + w > totalMin - 2) x0 = totalMin - 2 - w;
    if (x0 < 2) x0 = 2;
    subIntervals.push([x0, x0 + w]);
    pillDxBySeg.set(si, x0 + w / 2 - center);
  });
  const sublabelFits = segs.map((s, si) => {
    if (s.kind !== "cluster" || !s.sublabel) return false;
    const center = segX0[si] + s.minPx / 2;
    const w = s.sublabel.length * 5.8 + 4;
    const x0 = center - w / 2;
    return subIntervals.every(([a, b]) => x0 + w + 6 <= a || x0 - 6 >= b);
  });

  // ── Year ticks (linear mode only) ─────────────────────────────────────────────
  const ticks: { frac: number; year: number }[] = [];
  if (isLinear && chrome) {
    const seg = segs[0] as ClusterSeg;
    const spanYears = (seg.t1 - seg.t0) / (365.25 * DAY_MS);
    const step =
      spanYears <= 6 ? 1 : spanYears <= 12 ? 2 : spanYears <= 30 ? 5 : spanYears <= 60 ? 10 : spanYears <= 140 ? 25 : 50;
    const yStart = Math.ceil(new Date(seg.t0).getUTCFullYear() / step) * step;
    for (let y = yStart; y <= new Date(seg.t1).getUTCFullYear(); y += step) {
      const frac = (Date.UTC(y, 0, 1) - seg.t0) / Math.max(seg.t1 - seg.t0, 1);
      if (frac >= 0.02 && frac <= 0.98) ticks.push({ frac, year: y });
    }
  }

  // ── Aria label ────────────────────────────────────────────────────────────────
  const breakCount = segs.filter(s => s.kind === "break").length;
  const ariaLabel =
    `Adaptive timeline: ${realCount} dated event ${realCount === 1 ? "group" : "groups"} from ` +
    `${fmtDay(markers[0].date)} to ${fmtDay(markers[markers.length - 1].date)}` +
    (breakCount > 0 ? `, ${breakCount} compressed ${breakCount === 1 ? "gap" : "gaps"}` : ", linear scale") +
    "; today marked.";

  return {
    mode: "axis",
    segs,
    segX0,
    totalMin,
    placedLabels,
    sublabelFits,
    pillDxBySeg,
    ticks,
    isLinear,
    chrome,
    realCount,
    markers,
    ariaLabel,
  };
}
