-- Add grand_final_order column to proposals for Grand Final lottery ordering
-- Single combined sequence for all Grand Final finalists (BI + BC merged, not per-category)
-- NULL = not yet assigned, will appear at end of list
ALTER TABLE "proposals" ADD COLUMN IF NOT EXISTS "grand_final_order" integer;
