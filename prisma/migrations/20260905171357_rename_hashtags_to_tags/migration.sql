/*
  Warnings:

  - You are about to drop the `Hashtag` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PostHashtag` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "TagStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- DropForeignKey
ALTER TABLE "Hashtag" DROP CONSTRAINT "Hashtag_communityId_fkey";

-- DropForeignKey
ALTER TABLE "PostHashtag" DROP CONSTRAINT "PostHashtag_hashtagId_fkey";

-- DropForeignKey
ALTER TABLE "PostHashtag" DROP CONSTRAINT "PostHashtag_postId_fkey";

-- DropTable
DROP TABLE "Hashtag";

-- DropTable
DROP TABLE "PostHashtag";

-- DropEnum
DROP TYPE "HashtagStatus";

-- CreateTable
CREATE TABLE "Tag" (
    "id" UUID NOT NULL,
    "communityId" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "status" "TagStatus" NOT NULL DEFAULT 'ACTIVE',
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostTag" (
    "postId" UUID NOT NULL,
    "tagId" UUID NOT NULL,

    CONSTRAINT "PostTag_pkey" PRIMARY KEY ("postId","tagId")
);

-- CreateIndex
CREATE INDEX "Tag_communityId_idx" ON "Tag"("communityId");

-- CreateIndex
CREATE INDEX "Tag_communityId_status_idx" ON "Tag"("communityId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_communityId_slug_key" ON "Tag"("communityId", "slug");

-- CreateIndex
CREATE INDEX "PostTag_tagId_idx" ON "PostTag"("tagId");

-- AddForeignKey
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostTag" ADD CONSTRAINT "PostTag_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostTag" ADD CONSTRAINT "PostTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
