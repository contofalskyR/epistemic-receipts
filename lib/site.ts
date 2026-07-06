// Canonical site origin — single source of truth for absolute URL construction
// (metadata canonicals, OG images, share links, RSS, email links).
// Override per-environment with NEXT_PUBLIC_SITE_URL (no trailing slash).
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
  "https://epistemic-receipts.vercel.app";
