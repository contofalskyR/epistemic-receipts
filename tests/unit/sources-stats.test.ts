import { describe, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))

import { PIPELINE_STATS_SQL } from '@/lib/corpus'

describe('corpusStatsByPipeline SQL', () => {
  it('uses the corpus definition (deleted = false) and binds no input', () => {
    expect(PIPELINE_STATS_SQL.sql).toMatch(/WHERE deleted = false/)
    expect(PIPELINE_STATS_SQL.sql).toMatch(/GROUP BY "ingestedBy"/)
    expect(PIPELINE_STATS_SQL.values).toEqual([])
  })
})
