CREATE TABLE "assignment_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"assignment_id" integer NOT NULL,
	"from_curator_id" integer,
	"to_curator_id" integer,
	"reason" text,
	"reassigned_by" integer,
	"reassigned_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor_id" integer,
	"actor_name" text,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text,
	"before_json" jsonb,
	"after_json" jsonb,
	"reason" text,
	"ip_address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "competitions" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"year" integer NOT NULL,
	"description" text,
	"phase" text DEFAULT 'imported' NOT NULL,
	"phase_locked_at" timestamp with time zone,
	"phase_locked_by" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "curation_batches" (
	"id" serial PRIMARY KEY NOT NULL,
	"competition_id" integer NOT NULL,
	"name" text NOT NULL,
	"assignment_mode" text DEFAULT 'equal' NOT NULL,
	"config_json" jsonb,
	"status" text DEFAULT 'draft' NOT NULL,
	"locked_at" timestamp with time zone,
	"locked_by" integer,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "curator_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"batch_id" integer NOT NULL,
	"proposal_id" integer NOT NULL,
	"curator_id" integer NOT NULL,
	"category" text NOT NULL,
	"status" text DEFAULT 'assigned' NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"assigned_by" integer
);
--> statement-breakpoint
CREATE TABLE "curator_quota_configs" (
	"id" serial PRIMARY KEY NOT NULL,
	"batch_id" integer NOT NULL,
	"curator_id" integer NOT NULL,
	"regional_load" text DEFAULT 'none' NOT NULL,
	"recommended_wilayah" integer DEFAULT 0 NOT NULL,
	"recommended_pusat" integer DEFAULT 0 NOT NULL,
	"recommended_bi" integer DEFAULT 0 NOT NULL,
	"recommended_bc" integer DEFAULT 0 NOT NULL,
	"final_wilayah" integer DEFAULT 0 NOT NULL,
	"final_pusat" integer DEFAULT 0 NOT NULL,
	"final_bi" integer DEFAULT 0 NOT NULL,
	"final_bc" integer DEFAULT 0 NOT NULL,
	"updated_by" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "final_results" (
	"id" serial PRIMARY KEY NOT NULL,
	"competition_id" integer NOT NULL,
	"proposal_id" integer NOT NULL,
	"rank" integer,
	"result_status" text NOT NULL,
	"notes" text,
	"locked_at" timestamp with time zone,
	"locked_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "final_results_proposal_id_unique" UNIQUE("proposal_id")
);
--> statement-breakpoint
CREATE TABLE "grand_final_selections" (
	"id" serial PRIMARY KEY NOT NULL,
	"competition_id" integer NOT NULL,
	"proposal_id" integer NOT NULL,
	"selected_by" integer,
	"selected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	"locked_by" integer,
	CONSTRAINT "grand_final_selections_proposal_id_unique" UNIQUE("proposal_id")
);
--> statement-breakpoint
CREATE TABLE "pdf_exports" (
	"id" serial PRIMARY KEY NOT NULL,
	"competition_id" integer,
	"report_type" text NOT NULL,
	"filter_json" jsonb,
	"generated_by" integer,
	"generated_by_name" text,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"document_status" text DEFAULT 'DRAFT' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promoter_selections" (
	"id" serial PRIMARY KEY NOT NULL,
	"competition_id" integer NOT NULL,
	"promoter_id" integer NOT NULL,
	"proposal_id" integer NOT NULL,
	"selected_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposals" (
	"id" serial PRIMARY KEY NOT NULL,
	"competition_id" integer NOT NULL,
	"external_id" text,
	"title" text NOT NULL,
	"proposer_name" text NOT NULL,
	"proposer_org" text,
	"proposer_email" text,
	"category" text NOT NULL,
	"division" text,
	"region_center" text,
	"summary" text,
	"status" text DEFAULT 'imported' NOT NULL,
	"takeout_reason" text,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"imported_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quota_factor_configs" (
	"id" serial PRIMARY KEY NOT NULL,
	"competition_id" integer NOT NULL,
	"load_level" text NOT NULL,
	"factor" double precision NOT NULL,
	"updated_by" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scoring_criteria" (
	"id" serial PRIMARY KEY NOT NULL,
	"competition_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"max_score" double precision DEFAULT 100 NOT NULL,
	"weight" double precision DEFAULT 1 NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scoring_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"competition_id" integer NOT NULL,
	"locked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_by" integer,
	"snapshot_json" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "screening_results" (
	"id" serial PRIMARY KEY NOT NULL,
	"assignment_id" integer NOT NULL,
	"proposal_id" integer NOT NULL,
	"curator_id" integer NOT NULL,
	"verdict" text NOT NULL,
	"notes" text,
	"recommendation" text,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "screening_results_assignment_id_unique" UNIQUE("assignment_id")
);
--> statement-breakpoint
CREATE TABLE "sponsor_scores" (
	"id" serial PRIMARY KEY NOT NULL,
	"competition_id" integer NOT NULL,
	"proposal_id" integer NOT NULL,
	"sponsor_id" integer NOT NULL,
	"criterion_id" integer NOT NULL,
	"score" double precision NOT NULL,
	"is_draft" boolean DEFAULT true NOT NULL,
	"locked_at" timestamp with time zone,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "assignment_history" ADD CONSTRAINT "assignment_history_assignment_id_curator_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."curator_assignments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_history" ADD CONSTRAINT "assignment_history_from_curator_id_users_id_fk" FOREIGN KEY ("from_curator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_history" ADD CONSTRAINT "assignment_history_to_curator_id_users_id_fk" FOREIGN KEY ("to_curator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_history" ADD CONSTRAINT "assignment_history_reassigned_by_users_id_fk" FOREIGN KEY ("reassigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitions" ADD CONSTRAINT "competitions_phase_locked_by_users_id_fk" FOREIGN KEY ("phase_locked_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitions" ADD CONSTRAINT "competitions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curation_batches" ADD CONSTRAINT "curation_batches_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curation_batches" ADD CONSTRAINT "curation_batches_locked_by_users_id_fk" FOREIGN KEY ("locked_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curation_batches" ADD CONSTRAINT "curation_batches_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curator_assignments" ADD CONSTRAINT "curator_assignments_batch_id_curation_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."curation_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curator_assignments" ADD CONSTRAINT "curator_assignments_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curator_assignments" ADD CONSTRAINT "curator_assignments_curator_id_users_id_fk" FOREIGN KEY ("curator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curator_assignments" ADD CONSTRAINT "curator_assignments_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curator_quota_configs" ADD CONSTRAINT "curator_quota_configs_batch_id_curation_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."curation_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curator_quota_configs" ADD CONSTRAINT "curator_quota_configs_curator_id_users_id_fk" FOREIGN KEY ("curator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curator_quota_configs" ADD CONSTRAINT "curator_quota_configs_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "final_results" ADD CONSTRAINT "final_results_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "final_results" ADD CONSTRAINT "final_results_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "final_results" ADD CONSTRAINT "final_results_locked_by_users_id_fk" FOREIGN KEY ("locked_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grand_final_selections" ADD CONSTRAINT "grand_final_selections_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grand_final_selections" ADD CONSTRAINT "grand_final_selections_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grand_final_selections" ADD CONSTRAINT "grand_final_selections_selected_by_users_id_fk" FOREIGN KEY ("selected_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grand_final_selections" ADD CONSTRAINT "grand_final_selections_locked_by_users_id_fk" FOREIGN KEY ("locked_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pdf_exports" ADD CONSTRAINT "pdf_exports_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pdf_exports" ADD CONSTRAINT "pdf_exports_generated_by_users_id_fk" FOREIGN KEY ("generated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promoter_selections" ADD CONSTRAINT "promoter_selections_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promoter_selections" ADD CONSTRAINT "promoter_selections_promoter_id_users_id_fk" FOREIGN KEY ("promoter_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promoter_selections" ADD CONSTRAINT "promoter_selections_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_imported_by_users_id_fk" FOREIGN KEY ("imported_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quota_factor_configs" ADD CONSTRAINT "quota_factor_configs_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quota_factor_configs" ADD CONSTRAINT "quota_factor_configs_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scoring_criteria" ADD CONSTRAINT "scoring_criteria_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scoring_criteria" ADD CONSTRAINT "scoring_criteria_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scoring_snapshots" ADD CONSTRAINT "scoring_snapshots_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scoring_snapshots" ADD CONSTRAINT "scoring_snapshots_locked_by_users_id_fk" FOREIGN KEY ("locked_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "screening_results" ADD CONSTRAINT "screening_results_assignment_id_curator_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."curator_assignments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "screening_results" ADD CONSTRAINT "screening_results_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "screening_results" ADD CONSTRAINT "screening_results_curator_id_users_id_fk" FOREIGN KEY ("curator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsor_scores" ADD CONSTRAINT "sponsor_scores_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsor_scores" ADD CONSTRAINT "sponsor_scores_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsor_scores" ADD CONSTRAINT "sponsor_scores_sponsor_id_users_id_fk" FOREIGN KEY ("sponsor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsor_scores" ADD CONSTRAINT "sponsor_scores_criterion_id_scoring_criteria_id_fk" FOREIGN KEY ("criterion_id") REFERENCES "public"."scoring_criteria"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_actor_idx" ON "audit_logs" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "audit_log_entity_idx" ON "audit_logs" USING btree ("entity","entity_id");--> statement-breakpoint
CREATE INDEX "audit_log_created_at_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "curator_assignment_batch_proposal" ON "curator_assignments" USING btree ("batch_id","proposal_id");--> statement-breakpoint
CREATE INDEX "curator_assignment_curator_idx" ON "curator_assignments" USING btree ("curator_id");--> statement-breakpoint
CREATE INDEX "curator_assignment_batch_idx" ON "curator_assignments" USING btree ("batch_id");--> statement-breakpoint
CREATE UNIQUE INDEX "quota_config_batch_curator" ON "curator_quota_configs" USING btree ("batch_id","curator_id");--> statement-breakpoint
CREATE UNIQUE INDEX "promoter_selection_promoter_proposal" ON "promoter_selections" USING btree ("promoter_id","proposal_id");--> statement-breakpoint
CREATE INDEX "promoter_selection_competition_idx" ON "promoter_selections" USING btree ("competition_id");--> statement-breakpoint
CREATE INDEX "proposals_competition_id_idx" ON "proposals" USING btree ("competition_id");--> statement-breakpoint
CREATE INDEX "proposals_category_idx" ON "proposals" USING btree ("category");--> statement-breakpoint
CREATE INDEX "proposals_status_idx" ON "proposals" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "quota_factor_competition_level" ON "quota_factor_configs" USING btree ("competition_id","load_level");--> statement-breakpoint
CREATE UNIQUE INDEX "sponsor_score_sponsor_proposal_criterion" ON "sponsor_scores" USING btree ("sponsor_id","proposal_id","criterion_id");