-- AlterEnum
ALTER TYPE "LiveStatus" ADD VALUE IF NOT EXISTS 'DRAFT' BEFORE 'READY';
ALTER TYPE "LiveStatus" ADD VALUE IF NOT EXISTS 'SCHEDULED' AFTER 'DRAFT';
ALTER TYPE "LiveStatus" ADD VALUE IF NOT EXISTS 'CANCELLED' AFTER 'ENDED';

-- AlterTable
ALTER TABLE "live_sessions"
  ADD COLUMN "description" TEXT,
  ADD COLUMN "thumbnail_url" TEXT,
  ADD COLUMN "scheduled_start_at" TIMESTAMP(3),
  ADD COLUMN "created_by_user_id" TEXT,
  ADD COLUMN "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Existing demo rows may predate an administrator record, so the creator is nullable for
-- compatibility. Every new draft is created with an authenticated administrator as its creator.
ALTER TABLE "live_sessions"
  ADD CONSTRAINT "live_sessions_title_length_check" CHECK (char_length("title") BETWEEN 1 AND 100),
  ADD CONSTRAINT "live_sessions_description_length_check" CHECK (
    "description" IS NULL OR char_length("description") <= 500
  );

-- CreateIndex
CREATE INDEX "live_sessions_status_scheduled_start_at_idx"
  ON "live_sessions"("status", "scheduled_start_at");
CREATE INDEX "live_sessions_created_by_user_id_created_at_idx"
  ON "live_sessions"("created_by_user_id", "created_at");

-- AddForeignKey
ALTER TABLE "live_sessions"
  ADD CONSTRAINT "live_sessions_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
