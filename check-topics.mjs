import { PrismaClient } from '@prisma/client';
const db = new PrismaClient({ datasources: { db: { url: 'postgresql://neondb_owner:npg_oe7SIPvp8RCY@ep-solitary-credit-am7an17v-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require' } } });
const topics = await db.topic.findMany({ select: { name: true, _count: { select: { claims: true } } }, orderBy: { claims: { _count: 'desc' } } });
const total = await db.claim.count();
console.log('Total claims:', total);
topics.filter(t => t._count.claims > 0).forEach(t => console.log(t.name + ': ' + t._count.claims));
await db.$disconnect();
