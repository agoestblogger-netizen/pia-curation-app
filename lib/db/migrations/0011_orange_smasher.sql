CREATE TABLE "fgd_additional_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"proposal_id" integer NOT NULL,
	"file_name" text NOT NULL,
	"file_url" text NOT NULL,
	"ai_analysis" jsonb NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"uploaded_by" integer,
	CONSTRAINT "fgd_additional_documents_proposal_id_unique" UNIQUE("proposal_id")
);
--> statement-breakpoint
ALTER TABLE "fgd_additional_documents" ADD CONSTRAINT "fgd_additional_documents_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fgd_additional_documents" ADD CONSTRAINT "fgd_additional_documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;