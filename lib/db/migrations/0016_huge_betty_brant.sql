ALTER TABLE "proposals" ADD COLUMN "nomor_urut" integer;--> statement-breakpoint
CREATE INDEX "curator_assignment_proposal_idx" ON "curator_assignments" USING btree ("proposal_id");--> statement-breakpoint
CREATE INDEX "promoter_selection_proposal_idx" ON "promoter_selections" USING btree ("proposal_id");--> statement-breakpoint
CREATE INDEX "screening_results_proposal_idx" ON "screening_results" USING btree ("proposal_id");