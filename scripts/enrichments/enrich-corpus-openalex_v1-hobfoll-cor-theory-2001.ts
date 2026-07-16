// Enrichment: post-publication trajectory for Hobfoll's 2001 Conservation of
// Resources (COR) theory paper.
//
// Claim: "The Influence of Culture, Community, and the Nested-Self in the Stress
// Process: Advancing Conservation of Resources Theory" — Applied Psychology: An
// International Review 2001;50(3):337–421.
// DOI: https://doi.org/10.1111/1464-0597.00062  ·  OpenAlex: W2048385562
//
// Baseline ClaimStatusHistory (fromAxis=null -> RECORDED at 2001-07-01) already
// exists — do NOT duplicate it. No retraction or expression of concern exists
// (confirmed via Crossref: no update-to notice). This script adds the verified
// two-step scholarly arc around the theory's central "resources" construct:
//
//   RECORDED -> CONTESTED (2014-03-25, EXPERT_LITERATURE)
//     Halbesleben, Neveu, Paustian-Underdahl & Westman, "Getting to the 'COR':
//     Understanding the Role of Resources in Conservation of Resources Theory,"
//     Journal of Management 2014;40(5):1334–1364. This heavily cited (2,800+)
//     review makes the theory's core construct the object of a sustained
//     methodological critique: it documents that "resource" had been defined and
//     operationalised inconsistently across the COR literature, weakening tests
//     of the theory, and proposes an integrated definition to repair it.
//
//   CONTESTED -> SETTLED (2018-01-21, EXPERT_LITERATURE)
//     Hobfoll, Halbesleben, Neveu & Westman, "Conservation of Resources in the
//     Organizational Context: The Reality of Resources and Their Consequences,"
//     Annual Review of Organizational Psychology and Organizational Behavior
//     2018;5:103–128. Written for the field's canonical review venue and
//     co-authored by the very scholar who raised the 2014 critique, it
//     consolidates COR theory, pins down the resource construct, and affirms its
//     standing as a leading, empirically-supported stress framework — resolving
//     the definitional contest rather than overturning the theory.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-hobfoll-cor-theory-2001.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmpm2894y0ladsadngz1zl5az'

async function main() {
  // ── Source 1: Halbesleben et al. 2014 (the methodological critique) ──
  await prisma.source.upsert({
    where: { externalId: 'src:halbesleben-2014-getting-to-the-cor' },
    create: {
      externalId: 'src:halbesleben-2014-getting-to-the-cor',
      name: "Halbesleben JRB, Neveu J-P, Paustian-Underdahl SC, Westman M. Getting to the \u201cCOR\u201d: Understanding the Role of Resources in Conservation of Resources Theory. Journal of Management 2014;40(5):1334\u20131364.",
      url: 'https://doi.org/10.1177/0149206314527130',
      publishedAt: new Date('2014-03-25'),
      methodologyType: 'derivative',
    },
    update: {
      name: "Halbesleben JRB, Neveu J-P, Paustian-Underdahl SC, Westman M. Getting to the \u201cCOR\u201d: Understanding the Role of Resources in Conservation of Resources Theory. Journal of Management 2014;40(5):1334\u20131364.",
      url: 'https://doi.org/10.1177/0149206314527130',
      publishedAt: new Date('2014-03-25'),
      methodologyType: 'derivative',
    },
  })

  // ── Source 2: Hobfoll et al. 2018 Annual Review (the consolidation) ──
  await prisma.source.upsert({
    where: { externalId: 'src:hobfoll-2018-cor-annual-review' },
    create: {
      externalId: 'src:hobfoll-2018-cor-annual-review',
      name: 'Hobfoll SE, Halbesleben J, Neveu J-P, Westman M. Conservation of Resources in the Organizational Context: The Reality of Resources and Their Consequences. Annual Review of Organizational Psychology and Organizational Behavior 2018;5:103\u2013128.',
      url: 'https://doi.org/10.1146/annurev-orgpsych-032117-104640',
      publishedAt: new Date('2018-01-21'),
      methodologyType: 'derivative',
    },
    update: {
      name: 'Hobfoll SE, Halbesleben J, Neveu J-P, Westman M. Conservation of Resources in the Organizational Context: The Reality of Resources and Their Consequences. Annual Review of Organizational Psychology and Organizational Behavior 2018;5:103\u2013128.',
      url: 'https://doi.org/10.1146/annurev-orgpsych-032117-104640',
      publishedAt: new Date('2018-01-21'),
      methodologyType: 'derivative',
    },
  })

  // ── Transition 1: RECORDED -> CONTESTED ──
  {
    const occurredAt = new Date('2014-03-25')
    const toAxis = 'CONTESTED'
    const slug = `${CLAIM_ID}-${toAxis}-${occurredAt.toISOString().slice(0, 10)}`
    const reason =
      "Halbesleben, Neveu, Paustian-Underdahl and Westman's widely cited 2014 review in the Journal of Management put COR theory's central construct under sustained methodological critique. It documented that \u201cresource\u201d had been defined and operationalised inconsistently across the literature \u2014 undermining clean tests of the loss-spiral and resource-gain claims \u2014 and proposed an integrated definition to remedy the ambiguity. The theory's core mechanism was thus openly contested on definitional grounds."

    await prisma.claimStatusHistory.upsert({
      where: { id: slug },
      create: {
        id: slug,
        claimId: CLAIM_ID,
        fromAxis: 'RECORDED',
        toAxis,
        community: 'EXPERT_LITERATURE',
        occurredAt,
        datePrecision: 'DAY',
        reason,
        sourceExternalId: 'src:halbesleben-2014-getting-to-the-cor',
      },
      update: {
        fromAxis: 'RECORDED',
        toAxis,
        community: 'EXPERT_LITERATURE',
        occurredAt,
        datePrecision: 'DAY',
        reason,
        sourceExternalId: 'src:halbesleben-2014-getting-to-the-cor',
      },
    })
    console.log(`Upserted trajectory transition: ${slug}`)
  }

  // ── Transition 2: CONTESTED -> SETTLED ──
  {
    const occurredAt = new Date('2018-01-21')
    const toAxis = 'SETTLED'
    const slug = `${CLAIM_ID}-${toAxis}-${occurredAt.toISOString().slice(0, 10)}`
    const reason =
      'The 2018 Annual Review of Organizational Psychology and Organizational Behavior article \u2014 written for the field\u2019s canonical review venue and co-authored by Hobfoll together with Halbesleben, who had raised the 2014 definitional critique \u2014 consolidated COR theory, pinned down the reality and typology of resources, and reaffirmed the loss-primacy and resource-investment principles as an empirically supported framework. The definitional contest was resolved through clarification rather than overturning, settling COR\u2019s standing in the organizational-stress literature.'

    await prisma.claimStatusHistory.upsert({
      where: { id: slug },
      create: {
        id: slug,
        claimId: CLAIM_ID,
        fromAxis: 'CONTESTED',
        toAxis,
        community: 'EXPERT_LITERATURE',
        occurredAt,
        datePrecision: 'DAY',
        reason,
        sourceExternalId: 'src:hobfoll-2018-cor-annual-review',
      },
      update: {
        fromAxis: 'CONTESTED',
        toAxis,
        community: 'EXPERT_LITERATURE',
        occurredAt,
        datePrecision: 'DAY',
        reason,
        sourceExternalId: 'src:hobfoll-2018-cor-annual-review',
      },
    })
    console.log(`Upserted trajectory transition: ${slug}`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
