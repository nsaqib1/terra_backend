CREATE TYPE "ResourceStatus" AS ENUM ('PUBLISHED', 'ARCHIVED');

CREATE TABLE "Resource" (
    "id" UUID NOT NULL,
    "communityId" UUID NOT NULL,
    "uploadedById" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "originalFilename" VARCHAR(255) NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" VARCHAR(150) NOT NULL,
    "size" BIGINT NOT NULL,
    "status" "ResourceStatus" NOT NULL DEFAULT 'PUBLISHED',
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "Resource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ResourceTagDefinition" (
    "id" UUID NOT NULL,
    "communityId" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "status" "TagStatus" NOT NULL DEFAULT 'ACTIVE',
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ResourceTagDefinition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ResourceTag" (
    "resourceId" UUID NOT NULL,
    "tagId" UUID NOT NULL,
    CONSTRAINT "ResourceTag_pkey" PRIMARY KEY ("resourceId", "tagId")
);

CREATE INDEX "Resource_communityId_createdAt_idx" ON "Resource"("communityId", "createdAt");
CREATE INDEX "Resource_communityId_status_createdAt_idx" ON "Resource"("communityId", "status", "createdAt");
CREATE INDEX "Resource_communityId_downloadCount_idx" ON "Resource"("communityId", "downloadCount");
CREATE INDEX "Resource_uploadedById_idx" ON "Resource"("uploadedById");
CREATE INDEX "Resource_status_idx" ON "Resource"("status");
CREATE INDEX "Resource_deletedAt_idx" ON "Resource"("deletedAt");
CREATE UNIQUE INDEX "ResourceTagDefinition_communityId_slug_key" ON "ResourceTagDefinition"("communityId", "slug");
CREATE INDEX "ResourceTagDefinition_communityId_idx" ON "ResourceTagDefinition"("communityId");
CREATE INDEX "ResourceTagDefinition_communityId_status_idx" ON "ResourceTagDefinition"("communityId", "status");
CREATE INDEX "ResourceTagDefinition_communityId_usageCount_idx" ON "ResourceTagDefinition"("communityId", "usageCount");
CREATE INDEX "ResourceTag_tagId_idx" ON "ResourceTag"("tagId");

ALTER TABLE "Resource" ADD CONSTRAINT "Resource_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ResourceTagDefinition" ADD CONSTRAINT "ResourceTagDefinition_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ResourceTag" ADD CONSTRAINT "ResourceTag_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResourceTag" ADD CONSTRAINT "ResourceTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "ResourceTagDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
