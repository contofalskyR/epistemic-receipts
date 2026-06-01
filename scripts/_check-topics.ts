import { PrismaClient } from '@prisma/client'

async function main() {
  const p = new PrismaClient()
  const ts = await p.topic.findMany({
    where: {
      OR: [
        { slug: { contains: 'court' } },
        { slug: { contains: 'federal' } },
        { slug: { contains: 'circuit' } },
      ],
    },
    select: { id: true, slug: true, name: true, parentTopicId: true },
  })
  console.log(JSON.stringify(ts, null, 2))
  await p.$disconnect()
}
main()
