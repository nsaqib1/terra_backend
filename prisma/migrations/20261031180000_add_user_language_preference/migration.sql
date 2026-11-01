CREATE TYPE "Language" AS ENUM ('EN', 'BN');

ALTER TABLE "User"
ADD COLUMN "preferredLanguage" "Language" NOT NULL DEFAULT 'EN';
