import { describe, expect, it } from 'vitest'
import { trajectoryMilestones, trajectorySlug } from '@/lib/trajectory-shared'

describe('trajectoryMilestones', () => {
  it('keeps chain order and reads the UTC year', () => {
    const ms = trajectoryMilestones([
      { occurredAt: '1915-01-01T00:00:00.000Z', toAxis: 'CONTESTED', reason: 'Wegener', community: 'EXPERT_LITERATURE' },
      { occurredAt: '1912-12-31T23:30:00.000Z', toAxis: 'RECORDED', reason: null, community: 'PUBLIC' },
    ])
    expect(ms.map((m) => m.year)).toEqual([1915, 1912])
    expect(ms.map((m) => m.axis)).toEqual(['CONTESTED', 'RECORDED'])
  })
})

describe('trajectorySlug', () => {
  it('strips the trajectory: prefix', () => {
    expect(trajectorySlug('trajectory:continental-drift')).toBe('continental-drift')
  })
  it('is null for non-curated claims', () => {
    expect(trajectorySlug('voteview_claim_123')).toBeNull()
    expect(trajectorySlug(null)).toBeNull()
  })
})
