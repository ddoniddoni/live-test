-- CreateTable
CREATE TABLE "live_products" (
  "live_id" TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  "display_order" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "live_products_pkey" PRIMARY KEY ("live_id", "product_id"),
  CONSTRAINT "live_products_display_order_check" CHECK ("display_order" >= 0)
);

-- CreateIndex
CREATE UNIQUE INDEX "live_products_live_id_display_order_key"
  ON "live_products"("live_id", "display_order");
CREATE INDEX "live_products_product_id_idx" ON "live_products"("product_id");

-- Preserve the current demo behavior for sessions that existed before broadcast-level
-- product preparation. New broadcasts start without products and must be configured by an admin.
INSERT INTO "live_products" ("live_id", "product_id", "display_order")
SELECT
  "live_sessions"."id",
  "products"."id",
  ROW_NUMBER() OVER (
    PARTITION BY "live_sessions"."id"
    ORDER BY "products"."id"
  ) - 1
FROM "live_sessions"
CROSS JOIN "products"
WHERE "live_sessions"."status" IN ('READY', 'LIVE', 'ENDED')
ON CONFLICT ("live_id", "product_id") DO NOTHING;

-- AddForeignKey
ALTER TABLE "live_products"
  ADD CONSTRAINT "live_products_live_id_fkey"
  FOREIGN KEY ("live_id") REFERENCES "live_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "live_products"
  ADD CONSTRAINT "live_products_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
