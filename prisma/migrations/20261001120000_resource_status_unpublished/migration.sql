-- Rename ARCHIVED to UNPUBLISHED in ResourceStatus enum
-- Step 1: Add new value to enum
ALTER TYPE "ResourceStatus" ADD VALUE 'UNPUBLISHED';

-- Step 2: Update existing ARCHIVED rows to UNPUBLISHED
UPDATE "Resource" SET "status" = 'UNPUBLISHED' WHERE "status" = 'ARCHIVED';
