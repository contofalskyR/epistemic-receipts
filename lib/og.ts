import type { Metadata } from "next";

// Link-preview metadata (STATUS.md Phase 5). Next merges `openGraph` and
// `twitter` per segment by *replacing* the whole object, so a page that sets
// its own openGraph title silently drops the root layout's image — every
// page-level block goes through socialMetadata() to keep an image attached.
//
// Images: /api/og/trajectory and /api/og/claim draw the settling curve
// (lib/og-shared.tsx CurveCard); /api/og/default is the card for everything
// else. URLs are relative — app/layout.tsx sets metadataBase.

export const OG_IMAGE_SIZE = { width: 1200, height: 630 } as const;

export type OgImage = { url: string; width: number; height: number; alt: string };

export const DEFAULT_OG_IMAGE: OgImage = {
  url: "/api/og/default",
  ...OG_IMAGE_SIZE,
  alt: "Epistemic Receipts — track how knowledge changes over time",
};

/** The curve card for a curated trajectory (slug) or a raw claim id. */
export function trajectoryOgImage(idOrSlug: string, alt = "Settling curve"): OgImage {
  return { url: `/api/og/trajectory?id=${encodeURIComponent(idOrSlug)}`, ...OG_IMAGE_SIZE, alt };
}

/** The curve card for a claim receipt. */
export function claimOgImage(claimId: string, alt = "Claim receipt"): OgImage {
  return { url: `/api/og/claim?id=${encodeURIComponent(claimId)}`, ...OG_IMAGE_SIZE, alt };
}

/** openGraph + twitter blocks with an image always attached. */
export function socialMetadata({
  title,
  description,
  url,
  image = DEFAULT_OG_IMAGE,
  type = "website",
}: {
  title: string;
  description?: string;
  /** Canonical path, e.g. "/communities". */
  url?: string;
  image?: OgImage;
  type?: "website" | "article";
}): Pick<Metadata, "openGraph" | "twitter"> {
  return {
    openGraph: {
      title,
      description,
      url,
      siteName: "Epistemic Receipts",
      type,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image.url],
    },
  };
}
