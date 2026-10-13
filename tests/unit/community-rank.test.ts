import { describe, expect, it } from 'vitest'
import { communityRankLine } from '@/lib/community-rank'

describe('communityRankLine', () => {
  it('names the largest and smallest by claims and by transitions', () => {
    const m = new Map([
      ['EXPERT_LITERATURE', { claims: 407_958, transitions: 439_069 }],
      ['INSTITUTIONAL', { claims: 1_158_375, transitions: 1_365_838 }],
      ['MARKET', { claims: 94, transitions: 104 }],
    ])
    expect(communityRankLine(m)).toBe(
      'By claims: largest Institutional (1.16M), smallest Market (94). By transitions: largest Institutional (1.37M), smallest Market (104).',
    )
  })
  it('says nothing with fewer than two communities', () => {
    expect(communityRankLine(new Map([['MARKET', { claims: 1, transitions: 1 }]]))).toBeNull()
  })
})
