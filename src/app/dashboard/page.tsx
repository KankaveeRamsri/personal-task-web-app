"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { useBoardData } from "@/hooks/useBoardData";
import { useWorkspaceMembers } from "@/hooks/useWorkspaceMembers";
import { useRecentActivities } from "@/hooks/useRecentActivities";
import type { Activity } from "@/hooks/useRecentActivities";

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

function isCompletedTask(task: { is_completed: boolean; list_id: string }, listTitleMap: Map<string, string>): boolean {
  if (task.is_completed) return true;
  const title = listTitleMap.get(task.list_id) ?? "";
  return title === "Completed" || title === "Done";
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
  } = useBoardData();

  const { members } = useWorkspaceMembers(selectedWorkspaceId);
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
  const completedTasks = (tasksByListTitle["Completed"] ?? 0) + (tasksByListTitle["Done"] ?? 0);
  const inProgressTasks = tasksByListTitle["In Progress"] ?? 0;
  const completionPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const overdueTasks = useMemo(() => {
    const today = getLocalDate(new Date());
    return tasks
      .filter((t) => {
        if (isCompletedTask(t, listTitleMap)) return false;
        if (!t.due_date) return false;
        const target = getLocalDate(new Date(t.due_date + "T00:00:00"));
        return target < today;
      })
      .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime());
  }, [tasks, listTitleMap]);

  const dueTodayTasks = useMemo(() => {
    const today = getLocalDate(new Date());
    return tasks.filter((t) => {
      if (isCompletedTask(t, listTitleMap)) return false;
      if (!t.due_date) return false;
      const target = getLocalDate(new Date(t.due_date + "T00:00:00"));
      return target.getTime() === today.getTime();
    });
  }, [tasks, listTitleMap]);

  const dueTodayCount = dueTodayTasks.length;
  const overdueCount = overdueTasks.length;

  const todayTasks = useMemo(() => {
    const today = getLocalDate(new Date());
    return tasks.filter((t) => {
      if (!t.due_date) return false;
      const d = getLocalDate(new Date(t.due_date + "T00:00:00"));
      return d.getTime() === today.getTime();
    });
  }, [tasks]);

  const completedTodayCount = useMemo(() => 
    todayTasks.filter(t => isCompletedTask(t, listTitleMap)).length
  , [todayTasks, listTitleMap]);

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

  // Priority Tasks: top 5 urgent items
  const priorityTasks = useMemo(() => {
    const today = getLocalDate(new Date());
    return [...tasks]
      .filter((t) => !isCompletedTask(t, listTitleMap))
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
      const title = listTitleMap.get(task.list_id) ?? "";
      if (task.is_completed || title === "Completed" || title === "Done") return "completed";
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
  }, [tasks, listTitleMap]);

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
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="flex items-start justify-between gap-4 border-b border-zinc-100 dark:border-zinc-800 pb-6">
          <div className="space-y-2">
            <div className="h-8 w-64 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
            <div className="h-4 w-48 animate-pulse rounded-lg bg-zinc-100/60 dark:bg-zinc-800/60" />
          </div>
          <div className="flex gap-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-8 w-8 animate-pulse rounded-full bg-zinc-100 dark:bg-zinc-800" />
            ))}
          </div>
        </div>
        <div className="h-64 w-full animate-pulse rounded-2xl bg-zinc-50 dark:bg-zinc-800/20" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl bg-zinc-50 dark:bg-zinc-800/20" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-2 h-96 animate-pulse rounded-2xl bg-zinc-50 dark:bg-zinc-800/20" />
          <div className="lg:col-span-3 h-96 animate-pulse rounded-2xl bg-zinc-50 dark:bg-zinc-800/20" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 sm:space-y-8 px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
      {/* ── A. Welcome Section ──────────────────────────────── */}
      <section className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 border-b border-zinc-100 dark:border-zinc-800 pb-6">
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            {getGreeting()}, {displayName}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
            <span className="whitespace-nowrap">{formatDate()}</span>
            {workspaces.length > 0 && selectedWorkspaceId && (
              <div className="flex items-center gap-2">
                <span className="hidden sm:inline text-zinc-300 dark:text-zinc-700">&middot;</span>
                <select
                  value={selectedWorkspaceId ?? ""}
                  onChange={(e) => setSelectedWorkspaceId(e.target.value)}
                  className="rounded-md border border-zinc-200 bg-transparent px-2 py-0.5 text-xs sm:text-sm font-medium text-zinc-700 transition-colors hover:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-600 dark:focus:ring-zinc-600"
                >
                  {workspaces.map((ws) => (
                    <option key={ws.id} value={ws.id}>
                      {ws.icon} {ws.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {selectedWorkspaceId && boards.length > 0 && selectedBoardId && (
              <div className="flex items-center gap-2">
                <span className="text-zinc-300 dark:text-zinc-700">/</span>
                <select
                  value={selectedBoardId ?? ""}
                  onChange={(e) => setSelectedBoardId(e.target.value)}
                  className="rounded-md border border-zinc-200 bg-transparent px-2 py-0.5 text-xs sm:text-sm font-medium text-zinc-700 transition-colors hover:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-600 dark:focus:ring-zinc-600"
                >
                  {boards.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.title}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center self-start">
          {members.slice(0, 4).map((m, i) => {
            const name = m.display_name || m.email;
            const initials = name.split(/[\s._-]+/).map(w => w[0]).join("").slice(0, 2).toUpperCase() || name[0]?.toUpperCase() || "?";
            const colors = ["bg-violet-500", "bg-sky-500", "bg-emerald-500", "bg-amber-500"];
            return (
              <div
                key={m.user_id}
                title={`${m.display_name || m.email}${m.role !== "member" ? ` (${m.role})` : ""}`}
                className={`flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full ${colors[i % colors.length]} text-[10px] sm:text-[11px] font-semibold text-white ring-2 ring-white dark:ring-zinc-950 transition-transform hover:scale-110 hover:z-10 cursor-default ${i > 0 ? "-ml-2" : ""}`}
              >
                {initials}
              </div>
            );
          })}
          {members.length > 4 && (
            <div
              title={`${members.length - 4} more member${members.length - 4 > 1 ? "s" : ""}`}
              className="flex h-7 w-7 sm:h-8 sm:w-8 -ml-2 items-center justify-center rounded-full bg-zinc-200 text-[10px] sm:text-[11px] font-semibold text-zinc-600 ring-2 ring-white dark:bg-zinc-700 dark:text-zinc-300 dark:ring-zinc-950 transition-transform hover:scale-110 hover:z-10 cursor-default"
            >
              +{members.length - 4}
            </div>
          )}
          <button
            title="Invite members"
            className="flex h-7 w-7 sm:h-8 sm:w-8 -ml-2 items-center justify-center rounded-full border-2 border-dashed border-zinc-300 text-zinc-400 ring-2 ring-white transition-all hover:scale-110 hover:border-zinc-400 hover:text-zinc-600 dark:border-zinc-600 dark:text-zinc-500 dark:ring-zinc-950 dark:hover:border-zinc-400 dark:hover:text-zinc-300"
          >
            <svg className="h-3 sm:h-3.5 w-3 sm:w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>
        </div>
      </section>

      {/* ── 2. KPI Row ────────────────────────────────────── */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="group flex flex-col rounded-2xl border border-zinc-200/70 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${card.iconBg} ${card.accent}`}>
                  {card.icon}
                </span>
                <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  {card.label}
                </span>
              </div>
              {card.badge && (
                <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-500 dark:bg-red-900/30 dark:text-red-400">
                  {card.badge}
                </span>
              )}
            </div>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              {card.value}
            </p>
            <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
              {card.change}
            </p>
            {card.progressPct !== undefined && (
              <div className="mt-3 h-1.5 w-full rounded-full bg-zinc-100 dark:bg-zinc-800">
                <div
                  className="h-1.5 rounded-full bg-emerald-500 transition-all duration-700"
                  style={{ width: `${card.progressPct}%` }}
                />
              </div>
            )}
          </div>
        ))}
      </section>

      {/* ── 3. Charts & Analytics ─────────────────────────────── */}
      <section className="rounded-2xl border border-zinc-200/70 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Charts & Analytics</h2>
            <p className="text-sm text-zinc-400 dark:text-zinc-500 mt-0.5">Tasks created this week by current status</p>
          </div>
          <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            <span className="flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${STATUS_COLORS.completed.dot}`} />Completed</span>
            <span className="flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${STATUS_COLORS.inProgress.dot}`} />In Progress</span>
            <span className="flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${STATUS_COLORS.todo.dot}`} />To Do</span>
          </div>
        </div>

        {/* Task Trend — real data bar chart */}
        {weeklyChartData.maxCount === 0 ? (
          <div className="flex flex-col items-center justify-center h-44 text-center">
            <span className="text-2xl mb-2">📊</span>
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">No task activity this week.</p>
            <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">Tasks created this week will appear here.</p>
          </div>
        ) : (
          <div className="flex items-end gap-2 sm:gap-3 h-44">
            {weeklyChartData.days.map((day) => {
              const bars = [
                { count: day.todo, color: STATUS_COLORS.todo.bar },
                { count: day.inProgress, color: STATUS_COLORS.inProgress.bar },
                { count: day.completed, color: STATUS_COLORS.completed.bar },
              ];
              return (
                <div key={day.label} className="flex flex-1 flex-col items-center gap-1.5">
                  <div className="flex items-end gap-0.5 w-full h-36">
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
                  <span className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500">{day.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── 4. Two-Column Dashboard ────────────────────────── */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── LEFT COLUMN ──────────────────────────────────── */}
        <div className="flex flex-col gap-6">

          {/* L1. Focus Today */}
          <section className="rounded-2xl border border-amber-200/60 bg-amber-50/20 p-6 shadow-sm dark:border-amber-900/30 dark:bg-amber-950/10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🔥</span>
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Focus Today</h2>
                </div>
                <p className="text-sm text-zinc-400 dark:text-zinc-500 pl-7">
                  {dueTodayTasks.length} due today &bull; {overdueCount} overdue
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => console.log("Complete all today")}
                  className="px-3 py-1.5 text-xs font-semibold bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 rounded-lg hover:opacity-90 transition-opacity active:scale-95"
                >
                  Complete All
                </button>
                <button
                  onClick={() => console.log("Start focus mode")}
                  className="px-3 py-1.5 text-xs font-semibold border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors active:scale-95"
                >
                  Start Focus
                </button>
              </div>
            </div>

            <div className="mb-6">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-1.5">
                <span>Progress</span>
                <span>{completedTodayCount} / {totalTodayCount} completed</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                <div
                  className="h-full bg-zinc-900 dark:bg-zinc-100 transition-all duration-500 ease-out"
                  style={{ width: `${totalTodayCount > 0 ? (completedTodayCount / totalTodayCount) * 100 : 0}%` }}
                />
              </div>
            </div>

            {overdueCount === 0 && dueTodayTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <span className="text-2xl mb-2">🎉</span>
                <p className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">You&apos;re all caught up</p>
                <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">No urgent tasks for today.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-red-500/80">Overdue</h3>
                    <span className="text-xs text-zinc-400">({overdueCount})</span>
                  </div>
                  <div className="space-y-2">
                    {overdueTasks.slice(0, 3).map((task) => (
                      <Link
                        key={task.id}
                        href={`/dashboard/board?boardId=${listBoardMap.get(task.list_id)}&taskId=${task.id}`}
                        className="group flex items-center justify-between rounded-lg border border-red-100 bg-white p-3 shadow-sm transition-all hover:border-red-200 hover:shadow-md dark:border-red-900/20 dark:bg-zinc-900"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-zinc-800 dark:text-zinc-200 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
                            {task.title}
                          </p>
                          <p className="text-[10px] text-zinc-400 mt-1 font-medium">
                            {listTitleMap.get(task.list_id) || "Task"} &middot; {new Date(task.due_date!).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </p>
                        </div>
                        <svg className="h-4 w-4 text-zinc-300 group-hover:text-red-400 transition-colors transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                        </svg>
                      </Link>
                    ))}
                    {overdueCount > 3 && (
                      <Link href="/dashboard/tasks" className="block text-center text-[11px] font-bold text-red-500/60 hover:text-red-500 transition-colors py-1">
                        View all {overdueCount} overdue &rarr;
                      </Link>
                    )}
                    {overdueCount === 0 && (
                      <p className="py-3 text-center text-xs text-zinc-400 dark:text-zinc-500 italic">No overdue tasks</p>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-orange-500" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-orange-500/80">Due Today</h3>
                    <span className="text-xs text-zinc-400">({dueTodayTasks.length})</span>
                  </div>
                  <div className="space-y-2">
                    {dueTodayTasks.slice(0, 3).map((task) => (
                      <Link
                        key={task.id}
                        href={`/dashboard/board?boardId=${listBoardMap.get(task.list_id)}&taskId=${task.id}`}
                        className="group flex items-center justify-between rounded-lg border border-orange-100 bg-white p-3 shadow-sm transition-all hover:border-orange-200 hover:shadow-md dark:border-orange-900/20 dark:bg-zinc-900"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-zinc-800 dark:text-zinc-200 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                            {task.title}
                          </p>
                          <p className="text-[10px] text-zinc-400 mt-1 font-medium">
                            {listTitleMap.get(task.list_id) || "Task"} &middot; Today
                          </p>
                        </div>
                        <svg className="h-4 w-4 text-zinc-300 group-hover:text-orange-400 transition-colors transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                        </svg>
                      </Link>
                    ))}
                    {dueTodayTasks.length > 3 && (
                      <Link href="/dashboard/tasks" className="block text-center text-[11px] font-bold text-orange-500/60 hover:text-orange-500 transition-colors py-1">
                        View all {dueTodayTasks.length} today &rarr;
                      </Link>
                    )}
                    {dueTodayTasks.length === 0 && (
                      <p className="py-3 text-center text-xs text-zinc-400 dark:text-zinc-500 italic">Nothing due today</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* L2. Priority Tasks */}
          <div className="rounded-2xl border border-zinc-200/70 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden">
            <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4 dark:border-zinc-800">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Priority Tasks</h2>
              <span className="text-xs text-zinc-400">Top {priorityTasks.length}</span>
            </div>
            {priorityTasks.length > 0 ? (
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800 max-h-72 overflow-y-auto">
                {priorityTasks.map((task) => {
                  const listTitle = listTitleMap.get(task.list_id) ?? "";
                  const taskStatus = listTitle === "Done" ? "Completed" : (listTitle || "To Do");
                  const dotColor = listColorMap.get(listTitle) ?? "bg-zinc-300";
                  const today = getLocalDate(new Date());
                  const dueDate = task.due_date ? getLocalDate(new Date(task.due_date + "T00:00:00")) : null;
                  const isOverdue = dueDate && dueDate < today;
                  const isToday = dueDate && dueDate.getTime() === today.getTime();
                  return (
                    <li key={task.id}>
                      <Link
                        href={`/dashboard/board?boardId=${listBoardMap.get(task.list_id)}&taskId=${task.id}`}
                        className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                      >
                        <span className={`h-2 w-2 shrink-0 rounded-full ${dotColor}`} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-200">{task.title}</p>
                            {isOverdue && <span className="shrink-0 text-[10px] font-bold text-red-500 uppercase tracking-tight">Overdue</span>}
                            {isToday && <span className="shrink-0 text-[10px] font-bold text-orange-500 uppercase tracking-tight">Today</span>}
                          </div>
                          <p className="mt-0.5 text-xs text-zinc-400">{taskStatus}</p>
                        </div>
                        {task.priority && task.priority !== "none" && (
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${priorityBadge(task.priority)}`}>
                            {task.priority}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Nothing urgent right now.</p>
                <p className="mt-1 text-xs text-zinc-400">High-priority work will appear here.</p>
              </div>
            )}
            <div className="border-t border-zinc-100 px-6 py-3 dark:border-zinc-800">
              <Link href="/dashboard/tasks" className="text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200">
                View all tasks &rarr;
              </Link>
            </div>
          </div>

          {/* L3. Activity Timeline */}
          <div className="rounded-2xl border border-zinc-200/70 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Activity Timeline</h2>
            {groupedActivities.length > 0 ? (
              <div className="space-y-5 max-h-[400px] lg:max-h-[500px] overflow-y-auto">
                {groupedActivities.map((group) => (
                  <div key={group.title} className="space-y-3">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 border-b border-zinc-50 dark:border-zinc-800 pb-1">
                      {group.title}
                    </h3>
                    <ul className="space-y-3">
                      {group.items.map((a) => {
                        const link = getActivityLink(a);
                        const Content = (
                          <div className="flex items-start gap-2.5 rounded-lg p-2 -m-2 transition-all hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                            <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold transition-transform group-hover:scale-110 ${actionIcon[a.action] ?? "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"}`}>
                              {(a.actor_display_name || a.actor_email || "?").slice(0, 1).toUpperCase()}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-[13px] leading-snug text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 transition-colors">
                                {formatActivityLine(a)}
                              </p>
                              <p className="mt-0.5 text-[11px] text-zinc-400 dark:text-zinc-500">
                                {timeAgo(a.created_at)}
                              </p>
                            </div>
                          </div>
                        );
                        return (
                          <li key={a.id} className="group active:scale-[0.99] transition-transform">
                            {link ? (
                              <Link href={link} className="block cursor-pointer">{Content}</Link>
                            ) : (
                              Content
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">No recent activity yet.</p>
                <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-400">Team updates and task changes will appear here.</p>
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT COLUMN ─────────────────────────────────── */}
        <div className="flex flex-col gap-6">

          {/* R1. Smart Quick Actions */}
          <div className="rounded-2xl border border-zinc-200/70 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Smart Quick Actions</h2>
            <div className="grid grid-cols-2 gap-2">
              <Link
                href="/dashboard/board"
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-900 px-3 py-2 text-xs font-bold text-white shadow-sm shadow-zinc-900/10 transition-all hover:bg-zinc-800 active:scale-95 dark:bg-zinc-100 dark:text-zinc-900 dark:shadow-none dark:hover:bg-zinc-200"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                New Task
              </Link>
              {overdueCount > 0 && (
                <Link
                  href="/dashboard/board"
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50/50 px-3 py-2 text-xs font-semibold text-red-700 transition-all hover:bg-red-50 active:scale-95 dark:border-red-900/30 dark:bg-red-900/10 dark:text-red-400 dark:hover:bg-red-900/20"
                >
                  <span className="text-sm">⚠️</span>
                  Fix Overdue
                </Link>
              )}
              {dueTodayCount > 0 && (
                <Link
                  href="/dashboard/tasks"
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-orange-200 bg-orange-50/50 px-3 py-2 text-xs font-semibold text-orange-700 transition-all hover:bg-orange-50 active:scale-95 dark:border-orange-900/30 dark:bg-orange-900/10 dark:text-orange-400 dark:hover:bg-orange-900/20"
                >
                  <span className="text-sm">📅</span>
                  Plan Today
                </Link>
              )}
              {members.length < 2 ? (
                <Link
                  href="/dashboard/team"
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 transition-all hover:bg-zinc-50 active:scale-95 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700/50"
                >
                  <span className="text-sm">👥</span>
                  Invite Team
                </Link>
              ) : (
                <Link
                  href="/dashboard/board"
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 transition-all hover:bg-zinc-50 active:scale-95 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700/50"
                >
                  <span className="text-sm">📂</span>
                  Open Board
                </Link>
              )}
            </div>
          </div>

          {/* R2. Progress Overview */}
          <div className="rounded-2xl border border-zinc-200/70 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Progress Overview</h2>
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                {completedTasks} of {totalTasks} ({completionPct}%)
              </span>
            </div>
            <div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-800">
              <div className="h-2 rounded-full bg-emerald-500 transition-all" style={{ width: `${completionPct}%` }} />
            </div>
            {progressItems.length > 0 ? (
              <div className="mt-4 space-y-3">
                {progressItems.map((item) => {
                  const pct = item.total > 0 ? Math.round((item.count / item.total) * 100) : 0;
                  return (
                    <div key={item.label}>
                      <div className="flex items-center justify-between text-sm mb-0.5">
                        <span className="flex items-center gap-2 font-medium text-zinc-700 dark:text-zinc-300">
                          <span className={`h-2 w-2 shrink-0 rounded-full ${item.color}`} />
                          {item.label}
                        </span>
                        <span className="text-xs text-zinc-400">{item.count} of {item.total}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800">
                        <div className={`h-1.5 rounded-full ${item.color} transition-all`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="mt-3 pt-3 text-sm text-zinc-400 border-t border-zinc-100 dark:border-zinc-800">
                Select a board to see task status
              </p>
            )}
          </div>

          {/* R3. Team Workload */}
          <div className="rounded-2xl border border-zinc-200/70 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Team Workload</h2>
            {assigneeSummary.length > 0 ? (
              <>
                <div className="space-y-2.5">
                  {assigneeSummary.slice(0, 4).map((item) => {
                    const pct = totalTasks > 0 ? Math.round((item.count / totalTasks) * 100) : 0;
                    const isUnassigned = item.id === "__unassigned__";
                    return (
                      <div key={item.id}>
                        <div className="flex items-center justify-between text-sm mb-0.5">
                          <span className="flex items-center gap-2 min-w-0">
                            {isUnassigned ? (
                              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-[10px] font-semibold text-zinc-400 dark:bg-zinc-800 dark:text-zinc-400">?</span>
                            ) : (
                              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[10px] font-semibold text-blue-600 dark:bg-blue-900/40 dark:text-blue-400">
                                {item.name.slice(0, 1).toUpperCase()}
                              </span>
                            )}
                            <span className={`font-medium truncate ${isUnassigned ? "text-zinc-400 dark:text-zinc-400" : "text-zinc-700 dark:text-zinc-300"}`}>
                              {item.name}
                            </span>
                          </span>
                          <span className="text-xs text-zinc-400 shrink-0 ml-2">{item.count}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800">
                          <div
                            className={`h-1.5 rounded-full transition-all ${isUnassigned ? "bg-zinc-300 dark:bg-zinc-600" : "bg-blue-400 dark:bg-blue-500"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                {assigneeSummary.length > 4 && (
                  <p className="mt-2.5 text-xs text-zinc-400 dark:text-zinc-500">
                    +{assigneeSummary.length - 4} more members
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-zinc-400">No assigned tasks yet.</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
