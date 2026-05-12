-- AlterTable
ALTER TABLE "Claim" ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "verificationStatus" TEXT;
