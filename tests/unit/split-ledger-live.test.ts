import { describe, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))

import { multiCommunityIdsSql } from '@/lib/split-ledger'

describe('split ledger population', () => {
  it('counts live claims only', () => {
    const sql = multiCommunityIdsSql().sql
    expect(sql).toMatch(/JOIN "Claim" c/)
    expect(sql).toMatch(/c\.deleted = false/)
    expect(sql).toMatch(/IS DISTINCT FROM 'DEPRECATED'/)
    expect(sql).toMatch(/HAVING COUNT\(DISTINCT h\.community\) >= 2/)
  })
})
