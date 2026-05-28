// Seed: historical events for NARA claim linking
// Run: npx dotenv-cli -e .env.local -- npx tsx scripts/seed-historical-events.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const EVENTS = [
  {
    name: 'Cuban Missile Crisis',
    slug: 'cuban-missile-crisis',
    description: 'Thirteen-day Cold War confrontation between the United States and Soviet Union over Soviet ballistic missiles deployed in Cuba.',
    startDate: new Date('1962-10-16T00:00:00Z'),
    endDate: new Date('1962-10-28T00:00:00Z'),
    category: 'DIPLOMATIC',
  },
  {
    name: 'Church Committee Investigations',
    slug: 'church-committee',
    description: 'U.S. Senate Select Committee to Study Governmental Operations with Respect to Intelligence Activities, investigating abuses by the CIA, NSA, FBI, and other agencies.',
    startDate: new Date('1975-01-01T00:00:00Z'),
    endDate: new Date('1976-11-01T00:00:00Z'),
    category: 'LEGISLATIVE',
  },
  {
    name: 'JFK Assassination',
    slug: 'jfk-assassination',
    description: 'Assassination of President John F. Kennedy in Dallas, Texas on November 22, 1963.',
    startDate: new Date('1963-11-22T00:00:00Z'),
    endDate: new Date('1963-11-22T00:00:00Z'),
    category: 'INTELLIGENCE',
  },
  {
    name: 'Vietnam War',
    slug: 'vietnam-war',
    description: 'Conflict in Vietnam, Laos, and Cambodia from 1955 to 1975, pitting North Vietnam and its communist allies against South Vietnam and the United States.',
    startDate: new Date('1955-11-01T00:00:00Z'),
    endDate: new Date('1975-04-30T00:00:00Z'),
    category: 'MILITARY',
  },
  {
    name: 'Cold War',
    slug: 'cold-war',
    description: 'Period of geopolitical tension between the United States and the Soviet Union and their respective allies from 1947 to 1991.',
    startDate: new Date('1947-03-12T00:00:00Z'),
    endDate: new Date('1991-12-26T00:00:00Z'),
    category: 'DIPLOMATIC',
  },
]

async function main() {
  console.log('Seeding historical events...')
  for (const event of EVENTS) {
    const result = await prisma.historicalEvent.upsert({
      where: { slug: event.slug },
      update: {},
      create: event,
    })
    console.log(`  ${result.id} — ${result.name} (${result.category})`)
  }
  console.log(`\nDone: ${EVENTS.length} events seeded.`)
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
}).finally(() => prisma.$disconnect())
