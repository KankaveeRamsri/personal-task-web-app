-- Recreate: Make board_id nullable for workspace-level activities
-- This allows team-level actions like invitations to be logged without a specific board context.
ALTER TABLE public.task_activities ALTER COLUMN board_id DROP NOT NULL;
