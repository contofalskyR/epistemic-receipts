-- AlterTable
ALTER TABLE "Claim" ADD COLUMN     "academicFieldId" INTEGER;

-- CreateTable
CREATE TABLE "AcademicField" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "parentId" INTEGER,
    "level" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AcademicField_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AcademicField_slug_key" ON "AcademicField"("slug");

-- CreateIndex
CREATE INDEX "AcademicField_parentId_idx" ON "AcademicField"("parentId");

-- CreateIndex
CREATE INDEX "AcademicField_level_idx" ON "AcademicField"("level");

-- CreateIndex
CREATE INDEX "Claim_academicFieldId_idx" ON "Claim"("academicFieldId");

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_academicFieldId_fkey" FOREIGN KEY ("academicFieldId") REFERENCES "AcademicField"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicField" ADD CONSTRAINT "AcademicField_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "AcademicField"("id") ON DELETE SET NULL ON UPDATE CASCADE;
