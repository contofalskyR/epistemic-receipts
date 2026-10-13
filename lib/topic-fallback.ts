import { Prisma } from "@prisma/client";
import { liveClaimSql } from "@/lib/corpus";

// /api/topics/[slug] fallback for leaf topics with no ClaimTopic rows: claims
// whose text matches the topic name. It used `text ILIKE '%name%'` — a parallel
// seq scan of Claim, twice per request. The owner chose (2026-10-12) the indexed
// full-text search instead: Claim."searchVector" (GIN claim_search_vector_idx)
// @@ plainto_tsquery('english', name). Matching is by stemmed words, not by
// substring, so "Law" no longer matches "lawsuit" inside a longer word.

export type TopicFallbackSort = "emerged_desc" | "emerged_asc" | "most_sources";

export type TopicFallbackArgs = {
  name: string;
  showDeprecated: boolean;
  party: string;
  leader: string;
  q: string;
  sort: string;
  page: number;
  pageSize: number;
};

function where(a: TopicFallbackArgs): Prisma.Sql {
  const parts: Prisma.Sql[] = [
    Prisma.sql`c."searchVector" @@ plainto_tsquery('english', ${a.name})`,
    a.showDeprecated ? Prisma.sql`c.deleted = false` : liveClaimSql("c"),
  ];
  if (a.q) {
    const like = `%${a.q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
    parts.push(Prisma.sql`c.text ILIKE ${like}`);
  }
  if (a.party || a.leader) {
    parts.push(Prisma.sql`EXISTS (
      SELECT 1 FROM "Edge" e JOIN "PoliticalContext" pc ON pc."sourceId" = e."sourceId"
      WHERE e."claimId" = c.id
        ${a.party ? Prisma.sql`AND pc."hogParty" = ${a.party}` : Prisma.empty}
        ${a.leader ? Prisma.sql`AND pc."headOfGovernment" = ${a.leader}` : Prisma.empty})`);
  }
  return Prisma.join(parts, " AND ");
}

function orderBy(sort: string): Prisma.Sql {
  if (sort === "most_sources") return Prisma.sql`(SELECT count(*) FROM "Edge" e WHERE e."claimId" = c.id) DESC, c.id`;
  if (sort === "emerged_asc") return Prisma.sql`c."claimEmergedAt" ASC, c.id`;
  return Prisma.sql`c."claimEmergedAt" DESC, c.id`;
}

/** The count and one page of ids for the fallback; every value is a bind parameter. */
export function topicFallbackSql(a: TopicFallbackArgs): { count: Prisma.Sql; ids: Prisma.Sql } {
  const w = where(a);
  return {
    count: Prisma.sql`SELECT count(*)::int AS n FROM "Claim" c WHERE ${w}`,
    ids: Prisma.sql`SELECT c.id FROM "Claim" c WHERE ${w} ORDER BY ${orderBy(a.sort)} LIMIT ${a.pageSize} OFFSET ${(Math.max(1, a.page) - 1) * a.pageSize}`,
  };
}
