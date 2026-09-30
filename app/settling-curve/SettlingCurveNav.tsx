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
      {/* Distribution Overview and Epistemic Coverage are Lab pages (AUDIT.md §B):
          reachable from the ⚗ Lab menu with the admin session, not from this bar. */}
      {/* B9-3: Law Settler Curve folded in as a section of the settling-curve suite.
          Also remains a standalone Discover nav item at /law-settler. */}
      <Link
        href="/law-settler"
        style={tabStyle(false)}
      >
        Law Doctrine
      </Link>
    </div>
  );
}
