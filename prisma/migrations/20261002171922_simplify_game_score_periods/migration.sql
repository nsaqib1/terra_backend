/*
  Warnings:

  - You are about to drop the column `periodKey` on the `GameScore` table. All the data in the column will be lost.
  - You are about to drop the column `periodType` on the `GameScore` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "GameScore_gameId_periodType_periodKey_score_idx";

-- DropIndex
DROP INDEX "GameScore_gameSessionId_idx";

-- AlterTable
ALTER TABLE "GameScore" DROP COLUMN "periodKey",
DROP COLUMN "periodType";

-- DropEnum
DROP TYPE "GameScorePeriod";

-- CreateIndex
CREATE INDEX "GameScore_gameId_createdAt_score_idx" ON "GameScore"("gameId", "createdAt", "score");
