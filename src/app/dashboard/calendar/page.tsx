"use client";

import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useBoardData } from "@/hooks/useBoardData";
import { useWorkspaceMembers } from "@/hooks/useWorkspaceMembers";
import { logActivity } from "@/lib/activity-log";
import type { Task, List, Board } from "@/types/database";
import type { MemberWithProfile } from "@/hooks/useWorkspaceMembers";

// ---------------------------------------------------------------------------
// Pure date helpers — no side-effects, timezone-safe
// ---------------------------------------------------------------------------

/** Strips time component, returns a new Date at local midnight. */
function localMidnight(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Converts a Date to a YYYY-MM-DD string using LOCAL date parts. */
function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Parses a YYYY-MM-DD key into a local-midnight Date (no timezone shift). */
function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** due_date stored as "YYYY-MM-DD" or "YYYY-MM-DDTHH:mm:ss" → stable key */
function dueDateKey(dateStr: string): string {
  return dateStr.slice(0, 10);
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

/** Returns the Date of Monday of the week containing `d`. */
function startOfWeek(d: Date): Date {
  const day = d.getDay(); // 0=Sun … 6=Sat
  const diff = (day === 0 ? -6 : 1 - day); // shift to Mon
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + diff);
}

/** Returns the Date of Sunday of the week containing `d`. */
function endOfWeek(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? 0 : 7 - day;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + diff);
}

/** Add N months to a date (returns first day of that month). */
function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

/** Format month title, e.g. "April 2026". Pure string, no locale dependency. */
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
function formatMonthTitle(d: Date): string {
  return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

/** Short day number for display in cell header. */
function dayNumber(d: Date): number {
  return d.getDate();
}

// ---------------------------------------------------------------------------
// Initialise `currentMonth` from today — called ONLY on client
// ---------------------------------------------------------------------------
function todayMonthStart(): Date {
  const t = new Date();
  return new Date(t.getFullYear(), t.getMonth(), 1);
}

// ---------------------------------------------------------------------------
// Existing helpers kept for EmptyState / label usage
// ---------------------------------------------------------------------------

function getInitials(email: string, displayName: string): string {
  if (displayName && displayName.trim()) {
    const parts = displayName.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

const LIST_COLOR_DEFAULTS: Record<string, string> = {
  "To Do": "#a1a1aa",
  "In Progress": "#3b82f6",
  Completed: "#10b981",
  Done: "#10b981",
};

// ---------------------------------------------------------------------------
// TaskChip — compact pill shown inside a calendar cell
// ---------------------------------------------------------------------------

const MAX_VISIBLE = 3;

function TaskChip({
  task,
  list,
  assignee,
  onPreview,
  fromDate,
  canEdit,
  canEditDueDate,
}: {
  task: Task;
  list: List | undefined;
  assignee: MemberWithProfile | null;
  onPreview: () => void;
  fromDate: string;
  canEdit: boolean;
  canEditDueDate: boolean;
}) {
  const listTitle = list?.title ?? "";
  const listColor = list?.color || LIST_COLOR_DEFAULTS[listTitle] || "#a1a1aa";
  const done = task.is_completed || list?.is_done === true;

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `cal-task-${task.id}`,
    disabled: !canEditDueDate,
    data: { type: "calendar-task", taskId: task.id, fromDate },
  });

  return (
    <button
      ref={setNodeRef}
      onClick={onPreview}
      title={task.title}
      {...(canEditDueDate ? attributes : {})}
      {...(canEditDueDate ? listeners : {})}
      style={{ opacity: isDragging ? 0.35 : 1, cursor: canEditDueDate ? (isDragging ? "grabbing" : "grab") : "pointer" }}
      className={`group w-full flex items-center gap-1 rounded px-1.5 py-[3px] text-[11px] font-medium leading-tight truncate transition-opacity text-left
        ${done
          ? "bg-zinc-100 text-zinc-400 line-through dark:bg-zinc-800/60 dark:text-zinc-500"
          : "bg-white text-zinc-700 hover:bg-blue-50 hover:text-blue-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-blue-950/40 dark:hover:text-blue-300"
        } border border-zinc-200/80 dark:border-zinc-700/60`}
    >
      <span className="shrink-0 h-1.5 w-1.5 rounded-full" style={{ backgroundColor: done ? "#a1a1aa" : listColor }} />
      <span className="truncate">{task.title}</span>
      {assignee && (
        <span
          className="shrink-0 ml-auto inline-flex h-4 w-4 items-center justify-center rounded-full bg-zinc-200 text-[8px] font-semibold text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300"
          title={assignee.display_name || assignee.email}
        >
          {getInitials(assignee.email, assignee.display_name)}
        </span>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// CalendarCell — single day box in the grid
// ---------------------------------------------------------------------------

function CalendarCell({
  dateKey,
  date,
  isCurrentMonth,
  isToday,
  tasks,
  listMap,
  memberMap,
  canEdit,
  canEditDueDate,
  onPreviewTask,
  onShowMore,
}: {
  dateKey: string;
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  tasks: Task[];
  listMap: Map<string, List>;
  memberMap: Map<string, MemberWithProfile>;
  boardId: string | null;
  canEdit: boolean;
  canEditDueDate: boolean;
  onPreviewTask: (task: Task) => void;
  onShowMore?: (dateKey: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `cal-date-${dateKey}`,
    data: { type: "calendar-date", dateKey },
  });

  const visible = tasks.slice(0, MAX_VISIBLE);
  const overflow = tasks.length - MAX_VISIBLE;
  const num = dayNumber(date);

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[100px] p-1.5 flex flex-col gap-1 border-b border-r transition-colors
        ${isCurrentMonth
          ? "bg-white dark:bg-zinc-900"
          : "bg-zinc-50/60 dark:bg-zinc-900/40"
        }
        ${isToday ? "ring-2 ring-inset ring-blue-500/30 dark:ring-blue-500/20" : ""}
        ${isOver ? "bg-blue-50/70 dark:bg-blue-950/30 ring-2 ring-inset ring-blue-400/40" : ""}
      `}
    >
      {/* Day number */}
      <div className="flex items-center justify-between mb-0.5">
        <span
          className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-semibold leading-none
            ${isToday
              ? "bg-blue-600 text-white"
              : isCurrentMonth
                ? "text-zinc-700 dark:text-zinc-300"
                : "text-zinc-400 dark:text-zinc-600"
            }`}
        >
          {num}
        </span>
        {tasks.length > 0 && !isCurrentMonth && (
          <span className="text-[10px] text-zinc-400 dark:text-zinc-600">
            {tasks.length}
          </span>
        )}
      </div>

      {/* Task chips */}
      <div className="flex flex-col gap-0.5 min-w-0">
        {visible.map((task) => (
          <TaskChip
            key={task.id}
            task={task}
            list={listMap.get(task.list_id)}
            assignee={task.assignee_id ? memberMap.get(task.assignee_id) ?? null : null}
            onPreview={() => onPreviewTask(task)}
            fromDate={dateKey}
            canEdit={canEdit}
            canEditDueDate={canEditDueDate}
          />
        ))}
        {overflow > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onShowMore?.(dateKey);
            }}
            className="w-full text-left px-1.5 py-0.5 mt-0.5 text-[10px] font-medium text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 rounded transition-colors dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800"
          >
            +{overflow} more
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TaskPreviewModal — portal overlay showing task details
// ---------------------------------------------------------------------------

const PRIORITY_LABEL: Record<string, string> = {
  none: "None", low: "Low", medium: "Medium", high: "High",
};
const PRIORITY_COLOR: Record<string, string> = {
  none: "text-zinc-400", low: "text-blue-500", medium: "text-amber-500", high: "text-red-500",
};


// ---------------------------------------------------------------------------
// AgendaTaskRow — single task in the agenda view
// ---------------------------------------------------------------------------

function AgendaTaskRow({
  task,
  list,
  assignee,
  onPreview,
}: {
  task: Task;
  list: List | undefined;
  assignee: MemberWithProfile | null;
  onPreview: () => void;
}) {
  const listTitle = list?.title ?? "—";
  const displayTitle = listTitle === "Done" ? "Completed" : listTitle;
  const listColor = list?.color || LIST_COLOR_DEFAULTS[listTitle] || "#a1a1aa";
  const done = task.is_completed || list?.is_done === true;
  const priority = task.priority ?? "none";

  return (
    <button
      onClick={onPreview}
      className={`group flex w-full items-center justify-between gap-4 rounded-xl border p-3 text-left transition-all hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40
        ${done 
          ? "border-zinc-200/60 bg-zinc-50/50 dark:border-zinc-800/60 dark:bg-zinc-900/30" 
          : "border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600"
        }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="shrink-0 flex h-4 w-4 items-center justify-center">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: done ? "#a1a1aa" : listColor }} />
        </div>
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className={`truncate text-sm font-medium ${done ? "line-through text-zinc-500 dark:text-zinc-500" : "text-zinc-900 dark:text-zinc-100"}`}>
            {task.title}
          </span>
          <div className="flex items-center gap-2 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
            <span>{displayTitle}</span>
            {priority !== "none" && (
              <>
                <span className="h-1 w-1 rounded-full bg-zinc-300 dark:bg-zinc-600" />
                <span className={PRIORITY_COLOR[priority] ?? ""}>{PRIORITY_LABEL[priority]}</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="shrink-0 flex items-center gap-3">
        {assignee && (
          <span
            className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-zinc-200 text-[9px] font-semibold text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300 ring-2 ring-white dark:ring-zinc-900"
            title={assignee.display_name || assignee.email}
          >
            {getInitials(assignee.email, assignee.display_name)}
          </span>
        )}
      </div>
    </button>
  );
}

function TaskPreviewModal({
  task,
  list,
  assignee,
  board,
  canEdit,
  canEditDueDate,
  onClose,
  onOpenInBoard,
  onUpdateDate,
}: {
  task: Task;
  list: List | undefined;
  assignee: MemberWithProfile | null;
  board: Board | undefined;
  canEdit: boolean;
  canEditDueDate: boolean;
  onClose: () => void;
  onOpenInBoard: (taskId: string) => void;
  onUpdateDate: (taskId: string, newDate: string) => Promise<void>;
}) {
  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const listTitle = list?.title ?? "—";
  const displayTitle = listTitle === "Done" ? "Completed" : listTitle;
  const listColor = list?.color || LIST_COLOR_DEFAULTS[listTitle] || "#a1a1aa";
  const done = task.is_completed || list?.is_done === true;

  // Format due date — deterministic (pure string split, no locale)
  let dueDateDisplay = "—";
  if (task.due_date) {
    const [y, m, d] = task.due_date.slice(0, 10).split("-").map(Number);
    dueDateDisplay = `${MONTH_NAMES[m - 1]} ${d}, ${y}`;
  }

  const priority = task.priority ?? "none";

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[200] bg-black/30 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={task.title}
        className="fixed z-[201] inset-y-0 right-0 w-full max-w-sm flex flex-col bg-white dark:bg-zinc-900 shadow-2xl border-l border-zinc-200 dark:border-zinc-700"
        style={{ animation: "panel-in 0.22s ease-out" }}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-1">Task</p>
            <h2 className={`text-base font-semibold leading-snug ${
              done ? "line-through text-zinc-400 dark:text-zinc-500" : "text-zinc-900 dark:text-zinc-100"
            }`}>{task.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 mt-0.5 flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors dark:hover:bg-zinc-800 dark:hover:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:focus:ring-zinc-600"
            aria-label="Close preview"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Description */}
          {task.description && (
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-1">Description</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed whitespace-pre-wrap">{task.description}</p>
            </div>
          )}

          {/* Meta grid */}
          <div className="grid grid-cols-2 gap-3">
            {/* Status */}
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-1">Status</p>
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: listColor }} />
                {displayTitle}
              </span>
            </div>

            {/* Priority */}
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-1">Priority</p>
              <span className={`text-sm font-medium ${PRIORITY_COLOR[priority] ?? "text-zinc-400"}`}>
                {PRIORITY_LABEL[priority] ?? "—"}
              </span>
            </div>

            {/* Due date */}
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-1">Due Date</p>
              {canEditDueDate ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-zinc-700 dark:text-zinc-300">{dueDateDisplay}</span>
                  <div className="relative inline-flex items-center">
                    <input
                      type="date"
                      value={task.due_date?.slice(0, 10) ?? ""}
                      onChange={(e) => {
                        if (e.target.value) {
                          onUpdateDate(task.id, e.target.value);
                        }
                      }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      aria-label="Change due date"
                    />
                    <button type="button" className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
                      Change
                    </button>
                  </div>
                </div>
              ) : (
                <span className="text-sm text-zinc-700 dark:text-zinc-300">{dueDateDisplay}</span>
              )}
            </div>

            {/* Board */}
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-1">Board</p>
              <span className="text-sm text-zinc-700 dark:text-zinc-300 truncate">{board?.title ?? "—"}</span>
            </div>
          </div>

          {/* Assignee */}
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-1">Assignee</p>
            {assignee ? (
              <span className="inline-flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-zinc-200 text-[9px] font-semibold text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                  {getInitials(assignee.email, assignee.display_name)}
                </span>
                {assignee.display_name || assignee.email}
              </span>
            ) : (
              <span className="text-sm text-zinc-400 dark:text-zinc-500">Unassigned</span>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-zinc-100 dark:border-zinc-800">
          <button
            onClick={() => { onClose(); onOpenInBoard(task.id); }}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 active:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-600"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
            Open in Board
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}

// ---------------------------------------------------------------------------
// DayTasksModal — portal overlay showing all tasks for a specific day
// ---------------------------------------------------------------------------

function DayTasksModal({
  dateKey,
  tasks,
  listMap,
  memberMap,
  canEdit,
  canEditDueDate,
  onClose,
  onPreviewTask,
}: {
  dateKey: string;
  tasks: Task[];
  listMap: Map<string, List>;
  memberMap: Map<string, MemberWithProfile>;
  canEdit: boolean;
  canEditDueDate: boolean;
  onClose: () => void;
  onPreviewTask: (task: Task) => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const date = parseDateKey(dateKey);
  const title = `${MONTH_NAMES[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[150] bg-black/20 backdrop-blur-[1px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        className="fixed z-[151] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[320px] flex flex-col bg-white dark:bg-zinc-900 shadow-xl border border-zinc-200 dark:border-zinc-700 rounded-xl overflow-hidden"
        style={{ animation: "panel-in 0.15s ease-out" }}
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h2>
          <button
            onClick={onClose}
            className="shrink-0 flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 transition-colors dark:hover:bg-zinc-700 dark:hover:text-zinc-200 focus:outline-none"
            aria-label="Close modal"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-3 max-h-[60vh] overflow-y-auto flex flex-col gap-1">
          {tasks.map((task) => (
            <TaskChip
              key={task.id}
              task={task}
              list={listMap.get(task.list_id)}
              assignee={task.assignee_id ? memberMap.get(task.assignee_id) ?? null : null}
              onPreview={() => {
                onPreviewTask(task);
              }}
              fromDate={dateKey}
              canEdit={canEdit}
              canEditDueDate={canEditDueDate}
            />
          ))}
        </div>
      </div>
    </>,
    document.body
  );
}

// ---------------------------------------------------------------------------
// EmptyState
// ---------------------------------------------------------------------------

function EmptyState({
  icon,
  message,
  sub,
}: {
  icon: "workspace" | "board" | "calendar" | "error" | "loading";
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
        {icon === "error" && (
          <svg className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        )}
        {icon === "loading" && (
          <svg className="h-5 w-5 animate-spin text-zinc-400 dark:text-zinc-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
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

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function CalendarPage() {
  // ── Hydration gate ──────────────────────────────────────────────────────
  // All date-dependent rendering must only execute after client mount.
  // The first render must be identical between server and client.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // ── View Toggle State ───────────────────────────────────────────────────
  const [viewType, setViewType] = useState<"month" | "agenda">("month");

  // ── Task preview state ──────────────────────────────────────────────────
  const [previewTask, setPreviewTask] = useState<Task | null>(null);
  const openPreview = useCallback((task: Task) => setPreviewTask(task), []);
  const closePreview = useCallback(() => setPreviewTask(null), []);

  // ── Overflow modal state ────────────────────────────────────────────────
  const [overflowDateKey, setOverflowDateKey] = useState<string | null>(null);
  const openOverflow = useCallback((dateKey: string) => setOverflowDateKey(dateKey), []);
  const closeOverflow = useCallback(() => setOverflowDateKey(null), []);

  // ── Filters state ────────────────────────────────────────────────────────
  const [filterListId, setFilterListId] = useState<string>("all");
  const [filterAssigneeId, setFilterAssigneeId] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");

  // ── Router for calendar → board navigation ─────────────────────────────
  const router = useRouter();

  const navigateToTask = useCallback((taskId: string) => {
    // Write the target task ID so Board page can scroll to and highlight it
    try { sessionStorage.setItem("calendarFocusTaskId", taskId); } catch { /* ignore */ }
    router.push("/dashboard/board");
  }, [router]);

  // ── Month navigation state (initialised lazily to avoid SSR mismatch) ──
  const [currentMonth, setCurrentMonth] = useState<Date | null>(null);
  useEffect(() => {
    // Only set after mount so server and client first render match
    setCurrentMonth(todayMonthStart());
  }, []);

  // ── Board data ──────────────────────────────────────────────────────────
  const {
    workspaces,
    selectedWorkspaceId,
    boards,
    selectedBoardId,
    lists,
    tasks,
    loading,
    errorMsg,
    setSelectedWorkspaceId,
    setSelectedBoardId,
    updateTask,
  } = useBoardData();

  const { members, currentRole } = useWorkspaceMembers(selectedWorkspaceId);
  const canEdit = !currentRole || ["owner", "admin", "member"].includes(currentRole);
  const canEditDueDate = !currentRole || ["owner", "admin"].includes(currentRole);

  // ── DnD sensors ─────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );

  // ── Optimistic DnD state ─────────────────────────────────────────────────
  // Maps taskId → overridden due_date key while a move is in-flight
  const [optimisticMoves, setOptimisticMoves] = useState<Map<string, string>>(new Map());
  // Task being dragged — used to render DragOverlay
  const activeDragRef = useRef<{ task: Task; fromDate: string } | null>(null);
  const [activeDragTask, setActiveDragTask] = useState<Task | null>(null);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    if (active.data.current?.type !== "calendar-task") return;
    const taskId: string = active.data.current.taskId;
    const fromDate: string = active.data.current.fromDate;
    const task = tasks.find((t) => t.id === taskId) ?? null;
    activeDragRef.current = task ? { task, fromDate } : null;
    setActiveDragTask(task);
  }, [tasks]);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    setActiveDragTask(null);
    activeDragRef.current = null;

    const { active, over } = event;
    if (!active || !over) return;
    if (active.data.current?.type !== "calendar-task") return;
    if (over.data.current?.type !== "calendar-date") return;
    if (!canEditDueDate) return;

    const taskId: string = active.data.current.taskId;
    const fromDate: string = active.data.current.fromDate;
    const toDate: string = over.data.current.dateKey;
    if (fromDate === toDate) return;

    // Optimistic UI: move task to new date immediately
    setOptimisticMoves((prev) => new Map(prev).set(taskId, toDate));

    // Persist via existing hook (updates tasks state on success, noop on error)
    const result = await updateTask(taskId, { due_date: toDate } as Partial<Task>);

    if (result && selectedWorkspaceId) {
      const task = tasks.find(t => t.id === taskId);
      const list = lists.find(l => l.id === task?.list_id);
      if (task && list) {
        await logActivity({
          workspaceId: selectedWorkspaceId,
          boardId: list.board_id,
          taskId: task.id,
          action: "due_date_changed",
          metadata: {
            task_title: task.title,
            old_due_date: fromDate,
            new_due_date: toDate,
            target_user_id: task.assignee_id,
          },
        });
      }
    }

    // Always clear the optimistic override after the request resolves.
    // On success: hook state is now updated, override is redundant.
    // On failure: hook state unchanged, clearing reverts the UI.
    setOptimisticMoves((prev) => {
      const next = new Map(prev);
      next.delete(taskId);
      return next;
    });

    void result; // suppress lint
  }, [canEdit, updateTask, tasks, lists, selectedWorkspaceId]);

  const handleReschedule = useCallback(async (taskId: string, newDate: string) => {
    if (!canEditDueDate) return;
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const oldDate = task.due_date;

    setOptimisticMoves((prev) => new Map(prev).set(taskId, newDate));
    const result = await updateTask(taskId, { due_date: newDate } as Partial<Task>);

    if (result && selectedWorkspaceId) {
      const list = lists.find(l => l.id === task.list_id);
      if (list) {
        await logActivity({
          workspaceId: selectedWorkspaceId,
          boardId: list.board_id,
          taskId: task.id,
          action: "due_date_changed",
          metadata: {
            task_title: task.title,
            old_due_date: oldDate,
            new_due_date: newDate,
            target_user_id: task.assignee_id,
          },
        });
      }
    }

    setOptimisticMoves((prev) => {
      const next = new Map(prev);
      next.delete(taskId);
      return next;
    });
  }, [updateTask, tasks, lists, selectedWorkspaceId, canEditDueDate]);

  // ── Lookup maps ─────────────────────────────────────────────────────────
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

  // ── Task lookup by date key ─────────────────────────────────────────────
  // Respects optimisticMoves overrides for immediate drag-drop feedback.
  const tasksByDate = useMemo(() => {
    if (!mounted) return new Map<string, Task[]>();
    const m = new Map<string, Task[]>();
    for (const t of tasks) {
      if (!t.due_date) continue;
      if (filterListId !== "all" && t.list_id !== filterListId) continue;
      if (filterAssigneeId !== "all" && (t.assignee_id || "unassigned") !== filterAssigneeId) continue;
      if (filterPriority !== "all" && (t.priority || "none") !== filterPriority) continue;

      // Use overridden date if a move is in-flight for this task
      const effectiveKey = optimisticMoves.get(t.id) ?? dueDateKey(t.due_date);
      if (!m.has(effectiveKey)) m.set(effectiveKey, []);
      m.get(effectiveKey)!.push(t);
    }
    return m;
  }, [tasks, mounted, optimisticMoves, filterListId, filterAssigneeId, filterPriority]);

  // ── Calendar grid cells ─────────────────────────────────────────────────
  const { cells, todayKey, monthTitle } = useMemo(() => {
    if (!mounted || !currentMonth) {
      return { cells: [], todayKey: "", monthTitle: "" };
    }

    const today = localMidnight(new Date());
    const todayKey = toDateKey(today);

    const first = startOfMonth(currentMonth);
    const last = endOfMonth(currentMonth);
    const gridStart = startOfWeek(first); // Monday of first week
    const gridEnd = endOfWeek(last);     // Sunday of last week

    const cells: Date[] = [];
    const cursor = new Date(gridStart);
    while (cursor <= gridEnd) {
      cells.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }

    return {
      cells,
      todayKey,
      monthTitle: formatMonthTitle(currentMonth),
    };
  }, [currentMonth, mounted]);

  // ── Selector style ──────────────────────────────────────────────────────
  const selectClass =
    "rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50 hover:text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-400 dark:hover:bg-zinc-700/50 dark:hover:text-zinc-300 dark:focus:ring-zinc-600";
  const navBtnClass =
    "inline-flex items-center justify-center h-8 w-8 rounded-lg border border-zinc-200 bg-white text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-200 dark:focus:ring-zinc-600";

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-7xl">
      {/* ── Static header — safe for SSR ───────────────────────── */}
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <svg className="h-5 w-5 text-zinc-400 dark:text-zinc-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
            </svg>
            <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              Calendar
            </h1>
          </div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            View tasks by due date
          </p>
        </div>

        {/* View Toggle */}
        <div className="flex items-center rounded-lg bg-zinc-100/80 p-1 ring-1 ring-inset ring-zinc-200/50 dark:bg-zinc-800/80 dark:ring-zinc-700/50 w-fit">
          <button
            onClick={() => setViewType("month")}
            className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:focus:ring-zinc-600 ${
              viewType === "month"
                ? "bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200/50 dark:bg-zinc-700 dark:text-zinc-100 dark:ring-zinc-600/50"
                : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
            </svg>
            Month
          </button>
          <button
            onClick={() => setViewType("agenda")}
            className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:focus:ring-zinc-600 ${
              viewType === "agenda"
                ? "bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200/50 dark:bg-zinc-700 dark:text-zinc-100 dark:ring-zinc-600/50"
                : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
            </svg>
            Agenda
          </button>
        </div>
      </div>

      {/* ── Everything below is client-only ────────────────────────
           Before mounted, render a single deterministic spinner so
           server HTML and client first-render are identical.       */}
      {!mounted ? (
        <EmptyState icon="loading" message="Loading calendar data..." />
      ) : (
        <>
          {/* ── Toolbar: workspace/board + month navigation ─────── */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {/* Workspace selector */}
            {workspaces.length > 0 && (
              <select
                value={selectedWorkspaceId ?? ""}
                onChange={(e) => setSelectedWorkspaceId(e.target.value)}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-900 shadow-sm ring-1 ring-zinc-900/[0.08] transition-all hover:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-white/[0.06] dark:hover:border-zinc-500 dark:focus:ring-zinc-500"
              >
                {workspaces.map((ws) => (
                  <option key={ws.id} value={ws.id}>
                    {ws.icon} {ws.name}
                  </option>
                ))}
              </select>
            )}

            {/* Board selector */}
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

            {/* Spacer */}
            <div className="flex-1" />

            {/* Month navigation */}
            {currentMonth && viewType === "month" && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentMonth((m) => m ? addMonths(m, -1) : m)}
                  className={navBtnClass}
                  aria-label="Previous month"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                  </svg>
                </button>

                <span className="min-w-[140px] text-center text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                  {monthTitle}
                </span>

                <button
                  onClick={() => setCurrentMonth((m) => m ? addMonths(m, 1) : m)}
                  className={navBtnClass}
                  aria-label="Next month"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </button>

                <button
                  onClick={() => setCurrentMonth(todayMonthStart())}
                  className="ml-1 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-[13px] font-medium text-zinc-600 transition-colors hover:bg-zinc-50 hover:text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-200 dark:focus:ring-zinc-600"
                >
                  Today
                </button>
              </div>
            )}
          </div>

          {/* ── Filters Row ──────────────────────────────────────── */}
          {selectedBoardId && tasks.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <select
                value={filterListId}
                onChange={(e) => setFilterListId(e.target.value)}
                className={selectClass}
              >
                <option value="all">All Lists</option>
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>{l.title}</option>
                ))}
              </select>

              <select
                value={filterAssigneeId}
                onChange={(e) => setFilterAssigneeId(e.target.value)}
                className={selectClass}
              >
                <option value="all">All Assignees</option>
                <option value="unassigned">Unassigned</option>
                {members.map((m) => (
                  <option key={m.user_id} value={m.user_id}>{m.display_name || m.email}</option>
                ))}
              </select>

              <select
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value)}
                className={selectClass}
              >
                <option value="all">All Priorities</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
                <option value="none">None</option>
              </select>

              {(filterListId !== "all" || filterAssigneeId !== "all" || filterPriority !== "all") && (
                <button
                  onClick={() => {
                    setFilterListId("all");
                    setFilterAssigneeId("all");
                    setFilterPriority("all");
                  }}
                  className="ml-auto text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors"
                >
                  Clear filters
                </button>
              )}
            </div>
          )}

          {/* ── Main content ─────────────────────────────────────── */}
          {loading ? (
            <EmptyState icon="loading" message="Loading calendar data..." />
          ) : errorMsg ? (
            <EmptyState icon="error" message="Failed to load calendar" sub={errorMsg} />
          ) : !selectedWorkspaceId ? (
            <EmptyState icon="workspace" message="Select a workspace to view the calendar" />
          ) : !selectedBoardId ? (
            <EmptyState icon="board" message="Select a board to view scheduled tasks" />
          ) : tasksByDate.size === 0 ? (
            <EmptyState
              icon="calendar"
              message="No tasks match your filters"
              sub="Try clearing filters or assigning due dates to tasks."
            />
          ) : viewType === "month" ? (
            /* ── Month grid ──────────────────────────────────────── */
            <DndContext
              sensors={sensors}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <div className="rounded-xl border border-zinc-200 bg-white overflow-x-auto dark:border-zinc-700 dark:bg-zinc-900">
                <div className="min-w-[700px]">
                  {/* Weekday header row */}
                  <div className="grid grid-cols-7 border-b border-zinc-200 dark:border-zinc-700">
                    {WEEKDAY_LABELS.map((label) => (
                      <div
                        key={label}
                        className={`py-2 text-center text-[11px] font-semibold uppercase tracking-wide
                          ${label === "Sat" || label === "Sun"
                            ? "text-zinc-400 dark:text-zinc-500"
                            : "text-zinc-500 dark:text-zinc-400"
                          }`}
                      >
                        {label}
                      </div>
                    ))}
                  </div>

                  {/* Day cells grid */}
                  {cells.length > 0 && currentMonth && (
                    <div
                      className="grid grid-cols-7"
                      style={{
                        gridTemplateRows: `repeat(${Math.ceil(cells.length / 7)}, minmax(100px, auto))`,
                      }}
                    >
                    {cells.map((date) => {
                      const key = toDateKey(date);
                      const isCurrentMonth =
                        date.getMonth() === currentMonth.getMonth() &&
                        date.getFullYear() === currentMonth.getFullYear();
                      const isToday = key === todayKey;
                      const dayTasks = tasksByDate.get(key) ?? [];

                      return (
                        <CalendarCell
                          key={key}
                          dateKey={key}
                          date={date}
                          isCurrentMonth={isCurrentMonth}
                          isToday={isToday}
                          tasks={dayTasks}
                          listMap={listMap}
                          memberMap={memberMap}
                          boardId={selectedBoardId}
                          canEdit={canEdit}
                          canEditDueDate={canEditDueDate}
                          onPreviewTask={openPreview}
                          onShowMore={openOverflow}
                        />
                      );
                    })}
                  </div>
                )}
                </div>
              </div>
              
              {/* Drag overlay for visual feedback */}
              {canEdit && createPortal(
                <DragOverlay dropAnimation={{ duration: 250, easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)" }}>
                  {activeDragTask ? (
                    <div className="w-[180px] shadow-xl rotate-3 opacity-90">
                      <TaskChip
                        task={activeDragTask}
                        list={listMap.get(activeDragTask.list_id)}
                        assignee={activeDragTask.assignee_id ? memberMap.get(activeDragTask.assignee_id) ?? null : null}
                        onPreview={() => {}}
                        fromDate=""
                        canEdit={false}
                        canEditDueDate={canEditDueDate}
                      />
                    </div>
                  ) : null}
                </DragOverlay>,
                document.body
              )}
            </DndContext>
          ) : (
            /* ── Agenda view ─────────────────────────────────────── */
            <div className="flex flex-col gap-8 pb-10">
              {Array.from(tasksByDate.entries())
                .sort((a, b) => a[0].localeCompare(b[0]))
                .map(([dateKey, dayTasks]) => {
                    const date = parseDateKey(dateKey);
                    const isPast = date < localMidnight(new Date());
                    const isToday = dateKey === todayKey;
                    
                    let dateTitle = `${MONTH_NAMES[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
                    if (isToday) {
                      dateTitle = `Today • ${dateTitle}`;
                    }

                    return (
                      <div key={dateKey} className="flex flex-col gap-3 relative">
                        <div className="flex items-center gap-3 pt-1 pb-2">
                          <h3 className={`text-sm font-bold tracking-tight ${isPast && !isToday ? "text-zinc-500 dark:text-zinc-400" : isToday ? "text-blue-600 dark:text-blue-400" : "text-zinc-900 dark:text-zinc-100"}`}>
                            {dateTitle}
                          </h3>
                          <div className="h-px flex-1 bg-zinc-200/60 dark:bg-zinc-800/60" />
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                          {dayTasks.map((task) => (
                            <AgendaTaskRow
                              key={task.id}
                              task={task}
                              list={listMap.get(task.list_id)}
                              assignee={task.assignee_id ? memberMap.get(task.assignee_id) ?? null : null}
                              onPreview={() => openPreview(task)}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
            </div>
          )}
        </>
      )}

      {/* ── Overflow modal — rendered into document.body via portal ── */}
      {mounted && overflowDateKey && (() => {
        const overflowTasks = tasksByDate.get(overflowDateKey) ?? [];
        return (
          <DayTasksModal
            dateKey={overflowDateKey}
            tasks={overflowTasks}
            listMap={listMap}
            memberMap={memberMap}
            canEdit={canEdit}
            canEditDueDate={canEditDueDate}
            onClose={closeOverflow}
            onPreviewTask={openPreview}
          />
        );
      })()}

      {/* ── Task preview modal — rendered into document.body via portal ── */}
      {mounted && previewTask && (() => {
        const previewList = listMap.get(previewTask.list_id);
        const previewAssignee = previewTask.assignee_id ? memberMap.get(previewTask.assignee_id) ?? null : null;
        const previewBoard = boards.find((b) => b.id === selectedBoardId);
        return (
          <TaskPreviewModal
            task={previewTask}
            list={previewList}
            assignee={previewAssignee}
            board={previewBoard}
            canEdit={canEdit}
            canEditDueDate={canEditDueDate}
            onClose={closePreview}
            onOpenInBoard={navigateToTask}
            onUpdateDate={handleReschedule}
          />
        );
      })()}
    </div>
  );
}
