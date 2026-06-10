import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const revalidate = 300

const PAGE_SIZE = 50

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const chamber = sp.get('chamber') ?? 'all'
  const party = sp.get('party') ?? 'all'
  const ticker = (sp.get('ticker') ?? '').trim().toUpperCase()
  const txType = sp.get('type') ?? 'all'
  const offset = Math.max(0, parseInt(sp.get('offset') ?? '0', 10) || 0)
  const mode = sp.get('mode') ?? 'trades'

  const baseWhere = {
    ingestedBy: 'congress_stock_act_v1',
    deleted: false,
  }

  if (mode === 'leaderboard') {
    // Most active traders
    const claims = await prisma.claim.findMany({
      where: baseWhere,
      select: {
        metadata: true,
      },
    })

    const counts: Record<string, { name: string; party: string; chamber: string; trades: number; purchases: number; sales: number }> = {}

    for (const c of claims) {
      const m = c.metadata as Record<string, unknown>
      const name = (m?.member_name as string) ?? ''
      const p = (m?.party as string) ?? ''
      const ch = (m?.chamber as string) ?? ''
      const tx = (m?.transaction_type as string) ?? ''
      if (!name) continue

      if (!counts[name]) {
        counts[name] = { name, party: p, chamber: ch, trades: 0, purchases: 0, sales: 0 }
      }
      counts[name].trades++
      if (tx === 'purchase') counts[name].purchases++
      else if (tx === 'sale') counts[name].sales++
    }

    const leaderboard = Object.values(counts)
      .sort((a, b) => b.trades - a.trades)
      .slice(0, 25)

    return NextResponse.json({ leaderboard })
  }

  // Trades listing — bound parameters for all user-derived values
  const condParams: unknown[] = []
  const conditions: string[] = [`c."ingestedBy" = 'congress_stock_act_v1'`, `c.deleted = false`]

  if (chamber !== 'all') {
    condParams.push(chamber.charAt(0).toUpperCase() + chamber.slice(1).toLowerCase())
    conditions.push(`c.metadata->>'chamber' = $${condParams.length}`)
  }
  if (party !== 'all') {
    condParams.push(party.toUpperCase())
    conditions.push(`c.metadata->>'party' = $${condParams.length}`)
  }
  if (ticker) {
    condParams.push(ticker)
    conditions.push(`c.metadata->>'ticker' = $${condParams.length}`)
  }
  if (txType !== 'all') {
    condParams.push(txType.toLowerCase())
    conditions.push(`c.metadata->>'transaction_type' = $${condParams.length}`)
  }

  const where = conditions.join(' AND ')
  const dataParams = [...condParams, offset]
  const offsetIdx = dataParams.length

  const [rows, countResult] = await Promise.all([
    prisma.$queryRawUnsafe<Array<{
      id: string
      text: string
      metadata: unknown
      claimEmergedAt: Date | null
    }>>(
      `SELECT c.id, c.text, c.metadata, c."claimEmergedAt"
       FROM "Claim" c
       WHERE ${where}
       ORDER BY c."claimEmergedAt" DESC NULLS LAST, c."createdAt" DESC
       LIMIT ${PAGE_SIZE} OFFSET $${offsetIdx}`,
      ...dataParams
    ),
    prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT COUNT(*) as count FROM "Claim" c WHERE ${where}`,
      ...condParams
    ),
  ])

  const total = Number(countResult[0]?.count ?? 0)

  const trades = rows.map(r => {
    const m = r.metadata as Record<string, unknown>
    return {
      id: r.id,
      memberName: (m?.member_name as string) ?? '',
      bioguideId: (m?.bioguide_id as string) ?? null,
      party: (m?.party as string) ?? '',
      chamber: (m?.chamber as string) ?? '',
      ticker: (m?.ticker as string) ?? '',
      transactionType: (m?.transaction_type as string) ?? '',
      amountRange: (m?.amount_range as string) ?? '',
      tradeDate: (m?.trade_date as string) ?? '',
      disclosureDate: (m?.disclosure_date as string) ?? '',
      tickerType: (m?.ticker_type as string) ?? null,
      excessReturn: (m?.excess_return as number) ?? null,
      claimText: r.text,
    }
  })

  return NextResponse.json({ total, trades, offset, pageSize: PAGE_SIZE })
}
