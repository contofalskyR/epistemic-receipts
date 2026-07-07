import { prisma } from '@/lib/prisma'
import { makeLogger } from '@/lib/log'
import type { PipelineConfig, TransformedRow, RunOptions, RunResult } from './types'

const BACKOFF_DELAYS = [2000, 4000, 8000]

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}

async function fetchWithRetry<Raw>(
  fetchBatch: (cursor: string | null) => Promise<{ items: Raw[]; nextCursor: string | null }>,
  cursor: string | null,
  log: ReturnType<typeof makeLogger>,
): Promise<{ items: Raw[]; nextCursor: string | null }> {
  let lastErr: unknown
  for (let attempt = 0; attempt <= BACKOFF_DELAYS.length; attempt++) {
    try {
      return await fetchBatch(cursor)
    } catch (err) {
      lastErr = err
      if (attempt < BACKOFF_DELAYS.length) {
        const delay = BACKOFF_DELAYS[attempt]!
        log.warn('fetch_retry', { attempt: attempt + 1, delayMs: delay, error: String(err) })
        await sleep(delay)
      }
    }
  }
  throw lastErr
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function writeRow(tx: any, row: TransformedRow, tag: string, autoApproved: boolean): Promise<void> {
  const topicIds: string[] = []
  for (const slug of row.topicSlugs ?? []) {
    const t = await tx.topic.findUnique({ where: { slug } })
    if (t) topicIds.push(t.id)
  }

  const sourceIds: string[] = []
  for (const src of row.sources) {
    const created = await tx.source.upsert({
      where: { externalId: src.externalId },
      create: {
        externalId: src.externalId,
        name: src.name,
        url: src.url,
        publishedAt: src.publishedAt ?? null,
        methodologyType: src.methodologyType ?? 'primary',
        ingestedBy: tag,
        humanReviewed: false,
        autoApproved,
      },
      update: {},
    })
    sourceIds.push(created.id)
  }

  const claim = await tx.claim.upsert({
    where: { externalId: row.externalId },
    create: {
      externalId: row.externalId,
      text: row.claim.text,
      claimType: row.claim.claimType,
      currentStatus: row.claim.currentStatus,
      verificationStatus: row.claim.verificationStatus ?? 'VERIFIED',
      claimEmergedAt: row.claim.claimEmergedAt ?? null,
      claimEmergedPrecision: row.claim.claimEmergedPrecision ?? null,
      ingestedBy: tag,
      humanReviewed: false,
      autoApproved,
      metadata: row.claim.metadata ?? {},
    },
    update: {},
  })

  for (const edgeDef of row.edges) {
    const sourceId = sourceIds[edgeDef.sourceIndex]
    if (!sourceId) continue

    const edge = await tx.edge.create({
      data: {
        sourceId,
        claimId: claim.id,
        type: edgeDef.type,
        evidenceType: edgeDef.evidenceType ?? 'EVIDENTIARY',
        ingestedBy: tag,
        humanReviewed: false,
        autoApproved,
      },
    })

    if (edgeDef.score != null) {
      await tx.edgeRevision.create({
        data: {
          edgeId: edge.id,
          priorScore: null,
          newScore: edgeDef.score,
          reason: edgeDef.scoreReason ?? `${tag} auto-ingest`,
          changedAt: row.claim.claimEmergedAt ?? new Date(),
        },
      })
    }
  }

  for (const topicId of topicIds) {
    await tx.claimTopic.upsert({
      where: { claimId_topicId: { claimId: claim.id, topicId } },
      update: {},
      create: { claimId: claim.id, topicId },
    })
  }
}

export async function runPipeline<Raw, Transformed extends TransformedRow>(
  config: PipelineConfig<Raw, Transformed>,
  opts: RunOptions = {},
): Promise<RunResult> {
  const { tag, adapter, batchSize = 100, rateLimitMs = 0, autoApproved = false, transform, validate } = config
  const { full = false, dryRun = false } = opts
  const log = makeLogger(tag)

  if (dryRun) {
    log.info('dry_run_start', { tag })
    try {
      const { items } = await adapter.fetchBatch(null)
      const sample = items.slice(0, batchSize)
      let passed = 0
      let rejected = 0
      for (const raw of sample) {
        const t = transform(raw)
        const v = validate(t)
        if (v.ok) {
          passed++
          log.info('dry_run_row', { externalId: t.externalId, text: t.claim.text.slice(0, 80) })
        } else {
          rejected++
          log.warn('dry_run_rejected', { externalId: t.externalId, reason: v.reason })
        }
      }
      log.info('dry_run_complete', { batchSize: sample.length, passed, rejected })
      return { runId: null, status: 'dry-run', rowsWritten: 0, rowsSkipped: 0, rowsRejected: rejected, dbCount: 0 }
    } catch (err) {
      log.error('dry_run_error', { error: String(err) })
      return { runId: null, status: 'error', rowsWritten: 0, rowsSkipped: 0, rowsRejected: 0, dbCount: 0, error: String(err) }
    }
  }

  if (!full) {
    return { runId: null, status: 'error', rowsWritten: 0, rowsSkipped: 0, rowsRejected: 0, dbCount: 0, error: 'Must pass full=true or dryRun=true' }
  }

  const priorRun = await prisma.pipelineRun.findFirst({
    where: { pipelineTag: tag, status: 'done' },
    orderBy: { startedAt: 'desc' },
  })
  const resumeCursor = priorRun?.cursor ?? null

  const run = await prisma.pipelineRun.create({
    data: { pipelineTag: tag, startedAt: new Date(), status: 'running', cursor: resumeCursor },
  })

  const runId = run.id
  log.info('run_start', { runId, tag, resumeCursor })

  let cursor = resumeCursor
  let rowsWritten = 0
  let rowsSkipped = 0
  let rowsRejected = 0
  let runError: string | undefined

  try {
    for (;;) {
      log.info('batch_start', { runId, cursor })

      let batchResult: { items: Raw[]; nextCursor: string | null }
      try {
        batchResult = await fetchWithRetry(adapter.fetchBatch.bind(adapter), cursor, log)
      } catch (err) {
        runError = `fetch failed after retries: ${String(err)}`
        log.error('fetch_failed', { runId, cursor, error: runError })
        break
      }

      const { items, nextCursor } = batchResult
      if (items.length === 0) break

      const validRows: Transformed[] = []
      for (const raw of items.slice(0, batchSize)) {
        const transformed = transform(raw)
        const result = validate(transformed)
        if (result.ok) {
          validRows.push(transformed)
        } else {
          rowsRejected++
          log.warn('row_rejected', { runId, externalId: transformed.externalId, reason: result.reason })
        }
      }

      for (const row of validRows) {
        const existing = await prisma.claim.findUnique({ where: { externalId: row.externalId }, select: { id: true } })
        if (existing) {
          rowsSkipped++
          log.debug('row_skipped', { runId, externalId: row.externalId })
          continue
        }

        try {
          await prisma.$transaction(
            (tx) => writeRow(tx, row, tag, autoApproved),
            { timeout: 30000 },
          )
          rowsWritten++
        } catch (err) {
          log.error('row_write_error', { runId, externalId: row.externalId, error: String(err) })
          rowsRejected++
        }
      }

      log.info('batch_done', { runId, batchItems: items.length, validRows: validRows.length, cursor })

      cursor = nextCursor
      await prisma.pipelineRun.update({ where: { id: runId }, data: { cursor, rowsWritten } })

      if (nextCursor === null) break
      if (rateLimitMs > 0) await sleep(rateLimitMs)
    }
  } catch (err) {
    runError = String(err)
    log.error('run_error', { runId, error: runError })
  }

  const dbCount = await prisma.claim.count({ where: { ingestedBy: tag } })
  if (!runError && dbCount !== rowsWritten) {
    const mismatch = `count mismatch: wrote ${rowsWritten}, db has ${dbCount}`
    log.error('count_mismatch', { runId, rowsWritten, dbCount })
    runError = mismatch
  }

  const status = runError ? 'error' : 'done'
  await prisma.pipelineRun.update({
    where: { id: runId },
    data: { status, finishedAt: new Date(), rowsWritten, cursor, error: runError ?? null },
  })

  log.info('run_complete', { runId, status, rowsWritten, rowsSkipped, rowsRejected, dbCount })
  return { runId, status, rowsWritten, rowsSkipped, rowsRejected, dbCount, error: runError }
}
