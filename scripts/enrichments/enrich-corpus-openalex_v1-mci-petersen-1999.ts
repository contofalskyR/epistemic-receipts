// Enrichment: post-publication epistemic trajectory for
// Petersen RC, et al. "Mild Cognitive Impairment: Clinical Characterization
// and Outcome." Archives of Neurology 1999;56(3):303–308.
// DOI 10.1001/archneur.56.3.303 · OpenAlex W2159122349
//
// Baseline RECORDED (1999-03-01) already exists as the claim's first
// ClaimStatusHistory row and is NOT duplicated here.
//
// Post-publication event: the MCI construct introduced in this single-clinic
// cohort was adopted into formal clinical practice by the American Academy of
// Neurology's evidence-based Practice Parameter (Petersen RC, Stevens JC,
// Ganguli M, et al. Neurology 2001;56(9):1133–1142, DOI 10.1212/WNL.56.9.1133),
// which recommended that clinicians identify and monitor patients with MCI.
// This constitutes an INSTITUTIONAL RECORDED->SETTLED adjudication. The
// construct was subsequently reinforced by the International Working Group
// consensus (Winblad et al., J Intern Med 2004, DOI 10.1111/j.1365-2796.2004.01380.x)
// and embedded in NIA-AA diagnostic criteria for MCI due to Alzheimer's disease
// (Albert et al., Alzheimer's & Dementia 2011, DOI 10.1016/j.jalz.2011.03.008).
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-mci-petersen-1999.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-mci-petersen-1999.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmplxkno8000psa7fem9nt1ix'

async function main() {
  // ── RECORDED -> SETTLED : AAN evidence-based Practice Parameter (2001) ──
  const occurredAt = '2001-05-08'
  const toAxis = 'SETTLED'
  const slug = `${CLAIM_ID}-${toAxis}-${occurredAt}` // cmplxkno8000psa7fem9nt1ix-SETTLED-2001-05-08

  const sourceDef = {
    externalId: 'src:mci-aan-practice-parameter-2001',
    name: 'Petersen RC, Stevens JC, Ganguli M, Tangalos EG, Cummings JL, DeKosky ST. Practice parameter: Early detection of dementia: Mild cognitive impairment (an evidence-based review). Report of the Quality Standards Subcommittee of the American Academy of Neurology. Neurology 2001;56(9):1133–1142.',
    url: 'https://doi.org/10.1212/wnl.56.9.1133',
    publishedAt: '2001-05-08',
    methodologyType: 'derivative' as const,
  }

  const reason =
    'Two years after Petersen et al. characterized MCI in a single general-community cohort, the American Academy of Neurology issued an evidence-based Practice Parameter that reviewed the literature and formally recommended clinicians identify and monitor patients with MCI, converting a single-clinic empirical finding into an institutionally endorsed clinical entity. This RECORDED→SETTLED adjudication by a professional-body guideline (INSTITUTIONAL) was subsequently reinforced by the 2004 International Working Group consensus (Winblad et al., J Intern Med) and the 2011 NIA-AA diagnostic criteria for MCI due to Alzheimer disease (Albert et al., Alzheimer\'s & Dementia).'

  if (DRY_RUN) {
    console.log('[dry-run] would upsert source:', sourceDef.externalId)
    console.log('[dry-run] would upsert claimStatusHistory:', slug, `${'(RECORDED->' + toAxis + ' @ ' + occurredAt + ')'}`)
    await prisma.$disconnect()
    return
  }

  const source = await prisma.source.upsert({
    where: { externalId: sourceDef.externalId },
    create: {
      externalId: sourceDef.externalId,
      name: sourceDef.name,
      url: sourceDef.url,
      publishedAt: new Date(sourceDef.publishedAt),
      methodologyType: sourceDef.methodologyType,
      ingestedBy: 'enrich:corpus-openalex_v1',
    },
    update: {
      name: sourceDef.name,
      url: sourceDef.url,
      publishedAt: new Date(sourceDef.publishedAt),
    },
  })

  await prisma.claimStatusHistory.upsert({
    where: { id: slug },
    create: {
      id: slug,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis,
      community: 'INSTITUTIONAL',
      occurredAt: new Date(occurredAt),
      datePrecision: 'DAY',
      reason,
      sourceId: source.id,
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis,
      community: 'INSTITUTIONAL',
      occurredAt: new Date(occurredAt),
      datePrecision: 'DAY',
      reason,
      sourceId: source.id,
    },
  })

  console.log('Enriched claim', CLAIM_ID, '->', slug)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
