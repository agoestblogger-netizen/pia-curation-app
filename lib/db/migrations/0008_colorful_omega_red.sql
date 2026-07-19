CREATE TABLE "fgd_comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"proposal_id" integer NOT NULL,
	"curator_id" integer NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fgd_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"competition_id" integer NOT NULL,
	"name" text NOT NULL,
	"scope" text DEFAULT 'nasional' NOT NULL,
	"region_center" text,
	"target_candidates" integer DEFAULT 10 NOT NULL,
	"view_mode" text DEFAULT 'grouped' NOT NULL,
	"filter_statuses" jsonb DEFAULT '["lolos"]' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"locked_at" timestamp with time zone,
	"locked_by" integer,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fgd_votes" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"proposal_id" integer NOT NULL,
	"curator_id" integer NOT NULL,
	"vote" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promoter_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"competition_id" integer NOT NULL,
	"proposal_id" integer NOT NULL,
	"promoter_id" integer NOT NULL,
	"assigned_by" integer,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "promotor_access_mode" text DEFAULT 'open' NOT NULL;--> statement-breakpoint
ALTER TABLE "fgd_comments" ADD CONSTRAINT "fgd_comments_session_id_fgd_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."fgd_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fgd_comments" ADD CONSTRAINT "fgd_comments_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fgd_comments" ADD CONSTRAINT "fgd_comments_curator_id_users_id_fk" FOREIGN KEY ("curator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fgd_sessions" ADD CONSTRAINT "fgd_sessions_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fgd_sessions" ADD CONSTRAINT "fgd_sessions_locked_by_users_id_fk" FOREIGN KEY ("locked_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fgd_sessions" ADD CONSTRAINT "fgd_sessions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fgd_votes" ADD CONSTRAINT "fgd_votes_session_id_fgd_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."fgd_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fgd_votes" ADD CONSTRAINT "fgd_votes_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fgd_votes" ADD CONSTRAINT "fgd_votes_curator_id_users_id_fk" FOREIGN KEY ("curator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promoter_assignments" ADD CONSTRAINT "promoter_assignments_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promoter_assignments" ADD CONSTRAINT "promoter_assignments_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promoter_assignments" ADD CONSTRAINT "promoter_assignments_promoter_id_users_id_fk" FOREIGN KEY ("promoter_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promoter_assignments" ADD CONSTRAINT "promoter_assignments_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "fgd_vote_unique" ON "fgd_votes" USING btree ("session_id","proposal_id","curator_id");--> statement-breakpoint
CREATE UNIQUE INDEX "promoter_assignment_unique" ON "promoter_assignments" USING btree ("competition_id","proposal_id","promoter_id");--> statement-breakpoint
CREATE INDEX "promoter_assignment_promoter_idx" ON "promoter_assignments" USING btree ("promoter_id");