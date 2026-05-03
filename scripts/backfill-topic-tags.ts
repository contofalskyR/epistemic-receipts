// One-time backfill: tag existing claims with their appropriate topics.
// Uses text-pattern heuristics + ingestedBy to identify claim groups.
// Idempotent — safe to re-run (upserts, not inserts).
// Run: npx tsx scripts/backfill-topic-tags.ts

import 'dotenv/config'
import { PrismaClient } from '../app/generated/prisma/client'

const prisma = new PrismaClient()

async function getTopic(slug: string): Promise<string | null> {
  const topic = await prisma.topic.findUnique({ where: { slug } })
  if (!topic) { console.warn(`  Warning: topic '${slug}' not found`) }
  return topic?.id ?? null
}

async function tagClaim(claimId: string, topicIds: string[], label: string) {
  const valid = topicIds.filter(Boolean)
  if (valid.length === 0) return
  for (const topicId of valid) {
    await prisma.claimTopic.upsert({
      where: { claimId_topicId: { claimId, topicId } },
      update: {},
      create: { claimId, topicId },
    })
  }
  console.log(`  Tagged: ${label} → [${valid.length} topics]`)
}

async function tagAll(claimIds: string[], topicIds: string[], label: string) {
  for (const id of claimIds) await tagClaim(id, topicIds, label)
}

async function main() {
  console.log('=== Topic Tag Backfill ===\n')

  // ── Pre-load topics ────────────────────────────────────────────────────────
  const [
    tDrugApproval,
    tDiabetesTreatment,
    tPlanetaryClassification,
    tWorldWarII,
    tPacificTheater,
    tAtomicBombings,
    tWartimePowers,
    tEqualProtection,
    tJudicialReview,
    tTobaccoControl,
    tEpidemiology,
    tPharmaConduct,
    tPandemicOrigins,
  ] = await Promise.all([
    getTopic('drug-approval'),
    getTopic('diabetes-treatment'),
    getTopic('planetary-classification'),
    getTopic('world-war-ii'),
    getTopic('pacific-theater'),
    getTopic('atomic-bombings'),
    getTopic('wartime-powers'),
    getTopic('equal-protection'),
    getTopic('judicial-review'),
    getTopic('tobacco-control'),
    getTopic('epidemiology'),
    getTopic('pharmaceutical-industry-conduct'),
    getTopic('pandemic-origins'),
  ])

  // ── 1. All openFDA claims → Drug Approval ─────────────────────────────────
  const fdaClaims = await prisma.claim.findMany({
    where: { ingestedBy: 'openfda_v1', deleted: false },
    select: { id: true, externalId: true },
  })
  console.log(`openFDA claims: ${fdaClaims.length}`)
  if (tDrugApproval) {
    for (const c of fdaClaims) {
      await prisma.claimTopic.upsert({
        where: { claimId_topicId: { claimId: c.id, topicId: tDrugApproval } },
        update: {},
        create: { claimId: c.id, topicId: tDrugApproval },
      })
    }
    console.log(`  Tagged ${fdaClaims.length} openFDA claims → Drug Approval`)
  }

  // ── 2. Ozempic / semaglutide → Drug Approval + Diabetes Treatment ─────────
  const ozempic = await prisma.claim.findMany({
    where: { deleted: false, text: { contains: 'semaglutide',  } },
    select: { id: true, text: true },
  })
  for (const c of ozempic) {
    await tagClaim(c.id, [tDrugApproval, tDiabetesTreatment].filter(Boolean) as string[], `Ozempic: ${c.text.slice(0, 50)}`)
  }

  // ── 3. Pluto → Planetary Classification ───────────────────────────────────
  const pluto = await prisma.claim.findMany({
    where: { deleted: false, text: { contains: 'Pluto',  } },
    select: { id: true, text: true },
  })
  for (const c of pluto) {
    await tagClaim(c.id, [tPlanetaryClassification].filter(Boolean) as string[], `Pluto: ${c.text.slice(0, 50)}`)
  }

  // ── 4. Japan / atomic bombings → WW2 + Pacific Theater + Atomic Bombings ──
  const japanTopics = [tWorldWarII, tPacificTheater, tAtomicBombings].filter(Boolean) as string[]
  const japan = await prisma.claim.findMany({
    where: {
      deleted: false,
      OR: [
        { text: { contains: 'Hiroshima',  } },
        { text: { contains: 'Nagasaki',   } },
        { text: { contains: 'atomic bomb',  } },
        { text: { contains: 'Pacific War',  } },
      ],
    },
    select: { id: true, text: true },
  })
  for (const c of japan) {
    await tagClaim(c.id, japanTopics, `Japan/Atomic: ${c.text.slice(0, 50)}`)
  }

  // ── 5. Korematsu → Wartime Powers + Equal Protection + Judicial Review ─────
  const korematsuTopics = [tWartimePowers, tEqualProtection, tJudicialReview].filter(Boolean) as string[]
  const korematsu = await prisma.claim.findMany({
    where: {
      deleted: false,
      OR: [
        { text: { contains: 'Korematsu',  } },
        { text: { contains: 'Japanese American internment',  } },
        { text: { contains: 'Executive Order 9066',  } },
        { text: { contains: 'military necessity',  } },
      ],
    },
    select: { id: true, text: true },
  })
  for (const c of korematsu) {
    await tagClaim(c.id, korematsuTopics, `Korematsu: ${c.text.slice(0, 50)}`)
  }

  // ── 6. Smoking/tobacco → Tobacco Control + Epidemiology + Pharma Conduct ───
  const smokingTopics = [tTobaccoControl, tEpidemiology, tPharmaConduct].filter(Boolean) as string[]
  const smoking = await prisma.claim.findMany({
    where: {
      deleted: false,
      OR: [
        { text: { contains: 'tobacco',  } },
        { text: { contains: 'smoking',  } },
        { text: { contains: 'cigarette',  } },
        { text: { contains: 'lung cancer',  } },
        { text: { contains: 'nicotine',  } },
      ],
    },
    select: { id: true, text: true },
  })
  for (const c of smoking) {
    await tagClaim(c.id, smokingTopics, `Smoking: ${c.text.slice(0, 50)}`)
  }

  // ── 7. Lab leak / pandemic origins ────────────────────────────────────────
  const labLeak = await prisma.claim.findMany({
    where: {
      deleted: false,
      OR: [
        { text: { contains: 'SARS-CoV-2',  } },
        { text: { contains: 'Wuhan Institute',  } },
        { text: { contains: 'lab leak',  } },
        { text: { contains: 'laboratory origin',  } },
      ],
    },
    select: { id: true, text: true },
  })
  for (const c of labLeak) {
    await tagClaim(c.id, [tPandemicOrigins].filter(Boolean) as string[], `Lab leak: ${c.text.slice(0, 50)}`)
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  const total = await prisma.claimTopic.count()
  console.log(`\n=== Backfill complete — ${total} total ClaimTopic records ===`)

  await prisma.$disconnect()
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
