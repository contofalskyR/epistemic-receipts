"use client";
import { useState, type ReactNode } from "react";
import type { ClaimDetail, EdgeDetail, StatusTransitionSummary } from "@/lib/claim-detail";
import { AXIS_VIS } from "@/app/components/SettlingCurveMini";
import { AXIS_CONFIG } from "@/components/EpistemicAxisBadge";
import { formatEmerged, type EmergedPrecision } from "@/lib/claimAge";

// ── Adaptive claim timeline (SPEC-adaptive-claim-timeline) ────────────────────
// One component for all 1.76M claims: gap-based clustering with EXPLICIT
// compression. Replaces the linear lifeline whose pathologies were overprinted
// labels (emergence colliding with a same-date entry transition), a cramped
// right edge when a fresh transition sat near "today", and a viewport spent on
// a multi-year void (receipt 5F358049).
//
// The component is a pure function of (claim events, todayIso). `todayIso` is
// passed from the server page — the ISR render moment — so SSR markup and
// hydration compute identical layouts (no `new Date()` divergence). All date
// formatting pins timeZone:"UTC" + "en-US" for the same reason.
//
// Algorithm (spec §"The algorithm"):
//   1. Events (emergence, ClaimStatusHistory rows, dated sources, today) are
//      day-merged: everything sharing a UTC day is ONE marker. This is what
//      fixes the screenshot collision — "Claim emerged Jan 1 2014" and
//      "→ RECORDED Jan 1 2014" are the same moment and render as one marker —
//      and what makes an unenriched OpenAlex claim (emergence + baseline row +
//      founding source, all on the publication date) count as ONE event for
//      the degenerate-shape decision (fixture 4).
//   2. Markers cluster when the gap to the previous exceeds
//      G = max(90 days, 0.15 × total span). Today is an event like any other,
//      so a fresh transition and today share a cluster (and a 52px slot each)
//      instead of cramping the right edge.
//   3. Mode: a single cluster, or all-singleton clusters, renders as a plain
//      linear axis (spec §5 — "a Plessy→Brown doctrine spread across decades
//      is already legible"). NOTE (spec ambiguity, resolved): the literal
//      "no gap exceeds G" condition can never hold for a decades-spread
//      doctrine (any 30–70yr gap exceeds 15% of span), yet fixture 2 demands
//      zero breaks for exactly that shape while fixture 3 demands breaks for
//      NZ enact/amend/repeal. The discriminator that satisfies both: breaks
//      earn their existence only when some cluster holds >1 marker (i.e. time
//      is unevenly distributed and the cluster needs day-scale room). All
//      singletons ⇒ linear. Fixture 3 still compresses because today clusters
//      with a recent repeal (a 2-marker cluster).
//   4. Degenerate shapes: ≤1 real marker → 44px compact row (no axis);
//      2 real markers → same engine, chrome suppressed, compression forced so
//      the dominant gap renders as a labeled pill (spec §4).
//   5. Width: cluster minimum = max(64px, n × 52px); breaks are fixed 34px
//      zigzag glyphs with their true duration labeled beneath; remaining width
//      flexes to clusters proportional to their internal time spans
//      (flex-grow = span share). Label collision is solved by a greedy 3-row
//      stagger computed at MINIMUM widths — flex growth only increases every
//      pairwise distance, so a collision-free minimum layout is collision-free
//      at every width ≥ 375px (the acceptance criterion).
//
// Interactivity is deliberately thin (hence one small useState): source
// markers are #evidence-<edgeId> anchors into the evidence table, transition
// and collapsed markers toggle the event-list panel below the strip (the
// transition analog of "scroll to the row" — the page has no transitions
// table), everything carries a native title tooltip (robust inside the
// horizontal-scroll container, works without JS). The statusHistory payload
// carries no `reason` field (kept: the page's data contract is frozen), so
// hovers show date + fromAxis → toAxis + community instead of a reason line.

// ── Constants ─────────────────────────────────────────────────────────────────

const DAY_MS = 86_400_000;

const SLOT = 52; // px per marker inside a cluster (spec §3)
const BREAK_W = 34; // fixed break glyph width (spec §3)
const MIN_CLUSTER = 64; // minClusterPx (spec leaves the value open)
const LINEAR_MIN = 320; // minimum content width for the plain linear axis
const EDGE = 26; // half-slot inset so edge markers never sit on a seam
const LABEL_PAD = 8; // required padding between staggered labels (spec)

// Vertical geometry. Strip = 154px; with card padding the timeline card totals
// ~176px in EVERY strip mode — inside the spec's constant 150–180px cap.
const STRIP_H = 154;
const AXIS_Y = 104;
const ROW_H = 28; // one label row (two 10px lines + chip padding)
const LABEL_BOTTOM = 88; // row r's chip bottom sits at LABEL_BOTTOM − r·ROW_H
const BAND_Y = 124;
const BAND_H = 7;
const SUB_Y = 134; // break pills / cluster sublabels / year ticks

const BLUE = "#60a5fa"; // emergence (existing page palette)
const SLATE = "#94a3b8"; // sources
const AMBER = "#f0a000"; // today / dormancy (existing page palette)
const MUT = "#888898";
const DIM = "#3a3a55";
const DATE_C = "#b0b0c8";
const CARD_BG = "#0e0e1c";
const BORDER = "#1e1e38";
const AXIS_LINE = "#26263f";
const PRE_BAND = "rgba(100,116,139,0.10)"; // before the first transition

const BAND_ALPHA = 0.5;
const BAND_ALPHA_BREAK = 0.25; // ~50% of the in-cluster opacity (spec)

type Prec = EmergedPrecision;
const PREC_RANK: Record<Prec, number> = { DAY: 0, MONTH: 1, QUARTER: 2, YEAR: 3 };
// Precision renders as geometry: DAY = dot; MONTH/QUARTER = short bracket;
// YEAR = wide bracket (spec honesty rules). Symbolic widths — the axis inside
// a cluster is already event-count-scaled, so a literal calendar-width span
// would be meaningless.
const BRACKET_W: Record<Prec, number> = { DAY: 0, MONTH: 14, QUARTER: 20, YEAR: 30 };

// ── Small helpers ─────────────────────────────────────────────────────────────

function toPrec(p: string | null | undefined): Prec {
  return p === "MONTH" || p === "QUARTER" || p === "YEAR" ? p : "DAY";
}

function rgba(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function axisColor(axis: string | null | undefined): string {
  return (axis && AXIS_VIS[axis]?.color) || SLATE;
}

function axisLabelText(axis: string | null | undefined): string {
  if (!axis) return "Unclassified";
  return AXIS_CONFIG[axis]?.label ?? AXIS_VIS[axis]?.label ?? axis;
}

function fmtDay(d: Date): string {
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
}

/** Precision-honest date text (house convention — YEAR never renders a day). */
function fmtPrec(d: Date, prec: Prec): string {
  return prec === "DAY" ? fmtDay(d) : formatEmerged(d.toISOString(), prec);
}

/** Visible-label form: YEAR carries the "(year precision)" suffix (spec). */
function labelDate(d: Date, prec: Prec): string {
  return prec === "YEAR" ? `${fmtPrec(d, prec)} (year precision)` : fmtPrec(d, prec);
}

/** Hover form: every non-DAY precision is spelled out. */
function hoverDate(d: Date, prec: Prec): string {
  return prec === "DAY" ? fmtDay(d) : `${fmtPrec(d, prec)} (${prec.toLowerCase()} precision)`;
}

function fmtDur(ms: number): string {
  const days = ms / DAY_MS;
  if (days < 365.25) return `${Math.max(1, Math.round(days / 30.44))} mo`;
  const r = Math.round((days / 365.25) * 10) / 10;
  return `${Number.isInteger(r) ? r.toFixed(0) : r.toFixed(1)} yrs`;
}

function voteText(e: EdgeDetail): string | null {
  const v = e.source.legislativeVotes?.[0];
  if (!v) return null;
  return `${v.yesCount ?? 0}–${v.noCount ?? 0}${v.passageType ? ` · ${v.passageType}` : ""}`;
}

function transitionChain(t: StatusTransitionSummary): string {
  return `${t.fromAxis ? `${t.fromAxis} → ` : "→ "}${t.toAxis}`;
}

// ── Event model: day-merged markers ───────────────────────────────────────────

type Marker = {
  key: string; // UTC day key
  date: Date; // UTC midnight of the day (today: exact render moment)
  prec: Prec; // coarsest precision among members (never overstates precision)
  emerged: boolean;
  emergedPrec: Prec;
  transitions: StatusTransitionSummary[]; // in seq order (the tiebreak authority)
  sources: EdgeDetail[];
  isToday: boolean;
};

function buildMarkers(claim: ClaimDetail): Marker[] {
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

  // seq is the order authority within equal dates (transition contract §6).
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

function markerEventCount(m: Marker): number {
  return m.transitions.length + m.sources.length + (m.emerged ? 1 : 0);
}

function markerTitle(m: Marker): string {
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

type LabelText = { l1: string; l2?: string; color: string; small?: boolean };

function markerLabel(m: Marker): LabelText {
  if (m.isToday) return { l1: "today", l2: fmtDay(m.date), color: AMBER };
  const lastT = m.transitions[m.transitions.length - 1];
  if (lastT) {
    const chain = transitionChain(lastT);
    // A same-day emergence merges into the entry transition's label — the
    // exact overprint the old timeline suffered from ("Claim emerged" vs
    // "→ RECORDED" on the same date).
    const l1 = m.emerged ? (lastT.fromAxis ? `Emerged · ${chain}` : `Emerged ${chain}`) : chain;
    return { l1, l2: labelDate(m.date, m.prec), color: axisColor(lastT.toAxis) };
  }
  if (m.emerged) return { l1: "Emerged", l2: labelDate(m.date, m.emergedPrec), color: BLUE };
  if (m.sources.length > 1) return { l1: `${m.sources.length} sources`, l2: fmtDay(m.date), color: SLATE };
  // Single dated source: one dim date line — sources live in the evidence
  // table below; the timeline only needs their position.
  return { l1: fmtDay(m.date), color: SLATE, small: true };
}

// ── Render markers (a day-marker, or a collapsed dense cluster) ───────────────

type RMarker =
  | { type: "m"; m: Marker }
  | { type: "collapsed"; members: Marker[]; date: Date; count: number };

function rDate(r: RMarker): Date {
  return r.type === "m" ? r.m.date : r.date;
}

function rPrec(r: RMarker): Prec {
  return r.type === "m" ? r.m.prec : "DAY";
}

function collapsedRange(members: Marker[]): string {
  const a = members[0].date;
  const b = members[members.length - 1].date;
  if (a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth()) {
    const mo = a.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
    return `${mo} ${a.getUTCDate()}–${b.getUTCDate()}, ${a.getUTCFullYear()}`;
  }
  return `${fmtDay(a)} – ${fmtDay(b)}`;
}

function rLabel(r: RMarker): LabelText {
  if (r.type === "m") return markerLabel(r.m);
  const lastT = [...r.members].reverse().find(m => m.transitions.length > 0)?.transitions.slice(-1)[0];
  return {
    l1: `${r.count} events`,
    l2: collapsedRange(r.members),
    color: lastT ? axisColor(lastT.toAxis) : SLATE,
  };
}

function rTitle(r: RMarker): string {
  if (r.type === "m") return markerTitle(r.m);
  return `${r.count} events · ${collapsedRange(r.members)} — click to expand the list below`;
}

// ── Layout ────────────────────────────────────────────────────────────────────

type BandPart = {
  f0: number | null; // null = seg left edge
  f1: number | null; // null = seg right edge
  color: string;
  title: string;
};

type ClusterSeg = {
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

type BreakSeg = {
  kind: "break";
  from: Date;
  to: Date;
  trailing: boolean;
  axis: string | null; // status in force through the gap
  pill: string;
  title: string;
};

type Seg = ClusterSeg | BreakSeg;

type PlacedLabel = {
  segIdx: number;
  frac: number;
  anchorExtra: number; // bracket-center offset (px)
  row: number;
  dx: number; // chip left edge relative to the anchor, px
  width: number | null; // set only when truncated to fit
  text: LabelText;
  title: string;
  leader: boolean;
  leaderColor: string;
  pillStyle?: boolean;
};

/** Greedy 3-row label stagger at minimum widths. Flex growth only increases
 *  pairwise marker distances, so no-overlap here means no-overlap at every
 *  wider rendering — the spec's acceptance criterion, made deterministic. */
function placeLabels(
  labels: {
    segIdx: number;
    frac: number;
    anchorExtra: number;
    xMin: number;
    text: LabelText;
    title: string;
    leader: boolean;
    leaderColor: string;
    pillStyle?: boolean;
  }[],
  totalMin: number,
): PlacedLabel[] {
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

    // Fallback: shrink into the widest free slot around the anchor. Never
    // overprint — truncate (title carries the full text) or go marker-only.
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
    // else: no room at all — the marker + its tooltip carry the information.
  }
  return out;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AdaptiveClaimTimeline({
  claim,
  displayAxis,
  todayIso,
}: {
  claim: ClaimDetail;
  /** resolveDisplayAxis(claim), computed by the server page (axis-leak rule). */
  displayAxis: string | null;
  /** ISR render moment — today for BOTH server and hydration renders. */
  todayIso: string;
}) {
  const [panelOpen, setPanelOpen] = useState(false);

  const markers = buildMarkers(claim);
  const realCount = markers.length;
  const today = new Date(todayIso);
  const dormantWord = displayAxis === "REVERSED" ? "unchallenged" : "no new activity";

  // Ascending transitions again for band state (cheap; markers hold refs).
  const transitionsAsc = markers.flatMap(m => m.transitions);
  const stateAt = (t: number): string | null => {
    let axis: string | null = null;
    for (const tr of transitionsAsc) {
      if (new Date(tr.occurredAt).getTime() <= t) axis = tr.toAxis;
      else break;
    }
    return axis;
  };

  // ── Shape 4 / empty: 0–1 real events → 44px compact row, no axis ────────────
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
    return (
      <div
        title={title}
        style={{
          height: 44,
          background: CARD_BG,
          border: `1px solid ${BORDER}`,
          borderRadius: 12,
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "0 16px",
          boxSizing: "border-box",
        }}
      >
        <span
          style={{
            width: 9,
            height: 9,
            borderRadius: "50%",
            background: m ? axisColor(displayAxis ?? lastT?.toAxis) : "#4b5563",
            flexShrink: 0,
          }}
        />
        <span
          className="text-sm text-gray-200"
          style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
        >
          {primary}
          {m && <span style={{ color: DATE_C }}> {labelDate(m.date, m.prec)}</span>}
        </span>
        {m && dormantMs > 90 * DAY_MS && (
          <span style={{ marginLeft: "auto", fontSize: 11, color: MUT, whiteSpace: "nowrap" }}>
            {fmtDur(dormantMs)} · {dormantWord}
          </span>
        )}
      </div>
    );
  }

  // ── Cluster (today is an event; it clusters like any other) ─────────────────
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
  // Shape 2 (plain linear axis, zero breaks): one cluster, or evenly-spread
  // singleton history. 2-real-marker claims are excluded — spec §4 wants their
  // dominant gap as an explicit pill, and their chrome suppressed.
  const isLinear = clusters.length === 1 || (allSingleton && realCount >= 3);
  const chrome = realCount >= 3;
  const clusterGroups: Marker[][] = isLinear ? [all] : clusters;

  // Collapse rule (spec label-collision §): >5 events inside one week.
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

  // ── Build segments ───────────────────────────────────────────────────────────
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
        // Dormancy is information: the trailing gap gets the honest label.
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
    // Positions are linear in time inside a cluster (spec §3). Sub-day spans
    // spread evenly — same-day markers should not fake intra-day chronology.
    const fracs = ms.map((r, i) =>
      segSpan >= DAY_MS ? (rDate(r).getTime() - t0) / segSpan : n === 1 ? 0.5 : (i + 0.5) / n,
    );

    // Status band parts: boundaries at transition markers, carry-in from the
    // previous history. Null axis (pre-entry) renders the muted PRE_BAND.
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
    let curF: number | null = null; // null = seg left edge
    // If the claim has no transitions at all, the whole band shows the display
    // axis ("what is true now") rather than pretending a status chain exists.
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

  // ── Minimum-width x positions (label collision math) ─────────────────────────
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

  const labelInputs: Parameters<typeof placeLabels>[0] = [];
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

  // Linear mode has no trailing break glyph, but the dormancy rule still holds:
  // the trailing stretch gets an explicit labeled chip when it exceeds G.
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

  // ── Sub-row: break pills first (mandatory), then sublabels that fit ──────────
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
    pillDxBySeg.set(si, x0 + w / 2 - center); // clamp offset of the pill CENTER
  });
  const sublabelFits = segs.map((s, si) => {
    if (s.kind !== "cluster" || !s.sublabel) return false;
    const center = segX0[si] + s.minPx / 2;
    const w = s.sublabel.length * 5.8 + 4;
    const x0 = center - w / 2;
    return subIntervals.every(([a, b]) => x0 + w + 6 <= a || x0 - 6 >= b);
  });

  // Year ticks — linear mode only (a compressed axis has no uniform timescale).
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

  // ── Render ───────────────────────────────────────────────────────────────────
  // Anchor calc: EDGE + frac × (clusterWidth − 2·EDGE), expressed so it tracks
  // flex growth: frac·100% − frac·2·EDGE px + EDGE px (+ bracket offset).
  const anchorCalc = (frac: number, extra = 0) =>
    `calc(${(frac * 100).toFixed(3)}% + ${(EDGE + extra - frac * 2 * EDGE).toFixed(2)}px)`;

  const breakCount = segs.filter(s => s.kind === "break").length;
  const ariaLabel =
    `Adaptive timeline: ${realCount} dated event ${realCount === 1 ? "group" : "groups"} from ` +
    `${fmtDay(markers[0].date)} to ${fmtDay(markers[markers.length - 1].date)}` +
    (breakCount > 0 ? `, ${breakCount} compressed ${breakCount === 1 ? "gap" : "gaps"}` : ", linear scale") +
    "; today marked.";

  const panelToggle = () => setPanelOpen(v => !v);

  return (
    <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 12, position: "relative" }}>
      <div style={{ overflowX: "auto", overflowY: "hidden", borderRadius: 12 }}>
        <div style={{ minWidth: totalMin + 28, padding: "11px 14px 9px" }}>
          <div
            role="group"
            aria-label={ariaLabel}
            style={{ position: "relative", height: STRIP_H, display: "flex", alignItems: "stretch", width: "100%" }}
          >
            {segs.map((s, si) => {
              if (s.kind === "break") {
                const pillDx = pillDxBySeg.get(si) ?? 0;
                return (
                  <div
                    key={`b-${si}`}
                    title={s.title}
                    style={{ position: "relative", flex: `0 0 ${BREAK_W}px`, minWidth: BREAK_W }}
                  >
                    {/* zigzag break glyph — compression is always explicit */}
                    <svg
                      width={BREAK_W}
                      height={20}
                      style={{ position: "absolute", left: 0, top: AXIS_Y - 10, overflow: "visible" }}
                      aria-hidden
                    >
                      <path
                        d={`M0 10 H${BREAK_W / 2 - 7} L${BREAK_W / 2 - 3} 2 L${BREAK_W / 2 + 3} 18 L${BREAK_W / 2 + 7} 10 H${BREAK_W}`}
                        fill="none"
                        stroke="#4a4a68"
                        strokeWidth={1.5}
                      />
                    </svg>
                    {/* status continues while time is compressed: ~50% opacity */}
                    <div
                      title={s.axis ? `${axisLabelText(s.axis)} throughout this gap` : "No recorded status through this gap"}
                      style={{
                        position: "absolute",
                        left: 0,
                        right: 0,
                        top: BAND_Y,
                        height: BAND_H,
                        background: s.axis ? rgba(axisColor(s.axis), BAND_ALPHA_BREAK) : PRE_BAND,
                      }}
                    />
                    {/* true duration, labeled beneath the glyph */}
                    <span
                      style={{
                        position: "absolute",
                        left: `calc(50% + ${pillDx.toFixed(1)}px)`,
                        transform: "translateX(-50%)",
                        top: SUB_Y,
                        fontSize: 10,
                        whiteSpace: "nowrap",
                        padding: "2px 8px",
                        borderRadius: 20,
                        background: s.trailing ? "rgba(240,160,0,0.10)" : "rgba(136,136,152,0.08)",
                        border: s.trailing ? "1px solid rgba(240,160,0,0.28)" : "1px solid rgba(136,136,152,0.22)",
                        color: s.trailing ? AMBER : MUT,
                        zIndex: 6,
                      }}
                    >
                      {s.pill}
                    </span>
                  </div>
                );
              }

              return (
                <div
                  key={`c-${si}`}
                  style={{
                    position: "relative",
                    flexGrow: s.grow,
                    flexShrink: 0,
                    flexBasis: s.minPx,
                    minWidth: s.minPx,
                  }}
                >
                  {/* axis line */}
                  <div
                    style={{ position: "absolute", left: 0, right: 0, top: AXIS_Y - 1, height: 2, background: AXIS_LINE }}
                  />
                  {/* status band — always full width, colored by toAxis */}
                  {s.band.map((p, pi) => (
                    <div
                      key={pi}
                      title={p.title}
                      style={{
                        position: "absolute",
                        top: BAND_Y,
                        height: BAND_H,
                        left: p.f0 === null ? 0 : anchorCalc(p.f0),
                        ...(p.f1 === null
                          ? { right: 0 }
                          : {
                              width: `calc(${(((p.f1 ?? 0) - (p.f0 ?? 0)) * 100).toFixed(3)}% - ${((((p.f1 ?? 0) - (p.f0 ?? 0)) * 2 * EDGE) - (p.f0 === null ? EDGE : 0)).toFixed(2)}px)`,
                            }),
                        background: p.color,
                      }}
                    />
                  ))}
                  {/* year ticks (linear mode) */}
                  {ticks.length > 0 &&
                    si === 0 &&
                    ticks.map(t => (
                      <div key={t.year}>
                        <div
                          style={{
                            position: "absolute",
                            left: anchorCalc(t.frac),
                            top: BAND_Y + BAND_H + 2,
                            width: 1,
                            height: 5,
                            background: BORDER,
                          }}
                        />
                        <span
                          style={{
                            position: "absolute",
                            left: anchorCalc(t.frac),
                            top: SUB_Y + 6,
                            transform: "translateX(-50%)",
                            fontSize: 10,
                            color: DIM,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {t.year}
                        </span>
                      </div>
                    ))}
                  {/* cluster date-range sublabel */}
                  {s.sublabel && sublabelFits[si] && (
                    <span
                      style={{
                        position: "absolute",
                        left: "50%",
                        top: SUB_Y + 6,
                        transform: "translateX(-50%)",
                        fontSize: 10,
                        color: DIM,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {s.sublabel}
                    </span>
                  )}
                  {/* today: full-height hairline */}
                  {s.todayFrac !== null && (
                    <div
                      style={{
                        position: "absolute",
                        left: anchorCalc(s.todayFrac),
                        top: 0,
                        bottom: 0,
                        width: 1,
                        background: "rgba(240,160,0,0.16)",
                      }}
                    />
                  )}
                  {/* markers */}
                  {s.ms.map((r, mi) => {
                    const prec = rPrec(r);
                    const bw = BRACKET_W[prec];
                    const text = rLabel(r);
                    const title = rTitle(r);
                    const isToday = r.type === "m" && r.m.isToday;
                    const sourceOnly =
                      r.type === "m" && !r.m.isToday && !r.m.emerged && r.m.transitions.length === 0;
                    // markerLabel already resolves the semantic color (axis /
                    // emerged-blue / source-slate); today is always amber.
                    const color = isToday ? AMBER : text.color;

                    const glyph =
                      bw > 0 ? (
                        // MONTH/QUARTER = short bracket, YEAR = wide bracket —
                        // a coarse date never sits at a fabricated day position.
                        <svg
                          width={bw}
                          height={14}
                          style={{ position: "absolute", left: -bw / 2, top: AXIS_Y - 7, overflow: "visible" }}
                          aria-hidden
                        >
                          <path
                            d={`M0.75 2 V12 M0.75 7 H${bw - 0.75} M${bw - 0.75} 2 V12`}
                            fill="none"
                            stroke={color}
                            strokeWidth={1.5}
                          />
                        </svg>
                      ) : isToday ? (
                        <>
                          <div
                            aria-hidden
                            style={{
                              position: "absolute",
                              left: -18,
                              top: AXIS_Y - 18,
                              width: 36,
                              height: 36,
                              borderRadius: "50%",
                              background: "radial-gradient(circle, rgba(240,160,0,0.22) 0%, transparent 68%)",
                            }}
                          />
                          <div
                            style={{
                              position: "absolute",
                              left: -4.5,
                              top: AXIS_Y - 4.5,
                              width: 9,
                              height: 9,
                              borderRadius: "50%",
                              background: AMBER,
                              zIndex: 5,
                            }}
                          />
                        </>
                      ) : sourceOnly ? (
                        <div
                          style={{
                            position: "absolute",
                            left: -3.5,
                            top: AXIS_Y - 3.5,
                            width: 7,
                            height: 7,
                            borderRadius: "50%",
                            background: SLATE,
                            opacity: 0.9,
                            zIndex: 4,
                          }}
                        />
                      ) : (
                        <>
                          <div
                            style={{
                              position: "absolute",
                              left: r.type === "collapsed" ? -11 : -9,
                              top: AXIS_Y - (r.type === "collapsed" ? 11 : 9),
                              width: r.type === "collapsed" ? 22 : 18,
                              height: r.type === "collapsed" ? 22 : 18,
                              borderRadius: "50%",
                              border: `1.5px solid ${color}`,
                              background: rgba(color, 0.07),
                              zIndex: 4,
                            }}
                          />
                          <div
                            style={{
                              position: "absolute",
                              left: -4,
                              top: AXIS_Y - 4,
                              width: 8,
                              height: 8,
                              borderRadius: "50%",
                              background: color,
                              zIndex: 5,
                            }}
                          />
                        </>
                      );

                    const hit = Math.max(24, bw + 8);
                    const interactive = (
                      r.type === "collapsed" || (r.type === "m" && r.m.transitions.length > 0)
                        ? { as: "button" as const }
                        : sourceOnly && r.type === "m" && r.m.sources[0]
                          ? { as: "a" as const, href: `#evidence-${r.m.sources[0].id}` }
                          : { as: "div" as const }
                    );

                    return (
                      <div
                        key={`m-${mi}`}
                        style={{ position: "absolute", left: anchorCalc(s.fracs[mi], bw / 2), top: 0, bottom: 0, width: 0 }}
                      >
                        {glyph}
                        {interactive.as === "button" ? (
                          <button
                            type="button"
                            title={`${title}\n\nClick to ${panelOpen ? "hide" : "list"} all dated events`}
                            aria-label={`${text.l1} — toggle event list`}
                            onClick={panelToggle}
                            style={{
                              position: "absolute",
                              left: -hit / 2,
                              top: AXIS_Y - hit / 2,
                              width: hit,
                              height: hit,
                              background: "none",
                              border: "none",
                              padding: 0,
                              cursor: "pointer",
                              zIndex: 7,
                            }}
                          />
                        ) : interactive.as === "a" ? (
                          <a
                            href={interactive.href}
                            title={`${title}\n\nClick to jump to this source in the evidence table`}
                            aria-label={`${title.split("\n")[0]} — jump to evidence row`}
                            style={{
                              position: "absolute",
                              left: -hit / 2,
                              top: AXIS_Y - hit / 2,
                              width: hit,
                              height: hit,
                              zIndex: 7,
                            }}
                          />
                        ) : (
                          <div
                            title={title}
                            style={{
                              position: "absolute",
                              left: -hit / 2,
                              top: AXIS_Y - hit / 2,
                              width: hit,
                              height: hit,
                              zIndex: 6,
                            }}
                          />
                        )}
                      </div>
                    );
                  })}
                  {/* labels + leader lines for this cluster */}
                  {placedLabels
                    .filter(l => l.segIdx === si)
                    .map((l, li) => {
                      const bottom = STRIP_H - (LABEL_BOTTOM - l.row * ROW_H);
                      const leaderTop = LABEL_BOTTOM - l.row * ROW_H + 2;
                      return (
                        <div key={`l-${li}`} style={{ position: "absolute", left: anchorCalc(l.frac, l.anchorExtra), top: 0, bottom: 0, width: 0 }}>
                          {l.leader && (
                            <div
                              aria-hidden
                              style={{
                                position: "absolute",
                                left: -0.5,
                                top: leaderTop,
                                height: Math.max(AXIS_Y - 13 - leaderTop, 0),
                                width: 1,
                                background: rgba(l.leaderColor, 0.3),
                                zIndex: 1,
                              }}
                            />
                          )}
                          <div
                            title={l.title}
                            style={{
                              position: "absolute",
                              left: l.dx,
                              bottom,
                              whiteSpace: "nowrap",
                              ...(l.width !== null ? { width: l.width, overflow: "hidden" } : {}),
                              background: "rgba(14,14,28,0.92)",
                              borderRadius: 5,
                              padding: l.pillStyle ? "2px 8px" : "1px 5px",
                              ...(l.pillStyle
                                ? { border: "1px solid rgba(240,160,0,0.28)", borderRadius: 20 }
                                : {}),
                              zIndex: 4,
                              lineHeight: 1.25,
                            }}
                          >
                            <span
                              style={{
                                display: "block",
                                fontSize: l.text.small ? 9 : 10,
                                fontWeight: l.text.small ? 400 : 600,
                                color: l.text.color,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {l.text.l1}
                            </span>
                            {l.text.l2 && (
                              <span
                                style={{
                                  display: "block",
                                  fontSize: 10,
                                  fontWeight: 500,
                                  color: DATE_C,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                              >
                                {l.text.l2}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Event list — the transition analog of "scroll to the row"; also the
          expansion target for collapsed dense clusters. */}
      {panelOpen && (
        <div style={{ borderTop: `1px solid ${BORDER}`, padding: "10px 16px 12px" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-600">
              All dated events
            </p>
            <button
              type="button"
              onClick={panelToggle}
              className="text-[10px] text-gray-600 hover:text-gray-400 transition-colors"
            >
              close ✕
            </button>
          </div>
          <ul className="space-y-1">
            {markers.flatMap(m => {
              const rows: ReactNode[] = [];
              if (m.emerged) {
                rows.push(
                  <li key={`${m.key}-e`} className="flex items-baseline gap-3 text-xs">
                    <span className="shrink-0 w-44 text-gray-500">{hoverDate(m.date, m.emergedPrec)}</span>
                    <span style={{ color: BLUE }}>Claim emerged</span>
                  </li>,
                );
              }
              m.transitions.forEach((t, i) => {
                rows.push(
                  <li key={`${m.key}-t${i}`} className="flex items-baseline gap-3 text-xs">
                    <span className="shrink-0 w-44 text-gray-500">
                      {hoverDate(new Date(t.occurredAt), toPrec(t.datePrecision))}
                    </span>
                    <span style={{ color: axisColor(t.toAxis), fontWeight: 600 }}>{transitionChain(t)}</span>
                    <span className="text-gray-600">{t.community.replace(/_/g, " ")}</span>
                  </li>,
                );
              });
              m.sources.forEach((e, i) => {
                const v = voteText(e);
                rows.push(
                  <li key={`${m.key}-s${i}`} className="flex items-baseline gap-3 text-xs">
                    <span className="shrink-0 w-44 text-gray-500">{fmtDay(new Date(e.source.publishedAt!))}</span>
                    <a
                      href={`#evidence-${e.id}`}
                      className="text-gray-300 hover:text-white hover:underline underline-offset-2"
                    >
                      {e.source.name}
                    </a>
                    {v && <span className="text-gray-600">{v}</span>}
                  </li>,
                );
              });
              return rows;
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
