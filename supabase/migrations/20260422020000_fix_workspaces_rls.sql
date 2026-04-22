-- ============================================================
-- Fix: workspaces RLS — use TO authenticated + explicit null check
-- Migration: 20260422020000
-- ============================================================
-- Root cause: policies were TO PUBLIC (default), causing auth.uid()
-- to evaluate as NULL in server-action context, blocking INSERT.
-- ============================================================

-- Drop old policies (SELECT + INSERT only)
DROP POLICY IF EXISTS "workspaces: members can view" ON public.workspaces;
DROP POLICY IF EXISTS "workspaces: authenticated users can create" ON public.workspaces;

-- SELECT: owner can always see + members via helper
CREATE POLICY "workspaces: members can view"
  ON public.workspaces FOR SELECT
  TO authenticated
  USING (
    owner_id = auth.uid()
    OR public.is_workspace_member(id)
  );

-- INSERT: must be authenticated, uid not null, uid = owner_id
CREATE POLICY "workspaces: authenticated users can create"
  ON public.workspaces FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND auth.uid() = owner_id
  );
