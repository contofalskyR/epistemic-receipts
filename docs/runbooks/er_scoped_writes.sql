-- er_scoped_writes — DB role for the PUBLIC edition (B12 Q2, approved 2026-07-16).
--
-- Contract:
--   * INSERT/UPDATE/DELETE on exactly: "Profile", "Bookmark", "Follow".
--   * SELECT everywhere else (the public edition is otherwise read-only).
--   * NO access of any kind to "TopicSubscription" / "ClaimSubscription"
--     (they hold email addresses — the public edition must never read them).
--
-- Run in an owner-approved migration window, on the production database,
-- AFTER prisma/migrations/20260716140000_add_follow has been applied
-- (the "Follow" grants below fail if the table doesn't exist yet — that
-- failure is a correct guard, not a bug).
--
-- Afterwards: set the public Vercel project's DATABASE_URL to a connection
-- string for er_scoped_writes and redeploy.

-- 1. Role (choose a strong password in the window; never commit it).
CREATE ROLE er_scoped_writes LOGIN PASSWORD '<set-in-window>';

-- 2. Connect + schema usage.
GRANT CONNECT ON DATABASE neondb TO er_scoped_writes; -- adjust db name if different
GRANT USAGE ON SCHEMA public TO er_scoped_writes;

-- 3. Read everywhere by default…
GRANT SELECT ON ALL TABLES IN SCHEMA public TO er_scoped_writes;

-- 4. …except the email-bearing subscription tables: no access at all.
REVOKE ALL ON TABLE "TopicSubscription" FROM er_scoped_writes;
REVOKE ALL ON TABLE "ClaimSubscription" FROM er_scoped_writes;

-- 5. Writes on exactly the three anonymous-profile tables.
GRANT INSERT, UPDATE, DELETE ON TABLE "Profile" TO er_scoped_writes;
GRANT INSERT, UPDATE, DELETE ON TABLE "Bookmark" TO er_scoped_writes;
GRANT INSERT, UPDATE, DELETE ON TABLE "Follow" TO er_scoped_writes;

-- 6. Future tables created by the migration owner default to SELECT-only.
--    NOTE: any future table holding PII must get an explicit REVOKE here —
--    add it to the migration that creates the table.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO er_scoped_writes;

-- Verification (run as er_scoped_writes):
--   SELECT count(*) FROM "Claim";                          -- works
--   INSERT INTO "Follow" ...;                              -- works
--   SELECT count(*) FROM "TopicSubscription";              -- permission denied
--   INSERT INTO "Claim" (...) VALUES (...);                -- permission denied
