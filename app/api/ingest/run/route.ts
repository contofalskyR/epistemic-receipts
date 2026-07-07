import { NextResponse } from 'next/server'
import { runPipeline } from '@/lib/ingest'
import { isReadOnly } from '@/lib/isReadOnly'

// Not in PUBLIC_WRITE_PATHS — gated by CRON_SECRET only (fail closed).
// New pipelines must be registered here before they can be triggered via HTTP.
const PIPELINE_REGISTRY: Record<string, string> = {
  congress_v1: '@/pipelines/congress_v1',
  paclii_legislation_v1: '@/pipelines/paclii_legislation_v1',
  doj_fara_v1: '@/pipelines/doj_fara_v1',
}

const MAX_TAG_LENGTH = 64

export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (isReadOnly()) {
    return NextResponse.json({ error: 'Read-only mode' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { tag } = body as { tag?: unknown }
  if (typeof tag !== 'string' || !tag.trim() || tag.length > MAX_TAG_LENGTH) {
    return NextResponse.json({ error: 'tag must be a non-empty string (max 64 chars)' }, { status: 400 })
  }

  const modulePath = PIPELINE_REGISTRY[tag]
  if (!modulePath) {
    return NextResponse.json({ error: `Unknown pipeline tag: ${tag}` }, { status: 400 })
  }

  let mod: { pipeline: Parameters<typeof runPipeline>[0]; setup?: () => Promise<void> }
  try {
    mod = await import(modulePath)
  } catch {
    return NextResponse.json({ error: `Failed to load pipeline: ${tag}` }, { status: 500 })
  }

  // Enqueue-and-return: fire without awaiting. PipelineRun row tracks status.
  // Open question: a real queue (Upstash) would be safer — see specs/10-design-note.md.
  const runPromise = (async () => {
    if (mod.setup) await mod.setup()
    await runPipeline(mod.pipeline, { full: true, dryRun: false })
  })()
  runPromise.catch(() => { /* logged inside runPipeline */ })

  return NextResponse.json({ ok: true, tag, status: 'enqueued' })
}
