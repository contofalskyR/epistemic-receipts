export interface Adapter<Raw> {
  fetchBatch(cursor: string | null): Promise<{
    items: Raw[]
    nextCursor: string | null
  }>
}

export interface TransformedRow {
  externalId: string
  claim: {
    text: string
    claimType: string
    currentStatus: string
    verificationStatus?: string
    claimEmergedAt?: Date | null
    claimEmergedPrecision?: string | null
    metadata?: Record<string, unknown>
  }
  sources: Array<{
    externalId: string
    name: string
    url: string
    publishedAt?: Date | null
    methodologyType?: string
  }>
  edges: Array<{
    sourceIndex: number
    type: string
    evidenceType?: string
    score?: number
    scoreReason?: string
  }>
  topicSlugs?: string[]
}

export interface PipelineConfig<Raw, Transformed extends TransformedRow> {
  tag: string
  adapter: Adapter<Raw>
  batchSize?: number
  rateLimitMs?: number
  autoApproved?: boolean
  transform: (raw: Raw) => Transformed
  validate: (t: Transformed) => { ok: true } | { ok: false; reason: string }
}

export interface RunOptions {
  full?: boolean
  dryRun?: boolean
}

export interface RunResult {
  runId: string | null
  status: 'done' | 'error' | 'dry-run'
  rowsWritten: number
  rowsSkipped: number
  rowsRejected: number
  dbCount: number
  error?: string
}
