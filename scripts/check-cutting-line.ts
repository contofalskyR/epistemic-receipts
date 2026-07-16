import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // 1. LegislativeVote columns — already know schema, but confirm no nominate_mid stored
  const lvSample = await prisma.legislativeVote.findFirst({
    where: { dataSource: "voteview_v1" },
    select: { id: true, byPartyJson: true },
  });
  console.log("LegislativeVote sample:", JSON.stringify(lvSample, null, 2));

  // 2. Check Source.metadata for any voteview_v1 row — might store nominate_mid
  const srcSample = await prisma.source.findFirst({
    where: { ingestedBy: "voteview_v1" },
    select: { externalId: true, metadata: true },
  });
  console.log("\nSource.metadata sample:", JSON.stringify(srcSample, null, 2));

  // 3. byPartyJson coverage — how many LegislativeVote rows have it non-null?
  const byPartyCount = await prisma.legislativeVote.count({
    where: { dataSource: "voteview_v1", byPartyJson: { not: null } },
  });
  const totalVoteview = await prisma.legislativeVote.count({
    where: { dataSource: "voteview_v1" },
  });
  console.log(`\nvoteview_v1 LegislativeVote rows: ${totalVoteview.toLocaleString()}`);
  console.log(`  with byPartyJson non-null: ${byPartyCount.toLocaleString()}`);

  // 4. Check congress_v1 byPartyJson coverage (the US rollcalls that matter for defections)
  const congressByParty = await prisma.legislativeVote.count({
    where: { dataSource: "congress_v1", byPartyJson: { not: null } },
  });
  const totalCongress = await prisma.legislativeVote.count({ where: { dataSource: "congress_v1" } });
  console.log(`\ncongress_v1 LegislativeVote rows: ${totalCongress.toLocaleString()}`);
  console.log(`  with byPartyJson non-null: ${congressByParty.toLocaleString()}`);

  // 5. Distinct dataSource values in LegislativeVote
  const sources = await prisma.$queryRaw<{ "dataSource": string; n: bigint }[]>`
    SELECT "dataSource", COUNT(*) as n FROM "LegislativeVote" GROUP BY "dataSource" ORDER BY n DESC
  `;
  console.log("\nAll dataSource values in LegislativeVote:");
  for (const s of sources) console.log(`  ${s.dataSource}: ${Number(s.n).toLocaleString()}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
