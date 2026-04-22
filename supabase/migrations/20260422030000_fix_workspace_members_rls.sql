-- ============================================================
-- Fix: workspace_members RLS — use TO authenticated
-- Migration: 20260422030000
-- ============================================================
-- Same root cause as workspaces RLS fix (Step 5):
-- policies default to TO PUBLIC, auth.uid() evaluates as NULL
-- in server-action context, blocking all member queries.
-- ============================================================

-- Drop old policies
DROP POLICY IF EXISTS "workspace_members: members can view" ON public.workspace_members;
DROP POLICY IF EXISTS "workspace_members: admins can add" ON public.workspace_members;
DROP POLICY IF EXISTS "workspace_members: admins can update" ON public.workspace_members;
DROP POLICY IF EXISTS "workspace_members: admins can remove" ON public.workspace_members;

-- SELECT: workspace members can see other members
CREATE POLICY "workspace_members: members can view"
  ON public.workspace_members FOR SELECT
  TO authenticated
  USING (public.is_workspace_member(workspace_id));

-- INSERT: owner/admin can add members
CREATE POLICY "workspace_members: admins can add"
  ON public.workspace_members FOR INSERT
  TO authenticated
  WITH CHECK (public.can_manage_workspace(workspace_id));

-- UPDATE: owner/admin can change roles
CREATE POLICY "workspace_members: admins can update"
  ON public.workspace_members FOR UPDATE
  TO authenticated
  USING (public.can_manage_workspace(workspace_id));

-- DELETE: owner/admin can remove non-owner members
CREATE POLICY "workspace_members: admins can remove"
  ON public.workspace_members FOR DELETE
  TO authenticated
  USING (
    public.can_manage_workspace(workspace_id)
    AND role != 'owner'
  );
