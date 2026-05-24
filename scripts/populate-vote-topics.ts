// One-off migration: keyword-cluster bill titles into topic buckets.
// Run: npx tsx scripts/populate-vote-topics.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const TOPIC_KEYWORDS: Record<string, string[]> = {
  defense: [
    'war', 'military', 'armed forces', 'defence', 'defense', 'nato',
    'veteran', 'weapon', 'army', 'navy', 'air force', 'combat', 'troop',
    'ammunition', 'missile', 'terrorism', 'national security', 'intelligence',
    'nuclear deterr', 'coast guard', 'homeland security', 'warfare', 'soldier',
  ],
  health: [
    'health', 'medical', 'nhs', 'pandemic', 'vaccine', 'vaccination',
    'pharmaceutical', 'medicine', 'hospital', 'disease', 'mental health',
    'dental', 'nursing', 'patient', 'clinical', 'medicaid', 'medicare',
    'public health', 'drug approval', 'epidem',
  ],
  economy: [
    'budget', 'tax', 'taxation', 'finance', 'fiscal', 'economic', 'trade',
    'tariff', 'revenue', 'spending', 'inflation', 'debt', 'deficit',
    'appropriation', 'subsidy', 'banking', 'investment', 'financial',
    'monetary', 'appropriations', 'credit', 'loans', 'insurance',
    'employment', 'labor market', 'wages', 'minimum wage', 'pension fund',
  ],
  environment: [
    'climate', 'environment', 'environmental', 'green', 'energy',
    'carbon', 'emission', 'renewable', 'pollution', 'biodiversity',
    'sustainability', 'fossil fuel', 'conservation', 'water quality',
    'air quality', 'deforestation', 'wildlife', 'natural resource',
    'ocean', 'waste management', 'recycl',
  ],
  justice: [
    'justice', 'crime', 'criminal', 'police', 'court', 'prison',
    'law enforcement', 'sentenc', 'punishment', 'prosecution', 'judicial',
    'corrections', 'firearms', 'gun control', 'violence', 'trafficking',
    'fraud', 'cybercrime', 'terrorism prevention', 'civil rights',
  ],
  immigration: [
    'immigrat', 'refugee', 'asylum', 'border', 'visa', 'citizenship',
    'migrant', 'deportat', 'naturalizat', 'undocumented', 'foreigner',
    'work permit', 'residency', 'entry ban',
  ],
  education: [
    'education', 'school', 'university', 'student', 'teacher', 'curriculum',
    'higher education', 'college', 'learning', 'academic', 'scholarship',
    'tuition', 'literacy', 'training', 'vocational', 'apprenticeship',
    'childcare', 'early childhood',
  ],
  infrastructure: [
    'infrastructure', 'transport', 'housing', 'road', 'rail', 'railway',
    'construction', 'bridge', 'highway', 'transit', 'airport', 'port',
    'broadband', 'internet', 'utilities', 'water supply', 'sewer',
    'electricity grid', 'public works',
  ],
  foreign_policy: [
    'foreign', 'international', 'treaty', 'sanction', 'diplomatic', 'alliance',
    'bilateral', 'multilateral', 'embassy', 'overseas', 'foreign aid',
    'global', 'geopolit', 'united nations', 'world trade', 'foreign relation',
    'extradition',
  ],
  social: [
    'social', 'welfare', 'pension', 'benefit', 'disability', 'equality',
    'diversity', 'poverty', 'homeless', 'unemployment', 'family',
    'children', 'elderly', 'nutrition', 'food stamp', 'labour',
    'worker right', 'maternity', 'parental leave', 'housing benefit',
    'discrimination', 'inclusion',
  ],
}

function detectTopics(title: string): string[] {
  const lower = title.toLowerCase()
  const found: string[] = []
  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    for (const kw of keywords) {
      if (lower.includes(kw)) {
        found.push(topic)
        break
      }
    }
  }
  return found
}

async function main() {
  const votes = await prisma.legislativeVote.findMany({
    where: { topics: null },
    select: { id: true, source: { select: { name: true } } },
  })

  console.log(`Found ${votes.length} votes without topics`)

  let tagged = 0, untagged = 0

  const CHUNK = 200
  for (let i = 0; i < votes.length; i += CHUNK) {
    const batch = votes.slice(i, i + CHUNK)
    await Promise.all(
      batch.map(v => {
        const title = v.source?.name ?? ''
        const topics = detectTopics(title)
        if (topics.length > 0) tagged++
        else untagged++
        return prisma.legislativeVote.update({
          where: { id: v.id },
          data: { topics: topics.length > 0 ? JSON.stringify(topics) : null },
        })
      })
    )
    if ((i + CHUNK) % 1000 === 0 || i + CHUNK >= votes.length) {
      console.log(`  ${Math.min(i + CHUNK, votes.length)}/${votes.length}`)
    }
  }

  console.log(`Done. tagged=${tagged} untagged=${untagged}`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
