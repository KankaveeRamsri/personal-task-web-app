"use client";

import { useMemo } from "react";
import { useBoardData } from "@/hooks/useBoardData";
import { useWorkspaceMembers } from "@/hooks/useWorkspaceMembers";
import type { Task } from "@/types/database";
import type { MemberWithProfile } from "@/hooks/useWorkspaceMembers";

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

function DueDateChip({ dateStr }: { dateStr: string }) {
  const { label, diffDays } = getDueDateInfo(dateStr);
  const isOverdue = diffDays < 0;
  const isToday = diffDays === 0;

  let chipClass: string;
  if (isOverdue) {
    chipClass =
      "bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400";
  } else if (isToday) {
    chipClass =
      "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400";
  } else {
    chipClass =
      "bg-zinc-100 text-zinc-500 dark:bg-zinc-700/50 dark:text-zinc-400";
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
  } = useBoardData();

  const { members } = useWorkspaceMembers(selectedWorkspaceId);

  const listMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const l of lists) map.set(l.id, l.title);
    return map;
  }, [lists]);

  const memberMap = useMemo(() => {
    const map = new Map<string, MemberWithProfile>();
    for (const m of members) map.set(m.user_id, m);
    return map;
  }, [members]);

  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      if (a.is_completed !== b.is_completed)
        return a.is_completed ? 1 : -1;
      return b.created_at.localeCompare(a.created_at);
    });
  }, [tasks]);

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
                  assignee={
                    task.assignee_id
                      ? memberMap.get(task.assignee_id) ?? null
                      : null
                  }
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TaskRow({
  task,
  listTitle,
  assignee,
}: {
  task: Task;
  listTitle: string;
  assignee: MemberWithProfile | null;
}) {
  const displayTitle =
    listTitle === "Done" ? "Completed" : listTitle;

  return (
    <tr className="border-t border-zinc-100 transition-colors hover:bg-zinc-50/80 dark:border-zinc-800 dark:hover:bg-zinc-800/50">
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
        <span className="inline-flex rounded-md bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
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
          <DueDateChip dateStr={task.due_date} />
        ) : (
          <span className="text-xs text-zinc-400 dark:text-zinc-500">
            —
          </span>
        )}
      </td>
    </tr>
  );
}
