-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM (
    'POST_UPVOTED',
    'COMMENT_UPVOTED',
    'POST_COMMENTED',
    'COMMENT_REPLIED'
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "recipientId" UUID NOT NULL,
    "actorId" UUID,
    "type" "NotificationType" NOT NULL,
    "postId" UUID,
    "commentId" UUID,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_recipientId_createdAt_id_idx" ON "Notification"("recipientId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Notification_recipientId_readAt_idx" ON "Notification"("recipientId", "readAt");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "Comment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
