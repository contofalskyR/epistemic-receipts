"use client";

import Link from "next/link";
import { useState } from "react";

const C = {
  bg: "#0a0a0a", panel: "#10101c", panelEdge: "#23233a",
  ink: "#e9e9f2", mut: "#8b8ba3", faint: "#55556e", brand: "#d4a853",
} as const;

export function StageCard({
  href, label, sublabel, count, widthPct, barColor, countColor,
}: {
  href: string; label: string; sublabel: string; count: number;
  widthPct: number; barColor: string; countColor: string;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <Link
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "block",
        background: C.panel,
        border: `1px solid ${hovered ? C.brand + "44" : C.panelEdge}`,
        borderRadius: 12,
        padding: "1rem 1.25rem",
        textDecoration: "none",
        transition: "border-color 0.15s",
        marginBottom: "0.75rem",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
        <div>
          <p style={{ color: C.ink, fontWeight: 500, fontSize: "0.9rem", margin: 0 }}>{label}</p>
          <p style={{ color: C.faint, fontSize: "0.75rem", marginTop: "0.2rem", marginBottom: 0 }}>{sublabel}</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", flexShrink: 0, gap: "0.2rem" }}>
          <span style={{ color: countColor, fontSize: "1.4rem", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
            {count.toLocaleString("en-US")}
          </span>
          <span style={{ color: C.faint, fontSize: "0.72rem" }}>→ Browse</span>
        </div>
      </div>
      <div style={{ height: 4, borderRadius: 9999, background: C.panelEdge, overflow: "hidden", marginTop: "0.75rem" }}>
        <div
          style={{
            height: "100%",
            borderRadius: 9999,
            background: barColor,
            width: `${Math.min(100, widthPct)}%`,
            transition: "width 0.4s ease",
          }}
        />
      </div>
    </Link>
  );
}

export function AreaRow({
  href, label, widthPct, barColor, count,
}: {
  href: string; label: string; widthPct: number; barColor: string; count: number;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <Link
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        textDecoration: "none",
        padding: "0.2rem 0.4rem",
        borderRadius: 6,
        background: hovered ? C.panel : "transparent",
        transition: "background 0.15s",
      }}
    >
      <div style={{ width: 160, flexShrink: 0, color: C.mut, fontSize: "0.8rem", textAlign: "right" }}>
        {label}
      </div>
      <div style={{ flex: 1, height: 10, borderRadius: 9999, background: C.panelEdge, overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            borderRadius: 9999,
            background: barColor,
            width: `${widthPct}%`,
            transition: "width 0.4s ease",
          }}
        />
      </div>
      <div style={{ width: 56, flexShrink: 0, color: C.brand, fontSize: "0.8rem", fontVariantNumeric: "tabular-nums" }}>
        {count.toLocaleString("en-US")}
      </div>
    </Link>
  );
}
