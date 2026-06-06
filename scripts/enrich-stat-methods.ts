// Tag OpenAlex-ingested claims with statistical methods detected in their
// title + abstract. Tags are stored at `Claim.metadata.statMethods: string[]`
// — no schema change required; piggybacks on the existing JSON metadata field.
//
// The detector itself lives in lib/statMethods.ts so the UI and this script
// share one source of truth for slugs / labels / patterns.
//
// Run (dry-run, 1k preview):
//   npx dotenv-cli -e .env.local -- npx tsx scripts/enrich-stat-methods.ts --dry-run --limit 1000
//
// Commit (seed 5k claims):
//   npx dotenv-cli -e .env.local -- npx tsx scripts/enrich-stat-methods.ts --commit --limit 5000
//
// Full sweep (will re-touch all ~212k openalex_v1 claims):
//   npx dotenv-cli -e .env.local -- npx tsx scripts/enrich-stat-methods.ts --commit
//
// Flags:
//   --commit       Write to DB (default is dry-run).
//   --limit N      Stop after scanning N claims.
//   --batch N      Batch size for read+write (default 500).
//   --force        Re-tag claims that already have metadata.statMethods set.

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { STAT_METHODS, detectStatMethods } from '../lib/statMethods'

const prisma = new PrismaClient()

// ── CLI ─────────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2)
  const commit = args.includes('--commit')
  const dryRun = !commit
  const force = args.includes('--force')
  const getNum = (flag: string, dflt: number) => {
    const i = args.indexOf(flag)
    if (i === -1) return dflt
    const n = parseInt(args[i + 1] ?? '', 10)
    return Number.isFinite(n) && n > 0 ? n : dflt
  }
  const limit = getNum('--limit', 0)
  const batch = getNum('--batch', 500)
  return { dryRun, commit, limit, batch, force }
}

// ── Main ────────────────────────────────────────────────────────────────────

type ClaimMeta = Record<string, unknown> & {
  title?: unknown
  statMethods?: unknown
}

async function main() {
  const { dryRun, limit, batch, force } = parseArgs()
  console.log(
    `enrich-stat-methods.ts ${dryRun ? '[DRY RUN]' : '[COMMIT]'}` +
      `  limit=${limit || 'all'}  batch=${batch}  force=${force}`,
  )

  const perMethod: Record<string, number> = {}
  for (const m of STAT_METHODS) perMethod[m.slug] = 0

  let scanned = 0
  let tagged = 0
  let untagged = 0
  let skippedExisting = 0
  let wrote = 0
  let cursor: string | undefined = undefined

  while (true) {
    if (limit && scanned >= limit) break
    const remaining = limit ? limit - scanned : batch
    const take = Math.min(batch, remaining)

    const rows = await prisma.claim.findMany({
      where: { ingestedBy: 'openalex_v1', deleted: false },
      take,
      orderBy: { id: 'asc' },
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: { id: true, text: true, metadata: true },
    })
    if (rows.length === 0) break

    const updates: { id: string; newMetadata: ClaimMeta }[] = []
    for (const r of rows) {
      scanned++
      const meta = ((r.metadata ?? {}) as ClaimMeta) ?? {}
      const hasExisting = Array.isArray(meta.statMethods)
      const title = typeof meta.title === 'string' ? meta.title : ''
      const haystack = `${title}\n${r.text ?? ''}`
      const methods = detectStatMethods(haystack)

      if (methods.length > 0) {
        tagged++
        for (const slug of methods) perMethod[slug] = (perMethod[slug] || 0) + 1
      } else {
        untagged++
      }

      if (hasExisting && !force) {
        skippedExisting++
        continue
      }

      updates.push({
        id: r.id,
        newMetadata: {
          ...meta,
          statMethods: methods,
          statMethodsTaggedAt: new Date().toISOString(),
        },
      })
    }

    if (!dryRun && updates.length > 0) {
      // One transaction per batch so the run is restartable.
      await prisma.$transaction(
        updates.map(u =>
          prisma.claim.update({
            where: { id: u.id },
            data: { metadata: u.newMetadata as object },
          }),
        ),
        { timeout: 60_000 },
      )
      wrote += updates.length
    }

    cursor = rows[rows.length - 1]?.id
    console.log(
      `  Progress: scanned=${scanned} tagged=${tagged} untagged=${untagged}` +
        ` skippedExisting=${skippedExisting} wrote=${wrote}`,
    )

    if (rows.length < take) break
  }

  console.log('\n── Summary ──────────────────────────────────────')
  console.log(`Scanned:               ${scanned}`)
  console.log(`Tagged with ≥1 method: ${tagged}`)
  console.log(`Untagged:              ${untagged}`)
  console.log(`Skipped existing:      ${skippedExisting}`)
  console.log(`DB writes performed:   ${wrote}${dryRun ? ' (dry-run; no writes)' : ''}`)
  console.log('\nPer-method counts (this run):')
  const sorted = Object.entries(perMethod).sort((a, b) => b[1] - a[1])
  for (const [slug, n] of sorted) {
    const m = STAT_METHODS.find(x => x.slug === slug)
    console.log(`  ${slug.padEnd(28)} ${(m?.label ?? '').padEnd(32)} ${n}`)
  }
  if (dryRun) {
    console.log('\n[DRY RUN — re-run with --commit to apply.]')
  }
}

main()
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
