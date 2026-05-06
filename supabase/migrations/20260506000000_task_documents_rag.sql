-- ============================================================
-- Phase 4 Step 1: Task-focused RAG (pgvector)
-- ============================================================

-- 1. Enable pgvector safely
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Create table: task_documents
CREATE TABLE IF NOT EXISTS public.task_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  board_id uuid NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  content text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  embedding vector(384),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. Add indexes
CREATE INDEX IF NOT EXISTS idx_task_documents_workspace_id ON public.task_documents(workspace_id);
CREATE INDEX IF NOT EXISTS idx_task_documents_board_id ON public.task_documents(board_id);
CREATE INDEX IF NOT EXISTS idx_task_documents_task_id ON public.task_documents(task_id);

-- Vector similarity index (using HNSW for fast nearest neighbor search)
CREATE INDEX IF NOT EXISTS idx_task_documents_embedding ON public.task_documents USING hnsw (embedding vector_l2_ops);

-- 5. Reuse existing updated_at trigger pattern
CREATE TRIGGER trg_task_documents_updated_at
  BEFORE UPDATE ON public.task_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 6. Enable RLS
ALTER TABLE public.task_documents ENABLE ROW LEVEL SECURITY;

-- 7. SELECT policy: Users can read task_documents only if they belong to the workspace
CREATE POLICY "task_documents: members can view"
  ON public.task_documents FOR SELECT
  USING (public.is_workspace_member(workspace_id));

-- 8. INSERT/UPDATE/DELETE: Reuse existing task permission patterns
-- Only editors (owner, admin, member) can mutate. Viewers are restricted by the helper function.
CREATE POLICY "task_documents: editors can create"
  ON public.task_documents FOR INSERT
  WITH CHECK (public.can_edit_in_workspace(workspace_id));

CREATE POLICY "task_documents: editors can update"
  ON public.task_documents FOR UPDATE
  USING (public.can_edit_in_workspace(workspace_id));

CREATE POLICY "task_documents: editors can delete"
  ON public.task_documents FOR DELETE
  USING (public.can_edit_in_workspace(workspace_id));
