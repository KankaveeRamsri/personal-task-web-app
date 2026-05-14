-- ============================================================
-- Phase 6: AI Chat Persistent Memory
-- Migration: 20260514000000
-- ============================================================

-- ----------------------------------------------------------
-- 1. AI CHAT SESSIONS
-- Each session is scoped by user_id + workspace_id + board_id
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_chat_sessions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  board_id     uuid REFERENCES public.boards(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Indexes for efficient lookup
CREATE INDEX idx_ai_chat_sessions_user_id      ON public.ai_chat_sessions(user_id);
CREATE INDEX idx_ai_chat_sessions_workspace_id ON public.ai_chat_sessions(workspace_id);
CREATE INDEX idx_ai_chat_sessions_board_id     ON public.ai_chat_sessions(board_id);
CREATE INDEX idx_ai_chat_sessions_updated_at   ON public.ai_chat_sessions(updated_at DESC);

-- Composite index: load latest session per user+workspace+board
CREATE INDEX idx_ai_chat_sessions_lookup
  ON public.ai_chat_sessions(user_id, workspace_id, board_id, updated_at DESC);

-- ----------------------------------------------------------
-- 2. AI CHAT MESSAGES
-- Stores individual messages within a session
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_chat_messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.ai_chat_sessions(id) ON DELETE CASCADE,
  role       text NOT NULL CHECK (role IN ('user', 'assistant')),
  content    text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_ai_chat_messages_session_id  ON public.ai_chat_messages(session_id);
CREATE INDEX idx_ai_chat_messages_created_at  ON public.ai_chat_messages(created_at ASC);

-- ----------------------------------------------------------
-- 3. AUTO-UPDATE updated_at ON ai_chat_sessions
--    Reuse the existing update_updated_at() function.
-- ----------------------------------------------------------
CREATE TRIGGER trg_ai_chat_sessions_updated_at
  BEFORE UPDATE ON public.ai_chat_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ----------------------------------------------------------
-- 4. ROW LEVEL SECURITY
-- ----------------------------------------------------------
ALTER TABLE public.ai_chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_chat_messages ENABLE ROW LEVEL SECURITY;

-- ── ai_chat_sessions RLS ────────────────────────────────────

-- SELECT: only your own sessions AND you must be a workspace member
CREATE POLICY "ai_chat_sessions: owner can view"
  ON public.ai_chat_sessions FOR SELECT
  USING (
    user_id = auth.uid()
    AND public.is_workspace_member(workspace_id)
  );

-- INSERT: only for yourself, and you must be a workspace member
CREATE POLICY "ai_chat_sessions: owner can create"
  ON public.ai_chat_sessions FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND public.is_workspace_member(workspace_id)
  );

-- UPDATE: only your own session (e.g. updated_at bump)
CREATE POLICY "ai_chat_sessions: owner can update"
  ON public.ai_chat_sessions FOR UPDATE
  USING (
    user_id = auth.uid()
    AND public.is_workspace_member(workspace_id)
  );

-- DELETE: only your own session
CREATE POLICY "ai_chat_sessions: owner can delete"
  ON public.ai_chat_sessions FOR DELETE
  USING (
    user_id = auth.uid()
    AND public.is_workspace_member(workspace_id)
  );

-- ── ai_chat_messages RLS ─────────────────────────────────────

-- SELECT: messages in sessions you own
CREATE POLICY "ai_chat_messages: owner can view"
  ON public.ai_chat_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.ai_chat_sessions s
      WHERE s.id = ai_chat_messages.session_id
        AND s.user_id = auth.uid()
    )
  );

-- INSERT: into sessions you own
CREATE POLICY "ai_chat_messages: owner can create"
  ON public.ai_chat_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ai_chat_sessions s
      WHERE s.id = ai_chat_messages.session_id
        AND s.user_id = auth.uid()
    )
  );

-- DELETE: messages in sessions you own (for clear/new chat)
CREATE POLICY "ai_chat_messages: owner can delete"
  ON public.ai_chat_messages FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.ai_chat_sessions s
      WHERE s.id = ai_chat_messages.session_id
        AND s.user_id = auth.uid()
    )
  );
