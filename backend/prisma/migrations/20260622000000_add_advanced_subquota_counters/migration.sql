-- AlterTable
ALTER TABLE "daily_usage" ADD COLUMN     "opus_turns" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sonnet_turns" INTEGER NOT NULL DEFAULT 0;
