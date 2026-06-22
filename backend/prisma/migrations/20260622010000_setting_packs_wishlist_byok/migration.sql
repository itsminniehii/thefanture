-- AlterEnum: rename the top tier (PRO → ADVANCED, data-preserving) and add MID.
ALTER TYPE "Plan" RENAME VALUE 'PRO' TO 'ADVANCED';
ALTER TYPE "Plan" ADD VALUE 'MID';

-- CreateEnum
CREATE TYPE "WishlistStatus" AS ENUM ('RECEIVED', 'IN_PRODUCTION', 'PUBLISHED', 'DECLINED');

-- AlterTable: drop the now-dead preferred_model, add encrypted BYOK key
ALTER TABLE "users" DROP COLUMN "preferred_model",
ADD COLUMN     "byok_key_encrypted" TEXT;

-- CreateTable
CREATE TABLE "user_setting_packs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "world_id" TEXT NOT NULL,
    "player_background" VARCHAR(1000),
    "custom_characters" VARCHAR(2000),
    "term_dictionary" VARCHAR(2000),
    "difficulty" VARCHAR(50),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_setting_packs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wishlist" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "topic" VARCHAR(100) NOT NULL,
    "content" VARCHAR(2000) NOT NULL,
    "status" "WishlistStatus" NOT NULL DEFAULT 'RECEIVED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wishlist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_setting_packs_user_id_world_id_key" ON "user_setting_packs"("user_id", "world_id");

-- AddForeignKey
ALTER TABLE "user_setting_packs" ADD CONSTRAINT "user_setting_packs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_setting_packs" ADD CONSTRAINT "user_setting_packs_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "worlds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlist" ADD CONSTRAINT "wishlist_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
