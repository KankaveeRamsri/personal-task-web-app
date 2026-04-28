"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { useBoardData } from "@/hooks/useBoardData";
import { useWorkspaceMembers } from "@/hooks/useWorkspaceMembers";

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
  viewer: "Viewer (read-only)",
};

function permissionSummary(role: string | null) {
  if (role === "viewer") return "You can view tasks and boards but cannot create, edit, or delete them.";
  if (role === "owner" || role === "admin" || role === "member")
    return "You can create, edit, and delete tasks in this workspace.";
  return "";
}

export default function SettingsPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [userId, setUserId] = useState("");

  const [displayName, setDisplayName] = useState("");
  const [editingName, setEditingName] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const { workspaces, selectedWorkspaceId, boards, selectedBoardId } = useBoardData();
  const { currentRole } = useWorkspaceMembers(selectedWorkspaceId);

  const workspaceName = useMemo(
    () => workspaces.find((w) => w.id === selectedWorkspaceId)?.name ?? "",
    [workspaces, selectedWorkspaceId],
  );
  const boardName = useMemo(
    () => boards.find((b) => b.id === selectedBoardId)?.title ?? "",
    [boards, selectedBoardId],
  );

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      if (data.user) {
        setEmail(data.user.email ?? "");
        setName(data.user.user_metadata?.full_name ?? "");
        setUserId(data.user.id);

        const { data: profile } = await supabase
          .from("profiles")
          .select("display_name")
          .eq("id", data.user.id)
          .single();

        if (profile?.display_name) {
          setDisplayName(profile.display_name);
        }
      }
    });
  }, []);

  const handleStartEdit = () => {
    setEditingName(displayName);
    setIsEditing(true);
    setSaveMessage(null);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditingName("");
    setSaveMessage(null);
  };

  const handleSaveName = async () => {
    if (!userId || isSaving) return;

    const trimmed = editingName.trim();
    if (!trimmed) {
      setSaveMessage({ type: "error", text: "Display name cannot be empty." });
      return;
    }

    setIsSaving(true);
    setSaveMessage(null);

    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: trimmed })
      .eq("id", userId);

    setIsSaving(false);

    if (error) {
      setSaveMessage({
        type: "error",
        text: error.code === "42501"
          ? "Permission denied — RLS policy blocks profile updates. Contact your admin."
          : `Failed to save: ${error.message}`,
      });
      return;
    }

    setDisplayName(trimmed);
    setIsEditing(false);
    setEditingName("");
    setSaveMessage({ type: "success", text: "Display name updated." });
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
        Settings
      </h1>

      {/* Profile section */}
      <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Profile
          </h2>
        </div>
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          <div className="px-5 py-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                Display Name
              </span>
              {!isEditing && (
                <button
                  onClick={handleStartEdit}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                >
                  Edit
                </button>
              )}
            </div>
            {isEditing ? (
              <div className="mt-3 space-y-3">
                <input
                  type="text"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  placeholder="Enter display name"
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-600 dark:focus:ring-zinc-600"
                  disabled={isSaving}
                  autoFocus
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSaveName}
                    disabled={isSaving}
                    className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                  >
                    {isSaving ? "Saving…" : "Save"}
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    disabled={isSaving}
                    className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <p className="mt-1 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {displayName || "—"}
              </p>
            )}
            {saveMessage && (
              <p
                className={`mt-2 text-xs ${
                  saveMessage.type === "success"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {saveMessage.text}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Workspace section */}
      <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Workspace
          </h2>
        </div>
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          <div className="flex items-center justify-between px-5 py-4">
            <span className="text-sm text-zinc-500 dark:text-zinc-400">Workspace</span>
            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {workspaceName || "—"}
            </span>
          </div>
          <div className="flex items-center justify-between px-5 py-4">
            <span className="text-sm text-zinc-500 dark:text-zinc-400">Board</span>
            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {boardName || "—"}
            </span>
          </div>
          <div className="flex items-center justify-between px-5 py-4">
            <span className="text-sm text-zinc-500 dark:text-zinc-400">Your Role</span>
            <span className="inline-flex items-center rounded-lg bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              {currentRole ? ROLE_LABELS[currentRole] ?? currentRole : "—"}
            </span>
          </div>
          {currentRole && permissionSummary(currentRole) && (
            <div className="px-5 py-4">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {permissionSummary(currentRole)}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Account info section */}
      <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Account
          </h2>
        </div>
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          <div className="flex items-center justify-between px-5 py-4">
            <span className="text-sm text-zinc-500 dark:text-zinc-400">Email</span>
            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {email || "—"}
            </span>
          </div>
          <div className="flex items-center justify-between px-5 py-4">
            <span className="text-sm text-zinc-500 dark:text-zinc-400">Name</span>
            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {name || "—"}
            </span>
          </div>
          <div className="flex items-center justify-between px-5 py-4">
            <span className="text-sm text-zinc-500 dark:text-zinc-400">User ID</span>
            <span className="text-sm font-mono text-zinc-500 dark:text-zinc-400">
              {userId ? `${userId.slice(0, 8)}…${userId.slice(-4)}` : "—"}
            </span>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <button
          onClick={handleSignOut}
          className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
