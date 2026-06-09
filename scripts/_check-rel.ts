import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";
neonConfig.webSocketConstructor = ws as unknown as typeof WebSocket;
const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const p = new PrismaClient({ adapter });
async function main() {
  const rows = await p.$queryRaw<{ relationType: string; n: number }[]>`
    SELECT "relationType", COUNT(*)::int AS n FROM "ClaimRelation" GROUP BY "relationType" ORDER BY "relationType"`;
  for (const r of rows) console.log(`${r.n}\t${r.relationType}`);
  await p.$disconnect();
}
main();
