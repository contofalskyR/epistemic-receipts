-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "pageContext" TEXT,
    "email" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);
