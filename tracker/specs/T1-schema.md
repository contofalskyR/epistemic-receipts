# T1 — Tracker schema (additive migration)

**Size:** ~1 session. **Depends on:** nothing. **Blocks:** everything else.

## Objective

Add the tracker's own tables to `prisma/schema.prisma` + one hand-authored
migration, in lockstep (the CI drift gate passes when schema and migration
agree — see the seq migration `20260708150000_add_transition_seq` as the
worked example, and AGENTS.md for why you never touch prisma.config.ts or
applied migrations).

## Models (adjust nullability judgment, keep names)

```prisma
model Thread {
  id                  String   @id @default(cuid())
  question            String        // one falsifiable question
  resolutionCriteria  Json          // {resolved_yes, resolved_no, moot}
  knownPendingTrigger Json          // {exists, description, date?}
  importance          Float    @default(0.5)
  domain              String        // "us-immigration" for MVP
  venue               String?       // eoir | federal_court | agency | congress | none — drives T3 dormancy floors
  gdeltQuery          String        // the GDELT DOC 2.0 query for this thread's coverage
  activityRefs        Json?         // {billIds:[], docketIds:[], frDocketNos:[]} — T4 feeds
  coverageCurve       Json?         // latest timelinevol snapshot + cached peakDate
  status              String   @default("STALLED") // denormalized latest; history is truth
  storylineId         String?
  parentThreadId      String?
  archived            Boolean  @default(false)
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  events         ThreadEvent[]
  statusHistory  ThreadStatusHistory[]
  keyFacts       ThreadKeyFact[]
  activitySignals ThreadActivitySignal[]

  @@index([domain, status])
}

model ThreadEvent {
  id         String   @id @default(cuid())
  threadId   String
  thread     Thread   @relation(fields: [threadId], references: [id], onDelete: Cascade)
  articleId  String        // GDELT/article identifier
  date       DateTime      // event date, not ingest
  eventType  String        // merits | procedural | substantive | noise
  isMaterial Boolean
  whatMoved  String
  sourceUrl  String?
  createdAt  DateTime @default(now())

  @@index([threadId, date])
}

model ThreadStatusHistory {
  id               String   @id @default(cuid())
  threadId         String
  thread           Thread   @relation(fields: [threadId], references: [id], onDelete: Cascade)
  status           String        // OPEN | STALLED | RESOLVED | ORPHANED
  reason           String        // human-readable, from computeStatus/guards
  guardsApplied    Json?         // T3: which pre-filters/floors fired
  lastMaterialDate DateTime?
  lastCoverageDate DateTime?
  llmEvidence      Json?         // full LlmOutput for audit
  computedAt       DateTime @default(now())

  @@index([threadId, computedAt])
}

model ThreadKeyFact {
  id        String   @id @default(cuid())
  threadId  String
  thread    Thread   @relation(fields: [threadId], references: [id], onDelete: Cascade)
  fact      String
  sourceUrl String?
  asOf      DateTime
}

model ThreadActivitySignal {
  id          String   @id @default(cuid())
  threadId    String
  thread      Thread   @relation(fields: [threadId], references: [id], onDelete: Cascade)
  feed        String        // congress | courtlistener | federal_register
  eventDate   DateTime
  description String
  raw         Json?
  createdAt   DateTime @default(now())

  @@index([threadId, feed, eventDate])
}
```

## Steps

1. Append models to schema.prisma (keep the file's comment style — one line
   above each model saying what it is and that thread statuses are NOT
   ClaimStatusHistory, pointer to briefings/12).
2. Hand-author `prisma/migrations/<stamp>_add_thread_tracker/migration.sql`
   (stamp AFTER the latest applied folder; `IF NOT EXISTS` on tables/indexes,
   house style). Foreign keys with ON DELETE CASCADE to match the schema.
3. Robert runs: `npx prisma generate`, then
   `npx dotenv-cli -e .env.local -- npx prisma migrate deploy`.

## Acceptance criteria (paste verification output)

- `npx tsc -p tsconfig.json --noEmit` → 0 errors after generate.
- `git status` shows schema + migration in the SAME commit.
- A scratch read via a tiny tsx script confirms `prisma.thread.count()` → 0
  against prod (proves migration applied + client types live).
- Existing audits untouched: `audit-chain-integrity.ts --pipeline
  nz_repealed_acts_v1` still green (nothing here touches claim tables).

## Do not

- Touch ClaimStatusHistory, the contract, or the drift allowlist.
- Add thread rows yet — authoring happens in T6 (or a seed script in T5's
  pilot).
