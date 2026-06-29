"use client";
import Link from "next/link";

const C = {
  bg: "#08080f",
  panel: "#10101c",
  panelEdge: "#23233a",
  ink: "#e9e9f2",
  mut: "#8b8ba3",
  brand: "#f0a000",
};

export default function SettlingCurveNav({
  active,
}: {
  active: "individual" | "overview" | "coverage";
}) {
  const tabStyle = (isActive: boolean): React.CSSProperties => ({
    padding: "6px 16px",
    borderRadius: 4,
    fontSize: 13,
    fontWeight: 500,
    textDecoration: "none",
    background: isActive ? C.brand : "transparent",
    color: isActive ? C.bg : C.mut,
    border: isActive ? "none" : `1px solid ${C.panelEdge}`,
    cursor: "pointer",
    transition: "background 0.15s",
  });

  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        padding: "16px 24px 0",
        maxWidth: 900,
        margin: "0 auto",
      }}
    >
      <Link href="/settling-curve" style={tabStyle(active === "individual")}>
        Individual Trajectories
      </Link>
      <Link
        href="/settling-curve/overview"
        style={tabStyle(active === "overview")}
      >
        Distribution Overview
      </Link>
      <Link
        href="/settling-curve/coverage"
        style={tabStyle(active === "coverage")}
      >
        Epistemic Coverage
      </Link>
    </div>
  );
}
