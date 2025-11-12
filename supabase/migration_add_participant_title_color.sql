-- Add title and color fields to Participant table
ALTER TABLE "Participant" 
ADD COLUMN IF NOT EXISTS "title" TEXT,
ADD COLUMN IF NOT EXISTS "color" TEXT DEFAULT '#e5e7eb';

