// Enrich existing settling curves with missing, well-documented intermediate
// epistemic transitions.
//
// Each curve below already existed with only two transitions (a recording and a
// settlement). Each enrichment inserts one verifiable intermediate step that the
// historical record documents and that the curve was missing — an independent
// confirmation, a generalising publication, an institutional redefinition, or a
// contestation phase. Every inserted transition carries a primary/derivative
// source with a fetchable URL and a specific date (see AGENTS.md:
// "Curated lists require verifiable sources").
//
// Where the inserted transition changes the axis flow (e.g. inserting a CONTESTED
// phase between RECORDED and SETTLED), the downstream transition's fromAxis is
// updated so the chain stays consistent.
//
// Idempotent: upserts sources on externalId and status-history rows on a
// deterministic id; the downstream-fromAxis fix is a plain update that is safe to
// re-run.
//
// Run:     npx tsx scripts/enrich-trajectory-transitions.ts
// Dry-run: npx tsx scripts/enrich-trajectory-transitions.ts --dry-run

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

interface Enrichment {
  trajectoryExternalId: string
  // deterministic suffix for the inserted history row's id
  insertSuffix: string
  fromAxis: FactStatus
  toAxis: FactStatus
  community: RatifyingCommunity
  occurredAt: string
  datePrecision: DatePrecision
  reason: string
  source: SourceDef
  // If inserting changes the chain's axis flow, the existing downstream history
  // row whose fromAxis must be rewritten to keep the chain valid.
  fixDownstream?: { historyId: string; newFromAxis: FactStatus }
}

const ENRICHMENTS: Enrichment[] = [

  // ── Mendeleev's periodic table: the 1875 discovery of gallium confirmed the
  //    predicted "eka-aluminium", the first vindication between the 1869 table
  //    and its 1886 settlement. (Mirrors the sibling curve periodic-law-1869.)
  {
    trajectoryExternalId: 'trajectory:mendeleev-periodic-table-1869',
    insertSuffix: 'mid-1875',
    fromAxis: 'RECORDED',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1875-08-27',
    datePrecision: 'MONTH',
    reason: 'Paul-Émile Lecoq de Boisbaudran discovered gallium in 1875; its properties matched Mendeleev’s 1871 prediction of an undiscovered "eka-aluminium" so closely (including a density Mendeleev corrected by post — letter, against the discoverer’s initial measurement) that the find became the first concrete confirmation of the predictive power of the periodic system, moving it from a classificatory scheme toward an accepted law.',
    source: {
      externalId: 'src:boisbaudran-gallium-1875',
      name: 'Discovery of gallium (Lecoq de Boisbaudran, 1875), confirming Mendeleev’s predicted eka-aluminium.',
      url: 'https://en.wikipedia.org/wiki/Gallium',
      publishedAt: '1875-08-27',
      methodologyType: 'primary',
    },
  },

  // ── Accelerating universe / dark energy: the second, independent team (the
  //    Supernova Cosmology Project) confirmed acceleration in 1999, the
  //    intermediate corroboration the curve was missing before the 2011 Nobel.
  {
    trajectoryExternalId: 'trajectory:accelerating-universe-dark-energy-1998',
    insertSuffix: 'mid-1999',
    fromAxis: 'RECORDED',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1999-06-01',
    datePrecision: 'MONTH',
    reason: 'The Supernova Cosmology Project (Perlmutter et al., "Measurements of Ω and Λ from 42 High-Redshift Supernovae," ApJ 517:565, 1999) independently reported the same accelerating expansion found by the High-z team in 1998. Two independent teams reaching the same result was the corroboration that turned a single surprising report into a robust finding ahead of its 2011 Nobel settlement.',
    source: {
      externalId: 'src:perlmutter-scp-1999',
      name: 'Perlmutter et al., "Measurements of Ω and Λ from 42 High-Redshift Supernovae," The Astrophysical Journal 517:565 (1999).',
      url: 'https://doi.org/10.1086/307221',
      publishedAt: '1999-06-01',
      methodologyType: 'primary',
    },
  },

  // ── Genetic code: the Nirenberg–Leder triplet-binding assay (1964) decoded
  //    most codons, the intermediate between the first UUU codon (1961) and the
  //    complete code (1966).
  {
    trajectoryExternalId: 'trajectory:nirenberg-genetic-code-1961',
    insertSuffix: 'mid-1964',
    fromAxis: 'RECORDED',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1964-09-25',
    datePrecision: 'DAY',
    reason: 'Nirenberg and Leder’s ribosome (triplet) binding assay (Leder & Nirenberg, "RNA Codewords and Protein Synthesis," Science 145:1399, 25 September 1964) let defined trinucleotides direct specific tRNA binding, deciphering the assignments of most of the 64 codons and providing the method that carried the work from the single 1961 UUU result to the complete code.',
    source: {
      externalId: 'src:nirenberg-leder-science-1964',
      name: 'Leder P & Nirenberg M, "RNA Codewords and Protein Synthesis," Science 145(3639):1399–1407 (25 Sept 1964).',
      url: 'https://www.science.org/doi/10.1126/science.145.3639.1399',
      publishedAt: '1964-09-25',
      methodologyType: 'primary',
    },
  },

  // ── Garrod / inborn errors of metabolism: the 1908 Croonian Lectures
  //    generalised the alkaptonuria observation into the founding concept of
  //    inborn errors of metabolism, between the 1902 report and 1958 settlement.
  {
    trajectoryExternalId: 'trajectory:garrod-alkaptonuria-inborn-errors-1902',
    insertSuffix: 'mid-1908',
    fromAxis: 'RECORDED',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1908-06-18',
    datePrecision: 'MONTH',
    reason: 'In the Croonian Lectures delivered to the Royal College of Physicians in June 1908 (published in The Lancet), Archibald Garrod generalised the alkaptonuria finding into the concept of "inborn errors of metabolism," using albinism, alkaptonuria, cystinuria and pentosuria as recessively inherited, enzyme-specific chemical defects — the first link between Mendelian inheritance and biochemistry. The concept was recorded and influential among biochemists but remained controversial among geneticists and largely ignored by clinicians for decades.',
    source: {
      externalId: 'src:garrod-croonian-inborn-errors-1908',
      name: 'Garrod AE, "The Croonian Lectures on Inborn Errors of Metabolism," The Lancet (1908); delivered before the Royal College of Physicians, June 1908.',
      url: 'https://www.sciencedirect.com/science/article/abs/pii/S0140673601781135',
      publishedAt: '1908-06-18',
      methodologyType: 'primary',
    },
  },

  // ── Quasicrystals: the IUCr's 1992 redefinition of "crystal" institutionally
  //    accommodated quasiperiodic order while the scientific dispute (notably
  //    Pauling's opposition) continued — an intermediate within the long
  //    contested phase before the 2011 Nobel.
  {
    trajectoryExternalId: 'trajectory:quasicrystals-shechtman-1984',
    insertSuffix: 'mid-1992',
    fromAxis: 'CONTESTED',
    toAxis: 'CONTESTED',
    community: 'INSTITUTIONAL',
    occurredAt: '1992-01-01',
    datePrecision: 'YEAR',
    reason: 'In 1992 the International Union of Crystallography changed its definition of a crystal to "any solid having an essentially discrete diffraction pattern" (Acta Crystallographica A48, 928), formally accommodating quasiperiodic order. The institutional redefinition marked a decisive narrowing of the contestation even though prominent critics (notably Linus Pauling, until his death in 1994) continued to dispute quasicrystals — the curve’s contested phase did not end until the 2011 Nobel.',
    source: {
      externalId: 'src:iucr-crystal-redefinition-1992',
      name: 'IUCr redefinition of "crystal" as "any solid having an essentially discrete diffraction pattern" (Acta Crystallographica A48, 928, 1992); IUCr Online Dictionary of Crystallography, "Crystal".',
      url: 'https://dictionary.iucr.org/Crystal',
      publishedAt: '1992-01-01',
      methodologyType: 'derivative',
    },
  },

  // ── Helicobacter pylori → peptic ulcer: between the 1984 Lancet report and the
  //    1994 NIH consensus the causal claim was actively contested by the
  //    gastroenterology establishment; Marshall self-infected (published 1985)
  //    precisely because the hypothesis was being rejected. Inserting the
  //    CONTESTED phase requires rewriting the 1994 row's fromAxis to CONTESTED.
  {
    trajectoryExternalId: 'trajectory:helicobacter-pylori-peptic-ulcer-causation-1984',
    insertSuffix: 'mid-1985',
    fromAxis: 'RECORDED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1985-04-15',
    datePrecision: 'DAY',
    reason: 'The bacterial-causation hypothesis was widely rejected by the gastroenterology and pharmaceutical establishment, which held that ulcers were caused by acid and stress. Unable to reproduce infection in animal models and facing this resistance, Barry Marshall drank a culture of the bacterium in 1984 and developed gastritis, reporting it in "Attempt to fulfil Koch’s postulates for pyloric Campylobacter" (Med J Aust 1985;142:436–9, 15 April 1985). The claim stayed contested until the 1994 NIH Consensus Conference settled it.',
    source: {
      externalId: 'src:marshall-koch-postulates-mja-1985',
      name: 'Marshall BJ, Armstrong JA, McGechie DB, Glancy RJ, "Attempt to fulfil Koch’s postulates for pyloric Campylobacter," Med J Aust 1985;142(8):436–439 (PMID 3982345).',
      url: 'https://pubmed.ncbi.nlm.nih.gov/3982345/',
      publishedAt: '1985-04-15',
      methodologyType: 'primary',
    },
    fixDownstream: {
      historyId: 'csh:trajectory:helicobacter-pylori-peptic-ulcer-causation-1984:1',
      newFromAxis: 'CONTESTED',
    },
  },
]

async function applyEnrichment(e: Enrichment) {
  const claim = await prisma.claim.findUnique({
    where: { externalId: e.trajectoryExternalId },
    select: { id: true },
  })
  if (!claim) {
    console.error(`  ✗ ${e.trajectoryExternalId} — claim not found, skipped`)
    return false
  }

  const histId = `csh:${e.trajectoryExternalId}:${e.insertSuffix}`

  if (DRY_RUN) {
    console.log(`  [dry] ${e.trajectoryExternalId}: insert ${e.fromAxis}→${e.toAxis} @ ${e.occurredAt}` +
      (e.fixDownstream ? ` (+ fix ${e.fixDownstream.historyId} fromAxis→${e.fixDownstream.newFromAxis})` : ''))
    return true
  }

  const source = await prisma.source.upsert({
    where: { externalId: e.source.externalId },
    update: {
      name: e.source.name,
      url: e.source.url,
      publishedAt: new Date(e.source.publishedAt),
      methodologyType: e.source.methodologyType,
    },
    create: {
      externalId: e.source.externalId,
      name: e.source.name,
      url: e.source.url,
      publishedAt: new Date(e.source.publishedAt),
      methodologyType: e.source.methodologyType,
      ingestedBy: 'seed:enrich-trajectory-transitions',
    },
  })

  await prisma.claimStatusHistory.upsert({
    where: { id: histId },
    update: {
      fromAxis: e.fromAxis,
      toAxis: e.toAxis,
      community: e.community,
      occurredAt: new Date(e.occurredAt),
      datePrecision: e.datePrecision,
      reason: e.reason,
      sourceId: source.id,
    },
    create: {
      id: histId,
      claimId: claim.id,
      fromAxis: e.fromAxis,
      toAxis: e.toAxis,
      community: e.community,
      occurredAt: new Date(e.occurredAt),
      datePrecision: e.datePrecision,
      reason: e.reason,
      sourceId: source.id,
    },
  })

  if (e.fixDownstream) {
    await prisma.claimStatusHistory.update({
      where: { id: e.fixDownstream.historyId },
      data: { fromAxis: e.fixDownstream.newFromAxis },
    })
  }

  console.log(`  ✓ ${e.trajectoryExternalId}: ${e.fromAxis}→${e.toAxis} @ ${e.occurredAt}` +
    (e.fixDownstream ? ` (+ downstream fromAxis→${e.fixDownstream.newFromAxis})` : ''))
  return true
}

async function main() {
  console.log(`${DRY_RUN ? '[DRY RUN] ' : ''}Enriching ${ENRICHMENTS.length} settling curves with intermediate transitions...\n`)
  let ok = 0
  for (const e of ENRICHMENTS) {
    try {
      if (await applyEnrichment(e)) ok++
    } catch (err) {
      console.error(`  ✗ ${e.trajectoryExternalId} — ${err instanceof Error ? err.message.split('\n')[0] : err}`)
    }
  }
  console.log(`\nDone. ${ok}/${ENRICHMENTS.length} enrichments ${DRY_RUN ? 'validated' : 'applied'}.`)
}

main().finally(() => prisma.$disconnect())
