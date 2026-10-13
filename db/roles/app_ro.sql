-- app_ro: SELECT-only login for every review, census and verification run
-- (Phase 7 Q15, owner-approved 2026-10-12; doctrine §5 calls it er_readonly).
--
-- `app` owns all 44 public tables but has no CREATEROLE, so this runs as the
-- postgres superuser on the server:
--   ssh opc@<server>  →  sudo -u postgres psql -d epistemic -v pw="'<password>'" -f app_ro.sql
-- Choose the password in the session; never commit it. Then add to .env.local:
--   DATABASE_URL_RO=postgresql://app_ro:<password>@<host>:5432/epistemic?sslmode=require

CREATE ROLE app_ro LOGIN PASSWORD :pw CONNECTION LIMIT 5;

-- Belt and braces: even a misgranted table refuses writes in this session.
ALTER ROLE app_ro SET default_transaction_read_only = on;

GRANT CONNECT ON DATABASE epistemic TO app_ro;
GRANT USAGE ON SCHEMA public TO app_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO app_ro;

-- Tables that future migrations create (owned by app) are readable too.
ALTER DEFAULT PRIVILEGES FOR ROLE app IN SCHEMA public GRANT SELECT ON TABLES TO app_ro;

-- Verification, connected as app_ro:
--   SELECT count(*) FROM "Claim";                                   -- works
--   SET default_transaction_read_only = off;
--   UPDATE "Claim" SET text = text WHERE false;                     -- permission denied for table Claim
