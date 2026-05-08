"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { useBoardData } from "@/hooks/useBoardData";
import { useWorkspaceMembers } from "@/hooks/useWorkspaceMembers";
import { useRecentActivities } from "@/hooks/useRecentActivities";
import type { Activity } from "@/hooks/useRecentActivities";
import type { Task } from "@/types/database";

// ── AI Insight Types ─────────────────────────────────────────────
interface DashboardInsight {
  id: string;
  type: "alert" | "warning" | "info" | "success";
  text: string;
}

// ── Helpers ──────────────────────────────────────────────────────

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function formatDate() {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function priorityBadge(priority: string) {
  const styles: Record<string, string> = {
    high: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
    medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
    low: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  };
  return styles[priority] ?? "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400";
}

function getListColor(title: string, paletteIndex: number, listColor?: string): string {
  if (listColor) {
    const hexToBg: Record<string, string> = {
      "#a1a1aa": "bg-zinc-400",
      "#3b82f6": "bg-blue-500",
      "#10b981": "bg-emerald-500",
      "#f97316": "bg-orange-500",
      "#ef4444": "bg-red-500",
      "#8b5cf6": "bg-violet-500",
      "#ec4899": "bg-pink-500",
      "#eab308": "bg-yellow-500",
    };
    return hexToBg[listColor.toLowerCase()] ?? "bg-zinc-400";
  }
  const defaults: Record<string, string> = {
    "To Do": "bg-zinc-400",
    "In Progress": "bg-amber-500",
    "Done": "bg-emerald-500",
    "Completed": "bg-emerald-500",
  };
  if (defaults[title]) return defaults[title];
  const palette = [
    "bg-violet-400", "bg-sky-400", "bg-rose-400",
    "bg-teal-400", "bg-orange-400", "bg-pink-400", "bg-cyan-400",
  ];
  return palette[paletteIndex % palette.length];
}

function getLocalDate(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Monday-based start of week (local time, no locale dependency) */
function getStartOfWeek(d: Date): Date {
  const local = getLocalDate(d);
  const day = local.getDay(); // 0=Sun
  const diff = day === 0 ? 6 : day - 1; // Mon=0
  local.setDate(local.getDate() - diff);
  return local;
}

/** Deterministic date key "YYYY-MM-DD" (no locale formatting) */
function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function isCompletedTask(task: { is_completed: boolean; list_id: string }, doneListIds: Set<string>): boolean {
  if (task.is_completed) return true;
  return doneListIds.has(task.list_id);
}

function formatActivityLine(a: Activity): string {
  const name = a.actor_display_name || a.actor_email || "Someone";
  const m = a.metadata ?? {};
  const title = (m.task_title as string) ?? "a task";
  const targetName = (m.target_user_name as string) ?? (m.target_user_email as string) ?? "someone";
  const fmt = (col: string) => col === "Done" ? "Completed" : col;

  switch (a.action) {
    case "task_created":
      return `${name} created "${title}"`;
    case "task_updated":
      return `${name} updated "${title}"`;
    case "task_moved":
      return `${name} moved "${title}" to ${fmt((m.to as string) ?? "")}`;
    case "task_assigned":
      return m.assignee_name
        ? `${name} assigned "${title}" to ${m.assignee_name}`
        : `${name} unassigned "${title}"`;
    case "due_date_changed":
      return `${name} changed due date of "${title}"`;
    case "task_deleted":
      return `${name} deleted "${title}"`;
    case "bulk_moved":
      return `${name} moved ${m.count} task${(m.count as number) > 1 ? "s" : ""} to ${fmt((m.to as string) ?? "")}`;
    case "bulk_deleted":
      return `${name} deleted ${m.count} task${(m.count as number) > 1 ? "s" : ""}`;
    case "invited":
      return `${name} invited ${targetName} to team`;
    case "role_changed":
      return `${name} changed role of ${targetName} to ${m.new_role}`;
    case "removed":
      return `${name} removed ${targetName} from team`;
    default:
      return `${name} ${a.action.replace(/_/g, " ")}`;
  }
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const actionIcon: Record<string, string> = {
  task_created: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400",
  task_updated: "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400",
  task_moved: "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400",
  task_assigned: "bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400",
  due_date_changed: "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400",
  task_deleted: "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400",
  bulk_moved: "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400",
  bulk_deleted: "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400",
  invited: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400",
  role_changed: "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400",
  removed: "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400",
};

// ── Dashboard Page ───────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUserEmail(data.user.email ?? "");
        setUserName(
          data.user.user_metadata?.full_name ||
          data.user.email?.split("@")[0] ||
          ""
        );
      }
    });
  }, []);

  const {
    workspaces,
    selectedWorkspaceId,
    setSelectedWorkspaceId,
    boards,
    selectedBoardId,
    setSelectedBoardId,
    lists,
    tasks,
    loading,
    updateTask,
  } = useBoardData();

  const { members, currentRole } = useWorkspaceMembers(selectedWorkspaceId);
  const { activities } = useRecentActivities(selectedWorkspaceId, selectedBoardId);

  const displayName = userName || userEmail.split("@")[0] || "there";

  // ── Derived context ─────────────────────────────────────────

  const workspaceName = useMemo(
    () => workspaces.find((w) => w.id === selectedWorkspaceId)?.name ?? "",
    [workspaces, selectedWorkspaceId]
  );

  const boardName = useMemo(
    () => boards.find((b) => b.id === selectedBoardId)?.title ?? "",
    [boards, selectedBoardId]
  );

  const listTitleMap = useMemo(() => {
    const map = new Map<string, string>();
    lists.forEach((l) => map.set(l.id, l.title));
    return map;
  }, [lists]);

  const listBoardMap = useMemo(() => {
    const map = new Map<string, string>();
    lists.forEach((l) => map.set(l.id, l.board_id));
    return map;
  }, [lists]);

  const listColorMap = useMemo(() => {
    const map = new Map<string, string>();
    let customIdx = 0;
    lists.forEach((l) => {
      map.set(l.title, getListColor(l.title, customIdx, l.color || undefined));
      if (!{ "To Do": 1, "In Progress": 1, "Done": 1, "Completed": 1 }[l.title]) {
        customIdx++;
      }
    });
    return map;
  }, [lists]);

  // ── Derived counts ──────────────────────────────────────────

  const doneListIds = useMemo(
    () => new Set(lists.filter((l) => l.is_done).map((l) => l.id)),
    [lists]
  );

  const tasksByListTitle = useMemo(() => {
    const groups: Record<string, number> = {};
    lists.forEach((l) => {
      groups[l.title] = 0;
    });
    tasks.forEach((t) => {
      const title = listTitleMap.get(t.list_id) ?? "Other";
      groups[title] = (groups[title] ?? 0) + 1;
    });
    return groups;
  }, [tasks, lists, listTitleMap]);

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => isCompletedTask(t, doneListIds)).length;
  const inProgressTasks = tasksByListTitle["In Progress"] ?? 0;
  const completionPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const overdueTasks = useMemo(() => {
    const today = getLocalDate(new Date());
    return tasks
      .filter((t) => {
        if (isCompletedTask(t, doneListIds)) return false;
        if (!t.due_date) return false;
        const target = getLocalDate(new Date(t.due_date + "T00:00:00"));
        return target < today;
      })
      .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime());
  }, [tasks, doneListIds]);

  const dueTodayTasks = useMemo(() => {
    const today = getLocalDate(new Date());
    return tasks.filter((t) => {
      if (isCompletedTask(t, doneListIds)) return false;
      if (!t.due_date) return false;
      const target = getLocalDate(new Date(t.due_date + "T00:00:00"));
      return target.getTime() === today.getTime();
    });
  }, [tasks, doneListIds]);

  const dueTodayCount = dueTodayTasks.length;
  const overdueCount = overdueTasks.length;

  // ── Focus Today action helpers ────────────────────────────────
  // Combined list: overdue first, then due today (same order as Focus Today UI)
  const focusTasks = useMemo(
    () => [...overdueTasks, ...dueTodayTasks],
    [overdueTasks, dueTodayTasks]
  );

  // Find the first done list for the current board
  const completedListId = useMemo(() => {
    const cl = lists.find((l) => l.is_done);
    return cl?.id ?? null;
  }, [lists]);

  const canEditTasks = !currentRole || ["owner", "admin", "member"].includes(currentRole);
  const canComplete = canEditTasks && focusTasks.length > 0 && !!completedListId;

  const [completingAll, setCompletingAll] = useState(false);

  const handleCompleteAll = useCallback(async () => {
    if (!canComplete || completingAll || !completedListId) return;
    setCompletingAll(true);

    // Snapshot for rollback
    const snapshot = focusTasks.map((t) => ({ id: t.id, list_id: t.list_id, is_completed: t.is_completed }));

    let failed = false;
    for (const task of focusTasks) {
      const result = await updateTask(task.id, {
        list_id: completedListId,
        is_completed: true,
      } as Partial<Task>);
      if (!result) {
        failed = true;
        break;
      }
    }

    if (failed) {
      // Rollback: restore original list_id and is_completed for tasks that were already updated
      for (const snap of snapshot) {
        await updateTask(snap.id, {
          list_id: snap.list_id,
          is_completed: snap.is_completed,
        } as Partial<Task>).catch(() => {});
      }
    }

    setCompletingAll(false);
  }, [canComplete, completingAll, completedListId, focusTasks, updateTask]);

  const handleStartFocus = useCallback(() => {
    if (focusTasks.length === 0) return;
    const task = focusTasks[0]; // first overdue, then first due today
    const boardId = listBoardMap.get(task.list_id);
    if (boardId) {
      router.push(`/dashboard/board?boardId=${boardId}&taskId=${task.id}`);
    }
  }, [focusTasks, listBoardMap, router]);

  const todayTasks = useMemo(() => {
    const today = getLocalDate(new Date());
    return tasks.filter((t) => {
      if (!t.due_date) return false;
      const d = getLocalDate(new Date(t.due_date + "T00:00:00"));
      return d.getTime() === today.getTime();
    });
  }, [tasks]);

  const completedTodayCount = useMemo(() =>
    todayTasks.filter(t => isCompletedTask(t, doneListIds)).length
  , [todayTasks, doneListIds]);

  const totalTodayCount = todayTasks.length;

  const unassignedCount = useMemo(() => tasks.filter((t) => !t.assignee_id).length, [tasks]);

  const assigneeSummary = useMemo(() => {
    const summary: { id: string; name: string; count: number }[] = [];
    const unassigned = tasks.filter((t) => !t.assignee_id).length;
    if (unassigned > 0) summary.push({ id: "__unassigned__", name: "Unassigned", count: unassigned });
    members.forEach((m) => {
      const count = tasks.filter((t) => t.assignee_id === m.user_id).length;
      if (count > 0) summary.push({ id: m.user_id, name: m.display_name || m.email, count });
    });
    return summary.sort((a, b) => b.count - a.count);
  }, [tasks, members]);

  const statCards = useMemo(
    () => [
      {
        label: "Total Tasks",
        value: String(totalTasks),
        change: "Across all boards",
        accent: "text-zinc-600 dark:text-zinc-400",
        iconBg: "bg-zinc-100 dark:bg-zinc-800",
        icon: (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
          </svg>
        ),
        badge: overdueCount > 0 ? `⚠️ ${overdueCount} overdue` : null,
      },
      {
        label: "In Progress",
        value: String(inProgressTasks),
        change: inProgressTasks === 0 ? "No active tasks" : inProgressTasks > 5 ? "High workload" : "Tasks in progress",
        accent: "text-amber-600 dark:text-amber-400",
        iconBg: "bg-amber-50 dark:bg-amber-900/30",
        icon: (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
        ),
      },
      {
        label: "Completed",
        value: String(completedTasks),
        change: `${completedTasks} of ${totalTasks} done`,
        accent: "text-emerald-600 dark:text-emerald-400",
        iconBg: "bg-emerald-50 dark:bg-emerald-900/30",
        icon: (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
        ),
        progressPct: completionPct,
      },
    ],
    [totalTasks, inProgressTasks, completedTasks, completionPct, overdueCount]
  );

  // ── AI: Dashboard Insights (rule-based) ──────────────────────────────
  const dashboardInsights = useMemo((): DashboardInsight[] => {
    if (totalTasks === 0) return [];
    const insights: DashboardInsight[] = [];
    const today = getLocalDate(new Date());

    // A. Long overdue (>3 days)
    const longOverdueCount = overdueTasks.filter((t) => {
      const due = getLocalDate(new Date(t.due_date! + "T00:00:00"));
      return Math.floor((today.getTime() - due.getTime()) / 86400000) > 3;
    }).length;
    if (longOverdueCount > 0) {
      insights.push({ id: "overdue-long", type: "alert", text: `${longOverdueCount} งานเลยกำหนดนานกว่า 3 วัน — ควรจัดการด่วน` });
    } else if (overdueCount > 0) {
      insights.push({ id: "overdue", type: "warning", text: `${overdueCount} งานเลยกำหนด — แนะนำให้เคลียร์ก่อนรับงานใหม่` });
    }

    // B. Near-due (1–2 days ahead)
    const nearDueCount = tasks.filter((t) => {
      if (isCompletedTask(t, doneListIds) || !t.due_date) return false;
      const due = getLocalDate(new Date(t.due_date + "T00:00:00"));
      const diff = Math.floor((due.getTime() - today.getTime()) / 86400000);
      return diff >= 1 && diff <= 2;
    }).length;
    if (nearDueCount > 0) {
      insights.push({ id: "near-due", type: "warning", text: `${nearDueCount} งานจะครบกำหนดใน 1–2 วัน — เตรียมพร้อม` });
    }

    // C. Bottleneck list detection
    const nonDoneLists = lists.filter((l) => !l.is_done);
    let bottleneck: { title: string; count: number } | null = null;
    for (const list of nonDoneLists) {
      const pending = tasks.filter((t) => t.list_id === list.id && !isCompletedTask(t, doneListIds)).length;
      if (!bottleneck || pending > bottleneck.count) bottleneck = { title: list.title, count: pending };
    }
    if (bottleneck && bottleneck.count >= 5) {
      insights.push({ id: "bottleneck", type: "info", text: `"${bottleneck.title}" มีงานค้าง ${bottleneck.count} งาน — อาจกลายเป็น bottleneck` });
    }

    // D. Unassigned task ratio
    const activeUnassigned = tasks.filter((t) => !t.assignee_id && !isCompletedTask(t, doneListIds)).length;
    const activeTasks = tasks.filter((t) => !isCompletedTask(t, doneListIds)).length;
    const unassignedRatio = activeTasks > 0 ? activeUnassigned / activeTasks : 0;
    if (unassignedRatio > 0.4 && activeTasks >= 4) {
      insights.push({ id: "unassigned", type: "info", text: `งาน active ${Math.round(unassignedRatio * 100)}% ยังไม่มีผู้รับผิดชอบ — แนะนำมอบหมาย` });
    }

    // E. Overloaded member
    const assignedMembers = assigneeSummary.filter((s) => s.id !== "__unassigned__");
    if (assignedMembers.length >= 1 && totalTasks > 0) {
      const top = assignedMembers[0];
      const topPct = Math.round((top.count / totalTasks) * 100);
      if (topPct > 55 && top.count >= 3) {
        insights.push({ id: "overloaded", type: "warning", text: `${top.name} รับงานกว่า ${topPct}% ของ workspace — ควรกระจายงาน` });
      }
    }

    // F. Healthy workspace signal
    if (insights.length === 0 && completionPct >= 60) {
      insights.push({ id: "healthy", type: "success", text: `Completion rate ${completionPct}% — workspace สุขภาพดี รักษาฟอร์มนี้ไว้` });
    } else if (insights.length === 0) {
      insights.push({ id: "on-track", type: "info", text: `ไม่พบสัญญาณเสี่ยง — ทุกอย่างดำเนินไปตามแผน` });
    }

    return insights.slice(0, 4);
  }, [tasks, lists, doneListIds, totalTasks, overdueCount, overdueTasks, completionPct, assigneeSummary]);

  // ── AI: Focus task reasoning ──────────────────────────────────────────
  const focusTaskReasonMap = useMemo(() => {
    const map = new Map<string, string>();
    const today = getLocalDate(new Date());
    focusTasks.forEach((task) => {
      const parts: string[] = [];
      if (task.due_date) {
        const due = getLocalDate(new Date(task.due_date + "T00:00:00"));
        if (due < today) {
          const days = Math.floor((today.getTime() - due.getTime()) / 86400000);
          parts.push(`เลยกำหนด ${days} วัน`);
        }
      }
      if (task.priority === "high") parts.push("priority สูง");
      else if (task.priority === "medium") parts.push("priority กลาง");
      if (parts.length > 0) map.set(task.id, parts.join(" · "));
    });
    return map;
  }, [focusTasks]);

  // ── AI: Workload intelligence signal ─────────────────────────────────
  const workloadSignal = useMemo((): string | null => {
    if (assigneeSummary.length === 0 || totalTasks === 0) return null;
    const assignedMembers = assigneeSummary.filter((s) => s.id !== "__unassigned__");
    if (assignedMembers.length >= 1) {
      const top = assignedMembers[0];
      const pct = Math.round((top.count / totalTasks) * 100);
      if (pct > 55 && top.count >= 3) return `${top.name} มีภาระงานสูงกว่าคนอื่น`;
    }
    const unassignedEntry = assigneeSummary.find((s) => s.id === "__unassigned__");
    if (unassignedEntry) {
      const uPct = Math.round((unassignedEntry.count / totalTasks) * 100);
      if (uPct > 35 && unassignedEntry.count >= 3) return `งาน ${uPct}% ยังไม่มีผู้รับผิดชอบ`;
    }
    if (assignedMembers.length >= 2) {
      const maxCount = assignedMembers[0].count;
      const minCount = assignedMembers[assignedMembers.length - 1].count;
      if (maxCount > 0 && maxCount > minCount * 3) return `ภาระงานกระจุกตัว — ลองกระจายงานเพิ่ม`;
    }
    return null;
  }, [assigneeSummary, totalTasks]);

  // ── AI: Workspace intelligence one-liner ─────────────────────────────
  const workspaceIntelligence = useMemo((): string | null => {
    if (totalTasks === 0) return null;
    if (overdueCount > 3) return `${overdueCount} งานเลยกำหนด — ต้องการความสนใจ`;
    if (completionPct >= 80) return `${completionPct}% เสร็จแล้ว — ทำได้ดีมาก`;
    const recentCreated = activities.filter((a) => a.action === "task_created").length;
    const recentMoved = activities.filter((a) => a.action === "task_moved").length;
    if (recentCreated >= 3) return `${recentCreated} งานใหม่เพิ่งถูกสร้าง · workspace กำลังเติบโต`;
    if (recentMoved >= 3) return `${recentMoved} งานถูกเคลื่อนไหว recently · ทีมกำลัง active`;
    return null;
  }, [totalTasks, overdueCount, completionPct, activities]);

  // Priority Tasks: top 5 urgent items
  const priorityTasks = useMemo(() => {
    const today = getLocalDate(new Date());
    return [...tasks]
      .filter((t) => !isCompletedTask(t, doneListIds))
      .sort((a, b) => {
        const dateA = a.due_date ? getLocalDate(new Date(a.due_date + "T00:00:00")) : null;
        const dateB = b.due_date ? getLocalDate(new Date(b.due_date + "T00:00:00")) : null;

        // 1. Check overdue
        const isOverdueA = dateA && dateA < today;
        const isOverdueB = dateB && dateB < today;
        if (isOverdueA && !isOverdueB) return -1;
        if (!isOverdueA && isOverdueB) return 1;

        // 2. Check due today
        const isTodayA = dateA && dateA.getTime() === today.getTime();
        const isTodayB = dateB && dateB.getTime() === today.getTime();
        if (isTodayA && !isTodayB) return -1;
        if (!isTodayA && isTodayB) return 1;

        // 3. Priority HIGH
        if (a.priority === "high" && b.priority !== "high") return -1;
        if (a.priority !== "high" && b.priority === "high") return 1;

        // 4. Sort by due date (nearest first)
        if (dateA && dateB) return dateA.getTime() - dateB.getTime();
        if (dateA) return -1;
        if (dateB) return 1;

        // 5. Default by created_at
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      })
      .slice(0, 5);
  }, [tasks, listTitleMap]);

  // ── Status colors matching Progress Overview ────────────────
  const STATUS_COLORS = {
    todo:       { bar: "bg-zinc-400",    dot: "bg-zinc-400" },
    inProgress: { bar: "bg-amber-500",   dot: "bg-amber-500" },
    completed:  { bar: "bg-emerald-500", dot: "bg-emerald-500" },
  } as const;

  // Progress bars per list
  const progressItems = useMemo(() => {
    return lists.map((l) => ({
      label: l.title === "Done" ? "Completed" : l.title,
      count: tasksByListTitle[l.title] ?? 0,
      total: totalTasks,
      color: listColorMap.get(l.title) ?? "bg-zinc-400",
    }));
  }, [lists, tasksByListTitle, totalTasks, listColorMap]);

  // ── Weekly chart data (tasks created this week by current status) ──
  const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

  const weeklyChartData = useMemo(() => {
    const now = new Date();
    const weekStart = getStartOfWeek(now);

    // Build keys for Mon–Sun
    const dayKeys: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      dayKeys.push(toDateKey(d));
    }

    // Classify each task's status
    type StatusKey = "todo" | "inProgress" | "completed";
    function classifyStatus(task: { is_completed: boolean; list_id: string }): StatusKey {
      if (task.is_completed || doneListIds.has(task.list_id)) return "completed";
      const title = listTitleMap.get(task.list_id) ?? "";
      if (title === "In Progress") return "inProgress";
      return "todo";
    }

    // Init counts
    const counts: Record<string, { todo: number; inProgress: number; completed: number }> = {};
    dayKeys.forEach((k) => { counts[k] = { todo: 0, inProgress: 0, completed: 0 }; });

    // Populate
    tasks.forEach((t) => {
      const key = toDateKey(new Date(t.created_at));
      if (counts[key]) {
        counts[key][classifyStatus(t)]++;
      }
    });

    // Build chart data
    let maxCount = 0;
    const days = WEEKDAY_LABELS.map((label, i) => {
      const c = counts[dayKeys[i]];
      maxCount = Math.max(maxCount, c.todo, c.inProgress, c.completed);
      return { label, todo: c.todo, inProgress: c.inProgress, completed: c.completed };
    });

    return { days, maxCount };
  }, [tasks, listTitleMap, doneListIds]);

  const groupedActivities = useMemo(() => {
    const today = getLocalDate(new Date());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const groups: { title: string; items: Activity[] }[] = [
      { title: "Today", items: [] },
      { title: "Yesterday", items: [] },
      { title: "Earlier", items: [] },
    ];

    activities.slice(0, 10).forEach((a) => {
      const d = getLocalDate(new Date(a.created_at));
      if (d.getTime() === today.getTime()) {
        groups[0].items.push(a);
      } else if (d.getTime() === yesterday.getTime()) {
        groups[1].items.push(a);
      } else {
        groups[2].items.push(a);
      }
    });

    return groups.filter((g) => g.items.length > 0);
  }, [activities]);

  const getActivityLink = (a: Activity) => {
    const m = a.metadata ?? {};
    if (["invited", "role_changed", "removed"].includes(a.action)) {
      return "/dashboard/team";
    }
    if (m.task_id && m.board_id) {
      return `/dashboard/board?boardId=${m.board_id}&taskId=${m.task_id}`;
    }
    return null;
  };

  // ── Loading ──────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl space-y-5 px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        <div className="h-48 w-full nx-skeleton-card rounded-2xl" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="h-64 nx-skeleton-card rounded-2xl" />
          <div className="h-64 nx-skeleton-card rounded-2xl" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 nx-skeleton-card rounded-2xl" />
          ))}
        </div>
        <div className="h-24 nx-skeleton-card rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 sm:px-6 lg:px-8 py-4 sm:py-6">

      {/* ── A. AI COMMAND CENTER ─────────────────────────────── */}
      <section className="rounded-2xl border border-zinc-200/70 bg-white shadow-sm overflow-hidden dark:border-zinc-800 dark:bg-zinc-900">

        {/* Header row: greeting + workspace nav + team */}
        <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-start gap-4 justify-between">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              {getGreeting()}, {displayName}
            </h1>
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-400 dark:text-zinc-500">
              <span>{formatDate()}</span>
              {workspaces.length > 0 && selectedWorkspaceId && (
                <>
                  <span className="text-zinc-200 dark:text-zinc-700">&middot;</span>
                  <select
                    value={selectedWorkspaceId ?? ""}
                    onChange={(e) => setSelectedWorkspaceId(e.target.value)}
                    className="rounded border border-zinc-200 bg-transparent px-1.5 py-px text-xs text-zinc-600 focus:outline-none dark:border-zinc-700 dark:text-zinc-400"
                  >
                    {workspaces.map((ws) => (
                      <option key={ws.id} value={ws.id}>{ws.icon} {ws.name}</option>
                    ))}
                  </select>
                </>
              )}
              {selectedWorkspaceId && boards.length > 0 && selectedBoardId && (
                <>
                  <span className="text-zinc-300 dark:text-zinc-600">/</span>
                  <select
                    value={selectedBoardId ?? ""}
                    onChange={(e) => setSelectedBoardId(e.target.value)}
                    className="rounded border border-zinc-200 bg-transparent px-1.5 py-px text-xs text-zinc-600 focus:outline-none dark:border-zinc-700 dark:text-zinc-400"
                  >
                    {boards.map((b) => (
                      <option key={b.id} value={b.id}>{b.title}</option>
                    ))}
                  </select>
                </>
              )}
            </div>
          </div>

          <div className="flex items-start gap-5 shrink-0">
            {/* Ambient stats */}
            {totalTasks > 0 && (
              <div className="hidden sm:flex items-center gap-3 text-xs pt-0.5">
                <span className="text-zinc-400 dark:text-zinc-500">
                  <span className="font-semibold tabular-nums text-zinc-700 dark:text-zinc-200">{totalTasks}</span> tasks
                </span>
                <span className="text-zinc-200 dark:text-zinc-700">&middot;</span>
                <span className="text-zinc-400 dark:text-zinc-500">
                  <span className="font-semibold tabular-nums text-zinc-700 dark:text-zinc-200">{completionPct}%</span> done
                </span>
                {overdueCount > 0 && (
                  <>
                    <span className="text-zinc-200 dark:text-zinc-700">&middot;</span>
                    <span className="flex items-center gap-1 font-medium text-red-500">
                      <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
                      {overdueCount} overdue
                    </span>
                  </>
                )}
              </div>
            )}

            {/* Team avatars */}
            <div className="flex items-center">
              {members.slice(0, 4).map((m, i) => {
                const name = m.display_name || m.email;
                const initials = name.split(/[\s._-]+/).map(w => w[0]).join("").slice(0, 2).toUpperCase() || name[0]?.toUpperCase() || "?";
                const colors = ["bg-violet-500", "bg-sky-500", "bg-emerald-500", "bg-amber-500"];
                return (
                  <div
                    key={m.user_id}
                    title={`${m.display_name || m.email}${m.role !== "member" ? ` (${m.role})` : ""}`}
                    className={`flex h-7 w-7 items-center justify-center rounded-full ${colors[i % colors.length]} text-[10px] font-semibold text-white ring-2 ring-white dark:ring-zinc-900 hover:scale-110 transition-transform cursor-default ${i > 0 ? "-ml-2" : ""}`}
                  >
                    {initials}
                  </div>
                );
              })}
              {members.length > 4 && (
                <div className="flex h-7 w-7 -ml-2 items-center justify-center rounded-full bg-zinc-200 text-[10px] font-semibold text-zinc-600 ring-2 ring-white dark:bg-zinc-700 dark:text-zinc-300 dark:ring-zinc-900">
                  +{members.length - 4}
                </div>
              )}
              <button
                title="Invite members"
                className="flex h-7 w-7 -ml-2 items-center justify-center rounded-full border-2 border-dashed border-zinc-300 text-zinc-400 ring-2 ring-white hover:border-zinc-400 hover:text-zinc-600 dark:border-zinc-600 dark:ring-zinc-900 dark:hover:border-zinc-400 transition-all"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Nexdo AI Insights */}
        {dashboardInsights.length > 0 && (
          <div className="border-t border-zinc-100 dark:border-zinc-800 px-6 py-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-zinc-900 dark:bg-zinc-100 shrink-0">
                <svg className="h-3 w-3 text-white dark:text-zinc-900" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                </svg>
              </span>
              <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Nexdo AI</span>
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500">Workspace Intelligence</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              {dashboardInsights.map((insight) => {
                const insightStyles: Record<string, string> = {
                  alert:   "border-red-100 bg-red-50/60 text-red-700 dark:border-red-900/30 dark:bg-red-950/20 dark:text-red-400",
                  warning: "border-amber-100 bg-amber-50/60 text-amber-700 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-400",
                  info:    "border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-400",
                  success: "border-emerald-100 bg-emerald-50/60 text-emerald-700 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-400",
                };
                return (
                  <div key={insight.id} className={`rounded-xl border px-3.5 py-2.5 text-xs leading-relaxed ${insightStyles[insight.type]}`}>
                    {insight.text}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Quick Actions + workspace signal */}
        <div className="border-t border-zinc-100 dark:border-zinc-800 px-6 py-3 flex flex-wrap items-center gap-2 bg-zinc-50/50 dark:bg-zinc-800/20">
          <Link href="/dashboard/board" className="nx-btn-primary text-xs">
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New Task
          </Link>
          {overdueCount > 0 && (
            <Link href="/dashboard/board" className="nx-btn-danger text-xs">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
              Fix Overdue ({overdueCount})
            </Link>
          )}
          {dueTodayCount > 0 && (
            <Link href="/dashboard/tasks" className="nx-btn-secondary text-xs">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
              </svg>
              Plan Today ({dueTodayCount})
            </Link>
          )}
          {members.length < 2 && (
            <Link href="/dashboard/team" className="nx-btn-ghost text-xs">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
              </svg>
              Invite Team
            </Link>
          )}
          {workspaceIntelligence && (
            <span className="ml-auto flex items-center gap-1.5 text-[11px] text-zinc-400 dark:text-zinc-500">
              <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
              </svg>
              {workspaceIntelligence}
            </span>
          )}
        </div>
      </section>

      {/* ── B. EXECUTION ZONE ────────────────────────────────── */}

      {/* ── B. EXECUTION ZONE ─────────────────────────────── */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* B1. Today's Focus — unified */}
        <div className="nx-card shadow-sm overflow-hidden">
          <div className="nx-card-header">
            <div className="space-y-0.5">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Today&apos;s Focus</h2>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
                {focusTasks.length > 0
                  ? `${overdueCount} overdue · ${dueTodayTasks.length} due today`
                  : "You're all caught up"}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleCompleteAll}
                disabled={!canComplete || completingAll}
                className="nx-btn-accent text-[11px] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {completingAll ? "..." : "Complete All"}
              </button>
              <button
                onClick={handleStartFocus}
                disabled={focusTasks.length === 0}
                className="nx-btn-secondary text-[11px] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Start Focus
              </button>
            </div>
          </div>

          {totalTodayCount > 0 && (
            <div className="px-5 py-2.5 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center justify-between text-[10px] text-zinc-400 dark:text-zinc-500 mb-1.5">
                <span>Today&apos;s progress</span>
                <span>{completedTodayCount} / {totalTodayCount}</span>
              </div>
              <div className="h-1 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-zinc-900 dark:bg-zinc-100 rounded-full transition-all duration-500"
                  style={{ width: `${totalTodayCount > 0 ? (completedTodayCount / totalTodayCount) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}

          {focusTasks.length > 0 ? (
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {focusTasks.slice(0, 6).map((task) => {
                const isOverdue = overdueTasks.some((t) => t.id === task.id);
                return (
                  <li key={task.id}>
                    <Link
                      href={`/dashboard/board?boardId=${listBoardMap.get(task.list_id)}&taskId=${task.id}`}
                      className="group flex items-center gap-3 px-5 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                    >
                      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${isOverdue ? "bg-red-400 animate-pulse" : "bg-orange-400"}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate group-hover:text-zinc-900 dark:group-hover:text-zinc-100 transition-colors">
                          {task.title}
                        </p>
                        <p className="text-[10px] mt-0.5 flex items-center gap-1.5">
                          {isOverdue ? (
                            <span className="text-red-400 font-medium">
                              {focusTaskReasonMap.get(task.id) || "Overdue"}
                            </span>
                          ) : (
                            <span className="text-orange-400 font-medium">Due today</span>
                          )}
                          <span className="text-zinc-300 dark:text-zinc-600">&middot;</span>
                          <span className="text-zinc-400 dark:text-zinc-500">{listTitleMap.get(task.list_id) || "Task"}</span>
                        </p>
                      </div>
                      {task.priority && task.priority !== "none" && (
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${priorityBadge(task.priority)}`}>
                          {task.priority}
                        </span>
                      )}
                      <svg className="h-4 w-4 text-zinc-300 group-hover:text-zinc-500 dark:group-hover:text-zinc-400 transition-colors shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                      </svg>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="nx-empty py-10">
              <div className="nx-empty-icon">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              </div>
              <p className="nx-empty-title">You&apos;re all caught up</p>
              <p className="nx-empty-desc">No overdue or due-today tasks.</p>
            </div>
          )}

          {focusTasks.length > 6 && (
            <div className="border-t border-zinc-100 dark:border-zinc-800 px-5 py-2.5">
              <Link href="/dashboard/tasks" className="text-xs font-medium text-zinc-400 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-200 transition-colors">
                View all {focusTasks.length} urgent tasks &rarr;
              </Link>
            </div>
          )}
        </div>

        {/* B2. Execution Queue */}
        <div className="nx-card shadow-sm overflow-hidden">
          <div className="nx-card-header">
            <div className="space-y-0.5">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Execution Queue</h2>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500">AI-ranked by urgency</p>
            </div>
            <span className="nx-badge-muted">Top {priorityTasks.length}</span>
          </div>
          {priorityTasks.length > 0 ? (
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800 max-h-72 overflow-y-auto">
              {priorityTasks.map((task) => {
                const listTitle = listTitleMap.get(task.list_id) ?? "";
                const taskStatus = listTitle === "Done" ? "Completed" : (listTitle || "To Do");
                const dotColor = listColorMap.get(listTitle) ?? "bg-zinc-300";
                const todayDate = getLocalDate(new Date());
                const dueDate = task.due_date ? getLocalDate(new Date(task.due_date + "T00:00:00")) : null;
                const isOverdueQ = dueDate && dueDate < todayDate;
                const isTodayQ = dueDate && dueDate.getTime() === todayDate.getTime();
                return (
                  <li key={task.id}>
                    <Link
                      href={`/dashboard/board?boardId=${listBoardMap.get(task.list_id)}&taskId=${task.id}`}
                      className="flex items-center gap-3 px-5 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group"
                    >
                      <span className={`h-2 w-2 shrink-0 rounded-full ${dotColor}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-200">{task.title}</p>
                          {isOverdueQ && <span className="shrink-0 text-[10px] font-bold text-red-500 uppercase">Overdue</span>}
                          {isTodayQ && <span className="shrink-0 text-[10px] font-bold text-orange-500 uppercase">Today</span>}
                        </div>
                        <p className="mt-0.5 text-xs text-zinc-400">{taskStatus}</p>
                      </div>
                      {task.priority && task.priority !== "none" && (
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${priorityBadge(task.priority)}`}>
                          {task.priority}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="nx-empty py-10">
              <div className="nx-empty-icon">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              </div>
              <p className="nx-empty-title">Nothing urgent right now.</p>
              <p className="nx-empty-desc">High-priority work will appear here.</p>
            </div>
          )}
          <div className="border-t border-zinc-100 dark:border-zinc-800 px-5 py-2.5">
            <Link href="/dashboard/tasks" className="text-xs font-medium text-zinc-400 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-200 transition-colors">
              View all tasks &rarr;
            </Link>
          </div>
        </div>
      </section>

      {/* ── C. WORKSPACE HEALTH ──────────────────────────────── */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">

        {/* C1. Progress Overview */}
        <div className="nx-card shadow-sm overflow-hidden">
          <div className="nx-card-header">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Progress</h2>
            <span className="nx-badge-muted">{completionPct}%</span>
          </div>
          <div className="px-5 py-4">
            <div className="flex items-center justify-between text-[11px] text-zinc-400 dark:text-zinc-500 mb-2">
              <span>{completedTasks} of {totalTasks} complete</span>
            </div>
            <div className="h-1 w-full rounded-full bg-zinc-100 dark:bg-zinc-800">
              <div className="h-1 rounded-full bg-emerald-500 transition-all duration-700" style={{ width: `${completionPct}%` }} />
            </div>
          </div>
          {progressItems.length > 0 ? (
            <div className="px-5 pb-5 space-y-3.5 border-t border-zinc-50 dark:border-zinc-800/60">
              {progressItems.map((item) => {
                const pct = item.total > 0 ? Math.round((item.count / item.total) * 100) : 0;
                return (
                  <div key={item.label} className="space-y-1.5 pt-3.5 first:pt-0">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${item.color}`} />
                        {item.label}
                      </span>
                      <span className="text-[11px] tabular-nums text-zinc-400 dark:text-zinc-500">{item.count} · {pct}%</span>
                    </div>
                    <div className="h-1 rounded-full bg-zinc-100 dark:bg-zinc-800">
                      <div className={`h-1 rounded-full ${item.color} transition-all duration-500`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="px-5 pb-5 text-xs text-zinc-400 dark:text-zinc-500 border-t border-zinc-50 dark:border-zinc-800/60 pt-3">
              Select a board to see task status.
            </p>
          )}
        </div>

        {/* C2. Team Workload */}
        <div className="nx-card shadow-sm overflow-hidden">
          <div className="nx-card-header">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Team Workload</h2>
            <span className="text-[11px] text-zinc-400 dark:text-zinc-500">{totalTasks} tasks</span>
          </div>
          {assigneeSummary.length > 0 ? (
            <>
              <div className="px-5 py-4 space-y-4">
                {assigneeSummary.slice(0, 4).map((item, idx) => {
                  const pct = totalTasks > 0 ? Math.round((item.count / totalTasks) * 100) : 0;
                  const isUnassigned = item.id === "__unassigned__";
                  const avatarColors = [
                    "bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400",
                    "bg-sky-100 text-sky-600 dark:bg-sky-900/40 dark:text-sky-400",
                    "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400",
                    "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400",
                  ];
                  const barColors = ["bg-violet-400", "bg-sky-400", "bg-emerald-400", "bg-amber-400"];
                  const avatarColor = isUnassigned
                    ? "bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500"
                    : avatarColors[idx % avatarColors.length];
                  const barColor = isUnassigned ? "bg-zinc-200 dark:bg-zinc-700" : barColors[idx % barColors.length];
                  return (
                    <div key={item.id} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2 min-w-0">
                          <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${avatarColor}`}>
                            {isUnassigned ? "?" : item.name.slice(0, 1).toUpperCase()}
                          </span>
                          <span className={`text-xs truncate ${isUnassigned ? "text-zinc-400 dark:text-zinc-500" : "text-zinc-700 dark:text-zinc-300"}`}>
                            {item.name}
                          </span>
                          {!isUnassigned && pct > 55 && item.count >= 3 && (
                            <span className="shrink-0 rounded-full bg-amber-50 px-1.5 py-px text-[9px] font-semibold text-amber-600 dark:bg-amber-900/20 dark:text-amber-400">heavy</span>
                          )}
                        </span>
                        <span className={`text-[11px] tabular-nums shrink-0 ml-2 ${isUnassigned ? "text-zinc-400 dark:text-zinc-500" : "text-zinc-500 dark:text-zinc-400"}`}>
                          {item.count} · {pct}%
                        </span>
                      </div>
                      <div className="h-1 rounded-full bg-zinc-100 dark:bg-zinc-800">
                        <div className={`h-1 rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              {workloadSignal && (
                <div className="px-5 pb-3 -mt-1">
                  <p className="flex items-center gap-1.5 text-[11px] text-amber-600/80 dark:text-amber-500/70">
                    <svg className="h-3 w-3 shrink-0 text-zinc-400 dark:text-zinc-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                    </svg>
                    {workloadSignal}
                  </p>
                </div>
              )}
              {assigneeSummary.length > 4 && (
                <div className="border-t border-zinc-100 dark:border-zinc-800 px-5 py-2.5">
                  <Link href="/dashboard/team" className="text-xs font-medium text-zinc-400 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-200 transition-colors">
                    +{assigneeSummary.length - 4} more members &rarr;
                  </Link>
                </div>
              )}
            </>
          ) : (
            <div className="px-5 py-4">
              <p className="text-xs text-zinc-400 dark:text-zinc-500">No assigned tasks yet.</p>
            </div>
          )}
        </div>

        {/* C3. Activity Feed */}
        <div className="nx-card shadow-sm overflow-hidden md:col-span-2 lg:col-span-1">
          <div className="nx-card-header">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Activity</h2>
            {groupedActivities.length > 0 && <span className="nx-label">Recent</span>}
          </div>
          {groupedActivities.length > 0 ? (
            <div className="px-5 py-4 space-y-4 max-h-72 overflow-y-auto">
              {groupedActivities.map((group) => (
                <div key={group.title}>
                  <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                    {group.title}
                  </h3>
                  <ul className="space-y-0.5">
                    {group.items.map((a) => {
                      const link = getActivityLink(a);
                      const Content = (
                        <div className="flex items-start gap-3 rounded-lg px-2 py-2 -mx-2 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                          <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${actionIcon[a.action] ?? "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"}`}>
                            {(a.actor_display_name || a.actor_email || "?").slice(0, 1).toUpperCase()}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs leading-snug text-zinc-700 dark:text-zinc-300">
                              {formatActivityLine(a)}
                            </p>
                            <span className="mt-0.5 block text-[10px] text-zinc-300 dark:text-zinc-600">
                              {timeAgo(a.created_at)}
                            </span>
                          </div>
                        </div>
                      );
                      return (
                        <li key={a.id}>
                          {link ? <Link href={link} className="block">{Content}</Link> : Content}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <div className="nx-empty py-8">
              <div className="nx-empty-icon">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              </div>
              <p className="nx-empty-title">No recent activity yet.</p>
              <p className="nx-empty-desc">Team updates will appear here.</p>
            </div>
          )}
        </div>
      </section>

      {/* ── D. WEEKLY PULSE ──────────────────────────────────── */}
      <section className="rounded-2xl border border-zinc-100 bg-zinc-50/50 p-4 dark:border-zinc-800/70 dark:bg-zinc-800/30">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">Weekly Pulse</h2>
          <div className="flex items-center gap-3 text-[10px] font-medium text-zinc-400 dark:text-zinc-500">
            <span className="flex items-center gap-1"><span className={`h-1.5 w-1.5 rounded-full ${STATUS_COLORS.completed.dot}`} />Done</span>
            <span className="flex items-center gap-1"><span className={`h-1.5 w-1.5 rounded-full ${STATUS_COLORS.inProgress.dot}`} />Active</span>
            <span className="flex items-center gap-1"><span className={`h-1.5 w-1.5 rounded-full ${STATUS_COLORS.todo.dot}`} />Todo</span>
          </div>
        </div>
        {weeklyChartData.maxCount === 0 ? (
          <div className="flex items-center justify-center h-20">
            <p className="text-xs text-zinc-400 dark:text-zinc-500">No task activity this week.</p>
          </div>
        ) : (
          <div className="flex items-end gap-1.5 h-20">
            {weeklyChartData.days.map((day) => {
              const bars = [
                { count: day.todo, color: STATUS_COLORS.todo.bar },
                { count: day.inProgress, color: STATUS_COLORS.inProgress.bar },
                { count: day.completed, color: STATUS_COLORS.completed.bar },
              ];
              return (
                <div key={day.label} className="flex flex-1 flex-col items-center gap-1">
                  <div className="flex items-end gap-0.5 w-full h-14">
                    {bars.map((bar, i) => {
                      const pct = bar.count > 0
                        ? Math.max(8, (bar.count / weeklyChartData.maxCount) * 100)
                        : 0;
                      return (
                        <div
                          key={i}
                          className={`flex-1 rounded-t-sm ${bar.color} transition-all`}
                          style={{ height: `${pct}%` }}
                          title={`${bar.count}`}
                        />
                      );
                    })}
                  </div>
                  <span className="text-[9px] font-medium text-zinc-400 dark:text-zinc-500">{day.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>

    </div>
  );
}
