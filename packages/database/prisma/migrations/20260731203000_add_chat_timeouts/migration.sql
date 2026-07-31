-- CreateTable
CREATE TABLE "chat_timeouts" (
    "id" TEXT NOT NULL,
    "live_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "reason" VARCHAR(300) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_timeouts_pkey" PRIMARY KEY ("id")
);

-- The message-write path looks up the latest unexpired timeout for one viewer in one broadcast.
CREATE INDEX "chat_timeouts_live_id_user_id_expires_at_idx"
ON "chat_timeouts"("live_id", "user_id", "expires_at");

-- AddForeignKey
ALTER TABLE "chat_timeouts" ADD CONSTRAINT "chat_timeouts_live_id_fkey"
FOREIGN KEY ("live_id") REFERENCES "live_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_timeouts" ADD CONSTRAINT "chat_timeouts_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_timeouts" ADD CONSTRAINT "chat_timeouts_actor_id_fkey"
FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
