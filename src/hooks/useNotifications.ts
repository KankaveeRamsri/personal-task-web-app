"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase";
import type { Activity } from "./useRecentActivities";

export type NotificationItem = Activity & {
  task_title?: string;
  board_title?: string;
  is_read: boolean;
  is_important: boolean;
};

export function useNotifications() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setNotifications([]);
        if (!silent) setLoading(false);
        return;
      }

      const { data: memberships, error: mError } = await supabase
        .from("workspace_members")
        .select("workspace_id, role")
        .eq("user_id", user.id);

      if (mError || !memberships || memberships.length === 0) {
        setNotifications([]);
        if (!silent) setLoading(false);
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
        if (!silent) setLoading(false);
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
          if (!silent) setLoading(false);
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
          if (!silent) setLoading(false);
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
        if (!silent) setLoading(false);
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

      const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

      // Fetch task titles + assignee_ids for importance detection
      const taskIds = [
        ...new Set(
          rawActivities.map((a) => a.task_id as string).filter(Boolean)
        ),
      ];
      let extraTaskTitles = new Map<string, string>();
      let taskAssigneeMap = new Map<string, string | null>();
      if (taskIds.length > 0) {
        const { data: tasks } = await supabase
          .from("tasks")
          .select("id, title, assignee_id")
          .in("id", taskIds);
        for (const t of tasks ?? []) {
          extraTaskTitles.set(t.id, t.title);
          taskAssigneeMap.set(t.id, t.assignee_id);
        }
      }

      // Fetch read state
      const activityIds = rawActivities.map((a) => a.id as string);
      const { data: reads } = await supabase
        .from("notification_reads")
        .select("activity_id")
        .eq("user_id", user.id)
        .in("activity_id", activityIds);

      const readSet = new Set((reads ?? []).map((r) => r.activity_id));

      const IMPORTANT_ACTIONS = new Set(["task_assigned", "due_date_changed"]);

      const items: NotificationItem[] = rawActivities.map((a) => {
        const taskTitle =
          (a._task_title as string | undefined) ??
          extraTaskTitles.get(a.task_id as string) ??
          ((a.metadata as Record<string, unknown>)?.task_title as
            | string
            | undefined);

        const action = a.action as string;
        const taskId = a.task_id as string;
        const isImportant =
          IMPORTANT_ACTIONS.has(action) &&
          !!taskId &&
          taskAssigneeMap.get(taskId) === user.id;

        return {
          id: a.id as string,
          workspace_id: a.workspace_id as string,
          board_id: a.board_id as string,
          task_id: taskId ?? null,
          actor_id: a.actor_id as string,
          action,
          metadata: (a.metadata ?? {}) as Record<string, unknown>,
          created_at: a.created_at as string,
          actor_email: profileMap.get(a.actor_id as string)?.email ?? "",
          actor_display_name:
            profileMap.get(a.actor_id as string)?.display_name ?? "",
          task_title: taskTitle,
          board_title: boardMap.get(a.board_id as string)?.title,
          is_read: readSet.has(a.id as string),
          is_important: isImportant,
        };
      });

      setNotifications(items);
    } catch {
      if (!silent) setError("Failed to load notifications");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Realtime subscription: throttled silent refresh on new activity
  const lastRefreshRef = useRef(0);
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    let stale = false;
    const supabase = createClient();

    supabase.auth.getUser().then(({ data }) => {
      if (stale || !data.user) return;
      userIdRef.current = data.user.id;

      channelRef.current = supabase
        .channel("notifications-feed")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "task_activities",
          },
          (payload: { new: Record<string, unknown> }) => {
            const actorId = payload.new.actor_id as string;
            if (!actorId || actorId === userIdRef.current) return;

            const now = Date.now();
            if (now - lastRefreshRef.current < 2000) return;
            lastRefreshRef.current = now;

            fetchNotifications(true);
          }
        )
        .subscribe();
    });

    return () => {
      stale = true;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [fetchNotifications]);

  const markAllAsRead = useCallback(async () => {
    const unread = notifications.filter((n) => !n.is_read);
    if (unread.length === 0) return false;

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;

    const rows = unread.map((n) => ({
      user_id: user.id,
      activity_id: n.id,
    }));

    const { error: upsertError } = await supabase
      .from("notification_reads")
      .upsert(rows, { onConflict: "user_id,activity_id" });

    if (upsertError) return false;

    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));

    window.dispatchEvent(new CustomEvent("notifications-read"));
    return true;
  }, [notifications]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const importantUnreadCount = notifications.filter(
    (n) => !n.is_read && n.is_important
  ).length;

  return {
    notifications,
    loading,
    error,
    refresh: () => fetchNotifications(false),
    markAllAsRead,
    unreadCount,
    importantUnreadCount,
  };
}
