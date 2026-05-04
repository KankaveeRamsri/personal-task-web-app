"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useBoardData } from "@/hooks/useBoardData";
import { useWorkspaceMembers } from "@/hooks/useWorkspaceMembers";
import { createClient } from "@/lib/supabase";
import { canEditTasks } from "@/lib/permissions";
import type { Task, TaskPriority } from "@/types/database";
import type { MemberWithProfile } from "@/hooks/useWorkspaceMembers";

type QuickView = "all" | "my_tasks" | "due_today" | "overdue" | "unassigned" | "completed";

// --- Helpers (matching existing patterns) ---

function getInitials(email: string, displayName: string): string {
  if (displayName && displayName.trim()) {
    const parts = displayName.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

function getPriorityBadge(priority: string) {
  const styles: Record<string, string> = {
    high: "bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400",
    medium: "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400",
    low: "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400",
  };
  return styles[priority] ?? "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400";
}

function getLocalDate(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function getDueDateInfo(dateStr: string): { label: string; diffDays: number } {
  const target = getLocalDate(new Date(dateStr + "T00:00:00"));
  const today = getLocalDate(new Date());
  const diffDays = Math.round(
    (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diffDays < 0) return { label: `${Math.abs(diffDays)}d overdue`, diffDays };
  if (diffDays === 0) return { label: "Today", diffDays };
  if (diffDays === 1) return { label: "Tomorrow", diffDays };
  if (diffDays <= 7) return { label: `${diffDays}d`, diffDays };
  return {
    label: target.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    diffDays,
  };
}

/** Returns true when a list is marked as done via the is_done column. */
function isDoneList(list: { is_done: boolean }): boolean {
  return list.is_done === true;
}

function DueDateChip({
  dateStr,
  isCompleted = false,
  isListDone = false,
}: {
  dateStr: string;
  isCompleted?: boolean;
  isListDone?: boolean;
}) {
  const done = isCompleted || isListDone;

  const { diffDays } = getDueDateInfo(dateStr);
  const isOverdue = diffDays < 0 && !done;
  const isToday = diffDays === 0 && !done;

  // For completed tasks: always show a muted absolute date, never overdue.
  let label: string;
  if (done) {
    const date = new Date(dateStr + "T00:00:00");
    label = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } else {
    label = getDueDateInfo(dateStr).label;
  }

  let chipClass: string;
  if (done) {
    chipClass = "bg-zinc-100 text-zinc-400 dark:bg-zinc-700/50 dark:text-zinc-500";
  } else if (isOverdue) {
    chipClass = "bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400";
  } else if (isToday) {
    chipClass = "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400";
  } else {
    chipClass = "bg-zinc-100 text-zinc-500 dark:bg-zinc-700/50 dark:text-zinc-400";
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium ${chipClass}`}
    >
      <svg
        className="h-3 w-3 shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"
        />
      </svg>
      {label}
    </span>
  );
}

// --- Main page ---

export default function TasksPage() {
  const {
    workspaces,
    selectedWorkspaceId,
    boards,
    selectedBoardId,
    lists,
    tasks,
    loading,
    setSelectedWorkspaceId,
    setSelectedBoardId,
    updateTask,
    deleteTask,
  } = useBoardData();

  const { members, currentRole } = useWorkspaceMembers(selectedWorkspaceId);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (!cancelled && data.user) setCurrentUserId(data.user.id);
    })();
    return () => { cancelled = true; };
  }, []);

  const listMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const l of lists) map.set(l.id, l.title);
    return map;
  }, [lists]);

  const doneListIds = useMemo(
    () => new Set(lists.filter((l) => isDoneList(l)).map((l) => l.id)),
    [lists]
  );

  const listDoneMap = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const l of lists) map.set(l.id, l.is_done);
    return map;
  }, [lists]);

  const listColorMap = useMemo(() => {
    const map = new Map<string, string>();
    const defaults: Record<string, string> = {
      "To Do": "#a1a1aa",
      "In Progress": "#3b82f6",
      "Completed": "#10b981",
      "Done": "#10b981",
    };
    for (const l of lists) {
      map.set(l.id, l.color || defaults[l.title] || "#a1a1aa");
    }
    return map;
  }, [lists]);

  const listPositionMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of lists) map.set(l.id, l.position);
    return map;
  }, [lists]);

  const memberMap = useMemo(() => {
    const map = new Map<string, MemberWithProfile>();
    for (const m of members) map.set(m.user_id, m);
    return map;
  }, [members]);

  // Filter & sort state
  const [activeQuickView, setActiveQuickView] = useState<QuickView>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterAssigneeId, setFilterAssigneeId] = useState("all");
  const [filterDueDate, setFilterDueDate] = useState("all");
  const [sortBy, setSortBy] = useState("due_date");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Bulk selection
  const canEdit = currentRole ? canEditTasks(currentRole) : false;
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const hasActiveFilters =
    searchQuery !== "" ||
    filterStatus !== "all" ||
    filterPriority !== "all" ||
    filterAssigneeId !== "all" ||
    filterDueDate !== "all" ||
    sortBy !== "due_date";

  const clearFilters = useCallback(() => {
    setActiveQuickView("all");
    setSearchQuery("");
    setFilterStatus("all");
    setFilterPriority("all");
    setFilterAssigneeId("all");
    setFilterDueDate("all");
    setSortBy("due_date");
  }, []);

  // Reset filters when board changes
  useEffect(() => {
    clearFilters();
    setSelectedTaskId(null);
    setSelectedIds(new Set());
  }, [selectedBoardId, clearFilters]);

  // Quick view counts
  const quickViewCounts = useMemo(() => {
    const now = new Date();
    const todayLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    return {
      all: tasks.length,
      my_tasks: tasks.filter((t) => t.assignee_id === currentUserId).length,
      due_today: tasks.filter((t) => {
        if (!t.due_date) return false;
        const d = new Date(t.due_date + "T00:00:00");
        const dl = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        return Math.round((dl.getTime() - todayLocal.getTime()) / 86400000) === 0;
      }).length,
      overdue: tasks.filter((t) => {
        if (!t.due_date || t.is_completed) return false;
        if (doneListIds.has(t.list_id)) return false;
        const d = new Date(t.due_date + "T00:00:00");
        const dl = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        return Math.round((dl.getTime() - todayLocal.getTime()) / 86400000) < 0;
      }).length,
      unassigned: tasks.filter((t) => t.assignee_id === null).length,
      completed: tasks.filter((t) => t.is_completed || doneListIds.has(t.list_id)).length,
    };
  }, [tasks, doneListIds, currentUserId]);

  const matchesQuickView = useCallback(
    (task: Task): boolean => {
      if (activeQuickView === "all") return true;
      const now = new Date();
      const todayLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      switch (activeQuickView) {
        case "my_tasks":
          return task.assignee_id === currentUserId;
        case "due_today": {
          if (!task.due_date) return false;
          const d = new Date(task.due_date + "T00:00:00");
          const dl = new Date(d.getFullYear(), d.getMonth(), d.getDate());
          return Math.round((dl.getTime() - todayLocal.getTime()) / 86400000) === 0;
        }
        case "overdue": {
          if (!task.due_date || task.is_completed || doneListIds.has(task.list_id)) return false;
          const d = new Date(task.due_date + "T00:00:00");
          const dl = new Date(d.getFullYear(), d.getMonth(), d.getDate());
          return Math.round((dl.getTime() - todayLocal.getTime()) / 86400000) < 0;
        }
        case "unassigned":
          return task.assignee_id === null;
        case "completed":
          return task.is_completed || doneListIds.has(task.list_id);
        default:
          return true;
      }
    },
    [activeQuickView, currentUserId, doneListIds]
  );

  const filteredTasks = useMemo(() => {
    const now = new Date();
    const todayLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    return tasks.filter((task) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = task.title.toLowerCase().includes(q);
        const matchesDesc = task.description?.toLowerCase().includes(q) ?? false;
        if (!matchesTitle && !matchesDesc) return false;
      }

      if (filterStatus !== "all" && task.list_id !== filterStatus) return false;

      if (filterPriority !== "all" && task.priority !== filterPriority) return false;

      if (filterAssigneeId === "unassigned") {
        if (task.assignee_id !== null) return false;
      } else if (filterAssigneeId !== "all") {
        if (task.assignee_id !== filterAssigneeId) return false;
      }

      if (filterDueDate !== "all") {
        if (filterDueDate === "no_due_date") {
          if (task.due_date !== null) return false;
        } else if (task.due_date === null) {
          return false;
        } else {
          const target = new Date(task.due_date + "T00:00:00");
          const targetLocal = new Date(target.getFullYear(), target.getMonth(), target.getDate());
          const diffDays = Math.round((targetLocal.getTime() - todayLocal.getTime()) / (1000 * 60 * 60 * 24));
          if (filterDueDate === "overdue") {
            if (diffDays >= 0) return false;
            if (task.is_completed || doneListIds.has(task.list_id)) return false;
          }
          if (filterDueDate === "today" && diffDays !== 0) return false;
          if (filterDueDate === "upcoming" && diffDays <= 0) return false;
        }
      }

      if (!matchesQuickView(task)) return false;

      return true;
    });
  }, [tasks, searchQuery, filterStatus, filterPriority, filterAssigneeId, filterDueDate, matchesQuickView]);

  const sortedTasks = useMemo(() => {
    const priorityRank: Record<string, number> = { high: 0, medium: 1, low: 2, none: 3 };

    return [...filteredTasks].sort((a, b) => {
      // Incomplete tasks always first
      if (a.is_completed !== b.is_completed)
        return a.is_completed ? 1 : -1;

      switch (sortBy) {
        case "due_date": {
          const aDate = a.due_date ? new Date(a.due_date + "T00:00:00").getTime() : Infinity;
          const bDate = b.due_date ? new Date(b.due_date + "T00:00:00").getTime() : Infinity;
          return aDate - bDate;
        }
        case "priority":
          return (priorityRank[a.priority] ?? 3) - (priorityRank[b.priority] ?? 3);
        case "title":
          return a.title.localeCompare(b.title);
        case "status": {
          const aPos = listPositionMap.get(a.list_id) ?? 0;
          const bPos = listPositionMap.get(b.list_id) ?? 0;
          return aPos - bPos;
        }
        default:
          return 0;
      }
    });
  }, [filteredTasks, sortBy, listMap]);

  const selectAllVisible = useCallback(() => {
    setSelectedIds(new Set(sortedTasks.map((t) => t.id)));
  }, [sortedTasks]);

  const selectedTask = selectedTaskId
    ? tasks.find((t) => t.id === selectedTaskId) ?? null
    : null;

  const selectedBoardTitle = boards.find((b) => b.id === selectedBoardId)?.title ?? "";

  // Bulk action handlers
  const handleBulkMove = useCallback(async (targetTitle: string) => {
    const targetList = lists.find(
      (l) => l.title.toLowerCase() === targetTitle.toLowerCase()
    );
    if (!targetList || selectedIds.size === 0) return;

    setBulkBusy(true);
    const ids = Array.from(selectedIds);
    let failed = false;
    for (const id of ids) {
      const res = await updateTask(id, { list_id: targetList.id });
      if (!res) { failed = true; break; }
    }
    setBulkBusy(false);
    if (!failed) setSelectedIds(new Set());
  }, [lists, selectedIds, updateTask]);

  const handleBulkPriority = useCallback(async (priority: TaskPriority) => {
    if (selectedIds.size === 0) return;
    setBulkBusy(true);
    const ids = Array.from(selectedIds);
    let failed = false;
    for (const id of ids) {
      const res = await updateTask(id, { priority });
      if (!res) { failed = true; break; }
    }
    setBulkBusy(false);
    if (!failed) setSelectedIds(new Set());
  }, [selectedIds, updateTask]);

  const handleBulkAssign = useCallback(async (assigneeId: string | null) => {
    if (selectedIds.size === 0) return;
    setBulkBusy(true);
    const ids = Array.from(selectedIds);
    let failed = false;
    for (const id of ids) {
      const res = await updateTask(id, { assignee_id: assigneeId });
      if (!res) { failed = true; break; }
    }
    setBulkBusy(false);
    if (!failed) setSelectedIds(new Set());
  }, [selectedIds, updateTask]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setBulkBusy(true);
    const ids = Array.from(selectedIds);
    for (const id of ids) {
      await deleteTask(id);
    }
    setBulkBusy(false);
    setSelectedIds(new Set());
    setSelectedTaskId(null);
  }, [selectedIds, deleteTask]);

  const selectClass =
    "rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-600 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-400 dark:focus:border-zinc-600";

  return (
    <div className="mx-auto max-w-5xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          Tasks
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Overview of all tasks in your board
        </p>
      </div>

      {/* Context selectors */}
      <div className="mb-5 flex items-center gap-2">
        {workspaces.length > 0 && (
          <select
            value={selectedWorkspaceId ?? ""}
            onChange={(e) => setSelectedWorkspaceId(e.target.value)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-900 shadow-md ring-1 ring-zinc-900/[0.08] transition-all hover:shadow-lg hover:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-white/[0.06] dark:hover:border-zinc-500 dark:focus:ring-zinc-500"
          >
            {workspaces.map((ws) => (
              <option key={ws.id} value={ws.id}>
                {ws.icon} {ws.name}
              </option>
            ))}
          </select>
        )}
        {selectedWorkspaceId && (
          <>
            <span className="text-zinc-300 dark:text-zinc-600">/</span>
            {boards.length > 0 ? (
              <select
                value={selectedBoardId ?? ""}
                onChange={(e) => setSelectedBoardId(e.target.value)}
                className="rounded-lg border border-zinc-200/60 bg-zinc-50/50 px-3 py-1.5 text-sm font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 hover:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700/30 dark:bg-zinc-800/30 dark:text-zinc-400 dark:hover:bg-zinc-700/50 dark:hover:text-zinc-300 dark:focus:ring-zinc-600"
              >
                {boards.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.title}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-sm text-zinc-400">No boards</span>
            )}
          </>
        )}
      </div>

      {/* Quick view tabs */}
      {selectedWorkspaceId && tasks.length > 0 && (
        <div className="mb-3 flex items-center gap-1 flex-wrap">
          {([
            { key: "all" as QuickView, label: "All" },
            { key: "my_tasks" as QuickView, label: "My Tasks" },
            { key: "due_today" as QuickView, label: "Due Today" },
            { key: "overdue" as QuickView, label: "Overdue" },
            { key: "unassigned" as QuickView, label: "Unassigned" },
            { key: "completed" as QuickView, label: "Completed" },
          ]).map(({ key, label }) => {
            const isActive = activeQuickView === key;
            const count = quickViewCounts[key];
            return (
              <button
                key={key}
                onClick={() => setActiveQuickView(key)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-800 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
                }`}
              >
                {label}
                <span
                  className={`inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none ${
                    isActive
                      ? "bg-white/20 text-white dark:bg-zinc-900/20 dark:text-zinc-900"
                      : "bg-zinc-200/80 text-zinc-500 dark:bg-zinc-700/80 dark:text-zinc-400"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Filter toolbar */}
      {selectedWorkspaceId && tasks.length > 0 && (
        <div className="mb-4 flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <svg
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
              />
            </svg>
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-md border border-zinc-200 bg-white pl-8 pr-3 py-1.5 text-xs text-zinc-700 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-300 dark:placeholder:text-zinc-500 dark:focus:border-zinc-600"
            />
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className={selectClass}
          >
            <option value="all">Status: All</option>
            {lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.title === "Done" ? "Completed" : l.title}
              </option>
            ))}
          </select>

          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className={selectClass}
          >
            <option value="all">Priority: All</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>

          <select
            value={filterAssigneeId}
            onChange={(e) => setFilterAssigneeId(e.target.value)}
            className={selectClass}
          >
            <option value="all">Assignee: All</option>
            <option value="unassigned">Unassigned</option>
            {members.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.display_name || m.email}
              </option>
            ))}
          </select>

          <select
            value={filterDueDate}
            onChange={(e) => setFilterDueDate(e.target.value)}
            className={selectClass}
          >
            <option value="all">Due: All</option>
            <option value="overdue">Overdue</option>
            <option value="today">Today</option>
            <option value="upcoming">Upcoming</option>
            <option value="no_due_date">No due date</option>
          </select>

          <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-700" />

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className={selectClass}
          >
            <option value="due_date">Sort: Due date</option>
            <option value="priority">Sort: Priority</option>
            <option value="title">Sort: Title</option>
            <option value="status">Sort: Status</option>
          </select>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
              Clear
            </button>
          )}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <svg
            className="h-6 w-6 animate-spin text-zinc-400"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        </div>
      ) : !selectedWorkspaceId ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 py-20 dark:border-zinc-700">
          <svg
            className="mb-3 h-8 w-8 text-zinc-300 dark:text-zinc-600"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M2.25 7.125C2.25 6.504 2.754 6 3.375 6h6c.621 0 1.125.504 1.125 1.125v3.75c0 .621-.504 1.125-1.125 1.125h-6a1.125 1.125 0 0 1-1.125-1.125v-3.75ZM14.25 8.625c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v8.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 0 1-1.125-1.125v-8.25ZM2.25 15.375c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v2.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 0 1-1.125-1.125v-2.25Z"
            />
          </svg>
          <p className="text-sm font-medium text-zinc-400 dark:text-zinc-500">
            Select a workspace to view tasks
          </p>
        </div>
      ) : sortedTasks.length === 0 && tasks.length > 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 py-20 dark:border-zinc-700">
          <svg
            className="mb-3 h-8 w-8 text-zinc-300 dark:text-zinc-600"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
            />
          </svg>
          <p className="text-sm font-medium text-zinc-400 dark:text-zinc-500">
            No matching tasks
          </p>
          <button
            onClick={clearFilters}
            className="mt-2 text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300 transition-colors"
          >
            Clear filters
          </button>
        </div>
      ) : sortedTasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 py-20 dark:border-zinc-700">
          <svg
            className="mb-3 h-8 w-8 text-zinc-300 dark:text-zinc-600"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
            />
          </svg>
          <p className="text-sm font-medium text-zinc-400 dark:text-zinc-500">
            No tasks yet
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50/80 dark:border-zinc-800 dark:bg-zinc-800/50">
                {canEdit && (
                  <th className="w-10 px-2 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={sortedTasks.length > 0 && selectedIds.size === sortedTasks.length}
                      onChange={() => {
                        if (selectedIds.size === sortedTasks.length) clearSelection();
                        else selectAllVisible();
                      }}
                      className="h-3.5 w-3.5 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-400 dark:border-zinc-600 dark:bg-zinc-800 dark:checked:bg-zinc-100"
                    />
                  </th>
                )}
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Task
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Priority
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Assignee
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Due Date
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedTasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  listTitle={listMap.get(task.list_id) ?? "—"}
                  listColor={listColorMap.get(task.list_id) ?? "#a1a1aa"}
                  isListDone={listDoneMap.get(task.list_id) ?? false}
                  assignee={
                    task.assignee_id
                      ? memberMap.get(task.assignee_id) ?? null
                      : null
                  }
                  isSelected={task.id === selectedTaskId}
                  onClick={() => setSelectedTaskId(task.id)}
                  canEdit={canEdit}
                  checked={selectedIds.has(task.id)}
                  onCheck={() => toggleSelect(task.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Read-only task detail drawer */}
      {selectedTask && (
        <TaskDetailDrawer
          task={selectedTask}
          listTitle={listMap.get(selectedTask.list_id) ?? "—"}
          listColor={listColorMap.get(selectedTask.list_id) ?? "#a1a1aa"}
          isListDone={listDoneMap.get(selectedTask.list_id) ?? false}
          boardTitle={selectedBoardTitle}
          assignee={
            selectedTask.assignee_id
              ? memberMap.get(selectedTask.assignee_id) ?? null
              : null
          }
          onClose={() => setSelectedTaskId(null)}
        />
      )}

      {/* Bulk action toolbar */}
      {canEdit && selectedIds.size > 0 && (
        <BulkToolbar
          selectedCount={selectedIds.size}
          totalCount={sortedTasks.length}
          listTitles={lists.map((l) => l.title)}
          members={members}
          busy={bulkBusy}
          onBulkMove={handleBulkMove}
          onBulkPriority={handleBulkPriority}
          onBulkAssign={handleBulkAssign}
          onBulkDelete={handleBulkDelete}
          onClear={clearSelection}
        />
      )}
    </div>
  );
}

function TaskRow({
  task,
  listTitle,
  listColor,
  isListDone,
  assignee,
  isSelected,
  onClick,
  canEdit,
  checked,
  onCheck,
}: {
  task: Task;
  listTitle: string;
  listColor: string;
  isListDone: boolean;
  assignee: MemberWithProfile | null;
  isSelected: boolean;
  onClick: () => void;
  canEdit: boolean;
  checked: boolean;
  onCheck: () => void;
}) {
  const displayTitle =
    listTitle === "Done" ? "Completed" : listTitle;

  return (
    <tr
      onClick={onClick}
      className={`cursor-pointer border-t transition-colors ${
        isSelected
          ? "bg-blue-50/60 dark:bg-blue-950/20"
          : checked
            ? "bg-zinc-50 dark:bg-zinc-800/30"
            : "border-zinc-100 hover:bg-zinc-50/80 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
      }`}
    >
      {/* Checkbox */}
      {canEdit && (
        <td
          className="w-10 px-2 py-3 text-center"
          onClick={(e) => { e.stopPropagation(); onCheck(); }}
        >
          <input
            type="checkbox"
            checked={checked}
            readOnly
            className="h-3.5 w-3.5 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-400 dark:border-zinc-600 dark:bg-zinc-800 dark:checked:bg-zinc-100"
          />
        </td>
      )}
      {/* Title */}
      <td className="px-4 py-3">
        <span
          className={`block text-[13px] font-medium ${
            task.is_completed
              ? "line-through text-zinc-400 dark:text-zinc-500"
              : "text-zinc-900 dark:text-zinc-100"
          }`}
        >
          {task.title}
        </span>
        {task.description && (
          <p className="mt-0.5 line-clamp-1 text-xs text-zinc-400 dark:text-zinc-500">
            {task.description}
          </p>
        )}
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        <span className="inline-flex items-center gap-1.5 rounded-md bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: listColor }} />
          {displayTitle}
        </span>
      </td>

      {/* Priority */}
      <td className="px-4 py-3">
        {task.priority && task.priority !== "none" ? (
          <span
            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium capitalize ${getPriorityBadge(task.priority)}`}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{
                backgroundColor:
                  task.priority === "high"
                    ? "#ef4444"
                    : task.priority === "medium"
                      ? "#f59e0b"
                      : "#3b82f6",
              }}
            />
            {task.priority}
          </span>
        ) : (
          <span className="text-xs text-zinc-400 dark:text-zinc-500">
            —
          </span>
        )}
      </td>

      {/* Assignee */}
      <td className="px-4 py-3">
        {assignee ? (
          <span
            className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400"
            title={assignee.email}
          >
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-zinc-200 text-[9px] font-semibold text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
              {getInitials(assignee.email, assignee.display_name)}
            </span>
            <span className="max-w-[100px] truncate">
              {assignee.display_name || assignee.email}
            </span>
          </span>
        ) : (
          <span className="text-xs text-zinc-400 dark:text-zinc-500">
            Unassigned
          </span>
        )}
      </td>

      {/* Due date */}
      <td className="px-4 py-3">
        {task.due_date ? (
          <DueDateChip
            dateStr={task.due_date}
            isCompleted={task.is_completed}
            isListDone={isListDone}
          />
        ) : (
          <span className="text-xs text-zinc-400 dark:text-zinc-500">
            —
          </span>
        )}
      </td>
    </tr>
  );
}

// --- Read-only task detail drawer ---

function TaskDetailDrawer({
  task,
  listTitle,
  listColor,
  isListDone,
  boardTitle,
  assignee,
  onClose,
}: {
  task: Task;
  listTitle: string;
  listColor: string;
  isListDone: boolean;
  boardTitle: string;
  assignee: MemberWithProfile | null;
  onClose: () => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const displayStatus = listTitle === "Done" ? "Completed" : listTitle;

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/20 backdrop-blur-[2px]"
        onClick={onClose}
        style={{ animation: "fade-in 0.15s ease-out" }}
      />
      <div
        className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-white shadow-xl border-l border-zinc-200 dark:bg-zinc-900 dark:border-zinc-700 flex flex-col"
        style={{ animation: "panel-in 0.2s ease-out" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            Task details
          </h2>
          <button
            onClick={onClose}
            className="flex items-center justify-center h-7 w-7 rounded-md text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">
              Title
            </label>
            <p className={`text-sm ${task.is_completed ? "line-through text-zinc-400 dark:text-zinc-500" : "text-zinc-800 dark:text-zinc-200"}`}>
              {task.title}
            </p>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">
              Description
            </label>
            {task.description ? (
              <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">
                {task.description}
              </p>
            ) : (
              <p className="text-sm text-zinc-400 dark:text-zinc-500 italic">
                No description
              </p>
            )}
          </div>

          {/* Status & Priority row */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">
                Status
              </label>
              <span className="inline-flex items-center gap-1.5 rounded-md bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: listColor }} />
                {displayStatus}
              </span>
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">
                Priority
              </label>
              {task.priority && task.priority !== "none" ? (
                <span
                  className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium capitalize ${getPriorityBadge(task.priority)}`}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{
                      backgroundColor:
                        task.priority === "high"
                          ? "#ef4444"
                          : task.priority === "medium"
                            ? "#f59e0b"
                            : "#3b82f6",
                    }}
                  />
                  {task.priority}
                </span>
              ) : (
                <p className="text-xs text-zinc-400 dark:text-zinc-500">None</p>
              )}
            </div>
          </div>

          {/* Due date & Assignee row */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">
                Due date
              </label>
              {task.due_date ? (
                <DueDateChip
                  dateStr={task.due_date}
                  isCompleted={task.is_completed}
                  isListDone={isListDone}
                />
              ) : (
                <p className="text-xs text-zinc-400 dark:text-zinc-500">
                  No due date
                </p>
              )}
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">
                Assignee
              </label>
              {assignee ? (
                <span className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400" title={assignee.email}>
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-zinc-200 text-[9px] font-semibold text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                    {getInitials(assignee.email, assignee.display_name)}
                  </span>
                  <span className="truncate">
                    {assignee.display_name || assignee.email}
                  </span>
                </span>
              ) : (
                <p className="text-xs text-zinc-400 dark:text-zinc-500">
                  Unassigned
                </p>
              )}
            </div>
          </div>

          {/* Board / List context */}
          {(boardTitle || listTitle) && (
            <div>
              <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">
                Board
              </label>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                {boardTitle}
                {listTitle && (
                  <>
                    <span className="mx-1.5 text-zinc-300 dark:text-zinc-600">/</span>
                    {displayStatus}
                  </>
                )}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-zinc-100 dark:border-zinc-800">
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
            Created {new Date(task.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            {task.updated_at !== task.created_at && (
              <> &middot; Updated {new Date(task.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</>
            )}
          </p>
        </div>
      </div>
    </>
  );
}

// --- Bulk action toolbar ---

const displayListTitle = (title: string) =>
  title === "Done" ? "Completed" : title;

function BulkToolbar({
  selectedCount,
  totalCount,
  listTitles,
  members,
  busy,
  onBulkMove,
  onBulkPriority,
  onBulkAssign,
  onBulkDelete,
  onClear,
}: {
  selectedCount: number;
  totalCount: number;
  listTitles: string[];
  members: MemberWithProfile[];
  busy: boolean;
  onBulkMove: (targetTitle: string) => void;
  onBulkPriority: (priority: TaskPriority) => void;
  onBulkAssign: (assigneeId: string | null) => void;
  onBulkDelete: () => void;
  onClear: () => void;
}) {
  const [moveOpen, setMoveOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const moveRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!moveOpen) return;
    const handler = (e: MouseEvent) => {
      if (moveRef.current && !moveRef.current.contains(e.target as Node))
        setMoveOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [moveOpen]);

  useEffect(() => {
    if (confirmDelete) setMoveOpen(false);
  }, [confirmDelete]);

  const btnBase = "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <>
      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/20 backdrop-blur-[2px]">
          <div className="mx-4 w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-700 dark:bg-zinc-800">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50 dark:bg-red-950">
                <svg className="h-4.5 w-4.5 text-red-500 dark:text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Delete tasks</h3>
                <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                  Delete {selectedCount} selected task{selectedCount > 1 ? "s" : ""}? This cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button onClick={() => setConfirmDelete(false)} disabled={busy} className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 active:bg-zinc-200 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-700">
                Cancel
              </button>
              <button
                onClick={() => { setConfirmDelete(false); onBulkDelete(); }}
                disabled={busy}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-700 active:bg-red-800 disabled:opacity-50"
              >
                {busy ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 shadow-lg dark:border-zinc-700 dark:bg-zinc-800"
        style={{ animation: "toolbar-in 0.15s ease-out" }}
      >
        <span className="flex items-center gap-1.5 shrink-0">
          <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-blue-500 px-1.5 text-[11px] font-semibold text-white">
            {selectedCount}
          </span>
          <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
            of {totalCount}
          </span>
        </span>

        <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-700" />

        {/* Move */}
        <div className="relative" ref={moveRef}>
          <button
            onClick={() => setMoveOpen((v) => !v)}
            disabled={busy}
            className={`${btnBase} text-zinc-600 hover:bg-zinc-100 hover:text-zinc-800 active:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-700 dark:hover:text-zinc-100`}
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
            </svg>
            Move
          </button>
          {moveOpen && (
            <div className="absolute bottom-full left-0 mb-2 w-40 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
              <p className="px-3 py-1 text-[11px] font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Move to</p>
              {listTitles.map((title) => (
                <button
                  key={title}
                  onClick={() => { setMoveOpen(false); onBulkMove(title); }}
                  disabled={busy}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-zinc-700/50"
                >
                  {displayListTitle(title)}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Priority */}
        <select
          onChange={(e) => { if (e.target.value) { onBulkPriority(e.target.value as TaskPriority); e.target.value = ""; } }}
          disabled={busy}
          defaultValue=""
          className="h-8 rounded-lg border border-zinc-200 bg-transparent pl-2 pr-6 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-800 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-700"
        >
          <option value="" disabled>Priority</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
          <option value="none">None</option>
        </select>

        {/* Assignee */}
        <select
          onChange={(e) => {
            const val = e.target.value;
            onBulkAssign(val === "__unassigned__" ? null : val);
            e.target.value = "";
          }}
          disabled={busy}
          defaultValue=""
          className="h-8 max-w-[140px] rounded-lg border border-zinc-200 bg-transparent pl-2 pr-6 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-800 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-700"
        >
          <option value="" disabled>Assignee</option>
          <option value="__unassigned__">Unassigned</option>
          {members.map((m) => (
            <option key={m.user_id} value={m.user_id}>
              {m.display_name || m.email}
            </option>
          ))}
        </select>

        {/* Delete */}
        <button
          onClick={() => setConfirmDelete(true)}
          disabled={busy}
          className={`${btnBase} text-red-500 hover:bg-red-50 active:bg-red-100 dark:text-red-400 dark:hover:bg-red-950/30`}
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
          </svg>
          Delete
        </button>

        <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-700" />

        <button
          onClick={onClear}
          disabled={busy}
          className={`${btnBase} text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-300`}
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
          Clear
        </button>

        <style jsx>{`
          @keyframes toolbar-in {
            from { opacity: 0; transform: translateX(-50%) translateY(8px); }
            to { opacity: 1; transform: translateX(-50%) translateY(0); }
          }
        `}</style>
      </div>
    </>
  );
}
