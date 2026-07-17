ALTER TABLE "proposals" ADD COLUMN "external_sub_id" integer;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "whatsapp" text;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "theme" text;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "group_name" text;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "team_members" jsonb;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "link_proposal" text;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "submission_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "tagging" text;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "tagging2" text;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "confirmation_member" text;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "ai_cida_viability" double precision;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "ai_cida_feasibility" double precision;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "ai_cida_desirability" double precision;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "ai_cida_solvability" double precision;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "ai_cida_problem_urgency" double precision;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "ai_cida_uniqueness" double precision;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "ai_cida_average" double precision;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "ai_cida_total" double precision;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "ai_cida_average_skor" double precision;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "bc_kelompok_dibantu" text;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "bc_alasan_memilih_mereka" text;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "bc_apa_yang_anda_inginkan" text;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "bc_alasan_memilih_area_bantuan" text;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "bc_masalah_sasaran_inovasi" text;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "bc_identifikasi_masalah" text;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "bc_dampak_negatif_yang_muncul" text;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "bc_dilakukan_untuk_menyelesaikan_masalah" text;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "bc_alternatif_solusi" text;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "bc_eksplorasi_solusi" text;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "bc_inovasi_harus_memiliki_kebaruan" text;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "bc_detil_cara_kerja" text;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "bc_jelaskan_secara_detil" text;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "bc_mewujudkan_solusi" text;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "bc_sumber_daya_diperlukan" text;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "bc_target_capaian_finansial" text;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "bc_target_capaian_non_finansial" text;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "bc_sketsa_innovasi" text;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "bc_dokumen" text;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "bi_company" text;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "bi_profession" text;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "bi_fungsi" text;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "bi_sasaran_pengguna_inovasi" text;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "bi_alasan_memilih_sasaran" text;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "bi_masalah_diselesaikan" text;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "bi_masalah_penting_karena" text;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "bi_inovasi_diusulkan" text;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "bi_konteks_inovasi" text;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "bi_alasan_konteks_inovasi" text;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "bi_solusi_sudah_ada" text;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "bi_inovasi_dapat_menyelesaikan" text;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "bi_keunikan_penyelesaian" text;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "bi_dengan_cara" text;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "bi_diwujudkan_dengan_cara" text;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "bi_sumber_daya" text;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "bi_target_finansial" text;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "bi_target_non_finansial" text;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "proposer_directorate" text;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "proposer_division" text;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "proposer_department" text;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "proposer_region" text;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "proposer_office" text;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "proposer_unit_kerja" text;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "needs_review" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "last_synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "regional_finalist_rank" integer;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "regional_finalized_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "regional_finalized_by" integer;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_regional_finalized_by_users_id_fk" FOREIGN KEY ("regional_finalized_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "proposals_external_sub_id_idx" ON "proposals" USING btree ("competition_id","external_sub_id");--> statement-breakpoint
CREATE INDEX "proposals_needs_review_idx" ON "proposals" USING btree ("needs_review");--> statement-breakpoint
CREATE INDEX "proposals_region_center_idx" ON "proposals" USING btree ("region_center");