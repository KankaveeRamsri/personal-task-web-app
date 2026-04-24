"use client";

import { useState, useCallback } from "react";
import { useBoardData } from "@/hooks/useBoardData";
import { useWorkspaceMembers } from "@/hooks/useWorkspaceMembers";
import type { List, Task, WorkspaceRole, TaskPriority } from "@/types/database";
import type { MenuPosition } from "@/components/board/TaskCard";
import BoardColumn from "@/components/board/BoardColumn";
import BoardToolbar from "@/components/board/BoardToolbar";

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
  const [menuOpen, setMenuOpen] = useState<MenuPosition | null>(null);
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>("none");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");
  const [editPriority, setEditPriority] = useState<TaskPriority>("none");
  const [editDueDate, setEditDueDate] = useState("");

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

  // Toolbar toggle handlers
  const toggleNewWorkspace = () => {
    const next = !showNewWorkspace;
    setShowNewWorkspace(next);
    if (next) { setShowNewBoard(false); setShowMembers(false); }
  };

  const toggleNewBoard = () => {
    const next = !showNewBoard;
    setShowNewBoard(next);
    if (next) { setShowNewWorkspace(false); setShowMembers(false); }
  };

  const toggleMembers = () => {
    const next = !showMembers;
    setShowMembers(next);
    if (next) { setShowNewWorkspace(false); setShowNewBoard(false); }
  };

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
    await createTask(listId, newTaskTitle.trim(), {
      priority: newTaskPriority,
      due_date: newTaskDueDate || null,
    });
    setNewTaskTitle("");
    setNewTaskPriority("none");
    setNewTaskDueDate("");
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
    setEditPriority(task.priority ?? "none");
    setEditDueDate(task.due_date ?? "");
    setConfirmDeleteId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle("");
    setEditDescription("");
    setEditPriority("none");
    setEditDueDate("");
  };

  const saveEdit = async (id: string) => {
    if (!editTitle.trim()) return;
    setUpdatingId(id);
    await updateTask(id, {
      title: editTitle.trim(),
      description: editDescription.trim(),
      priority: editPriority,
      due_date: editDueDate || null,
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

      <BoardToolbar
        workspaces={workspaces}
        selectedWorkspaceId={selectedWorkspaceId}
        boards={boards}
        selectedBoardId={selectedBoardId}
        members={members}
        isManager={isManager}
        showNewWorkspace={showNewWorkspace}
        showNewBoard={showNewBoard}
        showMembers={showMembers}
        newWorkspaceName={newWorkspaceName}
        newBoardTitle={newBoardTitle}
        inviteEmail={inviteEmail}
        inviteRole={inviteRole}
        inviting={inviting}
        confirmRemoveId={confirmRemoveId}
        onWorkspaceChange={setSelectedWorkspaceId}
        onBoardChange={setSelectedBoardId}
        onToggleNewWorkspace={toggleNewWorkspace}
        onToggleNewBoard={toggleNewBoard}
        onToggleMembers={toggleMembers}
        onCloseMembers={() => setShowMembers(false)}
        onNewWorkspaceNameChange={setNewWorkspaceName}
        onNewBoardTitleChange={setNewBoardTitle}
        onInviteEmailChange={setInviteEmail}
        onInviteRoleChange={setInviteRole}
        onCreateWorkspace={handleCreateWorkspace}
        onCreateBoard={handleCreateBoard}
        onInvite={handleInvite}
        onCancelNewWorkspace={() => setShowNewWorkspace(false)}
        onCancelNewBoard={() => setShowNewBoard(false)}
        onRemoveMember={handleRemoveMember}
        onRoleChange={handleRoleChange}
        onSetConfirmRemoveId={setConfirmRemoveId}
      />

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
          {lists.map((list) => (
            <BoardColumn
              key={list.id}
              list={list}
              tasks={tasks.filter((t) => t.list_id === list.id)}
              canEditTasks={canEditTasks}
              addingToListId={addingToListId}
              newTaskTitle={newTaskTitle}
              adding={adding}
              editingId={editingId}
              editTitle={editTitle}
              editDescription={editDescription}
              updatingId={updatingId}
              deletingId={deletingId}
              confirmDeleteId={confirmDeleteId}
              menuOpen={menuOpen}
              onAddTask={handleAddTask}
              onToggleComplete={handleToggleComplete}
              onStartEdit={startEdit}
              onSaveEdit={saveEdit}
              onCancelEdit={cancelEdit}
              onDelete={handleDelete}
              onConfirmDelete={setConfirmDeleteId}
              onSetMenuOpen={setMenuOpen}
              onMoveTask={handleMoveTask}
              onEditTitleChange={setEditTitle}
              onEditDescriptionChange={setEditDescription}
              onSetAddingToListId={setAddingToListId}
              onSetNewTaskTitle={setNewTaskTitle}
              newTaskPriority={newTaskPriority}
              newTaskDueDate={newTaskDueDate}
              editPriority={editPriority}
              editDueDate={editDueDate}
              onNewTaskPriorityChange={setNewTaskPriority}
              onNewTaskDueDateChange={setNewTaskDueDate}
              onEditPriorityChange={setEditPriority}
              onEditDueDateChange={setEditDueDate}
            />
          ))}
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
