"use client";

import type { Task, TaskPriority } from "@/types/database";

export type MoveAction = { label: string; target: string };

export type MenuPosition = { taskId: string; top: number; left: number };

export interface TaskCardProps {
  task: Task;
  isEditing: boolean;
  editTitle: string;
  editDescription: string;
  isUpdating: boolean;
  isDeleting: boolean;
  isConfirmDelete: boolean;
  menuOpen: MenuPosition | null;
  canEditTasks: boolean;
  moveForward: MoveAction | null;
  moveBackward: MoveAction | null;
  onToggleComplete: (task: Task) => void;
  onStartEdit: (task: Task) => void;
  onSaveEdit: (id: string) => void;
  onCancelEdit: () => void;
  onDelete: (id: string) => void;
  onConfirmDelete: (id: string | null) => void;
  onSetMenuOpen: (menu: MenuPosition | null) => void;
  onMoveTask: (taskId: string, target: string) => void;
  onEditTitleChange: (value: string) => void;
  onEditDescriptionChange: (value: string) => void;
  editPriority: TaskPriority;
  editDueDate: string;
  onEditPriorityChange: (value: TaskPriority) => void;
  onEditDueDateChange: (value: string) => void;
}

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case "high": return "#ef4444";
    case "medium": return "#f59e0b";
    case "low": return "#3b82f6";
    default: return "#a1a1aa";
  }
};

const formatDueDate = (dateStr: string) => {
  const date = new Date(dateStr + "T00:00:00");
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays <= 7) return `${diffDays}d`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

export default function TaskCard({
  task,
  isEditing,
  editTitle,
  editDescription,
  isUpdating,
  isDeleting,
  isConfirmDelete,
  menuOpen,
  canEditTasks,
  moveForward,
  moveBackward,
  onToggleComplete,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  onConfirmDelete,
  onSetMenuOpen,
  onMoveTask,
  onEditTitleChange,
  onEditDescriptionChange,
  editPriority,
  editDueDate,
  onEditPriorityChange,
  onEditDueDateChange,
}: TaskCardProps) {
  return (
    <li
      className="group relative rounded-lg border border-zinc-100 bg-white px-3 py-2.5 shadow-sm transition-all duration-150 hover:shadow-md hover:border-zinc-200 hover:bg-zinc-50/50 dark:border-zinc-700/50 dark:bg-zinc-800/80 dark:hover:shadow-lg dark:hover:border-zinc-600/50 dark:hover:bg-zinc-800"
    >
      {/* Editing mode */}
      {isEditing ? (
        <div className="flex flex-col gap-2.5">
          <input
            type="text"
            value={editTitle}
            onChange={(e) => onEditTitleChange(e.target.value)}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200/50 dark:focus:ring-zinc-700/50 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-600"
          />
          <textarea
            value={editDescription}
            onChange={(e) => onEditDescriptionChange(e.target.value)}
            rows={2}
            placeholder="Description (optional)"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm resize-none focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200/50 dark:focus:ring-zinc-700/50 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-600"
          />
          <div className="flex items-center gap-2">
            <select
              value={editPriority}
              onChange={(e) => onEditPriorityChange(e.target.value as TaskPriority)}
              className="rounded-md border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="none">No priority</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
            <input
              type="date"
              value={editDueDate}
              onChange={(e) => onEditDueDateChange(e.target.value)}
              className="flex-1 min-w-0 rounded-md border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onSaveEdit(task.id)}
              disabled={isUpdating || !editTitle.trim()}
              className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 active:bg-zinc-800 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:active:bg-zinc-300 dark:focus:ring-zinc-600"
            >
              {isUpdating ? "Saving..." : "Save"}
            </button>
            <button
              onClick={onCancelEdit}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm transition-colors hover:bg-zinc-100 active:bg-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:border-zinc-700 dark:hover:bg-zinc-800 dark:active:bg-zinc-700 dark:focus:ring-zinc-600"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className={`flex items-start gap-2.5 ${task.is_completed ? "opacity-50" : ""}`}>
          <input
            type="checkbox"
            checked={task.is_completed}
            onChange={() => onToggleComplete(task)}
            disabled={isUpdating || !canEditTasks}
            className="mt-[3px] h-3.5 w-3.5 rounded accent-black dark:accent-white cursor-pointer disabled:cursor-not-allowed shrink-0"
          />
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
            {/* Metadata: priority dot + due date */}
            {(task.priority && task.priority !== "none") || task.due_date ? (
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
                {task.due_date && (
                  <span className={`flex items-center gap-1 text-[11px] font-medium ${
                    new Date(task.due_date + "T23:59:59") < new Date() && !task.is_completed
                      ? "text-red-500 dark:text-red-400"
                      : "text-zinc-400 dark:text-zinc-500"
                  }`}>
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
                    </svg>
                    {formatDueDate(task.due_date)}
                  </span>
                )}
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
                    left: Math.max(8, rect.right - 160),
                  });
                }
              }}
              className="shrink-0 flex items-center justify-center h-6 w-6 rounded-md text-zinc-300 transition-colors hover:bg-zinc-100 hover:text-zinc-600 active:bg-zinc-200 dark:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-300 dark:active:bg-zinc-600"
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
              </svg>
            </button>
          )}
        </div>
      )}

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

      {/* Action menu */}
      {menuOpen?.taskId === task.id && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => onSetMenuOpen(null)} />
          <div
            className="fixed z-50 w-40 rounded-lg bg-white shadow-lg border border-zinc-200 py-1 dark:bg-zinc-800 dark:border-zinc-700"
            style={{ top: menuOpen.top, left: menuOpen.left }}
          >
            <div className="px-3 py-1.5 border-b border-zinc-100 dark:border-zinc-700/50">
              <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300 truncate">{task.title}</p>
            </div>
            {moveForward && (
              <button
                onClick={() => { onSetMenuOpen(null); onMoveTask(task.id, moveForward.target); }}
                disabled={isUpdating}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-emerald-600 hover:bg-emerald-50 disabled:opacity-50 dark:text-emerald-400 dark:hover:bg-emerald-900/30 transition-colors"
              >
                → {moveForward.label}
              </button>
            )}
            {moveBackward && (
              <button
                onClick={() => { onSetMenuOpen(null); onMoveTask(task.id, moveBackward.target); }}
                disabled={isUpdating}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-zinc-700/50 transition-colors"
              >
                ← {moveBackward.label}
              </button>
            )}
            <div className="my-1 border-t border-zinc-100 dark:border-zinc-700/50" />
            <button
              onClick={() => { onSetMenuOpen(null); onStartEdit(task); }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-700/50 transition-colors"
            >
              Edit
            </button>
            <button
              onClick={() => { onSetMenuOpen(null); onConfirmDelete(task.id); }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30 transition-colors"
            >
              Delete
            </button>
          </div>
        </>
      )}
    </li>
  );
}
