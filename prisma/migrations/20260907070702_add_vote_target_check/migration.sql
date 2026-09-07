ALTER TABLE "Vote"
ADD CONSTRAINT "Vote_target_check"
CHECK (
  ("postId" IS NOT NULL AND "commentId" IS NULL)
  OR
  ("postId" IS NULL AND "commentId" IS NOT NULL)
);