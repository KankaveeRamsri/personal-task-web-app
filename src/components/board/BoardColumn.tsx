"use client";

import { useState, useRef, useEffect } from "react";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { List, Task, TaskPriority } from "@/types/database";
import type { MemberWithProfile } from "@/hooks/useWorkspaceMembers";
import TaskCard from "@/components/board/TaskCard";
import type { MenuPosition, MoveTarget } from "@/components/board/TaskCard";

const COLOR_PRESETS = [
  { name: "Gray", hex: "#a1a1aa" },
  { name: "Blue", hex: "#3b82f6" },
  { name: "Green", hex: "#10b981" },
  { name: "Orange", hex: "#f97316" },
  { name: "Red", hex: "#ef4444" },
  { name: "Purple", hex: "#8b5cf6" },
  { name: "Pink", hex: "#ec4899" },
  { name: "Yellow", hex: "#eab308" },
];

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
  isDefaultList: boolean;
  onRenameList: (listId: string, newTitle: string) => Promise<boolean>;
  onUpdateListColor: (listId: string, color: string) => Promise<boolean>;
  onDeleteList: (listId: string) => Promise<boolean>;
  draggingListId: string | null;
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
  isDefaultList,
  onRenameList,
  onUpdateListColor,
  onDeleteList,
  draggingListId,
}: BoardColumnProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const barColor = getColumnBarColor(list.title, list.color);
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({ id: list.id });
  const showTaskHighlight = isOver && !draggingListId;
  const taskIds = tasks.map((t) => t.id);

  useEffect(() => {
    if (addingToListId === list.id && newTaskTitle === "" && inputRef.current) {
      inputRef.current.focus();
    }
  }, [addingToListId, list.id, newTaskTitle]);

  // List action menu state
  const [listMenuOpen, setListMenuOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [listBusy, setListBusy] = useState(false);
  const listMenuRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!listMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (listMenuRef.current && !listMenuRef.current.contains(e.target as Node)) {
        setListMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [listMenuOpen]);

  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [isRenaming]);

  const handleStartRename = () => {
    setListMenuOpen(false);
    setRenameValue(list.title);
    setIsRenaming(true);
  };

  const handleColorSelect = async (hex: string) => {
    if (listBusy) return;
    setListMenuOpen(false);
    setListBusy(true);
    await onUpdateListColor(list.id, hex);
    setListBusy(false);
  };

  const handleSaveRename = async () => {
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === list.title) {
      setIsRenaming(false);
      return;
    }
    setListBusy(true);
    const ok = await onRenameList(list.id, trimmed);
    setListBusy(false);
    if (ok) setIsRenaming(false);
  };

  const handleConfirmDeleteList = async () => {
    if (totalTaskCount > 0) return;
    setListBusy(true);
    await onDeleteList(list.id);
    setListBusy(false);
  };

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
      style={transform ? { transform: CSS.Transform.toString(transform), transition } : undefined}
      className={`w-[300px] flex-shrink-0 rounded-xl flex flex-col max-h-[calc(100vh-220px)] overflow-hidden transition-all duration-200 relative ${
        showTaskHighlight
          ? "bg-blue-50/50 ring-2 ring-inset ring-blue-200 shadow-sm dark:bg-blue-950/25 dark:ring-blue-800"
          : "bg-zinc-100/50 dark:bg-zinc-800/30"
      }${isDragging ? " opacity-30" : ""}`}
    >
      {/* Color bar */}
      <div
        className="h-1 rounded-t-xl"
        style={{ backgroundColor: barColor }}
      />

      {/* Header */}
      <div className="flex-shrink-0 px-3 pt-3 pb-2">
        <div className="flex items-center justify-between gap-1">
          {isRenaming ? (
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: barColor }}
              />
              <input
                ref={renameInputRef}
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveRename();
                  if (e.key === "Escape") setIsRenaming(false);
                }}
                disabled={listBusy}
                className="flex-1 min-w-0 rounded border border-zinc-300 bg-white px-1.5 py-0.5 text-[13px] font-semibold text-zinc-700 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-200 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:focus:border-zinc-500"
              />
              <button
                onClick={handleSaveRename}
                disabled={listBusy || !renameValue.trim()}
                className="shrink-0 rounded p-0.5 text-zinc-400 hover:text-zinc-700 disabled:opacity-50 dark:hover:text-zinc-200"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              </button>
              <button
                onClick={() => setIsRenaming(false)}
                disabled={listBusy}
                className="shrink-0 rounded p-0.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 min-w-0">
              {canEditTasks && (
                <button
                  ref={setActivatorNodeRef}
                  {...attributes}
                  {...listeners}
                  className="shrink-0 cursor-grab rounded p-0.5 text-zinc-300 hover:text-zinc-500 dark:text-zinc-600 dark:hover:text-zinc-400 active:cursor-grabbing"
                  title="Drag to reorder"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 10 16" fill="currentColor">
                    <circle cx="2.5" cy="2" r="1.2" />
                    <circle cx="7.5" cy="2" r="1.2" />
                    <circle cx="2.5" cy="8" r="1.2" />
                    <circle cx="7.5" cy="8" r="1.2" />
                    <circle cx="2.5" cy="14" r="1.2" />
                    <circle cx="7.5" cy="14" r="1.2" />
                  </svg>
                </button>
              )}
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: barColor }}
              />
              <h3 className="text-[13px] font-semibold tracking-tight text-zinc-700 dark:text-zinc-300 truncate">
                {list.title === "Done" ? "Completed" : list.title}
              </h3>
              {canEditTasks && !isDefaultList && (
                <div className="relative" ref={listMenuRef}>
                  <button
                    onClick={() => setListMenuOpen((v) => !v)}
                    className="shrink-0 rounded p-0.5 text-zinc-400 hover:bg-zinc-200/60 hover:text-zinc-600 dark:hover:bg-zinc-700/60 dark:hover:text-zinc-300"
                  >
                    <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 6a2 2 0 1 1 0-4 2 2 0 0 1 0 4ZM10 12a2 2 0 1 1 0-4 2 2 0 0 1 0 4ZM10 18a2 2 0 1 1 0-4 2 2 0 0 1 0 4Z" />
                    </svg>
                  </button>
                  {listMenuOpen && (
                    <div className="absolute left-0 top-full z-20 mt-1 w-44 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
                      <button
                        onClick={handleStartRename}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-zinc-700 transition-colors hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-700/50"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                        </svg>
                        Rename
                      </button>
                      <div className="border-t border-zinc-100 dark:border-zinc-700/50 my-1" />
                      <div className="px-3 py-1.5">
                        <p className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mb-1.5">Color</p>
                        <div className="flex flex-wrap gap-1.5">
                          {COLOR_PRESETS.map((preset) => (
                            <button
                              key={preset.hex}
                              onClick={() => handleColorSelect(preset.hex)}
                              title={preset.name}
                              disabled={listBusy}
                              className={`h-5 w-5 rounded-full border-2 transition-transform hover:scale-110 disabled:opacity-50 ${
                                list.color === preset.hex
                                  ? "border-zinc-900 dark:border-zinc-100"
                                  : "border-transparent hover:border-zinc-300 dark:hover:border-zinc-600"
                              }`}
                              style={{ backgroundColor: preset.hex }}
                            />
                          ))}
                        </div>
                      </div>
                      <div className="border-t border-zinc-100 dark:border-zinc-700/50 my-1" />
                      <button
                        onClick={() => { setListMenuOpen(false); setShowDeleteDialog(true); }}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                        </svg>
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          {canEditTasks ? (
            <button
              onClick={() => onSelectAllInColumn(list.id)}
              title={allSelected ? "Deselect all" : "Select all"}
              className={`flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold transition-colors ${
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
            <span className="flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold bg-zinc-200/80 text-zinc-500 dark:bg-zinc-700/60 dark:text-zinc-400">
              {countLabel}
            </span>
          )}
        </div>
      </div>

      {/* Delete list dialog */}
      {showDeleteDialog && (
        <div className="absolute inset-0 z-30 flex items-start justify-center pt-12 bg-black/10 rounded-xl">
          <div className="mx-3 w-full max-w-[260px] rounded-xl border border-zinc-200 bg-white p-4 shadow-xl dark:border-zinc-700 dark:bg-zinc-800">
            {totalTaskCount > 0 ? (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-50 dark:bg-amber-950">
                    <svg className="h-4 w-4 text-amber-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                    </svg>
                  </div>
                  <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Cannot delete</h3>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">
                  This list contains {totalTaskCount} task{totalTaskCount > 1 ? "s" : ""}. Move or delete the tasks before deleting this list.
                </p>
                <button
                  onClick={() => setShowDeleteDialog(false)}
                  className="w-full rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  Got it
                </button>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-50 dark:bg-red-950">
                    <svg className="h-4 w-4 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                    </svg>
                  </div>
                  <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Delete list?</h3>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">
                  Delete &ldquo;{list.title}&rdquo;? This cannot be undone.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowDeleteDialog(false)}
                    disabled={listBusy}
                    className="flex-1 rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmDeleteList}
                    disabled={listBusy}
                    className="flex-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                  >
                    {listBusy ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

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
                  isListDone={list.is_done}
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
