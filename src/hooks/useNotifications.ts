"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import type { Activity } from "./useRecentActivities";

export type NotificationItem = Activity & {
  task_title?: string;
  board_title?: string;
};

export function useNotifications() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setNotifications([]);
        setLoading(false);
        return;
      }

      const { data: memberships, error: mError } = await supabase
        .from("workspace_members")
        .select("workspace_id, role")
        .eq("user_id", user.id);

      if (mError || !memberships || memberships.length === 0) {
        setNotifications([]);
        setLoading(false);
        return;
      }

      const workspaceIds = memberships.map((m) => m.workspace_id);
      const isOwnerOrAdmin = memberships.some(
        (m) => m.role === "owner" || m.role === "admin"
      );

      const { data: boards } = await supabase
        .from("boards")
        .select("id, workspace_id, title")
        .in("workspace_id", workspaceIds)
        .eq("is_closed", false);

      if (!boards || boards.length === 0) {
        setNotifications([]);
        setLoading(false);
        return;
      }

      const boardIds = boards.map((b) => b.id);
      const boardMap = new Map(boards.map((b) => [b.id, b]));

      let rawActivities: Record<string, unknown>[] = [];

      if (isOwnerOrAdmin) {
        const { data: activities } = await supabase
          .from("task_activities")
          .select("*")
          .in("board_id", boardIds)
          .neq("actor_id", user.id)
          .order("created_at", { ascending: false })
          .limit(50);

        rawActivities = (activities ?? []) as Record<string, unknown>[];
      } else {
        const { data: lists } = await supabase
          .from("lists")
          .select("id")
          .in("board_id", boardIds);

        if (!lists || lists.length === 0) {
          setNotifications([]);
          setLoading(false);
          return;
        }

        const listIds = lists.map((l) => l.id);

        const { data: assignedTasks } = await supabase
          .from("tasks")
          .select("id, title")
          .in("list_id", listIds)
          .eq("assignee_id", user.id);

        if (!assignedTasks || assignedTasks.length === 0) {
          setNotifications([]);
          setLoading(false);
          return;
        }

        const assignedTaskIds = assignedTasks.map((t) => t.id);
        const taskTitleMap = new Map(
          assignedTasks.map((t) => [t.id, t.title])
        );

        const { data: activities } = await supabase
          .from("task_activities")
          .select("*")
          .in("task_id", assignedTaskIds)
          .neq("actor_id", user.id)
          .order("created_at", { ascending: false })
          .limit(50);

        rawActivities = ((activities ?? []) as Record<string, unknown>[]).map(
          (a) => ({
            ...a,
            _task_title: taskTitleMap.get(a.task_id as string),
          })
        );
      }

      if (rawActivities.length === 0) {
        setNotifications([]);
        setLoading(false);
        return;
      }

      const actorIds = [
        ...new Set(
          rawActivities.map((a) => a.actor_id as string).filter(Boolean)
        ),
      ];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email, display_name")
        .in("id", actorIds);

      const profileMap = new Map(
        (profiles ?? []).map((p) => [p.id, p])
      );

      const taskIds = [
        ...new Set(
          rawActivities
            .map((a) => a.task_id as string)
            .filter(Boolean)
        ),
      ];
      let extraTaskTitles = new Map<string, string>();
      if (taskIds.length > 0) {
        const { data: tasks } = await supabase
          .from("tasks")
          .select("id, title")
          .in("id", taskIds);
        extraTaskTitles = new Map(
          (tasks ?? []).map((t) => [t.id, t.title])
        );
      }

      const items: NotificationItem[] = rawActivities.map((a) => {
        const taskTitle =
          (a._task_title as string | undefined) ??
          extraTaskTitles.get(a.task_id as string) ??
          ((a.metadata as Record<string, unknown>)?.task_title as string | undefined);

        return {
          id: a.id as string,
          workspace_id: a.workspace_id as string,
          board_id: a.board_id as string,
          task_id: (a.task_id as string) ?? null,
          actor_id: a.actor_id as string,
          action: a.action as string,
          metadata: (a.metadata ?? {}) as Record<string, unknown>,
          created_at: a.created_at as string,
          actor_email: profileMap.get(a.actor_id as string)?.email ?? "",
          actor_display_name:
            profileMap.get(a.actor_id as string)?.display_name ?? "",
          task_title: taskTitle,
          board_title: boardMap.get(a.board_id as string)?.title,
        };
      });

      setNotifications(items);
    } catch {
      setError("Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  return { notifications, loading, error, refresh: fetchNotifications };
}
