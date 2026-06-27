const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const groups = await p.claimStatusHistory.groupBy({
    by: ['claimId'],
    _count: { id: true },
    having: { id: { _count: { lt: 3 } } },
  });
  const ids = groups.map((g: any) => g.claimId);

  // Only curated seed trajectories are appropriate for editorial enrichment.
  const claims = await p.claim.findMany({
    where: { id: { in: ids }, ingestedBy: { startsWith: 'seed:' } },
    select: { id: true, text: true, ingestedBy: true, claimType: true },
  });
  console.log('Seed-ingested claims with <3 transitions:', claims.length);

  // breakdown by ingester
  const byIng: Record<string, number> = {};
  for (const c of claims) byIng[c.ingestedBy] = (byIng[c.ingestedBy] || 0) + 1;
  console.log('By ingester:', JSON.stringify(byIng, null, 2));

  for (const c of claims) {
    const h = await p.claimStatusHistory.findMany({
      where: { claimId: c.id },
      orderBy: { occurredAt: 'asc' },
      select: { fromAxis: true, toAxis: true, occurredAt: true, community: true },
    });
    const steps = h.map((x: any) => `${x.occurredAt.toISOString().slice(0, 10)} ${x.fromAxis || 'null'}->${x.toAxis}[${x.community}]`).join('  ');
    console.log('\n--- ' + c.id + ' [' + c.ingestedBy + ']');
    console.log(c.text.slice(0, 180));
    console.log('  ' + steps);
  }
  await p.$disconnect();
}
main();
