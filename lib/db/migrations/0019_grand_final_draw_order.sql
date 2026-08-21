-- Tabel minimalis untuk nomor urut undian Grand Final
-- Satu urutan gabungan BI+BC per kompetisi, tidak menyentuh tabel proposals
-- Pola: sama dengan grand_final_sponsors (per-row integer) tapi terpisah di tabel kecil sendiri
CREATE TABLE IF NOT EXISTS "grand_final_draw_order" (
  "id" serial PRIMARY KEY,
  "competition_id" integer NOT NULL REFERENCES "competitions"("id"),
  "proposal_id" integer NOT NULL REFERENCES "proposals"("id"),
  "sort_order" integer,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "grand_final_draw_order_unique" UNIQUE ("competition_id", "proposal_id")
);
