"use client";

import { useState, useCallback } from "react";
import { useBoardData } from "@/hooks/useBoardData";
import { useWorkspaceMembers } from "@/hooks/useWorkspaceMembers";
import type { List, Task, WorkspaceRole } from "@/types/database";

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
    setErrorMsg,
  } = useBoardData();

  // Task form state
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [addingToListId, setAddingToListId] = useState<string | null>(null);
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

  // Member management
  const { members, currentRole, invite, remove, updateRole } =
    useWorkspaceMembers(selectedWorkspaceId);
  const [showMembers, setShowMembers] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>("member");
  const [inviting, setInviting] = useState(false);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const canEditTasks =
    !currentRole || ["owner", "admin", "member"].includes(currentRole);
  const isManager =
    currentRole === "owner" || currentRole === "admin";

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

  const handleAddTask = async (e: React.FormEvent, listId: string) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !listId) return;
    setAdding(true);
    await createTask(listId, newTaskTitle.trim());
    setNewTaskTitle("");
    setAddingToListId(null);
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

  const handleMoveTask = async (taskId: string, targetTitle: string) => {
    const targetList =
      lists.find((l) => l.title === targetTitle) ||
      (targetTitle === "Completed" ? lists.find((l) => l.title === "Done") : undefined);
    if (!targetList) return;

    setUpdatingId(taskId);
    await updateTask(taskId, { list_id: targetList.id } as Partial<Task>);
    setUpdatingId(null);
    showSuccess(`Moved to ${targetTitle}`);
  };

  // Member handlers
  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    const result = await invite(inviteEmail.trim(), inviteRole);
    setInviting(false);
    if (result.ok) {
      setInviteEmail("");
      showSuccess("เชิญสมาชิกสำเร็จ");
    } else {
      setErrorMsg(result.error ?? "ไม่สามารถเชิญสมาชิกได้");
    }
  };

  const handleRemoveMember = async (userId: string) => {
    const result = await remove(userId);
    if (result.ok) {
      setConfirmRemoveId(null);
      showSuccess("ลบสมาชิกสำเร็จ");
    } else {
      setErrorMsg(result.error ?? "ไม่สามารถลบสมาชิกได้");
    }
  };

  const handleRoleChange = async (
    userId: string,
    newRole: WorkspaceRole
  ) => {
    const result = await updateRole(userId, newRole);
    if (result.ok) {
      showSuccess("เปลี่ยน role สำเร็จ");
    } else {
      setErrorMsg(result.error ?? "ไม่สามารถเปลี่ยน role ได้");
    }
  };

  // Visual helpers
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-100" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Feedback messages */}
      {errorMsg && (
        <div className="flex items-center justify-between rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
          <span>{errorMsg}</span>
          <button onClick={clearError} className="ml-2 font-bold">&times;</button>
        </div>
      )}
      {successMsg && (
        <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-600 dark:bg-green-950 dark:text-green-400">
          {successMsg}
        </div>
      )}

      {/* Navigation toolbar */}
      <div className="flex items-center justify-between gap-4">
        {/* Left: context selectors */}
        <div className="flex items-center gap-2">
          {workspaces.length > 0 ? (
            <select
              value={selectedWorkspaceId ?? ""}
              onChange={(e) => setSelectedWorkspaceId(e.target.value)}
              className="rounded-lg border border-zinc-200 bg-transparent px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-600 dark:focus:ring-zinc-600"
            >
              {workspaces.map((ws) => (
                <option key={ws.id} value={ws.id}>
                  {ws.icon} {ws.name}
                </option>
              ))}
            </select>
          ) : null}
          {selectedWorkspaceId && (
            <>
              <span className="text-zinc-300 dark:text-zinc-700">/</span>
              {boards.length > 0 ? (
                <select
                  value={selectedBoardId ?? ""}
                  onChange={(e) => setSelectedBoardId(e.target.value)}
                  className="rounded-lg border border-zinc-200 bg-transparent px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-600 dark:focus:ring-zinc-600"
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
        {/* Right: actions */}
        <div className="flex items-center gap-2">
          {selectedWorkspaceId && (
            <button
              onClick={() => {
                const next = !showMembers;
                setShowMembers(next);
                if (next) { setShowNewWorkspace(false); setShowNewBoard(false); }
              }}
              className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 transition-colors hover:border-zinc-300 hover:bg-zinc-50 active:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:bg-zinc-800 dark:active:bg-zinc-700 dark:focus:ring-zinc-600"
            >
              Members
            </button>
          )}
          <button
            onClick={() => {
              const next = !showNewWorkspace;
              setShowNewWorkspace(next);
              if (next) { setShowNewBoard(false); setShowMembers(false); }
            }}
            className="text-sm text-zinc-400 transition-colors hover:text-zinc-600 active:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-300 dark:active:text-zinc-200"
          >
            + Workspace
          </button>
          {selectedWorkspaceId && (
            <button
              onClick={() => {
                const next = !showNewBoard;
                setShowNewBoard(next);
                if (next) { setShowNewWorkspace(false); setShowMembers(false); }
              }}
              className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 active:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:active:bg-zinc-300 dark:focus:ring-zinc-600"
            >
              + Board
            </button>
          )}
        </div>
      </div>

      {/* New workspace form */}
      {showNewWorkspace && (
        <form onSubmit={handleCreateWorkspace} className="flex gap-2 items-center max-w-sm">
          <input
            type="text"
            placeholder="Workspace name"
            autoFocus
            value={newWorkspaceName}
            onChange={(e) => setNewWorkspaceName(e.target.value)}
            className="flex-1 rounded-lg border border-zinc-200 bg-transparent px-3 py-1.5 text-sm focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200/50 dark:focus:ring-zinc-700/50 dark:border-zinc-700 dark:focus:border-zinc-600"
          />
          <button
            type="submit"
            disabled={!newWorkspaceName.trim()}
            className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 active:bg-zinc-800 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:active:bg-zinc-300 dark:focus:ring-zinc-600"
          >
            Create
          </button>
          <button
            type="button"
            onClick={() => setShowNewWorkspace(false)}
            className="text-sm text-zinc-400 transition-colors hover:text-zinc-600 active:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-300 dark:active:text-zinc-200"
          >
            Cancel
          </button>
        </form>
      )}

      {/* Members panel */}
      {showMembers && selectedWorkspaceId && (
        <div className="rounded-xl border border-zinc-200 p-4 shadow-sm dark:border-zinc-800">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">
              Members ({members.length})
            </h3>
            <button
              onClick={() => setShowMembers(false)}
              className="text-lg leading-none text-zinc-400 transition-colors hover:text-zinc-600"
            >
              &times;
            </button>
          </div>

          {/* Member list */}
          <ul className="mb-3 space-y-2">
            {members.map((m) => (
              <li
                key={m.id}
                className="flex items-center gap-3 text-sm"
              >
                <span className="min-w-0 flex-1 truncate">
                  {m.display_name || m.email}
                </span>
                {m.role === "owner" ? (
                  <span className="shrink-0 text-xs font-medium text-amber-600 dark:text-amber-400">
                    owner
                  </span>
                ) : isManager ? (
                  <>
                    <select
                      value={m.role}
                      onChange={(e) =>
                        handleRoleChange(
                          m.user_id,
                          e.target.value as WorkspaceRole
                        )
                      }
                      className="shrink-0 rounded border border-zinc-300 px-1 py-0.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                    >
                      <option value="admin">admin</option>
                      <option value="member">member</option>
                      <option value="viewer">viewer</option>
                    </select>
                    {confirmRemoveId === m.user_id ? (
                      <span className="flex shrink-0 items-center gap-1">
                        <button
                          onClick={() => handleRemoveMember(m.user_id)}
                          className="text-xs font-medium text-red-600 hover:text-red-700"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setConfirmRemoveId(null)}
                          className="text-xs text-zinc-400"
                        >
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <button
                        onClick={() => setConfirmRemoveId(m.user_id)}
                        className="shrink-0 text-xs text-zinc-400 hover:text-red-500"
                      >
                        Remove
                      </button>
                    )}
                  </>
                ) : (
                  <span className="shrink-0 text-xs text-zinc-500">
                    {m.role}
                  </span>
                )}
              </li>
            ))}
            {members.length === 0 && (
              <li className="py-2 text-xs text-zinc-400">No members</li>
            )}
          </ul>

          {/* Invite form — owner/admin only */}
          {isManager && (
            <form
              onSubmit={handleInvite}
              className="flex flex-wrap items-center gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-800"
            >
              <input
                type="email"
                placeholder="Email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
                className="min-w-[150px] flex-1 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
              <select
                value={inviteRole}
                onChange={(e) =>
                  setInviteRole(e.target.value as WorkspaceRole)
                }
                className="rounded-lg border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                <option value="admin">admin</option>
                <option value="member">member</option>
                <option value="viewer">viewer</option>
              </select>
              <button
                type="submit"
                disabled={inviting || !inviteEmail.trim()}
                className="rounded-lg bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black"
              >
                {inviting ? "..." : "Invite"}
              </button>
            </form>
          )}
        </div>
      )}

      {/* No workspaces at all */}
      {workspaces.length === 0 && !showNewWorkspace && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
            <svg className="h-5 w-5 text-zinc-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
            </svg>
          </div>
          <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">No workspaces yet</h3>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-5 max-w-[240px]">Create your first workspace to start organizing tasks with your team.</p>
          <button
            onClick={() => setShowNewWorkspace(true)}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 active:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:active:bg-zinc-300 dark:focus:ring-zinc-600"
          >
            Create workspace
          </button>
        </div>
      )}

      {/* New board form */}
      {showNewBoard && (
        <form onSubmit={handleCreateBoard} className="flex gap-2 items-center max-w-sm">
          <input
            type="text"
            placeholder="Board title"
            autoFocus
            value={newBoardTitle}
            onChange={(e) => setNewBoardTitle(e.target.value)}
            className="flex-1 rounded-lg border border-zinc-200 bg-transparent px-3 py-1.5 text-sm focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200/50 dark:focus:ring-zinc-700/50 dark:border-zinc-700 dark:focus:border-zinc-600"
          />
          <button
            type="submit"
            disabled={!newBoardTitle.trim()}
            className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 active:bg-zinc-800 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:active:bg-zinc-300 dark:focus:ring-zinc-600"
          >
            Create
          </button>
          <button
            type="button"
            onClick={() => setShowNewBoard(false)}
            className="text-sm text-zinc-400 transition-colors hover:text-zinc-600 active:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-300 dark:active:text-zinc-200"
          >
            Cancel
          </button>
        </form>
      )}

      {/* No boards in workspace */}
      {selectedWorkspaceId && boards.length === 0 && !selectedBoardId && !showNewBoard && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
            <svg className="h-5 w-5 text-zinc-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
            </svg>
          </div>
          <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">No boards yet</h3>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-5 max-w-[240px]">Create a board to organize your tasks into lists.</p>
          <button
            onClick={() => setShowNewBoard(true)}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 active:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:active:bg-zinc-300 dark:focus:ring-zinc-600"
          >
            Create board
          </button>
        </div>
      )}

      {/* Board content: lists with tasks */}
      {selectedBoardId && lists.length > 0 && (
        <div className="space-y-5">

          {/* Lists — Kanban columns */}
          <div className="flex gap-5 overflow-x-auto pb-6 items-start -mx-1 px-1">
          {lists.map((list) => {
            const listTasks = tasks.filter((t) => t.list_id === list.id);
            const moveForward =
              list.title === "To Do"
                ? { label: "Start", target: "In Progress" }
                : list.title === "In Progress"
                ? { label: "Complete", target: "Completed" }
                : null;
            const moveBackward =
              list.title === "In Progress"
                ? { label: "Back", target: "To Do" }
                : list.title === "Completed" || list.title === "Done"
                ? { label: "Reopen", target: "In Progress" }
                : null;
            return (
              <div key={list.id} className="w-[300px] flex-shrink-0 rounded-xl bg-zinc-100/50 dark:bg-zinc-800/30 flex flex-col max-h-[calc(100vh-220px)] overflow-hidden">
                <div
                  className="h-1 rounded-t-xl"
                  style={{ backgroundColor: getColumnBarColor(list.title, list.color) }}
                />
                <div className="flex-shrink-0 px-3 pt-3 pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: getColumnBarColor(list.title, list.color) }}
                      />
                      <h3 className="text-[13px] font-semibold tracking-tight text-zinc-700 dark:text-zinc-300">{list.title === "Done" ? "Completed" : list.title}</h3>
                    </div>
                    <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-zinc-200/80 px-1.5 text-[11px] font-semibold text-zinc-500 dark:bg-zinc-700/60 dark:text-zinc-400">
                      {listTasks.length}
                    </span>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto px-2.5 pb-2.5">
                {listTasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-200/60 py-8 px-3 dark:border-zinc-700/40">
                    <svg className="mb-2 h-5 w-5 text-zinc-300 dark:text-zinc-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    <p className="text-xs font-medium text-zinc-400 dark:text-zinc-500 mb-2">No tasks yet</p>
                    {canEditTasks && (
                      <button
                        onClick={() => setAddingToListId(list.id)}
                        className="text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300 transition-colors"
                      >
                        Add your first task
                      </button>
                    )}
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {listTasks.map((task) => (
                      <li
                        key={task.id}
                        className="group relative rounded-lg border border-zinc-100 bg-white px-3 py-2.5 shadow-sm transition-all duration-150 hover:shadow-md hover:border-zinc-200 dark:border-zinc-700/50 dark:bg-zinc-800/80 dark:hover:shadow-lg dark:hover:border-zinc-600/50"
                      >
                        {/* Editing mode */}
                        {editingId === task.id ? (
                          <div className="flex flex-col gap-2.5">
                            <input
                              type="text"
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200/50 dark:focus:ring-zinc-700/50 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-600"
                            />
                            <textarea
                              value={editDescription}
                              onChange={(e) => setEditDescription(e.target.value)}
                              rows={2}
                              placeholder="Description (optional)"
                              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm resize-none focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200/50 dark:focus:ring-zinc-700/50 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-600"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => saveEdit(task.id)}
                                disabled={updatingId === task.id || !editTitle.trim()}
                                className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 active:bg-zinc-800 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:active:bg-zinc-300 dark:focus:ring-zinc-600"
                              >
                                {updatingId === task.id ? "Saving..." : "Save"}
                              </button>
                              <button
                                onClick={cancelEdit}
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
                              onChange={() => handleToggleComplete(task)}
                              disabled={updatingId === task.id || !canEditTasks}
                              className="mt-0.5 h-4 w-4 rounded accent-black dark:accent-white cursor-pointer disabled:cursor-not-allowed"
                            />
                            <div className="flex-1 min-w-0">
                              <span
                                className={`block text-[13px] leading-snug ${
                                  task.is_completed
                                    ? "line-through text-zinc-400 dark:text-zinc-500"
                                    : "font-medium text-zinc-900 dark:text-zinc-100"
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
                            <div className="flex items-center gap-0.5 shrink-0">
                              <span className="flex items-center gap-1 opacity-100 sm:opacity-0 transition-all duration-150 sm:group-hover:opacity-100">
                              {canEditTasks && (
                              <>
                              {moveForward && (
                              <button
                                onClick={() => handleMoveTask(task.id, moveForward.target)}
                                disabled={updatingId === task.id}
                                className="rounded-md px-1.5 py-1 text-xs text-emerald-600 transition-colors hover:bg-emerald-50 hover:text-emerald-700 active:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-300 dark:text-emerald-400 dark:hover:bg-emerald-900/30 dark:hover:text-emerald-300 dark:active:bg-emerald-900/50 dark:focus:ring-emerald-900"
                              >
                                {moveForward.label}
                              </button>
                              )}
                              {moveBackward && (
                              <button
                                onClick={() => handleMoveTask(task.id, moveBackward.target)}
                                disabled={updatingId === task.id}
                                className="rounded-md px-1.5 py-1 text-xs text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 active:bg-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:hover:bg-zinc-700 dark:hover:text-zinc-300 dark:active:bg-zinc-600 dark:focus:ring-zinc-600"
                              >
                                {moveBackward.label}
                              </button>
                              )}
                              <button
                                onClick={() => startEdit(task)}
                                className="rounded-md px-1.5 py-1 text-xs text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 active:bg-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:hover:bg-zinc-700 dark:hover:text-zinc-200 dark:active:bg-zinc-600 dark:focus:ring-zinc-600"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(task.id)}
                                className="rounded-md px-1.5 py-1 text-xs text-zinc-400 transition-colors hover:bg-red-100 hover:text-red-600 active:bg-red-200 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:hover:bg-red-900/30 dark:hover:text-red-400 dark:active:bg-red-900/50 dark:focus:ring-zinc-600"
                              >
                                Delete
                              </button>
                              </>
                              )}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Delete confirmation */}
                        {confirmDeleteId === task.id && (
                          <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 rounded-lg bg-white/90 backdrop-blur-sm dark:bg-zinc-800/90">
                            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">Delete this task?</span>
                            <button
                              onClick={() => handleDelete(task.id)}
                              disabled={deletingId === task.id}
                              className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-700 active:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-300 dark:focus:ring-red-900"
                            >
                              {deletingId === task.id ? "Deleting..." : "Delete"}
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
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
                {/* Per-column add task */}
                {canEditTasks && (
                  addingToListId === list.id ? (
                    <form
                      onSubmit={(e) => handleAddTask(e, list.id)}
                      className="flex-shrink-0 border-t border-zinc-200/60 px-2.5 pt-2.5 pb-2.5 dark:border-zinc-700/40"
                    >
                      <input
                        type="text"
                        placeholder="Task title..."
                        autoFocus
                        value={newTaskTitle}
                        onChange={(e) => setNewTaskTitle(e.target.value)}
                        className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200/50 dark:border-zinc-700 dark:bg-zinc-800/80 dark:placeholder:text-zinc-500 dark:focus:border-zinc-600 dark:focus:ring-zinc-700/50"
                      />
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
                          onClick={() => { setAddingToListId(null); setNewTaskTitle(""); }}
                          className="text-xs text-zinc-400 transition-colors hover:text-zinc-600 active:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-300 dark:active:text-zinc-200"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <button
                      onClick={() => setAddingToListId(list.id)}
                      className="flex-shrink-0 w-full rounded-lg px-3 py-2 text-left text-xs text-zinc-400 transition-colors hover:bg-zinc-200/40 hover:text-zinc-600 dark:text-zinc-500 dark:hover:bg-zinc-700/30 dark:hover:text-zinc-300"
                    >
                      + Add task
                    </button>
                  )
                )}
              </div>
            );
          })}
          </div>
        </div>
      )}

      {/* Board selected but no lists */}
      {selectedBoardId && lists.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
            <svg className="h-5 w-5 text-zinc-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z" />
            </svg>
          </div>
          <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">This board has no lists</h3>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 max-w-[260px]">Something went wrong. Try creating a new board to get started.</p>
        </div>
      )}
    </div>
  );
}
