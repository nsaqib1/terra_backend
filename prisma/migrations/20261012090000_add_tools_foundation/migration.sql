CREATE TYPE "ToolCategory" AS ENUM ('DEVELOPER', 'PRODUCTIVITY', 'MEDIA', 'EDUCATION', 'ENGINEERING', 'OTHER');
CREATE TYPE "ToolType" AS ENUM ('CLIENT', 'SERVER', 'HYBRID');
CREATE TYPE "ToolStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'UNPUBLISHED', 'ARCHIVED');
CREATE TYPE "ToolVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

CREATE TABLE "Tool" (
  "id" UUID NOT NULL,
  "slug" VARCHAR(100) NOT NULL,
  "title" VARCHAR(150) NOT NULL,
  "description" TEXT,
  "thumbnailUrl" TEXT,
  "category" "ToolCategory" NOT NULL DEFAULT 'OTHER',
  "type" "ToolType" NOT NULL DEFAULT 'CLIENT',
  "status" "ToolStatus" NOT NULL DEFAULT 'DRAFT',
  "currentVersionId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "Tool_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Tool_slug_key" ON "Tool"("slug");
CREATE INDEX "Tool_status_idx" ON "Tool"("status");
CREATE INDEX "Tool_category_status_idx" ON "Tool"("category", "status");
CREATE INDEX "Tool_type_status_idx" ON "Tool"("type", "status");
CREATE INDEX "Tool_deletedAt_idx" ON "Tool"("deletedAt");

CREATE TABLE "ToolVersion" (
  "id" UUID NOT NULL,
  "toolId" UUID NOT NULL,
  "version" VARCHAR(50) NOT NULL,
  "buildPath" TEXT,
  "status" "ToolVersionStatus" NOT NULL DEFAULT 'DRAFT',
  "releaseNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "publishedAt" TIMESTAMP(3),
  CONSTRAINT "ToolVersion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ToolVersion_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "Tool"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ToolVersion_toolId_version_key" ON "ToolVersion"("toolId", "version");
CREATE INDEX "ToolVersion_toolId_status_idx" ON "ToolVersion"("toolId", "status");
CREATE INDEX "ToolVersion_toolId_createdAt_idx" ON "ToolVersion"("toolId", "createdAt");

CREATE TABLE "ToolCommunity" (
  "toolId" UUID NOT NULL,
  "communityId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ToolCommunity_pkey" PRIMARY KEY ("toolId", "communityId"),
  CONSTRAINT "ToolCommunity_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "Tool"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ToolCommunity_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ToolCommunity_communityId_idx" ON "ToolCommunity"("communityId");
