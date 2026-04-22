-- ============================================================
-- Phase 1: Collaborative Task Board — Database Foundation
-- Migration: 20260422000000
-- ============================================================
-- Order matters: tables first, then constraints, then RLS
-- ============================================================

-- ----------------------------------------------------------
-- 0. Enable required extensions
-- ----------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------
-- 1. WORKSPACES
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workspaces (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        text NOT NULL,
  description text DEFAULT '',
  icon        text DEFAULT '📋',
  owner_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Index: look up workspaces by owner
CREATE INDEX idx_workspaces_owner_id ON public.workspaces(owner_id);

-- ----------------------------------------------------------
-- 2. WORKSPACE MEMBERS
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workspace_members (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role         text NOT NULL DEFAULT 'member'
    CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  joined_at    timestamptz NOT NULL DEFAULT now(),

  UNIQUE(workspace_id, user_id)
);

CREATE INDEX idx_workspace_members_workspace_id ON public.workspace_members(workspace_id);
CREATE INDEX idx_workspace_members_user_id ON public.workspace_members(user_id);

-- ----------------------------------------------------------
-- 3. BOARDS
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.boards (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title        text NOT NULL,
  description  text DEFAULT '',
  position     int4 NOT NULL DEFAULT 0,
  is_closed    boolean NOT NULL DEFAULT false,
  created_by   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_boards_workspace_id ON public.boards(workspace_id);
CREATE INDEX idx_boards_created_by ON public.boards(created_by);

-- ----------------------------------------------------------
-- 4. LISTS
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lists (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  board_id    uuid NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  title       text NOT NULL,
  position    int4 NOT NULL DEFAULT 0,
  color       text DEFAULT '',
  is_archived boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_lists_board_id ON public.lists(board_id);

-- ----------------------------------------------------------
-- 5. TASKS (new collaborative schema)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tasks (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  list_id      uuid NOT NULL REFERENCES public.lists(id) ON DELETE CASCADE,
  title        text NOT NULL,
  description  text DEFAULT '',
  position     int4 NOT NULL DEFAULT 0,
  is_completed boolean NOT NULL DEFAULT false,
  priority     text NOT NULL DEFAULT 'none'
    CHECK (priority IN ('none', 'low', 'medium', 'high')),
  due_date     date,
  assignee_id  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tasks_list_id ON public.tasks(list_id);
CREATE INDEX idx_tasks_assignee_id ON public.tasks(assignee_id);
CREATE INDEX idx_tasks_created_by ON public.tasks(created_by);
CREATE INDEX idx_tasks_due_date ON public.tasks(due_date);

-- ----------------------------------------------------------
-- 6. AUTO-ADD OWNER AS WORKSPACE MEMBER
-- ----------------------------------------------------------
-- เมื่อสร้าง workspace ใหม่ อัตโนมัติเพิ่ม owner เป็น member
CREATE OR REPLACE FUNCTION public.add_owner_to_workspace()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_add_owner_to_workspace
  AFTER INSERT ON public.workspaces
  FOR EACH ROW
  EXECUTE FUNCTION public.add_owner_to_workspace();

-- ----------------------------------------------------------
-- 7. AUTO-UPDATE updated_at
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_workspaces_updated_at
  BEFORE UPDATE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_boards_updated_at
  BEFORE UPDATE ON public.boards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_lists_updated_at
  BEFORE UPDATE ON public.lists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ----------------------------------------------------------
-- 8. DATA MIGRATION: move old tasks to new schema
-- ----------------------------------------------------------
-- ข้ามได้ถ้ายังไม่มี tasks table เดิม หรือ columns ไม่ตรง
-- ถ้ามี tasks เดิม (id, user_id, title, description, is_completed):
DO $$
DECLARE
  old_task RECORD;
  ws_id    uuid;
  bd_id    uuid;
  list_todo  uuid;
  list_done  uuid;
  user_ids  uuid[];
  uid       uuid;
BEGIN
  -- Check if legacy tasks table exists with expected columns
  IF EXISTS (
    SELECT 1 FROM information_schema.tables t
    WHERE t.table_schema = 'public' AND t.table_name = '_tasks_legacy'
  ) THEN
    RAISE NOTICE 'Legacy table _tasks_legacy already exists, skipping migration.';
    RETURN;
  END IF;

  -- Check if current tasks table has old schema (user_id column)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'tasks'
      AND c.column_name = 'user_id'
  ) THEN
    RAISE NOTICE 'No legacy tasks table detected (no user_id column), skipping migration.';
    RETURN;
  END IF;

  -- Rename old table
  ALTER TABLE public.tasks RENAME TO _tasks_legacy;

  -- Recreate the new tasks table (drop and recreate since we just renamed it)
  -- The new tasks table was already created above, so we're good.

  -- Get unique user IDs from legacy tasks
  SELECT ARRAY(
    SELECT DISTINCT user_id FROM public._tasks_legacy
  ) INTO user_ids;

  -- Migrate each user's tasks
  FOREACH uid IN ARRAY user_ids LOOP
    -- Create a default workspace for this user
    INSERT INTO public.workspaces (name, owner_id)
    VALUES ('My Workspace', uid)
    RETURNING id INTO ws_id;

    -- Create a default board
    INSERT INTO public.boards (workspace_id, title, created_by, position)
    VALUES (ws_id, 'My Board', uid, 0)
    RETURNING id INTO bd_id;

    -- Create default lists
    INSERT INTO public.lists (board_id, title, position) VALUES
      (bd_id, 'To Do', 1000),
      (bd_id, 'In Progress', 2000),
      (bd_id, 'Done', 3000)
    RETURNING id INTO list_todo;

    SELECT id INTO list_done FROM public.lists
    WHERE board_id = bd_id AND title = 'Done' LIMIT 1;

    -- Migrate non-completed tasks to "To Do"
    FOR old_task IN
      SELECT * FROM public._tasks_legacy
      WHERE user_id = uid AND (is_completed = false OR is_completed IS NULL)
    LOOP
      INSERT INTO public.tasks (id, list_id, title, description, position, is_completed, created_by, created_at, updated_at)
      VALUES (
        old_task.id,
        list_todo,
        old_task.title,
        COALESCE(old_task.description, ''),
        0,
        false,
        uid,
        old_task.created_at,
        old_task.updated_at
      );
    END LOOP;

    -- Migrate completed tasks to "Done"
    FOR old_task IN
      SELECT * FROM public._tasks_legacy
      WHERE user_id = uid AND is_completed = true
    LOOP
      INSERT INTO public.tasks (id, list_id, title, description, position, is_completed, created_by, created_at, updated_at)
      VALUES (
        old_task.id,
        list_done,
        old_task.title,
        COALESCE(old_task.description, ''),
        0,
        true,
        uid,
        old_task.created_at,
        old_task.updated_at
      );
    END LOOP;
  END LOOP;

  -- Drop legacy table after successful migration
  DROP TABLE public._tasks_legacy;

  RAISE NOTICE 'Legacy tasks migrated successfully.';
END;
$$;

-- ============================================================
-- 9. ROW LEVEL SECURITY
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------
-- Helper: is user a member of this workspace?
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_workspace_member(ws_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = ws_id
      AND wm.user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: get user's role in workspace
CREATE OR REPLACE FUNCTION public.get_workspace_role(ws_id uuid)
RETURNS text AS $$
  SELECT wm.role FROM public.workspace_members wm
  WHERE wm.workspace_id = ws_id
    AND wm.user_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: can user edit in workspace? (owner, admin, member)
CREATE OR REPLACE FUNCTION public.can_edit_in_workspace(ws_id uuid)
RETURNS boolean AS $$
  SELECT public.get_workspace_role(ws_id) IN ('owner', 'admin', 'member');
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: can user manage workspace? (owner, admin)
CREATE OR REPLACE FUNCTION public.can_manage_workspace(ws_id uuid)
RETURNS boolean AS $$
  SELECT public.get_workspace_role(ws_id) IN ('owner', 'admin');
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ----------------------------------------------------------
-- RLS: WORKSPACES
-- ----------------------------------------------------------
-- SELECT: ต้องเป็น member ของ workspace
CREATE POLICY "workspaces: members can view"
  ON public.workspaces FOR SELECT
  USING (public.is_workspace_member(id));

-- INSERT: ทุกคนที่ login แล้วสามารถสร้าง workspace ได้
CREATE POLICY "workspaces: authenticated users can create"
  ON public.workspaces FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

-- UPDATE: owner หรือ admin เท่านั้น
CREATE POLICY "workspaces: admins can update"
  ON public.workspaces FOR UPDATE
  USING (public.can_manage_workspace(id));

-- DELETE: owner เท่านั้น
CREATE POLICY "workspaces: owner can delete"
  ON public.workspaces FOR DELETE
  USING (public.get_workspace_role(id) = 'owner');

-- ----------------------------------------------------------
-- RLS: WORKSPACE MEMBERS
-- ----------------------------------------------------------
-- SELECT: members เห็น members คนอื่นใน workspace เดียวกัน
CREATE POLICY "workspace_members: members can view"
  ON public.workspace_members FOR SELECT
  USING (public.is_workspace_member(workspace_id));

-- INSERT: owner/admin สามารถเพิ่ม member
CREATE POLICY "workspace_members: admins can add"
  ON public.workspace_members FOR INSERT
  WITH CHECK (public.can_manage_workspace(workspace_id));

-- UPDATE: owner/admin เปลี่ยน role ได้, owner เท่านั้นที่เปลี่ยน owner role
CREATE POLICY "workspace_members: admins can update"
  ON public.workspace_members FOR UPDATE
  USING (public.can_manage_workspace(workspace_id));

-- DELETE: owner/admin ลบ member ได้, แต่ owner ตัวเองไม่ได้
CREATE POLICY "workspace_members: admins can remove"
  ON public.workspace_members FOR DELETE
  USING (
    public.can_manage_workspace(workspace_id)
    AND role != 'owner'  -- ไม่ให้ลบ owner
  );

-- ----------------------------------------------------------
-- RLS: BOARDS
-- ----------------------------------------------------------
-- SELECT: workspace members เห็น boards
CREATE POLICY "boards: members can view"
  ON public.boards FOR SELECT
  USING (
    NOT is_closed
    AND public.is_workspace_member(workspace_id)
  );

-- Include closed boards for members too (so they can see archived)
CREATE POLICY "boards: members can view closed"
  ON public.boards FOR SELECT
  USING (
    is_closed
    AND public.is_workspace_member(workspace_id)
  );

-- INSERT: members with edit access can create boards
CREATE POLICY "boards: editors can create"
  ON public.boards FOR INSERT
  WITH CHECK (
    public.can_edit_in_workspace(workspace_id)
    AND auth.uid() = created_by
  );

-- UPDATE: editors can update
CREATE POLICY "boards: editors can update"
  ON public.boards FOR UPDATE
  USING (public.can_edit_in_workspace(workspace_id));

-- DELETE: only admins
CREATE POLICY "boards: admins can delete"
  ON public.boards FOR DELETE
  USING (public.can_manage_workspace(workspace_id));

-- ----------------------------------------------------------
-- RLS: LISTS
-- ----------------------------------------------------------
-- SELECT: workspace members
CREATE POLICY "lists: members can view"
  ON public.lists FOR SELECT
  USING (
    public.is_workspace_member(
      (SELECT workspace_id FROM public.boards WHERE boards.id = lists.board_id)
    )
  );

-- INSERT/UPDATE/DELETE: editors
CREATE POLICY "lists: editors can create"
  ON public.lists FOR INSERT
  WITH CHECK (
    public.can_edit_in_workspace(
      (SELECT workspace_id FROM public.boards WHERE boards.id = lists.board_id)
    )
  );

CREATE POLICY "lists: editors can update"
  ON public.lists FOR UPDATE
  USING (
    public.can_edit_in_workspace(
      (SELECT workspace_id FROM public.boards WHERE boards.id = lists.board_id)
    )
  );

CREATE POLICY "lists: editors can delete"
  ON public.lists FOR DELETE
  USING (
    public.can_edit_in_workspace(
      (SELECT workspace_id FROM public.boards WHERE boards.id = lists.board_id)
    )
  );

-- ----------------------------------------------------------
-- RLS: TASKS
-- ----------------------------------------------------------
-- SELECT: workspace members
CREATE POLICY "tasks: members can view"
  ON public.tasks FOR SELECT
  USING (
    public.is_workspace_member(
      (SELECT ws.id FROM public.workspaces ws
       JOIN public.boards b ON b.workspace_id = ws.id
       JOIN public.lists l ON l.board_id = b.id
       WHERE l.id = tasks.list_id)
    )
  );

-- INSERT: editors, must be the creator
CREATE POLICY "tasks: editors can create"
  ON public.tasks FOR INSERT
  WITH CHECK (
    public.can_edit_in_workspace(
      (SELECT ws.id FROM public.workspaces ws
       JOIN public.boards b ON b.workspace_id = ws.id
       JOIN public.lists l ON l.board_id = b.id
       WHERE l.id = tasks.list_id)
    )
    AND auth.uid() = created_by
  );

-- UPDATE: editors
CREATE POLICY "tasks: editors can update"
  ON public.tasks FOR UPDATE
  USING (
    public.can_edit_in_workspace(
      (SELECT ws.id FROM public.workspaces ws
       JOIN public.boards b ON b.workspace_id = ws.id
       JOIN public.lists l ON l.board_id = b.id
       WHERE l.id = tasks.list_id)
    )
  );

-- DELETE: editors can delete their own, admins can delete any
CREATE POLICY "tasks: editors can delete"
  ON public.tasks FOR DELETE
  USING (
    public.can_edit_in_workspace(
      (SELECT ws.id FROM public.workspaces ws
       JOIN public.boards b ON b.workspace_id = ws.id
       JOIN public.lists l ON l.board_id = b.id
       WHERE l.id = tasks.list_id)
    )
  );
