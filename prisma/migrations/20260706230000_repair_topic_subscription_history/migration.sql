-- Repair: "TopicSubscription" was created in production via `prisma db push`
-- (June 2026, topic-alerts feature) and never captured in the migration
-- history — no migration in the folder creates it. Every fresh replay
-- (CI shadow DB, `migrate dev`, a new dev database) therefore failed at
-- 20260707050000_spec31_researcher_features, which ALTERs this table.
--
-- This migration recreates the table exactly as it existed BEFORE spec31
-- (spec31 then adds "userId", "frequency", the userId index, and the FK).
-- Every statement is guarded, so on databases where the table already
-- exists (production) this applies as a clean no-op.

CREATE TABLE IF NOT EXISTS "TopicSubscription" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "topicKeyword" TEXT NOT NULL,
    "topicLabel" TEXT NOT NULL,
    "unsubscribeToken" TEXT NOT NULL,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAlertAt" TIMESTAMP(3),

    CONSTRAINT "TopicSubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TopicSubscription_unsubscribeToken_key"
    ON "TopicSubscription"("unsubscribeToken");

CREATE UNIQUE INDEX IF NOT EXISTS "TopicSubscription_email_topicKeyword_key"
    ON "TopicSubscription"("email", "topicKeyword");

CREATE INDEX IF NOT EXISTS "TopicSubscription_topicKeyword_idx"
    ON "TopicSubscription"("topicKeyword");
