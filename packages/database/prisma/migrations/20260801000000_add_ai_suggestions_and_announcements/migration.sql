CREATE TYPE "AiSuggestionType" AS ENUM ('CHAT_SUMMARY');

CREATE TYPE "AiSuggestionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "ai_suggestions" (
  "id" TEXT NOT NULL,
  "live_id" TEXT NOT NULL,
  "type" "AiSuggestionType" NOT NULL,
  "provider" VARCHAR(64) NOT NULL,
  "model_or_mock_version" VARCHAR(128) NOT NULL,
  "input_hash" VARCHAR(64) NOT NULL,
  "output_json" JSONB NOT NULL,
  "status" "AiSuggestionStatus" NOT NULL DEFAULT 'PENDING',
  "reviewed_by" TEXT,
  "reviewed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ai_suggestions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ai_suggestions_review_state_check" CHECK (
    ("status" = 'PENDING' AND "reviewed_by" IS NULL AND "reviewed_at" IS NULL)
    OR ("status" <> 'PENDING' AND "reviewed_by" IS NOT NULL AND "reviewed_at" IS NOT NULL)
  )
);

CREATE TABLE "announcements" (
  "id" TEXT NOT NULL,
  "live_id" TEXT NOT NULL,
  "content" VARCHAR(500) NOT NULL,
  "created_by" TEXT NOT NULL,
  "source_suggestion_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- The operator lists the newest suggestions for one live, while review history remains auditable.
CREATE INDEX "ai_suggestions_live_id_created_at_idx"
ON "ai_suggestions"("live_id", "created_at");

CREATE INDEX "ai_suggestions_reviewed_by_idx"
ON "ai_suggestions"("reviewed_by");

-- The viewer snapshot reads the most recent persisted announcement for the current live.
CREATE INDEX "announcements_live_id_created_at_idx"
ON "announcements"("live_id", "created_at");

CREATE INDEX "announcements_created_by_idx"
ON "announcements"("created_by");

CREATE UNIQUE INDEX "announcements_source_suggestion_id_key"
ON "announcements"("source_suggestion_id");

ALTER TABLE "ai_suggestions"
  ADD CONSTRAINT "ai_suggestions_live_id_fkey"
  FOREIGN KEY ("live_id") REFERENCES "live_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ai_suggestions_reviewed_by_fkey"
  FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "announcements"
  ADD CONSTRAINT "announcements_live_id_fkey"
  FOREIGN KEY ("live_id") REFERENCES "live_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "announcements_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "announcements_source_suggestion_id_fkey"
  FOREIGN KEY ("source_suggestion_id") REFERENCES "ai_suggestions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
