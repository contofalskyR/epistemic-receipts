import { ImageResponse } from "next/og";
import { OG_WIDTH as W, OG_HEIGHT as H, OG_CACHE_CONTROL, FallbackCard } from "@/lib/og-shared";

// The link-preview card for every page without a curve of its own
// (lib/og.ts DEFAULT_OG_IMAGE, wired from app/layout.tsx). Static content;
// the CDN keeps it for a day.
export const runtime = "nodejs";

export async function GET() {
  return new ImageResponse(<FallbackCard />, {
    width: W,
    height: H,
    headers: { "Cache-Control": OG_CACHE_CONTROL },
  });
}
