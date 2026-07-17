DROP TABLE IF EXISTS "claims" CASCADE;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "roles" text[] DEFAULT '{"curator"}' NOT NULL;
-- UPDATE "users" SET "roles" = ARRAY["role"] WHERE "role" IS NOT NULL;
ALTER TABLE "users" DROP COLUMN IF EXISTS "role";