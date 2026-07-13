"use client";
import { useState, type ReactNode } from "react";
import type { ClaimDetail, EdgeDetail, StatusTransitionSummary } from "@/lib/claim-detail";
import {
  computeTimelineLayout,
  anchorCalc,
  fmtDay, hoverDate, voteText, transitionChain, labelDate, fmtDur, axisColor, axisLabelText, rgba,
  type Marker, type RMarker, type BreakSeg, type ClusterSeg,
  AMBER, MUT, DATE_C, CARD_BG, BORDER, AXIS_LINE, SLATE, DIM,
  STRIP_H, AXIS_Y, ROW_H, LABEL_BOTTOM, BAND_Y, BAND_H, SUB_Y,
  BREAK_W, EDGE, BRACKET_W, BAND_ALPHA_BREAK, DAY_MS,
  toPrec,
} from "@/lib/timeline-layout";

// ── Adaptive claim timeline (SPEC-adaptive-claim-timeline) ────────────────────
// One component for all 1.76M claims: gap-based clustering with EXPLICIT
// compression. Replaces the linear lifeline whose pathologies were overprinted
// labels (emergence colliding with a same-date entry transition), a cramped
// right edge when a fresh transition sat near "today", and a viewport spent on
// a multi-year void (receipt 5F358049).
//
// All geometry lives in lib/timeline-layout.ts — the acceptance-tested pure
// engine. This file is JSX-only: consume the layout object, render markup.
// See lib/timeline-layout.ts for algorithm notes and acceptance shapes.

// ── Helpers used only in JSX ──────────────────────────────────────────────────

function markerTitleJsx(m: Marker): string {
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

function rLabelJsx(r: RMarker): LabelText {
  if (r.type === "m") {
    const m = r.m;
    if (m.isToday) return { l1: "today", l2: fmtDay(m.date), color: AMBER };
    const lastT = m.transitions[m.transitions.length - 1];
    if (lastT) {
      const chain = transitionChain(lastT);
      const l1 = m.emerged ? (lastT.fromAxis ? `Emerged · ${chain}` : `Emerged ${chain}`) : chain;
      return { l1, l2: labelDate(m.date, m.prec), color: axisColor(lastT.toAxis) };
    }
    if (m.emerged) return { l1: "Emerged", l2: labelDate(m.date, m.emergedPrec), color: "#60a5fa" };
    if (m.sources.length > 1) return { l1: `${m.sources.length} sources`, l2: fmtDay(m.date), color: SLATE };
    return { l1: fmtDay(m.date), color: SLATE, small: true };
  }
  const lastT = [...r.members].reverse().find(m => m.transitions.length > 0)?.transitions.slice(-1)[0];
  const a = r.members[0].date, b = r.members[r.members.length - 1].date;
  const sameMonth = a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth();
  const mo = a.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  const range = sameMonth
    ? `${mo} ${a.getUTCDate()}–${b.getUTCDate()}, ${a.getUTCFullYear()}`
    : `${fmtDay(a)} – ${fmtDay(b)}`;
  return { l1: `${r.count} events`, l2: range, color: lastT ? axisColor(lastT.toAxis) : SLATE };
}

function rTitleJsx(r: RMarker, panelOpen: boolean): string {
  if (r.type === "m") {
    const t = markerTitleJsx(r.m);
    if (r.m.transitions.length > 0 || r.m.isToday === false) {
      return r.m.transitions.length > 0
        ? `${t}\n\nClick to ${panelOpen ? "hide" : "list"} all dated events`
        : t;
    }
    return t;
  }
  const a = r.members[0].date, b = r.members[r.members.length - 1].date;
  const sameMonth = a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth();
  const mo = a.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  const range = sameMonth
    ? `${mo} ${a.getUTCDate()}–${b.getUTCDate()}, ${a.getUTCFullYear()}`
    : `${fmtDay(a)} – ${fmtDay(b)}`;
  return `${r.count} events · ${range} — click to expand the list below`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AdaptiveClaimTimeline({
  claim,
  displayAxis,
  todayIso,
}: {
  claim: ClaimDetail;
  displayAxis: string | null;
  todayIso: string;
}) {
  const [panelOpen, setPanelOpen] = useState(false);

  const layout = computeTimelineLayout(claim, displayAxis, todayIso);
  const panelToggle = () => setPanelOpen(v => !v);

  // ── Compact row ──────────────────────────────────────────────────────────────
  if (layout.mode === "compact") {
    const { dotColor, primary, dateLabel, dormantMs, dormantWord, title } = layout;
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
        <span style={{ width: 9, height: 9, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
        <span
          className="text-sm text-gray-200"
          style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
        >
          {primary}
          {dateLabel && <span style={{ color: DATE_C }}> {dateLabel}</span>}
        </span>
        {dormantMs > 90 * DAY_MS && (
          <span style={{ marginLeft: "auto", fontSize: 11, color: MUT, whiteSpace: "nowrap" }}>
            {fmtDur(dormantMs)} · {dormantWord}
          </span>
        )}
      </div>
    );
  }

  // ── Axis mode ─────────────────────────────────────────────────────────────────
  const { segs, segX0, totalMin, placedLabels, sublabelFits, pillDxBySeg, ticks, markers, ariaLabel } = layout;

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
                const bs = s as BreakSeg;
                const pillDx = pillDxBySeg.get(si) ?? 0;
                return (
                  <div
                    key={`b-${si}`}
                    title={bs.title}
                    style={{ position: "relative", flex: `0 0 ${BREAK_W}px`, minWidth: BREAK_W }}
                  >
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
                    <div
                      title={bs.axis ? `${axisLabelText(bs.axis)} throughout this gap` : "No recorded status through this gap"}
                      style={{
                        position: "absolute",
                        left: 0,
                        right: 0,
                        top: BAND_Y,
                        height: BAND_H,
                        background: bs.axis ? rgba(axisColor(bs.axis), BAND_ALPHA_BREAK) : "rgba(100,116,139,0.10)",
                      }}
                    />
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
                        background: bs.trailing ? "rgba(240,160,0,0.10)" : "rgba(136,136,152,0.08)",
                        border: bs.trailing ? "1px solid rgba(240,160,0,0.28)" : "1px solid rgba(136,136,152,0.22)",
                        color: bs.trailing ? AMBER : MUT,
                        zIndex: 6,
                      }}
                    >
                      {bs.pill}
                    </span>
                  </div>
                );
              }

              const cs = s as ClusterSeg;
              return (
                <div
                  key={`c-${si}`}
                  style={{
                    position: "relative",
                    flexGrow: cs.grow,
                    flexShrink: 0,
                    flexBasis: cs.minPx,
                    minWidth: cs.minPx,
                  }}
                >
                  <div style={{ position: "absolute", left: 0, right: 0, top: AXIS_Y - 1, height: 2, background: AXIS_LINE }} />
                  {cs.band.map((p, pi) => (
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
                  {cs.sublabel && sublabelFits[si] && (
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
                      {cs.sublabel}
                    </span>
                  )}
                  {cs.todayFrac !== null && (
                    <div
                      style={{
                        position: "absolute",
                        left: anchorCalc(cs.todayFrac),
                        top: 0,
                        bottom: 0,
                        width: 1,
                        background: "rgba(240,160,0,0.16)",
                      }}
                    />
                  )}
                  {cs.ms.map((r, mi) => {
                    const prec = r.type === "m" ? r.m.prec : "DAY";
                    const bw = BRACKET_W[prec];
                    const text = rLabelJsx(r);
                    const isToday = r.type === "m" && r.m.isToday;
                    const sourceOnly =
                      r.type === "m" && !r.m.isToday && !r.m.emerged && r.m.transitions.length === 0;
                    const color = isToday ? AMBER : text.color;

                    const glyph =
                      bw > 0 ? (
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

                    const titleStr =
                      r.type === "collapsed"
                        ? rTitleJsx(r, panelOpen)
                        : r.type === "m" && r.m.transitions.length > 0
                          ? `${markerTitleJsx(r.m)}\n\nClick to ${panelOpen ? "hide" : "list"} all dated events`
                          : markerTitleJsx(r.m);

                    return (
                      <div
                        key={`m-${mi}`}
                        style={{ position: "absolute", left: anchorCalc(cs.fracs[mi], bw / 2), top: 0, bottom: 0, width: 0 }}
                      >
                        {glyph}
                        {interactive.as === "button" ? (
                          <button
                            type="button"
                            title={titleStr}
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
                            title={`${titleStr}\n\nClick to jump to this source in the evidence table`}
                            aria-label={`${titleStr.split("\n")[0]} — jump to evidence row`}
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
                            title={titleStr}
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
                    <span style={{ color: "#60a5fa" }}>Claim emerged</span>
                  </li>,
                );
              }
              m.transitions.forEach((t, i) => {
                const anchorId = t.seq != null ? `t-${t.seq}` : undefined;
                const anchorHref = anchorId ? `#${anchorId}` : undefined;
                rows.push(
                  <li
                    key={`${m.key}-t${i}`}
                    id={anchorId}
                    className="flex items-baseline gap-3 text-xs group/receipt"
                  >
                    <span className="shrink-0 w-44 text-gray-500">
                      {hoverDate(new Date(t.occurredAt), toPrec(t.datePrecision))}
                    </span>
                    <span style={{ color: axisColor(t.toAxis), fontWeight: 600 }}>{transitionChain(t)}</span>
                    <span className="text-gray-600">{t.community.replace(/_/g, " ")}</span>
                    {anchorHref && (
                      <a
                        href={anchorHref}
                        className="ml-auto shrink-0 opacity-0 group-hover/receipt:opacity-100 transition-opacity text-gray-700 hover:text-gray-400 font-mono"
                        title={`Link to this transition: /claims/${claim.id}${anchorHref}`}
                        onClick={(e) => {
                          e.preventDefault();
                          const url = `${window.location.origin}/claims/${claim.id}${anchorHref}`;
                          void navigator.clipboard?.writeText(url).catch(() => {});
                          window.location.hash = anchorHref;
                        }}
                      >
                        #
                      </a>
                    )}
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
