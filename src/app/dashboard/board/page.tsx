"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { useBoardData } from "@/hooks/useBoardData";
import { useWorkspaceMembers } from "@/hooks/useWorkspaceMembers";
import type { List, Task, WorkspaceRole, TaskPriority } from "@/types/database";
import type { MenuPosition } from "@/components/board/TaskCard";
import BoardColumn from "@/components/board/BoardColumn";
import BoardToolbar from "@/components/board/BoardToolbar";
import TaskDetailPanel from "@/components/board/TaskDetailPanel";
import BulkActionToolbar from "@/components/board/BulkActionToolbar";
import BoardFilterBar from "@/components/board/BoardFilterBar";
import { logActivity } from "@/lib/activity-log";
import { createClient } from "@/lib/supabase";

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
    moveTask,
    reorderTasks,
    deleteBoard,
    deleteWorkspace,
    clearError,
    setErrorMsg,
  } = useBoardData();

  // Selection state (bulk actions foundation)
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());

  const handleToggleSelect = useCallback((taskId: string) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedTaskIds(new Set());
  }, []);

  const handleSelectAllInColumn = useCallback((listId: string) => {
    setSelectedTaskIds((prev) => {
      const columnIds = tasks.filter((t) => t.list_id === listId).map((t) => t.id);
      if (columnIds.length === 0) return prev;
      const allSelected = columnIds.every((id) => prev.has(id));
      const next = new Set(prev);
      if (allSelected) {
        columnIds.forEach((id) => next.delete(id));
      } else {
        columnIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }, [tasks]);

  // Esc key clears selection
  useEffect(() => {
    if (selectedTaskIds.size === 0) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") clearSelection();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selectedTaskIds.size, clearSelection]);

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
  const [newTaskAssigneeId, setNewTaskAssigneeId] = useState("");
  const [editPriority, setEditPriority] = useState<TaskPriority>("none");
  const [editDueDate, setEditDueDate] = useState("");
  const [editAssigneeId, setEditAssigneeId] = useState("");

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterAssigneeId, setFilterAssigneeId] = useState("all");
  const [filterDueDate, setFilterDueDate] = useState("all");

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
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data: { user } }) => {
        if (user) setCurrentUserId(user.id);
      });
  }, []);

  // Esc closes members drawer
  useEffect(() => {
    if (!showMembers) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowMembers(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [showMembers]);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>("member");
  const [inviting, setInviting] = useState(false);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const canEditTasks =
    !currentRole || ["owner", "admin", "member"].includes(currentRole);
  const isManager =
    currentRole === "owner" || currentRole === "admin";

  // Delete board
  const [confirmDeleteBoard, setConfirmDeleteBoard] = useState(false);
  const [deletingBoard, setDeletingBoard] = useState(false);

  // Delete workspace
  const [confirmDeleteWorkspace, setConfirmDeleteWorkspace] = useState(false);
  const [deletingWorkspace, setDeletingWorkspace] = useState(false);
  const [deleteWorkspaceConfirmName, setDeleteWorkspaceConfirmName] = useState("");

  const isOwner = currentRole === "owner";
  const selectedWorkspaceName = workspaces.find((ws) => ws.id === selectedWorkspaceId)?.name ?? "";

  // Reset filters when board changes
  useEffect(() => {
    setSearchQuery("");
    setFilterPriority("all");
    setFilterAssigneeId("all");
    setFilterDueDate("all");
  }, [selectedBoardId]);

  const hasActiveFilters =
    searchQuery !== "" ||
    filterPriority !== "all" ||
    filterAssigneeId !== "all" ||
    filterDueDate !== "all";

  const clearFilters = useCallback(() => {
    setSearchQuery("");
    setFilterPriority("all");
    setFilterAssigneeId("all");
    setFilterDueDate("all");
  }, []);

  // Client-side filtering
  const filteredTasks = useMemo(() => {
    if (!hasActiveFilters) return tasks;

    const now = new Date();
    const todayLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    return tasks.filter((task) => {
      // Search: match title or description (case-insensitive)
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = task.title.toLowerCase().includes(q);
        const matchesDesc = task.description?.toLowerCase().includes(q) ?? false;
        if (!matchesTitle && !matchesDesc) return false;
      }

      // Priority filter
      if (filterPriority !== "all" && task.priority !== filterPriority) return false;

      // Assignee filter
      if (filterAssigneeId === "unassigned") {
        if (task.assignee_id !== null) return false;
      } else if (filterAssigneeId !== "all") {
        if (task.assignee_id !== filterAssigneeId) return false;
      }

      // Due date filter
      if (filterDueDate !== "all") {
        if (filterDueDate === "no_due_date") {
          if (task.due_date !== null) return false;
        } else if (task.due_date === null) {
          return false;
        } else {
          const target = new Date(task.due_date + "T00:00:00");
          const targetLocal = new Date(target.getFullYear(), target.getMonth(), target.getDate());
          const diffDays = Math.round((targetLocal.getTime() - todayLocal.getTime()) / (1000 * 60 * 60 * 24));
          if (filterDueDate === "overdue" && diffDays >= 0) return false;
          if (filterDueDate === "today" && diffDays !== 0) return false;
          if (filterDueDate === "upcoming" && diffDays <= 0) return false;
        }
      }

      return true;
    });
  }, [tasks, searchQuery, filterPriority, filterAssigneeId, filterDueDate, hasActiveFilters]);

  // Cmd/Ctrl+A selects all visible (filtered) tasks
  useEffect(() => {
    if (!selectedBoardId || lists.length === 0) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key !== "a") return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      e.preventDefault();
      setSelectedTaskIds(new Set(filteredTasks.map((t) => t.id)));
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selectedBoardId, lists.length, filteredTasks]);

  // DnD state
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const dragSavingRef = useRef(false);
  const activeTask = activeTaskId ? tasks.find((t) => t.id === activeTaskId) ?? null : null;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveTaskId(event.active.id as string);
    document.body.style.cursor = "grabbing";
  };

  const handleDragCancel = () => {
    setActiveTaskId(null);
    document.body.style.cursor = "";
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTaskId(null);
    document.body.style.cursor = "";

    if (!over || !canEditTasks) return;
    if (dragSavingRef.current) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeTaskData = tasks.find((t) => t.id === activeId);
    if (!activeTaskData) return;

    // Determine which column the drop target belongs to
    let targetListId: string | null = null;
    if (lists.some((l) => l.id === overId)) {
      targetListId = overId;
    } else {
      const overTask = tasks.find((t) => t.id === overId);
      if (overTask) targetListId = overTask.list_id;
    }
    if (!targetListId) return;

    dragSavingRef.current = true;

    try {
      // Same column — reorder within column
      if (activeTaskData.list_id === targetListId) {
        if (activeId === overId) return;

        const columnTasks = tasks
          .filter((t) => t.list_id === targetListId)
          .sort((a, b) => a.position - b.position);

        const oldIndex = columnTasks.findIndex((t) => t.id === activeId);
        const newIndex = columnTasks.findIndex((t) => t.id === overId);
        if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

        const reordered = arrayMove(columnTasks, oldIndex, newIndex).map(
          (task, i) => ({ ...task, position: (i + 1) * 1000 })
        );

        await reorderTasks(reordered, columnTasks);
        return;
      }

      // Cross-column move
      const ok = await moveTask(activeId, targetListId, activeTaskData.list_id);
      if (ok) {
        const targetList = lists.find((l) => l.id === targetListId);
        const fromList = lists.find((l) => l.id === activeTaskData.list_id);
        const displayTitle =
          targetList?.title === "Done" ? "Completed" : targetList?.title ?? "column";
        if (selectedWorkspaceId && selectedBoardId) {
          logActivity({
            workspaceId: selectedWorkspaceId,
            boardId: selectedBoardId,
            taskId: activeId,
            action: "task_moved",
            metadata: { task_title: activeTaskData.title, from: fromList?.title ?? "", to: targetList?.title ?? "" },
          });
        }
        showSuccess(`Moved to ${displayTitle}`);
      }
    } finally {
      dragSavingRef.current = false;
    }
  };

  const showSuccess = useCallback((msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 3000);
  }, []);

  // Bulk move
  const [bulkMoving, setBulkMoving] = useState(false);

  const handleBulkMove = useCallback(async (targetTitle: string) => {
    const targetList =
      lists.find((l) => l.title === targetTitle) ||
      (targetTitle === "Completed" ? lists.find((l) => l.title === "Done") : undefined);
    if (!targetList || selectedTaskIds.size === 0) return;

    setBulkMoving(true);

    const targetTasks = tasks
      .filter((t) => t.list_id === targetList.id)
      .sort((a, b) => a.position - b.position);
    const maxPosition = targetTasks.length > 0
      ? Math.max(...targetTasks.map((t) => t.position))
      : 0;

    const selectedIds = Array.from(selectedTaskIds);
    let failed = false;

    for (let i = 0; i < selectedIds.length; i++) {
      const result = await updateTask(selectedIds[i], {
        list_id: targetList.id,
        position: maxPosition + (i + 1) * 1000,
      } as Partial<Task>);
      if (!result) {
        failed = true;
        break;
      }
    }

    setBulkMoving(false);

    if (failed) {
      setErrorMsg("Failed to move some tasks. Please try again.");
    } else {
      clearSelection();
      const title = targetList.title === "Done" ? "Completed" : targetList.title;
      if (selectedWorkspaceId && selectedBoardId) {
        logActivity({
          workspaceId: selectedWorkspaceId,
          boardId: selectedBoardId,
          action: "bulk_moved",
          metadata: { count: selectedIds.length, to: targetList.title },
        });
      }
      showSuccess(`Moved ${selectedIds.length} task${selectedIds.length > 1 ? "s" : ""} to ${title}`);
    }
  }, [lists, tasks, selectedTaskIds, updateTask, clearSelection, showSuccess, setErrorMsg, selectedWorkspaceId, selectedBoardId]);

  // Bulk delete
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const handleBulkDelete = useCallback(async () => {
    if (selectedTaskIds.size === 0) return;
    setBulkDeleting(true);

    const selectedIds = Array.from(selectedTaskIds);
    let errorOccurred = false;

    for (const id of selectedIds) {
      try {
        await deleteTask(id);
      } catch {
        errorOccurred = true;
        break;
      }
    }

    setBulkDeleting(false);

    if (errorOccurred) {
      setErrorMsg("Failed to delete some tasks. Please try again.");
    } else {
      clearSelection();
      if (selectedWorkspaceId && selectedBoardId) {
        logActivity({
          workspaceId: selectedWorkspaceId,
          boardId: selectedBoardId,
          action: "bulk_deleted",
          metadata: { count: selectedIds.length },
        });
      }
      showSuccess(`Deleted ${selectedIds.length} task${selectedIds.length > 1 ? "s" : ""}`);
    }
  }, [selectedTaskIds, deleteTask, clearSelection, showSuccess, setErrorMsg, selectedWorkspaceId, selectedBoardId]);

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
    const task = await createTask(listId, newTaskTitle.trim(), {
      priority: newTaskPriority,
      due_date: newTaskDueDate || null,
      assignee_id: newTaskAssigneeId || null,
    });
    if (task && selectedWorkspaceId && selectedBoardId) {
      logActivity({
        workspaceId: selectedWorkspaceId,
        boardId: selectedBoardId,
        taskId: task.id,
        action: "task_created",
        metadata: { task_title: task.title },
      });
    }
    setNewTaskTitle("");
    setNewTaskPriority("none");
    setNewTaskDueDate("");
    setNewTaskAssigneeId("");
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
    setEditAssigneeId(task.assignee_id ?? "");
    setConfirmDeleteId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle("");
    setEditDescription("");
    setEditPriority("none");
    setEditDueDate("");
    setEditAssigneeId("");
  };

  const saveEdit = async (id: string) => {
    if (!editTitle.trim()) return;
    const original = tasks.find((t) => t.id === id);
    setUpdatingId(id);
    await updateTask(id, {
      title: editTitle.trim(),
      description: editDescription.trim(),
      priority: editPriority,
      due_date: editDueDate || null,
      assignee_id: editAssigneeId || null,
    } as Partial<Task>);

    if (original && selectedWorkspaceId && selectedBoardId) {
      const newAssigneeId = editAssigneeId || null;
      const newDueDate = editDueDate || null;
      if (original.assignee_id !== newAssigneeId) {
        const assignee = newAssigneeId ? members.find((m) => m.user_id === newAssigneeId) : null;
        logActivity({
          workspaceId: selectedWorkspaceId,
          boardId: selectedBoardId,
          taskId: id,
          action: "task_assigned",
          metadata: { task_title: editTitle.trim(), assignee_name: assignee ? (assignee.display_name || assignee.email) : null },
        });
      } else if (original.due_date !== newDueDate) {
        logActivity({
          workspaceId: selectedWorkspaceId,
          boardId: selectedBoardId,
          taskId: id,
          action: "due_date_changed",
          metadata: { task_title: editTitle.trim(), due_date: newDueDate },
        });
      } else {
        logActivity({
          workspaceId: selectedWorkspaceId,
          boardId: selectedBoardId,
          taskId: id,
          action: "task_updated",
          metadata: { task_title: editTitle.trim() },
        });
      }
    }

    setUpdatingId(null);
    setEditingId(null);
    showSuccess("Task updated");
  };

  const handleDelete = async (id: string) => {
    const task = tasks.find((t) => t.id === id);
    setDeletingId(id);
    await deleteTask(id);
    if (task && selectedWorkspaceId && selectedBoardId) {
      logActivity({
        workspaceId: selectedWorkspaceId,
        boardId: selectedBoardId,
        action: "task_deleted",
        metadata: { task_title: task.title },
      });
    }
    setDeletingId(null);
    setConfirmDeleteId(null);
    setSelectedTaskIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    showSuccess("Task deleted");
  };

  const handleMoveTask = async (taskId: string, targetTitle: string) => {
    const targetList =
      lists.find((l) => l.title === targetTitle) ||
      (targetTitle === "Completed" ? lists.find((l) => l.title === "Done") : undefined);
    if (!targetList) return;

    const task = tasks.find((t) => t.id === taskId);
    const fromList = task ? lists.find((l) => l.id === task.list_id) : undefined;
    setUpdatingId(taskId);
    await updateTask(taskId, { list_id: targetList.id } as Partial<Task>);
    if (task && selectedWorkspaceId && selectedBoardId) {
      logActivity({
        workspaceId: selectedWorkspaceId,
        boardId: selectedBoardId,
        taskId,
        action: "task_moved",
        metadata: { task_title: task.title, from: fromList?.title ?? "", to: targetList.title },
      });
    }
    setUpdatingId(null);
    showSuccess(`Moved to ${targetTitle}`);
  };

  // Member handlers
  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      const result = await invite(inviteEmail.trim(), inviteRole);
      if (result.ok) {
        setInviteEmail("");
        showSuccess("เชิญสมาชิกสำเร็จ");
      } else {
        setErrorMsg(result.error ?? "ไม่สามารถเชิญสมาชิกได้");
      }
    } catch (err) {
      console.error("Invite failed:", err);
      setErrorMsg("ไม่สามารถเชิญสมาชิกได้");
    } finally {
      setInviting(false);
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

  const handleDeleteBoard = async () => {
    if (!selectedBoardId) return;
    setDeletingBoard(true);
    const ok = await deleteBoard(selectedBoardId);
    setDeletingBoard(false);
    setConfirmDeleteBoard(false);
    if (ok) showSuccess("ลบบอร์ดสำเร็จ");
  };

  const handleDeleteWorkspace = async () => {
    if (!selectedWorkspaceId) return;
    setDeletingWorkspace(true);
    const ok = await deleteWorkspace(selectedWorkspaceId);
    setDeletingWorkspace(false);
    if (ok) {
      setConfirmDeleteWorkspace(false);
      setDeleteWorkspaceConfirmName("");
      showSuccess("ลบ workspace สำเร็จ");
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
      {/* Feedback toasts */}
      {successMsg && (
        <div
          className="fixed top-4 right-4 z-30 flex items-center gap-2 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-600 shadow-lg border border-green-200/50 dark:bg-green-950 dark:text-green-400 dark:border-green-800"
          style={{ animation: "toast-in 0.2s ease-out" }}
        >
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div
          className="fixed top-4 right-4 z-30 flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 shadow-lg border border-red-200/50 dark:bg-red-950 dark:text-red-400 dark:border-red-800"
          style={{ animation: "toast-in 0.2s ease-out" }}
        >
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
          </svg>
          <span>{errorMsg}</span>
          <button onClick={clearError} className="ml-1 font-bold opacity-60 hover:opacity-100">&times;</button>
        </div>
      )}

      <BoardToolbar
        workspaces={workspaces}
        selectedWorkspaceId={selectedWorkspaceId}
        boards={boards}
        selectedBoardId={selectedBoardId}
        members={members}
        isManager={isManager}
        currentUserId={currentUserId}
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
        confirmDeleteBoard={confirmDeleteBoard}
        deletingBoard={deletingBoard}
        onDeleteBoard={handleDeleteBoard}
        onSetConfirmDeleteBoard={setConfirmDeleteBoard}
        confirmDeleteWorkspace={confirmDeleteWorkspace}
        deletingWorkspace={deletingWorkspace}
        deleteWorkspaceConfirmName={deleteWorkspaceConfirmName}
        onDeleteWorkspaceConfirmNameChange={setDeleteWorkspaceConfirmName}
        onDeleteWorkspace={handleDeleteWorkspace}
        onSetConfirmDeleteWorkspace={setConfirmDeleteWorkspace}
        selectedWorkspaceName={selectedWorkspaceName}
        isOwner={isOwner}
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
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-5 max-w-[240px]">Create a workspace to organize tasks and collaborate with your team.</p>
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
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-5 max-w-[240px]">Add a board to track tasks across To Do, In Progress, and Completed.</p>
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
        <div className="space-y-4">

          {/* Search & filters */}
          <BoardFilterBar
            members={members}
            searchQuery={searchQuery}
            filterPriority={filterPriority}
            filterAssigneeId={filterAssigneeId}
            filterDueDate={filterDueDate}
            hasActiveFilters={hasActiveFilters}
            onSearchChange={setSearchQuery}
            onPriorityChange={setFilterPriority}
            onAssigneeChange={setFilterAssigneeId}
            onDueDateChange={setFilterDueDate}
            onClearFilters={clearFilters}
          />

          {/* Lists — Kanban columns */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
          <div className="flex gap-5 overflow-x-auto pb-6 items-start -mx-1 px-1">
          {lists.map((list) => (
            <BoardColumn
              key={list.id}
              list={list}
              tasks={filteredTasks.filter((t) => t.list_id === list.id).sort((a, b) => a.position - b.position)}
              totalTaskCount={tasks.filter((t) => t.list_id === list.id).length}
              members={members}
              canEditTasks={canEditTasks}
              addingToListId={addingToListId}
              newTaskTitle={newTaskTitle}
              adding={adding}
              updatingId={updatingId}
              deletingId={deletingId}
              confirmDeleteId={confirmDeleteId}
              menuOpen={menuOpen}
              selectedTaskIds={selectedTaskIds}
              onToggleSelect={handleToggleSelect}
              onSelectAllInColumn={handleSelectAllInColumn}
              onAddTask={handleAddTask}
              onStartEdit={startEdit}
              onDelete={handleDelete}
              onConfirmDelete={setConfirmDeleteId}
              onSetMenuOpen={setMenuOpen}
              onMoveTask={handleMoveTask}
              onSetAddingToListId={setAddingToListId}
              onSetNewTaskTitle={setNewTaskTitle}
              newTaskPriority={newTaskPriority}
              newTaskDueDate={newTaskDueDate}
              newTaskAssigneeId={newTaskAssigneeId}
              onNewTaskPriorityChange={setNewTaskPriority}
              onNewTaskDueDateChange={setNewTaskDueDate}
              onNewTaskAssigneeIdChange={setNewTaskAssigneeId}
              allListTitles={lists.map((l) => l.title)}
            />
          ))}
          </div>
          <DragOverlay dropAnimation={{ duration: 200, easing: "ease" }}>
            {activeTask ? (
              <div
                className="w-[275px] rounded-lg border border-zinc-200 bg-white px-3 py-2.5 shadow-2xl ring-1 ring-black/5 dark:border-zinc-600 dark:bg-zinc-800 dark:ring-white/5"
                style={{ transform: "rotate(1deg) scale(1.02)", cursor: "grabbing" }}
              >
                <div className="flex items-start gap-2.5">
                  <div className="flex-1 min-w-0">
                    <span className="block text-[13px] leading-snug font-medium text-zinc-900 dark:text-zinc-100">
                      {activeTask.title}
                    </span>
                    {activeTask.description && (
                      <p className="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400 line-clamp-2">
                        {activeTask.description}
                      </p>
                    )}
                    {(activeTask.priority && activeTask.priority !== "none") || activeTask.due_date ? (
                      <div className="mt-1.5 flex items-center gap-2">
                        {activeTask.priority && activeTask.priority !== "none" && (
                          <span className="text-[11px] font-medium capitalize text-zinc-500 dark:text-zinc-400">
                            {activeTask.priority}
                          </span>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}
          </DragOverlay>
          </DndContext>
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

      <TaskDetailPanel
        open={editingId !== null}
        task={editingId ? tasks.find((t) => t.id === editingId) ?? null : null}
        members={members}
        editTitle={editTitle}
        editDescription={editDescription}
        editPriority={editPriority}
        editDueDate={editDueDate}
        editAssigneeId={editAssigneeId}
        isUpdating={updatingId !== null && updatingId === editingId}
        onTitleChange={setEditTitle}
        onDescriptionChange={setEditDescription}
        onPriorityChange={setEditPriority}
        onDueDateChange={setEditDueDate}
        onAssigneeIdChange={setEditAssigneeId}
        onSave={() => { if (editingId) saveEdit(editingId); }}
        onClose={cancelEdit}
      />

      <BulkActionToolbar
        selectedCount={selectedTaskIds.size}
        totalTaskCount={tasks.length}
        listTitles={lists.map((l) => l.title)}
        onBulkMove={handleBulkMove}
        moving={bulkMoving}
        onBulkDelete={handleBulkDelete}
        deleting={bulkDeleting}
        onClearSelection={clearSelection}
      />
    </div>
  );
}
