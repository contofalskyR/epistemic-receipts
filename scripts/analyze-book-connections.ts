// Standalone book analysis: instead of matching against existing DB claims,
// ask Claude to extract the actual epistemic claims from each chunk directly,
// then ingest those claims into the knowledge graph with book linkage.
//
// Run: npx tsx scripts/analyze-book-connections.ts --book <bookId>
// Flags:
//   --dry-run     Print extracted claims without writing to DB
//   --out <file>  Write JSON results to file for inspection (default: /tmp/book-analysis.json)

import * as fs from 'node:fs'
import * as path from 'node:path'
import { exec } from 'node:child_process'
import { PrismaClient } from '@prisma/client'

function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) return
  const raw = fs.readFileSync(envPath, 'utf-8')
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = value
  }
}
loadEnvLocal()

const prisma = new PrismaClient()
const CONCURRENCY = 10
const DRY_RUN = process.argv.includes('--dry-run')
const BOOK_ID = (() => {
  const idx = process.argv.indexOf('--book')
  return idx !== -1 ? process.argv[idx + 1] : undefined
})()
const OUT_FILE = (() => {
  const idx = process.argv.indexOf('--out')
  return idx !== -1 ? process.argv[idx + 1] : '/tmp/book-analysis.json'
})()

type ExtractedClaim = {
  claimText: string
  claimType: 'EMPIRICAL' | 'INSTITUTIONAL' | 'INTERPRETIVE' | 'HYBRID'
  matchType: 'SUPPORTS' | 'CONTRADICTS' | 'RELATED'
  evidenceQuote: string
  entities: string[]
}

type ChunkResult = {
  chunkId: string
  bookClaimId: string | null
  paragraphIndex: number
  text: string
  claims: ExtractedClaim[]
  error?: string
}

function callClaude(chunkText: string): Promise<ExtractedClaim[] | null> {
  const prompt = [
    'You are an epistemic analyst. Read the following document excerpt and extract the key factual claims it establishes.',
    '',
    'DOCUMENT EXCERPT:',
    chunkText,
    '',
    'Extract 1-4 of the most significant factual claims this text establishes. For each claim:',
    '- claimText: a concise statement of the fact (1-2 sentences, third person, present tense)',
    '- claimType: EMPIRICAL (observable fact), INSTITUTIONAL (org/policy/role), INTERPRETIVE (judgment/analysis), or HYBRID',
    '- matchType: SUPPORTS (text directly proves it), CONTRADICTS (text contradicts common belief), or RELATED (text provides relevant context)',
    '- evidenceQuote: verbatim excerpt from the text that proves this claim (max 200 chars)',
    '- entities: array of named entities involved (people, orgs, places, dates)',
    '',
    'Respond with ONLY a JSON array. No preamble, no explanation. Example:',
    '[{"claimText":"The CIA planned the Bay of Pigs invasion in 1960.","claimType":"EMPIRICAL","matchType":"SUPPORTS","evidenceQuote":"...exact quote...","entities":["CIA","Bay of Pigs","1960"]}]',
    '',
    'If the text contains no substantive factual claims (e.g. table of contents, blank, filler), respond with: []',
  ].join('\n')

  const escaped = prompt.replace(/'/g, "'\\''")

  return new Promise((resolve) => {
    exec(`claude --print '${escaped}'`, { timeout: 90000 }, (err, stdout) => {
      if (err) {
        resolve(null)
        return
      }
      const trimmed = stdout.trim()
      // Strip markdown code fences if present
      const cleaned = trimmed.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '')
      try {
        const parsed = JSON.parse(cleaned)
        if (Array.isArray(parsed)) {
          resolve(parsed as ExtractedClaim[])
        } else {
          resolve(null)
        }
      } catch {
        resolve(null)
      }
    })
  })
}

async function processChunk(chunk: {
  id: string
  paragraphIndex: number
  text: string
  claims: Array<{ id: string; positionIndex: number }>
}): Promise<ChunkResult> {
  const result: ChunkResult = {
    chunkId: chunk.id,
    bookClaimId: chunk.claims[0]?.id ?? null,
    paragraphIndex: chunk.paragraphIndex,
    text: chunk.text.slice(0, 200) + (chunk.text.length > 200 ? '…' : ''),
    claims: [],
  }

  const extracted = await callClaude(chunk.text)
  if (extracted === null) {
    result.error = 'Claude returned null or unparseable response'
    return result
  }
  result.claims = extracted
  return result
}

async function main() {
  if (!BOOK_ID) {
    console.error('Usage: npx tsx scripts/analyze-book-connections.ts --book <bookId> [--dry-run] [--out <file>]')
    process.exit(1)
  }

  const book = await prisma.book.findUnique({
    where: { id: BOOK_ID },
    select: {
      title: true,
      chunks: {
        select: {
          id: true,
          paragraphIndex: true,
          text: true,
          claims: { select: { id: true, positionIndex: true } },
        },
        orderBy: { paragraphIndex: 'asc' },
      },
    },
  })

  if (!book) {
    console.error(`Book not found: ${BOOK_ID}`)
    process.exit(1)
  }

  console.log(`Analyzing: ${book.title}`)
  console.log(`Chunks: ${book.chunks.length}`)
  if (DRY_RUN) console.log('[dry-run — no DB writes]\n')

  const results: ChunkResult[] = []
  let done = 0
  let totalClaims = 0
  let errors = 0

  for (let i = 0; i < book.chunks.length; i += CONCURRENCY) {
    const batch = book.chunks.slice(i, i + CONCURRENCY)
    const batchResults = await Promise.all(batch.map(processChunk))

    for (const r of batchResults) {
      results.push(r)
      if (r.error) {
        errors++
        console.error(`[¶${r.paragraphIndex}] error: ${r.error}`)
      } else {
        totalClaims += r.claims.length
        if (r.claims.length > 0) {
          console.log(`[¶${r.paragraphIndex}] ${r.claims.length} claim(s): ${r.claims.map(c => c.claimText.slice(0, 60)).join(' | ')}`)
        } else {
          console.log(`[¶${r.paragraphIndex}] no claims`)
        }
      }
    }

    done = Math.min(i + CONCURRENCY, book.chunks.length)
    console.log(`Progress: ${done}/${book.chunks.length} chunks | ${totalClaims} claims so far | ${errors} errors`)
  }

  // Write results to file
  fs.writeFileSync(OUT_FILE, JSON.stringify(results, null, 2))
  console.log(`\nResults written to ${OUT_FILE}`)

  if (!DRY_RUN) {
    console.log('\nInserting claims into DB…')

    // Find or create a Source record for this book
    const ingestTag = `book-analysis:${BOOK_ID}`
    let source = await prisma.source.findFirst({
      where: { externalId: ingestTag },
    })
    if (!source) {
      source = await prisma.source.create({
        data: {
          name: book.title,
          externalId: ingestTag,
          methodologyType: 'primary',
          ingestedBy: ingestTag,
          autoApproved: false,
          humanReviewed: false,
        },
      })
      console.log(`Created source: ${source.id} (${book.title})`)
    } else {
      console.log(`Reusing existing source: ${source.id}`)
    }

    let inserted = 0
    let linked = 0
    let edged = 0

    for (const result of results) {
      if (result.claims.length === 0 || !result.bookClaimId) continue

      for (const extracted of result.claims) {
        if (!extracted.claimText || !extracted.evidenceQuote) continue

        // Create a new Claim in the main graph, tagged PROVISIONAL + OCR metadata
        const claim = await prisma.claim.create({
          data: {
            text: extracted.claimText,
            claimType: extracted.claimType ?? 'EMPIRICAL',
            currentStatus: 'DISPUTED',
            ingestedBy: ingestTag,
            verificationStatus: 'PROVISIONAL',
            autoApproved: false,
            humanReviewed: false,
            metadata: {
              source_quality: 'ocr_scan',
              entities: extracted.entities ?? [],
              evidence_quote: extracted.evidenceQuote,
            },
          },
        })
        inserted++

        // Link back to book chunk via BookClaimMatch (powers the /reader UI)
        await prisma.bookClaimMatch.create({
          data: {
            bookClaimId: result.bookClaimId!,
            claimId: claim.id,
            similarityScore: 1.0,
            matchType: extracted.matchType ?? 'SUPPORTS',
            reason: extracted.evidenceQuote,
          },
        })
        linked++

        // Create Edge from Source → Claim (fully wires it into the knowledge graph)
        await prisma.edge.create({
          data: {
            sourceId: source!.id,
            claimId: claim.id,
            type: extracted.matchType === 'CONTRADICTS' ? 'AGAINST' : 'FOR',
            evidenceType: 'EVIDENTIARY',
            ingestedBy: ingestTag,
            humanReviewed: false,
          },
        })
        edged++
      }
    }

    console.log(`\nDone. Inserted ${inserted} claims, ${linked} book links, ${edged} source edges.`)
  }

  console.log(`\nSummary: ${totalClaims} claims extracted from ${results.length} chunks, ${errors} errors`)
  await prisma.$disconnect()
}

main().catch(async (err) => {
  console.error('FATAL:', err)
  await prisma.$disconnect()
  process.exit(1)
})
