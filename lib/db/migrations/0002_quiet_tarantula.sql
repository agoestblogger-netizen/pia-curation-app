CREATE TYPE "public"."claim_status" AS ENUM('interested', 'released', 'selected_primary', 'secondary_reviewer');--> statement-breakpoint
CREATE TABLE "claims" (
	"id" serial PRIMARY KEY NOT NULL,
	"proposal_id" integer NOT NULL,
	"po_id" integer NOT NULL,
	"status" "claim_status" DEFAULT 'interested' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "claim_deadline" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_po_id_users_id_fk" FOREIGN KEY ("po_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "claims_proposal_po_unique" ON "claims" USING btree ("proposal_id","po_id");--> statement-breakpoint
CREATE INDEX "claims_proposal_id_idx" ON "claims" USING btree ("proposal_id");