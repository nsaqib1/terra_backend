-- AlterEnum
ALTER TYPE "MediaStatus" ADD VALUE 'TEMPORARY';

-- AlterTable
ALTER TABLE "Media" ADD COLUMN     "originalFilename" VARCHAR(255);
