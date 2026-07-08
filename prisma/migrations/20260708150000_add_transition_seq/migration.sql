-- Explicit per-claim transition order (ORDERING-SEMANTICS-2026-07-08.md, Option B).
-- seq is assigned by lib/transition-contract inside the insert transaction;
-- prepend/amendBaseline paths renumber the claim's rows in the same transaction.
-- Nullable: legacy rows are stamped by scripts/backfill-transition-seq.ts.
-- NULLs are distinct under the unique index, so set-NULL-then-assign renumbering
-- never collides transiently.

-- AlterTable
ALTER TABLE "ClaimStatusHistory" ADD COLUMN IF NOT EXISTS "seq" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ClaimStatusHistory_claimId_seq_key" ON "ClaimStatusHistory"("claimId", "seq");
