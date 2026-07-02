/**
 * apply-enrichment.ts
 *
 * Validates and executes a Claude-generated enrichment TypeScript file.
 * The enrichment file is a standalone tsx script that imports Prisma and
 * upserts ClaimStatusHistory rows for an existing claim.
 *
 * Usage:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/apply-enrichment.ts <path-to-enrichment.ts>
 *
 * Validation checks:
 *   1. File exists and is non-empty
 *   2. Contains required imports (dotenv, PrismaClient)
 *   3. Contains $disconnect() call (cleanup)
 *   4. Does NOT contain dangerous patterns (DROP, DELETE, truncate, exec, eval)
 *   5. Contains claimStatusHistory upsert calls
 *
 * If validation passes, executes the file via a child process with tsx.
 */

import * as fs from 'fs'
import * as path from 'path'
import { execSync } from 'child_process'

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

// ── Main ──────────────────────────────────────────────────────────────────────

function main() {
  const filePath = process.argv[2]
  if (!filePath) {
    console.error('Usage: npx tsx scripts/apply-enrichment.ts <path-to-enrichment.ts>')
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

main()
