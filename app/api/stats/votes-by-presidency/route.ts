import { NextResponse } from 'next/server'
import { getVotingByPresidency, getVotingByEra } from '@/lib/stats-queries'

export const revalidate = 3600

export async function GET() {
  const [byPresidency, byEra] = await Promise.all([getVotingByPresidency(), getVotingByEra()])
  return NextResponse.json({ byPresidency, byEra })
}
