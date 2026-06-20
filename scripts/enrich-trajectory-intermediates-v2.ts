// Enrich existing settling curves with a documented, missing intermediate
// transition (v2).
//
// Each of these curated trajectories was seeded as a clean two-step arc that
// elides a well-documented intermediate epistemic step — an independent
// replication, a same-doctrine reaffirmation, a formal naming/case-definition,
// an empirical challenge to a standing consensus, or a multilateral expansion.
// Each new transition below traces to a single canonical source verified
// against its publisher/court-reporter/government URL (per AGENTS.md: "the
// curated list itself becomes the verification surface"). Every fact and date
// here was checked against its source before insertion.
//
// The script reuses the chain-repair logic of v1: where the new transition
// reinterprets the origin of the downstream transition (e.g. inserting a
// CONTESTED phase before a REVERSED), the downstream row's fromAxis is moved to
// the new toAxis so the arc reads as a connected chain. Where the new
// transition shares the downstream origin (a RECORDED→RECORDED replication or a
// SETTLED→SETTLED reaffirmation) no repair is needed.
//
// Idempotent: upserts the Source by externalId and the new ClaimStatusHistory
// row by a deterministic id; the downstream fromAxis update is a no-op on
// reruns.
//
// Run:     npx tsx scripts/enrich-trajectory-intermediates-v2.ts
// Dry-run: npx tsx scripts/enrich-trajectory-intermediates-v2.ts --dry-run

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
  source: { externalId: string; name: string; url: string; publishedAt: string }
}

const ENRICHMENTS: Enrichment[] = [
  // ── Accelerating expansion: High-z finding replicated by the SCP team ──
  {
    claimId: 'cmqj8blmq001usaij1ll6kz0p',
    slug: 'accelerating-expansion-dark-energy-1998',
    fromAxis: 'RECORDED',
    toAxis: 'RECORDED',
    occurredAt: '1999-06-01',
    datePrecision: 'DAY',
    community: 'EXPERT_LITERATURE',
    reason:
      'The Supernova Cosmology Project (Perlmutter et al.) independently confirms the High-z team\'s result, reporting from 42 high-redshift Type Ia supernovae a low matter density and a positive cosmological constant (Ω_Λ≈0.7) — direct evidence that cosmic expansion is accelerating. Two independent teams reaching the same conclusion within a year converts a single-team finding into a replicated result, the decisive step toward consensus before the 2011 Nobel Prize.',
    source: {
      externalId: 'src:perlmutter-scp-1999',
      name: 'Perlmutter S, et al. (Supernova Cosmology Project). Measurements of Ω and Λ from 42 High-Redshift Supernovae. The Astrophysical Journal. 1999;517(2):565–586.',
      url: 'https://doi.org/10.1086/307221',
      publishedAt: '1999-06-01',
    },
  },

  // ── Adkins → West Coast Hotel: liberty-of-contract reaffirmed by Morehead ──
  {
    claimId: 'cmq7jlp2x0003sa7eba34v4kc',
    slug: 'adkins-west-coast-hotel',
    fromAxis: 'SETTLED',
    toAxis: 'SETTLED',
    occurredAt: '1936-06-01',
    datePrecision: 'DAY',
    community: 'JUDICIAL',
    reason:
      'Morehead v. New York ex rel. Tipaldo reaffirms Adkins by a 5–4 vote, striking down New York\'s minimum-wage law for women on the same liberty-of-contract grounds. The narrow margin and four-Justice dissent — decided amid the Great Depression and intense political pressure — mark the doctrine as embattled even as it is upheld, ten months before West Coast Hotel overrules it.',
    source: {
      externalId: 'src:morehead-v-tipaldo-1936',
      name: 'Morehead v. New York ex rel. Tipaldo, 298 U.S. 587 (1936).',
      url: 'https://supreme.justia.com/cases/federal/us/298/587/',
      publishedAt: '1936-06-01',
    },
  },

  // ── AIDS: syndrome formally named and case-defined by the CDC ──
  {
    claimId: 'cmqimthgm02j8saexjehdtgda',
    slug: 'aids-first-mmwr-report-1981',
    fromAxis: 'RECORDED',
    toAxis: 'RECORDED',
    occurredAt: '1982-09-24',
    datePrecision: 'DAY',
    community: 'INSTITUTIONAL',
    reason:
      'The CDC\'s MMWR of 24 September 1982 uses the term "acquired immune deficiency syndrome (AIDS)" for the first time and publishes the first national surveillance case definition, formally establishing the syndrome as a recognized, reportable clinical entity — nearly a year before its viral cause is identified.',
    source: {
      externalId: 'src:cdc-mmwr-aids-case-definition-1982',
      name: 'CDC. Update on Acquired Immune Deficiency Syndrome (AIDS) — United States. MMWR. 1982;31(37):507–508,513–514.',
      url: 'https://www.cdc.gov/mmwr/preview/mmwrhtml/00001163.htm',
      publishedAt: '1982-09-24',
    },
  },

  // ── Homosexuality in the DSM: pathology assumption contested by Hooker (×2 claims) ──
  {
    claimId: 'cmqlr21pj0270sap2auttawgd',
    slug: 'homosexuality-removed-dsm-1973',
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    occurredAt: '1957-01-01',
    datePrecision: 'YEAR',
    community: 'EXPERT_LITERATURE',
    reason:
      'Evelyn Hooker publishes "The Adjustment of the Male Overt Homosexual" in the Journal of Projective Techniques — the first empirical study to test the pathology assumption. Blind expert raters could not distinguish the psychological adjustment of 30 homosexual men from 30 matched heterosexual men. The finding directly contests the DSM-I classification of homosexuality as a mental disorder and becomes the most-cited evidence behind its 1973 removal.',
    source: {
      externalId: 'src:hooker-male-overt-homosexual-1957',
      name: 'Hooker E. The Adjustment of the Male Overt Homosexual. Journal of Projective Techniques. 1957;21(1):18–31.',
      url: 'https://www.tandfonline.com/doi/abs/10.1080/08853126.1957.10380742',
      publishedAt: '1957-01-01',
    },
  },
  {
    claimId: 'cmqjrqkwr00mosazrx71gb4fh',
    slug: 'apa-homosexuality-removed-dsm-1973',
    fromAxis: 'SETTLED',
    toAxis: 'CONTESTED',
    occurredAt: '1957-01-01',
    datePrecision: 'YEAR',
    community: 'EXPERT_LITERATURE',
    reason:
      'Evelyn Hooker publishes "The Adjustment of the Male Overt Homosexual" in the Journal of Projective Techniques — the first empirical study to test the pathology assumption. Blind expert raters could not distinguish the psychological adjustment of 30 homosexual men from 30 matched heterosexual men. The finding directly contests the DSM-I/DSM-II classification of homosexuality as a mental disorder and becomes the most-cited evidence behind its 1973 removal.',
    source: {
      externalId: 'src:hooker-male-overt-homosexual-1957',
      name: 'Hooker E. The Adjustment of the Male Overt Homosexual. Journal of Projective Techniques. 1957;21(1):18–31.',
      url: 'https://www.tandfonline.com/doi/abs/10.1080/08853126.1957.10380742',
      publishedAt: '1957-01-01',
    },
  },

  // ── Abraham Accords: framework expanded to Bahrain before the signing ──
  {
    claimId: 'cmqm3v7l00568salxciiht1x1',
    slug: 'abraham-accords-signed-2020',
    fromAxis: 'RECORDED',
    toAxis: 'RECORDED',
    occurredAt: '2020-09-11',
    datePrecision: 'DAY',
    community: 'PUBLIC',
    reason:
      'A joint statement by the United States, the Kingdom of Bahrain and the State of Israel announces that Bahrain and Israel will establish full diplomatic relations, extending the normalization framework beyond the UAE. The Bahrain agreement broadens the Accords from a bilateral to a multilateral arrangement four days before the trilateral White House signing ceremony.',
    source: {
      externalId: 'src:us-bahrain-israel-joint-statement-2020',
      name: 'Joint Statement of the United States, the Kingdom of Bahrain, and the State of Israel (11 September 2020). Public Papers of the Presidents, DCPD-202000685.',
      url: 'https://www.govinfo.gov/content/pkg/DCPD-202000685/pdf/DCPD-202000685.pdf',
      publishedAt: '2020-09-11',
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

    // The downstream transition whose origin we are reinterpreting: it currently
    // leaves `fromAxis` at a later date and must now leave `toAxis` so the chain
    // reads fromAxis → toAxis → (downstream). For a same-origin insert
    // (RECORDED→RECORDED, SETTLED→SETTLED) toAxis === fromAxis and the repair is
    // a no-op.
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
          methodologyType: 'primary',
          ingestedBy: 'enrich:trajectory-intermediates-v2',
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
