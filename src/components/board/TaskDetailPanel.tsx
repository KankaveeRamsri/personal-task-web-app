"use client";

import { useEffect, useRef } from "react";
import type { Task, TaskPriority } from "@/types/database";
import type { MemberWithProfile } from "@/hooks/useWorkspaceMembers";

export interface TaskDetailPanelProps {
  open: boolean;
  task: Task | null;
  members: MemberWithProfile[];
  editTitle: string;
  editDescription: string;
  editPriority: TaskPriority;
  editDueDate: string;
  editAssigneeId: string;
  isUpdating: boolean;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onPriorityChange: (value: TaskPriority) => void;
  onDueDateChange: (value: string) => void;
  onAssigneeIdChange: (value: string) => void;
  onSave: () => void;
  onClose: () => void;
}

export default function TaskDetailPanel({
  open,
  task,
  members,
  editTitle,
  editDescription,
  editPriority,
  editDueDate,
  editAssigneeId,
  isUpdating,
  onTitleChange,
  onDescriptionChange,
  onPriorityChange,
  onDueDateChange,
  onAssigneeIdChange,
  onSave,
  onClose,
}: TaskDetailPanelProps) {
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  useEffect(() => {
    if (open) titleRef.current?.focus();
  }, [open]);

  if (!open || !task) return null;

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
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Edit task</h2>
          <button
            onClick={onClose}
            className="flex items-center justify-center h-7 w-7 rounded-md text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          <div>
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">
              Title
            </label>
            <input
              ref={titleRef}
              type="text"
              value={editTitle}
              onChange={(e) => onTitleChange(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 bg-transparent px-3 py-2 text-sm focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200/50 dark:focus:ring-zinc-700/50 dark:border-zinc-700 dark:focus:border-zinc-600"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">
              Description
            </label>
            <textarea
              value={editDescription}
              onChange={(e) => onDescriptionChange(e.target.value)}
              rows={4}
              placeholder="Add a description..."
              className="w-full rounded-lg border border-zinc-200 bg-transparent px-3 py-2 text-sm resize-none focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200/50 dark:focus:ring-zinc-700/50 dark:border-zinc-700 dark:focus:border-zinc-600"
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">
                Priority
              </label>
              <select
                value={editPriority}
                onChange={(e) => onPriorityChange(e.target.value as TaskPriority)}
                className="w-full rounded-lg border border-zinc-200 bg-transparent px-3 py-2 text-sm focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200/50 dark:focus:ring-zinc-700/50 dark:border-zinc-700 dark:focus:border-zinc-600"
              >
                <option value="none">None</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">
                Due date
              </label>
              <input
                type="date"
                value={editDueDate}
                onChange={(e) => onDueDateChange(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 bg-transparent px-3 py-2 text-sm focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200/50 dark:focus:ring-zinc-700/50 dark:border-zinc-700 dark:focus:border-zinc-600"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">
              Assignee
            </label>
            <select
              value={editAssigneeId}
              onChange={(e) => onAssigneeIdChange(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 bg-transparent px-3 py-2 text-sm focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200/50 dark:focus:ring-zinc-700/50 dark:border-zinc-700 dark:focus:border-zinc-600"
            >
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.display_name || m.email}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center gap-2">
          <button
            onClick={onSave}
            disabled={isUpdating || !editTitle.trim()}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 active:bg-zinc-800 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:active:bg-zinc-300 dark:focus:ring-zinc-600"
          >
            {isUpdating ? (
              <span className="flex items-center gap-2">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Saving...
              </span>
            ) : "Save changes"}
          </button>
          <button
            onClick={onClose}
            className="rounded-lg border border-zinc-200 px-4 py-2 text-sm transition-colors hover:bg-zinc-50 active:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:border-zinc-700 dark:hover:bg-zinc-800 dark:active:bg-zinc-700 dark:focus:ring-zinc-600"
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  );
}
