-- ClaimSubscription: claim-level follow with TopicSubscription's consent mechanics.
CREATE TABLE "ClaimSubscription" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "unsubscribeToken" TEXT NOT NULL,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAlertAt" TIMESTAMP(3),
    "frequency" TEXT NOT NULL DEFAULT 'weekly',
    "userId" TEXT,

    CONSTRAINT "ClaimSubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClaimSubscription_unsubscribeToken_key" ON "ClaimSubscription"("unsubscribeToken");
CREATE UNIQUE INDEX "ClaimSubscription_email_claimId_key" ON "ClaimSubscription"("email", "claimId");
CREATE INDEX "ClaimSubscription_claimId_idx" ON "ClaimSubscription"("claimId");
CREATE INDEX "ClaimSubscription_userId_idx" ON "ClaimSubscription"("userId");

ALTER TABLE "ClaimSubscription" ADD CONSTRAINT "ClaimSubscription_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClaimSubscription" ADD CONSTRAINT "ClaimSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
