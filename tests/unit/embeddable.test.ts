import { beforeEach, describe, expect, it, vi } from 'vitest'

const findMany = vi.fn()
const queryTrajectoryDetail = vi.fn()
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }))
vi.mock('@/lib/prisma', () => ({ prisma: { claim: { findMany: (...a: unknown[]) => findMany(...a) } } }))
vi.mock('@/lib/trajectory-detail', () => ({ queryTrajectoryDetail: (...a: unknown[]) => queryTrajectoryDetail(...a) }))

import { curatedSlugs, embedTrajectory, isEmbeddableSlug } from '@/lib/embeddable'

beforeEach(() => {
  findMany.mockReset().mockResolvedValue([
    { externalId: 'trajectory:continental-drift' },
    { externalId: 'trajectory:rakhigarhi-harappan-genome-2019' },
  ])
  queryTrajectoryDetail.mockReset().mockResolvedValue({ claimId: 'c1', slug: 'continental-drift', claimText: 'x', ingestedBy: 'seed', claimEmergedAt: null, transitions: [] })
})

describe('embeddable trajectories', () => {
  it('lists every live curated slug', async () => {
    expect(await curatedSlugs()).toEqual(['continental-drift', 'rakhigarhi-harappan-genome-2019'])
    const where = findMany.mock.calls[0][0].where
    expect(where.externalId).toEqual({ startsWith: 'trajectory:' })
    expect(where.deleted).toBe(false)
  })

  it('a curated slug that is not one of the 13 domain picks is embeddable', async () => {
    expect(await isEmbeddableSlug('rakhigarhi-harappan-genome-2019')).toBe(true)
  })

  it('never loads a trajectory for a slug outside the curated set', async () => {
    expect(await embedTrajectory('cmq5l0zit5oyfsal83wd26glu')).toBeNull()
    expect(await embedTrajectory('not-curated')).toBeNull()
    expect(queryTrajectoryDetail).not.toHaveBeenCalled()
    expect((await embedTrajectory('continental-drift'))?.claimId).toBe('c1')
    expect(queryTrajectoryDetail).toHaveBeenCalledWith('continental-drift')
  })
})
