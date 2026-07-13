// Shared bits for the /api/og/* image routes (trajectory + claim cards).

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

// OG images are fetched by link scrapers against ~1.76M claim URLs — let the
// CDN absorb repeats instead of re-rendering (each render is a live DB query).
export const OG_CACHE_CONTROL =
  "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800";

// Re-exported from lib/status so OG images and the app share one source of truth.
export { AXIS_COLOR, axisColor } from "@/lib/status";

// Generic fallback card (bad/missing id, claim not found)
export function FallbackCard() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "flex-start",
        width: OG_WIDTH,
        height: OG_HEIGHT,
        background: "#0a0a12",
        padding: "60px 80px",
        fontFamily: "monospace",
      }}
    >
      <span
        style={{
          fontSize: 13,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "#d4a853",
          marginBottom: 24,
        }}
      >
        EPISTEMIC RECEIPT 🧾
      </span>
      <p
        style={{
          fontSize: 48,
          color: "#ffffff",
          fontWeight: 600,
          lineHeight: 1.2,
          margin: 0,
          maxWidth: 700,
        }}
      >
        Track how knowledge changes over time.
      </p>
      <p
        style={{
          position: "absolute",
          bottom: 48,
          right: 80,
          fontSize: 13,
          color: "#55556e",
          letterSpacing: "0.08em",
          margin: 0,
        }}
      >
        epistemic-receipts.vercel.app
      </p>
    </div>
  );
}
