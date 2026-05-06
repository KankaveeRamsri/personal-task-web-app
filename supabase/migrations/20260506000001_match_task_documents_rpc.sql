-- ============================================================
-- Phase 4: Task-focused RAG - Vector Search RPC
-- ============================================================

CREATE OR REPLACE FUNCTION match_task_documents (
  query_embedding vector(384),
  filter_workspace_id uuid,
  match_threshold float DEFAULT 0.2,
  match_count int DEFAULT 8,
  filter_board_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  workspace_id uuid,
  board_id uuid,
  task_id uuid,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE sql
AS $$
  SELECT
    td.id,
    td.workspace_id,
    td.board_id,
    td.task_id,
    td.content,
    td.metadata,
    1 - (td.embedding <=> query_embedding) AS similarity
  FROM task_documents td
  WHERE td.embedding IS NOT NULL
    AND td.workspace_id = filter_workspace_id
    AND (filter_board_id IS NULL OR td.board_id = filter_board_id)
    AND 1 - (td.embedding <=> query_embedding) >= match_threshold
  ORDER BY td.embedding <=> query_embedding
  LIMIT match_count;
$$;
