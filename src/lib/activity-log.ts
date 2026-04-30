import { createClient } from "@/lib/supabase";

export async function logActivity(params: {
  workspaceId: string;
  boardId?: string;
  taskId?: string;
  action: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("task_activities").insert({
      workspace_id: params.workspaceId,
      board_id: params.boardId ?? null,
      task_id: params.taskId ?? null,
      actor_id: user.id,
      action: params.action,
      metadata: params.metadata ?? {},
    });
  } catch {
    // Logging is non-critical — never block the calling operation
  }
}
