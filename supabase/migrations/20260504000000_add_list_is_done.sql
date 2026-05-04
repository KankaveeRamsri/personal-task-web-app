-- Add is_done column to lists table.
-- Allows users to mark any list as a "done" list, decoupling
-- completion semantics from hardcoded title matching.

ALTER TABLE public.lists
  ADD COLUMN IF NOT EXISTS is_done boolean NOT NULL DEFAULT false;

-- Backfill: set is_done = true for existing lists whose title
-- matches "Completed" or "Done" (case-insensitive, trimmed).
UPDATE public.lists
  SET is_done = true
  WHERE LOWER(TRIM(title)) IN ('completed', 'done');
