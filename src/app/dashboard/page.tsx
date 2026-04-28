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

function statusDot(status: string) {
  const styles: Record<string, string> = {
    "To Do": "bg-zinc-400",
    "In Progress": "bg-amber-500",
    "Done": "bg-emerald-500",
    "Completed": "bg-emerald-500",
  };
  return styles[status] ?? "bg-zinc-300";
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
    default:
      return `${name} ${a.action}`;
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

  const overdueCount = useMemo(() => {
    const today = getLocalDate(new Date());
    return tasks.filter((t) => {
      if (isCompletedTask(t, listTitleMap)) return false;
      if (!t.due_date) return false;
      const target = getLocalDate(new Date(t.due_date + "T00:00:00"));
      return target < today;
    }).length;
  }, [tasks, listTitleMap]);

  const dueTodayCount = useMemo(() => {
    const today = getLocalDate(new Date());
    return tasks.filter((t) => {
      if (!t.due_date) return false;
      const target = getLocalDate(new Date(t.due_date + "T00:00:00"));
      return target.getTime() === today.getTime();
    }).length;
  }, [tasks]);

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
        change: boardName || "—",
        accent: "text-zinc-600 dark:text-zinc-400",
        icon: (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15a2.25 2.25 0 0 1 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />
          </svg>
        ),
      },
      {
        label: "In Progress",
        value: String(inProgressTasks),
        change: totalTasks > 0 ? `${Math.round((inProgressTasks / totalTasks) * 100)}% of total` : "—",
        accent: "text-amber-600 dark:text-amber-400",
        icon: (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.992 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
          </svg>
        ),
      },
      {
        label: "Completed",
        value: `${completedTasks}/${totalTasks}`,
        change: totalTasks > 0 ? `${completionPct}% rate` : "—",
        accent: "text-emerald-600 dark:text-emerald-400",
        icon: (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
        ),
      },
      {
        label: "Overdue",
        value: String(overdueCount),
        change: overdueCount > 0 ? "Needs attention" : "All on track",
        accent: "text-red-600 dark:text-red-400",
        icon: (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
        ),
      },
      {
        label: "Due Today",
        value: String(dueTodayCount),
        change: dueTodayCount > 0 ? "Due today" : "Nothing due",
        accent: "text-amber-600 dark:text-amber-400",
        icon: (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
          </svg>
        ),
      },
      {
        label: "Unassigned",
        value: String(unassignedCount),
        change: totalTasks > 0 ? `${Math.round((unassignedCount / totalTasks) * 100)}% of tasks` : "—",
        accent: "text-blue-600 dark:text-blue-400",
        icon: (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
          </svg>
        ),
      },
    ],
    [totalTasks, inProgressTasks, completedTasks, completionPct, overdueCount, dueTodayCount, unassignedCount, boardName]
  );

  // Top 5 recent tasks by creation date
  const recentTasks = useMemo(
    () =>
      [...tasks]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5),
    [tasks]
  );

  // Progress bars per list
  const progressItems = useMemo(() => {
    const colors: Record<string, string> = {
      "To Do": "bg-zinc-400",
      "In Progress": "bg-amber-500",
      "Done": "bg-emerald-500",
      "Completed": "bg-emerald-500",
    };
    return lists.map((l) => ({
      label: l.title === "Done" ? "Completed" : l.title,
      count: tasksByListTitle[l.title] ?? 0,
      total: totalTasks,
      color: colors[l.title] ?? "bg-zinc-400",
    }));
  }, [lists, tasksByListTitle, totalTasks]);

  // ── Loading ──────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-100" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* ── A. Welcome Section ──────────────────────────────── */}
      <section className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            {getGreeting()}, {displayName}
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400">
            <span>{formatDate()}</span>
            {workspaces.length > 0 && selectedWorkspaceId && (
              <>
                <span className="text-zinc-300 dark:text-zinc-700">&middot;</span>
                <select
                  value={selectedWorkspaceId ?? ""}
                  onChange={(e) => setSelectedWorkspaceId(e.target.value)}
                  className="rounded-md border border-zinc-200 bg-transparent px-2 py-0.5 text-sm font-medium text-zinc-700 transition-colors hover:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-600 dark:focus:ring-zinc-600"
                >
                  {workspaces.map((ws) => (
                    <option key={ws.id} value={ws.id}>
                      {ws.icon} {ws.name}
                    </option>
                  ))}
                </select>
              </>
            )}
            {selectedWorkspaceId && boards.length > 0 && selectedBoardId && (
              <>
                <span className="text-zinc-300 dark:text-zinc-700">/</span>
                <select
                  value={selectedBoardId ?? ""}
                  onChange={(e) => setSelectedBoardId(e.target.value)}
                  className="rounded-md border border-zinc-200 bg-transparent px-2 py-0.5 text-sm font-medium text-zinc-700 transition-colors hover:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-600 dark:focus:ring-zinc-600"
                >
                  {boards.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.title}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>
        </div>
        <div className="hidden sm:flex items-center">
          {members.slice(0, 4).map((m, i) => {
            const name = m.display_name || m.email;
            const initials = name.split(/[\s._-]+/).map(w => w[0]).join("").slice(0, 2).toUpperCase() || name[0]?.toUpperCase() || "?";
            const colors = ["bg-violet-500", "bg-sky-500", "bg-emerald-500", "bg-amber-500"];
            return (
              <div
                key={m.user_id}
                title={`${m.display_name || m.email}${m.role !== "member" ? ` (${m.role})` : ""}`}
                className={`flex h-8 w-8 items-center justify-center rounded-full ${colors[i % colors.length]} text-[11px] font-semibold text-white ring-2 ring-white dark:ring-zinc-950 transition-transform hover:scale-110 hover:z-10 cursor-default ${i > 0 ? "-ml-2" : ""}`}
              >
                {initials}
              </div>
            );
          })}
          {members.length > 4 && (
            <div
              title={`${members.length - 4} more member${members.length - 4 > 1 ? "s" : ""}`}
              className="flex h-8 w-8 -ml-2 items-center justify-center rounded-full bg-zinc-200 text-[11px] font-semibold text-zinc-600 ring-2 ring-white dark:bg-zinc-700 dark:text-zinc-300 dark:ring-zinc-950 transition-transform hover:scale-110 hover:z-10 cursor-default"
            >
              +{members.length - 4}
            </div>
          )}
          <button
            title="Invite members"
            className="flex h-8 w-8 -ml-2 items-center justify-center rounded-full border-2 border-dashed border-zinc-300 text-zinc-400 ring-2 ring-white transition-all hover:scale-110 hover:border-zinc-400 hover:text-zinc-600 dark:border-zinc-600 dark:text-zinc-500 dark:ring-zinc-950 dark:hover:border-zinc-400 dark:hover:text-zinc-300"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>
        </div>
      </section>

      {/* ── B. Summary Cards ────────────────────────────────── */}
      <section className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="flex items-center justify-between">
              <span className={`flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800 ${card.accent}`}>
                {card.icon}
              </span>
            </div>
            <p className="mt-3.5 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              {card.value}
            </p>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                {card.label}
              </span>
              <span className="text-xs text-zinc-400 dark:text-zinc-400">
                {card.change}
              </span>
            </div>
          </div>
        ))}
      </section>

      {/* ── C. Main Content — 2 columns ─────────────────────── */}
      <section className="grid gap-6 lg:grid-cols-5">
        {/* Left: Recent Tasks (2/5 width) */}
        <div className="lg:col-span-2 rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Recent Tasks
            </h2>
            <span className="text-xs text-zinc-400 dark:text-zinc-400">
              {recentTasks.length} task{recentTasks.length !== 1 ? "s" : ""}
            </span>
          </div>
          {recentTasks.length > 0 ? (
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800 max-h-80 overflow-y-auto">
              {recentTasks.map((task) => {
                const taskStatus = (listTitleMap.get(task.list_id) ?? "To Do") === "Done" ? "Completed" : (listTitleMap.get(task.list_id) ?? "To Do");
                return (
                  <li key={task.id}>
                    <Link
                      href="/dashboard/board"
                      className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                    >
                      <span className={`h-2 w-2 shrink-0 rounded-full ${statusDot(taskStatus)}`} />
                      <div className="min-w-0 flex-1">
                        <p className={`truncate text-sm font-medium ${task.is_completed ? "line-through text-zinc-400 dark:text-zinc-400" : "text-zinc-800 dark:text-zinc-200"}`}>
                          {task.title}
                        </p>
                        <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-400">
                          {boardName} &middot; {taskStatus}
                        </p>
                      </div>
                      {task.priority && task.priority !== "none" && (
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${priorityBadge(task.priority)}`}
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
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">No recent tasks yet</p>
              <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-400">
                Create your first task to get started.
              </p>
              <Link
                href="/dashboard/board"
                className="mt-3 text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
              >
                Go to board &rarr;
              </Link>
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

        {/* Right: Task Status / Progress (3/5 width) */}
        <div className="lg:col-span-3 space-y-6">
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

          {/* Quick actions */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
              Quick Actions
            </h2>
            <div className="space-y-1.5">
              <Link
                href="/dashboard/board"
                className="flex items-center gap-2.5 rounded-xl bg-zinc-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                New Task
              </Link>
              <Link
                href="/dashboard/board"
                className="flex items-center gap-2.5 rounded-xl border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 hover:border-zinc-300 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:border-zinc-600"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
                </svg>
                Open Board
              </Link>
            </div>
          </div>

          {/* Progress panel */}
          {progressItems.length > 0 ? (
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
                Task Status
              </h2>
              <div className="space-y-4">
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
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
              By Assignee
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
              <p className="text-sm text-zinc-400 dark:text-zinc-400">
                No assignee data yet
              </p>
            )}
          </div>

          {/* Recent Activity */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Recent Activity
              </h2>
              {activities.length > 0 && (
                <span className="text-xs text-zinc-400 dark:text-zinc-400">
                  Latest {activities.length}
                </span>
              )}
            </div>
            {activities.length > 0 ? (
              <ul className="space-y-2.5 max-h-72 overflow-y-auto">
                {activities.map((a) => (
                  <li key={a.id} className="flex items-start gap-3">
                    <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${actionIcon[a.action] ?? "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"}`}>
                      {(a.actor_display_name || a.actor_email || "?").slice(0, 1).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] leading-snug text-zinc-700 dark:text-zinc-300">
                        {formatActivityLine(a)}
                      </p>
                      <p className="mt-0.5 text-[11px] text-zinc-400 dark:text-zinc-400">
                        {timeAgo(a.created_at)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <p className="text-sm text-zinc-400 dark:text-zinc-400">
                  {selectedBoardId ? "No activity yet" : "Select a board to see activity"}
                </p>
                <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-400">
                  Task updates will appear here.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
