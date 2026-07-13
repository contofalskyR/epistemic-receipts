// Canonical epistemic-axis token map — import from here, never redefine locally.
// lib/og-shared.tsx re-exports AXIS_COLOR + axisColor for OG-image compatibility.
// Pure module — no Next.js or edge-only imports; safe on client, server, and edge.

export const AXIS_COLOR: Record<string, string> = {
  SETTLED:      "#22c55e",
  CONTESTED:    "#f59e0b",
  REVERSED:     "#ef4444",
  RECORDED:     "#94a3b8",
  OPEN:         "#38bdf8",
  ABANDONED:    "#6b7280",
  UNRESOLVABLE: "#a78bfa",
};

export const AXIS_LABEL: Record<string, string> = {
  SETTLED:      "Settled",
  CONTESTED:    "Contested",
  REVERSED:     "Reversed",
  RECORDED:     "Recorded",
  OPEN:         "Open",
  ABANDONED:    "Abandoned",
  UNRESOLVABLE: "Unresolvable",
};

export function axisColor(axis: string): string {
  return AXIS_COLOR[axis] ?? "#94a3b8";
}

export function axisLabel(axis: string): string {
  return AXIS_LABEL[axis] ?? axis;
}

// Tailwind text-color class per axis — use when inline hex is unavailable (JIT scanning).
// Full class strings required so Tailwind's scanner picks them up.
export const AXIS_TEXT_CLASS: Record<string, string> = {
  SETTLED:      "text-emerald-400",
  CONTESTED:    "text-amber-400",
  REVERSED:     "text-rose-400",
  RECORDED:     "text-slate-400",
  OPEN:         "text-sky-400",
  ABANDONED:    "text-gray-500",
  UNRESOLVABLE: "text-violet-400",
};

// Tailwind bg + text badge classes — use for pill/chip axis badges.
export const AXIS_BG_CLASS: Record<string, string> = {
  SETTLED:      "bg-emerald-900 text-emerald-300",
  CONTESTED:    "bg-amber-900 text-amber-300",
  REVERSED:     "bg-rose-900 text-rose-300",
  RECORDED:     "bg-slate-800 text-slate-300",
  OPEN:         "bg-blue-900 text-blue-300",
  ABANDONED:    "bg-gray-800 text-gray-400",
  UNRESOLVABLE: "bg-violet-900 text-violet-300",
};

export const AXIS_FALLBACK_COLOR = "#94a3b8";
export const AXIS_FALLBACK_TEXT_CLASS = "text-gray-500";
export const AXIS_FALLBACK_BG_CLASS = "bg-gray-800 text-gray-500";
