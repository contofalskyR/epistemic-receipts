import { describe, it, expect, vi, beforeEach } from 'vitest'
// setup.ts mocks server-only and @/lib/prisma globally before this runs

import { runPipeline } from '@/lib/ingest/runner'
import { prisma } from '@/lib/prisma'

// Helper to access vi.fn() mocks on the globally-mocked prisma
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mp = prisma as any

function makeMinimalRow(id: string) {
  return {
    externalId: id,
    claim: {
      text: `Test claim ${id}`,
      claimType: 'EMPIRICAL',
      currentStatus: 'HARD_FACT',
    },
    sources: [{
      externalId: `src_${id}`,
      name: `Source ${id}`,
      url: `https://example.com/${id}`,
    }],
    edges: [{ sourceIndex: 0, type: 'FOR' }],
    topicSlugs: [],
  }
}

// Shared tx mock that returns proper objects
function makeTxMock() {
  return {
    claim: {
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockResolvedValue({ id: 'claim-001' }),
    },
    source: { upsert: vi.fn().mockResolvedValue({ id: 'src-001' }) },
    edge: { create: vi.fn().mockResolvedValue({ id: 'edge-001' }) },
    edgeRevision: { create: vi.fn().mockResolvedValue({ id: 'er-001' }) },
    topic: { findUnique: vi.fn().mockResolvedValue(null) },
    claimTopic: { upsert: vi.fn().mockResolvedValue({}) },
  }
}

describe('runner cursor/resume logic', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mp.pipelineRun.findFirst.mockResolvedValue(null)
    mp.pipelineRun.create.mockResolvedValue({ id: 'run-001' })
    mp.pipelineRun.update.mockResolvedValue({})
    mp.claim.findUnique.mockResolvedValue(null)
    mp.claim.count.mockResolvedValue(0)
    mp.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(makeTxMock()))
  })

  it('starts with null cursor when no prior run exists', async () => {
    const fetchedCursors: (string | null)[] = []
    const adapter = {
      fetchBatch: vi.fn().mockImplementation(async (cursor: string | null) => {
        fetchedCursors.push(cursor)
        if (cursor === null) {
          return { items: [makeMinimalRow('row-1')], nextCursor: 'PAGE:2' }
        }
        return { items: [], nextCursor: null }
      }),
    }

    mp.claim.count.mockResolvedValue(1)

    await runPipeline(
      { tag: 'test_v1', adapter, transform: r => r, validate: () => ({ ok: true }), autoApproved: false },
      { full: true },
    )

    expect(fetchedCursors[0]).toBeNull()
  })

  it('resumes from the cursor saved in the last completed run', async () => {
    mp.pipelineRun.findFirst.mockResolvedValue({ cursor: 'CONGRESS:3:OFFSET:250' })

    const fetchedCursors: (string | null)[] = []
    const adapter = {
      fetchBatch: vi.fn().mockImplementation(async (cursor: string | null) => {
        fetchedCursors.push(cursor)
        return { items: [], nextCursor: null }
      }),
    }

    await runPipeline(
      { tag: 'test_v1', adapter, transform: r => r, validate: () => ({ ok: true }), autoApproved: false },
      { full: true },
    )

    // First fetch should use the saved cursor, not null
    expect(fetchedCursors[0]).toBe('CONGRESS:3:OFFSET:250')
  })

  it('persists cursor to PipelineRun after every batch', async () => {
    let callCount = 0
    const adapter = {
      fetchBatch: vi.fn().mockImplementation(async () => {
        callCount++
        if (callCount === 1) return { items: [makeMinimalRow('a')], nextCursor: 'IDX:1' }
        if (callCount === 2) return { items: [makeMinimalRow('b')], nextCursor: 'IDX:2' }
        return { items: [], nextCursor: null }
      }),
    }

    mp.claim.count.mockResolvedValue(2)

    await runPipeline(
      { tag: 'test_v1', adapter, transform: r => r, validate: () => ({ ok: true }), autoApproved: false },
      { full: true },
    )

    const updates: unknown[] = mp.pipelineRun.update.mock.calls
    // Should have at least 2 mid-run cursor updates + 1 final status update
    expect(updates.length).toBeGreaterThanOrEqual(3)
    // One update should have cursor = 'IDX:1' (mid-run, no status field)
    const firstCursorUpdate = (updates as Array<[{ data: Record<string, unknown> }]>).find(call =>
      call[0]?.data?.cursor === 'IDX:1' && !call[0]?.data?.status
    )
    expect(firstCursorUpdate).toBeDefined()
  })

  it('dry-run writes no PipelineRun and no claims', async () => {
    const adapter = {
      fetchBatch: vi.fn().mockResolvedValue({
        items: [makeMinimalRow('dry-row')],
        nextCursor: null,
      }),
    }

    const result = await runPipeline(
      { tag: 'test_v1', adapter, transform: r => r, validate: () => ({ ok: true }), autoApproved: false },
      { dryRun: true },
    )

    expect(result.status).toBe('dry-run')
    expect(result.rowsWritten).toBe(0)
    expect(mp.pipelineRun.create).not.toHaveBeenCalled()
    expect(mp.$transaction).not.toHaveBeenCalled()
  })

  it('sets PipelineRun status to error on count mismatch', async () => {
    const adapter = {
      fetchBatch: vi.fn().mockImplementation(async (cursor: string | null) => {
        if (cursor === null) return { items: [makeMinimalRow('x')], nextCursor: null }
        return { items: [], nextCursor: null }
      }),
    }

    // Simulate counter bug: DB has 2 but runner wrote 1
    mp.claim.count.mockResolvedValue(2)

    const result = await runPipeline(
      { tag: 'test_v1', adapter, transform: r => r, validate: () => ({ ok: true }), autoApproved: false },
      { full: true },
    )

    expect(result.status).toBe('error')
    expect(result.error).toContain('count mismatch')

    const finalUpdate = (mp.pipelineRun.update.mock.calls as Array<[{ data: Record<string, unknown> }]>).at(-1)
    expect(finalUpdate?.[0]?.data?.status).toBe('error')
    expect(String(finalUpdate?.[0]?.data?.error)).toContain('count mismatch')
  })

  it('sets status done when counts match', async () => {
    const adapter = {
      fetchBatch: vi.fn().mockImplementation(async (cursor: string | null) => {
        if (cursor === null) return { items: [makeMinimalRow('y')], nextCursor: null }
        return { items: [], nextCursor: null }
      }),
    }

    // DB count matches rowsWritten (1)
    mp.claim.count.mockResolvedValue(1)

    const result = await runPipeline(
      { tag: 'test_v1', adapter, transform: r => r, validate: () => ({ ok: true }), autoApproved: false },
      { full: true },
    )

    expect(result.status).toBe('done')
    expect(result.error).toBeUndefined()
  })
})
