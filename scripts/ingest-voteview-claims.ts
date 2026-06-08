// Pipeline — Voteview Roll-Call Claims (voteview_v1)
// Converts 113k LegislativeVote rows (dataSource='voteview_v1') into Claim records
// so they appear in search, the globe, and the claim graph.
// Run: npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-voteview-claims.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const INGESTED_BY = 'voteview_v1'
const BATCH_SIZE = 500

// ── Helpers ────────────────────────────────────────────────────────────────────

function parseMeta(externalId: string | null): { congress: number | null; chamberCode: string | null; rollNumber: number | null } {
  // externalId format: voteview_source_{congress}_{chamberCode}_{rollNumber}
  if (!externalId) return { congress: null, chamberCode: null, rollNumber: null }
  const parts = externalId.split('_')
  // parts: ['voteview', 'source', congress, chamberCode, rollNumber]
  if (parts.length < 5) return { congress: null, chamberCode: null, rollNumber: null }
  return {
    congress: parseInt(parts[2]!, 10) || null,
    chamberCode: parts[3] ?? null,
    rollNumber: parseInt(parts[4]!, 10) || null,
  }
}

function buildClaimText(
  sourceName: string,
  lvChamber: string,
  chamberCode: string | null,
  yesCount: number | null,
  noCount: number | null,
  result: string | null,
  voteDate: Date | null,
  congress: number | null,
  rollNumber: number | null,
): string {
  const chamber = chamberCode === 'h' ? 'House of Representatives' : chamberCode === 's' ? 'Senate' : lvChamber
  const countStr = yesCount !== null && noCount !== null ? `${yesCount}-${noCount}` : null
  const resultStr = result ? result.toLowerCase() : null
  const dateStr = voteDate ? voteDate.toISOString().slice(0, 10) : null

  const context: string[] = []
  if (congress) context.push(`Congress ${congress}`)
  if (rollNumber) context.push(`Roll Call ${rollNumber}`)
  if (dateStr) context.push(dateStr)

  const desc = sourceName.length > 80 ? `${sourceName.slice(0, 77)}...` : sourceName
  const voteStr = countStr ? `voted ${countStr}` : 'voted'
  const outcomeStr = resultStr ? ` — ${resultStr}` : ''
  const ctxStr = context.length ? ` (${context.join(', ')})` : ''

  let text = `The U.S. ${chamber} ${voteStr} on "${desc}"${ctxStr}${outcomeStr}.`
  if (text.length > 300) text = `${text.slice(0, 297)}...`
  return text
}

// ── Batch processor ────────────────────────────────────────────────────────────

async function processBatch(
  votes: Array<{
    id: string
    sourceId: string
    chamber: string
    yesCount: number | null
    noCount: number | null
    result: string | null
    voteDate: Date | null
    topics: string | null
    source: { id: string; name: string; externalId: string | null }
  }>,
  counts: { ingested: number; skipped: number; errors: number },
): Promise<void> {
  const externalIds = votes.map(v => `voteview_claim_${v.id}`)

  const existing = await prisma.claim.findMany({
    where: { externalId: { in: externalIds } },
    select: { externalId: true },
  })
  const existingSet = new Set(existing.map(e => e.externalId))
  const newVotes = votes.filter(v => !existingSet.has(`voteview_claim_${v.id}`))
  counts.skipped += votes.length - newVotes.length

  if (newVotes.length === 0) return

  const claimData = newVotes.map(v => {
    const { congress, chamberCode, rollNumber } = parseMeta(v.source.externalId)
    const text = buildClaimText(
      v.source.name,
      v.chamber,
      chamberCode,
      v.yesCount,
      v.noCount,
      v.result,
      v.voteDate,
      congress,
      rollNumber,
    )
    return {
      text,
      claimType: 'EMPIRICAL',
      currentStatus: 'HARD_FACT',
      verificationStatus: 'VERIFIED',
      epistemicAxis: 'RECORDED',
      claimEmergedAt: v.voteDate ?? undefined,
      claimEmergedPrecision: v.voteDate ? 'DAY' : undefined,
      ingestedBy: INGESTED_BY,
      humanReviewed: false,
      autoApproved: true,
      externalId: `voteview_claim_${v.id}`,
      metadata: {
        legislativeVoteId: v.id,
        congress,
        chamberCode,
        rollNumber,
        yesCount: v.yesCount,
        noCount: v.noCount,
        result: v.result,
        countryCode: 'US',
        dataSource: INGESTED_BY,
      },
    }
  })

  await prisma.$transaction(async tx => {
    await tx.claim.createMany({ data: claimData, skipDuplicates: true })

    const created = await tx.claim.findMany({
      where: { externalId: { in: newVotes.map(v => `voteview_claim_${v.id}`) } },
      select: { id: true, externalId: true },
    })

    // Map externalId → { claimId, sourceId }
    const extToVote = new Map(newVotes.map(v => [`voteview_claim_${v.id}`, v]))

    await tx.edge.createMany({
      data: created.map(c => {
        const vote = extToVote.get(c.externalId!)!
        return {
          sourceId: vote.sourceId,
          claimId: c.id,
          type: 'FOR',
          evidenceType: 'EVIDENTIARY',
          ingestedBy: INGESTED_BY,
          humanReviewed: false,
          autoApproved: true,
        }
      }),
      skipDuplicates: true,
    })

    const edges = await tx.edge.findMany({
      where: { claimId: { in: created.map(c => c.id) }, ingestedBy: INGESTED_BY },
      select: { id: true, claimId: true },
    })

    await tx.edgeRevision.createMany({
      data: edges.map(e => ({
        edgeId: e.id,
        priorScore: null,
        newScore: 95,
        reason: 'Voteview roll-call vote — primary congressional record (voteview.com)',
        changedAt: new Date(),
      })),
      skipDuplicates: true,
    })

    counts.ingested += created.length
  }, { timeout: 60000 })
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const existingCount = await prisma.claim.count({ where: { ingestedBy: INGESTED_BY } })
  if (existingCount > 0) {
    console.log(`Already have ${existingCount} voteview_v1 claims — nothing to do.`)
    return
  }

  const total = await prisma.legislativeVote.count({ where: { dataSource: INGESTED_BY } })
  console.log(`Found ${total} voteview_v1 LegislativeVotes to convert into Claims.`)

  const counts = { ingested: 0, skipped: 0, errors: 0 }
  let cursor: string | undefined
  let page = 0

  while (true) {
    const votes = await prisma.legislativeVote.findMany({
      where: { dataSource: INGESTED_BY },
      take: BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
      select: {
        id: true,
        sourceId: true,
        chamber: true,
        yesCount: true,
        noCount: true,
        result: true,
        voteDate: true,
        topics: true,
        source: { select: { id: true, name: true, externalId: true } },
      },
    })

    if (votes.length === 0) break

    try {
      await processBatch(votes, counts)
    } catch (err) {
      console.error(`Batch ${page} error:`, err)
      counts.errors += votes.length
    }

    cursor = votes[votes.length - 1]!.id
    page++

    if (page % 10 === 0) {
      console.log(`  Page ${page}: ingested=${counts.ingested}, skipped=${counts.skipped}, errors=${counts.errors}`)
    }
  }

  console.log(`\nDone. ingested=${counts.ingested}, skipped=${counts.skipped}, errors=${counts.errors}`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
