CREATE TABLE "proposal_ai_analyses" (
	"id" serial PRIMARY KEY NOT NULL,
	"proposal_id" integer NOT NULL,
	"structured_summary" jsonb NOT NULL,
	"key_claims" jsonb NOT NULL,
	"clarification_points" jsonb NOT NULL,
	"duplication_check" text,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "proposal_ai_analyses_proposal_id_unique" UNIQUE("proposal_id")
);
--> statement-breakpoint
ALTER TABLE "proposal_ai_analyses" ADD CONSTRAINT "proposal_ai_analyses_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE no action ON UPDATE no action;