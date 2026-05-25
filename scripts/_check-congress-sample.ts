import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Check distinct ingestedBy values
  const ingested = await prisma.claim.groupBy({ by: ['ingestedBy'], _count: { id: true } })
  console.log('ingestedBy:', JSON.stringify(ingested, null, 2))

  // Sample a congress-related claim
  const sample = await prisma.claim.findFirst({
    where: { text: { contains: 'Congress' } },
    select: { id: true, externalId: true, ingestedBy: true, text: true, metadata: true },
  })
  console.log('sample:', JSON.stringify(sample, null, 2))

  await prisma.$disconnect()
}
main().catch(console.error)
