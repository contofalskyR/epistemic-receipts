import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Claim: retraction notice for Chan, Lo & Wong (2024), "Leveraging generative AI
// for enhancing university-level English writing," Cogent Education 12(1),
// https://doi.org/10.1080/2331186X.2024.2440182
//
// Epistemic trajectory:
//   OPEN -> RECORDED  (existing first entry — article published; NOT re-added here)
//   RECORDED -> REVERSED (retracted by editors & publisher for substantial overlap /
//                         redundant duplicate publication with the same authors' prior article)
//
// Only the REVERSED arc is added. The retraction is attested by the retraction
// notice itself (the source of this claim) and resolves at the article DOI.

const claimId = '45b4d965-08a9-46c0-92f7-d854c712fd58'

interface Transition {
  fromAxis: string | null
  toAxis: string
  community: 'EXPERT_LITERATURE' | 'INSTITUTIONAL' | 'JUDICIAL' | 'PUBLIC' | 'MARKET'
  occurredAt: string
  datePrecision: 'DAY' | 'MONTH' | 'QUARTER' | 'YEAR'
  reason: string
  source: {
    externalId: string
    name: string
    url: string
    publishedAt: string
    methodologyType: 'primary' | 'derivative' | 'opinion'
  }
}

const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'REVERSED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2024-12-20',
    datePrecision: 'MONTH',
    reason:
      'The Editors and Publisher of Cogent Education retracted Chan, Lo & Wong (2024), "Leveraging generative AI for enhancing university-level English writing: comparative insights on automated feedback and student engagement" (Cogent Education 12(1), https://doi.org/10.1080/2331186X.2024.2440182), after determining that the article had substantial overlap with a prior article by the same authors — a redundant/duplicate publication. The retraction removes the article from the accepted scholarly record, reversing its recorded standing.',
    source: {
      externalId: 'src:cogent-genai-writing-retraction-2024',
      name: 'Retraction: Chan S, Lo N, Wong A. Leveraging generative AI for enhancing university-level English writing (Cogent Education, 2024) — retracted by the Editors and Publisher for substantial overlap with a prior article by the same authors.',
      url: 'https://doi.org/10.1080/2331186X.2024.2440182',
      publishedAt: '2024-12-20',
      methodologyType: 'primary',
    },
  },
]

async function main() {
  for (const tr of TRANSITIONS) {
    const source = await prisma.source.upsert({
      where: { externalId: tr.source.externalId },
      create: {
        externalId: tr.source.externalId,
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
        methodologyType: tr.source.methodologyType,
        ingestedBy: 'enrich:corpus-openalex_v1',
      },
      update: {
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
      },
    })

    const slug = `${claimId}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`
    await prisma.claimStatusHistory.upsert({
      where: { id: slug },
      create: {
        id: slug,
        claimId,
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

    console.log(`Upserted transition ${tr.fromAxis ?? 'null'} -> ${tr.toAxis} (${slug})`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
