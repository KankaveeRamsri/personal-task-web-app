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
        icon: (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15a2.25 2.25 0 0 1 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />
          </svg>
        ),
        badge: overdueCount > 0 ? `⚠️ ${overdueCount} overdue` : null,
      },
      {
        label: "In Progress",
        value: String(inProgressTasks),
        change: inProgressTasks === 0 ? "No active tasks" : inProgressTasks > 5 ? "High workload" : "Tasks in progress",
        accent: "text-amber-600 dark:text-amber-400",
        icon: (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.992 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
          </svg>
        ),
      },
      {
        label: "Completed",
        value: String(completedTasks),
        change: `${completedTasks} of ${totalTasks} done`,
        accent: "text-emerald-600 dark:text-emerald-400",
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

  // Progress bars per list
  const progressItems = useMemo(() => {
    return lists.map((l) => ({
      label: l.title === "Done" ? "Completed" : l.title,
      count: tasksByListTitle[l.title] ?? 0,
      total: totalTasks,
      color: listColorMap.get(l.title) ?? "bg-zinc-400",
    }));
  }, [lists, tasksByListTitle, totalTasks, listColorMap]);

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
            className="group flex flex-col rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
          >
            <div className="flex items-center justify-between">
              <span className={`flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800 transition-colors group-hover:bg-zinc-200 dark:group-hover:bg-zinc-700 ${card.accent}`}>
                {card.icon}
              </span>
              {card.badge && (
                <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-[10px] font-bold text-red-600 dark:bg-red-900/30 dark:text-red-400">
                  {card.badge}
                </span>
              )}
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <p className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                {card.value}
              </p>
            </div>
            <div className="mt-1 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  {card.label}
                </span>
                <span className="text-xs text-zinc-400 dark:text-zinc-500">
                  {card.change}
                </span>
              </div>
              {card.progressPct !== undefined && (
                <div className="h-1.5 w-full rounded-full bg-zinc-100 dark:bg-zinc-800">
                  <div
                    className="h-1.5 rounded-full bg-emerald-500 transition-all duration-700"
                    style={{ width: `${card.progressPct}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        ))}
      </section>

      {/* ── 3. Chart Placeholder ─────────────────────────────── */}
      <section className="rounded-2xl border-2 border-dashed border-zinc-200/60 bg-zinc-50/30 p-5 sm:p-6 dark:border-zinc-800/60 dark:bg-zinc-900/20">
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <svg className="h-8 w-8 text-zinc-300 dark:text-zinc-600 mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125z" />
          </svg>
          <p className="text-sm font-semibold text-zinc-400 dark:text-zinc-500">Charts & Analytics</p>
          <p className="mt-1 text-xs text-zinc-300 dark:text-zinc-600">Coming soon</p>
        </div>
      </section>

      {/* ── 4. Two-Column Grid ──────────────────────────────── */}
      <section className="grid gap-6 lg:grid-cols-2 items-start">
        {/* LEFT: Focus Today + Priority Tasks */}
        <div className="space-y-6">
          {/* Focus Today */}
          <section className="rounded-2xl border-2 border-dashed border-zinc-200/60 bg-zinc-50/30 p-4 sm:p-6 dark:border-zinc-800/60 dark:bg-zinc-900/20">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-lg sm:text-xl">🔥</span>
                  <h2 className="text-base sm:text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Focus Today</h2>
                </div>
                <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
                  {dueTodayTasks.length} tasks due today &bull; {overdueCount} overdue
                </p>
              </div>

              <div className="flex flex-1 max-w-full lg:max-w-md flex-col gap-2">
                <div className="flex items-center justify-between text-[10px] sm:text-xs font-bold uppercase tracking-wider text-zinc-400">
                  <span>Progress</span>
                  <span>{completedTodayCount} / {totalTodayCount} completed</span>
                </div>
                <div className="h-1.5 sm:h-2 w-full rounded-full bg-zinc-200/50 dark:bg-zinc-800/50 overflow-hidden">
                  <div
                    className="h-full bg-zinc-900 dark:bg-zinc-100 transition-all duration-500 ease-out"
                    style={{ width: `${totalTodayCount > 0 ? (completedTodayCount / totalTodayCount) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 sm:self-end lg:self-center">
                <button
                  onClick={() => console.log("Complete all today")}
                  className="flex-1 sm:flex-none px-3 sm:px-4 py-2 text-[11px] sm:text-xs font-bold bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 rounded-lg hover:opacity-90 transition-opacity active:scale-95"
                >
                  Complete All
                </button>
                <button
                  onClick={() => console.log("Start focus mode")}
                  className="flex-1 sm:flex-none px-3 sm:px-4 py-2 text-[11px] sm:text-xs font-bold border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors active:scale-95"
                >
                  Start Focus
                </button>
              </div>
            </div>

            {overdueCount === 0 && dueTodayTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center bg-white/50 dark:bg-zinc-900/50 rounded-xl border border-zinc-100 dark:border-zinc-800 shadow-sm">
                <span className="text-3xl mb-3">🎉</span>
                <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">You&apos;re all caught up</p>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">No urgent tasks for today.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Overdue Block */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 px-1">
                    <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-red-500/80">Overdue</h3>
                    <span className="text-xs font-medium text-zinc-400">({overdueCount})</span>
                  </div>
                  <div className="space-y-2">
                    {overdueTasks.slice(0, 3).map((task) => (
                      <Link
                        key={task.id}
                        href={`/dashboard/board?boardId=${listBoardMap.get(task.list_id)}&taskId=${task.id}`}
                        className="group flex items-center justify-between rounded-xl border border-red-100 bg-white p-3.5 shadow-sm transition-all hover:border-red-200 hover:shadow-md dark:border-red-900/20 dark:bg-zinc-900"
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
                      <div className="py-8 text-center bg-zinc-50/50 dark:bg-zinc-800/20 rounded-xl border border-zinc-100 dark:border-zinc-800/50">
                        <p className="text-xs font-medium text-zinc-400 italic">No overdue tasks</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Due Today Block */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 px-1">
                    <span className="h-2 w-2 rounded-full bg-orange-500" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-orange-500/80">Due Today</h3>
                    <span className="text-xs font-medium text-zinc-400">({dueTodayTasks.length})</span>
                  </div>
                  <div className="space-y-2">
                    {dueTodayTasks.slice(0, 3).map((task) => (
                      <Link
                        key={task.id}
                        href={`/dashboard/board?boardId=${listBoardMap.get(task.list_id)}&taskId=${task.id}`}
                        className="group flex items-center justify-between rounded-xl border border-orange-100 bg-white p-3.5 shadow-sm transition-all hover:border-orange-200 hover:shadow-md dark:border-orange-900/20 dark:bg-zinc-900"
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
                      <div className="py-8 text-center bg-zinc-50/50 dark:bg-zinc-800/20 rounded-xl border border-zinc-100 dark:border-zinc-800/50">
                        <p className="text-xs font-medium text-zinc-400 italic">Nothing due today</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Priority Tasks */}
          <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden">
            <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Priority Tasks
              </h2>
              <span className="text-xs text-zinc-400 dark:text-zinc-400">
                Top {priorityTasks.length}
              </span>
            </div>
            {priorityTasks.length > 0 ? (
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800 max-h-80 overflow-y-auto">
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
                        className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                      >
                        <span className={`h-2 w-2 shrink-0 rounded-full ${dotColor}`} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-200">
                              {task.title}
                            </p>
                            {isOverdue && (
                              <span className="shrink-0 text-[10px] font-bold text-red-500 uppercase tracking-tight">Overdue</span>
                            )}
                            {isToday && (
                              <span className="shrink-0 text-[10px] font-bold text-orange-500 uppercase tracking-tight">Today</span>
                            )}
                          </div>
                          <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-400">
                            {taskStatus}
                          </p>
                        </div>
                        {task.priority && task.priority !== "none" && (
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${priorityBadge(task.priority)}`}
                          >
                            {task.priority}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Nothing urgent right now.</p>
                <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-400">
                  High-priority work will appear here.
                </p>
              </div>
            )}
            <div className="border-t border-zinc-100 px-5 py-3 dark:border-zinc-800">
              <Link
                href="/dashboard/tasks"
                className="text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
              >
                View all tasks &rarr;
              </Link>
            </div>
          </div>
        </div>

        {/* RIGHT: Smart Actions + Task Status */}
        <div className="space-y-6">
          {/* Smart Quick Actions */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4 px-1">
              Smart Quick Actions
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-2">
              <Link
                href="/dashboard/board"
                className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-zinc-900/10 transition-all hover:-translate-y-0.5 hover:bg-zinc-800 active:scale-95 active:translate-y-0 dark:bg-zinc-100 dark:text-zinc-900 dark:shadow-none dark:hover:bg-zinc-200"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                New Task
              </Link>

              {overdueCount > 0 && (
                <Link
                  href="/dashboard/board"
                  className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-red-200 bg-red-50/50 px-4 py-2.5 text-sm font-semibold text-red-700 transition-all hover:bg-red-50 hover:border-red-300 active:scale-95 dark:border-red-900/30 dark:bg-red-900/10 dark:text-red-400 dark:hover:bg-red-900/20"
                >
                  <span className="text-base">⚠️</span>
                  Fix Overdue
                </Link>
              )}

              {dueTodayCount > 0 && (
                <Link
                  href="/dashboard/tasks"
                  className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-orange-200 bg-orange-50/50 px-4 py-2.5 text-sm font-semibold text-orange-700 transition-all hover:bg-orange-50 hover:border-orange-300 active:scale-95 dark:border-orange-900/30 dark:bg-orange-900/10 dark:text-orange-400 dark:hover:bg-orange-900/20"
                >
                  <span className="text-base">📅</span>
                  Plan Today
                </Link>
              )}

              {members.length < 2 ? (
                <Link
                  href="/dashboard/team"
                  className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition-all hover:bg-zinc-50 hover:border-zinc-300 active:scale-95 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700/50"
                >
                  <span className="text-base">👥</span>
                  Invite Team
                </Link>
              ) : (
                <Link
                  href="/dashboard/board"
                  className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition-all hover:bg-zinc-50 hover:border-zinc-300 active:scale-95 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700/50"
                >
                  <span className="text-base">📂</span>
                  Open Board
                </Link>
              )}
            </div>
          </div>

          {/* Completion summary */}
          <div className="rounded-2xl border border-zinc-200 bg-white px-6 py-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Completion
              </h2>
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                {completedTasks} of {totalTasks} tasks ({completionPct}%)
              </span>
            </div>
            <div className="h-3 rounded-full bg-zinc-100 dark:bg-zinc-800">
              <div
                className="h-3 rounded-full bg-emerald-500 transition-all"
                style={{ width: `${completionPct}%` }}
              />
            </div>
          </div>

          {/* Progress panel */}
          {progressItems.length > 0 ? (
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4 px-1">
                Task Status
              </h2>
              <div className={progressItems.length > 5 ? "space-y-3 max-h-[360px] overflow-y-auto" : "space-y-4"}>
                {progressItems.map((item) => {
                  const pct = item.total > 0 ? Math.round((item.count / item.total) * 100) : 0;
                  return (
                    <div key={item.label}>
                      <div className="flex items-center justify-between text-sm mb-1.5">
                        <span className="flex items-center gap-2 font-medium text-zinc-700 dark:text-zinc-300">
                          <span className={`h-2 w-2 shrink-0 rounded-full ${item.color}`} />
                          {item.label}
                        </span>
                        <span className="text-xs text-zinc-400 dark:text-zinc-400">
                          {item.count} of {item.total}
                        </span>
                      </div>
                      <div className="h-2.5 rounded-full bg-zinc-100 dark:bg-zinc-800">
                        <div
                          className={`h-2.5 rounded-full ${item.color} transition-all`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
                Task Status
              </h2>
              <p className="text-sm text-zinc-400 dark:text-zinc-400">
                Select a board to see task status
              </p>
            </div>
          )}

          {/* Assignee summary */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4 px-1">
              Team Workload
            </h2>
            {assigneeSummary.length > 0 ? (
              <div className="space-y-3">
                {assigneeSummary.map((item) => {
                  const pct = totalTasks > 0 ? Math.round((item.count / totalTasks) * 100) : 0;
                  const isUnassigned = item.id === "__unassigned__";
                  return (
                    <div key={item.id}>
                      <div className="flex items-center justify-between text-sm mb-1.5">
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
                        <span className="text-xs text-zinc-400 dark:text-zinc-400 shrink-0 ml-2">
                          {item.count} task{item.count !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-800">
                        <div
                          className={`h-2 rounded-full transition-all ${isUnassigned ? "bg-zinc-300 dark:bg-zinc-600" : "bg-blue-400 dark:bg-blue-500"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-zinc-400 dark:text-zinc-400 px-1">
                No assigned tasks yet.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ── 5. Activity Timeline (Bottom) ─────────────────────── */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden">
        <div className="flex items-center justify-between mb-4 px-1">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Activity Timeline
          </h2>
        </div>
        {groupedActivities.length > 0 ? (
          <div className="space-y-6 max-h-[400px] lg:max-h-[500px] overflow-y-auto pr-1">
            {groupedActivities.map((group) => (
              <div key={group.title} className="space-y-3">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 border-b border-zinc-50 dark:border-zinc-800 pb-1">
                  {group.title}
                </h3>
                <ul className="space-y-4">
                  {group.items.map((a) => {
                    const link = getActivityLink(a);
                    const Content = (
                      <div className="flex items-start gap-3 rounded-xl p-2 -m-2 transition-all hover:bg-zinc-50 dark:hover:bg-zinc-800/50 group-hover:px-3">
                        <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold transition-transform group-hover:scale-110 ${actionIcon[a.action] ?? "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"}`}>
                          {(a.actor_display_name || a.actor_email || "?").slice(0, 1).toUpperCase()}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] leading-snug text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 transition-colors">
                            {formatActivityLine(a)}
                          </p>
                          <p className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">
                            {timeAgo(a.created_at)}
                          </p>
                        </div>
                      </div>
                    );

                    return (
                      <li key={a.id} className="group active:scale-[0.99] transition-transform">
                        {link ? (
                          <Link href={link} className="block cursor-pointer">
                            {Content}
                          </Link>
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
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">No recent activity yet.</p>
            <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-400">
              Team updates and task changes will appear here.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
