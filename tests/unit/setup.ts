import { vi } from 'vitest'

// Suppress Next.js server-only guard so pure function tests work
vi.mock('server-only', () => ({}))

// Global prisma mock — individual tests can override with vi.clearAllMocks() + mockResolvedValue
vi.mock('@/lib/prisma', () => ({
  prisma: {
    pipelineRun: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'run-001' }),
      update: vi.fn().mockResolvedValue({}),
    },
    claim: {
      findUnique: vi.fn().mockResolvedValue(null),
      count: vi.fn().mockResolvedValue(0),
      upsert: vi.fn().mockResolvedValue({ id: 'claim-001' }),
    },
    source: {
      upsert: vi.fn().mockResolvedValue({ id: 'src-001' }),
    },
    edge: {
      create: vi.fn().mockResolvedValue({ id: 'edge-001' }),
    },
    edgeRevision: {
      create: vi.fn().mockResolvedValue({ id: 'er-001' }),
    },
    topic: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    claimTopic: {
      upsert: vi.fn().mockResolvedValue({}),
    },
    $transaction: vi.fn().mockImplementation(async (fn: (tx: unknown) => unknown) => fn({
      claim: { findUnique: vi.fn().mockResolvedValue(null), upsert: vi.fn().mockResolvedValue({ id: 'claim-001' }) },
      source: { upsert: vi.fn().mockResolvedValue({ id: 'src-001' }) },
      edge: { create: vi.fn().mockResolvedValue({ id: 'edge-001' }) },
      edgeRevision: { create: vi.fn().mockResolvedValue({ id: 'er-001' }) },
      topic: { findUnique: vi.fn().mockResolvedValue(null) },
      claimTopic: { upsert: vi.fn().mockResolvedValue({}) },
    })),
  },
}))
