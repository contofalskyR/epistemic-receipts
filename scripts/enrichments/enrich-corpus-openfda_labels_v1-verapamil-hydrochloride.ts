// Enrichment: epistemic arc for the FDA verapamil hydrochloride injection label claim.
//
// Claim: cmpixu49g86ooplo71i1in83k (openfda_labels_v1)
//   "Verapamil Hydrochloride Injection, USP is indicated for ... Rapid conversion
//    to sinus rhythm of paroxysmal supraventricular tachycardias, including those
//    associated with accessory bypass tracts (Wolff-Parkinson-White [W-P-W] and
//    Lown-Ganong-Levine [L-G-L] syndromes) ..."
//
// IV verapamil (the first clinically used calcium-channel blocker; brands Isoptin/
// Calan) has a well-documented, coherent epistemic arc for its acute-PSVT-conversion
// indication. Note that the historically accurate order places the WPW safety
// signal (1986) BEFORE the guideline re-settlement (2003), so the trajectory is
// RECORDED -> CONTESTED -> SETTLED rather than the literal template order. This is
// faithful to the record and is preferred over forcing the template order with
// fabricated dates (per AGENTS.md hard-fact principles: no transition beyond what
// the cited record supports).
//
//   OPEN     -> RECORDED  (1972-03)  First-published pivotal clinical evidence:
//                         Schamroth, Krikler & Garrett, "Immediate effects of
//                         intravenous verapamil in cardiac arrhythmias," BMJ
//                         1972;1(5801):660-662. This clinical series established
//                         that IV verapamil rapidly and reproducibly converts
//                         paroxysmal supraventricular tachycardia to sinus rhythm —
//                         the primary evidence underpinning the acute-conversion
//                         indication carried in this label. Ratified by
//                         EXPERT_LITERATURE.
//
//   RECORDED -> CONTESTED (1986-06)  Post-adoption safety signal: McGovern, Garan &
//                         Ruskin, "Precipitation of cardiac arrest by verapamil in
//                         patients with Wolff-Parkinson-White syndrome," Ann Intern
//                         Med 1986;104(6):791-794. IV verapamil given to WPW
//                         patients in pre-excited atrial fibrillation accelerated
//                         conduction over the accessory pathway and precipitated
//                         ventricular fibrillation and cardiac arrest. This
//                         contested the drug's safe use across the accessory-bypass
//                         population (W-P-W / L-G-L) explicitly named in this label
//                         and is the direct basis for its pre-excited-AF /
//                         wide-complex-tachycardia warnings and contraindications.
//                         Ratified by EXPERT_LITERATURE.
//
//   CONTESTED -> SETTLED  (2003-10)  Guideline re-settlement: Blomstrom-Lundqvist,
//                         Scheinman, et al., "ACC/AHA/ESC Guidelines for the
//                         Management of Patients With Supraventricular Arrhythmias,"
//                         J Am Coll Cardiol 2003;42(8):1493-1531. These joint
//                         guidelines re-settled consensus by giving IV verapamil
//                         (with adenosine) a Class I recommendation for acute
//                         termination of hemodynamically stable narrow-complex
//                         PSVT, while codifying its contraindication in pre-excited
//                         atrial fibrillation and wide-complex tachycardia of
//                         uncertain mechanism — resolving the boundary raised by the
//                         1986 signal. Ratified by EXPERT_LITERATURE.
//
// No SETTLED -> REVERSED transition is included: IV verapamil remains FDA-approved
// and guideline-recommended for acute conversion of narrow-complex PSVT; the 1986
// signal narrowed use in accessory-pathway pre-excited AF, it did not revoke the
// approval.
//
// Live web verification (WebFetch/curl) was not available in this session; URLs are
// anchored on stable, canonical DOI records, consistent with the valacyclovir and
// tofacitinib enrichments. Idempotent: upserts on Source.externalId and
// ClaimStatusHistory.id.
//
// Run: npx tsx scripts/enrichments/enrich-corpus-openfda_labels_v1-verapamil-hydrochloride.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmpixu49g86ooplo71i1in83k'

type FactStatus =
  | 'OPEN' | 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED' | 'ABANDONED' | 'UNRESOLVABLE'
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
  fromAxis: FactStatus
  toAxis: FactStatus
  community: RatifyingCommunity
  occurredAt: string
  datePrecision: DatePrecision
  reason: string
  source: SourceDef
}

const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'OPEN',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1972-03-01',
    datePrecision: 'MONTH',
    reason:
      'In March 1972 the British Medical Journal published Schamroth, Krikler & Garrett, "Immediate effects of intravenous verapamil in cardiac arrhythmias," the pivotal clinical series demonstrating that intravenous verapamil rapidly and reproducibly converts paroxysmal supraventricular tachycardia to sinus rhythm. This was the first-published pivotal clinical evidence establishing the acute-conversion effect that underpins the indication carried verbatim in this label.',
    source: {
      externalId: 'src:verapamil-schamroth-svt-bmj-1972',
      name: 'Schamroth L, Krikler DM, Garrett C. "Immediate effects of intravenous verapamil in cardiac arrhythmias." Br Med J 1972;1(5801):660-662.',
      url: 'https://doi.org/10.1136/bmj.1.5801.660',
      publishedAt: '1972-03-01',
      methodologyType: 'primary',
    },
  },
  {
    fromAxis: 'RECORDED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1986-06-01',
    datePrecision: 'MONTH',
    reason:
      'In June 1986 Annals of Internal Medicine published McGovern, Garan & Ruskin, "Precipitation of cardiac arrest by verapamil in patients with Wolff-Parkinson-White syndrome." Intravenous verapamil given to WPW patients in pre-excited atrial fibrillation accelerated conduction over the accessory pathway, precipitating ventricular fibrillation and cardiac arrest. This contested the drug\'s safe use across the accessory-bypass population (W-P-W / L-G-L) named in this label and is the direct basis for its pre-excited-AF and wide-complex-tachycardia warnings.',
    source: {
      externalId: 'src:verapamil-mcgovern-wpw-annals-1986',
      name: 'McGovern B, Garan H, Ruskin JN. "Precipitation of cardiac arrest by verapamil in patients with Wolff-Parkinson-White syndrome." Ann Intern Med 1986;104(6):791-794.',
      url: 'https://doi.org/10.7326/0003-4819-104-6-791',
      publishedAt: '1986-06-01',
      methodologyType: 'primary',
    },
  },
  {
    fromAxis: 'CONTESTED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2003-10-15',
    datePrecision: 'DAY',
    reason:
      'On 15 October 2003 the Journal of the American College of Cardiology published the ACC/AHA/ESC Guidelines for the Management of Patients With Supraventricular Arrhythmias. These joint guidelines re-settled consensus by giving intravenous verapamil (with adenosine) a Class I recommendation for acute termination of hemodynamically stable narrow-complex PSVT, while codifying its contraindication in pre-excited atrial fibrillation and wide-complex tachycardia of uncertain mechanism. This resolved the safety boundary raised by the 1986 WPW signal and fixed verapamil\'s standard-of-care role for the indication in this label.',
    source: {
      externalId: 'src:verapamil-acc-aha-esc-sva-guideline-jacc-2003',
      name: 'Blomstrom-Lundqvist C, Scheinman MM, Aliot EM, et al. "ACC/AHA/ESC Guidelines for the Management of Patients With Supraventricular Arrhythmias." J Am Coll Cardiol 2003;42(8):1493-1531.',
      url: 'https://doi.org/10.1016/j.jacc.2003.08.013',
      publishedAt: '2003-10-15',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  for (const t of TRANSITIONS) {
    await prisma.source.upsert({
      where: { externalId: t.source.externalId },
      create: {
        externalId: t.source.externalId,
        name: t.source.name,
        url: t.source.url,
        publishedAt: new Date(t.source.publishedAt),
        methodologyType: t.source.methodologyType,
      },
      update: {
        name: t.source.name,
        url: t.source.url,
        publishedAt: new Date(t.source.publishedAt),
        methodologyType: t.source.methodologyType,
      },
    })

    const occurredAt = new Date(t.occurredAt)
    const slug = `${CLAIM_ID}-${t.toAxis}-${t.occurredAt.slice(0, 10)}`

    await prisma.claimStatusHistory.upsert({
      where: { id: slug },
      create: {
        id: slug,
        claimId: CLAIM_ID,
        fromAxis: t.fromAxis,
        toAxis: t.toAxis,
        community: t.community,
        occurredAt,
        datePrecision: t.datePrecision,
        reason: t.reason,
        sourceExternalId: t.source.externalId,
      },
      update: {
        fromAxis: t.fromAxis,
        toAxis: t.toAxis,
        community: t.community,
        occurredAt,
        datePrecision: t.datePrecision,
        reason: t.reason,
        sourceExternalId: t.source.externalId,
      },
    })

    console.log(`upserted ${slug} (${t.fromAxis} -> ${t.toAxis})`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
