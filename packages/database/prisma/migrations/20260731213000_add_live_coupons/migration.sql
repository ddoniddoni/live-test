-- CreateEnum
CREATE TYPE "CouponType" AS ENUM ('PERCENT', 'FIXED');

-- CreateEnum
CREATE TYPE "CouponStatus" AS ENUM ('PUBLISHED', 'DISABLED');

-- CreateTable
CREATE TABLE "coupons" (
    "id" TEXT NOT NULL,
    "live_id" TEXT NOT NULL,
    "type" "CouponType" NOT NULL,
    "value" INTEGER NOT NULL CHECK ("value" > 0),
    "min_order_amount_krw" INTEGER NOT NULL DEFAULT 0 CHECK ("min_order_amount_krw" >= 0),
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "usage_limit" INTEGER CHECK ("usage_limit" IS NULL OR "usage_limit" > 0),
    "used_count" INTEGER NOT NULL DEFAULT 0 CHECK ("used_count" >= 0),
    "status" "CouponStatus" NOT NULL DEFAULT 'PUBLISHED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "coupons_valid_percent_value_check" CHECK ("type" <> 'PERCENT' OR "value" <= 100),
    CONSTRAINT "coupons_valid_window_check" CHECK ("ends_at" > "starts_at")
);

-- The live snapshot fetches the current published coupon by broadcast and time window.
CREATE INDEX "coupons_live_id_status_starts_at_ends_at_idx"
ON "coupons"("live_id", "status", "starts_at", "ends_at");

-- AddForeignKey
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_live_id_fkey"
FOREIGN KEY ("live_id") REFERENCES "live_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
