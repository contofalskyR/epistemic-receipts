import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()
const targets: [string, string][] = [
  ['voteview_source_88_s_364', 'CRA 1964 Senate cloture-era'],
  ['voteview_source_119_h_530', 'War Powers 2026 House'],
  ['voteview_source_117_s_418', 'Senate 50-50 tie c117'],
  ['voteview_source_89_h_35', 'Medicare 1965 House'],
  ['voteview_source_98_s_50', 'Social Security 1983 Senate'],
]
async function main() {
  for (const [ext, label] of targets) {
    const src = await p.source.findFirst({ where: { externalId: ext }, select: { id: true } })
    if (!src) { console.log(ext, 'SOURCE NOT FOUND'); continue }
    const lv = await p.legislativeVote.findFirst({ where: { sourceId: src.id }, select: { id: true, yesCount: true, noCount: true } })
    if (!lv) { console.log(ext, 'LV NOT FOUND'); continue }
    const rows = await p.memberVote.findMany({ where: { legislativeVoteId: lv.id }, orderBy: { memberName: 'asc' } })
    console.log(`\n=== ${ext} (${label}) — ${rows.length} rows, DB counts ${lv.yesCount}-${lv.noCount}`)
    const picks = [rows[0], rows[Math.floor(rows.length/2)], rows[rows.length-1]]
    for (const r of picks) console.log(`  ${r!.memberName} | ${r!.memberState} | ${r!.memberParty} | ${r!.vote} | bioguide=${r!.memberId}`)
  }
}
main().finally(() => p.$disconnect())
