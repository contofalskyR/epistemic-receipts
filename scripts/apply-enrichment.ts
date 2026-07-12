/**
 * apply-enrichment.ts
 *
 * Validates and executes a Claude-generated enrichment TypeScript file.
 * The enrichment file is a standalone tsx script that imports Prisma and
 * upserts ClaimStatusHistory rows for an existing claim.
 *
 * Usage:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/apply-enrichment.ts <path-to-enrichment.ts>
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/apply-enrichment.ts <path> --skip-url-check
 *
 * Validation checks:
 *   1. File exists and is non-empty
 *   2. Contains required imports (dotenv, PrismaClient)
 *   3. Contains $disconnect() call (cleanup)
 *   4. Does NOT contain dangerous patterns (DROP, DELETE, truncate, exec, eval)
 *   5. Contains claimStatusHistory operations
 *   6. All url: '...' fields resolve (2xx) — skippable with --skip-url-check
 *
 * If validation passes, executes the file via a child process with tsx.
 */

import * as fs from 'fs'
import * as path from 'path'
import { execSync } from 'child_process'
import { verifyUrl } from '../lib/transition-contract'

// ── Validation ────────────────────────────────────────────────────────────────

interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

function validate(filePath: string): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // 1. File exists and is non-empty
  if (!fs.existsSync(filePath)) {
    return { valid: false, errors: [`File not found: ${filePath}`], warnings }
  }

  const content = fs.readFileSync(filePath, 'utf8')
  if (content.trim().length === 0) {
    return { valid: false, errors: ['File is empty'], warnings }
  }

  // 2. Required imports
  if (!content.includes('PrismaClient')) {
    errors.push('Missing PrismaClient import')
  }
  if (!content.includes("dotenv") && !content.includes("'dotenv/config'")) {
    warnings.push('Missing dotenv import — may fail without env vars')
  }

  // 3. Cleanup
  if (!content.includes('$disconnect')) {
    warnings.push('Missing $disconnect() call — connection may leak')
  }

  // 4. Dangerous patterns
  const dangerous = [
    /\bDROP\s+(TABLE|DATABASE|SCHEMA)/i,
    /\bDELETE\s+FROM\b/i,
    /\bTRUNCATE\b/i,
    /\bexec\s*\(/,
    /\beval\s*\(/,
    /\b\$executeRawUnsafe\b/,
    /\brequire\s*\(\s*['"]child_process['"]\s*\)/,
  ]
  for (const pattern of dangerous) {
    if (pattern.test(content)) {
      errors.push(`Dangerous pattern detected: ${pattern.source}`)
    }
  }

  // 5. Must contain claimStatusHistory operations
  if (!content.includes('claimStatusHistory')) {
    errors.push('No claimStatusHistory operations found — enrichment must add status history rows')
  }

  return { valid: errors.length === 0, errors, warnings }
}

// ── URL verification ──────────────────────────────────────────────────────────

async function checkUrls(filePath: string): Promise<{ ok: boolean; failures: string[] }> {
  const content = fs.readFileSync(filePath, 'utf8')
  const urlRe = /url:\s*['"]([^'"]+)['"]/g
  const urls = new Set<string>()
  let m: RegExpExecArray | null
  while ((m = urlRe.exec(content)) !== null) {
    if (m[1].startsWith('http')) urls.add(m[1])
  }
  if (urls.size === 0) return { ok: true, failures: [] }

  console.log(`[apply-enrichment] Verifying ${urls.size} URL(s)...`)
  const failures: string[] = []
  for (const url of urls) {
    const check = await verifyUrl(url)
    if (check.ok) {
      console.log(`[apply-enrichment]   ${url} → ${check.status}`)
    } else {
      const detail = `${check.status ?? 'error'}${check.note ? ` (${check.note})` : ''}`
      console.error(`[apply-enrichment]   FAIL ${url} → ${detail}`)
      failures.push(`  ${url} → ${detail}`)
    }
  }
  return { ok: failures.length === 0, failures }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const SKIP_URL_CHECK = process.argv.includes('--skip-url-check')
  const filePath = process.argv.find(a => !a.startsWith('-') && a !== process.argv[0] && a !== process.argv[1])
  if (!filePath) {
    console.error('Usage: npx tsx scripts/apply-enrichment.ts <path-to-enrichment.ts> [--skip-url-check]')
    process.exit(1)
  }

  const absPath = path.resolve(filePath)
  console.log(`[apply-enrichment] Validating: ${absPath}`)

  const result = validate(absPath)

  for (const w of result.warnings) {
    console.warn(`[apply-enrichment] WARNING: ${w}`)
  }

  if (!result.valid) {
    for (const e of result.errors) {
      console.error(`[apply-enrichment] ERROR: ${e}`)
    }
    console.error('[apply-enrichment] Validation failed — not executing.')
    process.exit(2)
  }

  // URL verification (deterministic; model self-reports are not trusted)
  if (SKIP_URL_CHECK) {
    console.log('[apply-enrichment] --skip-url-check: skipping URL verification.')
  } else {
    const { ok, failures } = await checkUrls(absPath)
    if (!ok) {
      console.error('[apply-enrichment] URL verification failed:')
      for (const f of failures) console.error(f)
      console.error('[apply-enrichment] Rejecting — non-2xx URLs found. Use --skip-url-check to bypass.')
      process.exit(2)
    }
  }

  console.log('[apply-enrichment] Validation passed. Executing...')

  try {
    // Determine project root (one level up from scripts/)
    const projectDir = path.resolve(path.dirname(absPath), '..')
    execSync(`npx dotenv-cli -e .env.local -- npx tsx "${absPath}"`, {
      cwd: projectDir,
      stdio: 'inherit',
      timeout: 120_000, // 2 minute timeout
    })
    console.log('[apply-enrichment] Execution completed successfully.')
  } catch (err: any) {
    console.error(`[apply-enrichment] Execution failed: ${err.message}`)
    process.exit(3)
  }
}

main().catch(err => { console.error(err); process.exit(1) })
