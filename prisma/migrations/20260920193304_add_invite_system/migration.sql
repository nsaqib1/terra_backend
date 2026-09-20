-- CreateTable
CREATE TABLE "Invite" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "label" VARCHAR(100),
    "maxUses" INTEGER NOT NULL DEFAULT 1,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InviteUsage" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inviteId" UUID NOT NULL,

    CONSTRAINT "InviteUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Invite_code_key" ON "Invite"("code");

-- CreateIndex
CREATE INDEX "Invite_code_idx" ON "Invite"("code");

-- CreateIndex
CREATE INDEX "Invite_isActive_idx" ON "Invite"("isActive");

-- CreateIndex
CREATE INDEX "Invite_createdById_idx" ON "Invite"("createdById");

-- CreateIndex
CREATE INDEX "Invite_createdAt_idx" ON "Invite"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "InviteUsage_userId_key" ON "InviteUsage"("userId");

-- CreateIndex
CREATE INDEX "InviteUsage_inviteId_idx" ON "InviteUsage"("inviteId");

-- CreateIndex
CREATE INDEX "InviteUsage_userId_idx" ON "InviteUsage"("userId");

-- AddForeignKey
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InviteUsage" ADD CONSTRAINT "InviteUsage_inviteId_fkey" FOREIGN KEY ("inviteId") REFERENCES "Invite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InviteUsage" ADD CONSTRAINT "InviteUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
