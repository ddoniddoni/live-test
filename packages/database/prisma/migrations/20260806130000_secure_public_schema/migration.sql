-- LiveFlow accesses PostgreSQL only through the NestJS server and Prisma.
-- There are deliberately no Data API policies: anon/authenticated requests must be denied.
-- The runtime `postgres` role owns these tables and bypasses RLS, while browser roles do not.

ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai_suggestions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "announcements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "chat_messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "chat_rooms" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "chat_timeouts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "coupons" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "live_products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "live_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "order_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "product_variants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "realtime_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;

-- Revoke the Supabase Data API roles now and for tables, sequences, and functions
-- created by future Prisma migrations. The Data API is disabled as the primary control;
-- these revocations and RLS are defense in depth if it is enabled accidentally.
REVOKE ALL PRIVILEGES ON SCHEMA "public" FROM "anon", "authenticated", PUBLIC;
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA "public" FROM "anon", "authenticated", PUBLIC;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA "public" FROM "anon", "authenticated", PUBLIC;
REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA "public" FROM "anon", "authenticated", PUBLIC;

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public"
  REVOKE ALL PRIVILEGES ON TABLES FROM "anon", "authenticated", PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public"
  REVOKE ALL PRIVILEGES ON SEQUENCES FROM "anon", "authenticated", PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public"
  REVOKE EXECUTE ON FUNCTIONS FROM "anon", "authenticated", PUBLIC;
