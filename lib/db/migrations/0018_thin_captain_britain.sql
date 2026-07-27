CREATE TABLE "grand_final_sponsors" (
	"id" serial PRIMARY KEY NOT NULL,
	"competition_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"assigned_by" integer,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "regional_final_pics" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"assigned_by" integer,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "regional_final_judge_unique";--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "regional_curator_mode" text DEFAULT 'single' NOT NULL;--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "show_gugur_proposals" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "fgd_comments" ADD COLUMN "comment_type" text;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "link_resubmit_proposal" text;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "link_surat_orisinalitas" text;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "resubmit_document_text" text;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "resubmit_ai_analysis" jsonb;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "cached_resubmit_pdf_urls" jsonb;--> statement-breakpoint
ALTER TABLE "regional_final_assessments" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "regional_final_judges" ADD COLUMN "is_finalized" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_active_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "grand_final_sponsors" ADD CONSTRAINT "grand_final_sponsors_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grand_final_sponsors" ADD CONSTRAINT "grand_final_sponsors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grand_final_sponsors" ADD CONSTRAINT "grand_final_sponsors_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regional_final_pics" ADD CONSTRAINT "regional_final_pics_session_id_regional_final_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."regional_final_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regional_final_pics" ADD CONSTRAINT "regional_final_pics_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regional_final_pics" ADD CONSTRAINT "regional_final_pics_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "grand_final_sponsor_unique" ON "grand_final_sponsors" USING btree ("competition_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "regional_final_pic_unique" ON "regional_final_pics" USING btree ("session_id","user_id");--> statement-breakpoint
CREATE INDEX "curator_assignment_status_idx" ON "curator_assignments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "potential_duplicates_prop_a_idx" ON "potential_duplicates" USING btree ("proposal_a_id");--> statement-breakpoint
CREATE INDEX "potential_duplicates_prop_b_idx" ON "potential_duplicates" USING btree ("proposal_b_id");