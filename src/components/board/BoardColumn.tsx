"use client";

import { useRef, useEffect } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { List, Task, TaskPriority } from "@/types/database";
import type { MemberWithProfile } from "@/hooks/useWorkspaceMembers";
import TaskCard from "@/components/board/TaskCard";
import type { MenuPosition, MoveTarget } from "@/components/board/TaskCard";

const getColumnBarColor = (title: string, color: string) => {
  if (color) return color;
  const defaults: Record<string, string> = {
    "To Do": "#a1a1aa",
    "In Progress": "#3b82f6",
    "Completed": "#10b981",
    "Done": "#10b981",
  };
  return defaults[title] ?? "#a1a1aa";
};

export interface BoardColumnProps {
  list: List;
  tasks: Task[];
  totalTaskCount: number;
  members: MemberWithProfile[];
  canEditTasks: boolean;
  addingToListId: string | null;
  newTaskTitle: string;
  adding: boolean;
  updatingId: string | null;
  deletingId: string | null;
  confirmDeleteId: string | null;
  menuOpen: MenuPosition | null;
  selectedTaskIds: Set<string>;
  onToggleSelect: (taskId: string) => void;
  onSelectAllInColumn: (listId: string) => void;
  onAddTask: (e: React.FormEvent, listId: string) => void;
  onStartEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onConfirmDelete: (id: string | null) => void;
  onSetMenuOpen: (menu: MenuPosition | null) => void;
  onMoveTask: (taskId: string, target: string) => void;
  onSetAddingToListId: (id: string | null) => void;
  onSetNewTaskTitle: (value: string) => void;
  newTaskDescription: string;
  onNewTaskDescriptionChange: (value: string) => void;
  newTaskPriority: TaskPriority;
  newTaskDueDate: string;
  newTaskAssigneeId: string;
  onNewTaskPriorityChange: (value: TaskPriority) => void;
  onNewTaskDueDateChange: (value: string) => void;
  onNewTaskAssigneeIdChange: (value: string) => void;
  allListTitles: string[];
}

export default function BoardColumn({
  list,
  tasks,
  totalTaskCount,
  members,
  canEditTasks,
  addingToListId,
  newTaskTitle,
  adding,
  updatingId,
  deletingId,
  confirmDeleteId,
  menuOpen,
  selectedTaskIds,
  onToggleSelect,
  onSelectAllInColumn,
  onAddTask,
  onStartEdit,
  onDelete,
  onConfirmDelete,
  onSetMenuOpen,
  onMoveTask,
  onSetAddingToListId,
  onSetNewTaskTitle,
  newTaskDescription,
  onNewTaskDescriptionChange,
  newTaskPriority,
  newTaskDueDate,
  newTaskAssigneeId,
  onNewTaskPriorityChange,
  onNewTaskDueDateChange,
  onNewTaskAssigneeIdChange,
  allListTitles,
}: BoardColumnProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const barColor = getColumnBarColor(list.title, list.color);
  const { setNodeRef, isOver } = useDroppable({ id: list.id });
  const taskIds = tasks.map((t) => t.id);

  useEffect(() => {
    if (addingToListId === list.id && newTaskTitle === "" && inputRef.current) {
      inputRef.current.focus();
    }
  }, [addingToListId, list.id, newTaskTitle]);

  const moveTargets: MoveTarget[] = allListTitles.map((title) => ({
    title,
    current: title === list.title,
  }));

  const selectedInColumn = tasks.filter((t) => selectedTaskIds.has(t.id)).length;
  const allSelected = tasks.length > 0 && selectedInColumn === tasks.length;
  const someSelected = selectedInColumn > 0 && !allSelected;
  const isFiltered = tasks.length !== totalTaskCount;
  const countLabel = isFiltered ? `${tasks.length}/${totalTaskCount}` : `${tasks.length}`;

  return (
    <div
      ref={setNodeRef}
      className={`w-[300px] flex-shrink-0 rounded-xl flex flex-col max-h-[calc(100vh-220px)] overflow-hidden transition-all duration-200 ${
        isOver
          ? "bg-blue-50/50 ring-2 ring-inset ring-blue-200 shadow-sm dark:bg-blue-950/25 dark:ring-blue-800"
          : "bg-zinc-100/50 dark:bg-zinc-800/30"
      }`}
    >
      {/* Color bar */}
      <div
        className="h-1 rounded-t-xl"
        style={{ backgroundColor: barColor }}
      />

      {/* Header */}
      <div className="flex-shrink-0 px-3 pt-3 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className="h-2 w-2 rounded-full shrink-0"
              style={{ backgroundColor: barColor }}
            />
            <h3 className="text-[13px] font-semibold tracking-tight text-zinc-700 dark:text-zinc-300">
              {list.title === "Done" ? "Completed" : list.title}
            </h3>
          </div>
          {canEditTasks ? (
            <button
              onClick={() => onSelectAllInColumn(list.id)}
              title={allSelected ? "Deselect all" : "Select all"}
              className={`flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-semibold transition-colors ${
                allSelected
                  ? "bg-blue-500 text-white"
                  : someSelected
                    ? "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400"
                    : "bg-zinc-200/80 text-zinc-500 cursor-pointer hover:bg-zinc-300/80 dark:bg-zinc-700/60 dark:text-zinc-400 dark:hover:bg-zinc-600/60"
              }`}
            >
              {countLabel}
            </button>
          ) : (
            <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-semibold bg-zinc-200/80 text-zinc-500 dark:bg-zinc-700/60 dark:text-zinc-400">
              {countLabel}
            </span>
          )}
        </div>
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto px-2.5 pb-2.5">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-200/60 py-8 px-3 dark:border-zinc-700/40">
            {isFiltered ? (
              <>
                <svg className="mb-2 h-5 w-5 text-zinc-300 dark:text-zinc-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                </svg>
                <p className="text-xs font-medium text-zinc-400 dark:text-zinc-500">No matching tasks</p>
              </>
            ) : (
              <>
                <svg className="mb-2 h-5 w-5 text-zinc-300 dark:text-zinc-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                <p className="text-xs font-medium text-zinc-400 dark:text-zinc-500 mb-2">No tasks yet</p>
                {canEditTasks && (
                  <button
                    onClick={() => onSetAddingToListId(list.id)}
                    className="text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300 transition-colors"
                  >
                    Add your first task
                  </button>
                )}
              </>
            )}
          </div>
        ) : (
          <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
            <ul className="space-y-2">
              {tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  members={members}
                  listTitle={list.title}
                  isUpdating={updatingId === task.id}
                  isDeleting={deletingId === task.id}
                  isConfirmDelete={confirmDeleteId === task.id}
                  menuOpen={menuOpen?.taskId === task.id ? menuOpen : null}
                  canEditTasks={canEditTasks}
                  moveTargets={moveTargets}
                  isSelected={selectedTaskIds.has(task.id)}
                  onToggleSelect={onToggleSelect}
                  onStartEdit={onStartEdit}
                  onDelete={onDelete}
                  onConfirmDelete={onConfirmDelete}
                  onSetMenuOpen={onSetMenuOpen}
                  onMoveTask={onMoveTask}
                />
              ))}
            </ul>
          </SortableContext>
        )}
      </div>

      {/* Add task area */}
      {canEditTasks && (
        addingToListId === list.id ? (
          <form
            onSubmit={(e) => onAddTask(e, list.id)}
            className="flex-shrink-0 border-t border-zinc-200/60 px-2.5 pt-2.5 pb-2.5 dark:border-zinc-700/40"
          >
            <input
              ref={inputRef}
              type="text"
              placeholder="Task title..."
              autoFocus
              value={newTaskTitle}
              onChange={(e) => onSetNewTaskTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  onSetAddingToListId(null);
                  onSetNewTaskTitle("");
                  onNewTaskDescriptionChange("");
                  onNewTaskPriorityChange("none");
                  onNewTaskDueDateChange("");
                  onNewTaskAssigneeIdChange("");
                }
              }}
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200/50 dark:border-zinc-700 dark:bg-zinc-800/80 dark:placeholder:text-zinc-500 dark:focus:border-zinc-600 dark:focus:ring-zinc-700/50"
            />
            <textarea
              placeholder="Description (optional)"
              rows={2}
              value={newTaskDescription}
              onChange={(e) => onNewTaskDescriptionChange(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200/50 resize-none dark:border-zinc-700 dark:bg-zinc-800/80 dark:placeholder:text-zinc-500 dark:focus:border-zinc-600 dark:focus:ring-zinc-700/50"
            />
            <div className="mt-1.5 flex items-center gap-2">
              <select
                value={newTaskPriority}
                onChange={(e) => onNewTaskPriorityChange(e.target.value as TaskPriority)}
                className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-600 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-400 dark:focus:border-zinc-600"
              >
                <option value="none">Priority</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
              <input
                type="date"
                value={newTaskDueDate}
                onChange={(e) => onNewTaskDueDateChange(e.target.value)}
                className="flex-1 min-w-0 rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-600 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-400 dark:focus:border-zinc-600"
              />
            </div>
            {members.length > 0 && (
              <div className="mt-1.5">
                <select
                  value={newTaskAssigneeId}
                  onChange={(e) => onNewTaskAssigneeIdChange(e.target.value)}
                  className="w-full rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-600 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-400 dark:focus:border-zinc-600"
                >
                  <option value="">Unassigned</option>
                  {members.map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.display_name || m.email}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="mt-2 flex items-center gap-2">
              <button
                type="submit"
                disabled={adding || !newTaskTitle.trim()}
                className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-700 active:bg-zinc-800 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:active:bg-zinc-300 dark:focus:ring-zinc-600"
              >
                {adding ? "Adding..." : "Add"}
              </button>
              <button
                type="button"
                onClick={() => {
                  onSetAddingToListId(null);
                  onSetNewTaskTitle("");
                  onNewTaskDescriptionChange("");
                  onNewTaskPriorityChange("none");
                  onNewTaskDueDateChange("");
                  onNewTaskAssigneeIdChange("");
                }}
                className="text-xs text-zinc-400 transition-colors hover:text-zinc-600 active:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-300 dark:active:text-zinc-200"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => onSetAddingToListId(list.id)}
            className="flex-shrink-0 w-full rounded-lg px-3 py-2 text-left text-xs text-zinc-400 transition-colors hover:bg-zinc-200/40 hover:text-zinc-600 dark:text-zinc-500 dark:hover:bg-zinc-700/30 dark:hover:text-zinc-300"
          >
            + Add task
          </button>
        )
      )}
    </div>
  );
}
