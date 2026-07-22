"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { AXIS_COLOR } from "@/lib/status";
import { SLIDES, type Slide } from "./homeSlides";

// SVG canvas
const W = 340, H = 90;
const PAD = { l: 6, r: 6, t: 14, b: 18 };
const CW = W - PAD.l - PAD.r;
const CH = H - PAD.t - PAD.b;

type Pt = [number, number]; // [x%, y%] — y: 0 = top (settled), 100 = bottom (reversed)

function pts2svg(pts: Pt[]): string {
  return pts.map(([x, y]) => `${PAD.l + (x / 100) * CW},${PAD.t + (y / 100) * CH}`).join(" ");
}

function MiniCurve({ slide, reducedMotion }: { slide: Slide; reducedMotion: boolean }) {
  const svgPts = pts2svg(slide.pts);
  const [lx, ly] = slide.pts[slide.pts.length - 1];
  const [sx, sy] = slide.pts[0];
  const svgLx = PAD.l + (lx / 100) * CW;
  const svgLy = PAD.t + (ly / 100) * CH;
  const svgSx = PAD.l + (sx / 100) * CW;
  const svgSy = PAD.t + (sy / 100) * CH;
  const startColor = AXIS_COLOR[slide.initialAxis] ?? "#94a3b8";
  const endColor = AXIS_COLOR[slide.finalAxis] ?? "#94a3b8";
  const amber = AXIS_COLOR["CONTESTED"];
  const finalLabel = slide.finalAxis.charAt(0) + slide.finalAxis.slice(1).toLowerCase();
  // Trajectory gradient in the house settling-curve language: start axis →
  // (contested amber midway when the arc actually changes state) → end axis.
  const throughAmber = startColor !== endColor && startColor !== amber && endColor !== amber;
  const gid = `mini-grad-${slide.startYear}-${slide.endYear}`;
  // The motion path for the "pong" — the same polyline as an SVG path.
  const dPath =
    slide.pts
      .map(([x, y], i) => `${i === 0 ? "M" : "L"}${(PAD.l + (x / 100) * CW).toFixed(1)},${(PAD.t + (y / 100) * CH).toFixed(1)}`)
      .join(" ");
  return (
    <div className="overflow-hidden rounded-md bg-[#0b0b12]">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="w-full" aria-hidden="true">
        <defs>
          <linearGradient id={gid} x1={PAD.l} y1="0" x2={W - PAD.r} y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={startColor} />
            {throughAmber && <stop offset="55%" stopColor={amber} />}
            <stop offset="100%" stopColor={endColor} />
          </linearGradient>
        </defs>
        <text x={W - PAD.r} y={PAD.t - 3} textAnchor="end" fontSize={8.5} fill={endColor} fontFamily="ui-monospace,monospace">
          {finalLabel}
        </text>
        <line x1={PAD.l} y1={PAD.t + 4} x2={W - PAD.r} y2={PAD.t + 4} stroke={AXIS_COLOR["SETTLED"]} strokeWidth={0.5} strokeDasharray="3 3" opacity={0.22} />
        <polyline
          points={`${PAD.l},${H - PAD.b} ${svgPts} ${W - PAD.r},${H - PAD.b}`}
          fill={`url(#${gid})`}
          opacity={0.09}
        />
        <polyline points={svgPts} fill="none" stroke={`url(#${gid})`} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={svgSx} cy={svgSy} r={3} fill={startColor} />
        <circle cx={svgLx} cy={svgLy} r={3.5} fill={endColor} />
        {/* The pong: the claim as a dot, tracing its own trajectory back and
            forth. Amber-forward palette per the settling-curve language. */}
        {!reducedMotion && (
          <g>
            <circle r={5.5} fill={amber} opacity={0.18}>
              <animateMotion dur="5.2s" repeatCount="indefinite" calcMode="linear" keyPoints="0;1;0" keyTimes="0;0.5;1" path={dPath} />
            </circle>
            <circle r={2.8} fill={amber}>
              <animateMotion dur="5.2s" repeatCount="indefinite" calcMode="linear" keyPoints="0;1;0" keyTimes="0;0.5;1" path={dPath} />
              <animate
                attributeName="fill"
                dur="5.2s"
                repeatCount="indefinite"
                values={`${startColor};${amber};${endColor};${amber};${startColor}`}
                keyTimes="0;0.3;0.5;0.7;1"
              />
            </circle>
          </g>
        )}
        <text x={PAD.l} y={H - 4} fontSize={8.5} fill="#4b5563" fontFamily="ui-monospace,monospace">{slide.startYear}</text>
        <text x={W - PAD.r} y={H - 4} textAnchor="end" fontSize={8.5} fill="#4b5563" fontFamily="ui-monospace,monospace">{slide.endYear}</text>
      </svg>
    </div>
  );
}

export default function HomeCarousel() {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(true);
  const reducedMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const pending = useRef<number | null>(null);

  const goTo = useCallback((i: number) => {
    setVisible(false);
    pending.current = i;
  }, []);

  // After fade-out, swap content and fade back in
  useEffect(() => {
    if (visible || pending.current === null) return;
    const id = setTimeout(() => {
      setIdx(pending.current!);
      pending.current = null;
      setVisible(true);
    }, 280);
    return () => clearTimeout(id);
  }, [visible]);

  const next = useCallback(() => goTo((idx + 1) % SLIDES.length), [idx, goTo]);

  useEffect(() => {
    if (paused || reducedMotion) return;
    const id = setInterval(next, 5500);
    return () => clearInterval(id);
  }, [paused, reducedMotion, next]);

  const s = SLIDES[idx];
  const tagColor = AXIS_COLOR[s.finalAxis] ?? "#94a3b8";

  return (
    <div
      className="rounded-xl border border-gray-800 bg-gray-900/80 p-5"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Animated content wrapper */}
      <div
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(6px)",
          transition: reducedMotion ? "none" : "opacity 0.28s ease, transform 0.28s ease",
        }}
      >
        {/* Tag + meta */}
        <div className="flex items-baseline justify-between gap-2">
          <span className="shrink-0 text-[11px] font-mono uppercase tracking-[0.14em]" style={{ color: tagColor }}>
            {s.tag}
          </span>
          <span className="truncate text-right text-[11px] font-mono text-gray-600">
            {s.range} · {s.milestones} milestones
          </span>
        </div>

        {/* Claim text */}
        <p className="mt-3 line-clamp-5 text-[13.5px] leading-relaxed text-gray-300">{s.text}</p>

        {/* Mini settling curve */}
        <div className="mt-4">
          <MiniCurve slide={s} reducedMotion={reducedMotion} />
        </div>

      </div>

      {/* Footer — always visible so dots don't jump */}
      <div className="mt-3 flex items-center justify-between">
        <Link
          href={s.href}
          className="text-[12.5px] text-amber-400/80 transition-colors hover:text-amber-300"
          style={{ opacity: visible ? 1 : 0, transition: "opacity 0.28s ease" }}
        >
          See the full curve →
        </Link>
        <div className="flex items-center gap-1.5">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              aria-label={`Go to slide ${i + 1}`}
              className="rounded-full transition-all duration-300"
              style={{
                height: 6,
                width: i === idx ? 20 : 6,
                background: i === idx ? "#f59e0b" : "#374151",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
