import { SupabaseClient } from "@supabase/supabase-js";
import { embedText } from "./embed";

export interface ReindexOptions {
  workspaceId: string;
  boardId?: string;
  limit?: number;
}

export interface ReindexResult {
  indexed: number;
  failed: number;
  errors: string[];
}

function buildTaskContent(task: {
  title: string;
  description?: string | null;
  priority?: string | null;
  due_date?: string | null;
  is_completed?: boolean;
}): string {
  const parts: string[] = [`Task: ${task.title}`];
  if (task.description?.trim()) parts.push(`Description: ${task.description.trim()}`);
  if (task.priority && task.priority !== "none") parts.push(`Priority: ${task.priority}`);
  if (task.due_date) parts.push(`Due date: ${task.due_date}`);
  parts.push(`Status: ${task.is_completed ? "completed" : "pending"}`);
  return parts.join("\n");
}

export async function reindexTasks(
  supabase: SupabaseClient,
  options: ReindexOptions,
): Promise<ReindexResult> {
  const { workspaceId, boardId, limit = 50 } = options;
  const result: ReindexResult = { indexed: 0, failed: 0, errors: [] };
  const t0 = Date.now();

  // 1. Get boards for workspace (RLS-safe: user can only see accessible boards)
  let boardQuery = supabase
    .from("boards")
    .select("id, workspace_id")
    .eq("workspace_id", workspaceId);

  if (boardId) boardQuery = boardQuery.eq("id", boardId);

  const { data: boards, error: boardErr } = await boardQuery;
  if (boardErr || !boards?.length) {
    result.errors.push(boardErr?.message ?? "No accessible boards found");
    return result;
  }

  const boardById = new Map(
    (boards as { id: string; workspace_id: string }[]).map((b) => [b.id, b]),
  );
  const boardIds = Array.from(boardById.keys());

  // 2. Get lists for those boards (RLS-safe)
  const { data: lists, error: listErr } = await supabase
    .from("lists")
    .select("id, board_id, is_done")
    .in("board_id", boardIds);

  if (listErr || !lists?.length) {
    result.errors.push(listErr?.message ?? "No lists found in accessible boards");
    return result;
  }

  const listBoardMap = new Map(
    (lists as { id: string; board_id: string; is_done: boolean }[]).map((l) => [l.id, l.board_id]),
  );
  const listIsDoneMap = new Map(
    (lists as { id: string; board_id: string; is_done: boolean }[]).map((l) => [l.id, l.is_done ?? false]),
  );
  const listIds = Array.from(listBoardMap.keys());

  // 3. Get tasks for those lists (RLS-safe), apply limit here
  const { data: tasks, error: taskErr } = await supabase
    .from("tasks")
    .select("id, title, description, priority, due_date, is_completed, list_id, updated_at")
    .in("list_id", listIds)
    .limit(limit);

  if (taskErr || !tasks?.length) {
    result.errors.push(taskErr?.message ?? "No tasks found");
    return result;
  }

  console.log(
    `[TaskIndexer] start: workspaceId=${workspaceId}, boardId=${boardId ?? "all"}, tasks=${tasks.length}`,
  );

  // 4. Embed and upsert each task document sequentially
  // Sequential (not batch) so a single failure doesn't block others
  for (const task of tasks as {
    id: string;
    title: string;
    description: string | null;
    priority: string | null;
    due_date: string | null;
    is_completed: boolean;
    list_id: string;
    updated_at: string | null;
  }[]) {
    try {
      const taskBoardId = listBoardMap.get(task.list_id);
      if (!taskBoardId) {
        result.failed++;
        result.errors.push(`task ${task.id}: board not found for list ${task.list_id}`);
        continue;
      }

      const content = buildTaskContent(task);
      const embedding = await embedText(content);

      // Delete existing document for this task (idempotent re-index)
      await supabase.from("task_documents").delete().eq("task_id", task.id);

      // Insert fresh document with new embedding
      const { error: insertErr } = await supabase.from("task_documents").insert({
        task_id: task.id,
        workspace_id: workspaceId,
        board_id: taskBoardId,
        content,
        embedding: JSON.stringify(embedding),
        metadata: {
          title: task.title,
          priority: task.priority ?? null,
          due_date: task.due_date ?? null,
          is_completed: task.is_completed ?? false,
          list_is_done: listIsDoneMap.get(task.list_id) ?? false,
          task_updated_at: task.updated_at ?? null,
        },
      });

      if (insertErr) {
        result.failed++;
        result.errors.push(`task ${task.id}: ${insertErr.message}`);
      } else {
        result.indexed++;
      }
    } catch (err) {
      result.failed++;
      const msg = err instanceof Error ? err.message : "unknown error";
      result.errors.push(`task ${task.id}: ${msg}`);
    }
  }

  const elapsed = Date.now() - t0;
  console.log(
    `[TaskIndexer] done: indexed=${result.indexed}, failed=${result.failed}, durationMs=${elapsed}`,
  );

  return result;
}
