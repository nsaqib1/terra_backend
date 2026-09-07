/*
  Warnings:

  - You are about to drop the column `reputation` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `ReputationEvent` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "PointEventType" AS ENUM ('DAILY_VISIT', 'POST_CREATED', 'COMMENT_CREATED', 'POST_UPVOTED', 'COMMENT_UPVOTED', 'SYSTEM');

-- CreateEnum
CREATE TYPE "PointSourceType" AS ENUM ('POST', 'COMMENT', 'VOTE', 'SYSTEM');

-- DropForeignKey
ALTER TABLE "ReputationEvent" DROP CONSTRAINT "ReputationEvent_userId_fkey";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "reputation",
ADD COLUMN     "points" INTEGER NOT NULL DEFAULT 0;

-- DropTable
DROP TABLE "ReputationEvent";

-- CreateTable
CREATE TABLE "PointEvent" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "PointEventType" NOT NULL,
    "points" INTEGER NOT NULL,
    "sourceType" "PointSourceType" NOT NULL,
    "sourceId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PointEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyVisit" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "visitDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyVisit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PointEvent_userId_createdAt_idx" ON "PointEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PointEvent_type_idx" ON "PointEvent"("type");

-- CreateIndex
CREATE INDEX "PointEvent_sourceType_sourceId_idx" ON "PointEvent"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "DailyVisit_userId_visitDate_idx" ON "DailyVisit"("userId", "visitDate");

-- CreateIndex
CREATE UNIQUE INDEX "DailyVisit_userId_visitDate_key" ON "DailyVisit"("userId", "visitDate");

-- AddForeignKey
ALTER TABLE "PointEvent" ADD CONSTRAINT "PointEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyVisit" ADD CONSTRAINT "DailyVisit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
