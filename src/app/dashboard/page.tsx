"use client";

import { useState, useCallback } from "react";
import { useBoardData } from "@/hooks/useBoardData";
import type { Task } from "@/types/database";

export default function DashboardPage() {
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
    createWorkspace,
    createBoard,
    createTask,
    updateTask,
    deleteTask,
    clearError,
  } = useBoardData();

  // Task form state
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskListId, setNewTaskListId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState("");

  // Workspace creation
  const [showNewWorkspace, setShowNewWorkspace] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");

  // Board creation
  const [showNewBoard, setShowNewBoard] = useState(false);
  const [newBoardTitle, setNewBoardTitle] = useState("");

  // Auto-select first list for the task form when lists change
  const activeListId = newTaskListId || (lists.length > 0 ? lists[0].id : null);

  const showSuccess = useCallback((msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 3000);
  }, []);

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkspaceName.trim()) return;
    const ws = await createWorkspace(newWorkspaceName.trim());
    setNewWorkspaceName("");
    setShowNewWorkspace(false);
    if (ws) showSuccess("Workspace created");
  };

  const handleCreateBoard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBoardTitle.trim()) return;
    await createBoard(newBoardTitle.trim());
    setNewBoardTitle("");
    setShowNewBoard(false);
    showSuccess("Board created");
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !activeListId) return;
    setAdding(true);
    await createTask(activeListId, newTaskTitle.trim());
    setNewTaskTitle("");
    setAdding(false);
    showSuccess("Task added");
  };

  const handleToggleComplete = async (task: Task) => {
    setUpdatingId(task.id);
    await updateTask(task.id, { is_completed: !task.is_completed } as Partial<Task>);
    setUpdatingId(null);
    showSuccess(task.is_completed ? "Task reopened" : "Task completed");
  };

  const startEdit = (task: Task) => {
    setEditingId(task.id);
    setEditTitle(task.title);
    setEditDescription(task.description ?? "");
    setConfirmDeleteId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle("");
    setEditDescription("");
  };

  const saveEdit = async (id: string) => {
    if (!editTitle.trim()) return;
    setUpdatingId(id);
    await updateTask(id, {
      title: editTitle.trim(),
      description: editDescription.trim(),
    } as Partial<Task>);
    setUpdatingId(null);
    setEditingId(null);
    showSuccess("Task updated");
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    await deleteTask(id);
    setDeletingId(null);
    setConfirmDeleteId(null);
    showSuccess("Task deleted");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-100" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      {/* Feedback messages */}
      {errorMsg && (
        <div className="mb-4 flex items-center justify-between rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
          <span>{errorMsg}</span>
          <button onClick={clearError} className="ml-2 font-bold">&times;</button>
        </div>
      )}
      {successMsg && (
        <div className="mb-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-600 dark:bg-green-950 dark:text-green-400">
          {successMsg}
        </div>
      )}

      {/* Workspace selector */}
      <div className="mb-6 flex items-center gap-3 flex-wrap">
        <label className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Workspace:</label>
        {workspaces.length > 0 ? (
          <select
            value={selectedWorkspaceId ?? ""}
            onChange={(e) => setSelectedWorkspaceId(e.target.value)}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            {workspaces.map((ws) => (
              <option key={ws.id} value={ws.id}>
                {ws.icon} {ws.name}
              </option>
            ))}
          </select>
        ) : null}
        <button
          onClick={() => setShowNewWorkspace(!showNewWorkspace)}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          + Workspace
        </button>
      </div>

      {/* New workspace form */}
      {showNewWorkspace && (
        <form onSubmit={handleCreateWorkspace} className="mb-4 flex gap-2">
          <input
            type="text"
            placeholder="Workspace name"
            value={newWorkspaceName}
            onChange={(e) => setNewWorkspaceName(e.target.value)}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <button
            type="submit"
            disabled={!newWorkspaceName.trim()}
            className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black"
          >
            Create
          </button>
          <button
            type="button"
            onClick={() => setShowNewWorkspace(false)}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
          >
            Cancel
          </button>
        </form>
      )}

      {/* No workspaces at all */}
      {workspaces.length === 0 && !showNewWorkspace && (
        <div className="text-center py-20">
          <p className="text-zinc-400 mb-4">No workspaces yet. Create one to get started.</p>
        </div>
      )}

      {/* Board selector */}
      {selectedWorkspaceId && (
        <div className="mb-6 flex items-center gap-3 flex-wrap">
          <label className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Board:</label>
          {boards.length > 0 ? (
            <select
              value={selectedBoardId ?? ""}
              onChange={(e) => setSelectedBoardId(e.target.value)}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
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
          <button
            onClick={() => setShowNewBoard(!showNewBoard)}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            + Board
          </button>
        </div>
      )}

      {/* New board form */}
      {showNewBoard && (
        <form onSubmit={handleCreateBoard} className="mb-4 flex gap-2">
          <input
            type="text"
            placeholder="Board title"
            value={newBoardTitle}
            onChange={(e) => setNewBoardTitle(e.target.value)}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <button
            type="submit"
            disabled={!newBoardTitle.trim()}
            className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black"
          >
            Create
          </button>
          <button
            type="button"
            onClick={() => setShowNewBoard(false)}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
          >
            Cancel
          </button>
        </form>
      )}

      {/* Board content: lists with tasks */}
      {selectedBoardId && lists.length > 0 && (
        <div className="space-y-6">
          {/* Add task form */}
          <form onSubmit={handleAddTask} className="flex gap-3 flex-wrap">
            <select
              value={activeListId ?? ""}
              onChange={(e) => setNewTaskListId(e.target.value)}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              {lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Add a task..."
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              className="flex-1 min-w-[200px] rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
            <button
              type="submit"
              disabled={adding || !newTaskTitle.trim()}
              className="rounded-lg bg-black px-6 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black"
            >
              {adding ? "Adding..." : "Add"}
            </button>
          </form>

          {/* Lists */}
          {lists.map((list) => {
            const listTasks = tasks.filter((t) => t.list_id === list.id);
            return (
              <div key={list.id} className="rounded-lg border border-zinc-200 dark:border-zinc-800">
                <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
                  <h3 className="text-sm font-semibold">{list.title}</h3>
                  <span className="text-xs text-zinc-400">{listTasks.length} tasks</span>
                </div>
                {listTasks.length === 0 ? (
                  <p className="px-4 py-3 text-xs text-zinc-400">No tasks</p>
                ) : (
                  <ul>
                    {listTasks.map((task) => (
                      <li
                        key={task.id}
                        className="relative border-b border-zinc-100 px-4 py-3 last:border-b-0 dark:border-zinc-800"
                      >
                        {/* Editing mode */}
                        {editingId === task.id ? (
                          <div className="flex flex-col gap-2">
                            <input
                              type="text"
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                            />
                            <textarea
                              value={editDescription}
                              onChange={(e) => setEditDescription(e.target.value)}
                              rows={2}
                              placeholder="Description (optional)"
                              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm resize-none dark:border-zinc-700 dark:bg-zinc-900"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => saveEdit(task.id)}
                                disabled={updatingId === task.id || !editTitle.trim()}
                                className="rounded-lg bg-black px-3 py-1.5 text-sm text-white dark:bg-white dark:text-black"
                              >
                                {updatingId === task.id ? "Saving..." : "Save"}
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={task.is_completed}
                              onChange={() => handleToggleComplete(task)}
                              disabled={updatingId === task.id}
                              className="mt-0.5 h-4 w-4 accent-black dark:accent-white"
                            />
                            <div className="flex-1 min-w-0">
                              <span
                                className={`block text-sm ${
                                  task.is_completed
                                    ? "line-through text-zinc-400"
                                    : "text-zinc-900 dark:text-zinc-100"
                                }`}
                              >
                                {task.title}
                              </span>
                              {task.description && (
                                <p
                                  className={`mt-0.5 text-xs ${
                                    task.is_completed
                                      ? "line-through text-zinc-300"
                                      : "text-zinc-500 dark:text-zinc-400"
                                  }`}
                                >
                                  {task.description}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {task.priority && task.priority !== "none" && (
                                <span className="rounded px-1.5 py-0.5 text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                                  {task.priority}
                                </span>
                              )}
                              <button
                                onClick={() => startEdit(task)}
                                className="rounded px-2 py-1 text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(task.id)}
                                className="rounded px-2 py-1 text-xs text-zinc-400 hover:text-red-500"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Delete confirmation */}
                        {confirmDeleteId === task.id && (
                          <div className="absolute inset-0 flex items-center justify-center gap-2 rounded-lg bg-white/95 dark:bg-zinc-900/95">
                            <span className="text-xs text-zinc-600 dark:text-zinc-300">Delete?</span>
                            <button
                              onClick={() => handleDelete(task.id)}
                              disabled={deletingId === task.id}
                              className="rounded bg-red-600 px-3 py-1.5 text-xs text-white hover:bg-red-700"
                            >
                              {deletingId === task.id ? "..." : "Delete"}
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="rounded border border-zinc-300 px-3 py-1.5 text-xs dark:border-zinc-700"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Board selected but no lists */}
      {selectedBoardId && lists.length === 0 && (
        <p className="text-center text-sm text-zinc-400 py-8">
          Board has no lists. This shouldn&apos;t happen — try creating a new board.
        </p>
      )}
    </div>
  );
}
