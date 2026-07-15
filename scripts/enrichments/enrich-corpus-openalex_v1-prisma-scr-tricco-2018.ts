// Epistemic-receipt enrichment for the PRISMA-ScR paper (corpus: openalex_v1).
//
// Claim: Tricco AC, Lillie E, Zarin W, et al. "PRISMA Extension for Scoping
// Reviews (PRISMA-ScR): Checklist and Explanation." Ann Intern Med.
// 2018;169(7):467–473.
// DOI: 10.7326/M18-0850 · OpenAlex: W2891378911 · PMID: 30178033
// Claim id: cmpma3yx847rgsaer60e1jj8z
//
// Baseline row (null -> RECORDED @ 2018-09-03) already exists; do NOT duplicate.
//
// Post-publication event added here:
//   RECORDED -> SETTLED (2020-10, INSTITUTIONAL)
//     Peters MDJ, Marnie C, Tricco AC, et al. "Updated methodological guidance
//     for the conduct of scoping reviews" (JBI Evid Synth. 2020;18(10):2119-2126,
//     DOI 10.11124/JBIES-20-00167, PMID 33038124). JBI — the dominant scoping-
//     review methodology body, whose Arksey/O'Malley-descended lineage was the
//     alternative reporting standard — formally adopted PRISMA-ScR as THE
//     reporting standard for scoping reviews. The paper's stated objective is
//     the updated JBI approach "with a focus on ... the PRISMA-ScR," and it is
//     co-authored by Tricco (the PRISMA-ScR lead). This is a dated, citable
//     institutional consensus convergence, moving the checklist from RECORDED
//     to SETTLED. (No retraction, expression of concern, or methodological
//     reversal exists; the checklist is EQUATOR-listed and field-standard.)
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
// Run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-prisma-scr-tricco-2018.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmpma3yx847rgsaer60e1jj8z'

async function main() {
  // ── RECORDED -> SETTLED : JBI 2020 adopts PRISMA-ScR as reporting standard ──
  const occurredAt = new Date('2020-10-01')
  const toAxis = 'SETTLED'
  const slug = `${CLAIM_ID}-${toAxis}-${occurredAt.toISOString().slice(0, 10)}`

  const externalId = 'src:peters-jbi-scoping-guidance-2020'
  const name =
    'Peters MDJ, Marnie C, Tricco AC, Pollock D, Munn Z, Alexander L, McInerney P, Godfrey CM, Khalil H. Updated methodological guidance for the conduct of scoping reviews. JBI Evidence Synthesis. 2020;18(10):2119–2126.'
  const url = 'https://pubmed.ncbi.nlm.nih.gov/33038124/'
  const publishedAt = new Date('2020-10-01')

  await prisma.source.upsert({
    where: { externalId },
    create: {
      externalId,
      name,
      url,
      publishedAt,
      methodologyType: 'derivative',
    },
    update: {
      name,
      url,
      publishedAt,
      methodologyType: 'derivative',
    },
  })

  const source = await prisma.source.findUnique({ where: { externalId } })

  const reason =
    'The updated JBI methodological guidance (Peters et al., JBI Evid Synth 2020;18(10):2119–2126, DOI 10.11124/JBIES-20-00167) — issued by the Joanna Briggs Institute, the dominant methodology body for scoping reviews and author of the alternative Arksey/O\'Malley-descended conduct guidance — formally adopts the PRISMA-ScR as the standard for reporting scoping reviews; its stated objective centres on "the development of the ... PRISMA-ScR," and it is co-authored by Tricco, the PRISMA-ScR lead. This dated institutional convergence establishes PRISMA-ScR as the field-standard reporting checklist, moving it from RECORDED to SETTLED.'

  await prisma.claimStatusHistory.upsert({
    where: { id: slug },
    create: {
      id: slug,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'INSTITUTIONAL',
      occurredAt,
      datePrecision: 'MONTH',
      reason,
      sourceId: source?.id ?? null,
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'INSTITUTIONAL',
      occurredAt,
      datePrecision: 'MONTH',
      reason,
      sourceId: source?.id ?? null,
    },
  })

  console.log(`Upserted transition ${slug} (RECORDED -> SETTLED)`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
