import { unstable_cache } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { liveClaimSql } from "@/lib/corpus";

// /methodology's refusal ledger: live claims a pipeline holds with no dated
// transition at all (curveless, because no date exists to recover). The page
// used to type these figures ("~10,000 OFAC designations" was ~1,300).

export const REFUSAL_LEDGER_TAGS = ["chebi_v1", "jacar_v1", "rxnorm_v1", "ofac_sdn_v1"] as const;
export type RefusalTag = (typeof REFUSAL_LEDGER_TAGS)[number];

export const REFUSAL_LEDGER_SQL = Prisma.sql`
  SELECT c."ingestedBy", count(*)::int AS n
  FROM "Claim" c
  WHERE c."ingestedBy" IN (${Prisma.join([...REFUSAL_LEDGER_TAGS])})
    AND ${liveClaimSql("c")}
    AND NOT EXISTS (SELECT 1 FROM "ClaimStatusHistory" h WHERE h."claimId" = c.id)
  GROUP BY c."ingestedBy"`;

export const curvelessCounts = unstable_cache(
  async (): Promise<Record<RefusalTag, number>> => {
    const rows = await prisma.$queryRaw<{ ingestedBy: RefusalTag; n: number }[]>(REFUSAL_LEDGER_SQL);
    const out = Object.fromEntries(REFUSAL_LEDGER_TAGS.map((t) => [t, 0])) as Record<RefusalTag, number>;
    for (const r of rows) out[r.ingestedBy] = Number(r.n);
    return out;
  },
  ["refusal-ledger-curveless"],
  { revalidate: 86400 },
);

/** "~36,600": nearest hundred from 1,000 up, exact below. */
export function approxCount(n: number): string {
  return n >= 1000 ? `~${(Math.round(n / 100) * 100).toLocaleString("en-US")}` : n.toLocaleString("en-US");
}
