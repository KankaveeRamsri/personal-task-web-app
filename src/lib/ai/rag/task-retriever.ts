import { SupabaseClient } from "@supabase/supabase-js";

const EXPECTED_DIM = 384;
const DEFAULT_THRESHOLD = 0;
const DEFAULT_MATCH_COUNT = 5;

export interface TaskDocument {
  id: string;
  task_id: string;
  workspace_id: string;
  board_id: string | null;
  content: string;
  similarity: number;
}

export interface RetrieveOptions {
  workspaceId: string;
  boardId?: string;
  matchThreshold?: number;
  matchCount?: number;
}

async function embedQuery(query: string): Promise<number[]> {
  const baseUrl = process.env.EMBEDDING_SERVICE_URL;
  if (!baseUrl) throw new Error("EMBEDDING_SERVICE_URL not configured");

  const res = await fetch(`${baseUrl}/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: query }),
  });

  if (!res.ok) {
    throw new Error(`Embedding service error: ${res.status}`);
  }

  const data = await res.json();
  const embedding: unknown = data?.embedding;

  if (!Array.isArray(embedding) || embedding.length !== EXPECTED_DIM) {
    throw new Error(
      `Invalid embedding dimension: expected ${EXPECTED_DIM}, got ${Array.isArray(embedding) ? embedding.length : "non-array"}`,
    );
  }

  return embedding as number[];
}

export async function retrieveTaskDocuments(
  supabase: SupabaseClient,
  query: string,
  options: RetrieveOptions,
): Promise<TaskDocument[]> {
  const {
    workspaceId,
    boardId,
    matchThreshold = DEFAULT_THRESHOLD,
    matchCount = DEFAULT_MATCH_COUNT,
  } = options;

  console.log("[TaskRetriever] params:", { workspaceId, boardId: boardId ?? null, matchThreshold, matchCount });

  const queryEmbedding = await embedQuery(query);

  const { data, error } = await supabase.rpc("match_task_documents", {
    query_embedding: queryEmbedding,
    filter_workspace_id: workspaceId,
    match_threshold: matchThreshold,
    match_count: matchCount,
    filter_board_id: boardId ?? null,
  });

  if (error) throw error;

  return (data ?? []) as TaskDocument[];
}
