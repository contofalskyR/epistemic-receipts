import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

async function main() {
  const p = new PrismaClient()
  const total = await p.claim.count({where:{deleted:false, externalId:{startsWith:'trajectory:'}}})
  const transitions = await p.claimStatusHistory.groupBy({by:['fromAxis','toAxis'],_count:{id:true},orderBy:{_count:{id:'desc'}}})
  const communities = await p.claimStatusHistory.groupBy({by:['community'],_count:{id:true},orderBy:{_count:{id:'desc'}}})
  const axes = await p.claim.groupBy({by:['currentAxis' as any],where:{deleted:false,externalId:{startsWith:'trajectory:'}},_count:{id:true}})
  const depthRaw = await p.claimStatusHistory.groupBy({by:['claimId'],_count:{id:true}})
  const depthHist: Record<number,number> = {}
  depthRaw.forEach((x: any) => { const c=x._count.id; depthHist[c]=(depthHist[c]||0)+1 })
  console.log(JSON.stringify({total, transitions, communities, axes, depthHist}, null, 2))
  await p.$disconnect()
}
main().catch(e=>{console.error(e);process.exit(1)})
