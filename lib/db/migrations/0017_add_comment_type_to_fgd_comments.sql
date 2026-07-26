-- Add comment_type column to fgd_comments
-- null = regular FGD discussion, 'curator_note' = auto-injected from screening result
ALTER TABLE "fgd_comments" ADD COLUMN IF NOT EXISTS "comment_type" text;
