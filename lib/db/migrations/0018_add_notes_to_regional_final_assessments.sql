-- Add notes column to regional_final_assessments
ALTER TABLE "regional_final_assessments" ADD COLUMN IF NOT EXISTS "notes" text;
