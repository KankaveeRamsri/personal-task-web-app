-- Task activities log
CREATE TABLE IF NOT EXISTS public.task_activities (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  board_id     uuid NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  task_id      uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  actor_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action       text NOT NULL,
  metadata     jsonb DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Indexes for dashboard queries
CREATE INDEX idx_task_activities_ws_created ON public.task_activities(workspace_id, created_at DESC);
CREATE INDEX idx_task_activities_board_created ON public.task_activities(board_id, created_at DESC);

-- RLS
ALTER TABLE public.task_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "task_activities: workspace members can read"
  ON public.task_activities FOR SELECT
  TO authenticated
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "task_activities: workspace members can insert"
  ON public.task_activities FOR INSERT
  TO authenticated
  WITH CHECK (public.is_workspace_member(workspace_id));
