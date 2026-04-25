"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";

export type Activity = {
  id: string;
  workspace_id: string;
  board_id: string;
  task_id: string | null;
  actor_id: string;
  action: string;
  metadata: Record<string, unknown>;
  created_at: string;
  actor_email: string;
  actor_display_name: string;
};

export function useRecentActivities(workspaceId: string | null, boardId: string | null) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchActivities = useCallback(async () => {
    if (!workspaceId || !boardId) {
      setActivities([]);
      return;
    }

    setLoading(true);
    const supabase = createClient();

    const { data, error } = await supabase
      .from("task_activities")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("board_id", boardId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error || !data || data.length === 0) {
      setActivities([]);
      setLoading(false);
      return;
    }

    const actorIds = [...new Set(data.map((a) => a.actor_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email, display_name")
      .in("id", actorIds);

    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

    setActivities(
      data.map((a) => ({
        ...a,
        actor_email: profileMap.get(a.actor_id)?.email ?? "",
        actor_display_name: profileMap.get(a.actor_id)?.display_name ?? "",
        metadata: (a.metadata ?? {}) as Record<string, unknown>,
      })) as Activity[]
    );
    setLoading(false);
  }, [workspaceId, boardId]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  return { activities, loading, refresh: fetchActivities };
}
