/*
  Warnings:

  - The values [ARCHIVED] on the enum `ResourceStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- CreateEnum
CREATE TYPE "GameCategory" AS ENUM ('ENTERTAINMENT', 'LEARNING', 'SIMULATION');

-- CreateEnum
CREATE TYPE "GameType" AS ENUM ('SINGLE_PLAYER', 'MULTIPLAYER');

-- CreateEnum
CREATE TYPE "GameStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'UNPUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "GameVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "GameSessionStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'EXPIRED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "GameScorePeriod" AS ENUM ('WEEK', 'MONTH');

-- AlterEnum
BEGIN;
CREATE TYPE "ResourceStatus_new" AS ENUM ('PUBLISHED', 'UNPUBLISHED');
ALTER TABLE "public"."Resource" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Resource" ALTER COLUMN "status" TYPE "ResourceStatus_new" USING ("status"::text::"ResourceStatus_new");
ALTER TYPE "ResourceStatus" RENAME TO "ResourceStatus_old";
ALTER TYPE "ResourceStatus_new" RENAME TO "ResourceStatus";
DROP TYPE "public"."ResourceStatus_old";
ALTER TABLE "Resource" ALTER COLUMN "status" SET DEFAULT 'PUBLISHED';
COMMIT;

-- CreateTable
CREATE TABLE "Game" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "thumbnailUrl" TEXT,
    "category" "GameCategory" NOT NULL DEFAULT 'ENTERTAINMENT',
    "type" "GameType" NOT NULL DEFAULT 'SINGLE_PLAYER',
    "status" "GameStatus" NOT NULL DEFAULT 'DRAFT',
    "scoreEnabled" BOOLEAN NOT NULL DEFAULT false,
    "leaderboardEnabled" BOOLEAN NOT NULL DEFAULT false,
    "currentVersionId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameVersion" (
    "id" UUID NOT NULL,
    "gameId" UUID NOT NULL,
    "version" VARCHAR(50) NOT NULL,
    "buildPath" TEXT NOT NULL,
    "status" "GameVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "releaseNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "GameVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameCommunity" (
    "gameId" UUID NOT NULL,
    "communityId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameCommunity_pkey" PRIMARY KEY ("gameId","communityId")
);

-- CreateTable
CREATE TABLE "GameSession" (
    "id" UUID NOT NULL,
    "gameId" UUID NOT NULL,
    "gameVersionId" UUID NOT NULL,
    "userId" UUID,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "status" "GameSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameScore" (
    "id" UUID NOT NULL,
    "gameId" UUID NOT NULL,
    "gameVersionId" UUID NOT NULL,
    "gameSessionId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "score" INTEGER NOT NULL,
    "periodType" "GameScorePeriod" NOT NULL,
    "periodKey" VARCHAR(20) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameScore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Game_slug_key" ON "Game"("slug");

-- CreateIndex
CREATE INDEX "Game_status_idx" ON "Game"("status");

-- CreateIndex
CREATE INDEX "Game_category_status_idx" ON "Game"("category", "status");

-- CreateIndex
CREATE INDEX "Game_type_status_idx" ON "Game"("type", "status");

-- CreateIndex
CREATE INDEX "Game_deletedAt_idx" ON "Game"("deletedAt");

-- CreateIndex
CREATE INDEX "GameVersion_gameId_status_idx" ON "GameVersion"("gameId", "status");

-- CreateIndex
CREATE INDEX "GameVersion_gameId_createdAt_idx" ON "GameVersion"("gameId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "GameVersion_gameId_version_key" ON "GameVersion"("gameId", "version");

-- CreateIndex
CREATE INDEX "GameCommunity_communityId_idx" ON "GameCommunity"("communityId");

-- CreateIndex
CREATE INDEX "GameSession_gameId_createdAt_idx" ON "GameSession"("gameId", "createdAt");

-- CreateIndex
CREATE INDEX "GameSession_gameVersionId_idx" ON "GameSession"("gameVersionId");

-- CreateIndex
CREATE INDEX "GameSession_userId_createdAt_idx" ON "GameSession"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "GameSession_status_expiresAt_idx" ON "GameSession"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "GameScore_gameSessionId_key" ON "GameScore"("gameSessionId");

-- CreateIndex
CREATE INDEX "GameScore_gameId_periodType_periodKey_score_idx" ON "GameScore"("gameId", "periodType", "periodKey", "score");

-- CreateIndex
CREATE INDEX "GameScore_gameId_userId_score_idx" ON "GameScore"("gameId", "userId", "score");

-- CreateIndex
CREATE INDEX "GameScore_gameSessionId_idx" ON "GameScore"("gameSessionId");

-- CreateIndex
CREATE INDEX "GameScore_userId_createdAt_idx" ON "GameScore"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "GameVersion" ADD CONSTRAINT "GameVersion_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameCommunity" ADD CONSTRAINT "GameCommunity_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameCommunity" ADD CONSTRAINT "GameCommunity_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_gameVersionId_fkey" FOREIGN KEY ("gameVersionId") REFERENCES "GameVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameScore" ADD CONSTRAINT "GameScore_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameScore" ADD CONSTRAINT "GameScore_gameVersionId_fkey" FOREIGN KEY ("gameVersionId") REFERENCES "GameVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameScore" ADD CONSTRAINT "GameScore_gameSessionId_fkey" FOREIGN KEY ("gameSessionId") REFERENCES "GameSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameScore" ADD CONSTRAINT "GameScore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
