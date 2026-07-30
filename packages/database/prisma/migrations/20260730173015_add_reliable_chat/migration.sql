-- CreateEnum
CREATE TYPE "ChatMessageType" AS ENUM ('USER', 'ADMIN', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ChatMessageVisibility" AS ENUM ('VISIBLE', 'HIDDEN');

-- CreateTable
CREATE TABLE "chat_rooms" (
    "id" TEXT NOT NULL,
    "live_id" TEXT NOT NULL,
    "next_sequence" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "chat_rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "client_message_id" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "type" "ChatMessageType" NOT NULL,
    "visibility" "ChatMessageVisibility" NOT NULL DEFAULT 'VISIBLE',
    "content" VARCHAR(500) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "chat_rooms_live_id_key" ON "chat_rooms"("live_id");

-- Existing broadcasts must also have a room before the first message is sent.
INSERT INTO "chat_rooms" ("id", "live_id", "next_sequence")
SELECT CONCAT('chat-', "id"), "id", 1
FROM "live_sessions"
ON CONFLICT ("live_id") DO NOTHING;

-- CreateIndex
CREATE UNIQUE INDEX "chat_messages_sender_id_client_message_id_key" ON "chat_messages"("sender_id", "client_message_id");

-- CreateIndex
CREATE UNIQUE INDEX "chat_messages_room_id_sequence_key" ON "chat_messages"("room_id", "sequence");

-- AddConstraint
ALTER TABLE "chat_rooms" ADD CONSTRAINT "chat_rooms_next_sequence_check" CHECK ("next_sequence" > 0);

-- AddForeignKey
ALTER TABLE "chat_rooms" ADD CONSTRAINT "chat_rooms_live_id_fkey" FOREIGN KEY ("live_id") REFERENCES "live_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "chat_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
