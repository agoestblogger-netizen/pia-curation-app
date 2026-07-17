ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "roles" text[] DEFAULT '{"curator"}' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN IF EXISTS "role";