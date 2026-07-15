import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()
const targets = [
  ['voteview_source_88_s_364', 'RS0880364'],
  ['voteview_source_89_h_35', 'RH0890035'],
  ['voteview_source_98_s_50', 'RS0980050'],
] as const
async function main() {
  for (const [ext, rcId] of targets) {
    const src = await p.source.findFirst({ where: { externalId: ext }, select: { id: true } })
    const lv = await p.legislativeVote.findFirst({ where: { sourceId: src!.id }, select: { id: true } })
    const rows = await p.memberVote.findMany({ where: { legislativeVoteId: lv!.id } })
    const res = await fetch(`https://voteview.com/api/download?rollcall_id=${rcId}`)
    const rc = (await res.json()).rollcalls[0]
    const live = rc.votes.filter((v: any) => v.vote_modifier !== 'president' && v.district !== 'POTUS' && v.state_abbrev !== 'USA')
    const label = (v: any) => {
      const base = v.vote === 'Abs' ? 'Not Voting' : v.vote
      return v.vote_modifier === 'paired' ? `Paired ${base}` : v.vote_modifier === 'announced' ? `Announced ${base}` : base
    }
    const liveMap = new Map(live.map((v: any) => [`${v.name}|${v.state_abbrev}`, label(v)]))
    let match = 0, mismatch = 0, missing = 0
    for (const r of rows) {
      const lval = liveMap.get(`${r.memberName}|${r.memberState}`)
      if (lval === undefined) { missing++; console.log(`  MISSING live: ${r.memberName}`) }
      else if (lval !== r.vote) { mismatch++; console.log(`  MISMATCH: ${r.memberName} db=${r.vote} live=${lval}`) }
      else match++
    }
    console.log(`${rcId}: db=${rows.length} live=${live.length} match=${match} mismatch=${mismatch} missing=${missing}`)
  }
}
main().finally(() => p.$disconnect())
