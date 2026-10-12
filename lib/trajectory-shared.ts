import type { MiniMilestone } from "@/app/components/SettlingCurveMini";

// Pure helpers shared by the settling-curve permalink, the claim page and the
// story pages (no server-only imports, so unit tests can load them).

/** SettlingCurveMini milestones from a trajectory's transitions, in chain
 *  order. Years are UTC (the stored timestamps are UTC midnights). */
export function trajectoryMilestones(
  transitions: { occurredAt: string; toAxis: string; reason: string | null; community: string }[],
): MiniMilestone[] {
  return transitions.map((t) => ({
    year: new Date(t.occurredAt).getUTCFullYear(),
    axis: t.toAxis,
    reason: t.reason,
    community: t.community,
  }));
}

/** The curated slug of a claim (externalId "trajectory:<slug>"), or null. */
export function trajectorySlug(externalId: string | null | undefined): string | null {
  return externalId?.startsWith("trajectory:") ? externalId.slice("trajectory:".length) : null;
}
