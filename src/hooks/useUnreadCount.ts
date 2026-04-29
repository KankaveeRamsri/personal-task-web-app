"use client";

import { useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";

async function getRelevantActivityIds(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<string[]> {
  const { data: memberships } = await supabase
    .from("workspace_members")
    .select("workspace_id, role")
    .eq("user_id", userId);

  if (!memberships || memberships.length === 0) return [];

  const isOwnerOrAdmin = memberships.some(
    (m) => m.role === "owner" || m.role === "admin"
  );
  const workspaceIds = memberships.map((m) => m.workspace_id);

  const { data: boards } = await supabase
    .from("boards")
    .select("id")
    .in("workspace_id", workspaceIds)
    .eq("is_closed", false);

  if (!boards || boards.length === 0) return [];

  const boardIds = boards.map((b) => b.id);

  if (isOwnerOrAdmin) {
    const { data: activities } = await supabase
      .from("task_activities")
      .select("id")
      .in("board_id", boardIds)
      .neq("actor_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);
    return (activities ?? []).map((a) => a.id);
  }

  const { data: lists } = await supabase
    .from("lists")
    .select("id")
    .in("board_id", boardIds);

  if (!lists || lists.length === 0) return [];
  const listIds = lists.map((l) => l.id);

  const { data: assignedTasks } = await supabase
    .from("tasks")
    .select("id")
    .in("list_id", listIds)
    .eq("assignee_id", userId);

  if (!assignedTasks || assignedTasks.length === 0) return [];
  const taskIds = assignedTasks.map((t) => t.id);

  const { data: activities } = await supabase
    .from("task_activities")
    .select("id")
    .in("task_id", taskIds)
    .neq("actor_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);

  return (activities ?? []).map((a) => a.id);
}

export function useUnreadCount() {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setCount(0);
        setLoading(false);
        return;
      }

      const relevantIds = await getRelevantActivityIds(supabase, user.id);
      if (relevantIds.length === 0) {
        setCount(0);
        setLoading(false);
        return;
      }

      const { data: reads } = await supabase
        .from("notification_reads")
        .select("activity_id")
        .eq("user_id", user.id)
        .in("activity_id", relevantIds);

      const readSet = new Set((reads ?? []).map((r) => r.activity_id));
      setCount(relevantIds.filter((id) => !readSet.has(id)).length);
    } catch {
      setCount(0);
    } finally {
      setLoading(false);
    }
  }, []);

  return { count, loading, refresh };
}
