// openFDA Drug Applications ingestion — rung 1 of the data ladder
// Public API, no key required for first 1,000 req/day
// Docs: https://open.fda.gov/apis/drug/drugsfda/
// Run: npm run ingest-openfda -- --limit 5

import 'dotenv/config'
import { PrismaClient } from '../app/generated/prisma/client'

const prisma = new PrismaClient()

// ---- Types ----------------------------------------------------------------

interface FDASubmission {
  submission_status: string
  submission_status_date: string
}

interface FDAApplication {
  application_number: string
  sponsor_name: string
  openfda?: {
    brand_name?: string[]
    generic_name?: string[]
  }
  submissions?: FDASubmission[]
}

interface FDAResponse {
  results: FDAApplication[]
  error?: { code: string; message: string }
}

// ---- Helpers ---------------------------------------------------------------

function parseApprovalDate(dateStr: string): Date {
  // openFDA format: YYYYMMDD
  const year = parseInt(dateStr.slice(0, 4), 10)
  const month = parseInt(dateStr.slice(4, 6), 10) - 1
  const day = parseInt(dateStr.slice(6, 8), 10)
  const d = new Date(year, month, day)
  if (isNaN(d.getTime())) throw new Error(`Invalid date: ${dateStr}`)
  return d
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function parseLimit(): number {
  const args = process.argv.slice(2)
  const idx = args.findIndex(a => a === '--limit')
  if (idx !== -1 && args[idx + 1]) {
    const n = parseInt(args[idx + 1], 10)
    if (!isNaN(n) && n > 0) return n
  }
  return 5
}

// ---- Main ------------------------------------------------------------------

async function main() {
  const limit = parseLimit()
  console.log(`\n=== openFDA Ingestion — limit: ${limit} ===\n`)

  const url = new URL('https://api.fda.gov/drug/drugsfda.json')
  // application_type is not a direct field; NDA prefix on application_number is the filter
  url.searchParams.set(
    'search',
    'application_number:NDA* AND submissions.submission_status:"AP"'
  )
  url.searchParams.set('limit', String(limit))
  // drugsfda endpoint does not support sort on nested fields; order is undefined

  console.log(`Fetching: ${url.toString()}\n`)

  const res = await fetch(url.toString())
  if (!res.ok) {
    const body = await res.text()
    console.error(`openFDA fetch failed: ${res.status} ${res.statusText}\n${body}`)
    process.exit(1)
  }

  const data = (await res.json()) as FDAResponse
  if (data.error) {
    console.error(`openFDA error: ${data.error.code} — ${data.error.message}`)
    process.exit(1)
  }

  const applications = data.results ?? []
  console.log(`Fetched ${applications.length} application(s) from openFDA\n`)

  let ingested = 0
  let skipped = 0
  let errors = 0

  for (const app of applications) {
    await sleep(250)

    const applicationNumber = app.application_number
    const numericPart = applicationNumber.replace(/\D/g, '')
    const brand = app.openfda?.brand_name?.[0]?.trim() || null
    const generic = app.openfda?.generic_name?.[0]?.trim() || null
    const applicant = app.sponsor_name

    if (!brand && !generic) {
      console.log(`  Skipped (insufficient data): ${applicationNumber} — no brand or generic name`)
      skipped++
      continue
    }

    const displayName = brand ?? generic!

    // Find earliest approved submission for original approval date
    const approvedSubs = (app.submissions ?? [])
      .filter(s => s.submission_status === 'AP' && s.submission_status_date)
      .sort((a, b) => a.submission_status_date.localeCompare(b.submission_status_date))

    if (approvedSubs.length === 0) {
      console.log(`  Skipped (no AP submission date): ${applicationNumber}`)
      skipped++
      continue
    }

    let approvalDate: Date
    try {
      approvalDate = parseApprovalDate(approvedSubs[0].submission_status_date)
    } catch {
      console.log(`  Skipped (bad date format): ${applicationNumber} — ${approvedSubs[0].submission_status_date}`)
      skipped++
      continue
    }

    const year = approvalDate.getFullYear()
    const approvalDateISO = approvalDate.toISOString().slice(0, 10)

    // Dedup — skip if already ingested
    const existing = await prisma.claim.findUnique({ where: { externalId: applicationNumber } })
    if (existing) {
      console.log(`  Skipped (already ingested): ${applicationNumber}`)
      skipped++
      continue
    }

    const claimText =
      brand && generic
        ? `${generic} (brand: ${brand}) demonstrated sufficient efficacy and safety in submitted clinical trials to meet FDA approval standards.`
        : `${displayName} demonstrated sufficient efficacy and safety in submitted clinical trials to meet FDA approval standards.`

    const sourceName = `FDA approval letter — ${displayName} (${applicationNumber})`
    // URL pattern — may not resolve for all records; fallback handled at display time
    const sourceUrl = `https://www.accessdata.fda.gov/drugsatfda_docs/appletter/${year}/${numericPart}Orig1s000ltr.pdf`

    try {
      await prisma.$transaction(async tx => {
        // A. Source — the approval letter
        const source = await tx.source.create({
          data: {
            name: sourceName,
            url: sourceUrl,
            publishedAt: approvalDate,
            methodologyType: 'primary',
            ingestedBy: 'openfda_v1',
            humanReviewed: false,
            externalId: applicationNumber,
          },
        })

        // B. Claim
        const claim = await tx.claim.create({
          data: {
            text: claimText,
            claimType: 'INSTITUTIONAL',
            claimEmergedAt: approvalDate,
            claimEmergedPrecision: 'DAY',
            currentStatus: 'HARD_FACT',
            parentClaimId: null,
            ingestedBy: 'openfda_v1',
            humanReviewed: false,
            externalId: applicationNumber,
          },
        })

        // C. Edge — Source FOR Claim
        const edge = await tx.edge.create({
          data: {
            sourceId: source.id,
            claimId: claim.id,
            type: 'FOR',
            evidenceType: 'PROCEDURAL',
            ingestedBy: 'openfda_v1',
            humanReviewed: false,
          },
        })

        // D. EdgeRevision — initial score
        await tx.edgeRevision.create({
          data: {
            edgeId: edge.id,
            priorScore: null,
            newScore: 85,
            reason: 'FDA institutional resolution — application approved per submitted evidence',
            changedAt: approvalDate,
          },
        })

        // E. ThresholdEvent — historical, backdated to approval date
        await tx.thresholdEvent.create({
          data: {
            claimId: claim.id,
            triggeredBy: `FDA NDA approval — application ${applicationNumber}`,
            triggeredBySourceId: source.id,
            confirmedBy: 'openfda_v1',
            note: `FDA approved ${displayName} on ${approvalDateISO} under ${applicationNumber}. Sponsor: ${applicant}.`,
            evidenceSnapshot: JSON.stringify([{ id: edge.id, score: 85 }]),
            createdAt: approvalDate,
            ingestedBy: 'openfda_v1',
            humanReviewed: false,
          },
        })
      })

      // Tag with the Drug Approval topic (best-effort; warn if topic not found)
      try {
        const drugApprovalTopic = await prisma.topic.findUnique({ where: { slug: 'drug-approval' } })
        if (drugApprovalTopic) {
          // claim created in transaction above; fetch its id via externalId
          const created = await prisma.claim.findUnique({ where: { externalId: applicationNumber } })
          if (created) {
            await prisma.claimTopic.upsert({
              where: { claimId_topicId: { claimId: created.id, topicId: drugApprovalTopic.id } },
              update: {},
              create: { claimId: created.id, topicId: drugApprovalTopic.id },
            })
          }
        } else {
          console.warn(`  Warning: topic 'drug-approval' not found — skipping auto-tag for ${applicationNumber}`)
        }
      } catch (tagErr) {
        const msg = tagErr instanceof Error ? tagErr.message : String(tagErr)
        console.warn(`  Warning: failed to tag ${applicationNumber} with drug-approval — ${msg}`)
      }

      console.log(`  Ingested: ${applicationNumber} — ${displayName}`)
      ingested++
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  Failed: ${applicationNumber} — ${msg}`)
      errors++
    }
  }

  console.log(`\n=== Summary ===`)
  console.log(`  Ingested : ${ingested}`)
  console.log(`  Skipped  : ${skipped}`)
  console.log(`  Errors   : ${errors}`)
  console.log(`  Total    : ${applications.length}\n`)

  await prisma.$disconnect()
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
