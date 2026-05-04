"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Task } from "@/types/database";
import type { MemberWithProfile } from "@/hooks/useWorkspaceMembers";

export type MoveTarget = { title: string; current: boolean };

export type MenuPosition = { taskId: string; top: number; left: number };

export interface TaskCardProps {
  task: Task;
  members: MemberWithProfile[];
  listTitle: string;
  isListDone?: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
  isConfirmDelete: boolean;
  menuOpen: MenuPosition | null;
  canEditTasks: boolean;
  moveTargets: MoveTarget[];
  isSelected: boolean;
  onToggleSelect: (taskId: string) => void;
  onStartEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onConfirmDelete: (id: string | null) => void;
  onSetMenuOpen: (menu: MenuPosition | null) => void;
  onMoveTask: (taskId: string, target: string) => void;
}

function getInitials(email: string, displayName: string): string {
  if (displayName && displayName.trim()) {
    const parts = displayName.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case "high": return "#ef4444";
    case "medium": return "#f59e0b";
    case "low": return "#3b82f6";
    default: return "#a1a1aa";
  }
};

function getLocalDate(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function getDueDateInfo(dateStr: string): { label: string; diffDays: number } {
  const target = getLocalDate(new Date(dateStr + "T00:00:00"));
  const today = getLocalDate(new Date());
  const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { label: `${Math.abs(diffDays)}d overdue`, diffDays };
  if (diffDays === 0) return { label: "Today", diffDays };
  if (diffDays === 1) return { label: "Tomorrow", diffDays };
  if (diffDays <= 7) return { label: `${diffDays}d`, diffDays };
  return {
    label: target.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    diffDays,
  };
}

// ---------------------------------------------------------------------------
// Portal dropdown — escapes parent overflow / CSS-transform stacking contexts
// ---------------------------------------------------------------------------
interface TaskActionMenuPortalProps {
  menuOpen: MenuPosition;
  task: Task;
  moveTargets: MoveTarget[];
  isUpdating: boolean;
  onSetMenuOpen: (menu: MenuPosition | null) => void;
  onStartEdit: (task: Task) => void;
  onConfirmDelete: (id: string | null) => void;
  onMoveTask: (taskId: string, target: string) => void;
}

function TaskActionMenuPortal({
  menuOpen,
  task,
  moveTargets,
  isUpdating,
  onSetMenuOpen,
  onStartEdit,
  onConfirmDelete,
  onMoveTask,
}: TaskActionMenuPortalProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onSetMenuOpen(null);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onSetMenuOpen]);

  // Close on any scroll (page or column)
  useEffect(() => {
    const handleScroll = () => onSetMenuOpen(null);
    window.addEventListener("scroll", handleScroll, { capture: true, passive: true });
    return () => window.removeEventListener("scroll", handleScroll, { capture: true });
  }, [onSetMenuOpen]);

  // Smart flip: if not enough room below, show above the trigger button
  const MENU_HEIGHT_ESTIMATE = 240; // px — generous estimate
  const MENU_WIDTH = 192; // w-48 = 12rem = 192px
  const viewportH = typeof window !== "undefined" ? window.innerHeight : 800;
  const viewportW = typeof window !== "undefined" ? window.innerWidth : 1200;

  const spaceBelow = viewportH - menuOpen.top;
  const showAbove = spaceBelow < MENU_HEIGHT_ESTIMATE && menuOpen.top > MENU_HEIGHT_ESTIMATE;

  // top position: below trigger (default) or above trigger
  // menuOpen.top is rect.bottom + 4 (set in the trigger onClick)
  // For above: we need to subtract the menu height from the trigger's top
  // We stored rect.bottom in menuOpen.top, so rect.top ≈ menuOpen.top - triggerHeight
  // Use a fixed 28px trigger height estimate (h-6 button + 4px gap)
  const TRIGGER_OFFSET = 28 + 4; // button height + gap
  const top = showAbove
    ? menuOpen.top - TRIGGER_OFFSET - MENU_HEIGHT_ESTIMATE
    : menuOpen.top;

  // Clamp left so the menu never overflows the right edge
  const left = Math.min(menuOpen.left, viewportW - MENU_WIDTH - 8);

  return createPortal(
    <>
      {/* Invisible full-screen backdrop — click outside closes */}
      <div
        className="fixed inset-0 z-[9998]"
        onClick={() => onSetMenuOpen(null)}
      />
      {/* Dropdown */}
      <div
        ref={menuRef}
        className="fixed z-[9999] w-48 rounded-lg bg-white shadow-lg border border-zinc-200 py-1 dark:bg-zinc-800 dark:border-zinc-700"
        style={{ top, left }}
      >
        <div className="px-3 py-1.5 border-b border-zinc-100 dark:border-zinc-700/50">
          <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300 truncate">{task.title}</p>
        </div>

        {/* Move to section */}
        <div className="py-1">
          <p className="px-3 py-1 text-[11px] font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Move to</p>
          {moveTargets.map((target) => {
            const displayTitle = target.title === "Done" ? "Completed" : target.title;
            return (
              <button
                key={target.title}
                onClick={() => {
                  if (!target.current && !isUpdating) {
                    onSetMenuOpen(null);
                    onMoveTask(task.id, target.title);
                  }
                }}
                disabled={target.current || isUpdating}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-xs transition-colors ${
                  target.current
                    ? "text-zinc-400 dark:text-zinc-500"
                    : "text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-700/50"
                }`}
              >
                {target.current ? (
                  <svg className="h-3 w-3 shrink-0" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z" />
                  </svg>
                ) : (
                  <span className="w-3 shrink-0" />
                )}
                {displayTitle}
              </button>
            );
          })}
        </div>

        <div className="border-t border-zinc-100 dark:border-zinc-700/50" />
        <button
          onClick={() => { onSetMenuOpen(null); onStartEdit(task); }}
          className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-700/50 transition-colors"
        >
          Edit
        </button>
        <div className="border-t border-zinc-100 dark:border-zinc-700/50" />
        <button
          onClick={() => { onSetMenuOpen(null); onConfirmDelete(task.id); }}
          className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors"
        >
          Delete
        </button>
      </div>
    </>,
    document.body
  );
}

export default function TaskCard({
  task,
  members,
  listTitle,
  isListDone = false,
  isUpdating,
  isDeleting,
  isConfirmDelete,
  menuOpen,
  canEditTasks,
  moveTargets,
  isSelected,
  onToggleSelect,
  onStartEdit,
  onDelete,
  onConfirmDelete,
  onSetMenuOpen,
  onMoveTask,
}: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, data: { task } });

  const dragStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    touchAction: "none",
  };

  return (
    <li
      ref={setNodeRef}
      style={dragStyle}
      data-task-id={task.id}
      {...attributes}
      {...listeners}
      className={`group relative rounded-lg border px-3 py-2.5 transition-all duration-200 select-none ${
        isDragging
          ? "opacity-50 scale-[0.98] shadow-2xl ring-2 ring-zinc-200 border-zinc-200 bg-white dark:ring-zinc-700 dark:border-zinc-600 dark:bg-zinc-800 z-50"
          : isSelected
            ? "cursor-grab shadow-sm ring-2 ring-blue-400/50 border-blue-200 bg-blue-50/40 hover:shadow-md dark:ring-blue-500/40 dark:border-blue-800/50 dark:bg-blue-950/30"
            : "cursor-grab shadow-sm border-zinc-100 bg-white hover:shadow-md hover:border-zinc-200 hover:bg-zinc-50/50 dark:border-zinc-700/50 dark:bg-zinc-800/80 dark:hover:shadow-lg dark:hover:border-zinc-600/50 dark:hover:bg-zinc-800"
      }`}
    >
      <div className={`flex items-start gap-2.5 ${task.is_completed ? "opacity-50" : ""}`}>
        {canEditTasks && (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelect(task.id)}
            onPointerDown={(e) => e.stopPropagation()}
            className="mt-[3px] h-3.5 w-3.5 rounded accent-blue-500 dark:accent-blue-400 cursor-pointer shrink-0 touch-manipulation"
          />
        )}
        <div className="flex-1 min-w-0">
          <span
            className={`block text-[13px] leading-snug font-medium ${
              task.is_completed
                ? "line-through text-zinc-400 dark:text-zinc-500"
                : "text-zinc-900 dark:text-zinc-100"
            }`}
          >
            {task.title}
          </span>
          {task.description && (
            <p
              className={`mt-1 text-xs leading-relaxed line-clamp-2 ${
                task.is_completed
                  ? "line-through text-zinc-300 dark:text-zinc-600"
                  : "text-zinc-500 dark:text-zinc-400"
              }`}
            >
              {task.description}
            </p>
          )}
          {/* Metadata: priority dot + due date + assignee */}
          {(task.priority && task.priority !== "none") || task.due_date || task.assignee_id ? (
            <div className="mt-1.5 flex items-center gap-2 flex-wrap">
              {task.priority && task.priority !== "none" && (
                <span className="flex items-center gap-1">
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: getPriorityColor(task.priority) }}
                  />
                  <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 capitalize">{task.priority}</span>
                </span>
              )}
              {task.due_date && (() => {
                const { diffDays } = getDueDateInfo(task.due_date);
                const isOverdue = diffDays < 0;
                const isToday = diffDays === 0;
                const isCompletedColumn = isListDone;
                const muted = task.is_completed || isCompletedColumn;

                let chipClass: string;
                let displayLabel: string;
                if (muted) {
                  chipClass = "bg-zinc-100 text-zinc-400 dark:bg-zinc-700/50 dark:text-zinc-500";
                  const date = new Date(task.due_date + "T00:00:00");
                  displayLabel = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                } else if (isOverdue) {
                  chipClass = "bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400";
                  displayLabel = `${Math.abs(diffDays)}d overdue`;
                } else if (isToday) {
                  chipClass = "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400";
                  displayLabel = "Today";
                } else {
                  chipClass = "bg-zinc-100 text-zinc-500 dark:bg-zinc-700/50 dark:text-zinc-400";
                  if (diffDays === 1) displayLabel = "Tomorrow";
                  else if (diffDays <= 7) displayLabel = `${diffDays}d`;
                  else {
                    const date = new Date(task.due_date + "T00:00:00");
                    displayLabel = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                  }
                }

                return (
                  <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium ${chipClass}`}>
                    <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
                    </svg>
                    {displayLabel}
                  </span>
                );
              })()}
              {task.assignee_id && (() => {
                const assignee = members.find((m) => m.user_id === task.assignee_id);
                if (!assignee) return null;
                const initials = getInitials(assignee.email, assignee.display_name);
                return (
                  <span className="flex items-center gap-1 text-[11px] font-medium text-zinc-500 dark:text-zinc-400" title={assignee.email}>
                    <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-zinc-200 text-[8px] font-semibold text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                      {initials}
                    </span>
                  </span>
                );
              })()}
            </div>
          ) : null}
        </div>
        {canEditTasks && (
          <button
            onClick={(e) => {
              if (menuOpen?.taskId === task.id) {
                onSetMenuOpen(null);
              } else {
                const rect = e.currentTarget.getBoundingClientRect();
                onSetMenuOpen({
                  taskId: task.id,
                  top: rect.bottom + 4,
                  left: Math.max(8, rect.right - 192),
                });
              }
            }}
            className="shrink-0 flex items-center justify-center h-6 w-6 rounded-md text-zinc-300 transition-colors hover:bg-zinc-100 hover:text-zinc-600 active:bg-zinc-200 cursor-pointer dark:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-300 dark:active:bg-zinc-600"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
            </svg>
          </button>
        )}
      </div>

      {/* Delete confirmation */}
      {isConfirmDelete && (
        <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 rounded-lg bg-white/90 backdrop-blur-sm dark:bg-zinc-800/90">
          <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">Delete this task?</span>
          <button
            onClick={() => onDelete(task.id)}
            disabled={isDeleting}
            className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-700 active:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-300 dark:focus:ring-red-900"
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </button>
          <button
            onClick={() => onConfirmDelete(null)}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Action menu — rendered via Portal to escape parent overflow/transform stacking context */}
      {menuOpen?.taskId === task.id && (
        <TaskActionMenuPortal
          menuOpen={menuOpen}
          task={task}
          moveTargets={moveTargets}
          isUpdating={isUpdating}
          onSetMenuOpen={onSetMenuOpen}
          onStartEdit={onStartEdit}
          onConfirmDelete={onConfirmDelete}
          onMoveTask={onMoveTask}
        />
      )}
    </li>
  );
}
