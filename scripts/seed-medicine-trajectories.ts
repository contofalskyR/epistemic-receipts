// Seed: Medicine & Drug Approvals epistemic trajectories
//
// Domain-specific settling curves: each trajectory is a dateable medical/
// pharmacological claim with a verifiable epistemic arc — from initial
// expert literature finding through institutional adoption, regulatory
// action, court judgments, public recognition, or market response.
//
// Sources: PubMed, FDA approval databases, Retraction Watch, NEJM, Lancet,
// WHO bulletins, congressional records, court decisions.
//
// Idempotent: upserts on externalId.
//
// Run:     npx tsx scripts/seed-medicine-trajectories.ts
// Dry-run: npx tsx scripts/seed-medicine-trajectories.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

type FactStatus = 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'OPEN' | 'UNRESOLVABLE' | 'REVERSED' | 'ABANDONED'
type RatifyingCommunity = 'EXPERT_LITERATURE' | 'INSTITUTIONAL' | 'JUDICIAL' | 'PUBLIC' | 'MARKET'
type DatePrecision = 'DAY' | 'MONTH' | 'QUARTER' | 'YEAR'

interface SourceDef {
  externalId: string
  name: string
  url: string
  publishedAt: string
  methodologyType: 'primary' | 'derivative' | 'opinion'
}

interface Transition {
  fromAxis: FactStatus | null
  toAxis: FactStatus
  community: RatifyingCommunity
  occurredAt: string
  datePrecision: DatePrecision
  reason: string
  source: SourceDef
}

interface Trajectory {
  externalId: string
  text: string
  claimType: 'EMPIRICAL' | 'INSTITUTIONAL' | 'INTERPRETIVE' | 'HYBRID'
  claimEmergedAt: string
  claimEmergedPrecision: DatePrecision
  currentAxis: 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'OPEN' | 'UNRESOLVABLE'
  transitions: Transition[]
}

const TRAJECTORIES: Trajectory[] = [

  // ═══════════════════════════════════════════════════════════════════════════════
  // DRUG DISCOVERY ERA (pre-1950)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── 1. Penicillin discovered — Fleming 1928 ─────────────────────────────────
  {
    externalId: 'trajectory:penicillin-discovery-1928',
    text: 'Alexander Fleming observed on 28 September 1928 that the mold Penicillium notatum inhibited bacterial growth on a contaminated culture plate, establishing that penicillin had antibacterial properties.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1928-09-28',
    claimEmergedPrecision: 'DAY',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1929-06-01',
        datePrecision: 'MONTH',
        reason: 'Fleming publishes his observation in the British Journal of Experimental Pathology, describing the mold\'s bacteriostatic effect. The finding is noted but largely ignored for a decade — Fleming himself was unable to stabilize the compound.',
        source: {
          externalId: 'src:fleming-penicillin-1929',
          name: 'Fleming A. On the antibacterial action of cultures of a Penicillium. British Journal of Experimental Pathology. 1929;10(3):226–236.',
          url: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC2048009/',
          publishedAt: '1929-06-01',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1940-08-24',
        datePrecision: 'DAY',
        reason: 'Chain, Florey, and colleagues at Oxford publish the first clinical results demonstrating penicillin\'s efficacy in infected mice in The Lancet, establishing its therapeutic potential. This paper restarts serious scientific and institutional interest.',
        source: {
          externalId: 'src:chain-florey-penicillin-1940',
          name: 'Chain E, Florey HW, et al. Penicillin as a Chemotherapeutic Agent. Lancet. 1940;236(6104):226–228.',
          url: 'https://www.thelancet.com/journals/lancet/article/PIIS0140-6736(01)08728-1/fulltext',
          publishedAt: '1940-08-24',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'SETTLED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1945-10-25',
        datePrecision: 'DAY',
        reason: 'Fleming, Chain, and Florey are awarded the Nobel Prize in Physiology or Medicine for the discovery and development of penicillin, cementing institutional recognition of the antibiotic\'s significance.',
        source: {
          externalId: 'src:nobel-penicillin-1945',
          name: 'Nobel Prize Committee. Nobel Prize in Physiology or Medicine 1945. NobelPrize.org.',
          url: 'https://www.nobelprize.org/prizes/medicine/1945/summary/',
          publishedAt: '1945-10-25',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // CLINICAL TRIALS ERA (1950–1990)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── 2. Smoking causes lung cancer — Doll & Hill 1950 ───────────────────────
  {
    externalId: 'trajectory:smoking-causes-lung-cancer-1950',
    text: 'Cigarette smoking causes lung cancer in humans.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1950-09-30',
    claimEmergedPrecision: 'MONTH',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1950-09-30',
        datePrecision: 'MONTH',
        reason: 'Doll and Hill publish a landmark case-control study in the British Medical Journal showing a statistically significant association between cigarette smoking and lung cancer. Simultaneously Wynder & Graham publish similar findings in JAMA. Expert literature moves from OPEN to RECORDED.',
        source: {
          externalId: 'src:doll-hill-smoking-1950',
          name: 'Doll R, Hill AB. Smoking and Carcinoma of the Lung. BMJ. 1950;2(4682):739–748.',
          url: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC2038856/',
          publishedAt: '1950-09-30',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1964-01-11',
        datePrecision: 'DAY',
        reason: 'The U.S. Surgeon General\'s Advisory Committee report, reviewing over 7,000 studies, concludes that "cigarette smoking is causally related to lung cancer in men." The 14-year lag between expert literature consensus and institutional recognition is one of the defining epistemic delays of the 20th century.',
        source: {
          externalId: 'src:surgeon-general-smoking-1964',
          name: 'U.S. Surgeon General\'s Advisory Committee. Smoking and Health. Public Health Service Publication No. 1103. January 11, 1964.',
          url: 'https://profiles.nlm.nih.gov/spotlight/nn/feature/smoking',
          publishedAt: '1964-01-11',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'SETTLED',
        toAxis: 'SETTLED',
        community: 'JUDICIAL',
        occurredAt: '1998-11-23',
        datePrecision: 'DAY',
        reason: 'The Tobacco Master Settlement Agreement is signed by 46 U.S. states and the four largest tobacco companies, requiring $206 billion in payments over 25 years and accepting liability for smoking-related illness. Courts formally ratify the scientific consensus as a legal fact.',
        source: {
          externalId: 'src:tobacco-msa-1998',
          name: 'National Association of Attorneys General. Master Settlement Agreement. November 23, 1998.',
          url: 'https://www.naag.org/our-work/naag-center-for-tobacco-and-public-health/the-master-settlement-agreement/',
          publishedAt: '1998-11-23',
          methodologyType: 'primary',
        },
      },
    ],
  },

  // ── 3. Thalidomide — approved, reversed, partially rehabilitated ───────────
  {
    externalId: 'trajectory:thalidomide-teratogenicity-1961',
    text: 'Thalidomide, widely prescribed in Europe from 1957 as a sedative and anti-nausea drug for pregnant women, causes severe limb malformations (phocomelia) in newborns when taken during the first trimester.',
    claimType: 'EMPIRICAL',
    claimEmergedAt: '1961-11-16',
    claimEmergedPrecision: 'MONTH',
    currentAxis: 'SETTLED',
    transitions: [
      {
        fromAxis: null,
        toAxis: 'RECORDED',
        community: 'EXPERT_LITERATURE',
        occurredAt: '1961-11-16',
        datePrecision: 'MONTH',
        reason: 'Widukind Lenz presents his findings at the German Pediatric Society meeting on November 16, 1961, identifying thalidomide as the cause of 52 malformation cases in Hamburg. Simultaneously Australian physician William McBride writes to The Lancet. Chemie Grünenthal withdraws the drug from the German market on November 26, 1961.',
        source: {
          externalId: 'src:mcbride-thalidomide-lancet-1961',
          name: 'McBride WG. Thalidomide and congenital abnormalities. Lancet. 1961;278(7216):1358.',
          url: 'https://www.thelancet.com/journals/lancet/article/PIIS0140-6736(61)90927-8/fulltext',
          publishedAt: '1961-12-16',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'RECORDED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1962-10-10',
        datePrecision: 'MONTH',
        reason: 'The Kefauver-Harris Amendment to the U.S. Federal Food, Drug and Cosmetic Act is signed on October 10, 1962, requiring proof of efficacy (not just safety) for drug approval. The law was directly prompted by the thalidomide crisis, though the FDA\'s Frances Kelsey had blocked U.S. approval. The amendment transforms global drug regulation.',
        source: {
          externalId: 'src:kefauver-harris-1962',
          name: 'Drug Amendments Act of 1962 (Kefauver-Harris Amendment). Pub. L. 87–781, 76 Stat. 780.',
          url: 'https://www.fda.gov/patients/drug-development-process/step-3-clinical-research',
          publishedAt: '1962-10-10',
          methodologyType: 'primary',
        },
      },
      {
        fromAxis: 'SETTLED',
        toAxis: 'SETTLED',
        community: 'INSTITUTIONAL',
        occurredAt: '1998-07-16',
        datePrecision: 'DAY',
        reason: 'FDA approves thalidomide (as Thalomid, Celgene) for erythema nodosum leprosum on July 16, 1998, and later for multiple myeloma (2006). The teratogenicity claim remains fully settled; the SETTLED→SETTLED transition reflects partial rehabilitation in a strictly controlled, non-pregnancy context — a new epistemic layer added to the same substance.',
        source: {
          externalId: 'src:fda-thalomid-approval-1998',
          name: 'FDA. NDA 20-785. Thalomid (thalidomide) approval letter. July 16, 1998.',
          url: 'https://www.accessdata.fda.gov/drugsatfda_docs/appletter/1998/20785ltr.pdf',
          publishedAt: '1998-07-16',
          methodologyType: 'primary',
        },
      },
    ],
  },

]

// ── Seeder (identical to history script) ────────────────────────────────────

async function upsertTrajectory(t: Trajectory) {
  const claim = await prisma.claim.upsert({
    where: { externalId: t.externalId },
    create: {
      externalId: t.externalId,
      text: t.text,
      claimType: t.claimType,
      claimEmergedAt: new Date(t.claimEmergedAt),
      claimEmergedPrecision: t.claimEmergedPrecision,
      currentAxis: t.currentAxis,
      epistemicAxis: t.currentAxis,
      deleted: false,
    },
    update: {
      text: t.text,
      claimType: t.claimType,
      claimEmergedAt: new Date(t.claimEmergedAt),
      claimEmergedPrecision: t.claimEmergedPrecision,
      currentAxis: t.currentAxis,
      epistemicAxis: t.currentAxis,
    },
  })

  for (let i = 0; i < t.transitions.length; i++) {
    const tr = t.transitions[i]

    const source = await prisma.source.upsert({
      where: { externalId: tr.source.externalId },
      create: {
        externalId: tr.source.externalId,
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
        methodologyType: tr.source.methodologyType,
      },
      update: {
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
      },
    })

    const histId = `csh:${t.externalId}:${i}`
    await prisma.claimStatusHistory.upsert({
      where: { id: histId },
      create: {
        id: histId,
        claimId: claim.id,
        fromAxis: tr.fromAxis ?? undefined,
        toAxis: tr.toAxis,
        community: tr.community,
        occurredAt: new Date(tr.occurredAt),
        datePrecision: tr.datePrecision,
        reason: tr.reason,
        sourceId: source.id,
      },
      update: {
        fromAxis: tr.fromAxis ?? undefined,
        toAxis: tr.toAxis,
        community: tr.community,
        occurredAt: new Date(tr.occurredAt),
        datePrecision: tr.datePrecision,
        reason: tr.reason,
        sourceId: source.id,
      },
    })

    const existingEdge = await prisma.edge.findFirst({ where: { claimId: claim.id, sourceId: source.id } })
    if (!existingEdge) {
      await prisma.edge.create({ data: { claimId: claim.id, sourceId: source.id, type: 'FOR' } })
    }
  }

  console.log(`  ✓ ${t.externalId} (${t.transitions.length} transitions)`)
}

async function main() {
  console.log(`Seeding ${TRAJECTORIES.length} medicine trajectories${DRY_RUN ? ' [DRY RUN]' : ''}...`)

  if (!DRY_RUN) {
    for (const t of TRAJECTORIES) {
      await upsertTrajectory(t)
    }
  } else {
    for (const t of TRAJECTORIES) {
      console.log(`  [dry] ${t.externalId} — ${t.transitions.length} transitions`)
    }
  }

  console.log(`\nDone. ${TRAJECTORIES.length} medicine trajectories seeded.`)
  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
