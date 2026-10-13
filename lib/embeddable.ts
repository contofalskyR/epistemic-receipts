import "server-only";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { CURATED_WHERE, curatedSlug } from "@/lib/trajectory-list";
import { queryTrajectoryDetail, type TrajectoryDetail } from "@/lib/trajectory-detail";

// Which trajectories can be embedded (owner, 2026-10-12): every live curated
// trajectory, not just the 13 domain picks. The slug list and each embedded
// trajectory come from the Data Cache, so an iframe view never reaches Postgres
// (one read per slug per hour). Only a slug in the list is ever cached, which
// bounds the key space to the curated set.

export const curatedSlugs = unstable_cache(
  async (): Promise<string[]> =>
    (await prisma.claim.findMany({ where: CURATED_WHERE, select: { externalId: true } })).map(r => curatedSlug(r.externalId!)),
  ["curated-slugs", "v1"],
  { revalidate: 3600, tags: ["curated-slugs"] },
);

export async function isEmbeddableSlug(slug: string): Promise<boolean> {
  return (await curatedSlugs()).includes(slug);
}

const cachedTrajectory = unstable_cache(
  async (slug: string): Promise<TrajectoryDetail | null> => queryTrajectoryDetail(slug),
  ["embed-trajectory", "v1"],
  { revalidate: 3600 },
);

/** The trajectory behind an embed, or null when the slug is not embeddable. */
export async function embedTrajectory(slug: string): Promise<TrajectoryDetail | null> {
  if (!(await isEmbeddableSlug(slug))) return null;
  return cachedTrajectory(slug);
}
