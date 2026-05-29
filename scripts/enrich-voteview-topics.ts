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
  military:      ["army", "navy", "marine", "military", "troops", "soldier", "war department", "armed forces", "draft", "selective service", "national guard", "veteran", "pension"],
  war:           ["declaration of war", "war with", "hostilities", "combat operations", "invasion", "armistice", "treaty of peace"],
  defense:       ["defense", "pentagon", "secretary of defense", "department of defense", "national security", "homeland security", "missile", "nuclear", "weapons system"],
  tariff_trade:  ["tariff", "duty on", "import duty", "customs", "free trade", "trade agreement", "reciprocal trade", "commerce", "smuggling"],
  banking_finance: ["bank", "banking", "currency", "gold", "silver", "coinage", "mint", "federal reserve", "bonds", "treasury notes", "debt", "deficit", "budget"],
  taxation:      ["tax", "revenue", "income tax", "excise", "levy", "internal revenue", "fiscal"],
  immigration:   ["immigration", "immigrant", "alien", "naturalization", "citizenship", "deportation", "border", "refugee", "asylum"],
  public_lands:  ["public land", "homestead", "territory", "lands", "settlement", "survey", "reservation", "indian territory"],
  native_affairs: ["indian", "tribe", "treaty with", "cherokee", "sioux", "apache", "iroquois", "native american", "bureau of indian"],
  infrastructure: ["railroad", "canal", "road", "bridge", "harbor", "river", "navigation", "post road", "internal improvement", "highway", "interstate"],
  postal:        ["post office", "postal", "mail", "postmaster", "postage"],
  judiciary:     ["court", "judge", "judicial", "supreme court", "circuit court", "district court", "habeas corpus", "impeachment"],
  foreign_policy: ["foreign", "treaty", "ambassador", "minister", "consulate", "diplomatic", "international", "united nations", "nato", "foreign aid", "foreign relations"],
  health:        ["health", "disease", "quarantine", "epidemic", "hospital", "public health", "medicare", "medicaid", "insurance", "pandemic"],
  education:     ["education", "school", "university", "college", "land grant", "student", "teacher", "library"],
  environment:   ["environment", "pollution", "conservation", "wilderness", "forest", "national park", "clean air", "clean water", "climate"],
  agriculture:   ["agriculture", "farm", "crop", "drought", "irrigation", "agricultural", "food", "livestock", "rural"],
  labor:         ["labor", "worker", "wage", "strike", "union", "employment", "minimum wage", "child labor", "workmen"],
  housing:       ["housing", "mortgage", "rent", "urban renewal", "public housing", "homeless"],
  appropriations: ["appropriation", "appropriating", "supplemental appropriation"],
  social_welfare: ["welfare", "relief", "social security", "pension", "aid to", "poverty", "unemployment", "public assistance"],
  prohibition:   ["prohibition", "alcohol", "liquor", "temperance", "intoxicating", "beer", "wine", "spirits"],
  technology:    ["technology", "telecommunications", "internet", "nuclear energy", "atomic", "space", "satellite", "artificial intelligence"],
}

function matchTopics(name: string): string[] {
  const lower = name.toLowerCase()
  const out: string[] = []
  for (const [slug, kws] of Object.entries(TOPIC_TAXONOMY)) {
    for (const kw of kws) {
      if (lower.includes(kw)) {
        out.push(slug)
        break
      }
    }
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
  let dryRunSamples = 0
  let cursor: string | undefined

  while (processed < target) {
    const take = Math.min(BATCH_SIZE, target - processed)
    const rows: Row[] = await prisma.legislativeVote.findMany({
      where: { source: { ingestedBy: 'voteview_v1' } },
      select: { id: true, source: { select: { name: true } } },
      orderBy: { id: 'asc' },
      take,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    }).then((rs) =>
      rs.map((r) => ({ id: r.id, name: r.source?.name ?? null })),
    )

    if (rows.length === 0) break

    const writes: { id: string; topicsJson: string }[] = []
    for (const r of rows) {
      const topics = r.name ? matchTopics(r.name) : []
      if (topics.length > 0) matched++
      else unmatched++
      writes.push({ id: r.id, topicsJson: JSON.stringify(topics) })

      if (dryRun && topics.length > 0 && dryRunSamples < 20) {
        console.log(`  [${dryRunSamples + 1}] ${r.name?.slice(0, 90)}`)
        console.log(`      → ${topics.join(', ')}`)
        dryRunSamples++
      }
    }

    if (!dryRun && allowEdits) {
      await prisma.$transaction(
        writes.map((w) =>
          prisma.legislativeVote.update({
            where: { id: w.id },
            data: { topics: w.topicsJson },
          }),
        ),
        { timeout: 60_000 },
      )
    }

    processed += rows.length
    cursor = rows[rows.length - 1]!.id

    console.log(
      `processed ${processed.toLocaleString()}/${target.toLocaleString()} · matched ${matched.toLocaleString()} · unmatched ${unmatched.toLocaleString()}`,
    )

    if (rows.length < take) break
  }

  console.log('')
  console.log(`Final: processed ${processed.toLocaleString()}, matched ${matched.toLocaleString()}, unmatched ${unmatched.toLocaleString()}`)
  if (dryRun) console.log('(dry-run — no writes performed)')
  else if (!allowEdits) console.log('(ALLOW_EDITS not set — no writes performed)')

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
