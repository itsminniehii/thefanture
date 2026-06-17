/*
  Warnings:

  - You are about to drop the column `state_json` on the `saves` table. All the data in the column will be lost.
  - Added the required column `recent_turns` to the `saves` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "SaveKind" AS ENUM ('MANUAL', 'AUTO');

-- AlterTable
ALTER TABLE "saves" DROP COLUMN "state_json",
ADD COLUMN     "content_json" JSONB,
ADD COLUMN     "kind" "SaveKind" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "recent_turns" JSONB NOT NULL,
ADD COLUMN     "rendered" TEXT,
ALTER COLUMN "label" SET DEFAULT '存檔',
ALTER COLUMN "ciphertext_b64" DROP NOT NULL,
ALTER COLUMN "iv_b64" DROP NOT NULL,
ALTER COLUMN "wrapped_key_b64" DROP NOT NULL,
ALTER COLUMN "recovery_key_b64" DROP NOT NULL;

-- AlterTable
ALTER TABLE "worlds" ADD COLUMN     "save_template" JSONB;

-- CreateIndex
CREATE INDEX "saves_user_id_world_id_idx" ON "saves"("user_id", "world_id");
