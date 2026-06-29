// Enrich existing settling curves with a documented, missing intermediate
// transition (v3).
//
// Each of these curated trajectories was seeded as a clean two-step arc
// (∅→RECORDED→SETTLED) that elides a well-documented intermediate epistemic
// step: an independent replication, a mechanistic confirmation, a decisive
// material/technical fix, or a state escalation that carried the claim toward
// its settled outcome. Each new transition below is a RECORDED→RECORDED insert
// (the cleanest, lowest-risk kind — it neither reinterprets the downstream
// origin nor competes with the settlement) and traces to a single canonical
// source verified against a fetchable URL before insertion (per AGENTS.md: "the
// curated list itself becomes the verification surface"). Every fact and date
// here was checked against its source via web research on 2026-06-29.
//
// Verification log (queried 2026-06-29):
//   - HeLa first publication: Gey/Coffman/Kubicek, Cancer Research 1952;12:264-265
//       (Embryo Project Encyclopedia, embryo.asu.edu/pages/hela-cell-line).
//   - Lithium first RCT: Schou et al., J Neurol Neurosurg Psychiatry 1954;17:250-260
//       (PubMed Central PMC503195) — first controlled trial confirming Cade.
//   - Charnley HDPE switch: first implanted November 1962 after PTFE failure
//       (en.wikipedia.org/wiki/John_Charnley).
//   - Allied fleets enter Black Sea: 3 January 1854 (en.wikipedia.org/wiki/Crimean_War,
//       cited to Britannica) — escalation between Sinop and the declaration of war.
//   - Intrinsic factor: Castle, Am J Med Sci 1929;178:748-764
//       (en.wikipedia.org/wiki/William_Bosworth_Castle) — mechanistic confirmation
//       between the Minot-Murphy liver diet (1926) and the 1934 Nobel Prize.
//
// Reuses the chain-repair logic of v1/v2: where a new transition reinterprets the
// origin of the downstream transition, the downstream row's fromAxis is moved to
// the new toAxis so the arc reads as a connected chain. All v3 inserts are
// RECORDED→RECORDED so the repair is always a no-op (kept for symmetry).
//
// Idempotent: upserts the Source by externalId and the new ClaimStatusHistory
// row by a deterministic id.
//
// Run:     npx tsx scripts/enrich-trajectory-intermediates-v3.ts
// Dry-run: npx tsx scripts/enrich-trajectory-intermediates-v3.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

type FactStatus = 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'OPEN' | 'UNRESOLVABLE' | 'REVERSED' | 'ABANDONED'
type RatifyingCommunity = 'EXPERT_LITERATURE' | 'INSTITUTIONAL' | 'JUDICIAL' | 'PUBLIC' | 'MARKET'
type DatePrecision = 'DAY' | 'MONTH' | 'QUARTER' | 'YEAR'

interface Enrichment {
  claimId: string
  slug: string
  fromAxis: FactStatus
  toAxis: FactStatus
  occurredAt: string
  datePrecision: DatePrecision
  community: RatifyingCommunity
  reason: string
  source: { externalId: string; name: string; url: string; publishedAt: string; methodologyType: string }
}

const ENRICHMENTS: Enrichment[] = [
  // ── HeLa: first publication of the immortal line (replication/establishment) ──
  {
    claimId: 'cmqy4foul03w2sahkndgbldyx',
    slug: 'hela-immortal-cell-line-1951',
    fromAxis: 'RECORDED',
    toAxis: 'RECORDED',
    occurredAt: '1952-01-01',
    datePrecision: 'YEAR',
    community: 'EXPERT_LITERATURE',
    reason:
      'Gey, Coffman and Kubicek publish the first account of the line in the peer-reviewed literature — a short abstract in Cancer Research reporting that cells from a cervical carcinoma proliferated continuously in roller-tube culture where normal epithelium did not. This first publication moves the immortal line from a single unannounced laboratory observation (Feb 1951) into the shared scientific record, a year before the Scherer–Syverton–Gey poliovirus study cements HeLa as a standard research substrate.',
    source: {
      externalId: 'src:gey-coffman-kubicek-hela-1952',
      name: 'Gey GO, Coffman WD, Kubicek MT. Tissue culture studies of the proliferative capacity of cervical carcinoma and normal epithelium. Cancer Research. 1952;12:264–265.',
      url: 'https://embryo.asu.edu/pages/hela-cell-line',
      publishedAt: '1952-01-01',
      methodologyType: 'primary',
    },
  },

  // ── Lithium for mania: Cade's finding replicated by the first psychiatric RCT ──
  {
    claimId: 'cmqjrqkmc00masazrqmzq423i',
    slug: 'cade-lithium-mania-1949',
    fromAxis: 'RECORDED',
    toAxis: 'RECORDED',
    occurredAt: '1954-11-01',
    datePrecision: 'MONTH',
    community: 'EXPERT_LITERATURE',
    reason:
      'Schou, Juel-Nielsen, Strömgren and Voldby publish the first controlled trial of lithium in mania — widely regarded as the first randomized controlled trial in psychiatry — confirming Cade\'s 1949 open observation under blinded, placebo-controlled conditions. The independent replication by an established Danish academic group converts a single-clinician case series into a corroborated treatment effect, the decisive step toward the eventual 1970 FDA approval.',
    source: {
      externalId: 'src:schou-lithium-mania-1954',
      name: 'Schou M, Juel-Nielsen N, Strömgren E, Voldby H. The treatment of manic psychoses by the administration of lithium salts. Journal of Neurology, Neurosurgery & Psychiatry. 1954;17(4):250–260.',
      url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC503195/',
      publishedAt: '1954-11-01',
      methodologyType: 'primary',
    },
  },

  // ── Charnley low-friction hip: the HDPE socket that made the implant durable ──
  {
    claimId: 'cmqjetoam009isaznnpvaswl6',
    slug: 'charnley-low-friction-hip-1961',
    fromAxis: 'RECORDED',
    toAxis: 'RECORDED',
    occurredAt: '1962-11-01',
    datePrecision: 'MONTH',
    community: 'EXPERT_LITERATURE',
    reason:
      'Charnley implants a high-molecular-weight polyethylene (HMWPE) acetabular socket for the first time, replacing the polytetrafluoroethylene (PTFE/Teflon) socket whose rapid wear and tissue reaction had caused his earliest low-friction implants to fail. The material change — adopted after his technician Harry Craven tested the polymer against Charnley\'s initial objection — is the technical correction that made the low-friction arthroplasty durable enough to become the standard prosthesis, bridging the 1961 concept and its long-term validation.',
    source: {
      externalId: 'src:charnley-hdpe-socket-1962',
      name: 'First implantation of a high-molecular-weight polyethylene acetabular socket by John Charnley, November 1962 (documented in J. Charnley, Low Friction Arthroplasty of the Hip, Springer-Verlag, 1979).',
      url: 'https://en.wikipedia.org/wiki/John_Charnley',
      publishedAt: '1962-11-01',
      methodologyType: 'secondary',
    },
  },

  // ── Battle of Sinop: allied fleets enter the Black Sea (state escalation) ──
  {
    claimId: 'cmqlka5rh04avsak3moedpwgw',
    slug: 'battle-of-sinop-1853',
    fromAxis: 'RECORDED',
    toAxis: 'RECORDED',
    occurredAt: '1854-01-03',
    datePrecision: 'DAY',
    community: 'INSTITUTIONAL',
    reason:
      'The British and French fleets enter the Black Sea to protect Ottoman shipping and confine the Russian navy to Sevastopol — the first direct Anglo-French naval commitment against Russia, taken in response to the destruction at Sinop. This escalation converts the battle from a one-off naval defeat into the operative casus belli, three months before the formal declarations of war on 27–28 March 1854.',
    source: {
      externalId: 'src:allied-fleets-black-sea-1854',
      name: 'Entry of the British and French fleets into the Black Sea, 3 January 1854, following the Battle of Sinop (Crimean War, citing Encyclopædia Britannica).',
      url: 'https://en.wikipedia.org/wiki/Crimean_War',
      publishedAt: '1854-01-03',
      methodologyType: 'secondary',
    },
  },

  // ── Pernicious anaemia: Castle identifies the gastric "intrinsic factor" ──
  {
    claimId: 'cmqjeilos008ssaxye8f2ugzy',
    slug: 'minot-murphy-liver-pernicious-anemia-1926',
    fromAxis: 'RECORDED',
    toAxis: 'RECORDED',
    occurredAt: '1929-01-01',
    datePrecision: 'YEAR',
    community: 'EXPERT_LITERATURE',
    reason:
      'William B. Castle demonstrates that beef muscle becomes effective against pernicious anaemia only after incubation with normal human gastric juice, establishing that the stomach secretes an essential "intrinsic factor" that the diseased gastric mucosa of pernicious-anaemia patients lacks. The result supplies the mechanism behind the Minot–Murphy liver diet — explaining why dietary liver works and why the patients are deficient — and converts an empirical dietary cure into an understood physiological deficiency, five years before the 1934 Nobel Prize.',
    source: {
      externalId: 'src:castle-intrinsic-factor-1929',
      name: 'Castle WB. Observations on the etiologic relationship of achylia gastrica to pernicious anemia. American Journal of the Medical Sciences. 1929;178:748–764.',
      url: 'https://en.wikipedia.org/wiki/William_Bosworth_Castle',
      publishedAt: '1929-01-01',
      methodologyType: 'primary',
    },
  },
]

async function main() {
  let enriched = 0
  const details: string[] = []

  for (const e of ENRICHMENTS) {
    const claim = await prisma.claim.findUnique({ where: { id: e.claimId } })
    if (!claim) {
      console.warn(`SKIP ${e.slug}: claim ${e.claimId} not found`)
      continue
    }

    const history = await prisma.claimStatusHistory.findMany({
      where: { claimId: e.claimId },
      orderBy: { occurredAt: 'asc' },
    })

    const downstream = history.find(
      (h) => h.fromAxis === e.fromAxis && new Date(h.occurredAt) > new Date(e.occurredAt),
    )

    const cshId = `csh:trajectory:${e.slug}:mid-${e.occurredAt.slice(0, 4)}`

    console.log(`\n${e.slug}`)
    console.log(`  + ${e.fromAxis}→${e.toAxis} @${e.occurredAt}  (${e.source.name})`)
    if (downstream && downstream.fromAxis !== e.toAxis) {
      console.log(`  ~ downstream ${downstream.id}: fromAxis ${downstream.fromAxis}→${e.toAxis}`)
    } else {
      console.log(`  (no downstream repair needed)`)
    }

    if (DRY_RUN) {
      details.push(`${e.claimId}: added ${e.fromAxis}→${e.toAxis} transition (${e.slug})`)
      enriched++
      continue
    }

    await prisma.$transaction(async (tx) => {
      const source = await tx.source.upsert({
        where: { externalId: e.source.externalId },
        update: {},
        create: {
          externalId: e.source.externalId,
          name: e.source.name,
          url: e.source.url,
          publishedAt: new Date(e.source.publishedAt),
          methodologyType: e.source.methodologyType,
          ingestedBy: 'enrich:trajectory-intermediates-v3',
          humanReviewed: false,
          autoApproved: true,
        },
      })

      await tx.claimStatusHistory.upsert({
        where: { id: cshId },
        update: {},
        create: {
          id: cshId,
          claimId: e.claimId,
          fromAxis: e.fromAxis,
          toAxis: e.toAxis,
          community: e.community,
          occurredAt: new Date(e.occurredAt),
          datePrecision: e.datePrecision,
          reason: e.reason,
          sourceId: source.id,
        },
      })

      if (downstream && downstream.fromAxis !== e.toAxis) {
        await tx.claimStatusHistory.update({
          where: { id: downstream.id },
          data: { fromAxis: e.toAxis },
        })
      }
    })

    details.push(`${e.claimId}: added ${e.fromAxis}→${e.toAxis} transition (${e.slug})`)
    enriched++
  }

  console.log(`\nENRICHED:${enriched}`)
  console.log(`DETAILS:${details.join(' | ')}`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
