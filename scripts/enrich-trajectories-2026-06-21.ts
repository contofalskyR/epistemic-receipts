// One-off enrichment: add verified missing intermediate transitions to curated
// settling curves that had fewer than 3 ClaimStatusHistory records.
// Every transition is backed by a newly-created Source linked via sourceId.
// All dates/citations verified against canonical URLs on 2026-06-21 (no recall).
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

type Insert = {
  claimId: string;
  source: { name: string; url: string; publishedAt: string };
  fromAxis: string;
  toAxis: string;
  community: string;
  occurredAt: string;
  datePrecision: string;
  reason: string;
};

const INSERTS: Insert[] = [
  // A) Baade–Zwicky neutron-star prediction: 1934 RECORDED -> 1968 SETTLED.
  //    Missing: Oppenheimer & Volkoff 1939 quantitative GR treatment (TOV limit).
  {
    claimId: 'cmqj85gbm002osaefhnqdihf2',
    source: {
      name: 'J. R. Oppenheimer & G. M. Volkoff, "On Massive Neutron Cores," Physical Review 55, 374–381 (15 Feb 1939)',
      url: 'https://link.aps.org/doi/10.1103/PhysRev.55.374',
      publishedAt: '1939-02-15',
    },
    fromAxis: 'RECORDED',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1939-02-15',
    datePrecision: 'DAY',
    reason:
      "Oppenheimer and Volkoff publish 'On Massive Neutron Cores' (Physical Review 55, 374–381, 15 February 1939), the first quantitative general-relativistic treatment of neutron-star equilibrium. Using a cold Fermi-gas equation of state they derive a maximum mass (~0.7 solar masses, the Tolman–Oppenheimer–Volkoff limit), turning Baade and Zwicky's qualitative 1934 conjecture into a concrete, computable astrophysical object.",
  },
  // B1) Molina–Rowland CFC/ozone prediction: 1974 RECORDED -> 1995 Nobel SETTLED.
  //     Missing: 1985 Antarctic ozone-hole discovery — the empirical confirmation.
  {
    claimId: 'cmqj9ku51002asawqgt0vo0gz',
    source: {
      name: 'J. C. Farman, B. G. Gardiner & J. D. Shanklin, "Large losses of total ozone in Antarctica reveal seasonal ClOx/NOx interaction," Nature 315, 207–210 (16 May 1985)',
      url: 'https://www.nature.com/articles/315207a0',
      publishedAt: '1985-05-16',
    },
    fromAxis: 'RECORDED',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1985-05-16',
    datePrecision: 'DAY',
    reason:
      "Farman, Gardiner and Shanklin report in Nature (315:207–210, 16 May 1985) that springtime total ozone over Halley, Antarctica had fallen to roughly two-thirds of earlier values — the discovery of the Antarctic 'ozone hole.' The observation supplied the dramatic empirical confirmation of large-scale chlorine-catalysed ozone loss that the 1974 Molina–Rowland prediction had been contested for lacking, ending a decade of industrial and scientific dispute over the theory's real-world significance.",
  },
  // B2) Molina–Rowland: missing institutional response — the Montreal Protocol.
  {
    claimId: 'cmqj9ku51002asawqgt0vo0gz',
    source: {
      name: 'Montreal Protocol on Substances that Deplete the Ozone Layer, adopted 16 September 1987 (UNEP)',
      url: 'https://www.unep.org/ozonaction/who-we-are/about-montreal-protocol',
      publishedAt: '1987-09-16',
    },
    fromAxis: 'RECORDED',
    toAxis: 'RECORDED',
    community: 'INSTITUTIONAL',
    occurredAt: '1987-09-16',
    datePrecision: 'DAY',
    reason:
      'The Montreal Protocol on Substances that Deplete the Ozone Layer is adopted on 16 September 1987 (entering into force 1 January 1989), committing signatories to phase out CFC production. Acting directly on the Molina–Rowland mechanism and the 1985 ozone-hole observations, the treaty marked institutional acceptance of CFC-driven ozone depletion as established fact and a basis for binding international policy.',
  },
  // C) Wöhler urea synthesis: 22 Feb 1828 letter (RECORDED) -> 1845 SETTLED.
  //    Missing: the formal 1828 publication that put the result into the literature.
  {
    claimId: 'cmqgblg8t00grsaabydessr8t',
    source: {
      name: 'F. Wöhler, "Ueber künstliche Bildung des Harnstoffs," Annalen der Physik und Chemie 88, 253–256 (1828)',
      url: 'https://onlinelibrary.wiley.com/doi/10.1002/andp.18280870206',
      publishedAt: '1828-07-01',
    },
    fromAxis: 'RECORDED',
    toAxis: 'RECORDED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1828-07-01',
    datePrecision: 'YEAR',
    reason:
      "Wöhler publishes the formal account, 'Ueber künstliche Bildung des Harnstoffs' (Annalen der Physik und Chemie 88:253–256, 1828), moving the result he had announced in his 22 February 1828 letter to Berzelius into the published literature, where chemists could scrutinise and reproduce the synthesis of an organic substance from the inorganic salt ammonium cyanate.",
  },
];

async function main() {
  const created: string[] = [];
  await p.$transaction(async (tx) => {
    for (const ins of INSERTS) {
      // Guard: claim must exist.
      const claim = await tx.claim.findUnique({ where: { id: ins.claimId } });
      if (!claim) throw new Error(`claim not found: ${ins.claimId}`);

      const src = await tx.source.create({
        data: {
          name: ins.source.name,
          url: ins.source.url,
          publishedAt: new Date(ins.source.publishedAt),
          methodologyType: 'primary',
          ingestedBy: 'trajectory-enrichment-agent',
          autoApproved: true, // verified against canonical URL 2026-06-21
          humanReviewed: false, // autonomous agent, not a human review
        },
      });

      const rec = await tx.claimStatusHistory.create({
        data: {
          claimId: ins.claimId,
          fromAxis: ins.fromAxis,
          toAxis: ins.toAxis,
          community: ins.community as any,
          reason: ins.reason,
          occurredAt: new Date(ins.occurredAt),
          datePrecision: ins.datePrecision,
          sourceId: src.id,
        },
      });
      created.push(`${ins.claimId} ${ins.fromAxis}->${ins.toAxis} @${ins.occurredAt} (hist ${rec.id}, src ${src.id})`);
    }
  }, { timeout: 30000 });

  console.log('INSERTED', created.length);
  created.forEach((c) => console.log('  ', c));

  // Verify against DB state (do not trust in-script counters alone).
  for (const claimId of [...new Set(INSERTS.map((i) => i.claimId))]) {
    const h = await p.claimStatusHistory.findMany({
      where: { claimId },
      orderBy: { occurredAt: 'asc' },
    });
    console.log(`\nVERIFY ${claimId}: ${h.length} transitions`);
    h.forEach((x) =>
      console.log(
        '   ',
        x.fromAxis,
        '->',
        x.toAxis,
        x.occurredAt.toISOString().slice(0, 10),
        '|',
        x.community,
        '| src:',
        x.sourceId ? 'Y' : 'N',
      ),
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => p.$disconnect());
