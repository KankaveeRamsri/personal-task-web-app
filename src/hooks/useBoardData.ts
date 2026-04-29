"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import type { Workspace, Board, List, Task } from "@/types/database";

const STORAGE_WS = "selectedWorkspaceId";
const STORAGE_BD = "selectedBoardId";

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null) {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {}
}

export function useBoardData() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(
    () => readStorage(STORAGE_WS),
  );
  const [boards, setBoards] = useState<Board[]>([]);
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(
    () => readStorage(STORAGE_BD),
  );
  const [lists, setLists] = useState<List[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  // Reset derived state when workspace changes (adjust during render, not in effect)
  const [prevWorkspaceId, setPrevWorkspaceId] = useState<string | null>(null);
  if (selectedWorkspaceId !== prevWorkspaceId) {
    setPrevWorkspaceId(selectedWorkspaceId);
    setBoards([]);
    setSelectedBoardId(null);
    setLists([]);
    setTasks([]);
  }

  // Reset derived state when board changes (adjust during render, not in effect)
  const [prevBoardId, setPrevBoardId] = useState<string | null>(null);
  if (selectedBoardId !== prevBoardId) {
    setPrevBoardId(selectedBoardId);
    setLists([]);
    setTasks([]);
  }

  // Load workspaces for current user
  const fetchWorkspaces = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("workspaces")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      setErrorMsg(error.message);
      return;
    }
    setWorkspaces((data ?? []) as Workspace[]);
    return (data ?? []) as Workspace[];
  }, []);

  // Load boards for a workspace
  const fetchBoards = useCallback(async (workspaceId: string) => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("boards")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("is_closed", false)
      .order("position", { ascending: true });

    if (error) {
      setErrorMsg(error.message);
      return;
    }
    setBoards((data ?? []) as Board[]);
    return (data ?? []) as Board[];
  }, []);

  // Load lists for a board
  const fetchLists = useCallback(async (boardId: string) => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("lists")
      .select("*")
      .eq("board_id", boardId)
      .eq("is_archived", false)
      .order("position", { ascending: true });

    if (error) {
      setErrorMsg(error.message);
      return;
    }
    setLists((data ?? []) as List[]);
    return (data ?? []) as List[];
  }, []);

  // Load tasks for a board (all lists)
  const fetchTasks = useCallback(async (boardId: string) => {
    const supabase = createClient();

    // Get list IDs for this board first
    const { data: boardLists } = await supabase
      .from("lists")
      .select("id")
      .eq("board_id", boardId);

    if (!boardLists || boardLists.length === 0) {
      setTasks([]);
      return;
    }

    const listIds = boardLists.map((l) => l.id);

    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .in("list_id", listIds)
      .order("position", { ascending: true });

    if (error) {
      setErrorMsg(error.message);
      return;
    }
    setTasks((data ?? []) as Task[]);
  }, []);

  // Sync selected IDs to localStorage
  useEffect(() => {
    writeStorage(STORAGE_WS, selectedWorkspaceId);
  }, [selectedWorkspaceId]);

  useEffect(() => {
    writeStorage(STORAGE_BD, selectedBoardId);
  }, [selectedBoardId]);

  // Initial load: fetch workspaces, prefer localStorage value if still valid
  useEffect(() => {
    (async () => {
      setLoading(true);
      const ws = await fetchWorkspaces();
      if (ws && ws.length > 0) {
        const saved = readStorage(STORAGE_WS);
        setSelectedWorkspaceId(saved && ws.some((w) => w.id === saved) ? saved : ws[0].id);
      }
      setLoading(false);
    })();
  }, [fetchWorkspaces]);

  // When workspace changes, fetch boards — prefer localStorage board if still valid
  useEffect(() => {
    if (!selectedWorkspaceId) return;
    (async () => {
      const bds = await fetchBoards(selectedWorkspaceId);
      if (bds && bds.length > 0) {
        const saved = readStorage(STORAGE_BD);
        setSelectedBoardId(saved && bds.some((b) => b.id === saved) ? saved : bds[0].id);
      } else {
        setSelectedBoardId(null);
      }
    })();
  }, [selectedWorkspaceId, fetchBoards]);

  // When board changes, fetch lists and tasks
  useEffect(() => {
    if (!selectedBoardId) return;
    (async () => {
      await Promise.all([fetchLists(selectedBoardId), fetchTasks(selectedBoardId)]);
    })();
  }, [selectedBoardId, fetchLists, fetchTasks]);

  // CRUD operations
  const createWorkspace = useCallback(async (name: string) => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setErrorMsg("กรุณาเข้าสู่ระบบ");
      return;
    }

    const { data, error } = await supabase
      .from("workspaces")
      .insert({ name, owner_id: user.id })
      .select()
      .single();

    if (error) {
      setErrorMsg(error.message);
      return;
    }
    const ws = data as Workspace;
    setWorkspaces((prev) => [...prev, ws]);
    setSelectedWorkspaceId(ws.id);
    return ws;
  }, []);

  const createBoard = useCallback(
    async (title: string) => {
      if (!selectedWorkspaceId) return;
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("boards")
        .insert({
          workspace_id: selectedWorkspaceId,
          title,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) {
        setErrorMsg(error.message);
        return;
      }
      const board = data as Board;
      setBoards((prev) => [...prev, board]);
      setSelectedBoardId(board.id);

      // Create default lists for the new board
      const listNames = ["To Do", "In Progress", "Completed"];
      const createdLists: List[] = [];
      for (let i = 0; i < listNames.length; i++) {
        const { data: listData } = await supabase
          .from("lists")
          .insert({ board_id: board.id, title: listNames[i], position: (i + 1) * 1000 })
          .select()
          .single();
        if (listData) createdLists.push(listData as List);
      }
      if (createdLists.length > 0) {
        setLists(createdLists);
      }
      setTasks([]);
      return board;
    },
    [selectedWorkspaceId]
  );

  const createTask = useCallback(
    async (
      listId: string,
      title: string,
      metadata?: { description?: string; priority?: string; due_date?: string | null; assignee_id?: string | null }
    ) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Get current max position in this list
      const { data: existingTasks } = await supabase
        .from("tasks")
        .select("position")
        .eq("list_id", listId)
        .order("position", { ascending: false })
        .limit(1);

      const nextPos = existingTasks && existingTasks.length > 0 ? existingTasks[0].position + 1000 : 1000;

      const { data, error } = await supabase
        .from("tasks")
        .insert({
          list_id: listId,
          title,
          description: metadata?.description || "",
          priority: metadata?.priority || "none",
          due_date: metadata?.due_date || null,
          assignee_id: metadata?.assignee_id || null,
          created_by: user.id,
          position: nextPos,
        })
        .select()
        .single();

      if (error) {
        setErrorMsg(error.message);
        return;
      }
      const task = data as Task;
      setTasks((prev) => [...prev, task]);
      return task;
    },
    []
  );

  const updateTask = useCallback(async (id: string, updates: Partial<Task>) => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("tasks")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      setErrorMsg(error.message);
      return;
    }
    const updated = data as Task;
    setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
    return updated;
  }, []);

  const moveTask = useCallback(
    async (taskId: string, targetListId: string, originalListId: string) => {
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, list_id: targetListId } : t))
      );

      const supabase = createClient();
      const { data, error } = await supabase
        .from("tasks")
        .update({ list_id: targetListId })
        .eq("id", taskId)
        .select()
        .single();

      if (error) {
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, list_id: originalListId } : t))
        );
        setErrorMsg(error.message);
        return false;
      }

      const updated = data as Task;
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
      return true;
    },
    []
  );

  const reorderTasks = useCallback(
    async (reordered: Task[], original: Task[]) => {
      const originalMap = new Map(original.map((t) => [t.id, t]));
      const changed = reordered.filter(
        (t) => t.position !== originalMap.get(t.id)?.position
      );
      if (changed.length === 0) return true;

      const reorderedMap = new Map(reordered.map((t) => [t.id, t]));
      setTasks((prev) => prev.map((t) => reorderedMap.get(t.id) ?? t));

      const supabase = createClient();
      const results = await Promise.all(
        changed.map((task) =>
          supabase
            .from("tasks")
            .update({ position: task.position })
            .eq("id", task.id)
        )
      );

      const failed = results.find((r) => r.error);
      if (failed) {
        const revertMap = new Map(original.map((t) => [t.id, t]));
        setTasks((prev) => prev.map((t) => revertMap.get(t.id) ?? t));
        setErrorMsg(failed.error!.message);
        return false;
      }
      return true;
    },
    []
  );

  const deleteTask = useCallback(async (id: string) => {
    const supabase = createClient();
    const { error } = await supabase.from("tasks").delete().eq("id", id);

    if (error) {
      setErrorMsg(error.message);
      return;
    }
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const deleteBoard = useCallback(async (boardId: string) => {
    const supabase = createClient();
    const { error } = await supabase.from("boards").delete().eq("id", boardId);

    if (error) {
      setErrorMsg(error.message);
      return false;
    }

    const remaining = boards.filter((b) => b.id !== boardId);
    setBoards(remaining);

    if (remaining.length > 0) {
      setSelectedBoardId(remaining[0].id);
    } else {
      setSelectedBoardId(null);
      setLists([]);
      setTasks([]);
    }
    return true;
  }, [boards]);

  const deleteWorkspace = useCallback(async (workspaceId: string) => {
    const supabase = createClient();
    const { error } = await supabase.from("workspaces").delete().eq("id", workspaceId);

    if (error) {
      setErrorMsg(error.message);
      return false;
    }

    const remaining = workspaces.filter((ws) => ws.id !== workspaceId);
    setWorkspaces(remaining);

    if (remaining.length > 0) {
      setSelectedWorkspaceId(remaining[0].id);
    } else {
      setSelectedWorkspaceId(null);
      setBoards([]);
      setSelectedBoardId(null);
      setLists([]);
      setTasks([]);
    }
    return true;
  }, [workspaces]);

  const renameWorkspace = useCallback(
    async (workspaceId: string, newName: string) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("workspaces")
        .update({ name: newName })
        .eq("id", workspaceId)
        .select()
        .single();

      if (error) {
        setErrorMsg(error.message);
        return false;
      }
      const updated = data as Workspace;
      setWorkspaces((prev) => prev.map((ws) => (ws.id === workspaceId ? updated : ws)));
      return true;
    },
    [],
  );

  const createList = useCallback(
    async (boardId: string, title: string) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Get current max position in this board
      const { data: existingLists } = await supabase
        .from("lists")
        .select("position")
        .eq("board_id", boardId)
        .order("position", { ascending: false })
        .limit(1);

      const nextPos = existingLists && existingLists.length > 0 ? existingLists[0].position + 1000 : 1000;

      const { data, error } = await supabase
        .from("lists")
        .insert({ board_id: boardId, title, position: nextPos })
        .select()
        .single();

      if (error) {
        setErrorMsg(error.message);
        return;
      }
      const list = data as List;
      setLists((prev) => [...prev, list].sort((a, b) => a.position - b.position));
      return list;
    },
    []
  );

  const renameList = useCallback(async (listId: string, newTitle: string) => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("lists")
      .update({ title: newTitle })
      .eq("id", listId)
      .select()
      .single();

    if (error) {
      setErrorMsg(error.message);
      return false;
    }
    const updated = data as List;
    setLists((prev) => prev.map((l) => (l.id === listId ? updated : l)));
    return true;
  }, []);

  const updateListColor = useCallback(async (listId: string, color: string) => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("lists")
      .update({ color })
      .eq("id", listId)
      .select()
      .single();

    if (error) {
      setErrorMsg(error.message);
      return false;
    }
    const updated = data as List;
    setLists((prev) => prev.map((l) => (l.id === listId ? updated : l)));
    return true;
  }, []);

  const reorderLists = useCallback(
    async (reordered: List[], original: List[]) => {
      const originalMap = new Map(original.map((l) => [l.id, l]));
      const changed = reordered.filter(
        (l) => l.position !== originalMap.get(l.id)?.position
      );
      if (changed.length === 0) return true;

      const reorderedMap = new Map(reordered.map((l) => [l.id, l]));
      setLists((prev) => prev.map((l) => reorderedMap.get(l.id) ?? l));

      const supabase = createClient();
      const results = await Promise.all(
        changed.map((list) =>
          supabase
            .from("lists")
            .update({ position: list.position })
            .eq("id", list.id)
        )
      );

      const failed = results.find((r) => r.error);
      if (failed) {
        const revertMap = new Map(original.map((l) => [l.id, l]));
        setLists((prev) => prev.map((l) => revertMap.get(l.id) ?? l));
        setErrorMsg(failed.error!.message);
        return false;
      }
      return true;
    },
    []
  );

  const deleteList = useCallback(async (listId: string) => {
    const supabase = createClient();
    const { error } = await supabase.from("lists").delete().eq("id", listId);

    if (error) {
      setErrorMsg(error.message);
      return false;
    }
    setLists((prev) => prev.filter((l) => l.id !== listId));
    return true;
  }, []);

  const clearError = useCallback(() => setErrorMsg(""), []);

  return {
    // State
    workspaces,
    selectedWorkspaceId,
    boards,
    selectedBoardId,
    lists,
    tasks,
    loading,
    errorMsg,
    // Actions
    setSelectedWorkspaceId,
    setSelectedBoardId,
    createWorkspace,
    createBoard,
    createTask,
    createList,
    renameList,
    updateListColor,
    reorderLists,
    deleteList,
    updateTask,
    deleteTask,
    moveTask,
    reorderTasks,
    deleteBoard,
    deleteWorkspace,
    renameWorkspace,
    fetchTasks,
    clearError,
    setErrorMsg,
  };
}
