// One-time enrichment: populate LegislativeVote.topics for Voteview rows.
// Keyword-matches the joined Source.name against a small taxonomy and writes
// the matched topic slugs as a JSON-encoded array. Rows that match nothing
// are written as "[]" so we can distinguish "processed, no topic" from
// "never enriched" (NULL).
//
// Run:
//   npx dotenv-cli -e .env.local -- npx tsx scripts/enrich-voteview-topics.ts --dry-run
//   ALLOW_EDITS=true npx dotenv-cli -e .env.local -- npx tsx scripts/enrich-voteview-topics.ts
//   ALLOW_EDITS=true npx dotenv-cli -e .env.local -- npx tsx scripts/enrich-voteview-topics.ts --limit 5000

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const TOPIC_TAXONOMY: Record<string, string[]> = {
  slavery:       ["slave", "slavery", "slaveholder", "bondage", "fugitive slave", "slave trade"],
  civil_rights:  ["civil rights", "freedmen", "segregation", "discrimination", "colored", "reconstruction", "voting rights", "equal rights", "desegregation", "suffrage", "negro"],
  // 'pension' removed 2026-07-04: double-tagged 1,185 votes with social_welfare
  // (audit-vote-topics). Ruling: pensions → social_welfare; military keeps 'veteran'.
  military:      ["army", "navy", "marine", "military", "troops", "soldier", "war department", "armed forces", "draft", "selective service", "national guard", "veteran"],
  war:           ["declaration of war", "war with", "hostilities", "combat operations", "invasion", "armistice", "treaty of peace"],
  defense:       ["defense", "pentagon", "secretary of defense", "department of defense", "national security", "homeland security", "missile", "nuclear", "weapons system"],
  tariff_trade:  ["tariff", "duty on", "import duty", "customs", "free trade", "trade agreement", "reciprocal trade", "commerce", "smuggling"],
  // gains bare 'insurance' 2026-07-04 (financial instrument); health keeps
  // only 'health insurance' — 468 fire/building-insurance bills were mis-bucketed.
  banking_finance: ["bank", "banking", "currency", "gold", "silver", "coinage", "mint", "federal reserve", "bonds", "treasury notes", "debt", "deficit", "budget", "insurance"],
  taxation:      ["tax", "revenue", "income tax", "excise", "levy", "internal revenue", "fiscal"],
  immigration:   ["immigration", "immigrant", "alien", "naturalization", "citizenship", "deportation", "border", "refugee", "asylum"],
  public_lands:  ["public land", "homestead", "territory", "lands", "settlement", "survey", "reservation", "indian territory"],
  native_affairs: ["indian", "tribe", "treaty with", "cherokee", "sioux", "apache", "iroquois", "native american", "bureau of indian"],
  infrastructure: ["railroad", "canal", "road", "bridge", "harbor", "river", "navigation", "post road", "internal improvement", "highway", "interstate"],
  postal:        ["post office", "postal", "mail", "postmaster", "postage"],
  judiciary:     ["court", "judge", "judicial", "supreme court", "circuit court", "district court", "habeas corpus", "impeachment"],
  foreign_policy: ["foreign", "treaty", "ambassador", "minister", "consulate", "diplomatic", "international", "united nations", "nato", "foreign aid", "foreign relations"],
  health:        ["health", "disease", "quarantine", "epidemic", "hospital", "public health", "medicare", "medicaid", "health insurance", "pandemic"],
  education:     ["education", "school", "university", "college", "land grant", "student", "teacher", "library"],
  environment:   ["environment", "pollution", "conservation", "wilderness", "forest", "national park", "clean air", "clean water", "climate"],
  agriculture:   ["agriculture", "farm", "crop", "drought", "irrigation", "agricultural", "food", "livestock", "rural"],
  labor:         ["labor", "worker", "wage", "strike", "union", "employment", "minimum wage", "child labor", "workmen"],
  housing:       ["housing", "mortgage", "rent", "urban renewal", "public housing", "homeless"],
  appropriations: ["appropriation", "appropriating", "supplemental appropriation"],
  social_welfare: ["welfare", "relief", "social security", "pension", "aid to", "poverty", "unemployment", "public assistance"],
  prohibition:   ["prohibition", "alcohol", "liquor", "temperance", "intoxicating", "beer", "wine", "spirits"],
  // bare 'space' replaced 2026-07-04: it tagged "Airspace" bills as technology.
  technology:    ["technology", "telecommunications", "internet", "nuclear energy", "atomic", "outer space", "space station", "space shuttle", "space program", "space exploration", "space launch", "aerospace", "nasa", "satellite", "artificial intelligence"],
}

// Title patterns that veto a topic even when its keywords match — each earned
// its place in the 2026-07-04 audit with receipts (audit-vote-topics.ts).
const EXCLUSIONS: { topic: string; veto: RegExp }[] = [
  { topic: 'native_affairs', veto: /indian (river|creek|lake|head|wells|hills?|springs?)\b/i }, // place names
  { topic: 'banking_finance', veto: /gold(en)? medal/i }, // Congressional Gold Medal acts
  { topic: 'slavery', veto: /modern slavery|human trafficking/i }, // modern trafficking ≠ chattel-slavery zeitgeist
]

// ── Word-boundary matcher (2026-07-04) ────────────────────────────────────────
// The original matcher used `title.includes(keyword)`: 'indian' matched
// Indiana, 'road' matched broadcast/abroad, 'gold' matched Goldwater — 13% of
// votes carried at least one substring-artifact tag (audit re-tag simulation).
// Keywords now compile to \b-anchored regexes, with plural-'s' tolerance for
// single-word keywords.
function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const COMPILED: [string, RegExp[]][] = Object.entries(TOPIC_TAXONOMY).map(([slug, kws]) => [
  slug,
  kws.map((kw) => {
    const plural = !kw.includes(' ') && !kw.endsWith('s') ? 's?' : ''
    return new RegExp(`\\b${escapeRe(kw)}${plural}\\b`, 'i')
  }),
])

function matchTopics(name: string): string[] {
  const out: string[] = []
  for (const [slug, regexes] of COMPILED) {
    if (!regexes.some((re) => re.test(name))) continue
    if (EXCLUSIONS.some((e) => e.topic === slug && e.veto.test(name))) continue
    out.push(slug)
  }
  return out
}

type Row = { id: string; name: string | null }

function parseArgs(): { dryRun: boolean; limit: number | null } {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const limitIdx = args.indexOf('--limit')
  let limit: number | null = null
  if (limitIdx >= 0 && args[limitIdx + 1]) {
    const n = parseInt(args[limitIdx + 1]!, 10)
    if (Number.isFinite(n) && n > 0) limit = n
  }
  return { dryRun, limit }
}

async function main() {
  const { dryRun, limit } = parseArgs()
  const allowEdits = process.env.ALLOW_EDITS === 'true'

  console.log('=== Voteview topic enrichment ===')
  console.log(`Mode: ${dryRun ? 'DRY RUN' : allowEdits ? 'WRITE' : 'READ-ONLY (set ALLOW_EDITS=true to write)'}`)
  if (limit) console.log(`Limit: ${limit}`)
  console.log('')

  const totalCount = await prisma.legislativeVote.count({
    where: { source: { ingestedBy: 'voteview_v1' } },
  })
  const target = limit ? Math.min(limit, totalCount) : totalCount
  console.log(`Voteview rows in DB: ${totalCount.toLocaleString()} · target: ${target.toLocaleString()}\n`)

  const BATCH_SIZE = 1000
  let processed = 0
  let matched = 0
  let unmatched = 0
  let changed = 0
  let dryRunSamples = 0
  let cursor: string | undefined
  const topicDelta = new Map<string, number>()

  while (processed < target) {
    const take = Math.min(BATCH_SIZE, target - processed)
    const rows: (Row & { current: string | null })[] = await prisma.legislativeVote.findMany({
      where: { source: { ingestedBy: 'voteview_v1' } },
      select: { id: true, topics: true, source: { select: { name: true } } },
      orderBy: { id: 'asc' },
      take,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    }).then((rs) =>
      rs.map((r) => ({ id: r.id, name: r.source?.name ?? null, current: r.topics })),
    )

    if (rows.length === 0) break

    // Diff-aware: only write rows whose tag set actually changes, and keep a
    // per-topic add/remove ledger so the retag has a receipt.
    const writes: { id: string; topicsJson: string }[] = []
    for (const r of rows) {
      const topics = r.name ? matchTopics(r.name) : []
      if (topics.length > 0) matched++
      else unmatched++
      const next = JSON.stringify(topics)
      let cur: string[] = []
      try { cur = r.current ? (JSON.parse(r.current) as string[]) : [] } catch { /* treat as [] */ }
      const curNorm = JSON.stringify([...cur].sort())
      const nextNorm = JSON.stringify([...topics].sort())
      if (curNorm !== nextNorm) {
        writes.push({ id: r.id, topicsJson: next })
        for (const t of topics) if (!cur.includes(t)) topicDelta.set(t, (topicDelta.get(t) ?? 0) + 1)
        for (const t of cur) if (!topics.includes(t)) topicDelta.set(t, (topicDelta.get(t) ?? 0) - 1)
        if (dryRun && dryRunSamples < 20) {
          console.log(`  [${dryRunSamples + 1}] ${r.name?.slice(0, 90)}`)
          console.log(`      ${cur.join(', ') || '(none)'} → ${topics.join(', ') || '(none)'}`)
          dryRunSamples++
        }
      }
    }
    changed += writes.length

    if (!dryRun && allowEdits && writes.length > 0) {
      const ops = writes.map((w) =>
        prisma.legislativeVote.update({
          where: { id: w.id },
          data: { topics: w.topicsJson },
        }),
      )
      await prisma.$transaction(ops)
    }

    processed += rows.length
    cursor = rows[rows.length - 1]!.id

    console.log(
      `processed ${processed.toLocaleString()}/${target.toLocaleString()} · matched ${matched.toLocaleString()} · unmatched ${unmatched.toLocaleString()}`,
    )

    if (rows.length < take) break
  }

  console.log('')
  console.log(`Final: processed ${processed.toLocaleString()}, matched ${matched.toLocaleString()}, unmatched ${unmatched.toLocaleString()}, tag-set changes ${changed.toLocaleString()}`)
  if (topicDelta.size > 0) {
    console.log('Per-topic delta (net rows gained/lost):')
    for (const [t, d] of [...topicDelta.entries()].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])))
      console.log(`  ${d >= 0 ? '+' : ''}${d.toLocaleString().padStart(7)}  ${t}`)
  }
  if (dryRun) console.log('(dry-run — no writes performed)')
  else if (!allowEdits) console.log('(ALLOW_EDITS not set — no writes performed)')

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
