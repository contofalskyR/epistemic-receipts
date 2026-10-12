import { describe, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))

import { approxCount, REFUSAL_LEDGER_SQL, REFUSAL_LEDGER_TAGS } from '@/lib/refusal-ledger'

describe('refusal ledger', () => {
  it('counts live claims with no transition, tags bound as parameters', () => {
    expect(REFUSAL_LEDGER_SQL.sql).toMatch(/deleted = false/)
    expect(REFUSAL_LEDGER_SQL.sql).toMatch(/IS DISTINCT FROM 'DEPRECATED'/)
    expect(REFUSAL_LEDGER_SQL.sql).toMatch(/NOT EXISTS/)
    expect(REFUSAL_LEDGER_SQL.values).toEqual([...REFUSAL_LEDGER_TAGS])
  })
  it('approxCount rounds to the hundred from 1,000 up', () => {
    expect(approxCount(36591)).toBe('~36,600')
    expect(approxCount(1311)).toBe('~1,300')
    expect(approxCount(91788)).toBe('~91,800')
    expect(approxCount(42)).toBe('42')
  })
})
