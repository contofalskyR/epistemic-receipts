import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  const t = await prisma.historyTrajectory.findMany({ 
    select: { id: true, title: true, domain: true, era: true } 
  });
  console.log(JSON.stringify(t, null, 2));
  await prisma.$disconnect();
}

main().catch(console.error);
