"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";

// SVG canvas
const W = 340, H = 90;
const PAD = { l: 6, r: 6, t: 14, b: 18 };
const CW = W - PAD.l - PAD.r;
const CH = H - PAD.t - PAD.b;

type Pt = [number, number]; // [x%, y%] — y: 0 = top (settled), 100 = bottom (reversed)

function pts2svg(pts: Pt[]): string {
  return pts.map(([x, y]) => `${PAD.l + (x / 100) * CW},${PAD.t + (y / 100) * CH}`).join(" ");
}

type Slide = {
  tag: string;
  tagColor: string;
  range: string;
  milestones: number;
  text: string;
  href: string;
  pts: Pt[];
  finalLabel: string;
  finalColor: string;
  startYear: string;
  endYear: string;
};

const SLIDES: Slide[] = [
  {
    tag: "THE REVERSAL",
    tagColor: "#f87171",
    range: "1903 → 1962",
    milestones: 3,
    text: "In Giles v. Harris (189 U.S. 475), decided 27 April 1903, the U.S. Supreme Court declined to order Alabama to register Black voters disenfranchised under the state's 1901 constitution, holding that federal equity courts would not supervise state voting and that relief from such 'political wrongs' must come from the political branches.",
    href: "/reversals",
    pts: [[0, 26], [28, 28], [58, 44], [80, 68], [100, 82]],
    finalLabel: "Reversed",
    finalColor: "#f87171",
    startYear: "1903",
    endYear: "1962",
  },
  {
    tag: "THE SETTLEMENT",
    tagColor: "#34d399",
    range: "1900 → 2004",
    milestones: 3,
    text: "The U.S. Supreme Court held in The Paquete Habana, decided 8 January 1900, that customary international law is part of United States law and must be ascertained and applied by federal courts as questions of right depending on it arise.",
    href: "/settling-curve",
    pts: [[0, 70], [25, 60], [55, 42], [80, 20], [100, 10]],
    finalLabel: "Settled",
    finalColor: "#34d399",
    startYear: "1900",
    endYear: "2004",
  },
  {
    tag: "THE REVERSAL",
    tagColor: "#f87171",
    range: "1984 → 1994",
    milestones: 4,
    text: "Peptic ulcers are caused by excess stomach acid and stress — not bacterial infection. This consensus held for decades until Barry Marshall and Robin Warren isolated Helicobacter pylori and demonstrated its role in ulcer disease, upending 80 years of gastroenterology.",
    href: "/stories/h-pylori",
    pts: [[0, 18], [25, 20], [50, 28], [70, 55], [88, 74], [100, 84]],
    finalLabel: "Reversed",
    finalColor: "#f87171",
    startYear: "1984",
    endYear: "1994",
  },
  {
    tag: "THE SETTLEMENT",
    tagColor: "#34d399",
    range: "1912 → 1968",
    milestones: 5,
    text: "The continents move — once joined as Pangaea, they separate along tectonic boundaries at measurable rates. Alfred Wegener proposed continental drift in 1912 and was widely ridiculed. Seafloor spreading was confirmed in the 1960s and plate tectonics became the settled framework of geology.",
    href: "/search?q=plate+tectonics",
    pts: [[0, 75], [20, 70], [42, 56], [60, 38], [80, 18], [100, 9]],
    finalLabel: "Settled",
    finalColor: "#34d399",
    startYear: "1912",
    endYear: "1968",
  },
  {
    tag: "THE CONTESTED",
    tagColor: "#fbbf24",
    range: "2015 → present",
    milestones: 6,
    text: "Dietary fat — particularly saturated fat — is a primary driver of cardiovascular disease and should be minimized in a healthy diet. Decades of guidance built on this claim are now contested as evidence for different fatty acid types diverged sharply from the original hypothesis.",
    href: "/search?q=dietary+fat+cardiovascular",
    pts: [[0, 18], [20, 16], [40, 20], [60, 35], [80, 50], [100, 58]],
    finalLabel: "Contested",
    finalColor: "#fbbf24",
    startYear: "2015",
    endYear: "2026",
  },
  {
    tag: "THE REVERSAL",
    tagColor: "#f87171",
    range: "2003 → 2012",
    milestones: 4,
    text: "Hwang Woo-suk reported deriving human embryonic stem cells from cloned embryos — first in 2004, then with patient-matched lines in 2005. Both Science papers were retracted in 2006 after a fabrication investigation. The work had fooled journal editors, peer reviewers, and the global scientific press.",
    href: "/retraction-explorer",
    pts: [[0, 20], [30, 18], [55, 22], [72, 60], [88, 80], [100, 88]],
    finalLabel: "Reversed",
    finalColor: "#f87171",
    startYear: "2003",
    endYear: "2012",
  },
];

function MiniCurve({ slide }: { slide: Slide }) {
  const svgPts = pts2svg(slide.pts);
  const [lx, ly] = slide.pts[slide.pts.length - 1];
  const svgLx = PAD.l + (lx / 100) * CW;
  const svgLy = PAD.t + (ly / 100) * CH;
  return (
    <div className="overflow-hidden rounded-md bg-[#0b0b12]">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="w-full" aria-hidden="true">
        <text x={W - PAD.r} y={PAD.t - 3} textAnchor="end" fontSize={8.5} fill={slide.finalColor} fontFamily="ui-monospace,monospace">
          {slide.finalLabel}
        </text>
        <line x1={PAD.l} y1={PAD.t + 4} x2={W - PAD.r} y2={PAD.t + 4} stroke="#34d399" strokeWidth={0.5} strokeDasharray="3 3" opacity={0.22} />
        <polyline
          points={`${PAD.l},${H - PAD.b} ${svgPts} ${W - PAD.r},${H - PAD.b}`}
          fill={slide.finalColor}
          opacity={0.08}
        />
        <polyline points={svgPts} fill="none" stroke={slide.finalColor} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={svgLx} cy={svgLy} r={3.5} fill={slide.finalColor} />
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
    if (paused) return;
    const id = setInterval(next, 5500);
    return () => clearInterval(id);
  }, [paused, next]);

  const s = SLIDES[idx];

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
          transition: "opacity 0.28s ease, transform 0.28s ease",
        }}
      >
        {/* Tag + meta */}
        <div className="flex items-baseline justify-between gap-2">
          <span className="shrink-0 text-[11px] font-mono uppercase tracking-[0.14em]" style={{ color: s.tagColor }}>
            {s.tag}
          </span>
          <span className="truncate text-right text-[11px] font-mono text-gray-600">
            {s.range} · {s.milestones} milestones
          </span>
        </div>

        {/* Claim text */}
        <p className="mt-3 line-clamp-4 text-[13.5px] leading-relaxed text-gray-300">{s.text}</p>

        {/* Mini settling curve */}
        <div className="mt-4">
          <MiniCurve slide={s} />
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
