// Phase 2: CONTRADICTS ClaimRelation detector — retraction notices ↔ original papers.
//
// Strategy: CrossRef retractions (metadata.doi = "10.xxxx/yyy") are matched against
// OpenAlex claims (metadata.doi = "https://doi.org/10.xxxx/yyy") by normalizing both
// to the bare DOI. A CONTRADICTS relation is created from the retraction claim to the
// original paper claim — the retraction invalidates the paper's epistemic standing.
//
// Run (dry):  npx dotenv-cli -e .env.local -- npx tsx scripts/detect-contradictions.ts
// Run (live): ALLOW_EDITS=true npx dotenv-cli -e .env.local -- npx tsx scripts/detect-contradictions.ts

import 'dotenv/config'
import { PrismaClient, Prisma } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.env.ALLOW_EDITS !== 'true'
const BATCH = 500
const RELATION_TYPE = 'CONTRADICTS'

function normalizeDoi(raw: string | null | undefined): string | null {
  if (!raw) return null
  const s = raw.trim().toLowerCase()
  return s.replace(/^https?:\/\/doi\.org\//i, '')
}

async function main() {
  console.log(`Detect contradictions — ${DRY_RUN ? 'DRY RUN' : 'LIVE WRITE'}`)
  console.log()
  console.log('Step 1: Loading OpenAlex DOI index…')

  // Build a DOI → claimId map for all OpenAlex claims that have a DOI
  const oaDoiMap = new Map<string, string>() // normalized DOI → claimId
  let oaCursor: string | null = null
  let oaTotal = 0
  while (true) {
    const batch: { id: string; metadata: Prisma.JsonValue }[] = await prisma.claim.findMany({
      where: { ingestedBy: 'openalex_v1', NOT: [{ metadata: { equals: Prisma.JsonNull } }], deleted: false },
      select: { id: true, metadata: true },
      take: BATCH,
      ...(oaCursor ? { cursor: { id: oaCursor }, skip: 1 } : {}),
      orderBy: { id: 'asc' },
    })
    if (batch.length === 0) break
    oaCursor = batch[batch.length - 1]!.id
    for (const c of batch) {
      const doi = normalizeDoi((c.metadata as { doi?: string } | null)?.doi)
      if (doi) oaDoiMap.set(doi, c.id)
    }
    oaTotal += batch.length
    if (oaTotal % 50000 === 0) console.log(`  … indexed ${oaTotal} OpenAlex claims`)
  }
  console.log(`  Indexed ${oaDoiMap.size} unique DOIs from ${oaTotal} OpenAlex claims`)
  console.log()

  console.log('Step 2: Scanning CrossRef retractions…')
  let retCursor: string | null = null
  let checked = 0, matched = 0, created = 0, skipped = 0

  while (true) {
    const batch: { id: string; metadata: Prisma.JsonValue }[] = await prisma.claim.findMany({
      where: { ingestedBy: { in: ['crossref_retractions_v1', 'retraction_watch_v1'] }, NOT: [{ metadata: { equals: Prisma.JsonNull } }], deleted: false },
      select: { id: true, metadata: true },
      take: BATCH,
      ...(retCursor ? { cursor: { id: retCursor }, skip: 1 } : {}),
      orderBy: { id: 'asc' },
    })
    if (batch.length === 0) break
    retCursor = batch[batch.length - 1]!.id
    checked += batch.length

    const toCreate: { fromClaimId: string; toClaimId: string; relationType: string }[] = []

    for (const ret of batch) {
      const doi = normalizeDoi((ret.metadata as { doi?: string } | null)?.doi)
      if (!doi) continue
      const oaClaimId = oaDoiMap.get(doi)
      if (!oaClaimId) continue
      matched++
      toCreate.push({ fromClaimId: ret.id, toClaimId: oaClaimId, relationType: RELATION_TYPE })
    }

    if (toCreate.length === 0) continue

    if (!DRY_RUN) {
      const result = await prisma.claimRelation.createMany({
        data: toCreate.map(r => ({
          fromClaimId: r.fromClaimId,
          toClaimId: r.toClaimId,
          relationType: r.relationType,
          followUpContext: { heuristic: 'doi_match', pipeline_from: 'crossref_retractions_v1', pipeline_to: 'openalex_v1' },
        })),
        skipDuplicates: true,
      })
      created += result.count
      skipped += toCreate.length - result.count
    } else {
      created += toCreate.length
    }

    if (checked % 5000 === 0) {
      console.log(`  … checked ${checked} retractions, ${matched} matched, ${created} ${DRY_RUN ? 'would create' : 'created'}`)
    }
  }

  console.log()
  console.log('── Results ──')
  console.log(`  Retractions checked:    ${checked}`)
  console.log(`  DOI matches found:      ${matched}`)
  console.log(`  Relations ${DRY_RUN ? 'would create' : 'created'}:   ${created}`)
  console.log(`  Skipped (duplicates):   ${skipped}`)

  if (!DRY_RUN) {
    const total = await prisma.claimRelation.count({ where: { relationType: RELATION_TYPE } })
    console.log()
    console.log(`  DB total CONTRADICTS:   ${total}`)
  }

  if (DRY_RUN) {
    console.log()
    console.log('Dry run complete. Set ALLOW_EDITS=true to write.')
  }

  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
