-- AlterTable
ALTER TABLE "Topic" ADD COLUMN     "academicFieldId" INTEGER;

-- CreateIndex
CREATE INDEX "Topic_academicFieldId_idx" ON "Topic"("academicFieldId");

-- AddForeignKey
ALTER TABLE "Topic" ADD CONSTRAINT "Topic_academicFieldId_fkey" FOREIGN KEY ("academicFieldId") REFERENCES "AcademicField"("id") ON DELETE SET NULL ON UPDATE CASCADE;
