"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useBoardData } from "@/hooks/useBoardData";
import { useWorkspaceMembers } from "@/hooks/useWorkspaceMembers";
import { createClient } from "@/lib/supabase";
import { canInviteMembers } from "@/lib/permissions";
import type { WorkspaceRole } from "@/types/database";

function InviteModal({
  onClose,
  onInvite,
}: {
  onClose: () => void;
  onInvite: (email: string, role: WorkspaceRole) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<WorkspaceRole>("member");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div 
        className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800"
        style={{ animation: "panel-in 0.2s ease-out" }}
      >
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Invite Member</h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Add a member to the current workspace by email.</p>
        </div>
        
        {success ? (
          <div className="mt-4 flex flex-col items-center justify-center py-6 text-center">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <svg className="h-5 w-5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Member invited successfully!</p>
          </div>
        ) : (
          <form
            className="mt-4 space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setError("");
              setSubmitting(true);
              const res = await onInvite(email, role);
              setSubmitting(false);
              if (!res.ok) {
                setError(res.error || "Failed to invite");
              } else {
                setSuccess(true);
                setTimeout(onClose, 1500);
              }
            }}
          >
            {error && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">
                {error}
              </div>
            )}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Email address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-indigo-400 dark:focus:ring-indigo-400"
                placeholder="colleague@example.com"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as WorkspaceRole)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-indigo-400 dark:focus:ring-indigo-400"
              >
                <option value="admin">Admin</option>
                <option value="member">Member</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
            
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-600"
              >
                {submitting ? (
                  <>
                    <svg className="mr-2 h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Inviting...
                  </>
                ) : "Invite"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
}

function RemoveModal({
  member,
  onClose,
  onConfirm,
}: {
  member: { display_name: string; email: string };
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div 
        className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800"
        style={{ animation: "panel-in 0.2s ease-out" }}
      >
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
          <svg className="h-6 w-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Remove Member</h2>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Are you sure you want to remove <span className="font-semibold text-zinc-700 dark:text-zinc-300">{member.display_name || member.email}</span> from this workspace? They will lose access to all boards and tasks.
        </p>
        
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={async () => {
              setSubmitting(true);
              await onConfirm();
              setSubmitting(false);
            }}
            className="inline-flex items-center justify-center rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50 dark:bg-red-500 dark:hover:bg-red-600"
          >
            {submitting ? "Removing..." : "Remove"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function TeamPage() {
  const {
    workspaces,
    selectedWorkspaceId,
    setSelectedWorkspaceId,
  } = useBoardData();

  const { members, currentRole, loading, errorMsg, invite, updateRole, remove } = useWorkspaceMembers(selectedWorkspaceId);

  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [optimisticRoles, setOptimisticRoles] = useState<Record<string, WorkspaceRole>>({});
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [memberToRemove, setMemberToRemove] = useState<{ id: string; user_id: string; display_name: string; email: string } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (!cancelled && data.user) {
        setCurrentUserEmail(data.user.email ?? null);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "owner":
        return "bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400 ring-purple-600/20";
      case "admin":
        return "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 ring-blue-600/20";
      case "member":
        return "bg-zinc-50 text-zinc-700 dark:bg-zinc-500/10 dark:text-zinc-400 ring-zinc-500/20";
      case "viewer":
        return "bg-zinc-50 text-zinc-500 dark:bg-zinc-500/10 dark:text-zinc-500 ring-zinc-500/20 opacity-80";
      default:
        return "bg-zinc-50 text-zinc-500 dark:bg-zinc-500/10 dark:text-zinc-400 ring-zinc-500/20";
    }
  };

  function getInitials(email: string, displayName: string): string {
    if (displayName && displayName.trim()) {
      const parts = displayName.trim().split(/\s+/);
      if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
      return parts[0].slice(0, 2).toUpperCase();
    }
    return email.slice(0, 2).toUpperCase();
  }

  const canEditRole = (targetRole: WorkspaceRole, targetEmail: string) => {
    if (!currentRole) return false;
    if (currentUserEmail === targetEmail) return false;
    if (targetRole === "owner") return false;
    if (currentRole === "owner") return true;
    if (currentRole === "admin" && (targetRole === "member" || targetRole === "viewer")) return true;
    return false;
  };

  const canRemoveMember = (targetRole: WorkspaceRole, targetEmail: string) => {
    // Same logic as editing role
    return canEditRole(targetRole, targetEmail);
  };

  const getAvailableRoles = () => {
    if (currentRole === "owner") return ["admin", "member", "viewer"];
    if (currentRole === "admin") return ["member", "viewer"];
    return [];
  };

  const handleRoleChange = async (userId: string, newRole: WorkspaceRole) => {
    setUpdatingUserId(userId);
    setOptimisticRoles(prev => ({ ...prev, [userId]: newRole }));
    
    const res = await updateRole(userId, newRole);
    
    setUpdatingUserId(null);
    if (!res.ok) {
      alert(res.error || "Failed to change role");
      setOptimisticRoles(prev => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    }
  };

  const handleRemoveMember = async () => {
    if (!memberToRemove) return;
    const res = await remove(memberToRemove.user_id);
    if (!res.ok) {
      alert(res.error || "Failed to remove member");
    } else {
      setMemberToRemove(null);
    }
  };

  if (!mounted) {
    return (
      <div className="mx-auto max-w-5xl">
        <div className="mb-6">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            Team
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Overview of members in your workspace
          </p>
        </div>
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 py-20 dark:border-zinc-700">
          <p className="text-sm font-medium text-zinc-400 dark:text-zinc-500">Loading team...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          Team
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Overview of members in your workspace
        </p>
      </div>

      {/* Context selectors & Actions */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {workspaces.length > 0 && (
            <select
              value={selectedWorkspaceId ?? ""}
              onChange={(e) => setSelectedWorkspaceId(e.target.value)}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-900 shadow-md ring-1 ring-zinc-900/[0.08] transition-all hover:shadow-lg hover:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-white/[0.06] dark:hover:border-zinc-500 dark:focus:ring-zinc-500"
            >
              {workspaces.map((ws) => (
                <option key={ws.id} value={ws.id}>
                  {ws.name}
                </option>
              ))}
            </select>
          )}
        </div>
        
        {currentRole && canInviteMembers(currentRole) && (
          <button
            onClick={() => setIsInviteModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Invite Member
          </button>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 py-20 dark:border-zinc-700">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800">
            <svg className="h-5 w-5 animate-spin text-zinc-400 dark:text-zinc-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-zinc-400 dark:text-zinc-500">Loading members...</p>
        </div>
      ) : errorMsg ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 py-20 dark:border-zinc-700">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 dark:bg-red-900/30">
            <svg className="h-5 w-5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Failed to load members</p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{errorMsg}</p>
        </div>
      ) : !selectedWorkspaceId ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 py-20 dark:border-zinc-700">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800">
            <svg className="h-5 w-5 text-zinc-400 dark:text-zinc-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 7.125C2.25 6.504 2.754 6 3.375 6h6c.621 0 1.125.504 1.125 1.125v3.75c0 .621-.504 1.125-1.125 1.125h-6a1.125 1.125 0 0 1-1.125-1.125v-3.75ZM14.25 8.625c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v8.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 0 1-1.125-1.125v-8.25ZM2.25 15.375c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v2.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 0 1-1.125-1.125v-2.25Z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-zinc-400 dark:text-zinc-500">
            Select a workspace to view members
          </p>
        </div>
      ) : members.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 py-20 dark:border-zinc-700">
          <p className="text-sm font-medium text-zinc-400 dark:text-zinc-500">
            No members found
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <table className="w-full min-w-[500px]">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50/80 dark:border-zinc-800 dark:bg-zinc-800/50">
                <th className="px-6 py-4 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Member
                </th>
                <th className="px-6 py-4 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Role
                </th>
                <th className="px-6 py-4 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Joined
                </th>
                <th className="px-6 py-4 text-right text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {members.map((member) => (
                <tr key={member.id} className="transition-colors hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-600 ring-1 ring-inset ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700">
                        {getInitials(member.email, member.display_name)}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                            {member.display_name || member.email.split("@")[0]}
                          </span>
                          {currentUserEmail === member.email && (
                            <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                              You
                            </span>
                          )}
                        </div>
                        <span className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                          {member.email}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 align-middle">
                    {canEditRole(member.role, member.email) ? (
                      <div className="relative inline-block w-32">
                        <select
                          value={optimisticRoles[member.user_id] || member.role}
                          onChange={(e) => handleRoleChange(member.user_id, e.target.value as WorkspaceRole)}
                          disabled={updatingUserId === member.user_id}
                          className={`w-full appearance-none rounded-md border border-zinc-200 bg-white py-1.5 pl-3 pr-8 text-xs font-medium text-zinc-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:focus:border-indigo-400 dark:focus:ring-indigo-400 ${getRoleBadge(optimisticRoles[member.user_id] || member.role).split(' ')[0]} bg-opacity-10 dark:bg-opacity-20`}
                        >
                          {getAvailableRoles().map((r) => (
                            <option key={r} value={r}>
                              {r.charAt(0).toUpperCase() + r.slice(1)}
                            </option>
                          ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-zinc-500">
                          {updatingUserId === member.user_id ? (
                            <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                          ) : (
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 15L12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9" />
                            </svg>
                          )}
                        </div>
                      </div>
                    ) : (
                      <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${getRoleBadge(optimisticRoles[member.user_id] || member.role)}`}>
                        {(optimisticRoles[member.user_id] || member.role).charAt(0).toUpperCase() + (optimisticRoles[member.user_id] || member.role).slice(1)}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 align-middle">
                    <span className="text-sm text-zinc-500 dark:text-zinc-400">
                      {new Date(member.joined_at).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </td>
                  <td className="px-6 py-4 align-middle text-right">
                    {canRemoveMember(member.role, member.email) && (
                      <button
                        onClick={() => setMemberToRemove(member)}
                        className="text-zinc-400 transition-colors hover:text-red-500 dark:text-zinc-500 dark:hover:text-red-400 p-1"
                        title="Remove member"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {mounted && isInviteModalOpen && (
        <InviteModal 
          onClose={() => setIsInviteModalOpen(false)} 
          onInvite={invite} 
        />
      )}
      {mounted && memberToRemove && (
        <RemoveModal
          member={memberToRemove}
          onClose={() => setMemberToRemove(null)}
          onConfirm={handleRemoveMember}
        />
      )}
    </div>
  );
}
