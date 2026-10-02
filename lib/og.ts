import type { Metadata } from "next";

// Link-preview metadata (STATUS.md Phase 5). Next merges `openGraph` and
// `twitter` per segment by *replacing* the whole object, so a page that sets
// its own openGraph title silently drops the root layout's image — every
// page-level block must carry an image: through socialMetadata(), or by hand
// as claims/[id], settling-curve(/[id]) and receipts/[id] do
// (tests/unit/og-metadata.test.ts enforces it). The root layout uses
// defaultSocialMetadata(): image only, so pages without a block of their own
// keep their own title (phase 6).
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

/** Root layout default: the image, nothing page-specific. A page without its
 *  own openGraph inherits this object whole; Next then fills og:title,
 *  og:description and the twitter title, description and image from the
 *  page's own title, description and og image (resolve-metadata.js
 *  postProcessMetadata). A title, description or url here would be inherited
 *  verbatim — phase 5's root block gave ~25 pages the homepage's og:url and
 *  title. */
export function defaultSocialMetadata(image: OgImage = DEFAULT_OG_IMAGE): Pick<Metadata, "openGraph" | "twitter"> {
  return {
    openGraph: { siteName: "Epistemic Receipts", type: "website", images: [image] },
    twitter: { card: "summary_large_image" },
  };
}
