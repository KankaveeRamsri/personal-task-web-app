"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";

type Task = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  is_completed: boolean;
  created_at: string;
  updated_at: string;
};

export default function DashboardPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const showSuccess = useCallback((msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 3000);
  }, []);

  const fetchTasks = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      setErrorMsg(error.message);
    } else if (data) {
      setTasks(data as Task[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    if (!title.trim()) return;

    setAdding(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setErrorMsg("Not authenticated");
      setAdding(false);
      return;
    }

    const { error } = await supabase
      .from("tasks")
      .insert({
        title: title.trim(),
        description: description.trim() || null,
        user_id: user.id,
      })
      .select()
      .single();

    if (error) {
      setErrorMsg(error.message);
      setAdding(false);
      return;
    }

    setTitle("");
    setDescription("");
    setAdding(false);
    showSuccess("Task added");
    await fetchTasks();
  };

  const toggleComplete = async (task: Task) => {
    setUpdatingId(task.id);
    setErrorMsg("");

    const supabase = createClient();
    const { error } = await supabase
      .from("tasks")
      .update({ is_completed: !task.is_completed })
      .eq("id", task.id);

    if (error) {
      setErrorMsg(error.message);
      setUpdatingId(null);
      return;
    }

    setTasks(
      tasks.map((t) =>
        t.id === task.id ? { ...t, is_completed: !t.is_completed } : t
      )
    );
    setUpdatingId(null);
    showSuccess(task.is_completed ? "Task reopened" : "Task completed");
  };

  const startEdit = (task: Task) => {
    setEditId(task.id);
    setEditTitle(task.title);
    setEditDescription(task.description ?? "");
    setConfirmDeleteId(null);
  };

  const cancelEdit = () => {
    setEditId(null);
    setEditTitle("");
    setEditDescription("");
  };

  const saveEdit = async (id: string) => {
    if (!editTitle.trim()) return;

    setUpdatingId(id);
    setErrorMsg("");

    const supabase = createClient();
    const { error } = await supabase
      .from("tasks")
      .update({
        title: editTitle.trim(),
        description: editDescription.trim() || null,
      })
      .eq("id", id);

    if (error) {
      setErrorMsg(error.message);
      setUpdatingId(null);
      return;
    }

    setTasks(
      tasks.map((t) =>
        t.id === id
          ? {
              ...t,
              title: editTitle.trim(),
              description: editDescription.trim() || null,
            }
          : t
      )
    );
    setUpdatingId(null);
    setEditId(null);
    showSuccess("Task updated");
  };

  const confirmDelete = (id: string) => {
    setConfirmDeleteId(id);
    setEditId(null);
  };

  const deleteTask = async (id: string) => {
    setDeletingId(id);
    setErrorMsg("");

    const supabase = createClient();
    const { error } = await supabase.from("tasks").delete().eq("id", id);

    if (error) {
      setErrorMsg(error.message);
      setDeletingId(null);
      setConfirmDeleteId(null);
      return;
    }

    setTasks(tasks.filter((t) => t.id !== id));
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
    <div className="mx-auto max-w-xl">
      {/* Add task form */}
      <form onSubmit={addTask} className="mb-8 flex flex-col gap-3">
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Add a new task..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={adding}
            className="flex-1 rounded-lg border border-zinc-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-black disabled:opacity-50 dark:border-zinc-700 dark:focus:ring-white"
          />
          <button
            type="submit"
            disabled={adding || !title.trim()}
            className="rounded-lg bg-black px-6 py-3 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          >
            {adding ? "Adding..." : "Add"}
          </button>
        </div>
        <textarea
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={adding}
          rows={2}
          className="rounded-lg border border-zinc-300 px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-black disabled:opacity-50 dark:border-zinc-700 dark:focus:ring-white"
        />
      </form>

      {/* Feedback messages */}
      {errorMsg && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div className="mb-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-600 dark:bg-green-950 dark:text-green-400">
          {successMsg}
        </div>
      )}

      {/* Task list */}
      {tasks.length === 0 ? (
        <p className="text-center text-zinc-400">
          No tasks yet. Add one above!
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {tasks.map((task) => (
            <li
              key={task.id}
              className="relative rounded-lg border border-zinc-200 px-4 py-3 dark:border-zinc-800"
            >
              {/* Editing mode */}
              {editId === task.id ? (
                <div className="flex flex-col gap-3">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:focus:ring-white"
                  />
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    rows={2}
                    placeholder="Description (optional)"
                    className="rounded-lg border border-zinc-300 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:focus:ring-white"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => saveEdit(task.id)}
                      disabled={updatingId === task.id || !editTitle.trim()}
                      className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
                    >
                      {updatingId === task.id ? "Saving..." : "Save"}
                    </button>
                    <button
                      onClick={cancelEdit}
                      disabled={updatingId === task.id}
                      className="rounded-lg border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
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
                    onChange={() => toggleComplete(task)}
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
                        className={`mt-1 text-xs ${
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
                    <button
                      onClick={() => startEdit(task)}
                      className="rounded px-2 py-1 text-sm text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => confirmDelete(task.id)}
                      className="rounded px-2 py-1 text-sm text-zinc-400 hover:text-red-500"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}

              {/* Delete confirmation overlay */}
              {confirmDeleteId === task.id && (
                <div className="absolute inset-0 flex items-center justify-center gap-3 rounded-lg bg-white/95 px-4 dark:bg-zinc-900/95">
                  <span className="text-sm text-zinc-600 dark:text-zinc-300">
                    Delete this task?
                  </span>
                  <button
                    onClick={() => deleteTask(task.id)}
                    disabled={deletingId === task.id}
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {deletingId === task.id ? "Deleting..." : "Delete"}
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(null)}
                    disabled={deletingId === task.id}
                    className="rounded-lg border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
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
}
