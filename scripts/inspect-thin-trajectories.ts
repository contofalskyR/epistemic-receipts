const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  // Only curated seed trajectories are appropriate for editorial enrichment.
  const claims = await p.claim.findMany({
    where: { ingestedBy: { startsWith: 'seed:' } },
    select: { id: true, text: true, ingestedBy: true, claimType: true },
  });
  console.log('Total seed-ingested claims:', claims.length);

  const thin: any[] = [];
  for (const c of claims) {
    const cnt = await p.claimStatusHistory.count({ where: { claimId: c.id } });
    if (cnt < 3 && cnt > 0) thin.push({ ...c, cnt });
  }
  console.log('Seed-ingested claims with 1-2 transitions:', thin.length);

  const byIng: Record<string, number> = {};
  for (const c of thin) byIng[c.ingestedBy] = (byIng[c.ingestedBy] || 0) + 1;
  console.log('By ingester:', JSON.stringify(byIng, null, 2));

  for (const c of thin) {
    const h = await p.claimStatusHistory.findMany({
      where: { claimId: c.id },
      orderBy: { occurredAt: 'asc' },
      select: { fromAxis: true, toAxis: true, occurredAt: true, community: true, reason: true },
    });
    const steps = h.map((x: any) => `${x.occurredAt.toISOString().slice(0, 10)} ${x.fromAxis || 'null'}->${x.toAxis}[${x.community}]`).join('  ');
    console.log('\n--- ' + c.id + ' [' + c.ingestedBy + '] (' + c.cnt + ')');
    console.log(c.text.slice(0, 200));
    console.log('  ' + steps);
  }
  await p.$disconnect();
}
main();
