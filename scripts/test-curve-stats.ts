import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // Task 1: Verify survival counts
  console.log('=== TASK 1: Survival counts ===')
  const counts = await prisma.$queryRawUnsafe(`
    WITH pairs AS (
      SELECT
        h1."claimId",
        h1."occurredAt" AS pub_date,
        h2."occurredAt" AS retraction_date,
        EXTRACT(EPOCH FROM (h2."occurredAt" - h1."occurredAt"))/86400 AS survival_days
      FROM "ClaimStatusHistory" h1
      JOIN "ClaimStatusHistory" h2 ON h1."claimId" = h2."claimId"
      WHERE h1."toAxis" = 'RECORDED' AND h1."fromAxis" IS NULL
        AND h2."toAxis" = 'REVERSED'
        AND h1.community = 'EXPERT_LITERATURE'
        AND h2.community = 'EXPERT_LITERATURE'
    )
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE survival_days > 0) AS valid,
      COUNT(*) FILTER (WHERE survival_days <= 0) AS indeterminate
    FROM pairs
  `) as Array<{ total: bigint; valid: bigint; indeterminate: bigint }>
  console.log('total:', counts[0].total.toString())
  console.log('valid:', counts[0].valid.toString())
  console.log('indeterminate:', counts[0].indeterminate.toString())

  // Task 2: Full curve-stats JSON
  console.log('\n=== TASK 2: Curve stats ===')

  // Retraction survival stats
  const survivalStats = await prisma.$queryRawUnsafe(`
    WITH pairs AS (
      SELECT
        h1."claimId",
        EXTRACT(EPOCH FROM (h2."occurredAt" - h1."occurredAt"))/86400 AS survival_days
      FROM "ClaimStatusHistory" h1
      JOIN "ClaimStatusHistory" h2 ON h1."claimId" = h2."claimId"
      WHERE h1."toAxis" = 'RECORDED' AND h1."fromAxis" IS NULL
        AND h2."toAxis" = 'REVERSED'
        AND h1.community = 'EXPERT_LITERATURE'
        AND h2.community = 'EXPERT_LITERATURE'
    )
    SELECT
      COUNT(*) FILTER (WHERE survival_days > 0) AS n,
      COUNT(*) FILTER (WHERE survival_days <= 0) AS indeterminate_n,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY survival_days) FILTER (WHERE survival_days > 0) AS median_days,
      percentile_cont(0.25) WITHIN GROUP (ORDER BY survival_days) FILTER (WHERE survival_days > 0) AS p25_days,
      percentile_cont(0.75) WITHIN GROUP (ORDER BY survival_days) FILTER (WHERE survival_days > 0) AS p75_days,
      MIN(survival_days) FILTER (WHERE survival_days > 0) AS min_days,
      MAX(survival_days) FILTER (WHERE survival_days > 0) AS max_days
    FROM pairs
  `) as Array<{ n: bigint; indeterminate_n: bigint; median_days: number; p25_days: number; p75_days: number; min_days: number; max_days: number }>
  console.log('Survival stats:', JSON.stringify({
    n: survivalStats[0].n.toString(),
    indeterminate_n: survivalStats[0].indeterminate_n.toString(),
    median_days: Math.round(Number(survivalStats[0].median_days)),
    p25_days: Math.round(Number(survivalStats[0].p25_days)),
    p75_days: Math.round(Number(survivalStats[0].p75_days)),
    min_days: Math.round(Number(survivalStats[0].min_days)),
    max_days: Math.round(Number(survivalStats[0].max_days)),
    median_years: (Number(survivalStats[0].median_days) / 365).toFixed(2),
  }, null, 2))

  // Histogram
  const histogram = await prisma.$queryRawUnsafe(`
    WITH pairs AS (
      SELECT EXTRACT(EPOCH FROM (h2."occurredAt" - h1."occurredAt"))/86400 AS survival_days
      FROM "ClaimStatusHistory" h1
      JOIN "ClaimStatusHistory" h2 ON h1."claimId" = h2."claimId"
      WHERE h1."toAxis" = 'RECORDED' AND h1."fromAxis" IS NULL
        AND h2."toAxis" = 'REVERSED'
        AND h1.community = 'EXPERT_LITERATURE'
        AND h2.community = 'EXPERT_LITERATURE'
        AND EXTRACT(EPOCH FROM (h2."occurredAt" - h1."occurredAt"))/86400 > 0
    )
    SELECT
      CASE
        WHEN survival_days <= 365 THEN '0-1yr'
        WHEN survival_days <= 730 THEN '1-2yr'
        WHEN survival_days <= 1095 THEN '2-3yr'
        WHEN survival_days <= 1825 THEN '3-5yr'
        WHEN survival_days <= 3650 THEN '5-10yr'
        ELSE '10+yr'
      END AS bucket,
      COUNT(*) AS count
    FROM pairs
    GROUP BY bucket
    ORDER BY MIN(survival_days)
  `) as Array<{ bucket: string; count: bigint }>
  console.log('Histogram:', JSON.stringify(histogram.map(r => ({ bucket: r.bucket, count: Number(r.count) })), null, 2))

  // Detection trend
  const trend = await prisma.$queryRawUnsafe(`
    WITH pairs AS (
      SELECT
        EXTRACT(YEAR FROM h2."occurredAt") AS retraction_year,
        EXTRACT(EPOCH FROM (h2."occurredAt" - h1."occurredAt"))/86400 AS survival_days
      FROM "ClaimStatusHistory" h1
      JOIN "ClaimStatusHistory" h2 ON h1."claimId" = h2."claimId"
      WHERE h1."toAxis" = 'RECORDED' AND h1."fromAxis" IS NULL
        AND h2."toAxis" = 'REVERSED'
        AND h1.community = 'EXPERT_LITERATURE'
        AND h2.community = 'EXPERT_LITERATURE'
        AND EXTRACT(EPOCH FROM (h2."occurredAt" - h1."occurredAt"))/86400 > 0
    )
    SELECT
      retraction_year AS year,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY survival_days) AS median_days,
      COUNT(*) AS n
    FROM pairs
    GROUP BY retraction_year
    HAVING COUNT(*) >= 5
    ORDER BY retraction_year
  `) as Array<{ year: number; median_days: number; n: bigint }>
  console.log('Detection trend:', JSON.stringify(trend.map(r => ({
    year: Number(r.year),
    median_days: Math.round(Number(r.median_days)),
    n: Number(r.n),
  })), null, 2))

  // Field breakdown — check what's available
  const fieldCheck = await prisma.$queryRawUnsafe(`
    SELECT
      COUNT(*) AS total_retracted,
      COUNT(*) FILTER (WHERE c.metadata->>'concepts' IS NOT NULL) AS has_concepts,
      COUNT(*) FILTER (WHERE c.metadata->>'primary_topic' IS NOT NULL) AS has_primary_topic,
      COUNT(*) FILTER (WHERE c.metadata->>'subject' IS NOT NULL) AS has_subject
    FROM "ClaimStatusHistory" h1
    JOIN "ClaimStatusHistory" h2 ON h1."claimId" = h2."claimId"
    JOIN "Claim" c ON c.id = h1."claimId"
    WHERE h1."toAxis" = 'RECORDED' AND h1."fromAxis" IS NULL
      AND h2."toAxis" = 'REVERSED'
      AND h1.community = 'EXPERT_LITERATURE'
      AND h2.community = 'EXPERT_LITERATURE'
      AND EXTRACT(EPOCH FROM (h2."occurredAt" - h1."occurredAt"))/86400 > 0
  `) as Array<{ total_retracted: bigint; has_concepts: bigint; has_primary_topic: bigint; has_subject: bigint }>
  console.log('Field check:', JSON.stringify({
    total_retracted: Number(fieldCheck[0].total_retracted),
    has_concepts: Number(fieldCheck[0].has_concepts),
    has_primary_topic: Number(fieldCheck[0].has_primary_topic),
    has_subject: Number(fieldCheck[0].has_subject),
  }, null, 2))

  // Curated trajectories
  const curatedClaims = await prisma.$queryRawUnsafe(`
    SELECT c.id, c.text, c."externalId"
    FROM "Claim" c
    WHERE c."externalId" LIKE 'trajectory:%' AND c.deleted = false
    ORDER BY c."externalId"
  `) as Array<{ id: string; text: string; externalId: string }>
  console.log(`Curated trajectory claims: ${curatedClaims.length}`)
  console.log(curatedClaims.map(c => c.externalId).join('\n'))

  if (curatedClaims.length > 0) {
    const claimIds = curatedClaims.map(c => `'${c.id}'`).join(',')
    const curatedHistory = await prisma.$queryRawUnsafe(`
      SELECT h.id, h."claimId", h.community, h."fromAxis", h."toAxis", h."occurredAt"
      FROM "ClaimStatusHistory" h
      WHERE h."claimId" IN (${claimIds})
      ORDER BY h."claimId", h."occurredAt"
    `) as Array<{ id: string; claimId: string; community: string; fromAxis: string | null; toAxis: string; occurredAt: Date }>
    console.log('\nCurated history rows:', curatedHistory.length)
    for (const row of curatedHistory) {
      console.log(`  [${row.claimId.slice(0,8)}] ${row.community} ${row.fromAxis ?? 'null'} -> ${row.toAxis} @ ${row.occurredAt.toISOString().slice(0,10)}`)
    }
  }

  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
