"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useBoardData } from "@/hooks/useBoardData";
import { useWorkspaceMembers } from "@/hooks/useWorkspaceMembers";
import type { Task, List } from "@/types/database";
import type { MemberWithProfile } from "@/hooks/useWorkspaceMembers";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getLocalDate(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Returns a sortable YYYY-MM-DD key for a due_date string. */
function dueDateKey(dateStr: string): string {
  return dateStr.slice(0, 10); // already "YYYY-MM-DD"
}

/** Human-readable section heading for a date key. */
function formatGroupHeading(key: string): string {
  const target = getLocalDate(new Date(key + "T00:00:00"));
  const today = getLocalDate(new Date());
  const diffDays = Math.round(
    (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays === -1) return "Yesterday";
  if (diffDays < 0) return `${Math.abs(diffDays)}d overdue · ${target.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  if (diffDays <= 6)
    return target.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
  return target.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: target.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
  });
}

/** Relative label shown on each task row (compact). */
function relativeLabel(key: string): { label: string; overdue: boolean } {
  const target = getLocalDate(new Date(key + "T00:00:00"));
  const today = getLocalDate(new Date());
  const diffDays = Math.round(
    (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diffDays < 0) return { label: `${Math.abs(diffDays)}d overdue`, overdue: true };
  if (diffDays === 0) return { label: "Today", overdue: false };
  if (diffDays === 1) return { label: "Tomorrow", overdue: false };
  return { label: `${diffDays}d`, overdue: false };
}

function getInitials(email: string, displayName: string): string {
  if (displayName && displayName.trim()) {
    const parts = displayName.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

function isCompletedListTitle(title: string): boolean {
  const t = title.toLowerCase().trim();
  return t === "done" || t === "completed";
}

const LIST_COLOR_DEFAULTS: Record<string, string> = {
  "To Do": "#a1a1aa",
  "In Progress": "#3b82f6",
  Completed: "#10b981",
  Done: "#10b981",
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TaskItem({
  task,
  list,
  assignee,
  boardId,
}: {
  task: Task;
  list: List | undefined;
  assignee: MemberWithProfile | null;
  boardId: string | null;
}) {
  const listTitle = list?.title ?? "—";
  const displayTitle = listTitle === "Done" ? "Completed" : listTitle;
  const listColor =
    list?.color || LIST_COLOR_DEFAULTS[listTitle] || "#a1a1aa";

  const done = task.is_completed || isCompletedListTitle(listTitle);
  const { label, overdue } = task.due_date
    ? relativeLabel(dueDateKey(task.due_date))
    : { label: "", overdue: false };
  const showOverdue = overdue && !done;

  // Navigate to the board page (scoped view) — shallow for now
  const href = boardId ? `/dashboard/board` : "#";

  return (
    <Link
      href={href}
      className={`group flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-all duration-150 select-none
        ${done
          ? "border-zinc-100 bg-white/60 dark:border-zinc-800/50 dark:bg-zinc-900/40"
          : showOverdue
            ? "border-red-100 bg-red-50/30 hover:border-red-200 hover:bg-red-50/60 dark:border-red-900/30 dark:bg-red-950/20 dark:hover:border-red-800/40"
            : "border-zinc-100 bg-white hover:border-zinc-200 hover:bg-zinc-50/60 dark:border-zinc-800/50 dark:bg-zinc-900/60 dark:hover:border-zinc-700/50 dark:hover:bg-zinc-800/60"
        }`}
    >
      {/* Completion indicator */}
      <span
        className={`shrink-0 flex h-4 w-4 items-center justify-center rounded-full border-2 transition-colors
          ${done
            ? "border-emerald-400 bg-emerald-400 dark:border-emerald-500 dark:bg-emerald-500"
            : showOverdue
              ? "border-red-300 dark:border-red-700"
              : "border-zinc-300 dark:border-zinc-600"
          }`}
      >
        {done && (
          <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>

      {/* Title */}
      <span
        className={`flex-1 min-w-0 truncate text-[13px] font-medium leading-snug
          ${done
            ? "line-through text-zinc-400 dark:text-zinc-500"
            : showOverdue
              ? "text-zinc-800 dark:text-zinc-200"
              : "text-zinc-800 dark:text-zinc-200"
          }`}
      >
        {task.title}
      </span>

      {/* Status badge */}
      <span className="hidden sm:inline-flex shrink-0 items-center gap-1 rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: listColor }} />
        {displayTitle}
      </span>

      {/* Assignee avatar */}
      {assignee && (
        <span
          className="shrink-0 inline-flex h-5 w-5 items-center justify-center rounded-full bg-zinc-200 text-[8px] font-semibold text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300"
          title={assignee.display_name || assignee.email}
        >
          {getInitials(assignee.email, assignee.display_name)}
        </span>
      )}

      {/* Overdue chip (only on overdue, non-done tasks) */}
      {showOverdue && (
        <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium bg-red-50 text-red-500 dark:bg-red-950/40 dark:text-red-400">
          {label}
        </span>
      )}

      {/* Arrow hint */}
      <svg className="shrink-0 h-3.5 w-3.5 text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity dark:text-zinc-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
      </svg>
    </Link>
  );
}

interface DateGroup {
  key: string;
  isPast: boolean;
  tasks: Task[];
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function CalendarPage() {
  // ── Hydration gate ───────────────────────────────────────────────────────
  // All date-dependent rendering (new Date(), toLocaleDateString, isPast,
  // isToday, overdue labels) must only execute on the client after mount.
  // The first render must be identical between server and client.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

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

  // Build lookup maps
  const listMap = useMemo(() => {
    const m = new Map<string, List>();
    for (const l of lists) m.set(l.id, l);
    return m;
  }, [lists]);

  const memberMap = useMemo(() => {
    const m = new Map<string, MemberWithProfile>();
    for (const mem of members) m.set(mem.user_id, mem);
    return m;
  }, [members]);

  // Only tasks with a due_date, sorted chronologically.
  // `mounted` is in the dependency array so this re-runs after hydration,
  // at which point new Date() correctly reflects the client's local timezone.
  const dateGroups = useMemo((): DateGroup[] => {
    if (!mounted) return []; // stable empty value during SSR / first render

    const today = getLocalDate(new Date());
    const tasksWithDue = tasks.filter((t) => t.due_date !== null);

    // Group by date key
    const groupMap = new Map<string, Task[]>();
    for (const t of tasksWithDue) {
      const key = dueDateKey(t.due_date!);
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key)!.push(t);
    }

    // Sort groups chronologically
    const sortedKeys = Array.from(groupMap.keys()).sort();

    return sortedKeys.map((key) => {
      const target = getLocalDate(new Date(key + "T00:00:00"));
      const isPast = target < today;
      return {
        key,
        isPast,
        tasks: groupMap.get(key)!,
      };
    });
  }, [tasks, mounted]);

  const hasDueTasks = dateGroups.length > 0;
  const totalWithDue = dateGroups.reduce((s, g) => s + g.tasks.length, 0);

  const selectClass =
    "rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50 hover:text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-400 dark:hover:bg-zinc-700/50 dark:hover:text-zinc-300 dark:focus:ring-zinc-600";

  return (
    <div className="mx-auto max-w-2xl">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <svg className="h-5 w-5 text-zinc-400 dark:text-zinc-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
          </svg>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            Calendar
          </h1>
        </div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Tasks grouped by due date
        </p>
      </div>

      {/* ── Everything below depends on client-only state (localStorage,
           Supabase, new Date()). Before mounted, render a deterministic
           spinner so the server HTML and client first-render are identical. */}
      {!mounted ? (
        <div className="flex items-center justify-center py-20">
          <svg className="h-6 w-6 animate-spin text-zinc-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : (
        <>
          {/* ── Context selectors ─────────────────────────────────── */}
          <div className="mb-5 flex items-center gap-2 flex-wrap">
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
                    className={selectClass}
                  >
                    {boards.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.title}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-sm text-zinc-400 dark:text-zinc-500">No boards</span>
                )}
              </>
            )}

            {/* Stats chip */}
            {hasDueTasks && (
              <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
                </svg>
                {totalWithDue} task{totalWithDue !== 1 ? "s" : ""} with due date
              </span>
            )}
          </div>

          {/* ── Content ──────────────────────────────────────────────── */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <svg className="h-6 w-6 animate-spin text-zinc-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : !selectedWorkspaceId ? (
            <EmptyState icon="workspace" message="Select a workspace to view the calendar" />
          ) : !selectedBoardId ? (
            <EmptyState icon="board" message="Select a board to view scheduled tasks" />
          ) : !hasDueTasks ? (
            <EmptyState
              icon="calendar"
              message="No tasks have a due date yet"
              sub="Add due dates to your tasks on the Board page to see them here."
            />
          ) : (
            /* ── Grouped date list ─────────────────────────────────── */
            <div className="space-y-7">
              {dateGroups.map(({ key, isPast, tasks: groupTasks }) => {
                // All new Date() calls here are safe — only reachable after mounted === true
                const heading = formatGroupHeading(key);
                const todayMs = getLocalDate(new Date()).getTime();
                const targetMs = getLocalDate(new Date(key + "T00:00:00")).getTime();
                const isToday = targetMs === todayMs;

                return (
                  <section key={key}>
                    {/* Date heading */}
                    <div className="mb-2.5 flex items-center gap-2">
                      <span
                        className={`shrink-0 h-2 w-2 rounded-full ${
                          isPast && !isToday
                            ? "bg-red-400 dark:bg-red-500"
                            : isToday
                              ? "bg-amber-400 dark:bg-amber-500"
                              : "bg-zinc-300 dark:bg-zinc-600"
                        }`}
                      />
                      <h2
                        className={`text-[13px] font-semibold tracking-tight ${
                          isPast && !isToday
                            ? "text-red-500 dark:text-red-400"
                            : isToday
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-zinc-700 dark:text-zinc-300"
                        }`}
                      >
                        {heading}
                      </h2>
                      <span className="ml-1 text-[11px] font-medium text-zinc-400 dark:text-zinc-500">
                        {groupTasks.length} task{groupTasks.length !== 1 ? "s" : ""}
                      </span>
                      <div className="flex-1 h-px bg-zinc-100 dark:bg-zinc-800" />
                    </div>

                    {/* Task list */}
                    <ul className="space-y-1.5">
                      {groupTasks.map((task) => (
                        <li key={task.id}>
                          <TaskItem
                            task={task}
                            list={listMap.get(task.list_id)}
                            assignee={
                              task.assignee_id ? memberMap.get(task.assignee_id) ?? null : null
                            }
                            boardId={selectedBoardId}
                          />
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state helper
// ---------------------------------------------------------------------------

function EmptyState({
  icon,
  message,
  sub,
}: {
  icon: "workspace" | "board" | "calendar";
  message: string;
  sub?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 py-20 dark:border-zinc-700">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800">
        {icon === "calendar" && (
          <svg className="h-5 w-5 text-zinc-400 dark:text-zinc-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
          </svg>
        )}
        {icon === "workspace" && (
          <svg className="h-5 w-5 text-zinc-400 dark:text-zinc-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 7.125C2.25 6.504 2.754 6 3.375 6h6c.621 0 1.125.504 1.125 1.125v3.75c0 .621-.504 1.125-1.125 1.125h-6a1.125 1.125 0 0 1-1.125-1.125v-3.75ZM14.25 8.625c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v8.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 0 1-1.125-1.125v-8.25ZM2.25 15.375c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v2.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 0 1-1.125-1.125v-2.25Z" />
          </svg>
        )}
        {icon === "board" && (
          <svg className="h-5 w-5 text-zinc-400 dark:text-zinc-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
        )}
      </div>
      <p className="text-sm font-medium text-zinc-400 dark:text-zinc-500">{message}</p>
      {sub && (
        <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500 text-center max-w-xs">
          {sub}
        </p>
      )}
    </div>
  );
}
