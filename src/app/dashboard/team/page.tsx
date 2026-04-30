"use client";

import { useEffect, useState } from "react";
import { useBoardData } from "@/hooks/useBoardData";
import { useWorkspaceMembers } from "@/hooks/useWorkspaceMembers";
import { createClient } from "@/lib/supabase";

export default function TeamPage() {
  const {
    workspaces,
    selectedWorkspaceId,
    setSelectedWorkspaceId,
  } = useBoardData();

  const { members, loading, errorMsg } = useWorkspaceMembers(selectedWorkspaceId);

  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);

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

      {/* Context selectors */}
      <div className="mb-6 flex items-center gap-2">
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
                    <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${getRoleBadge(member.role)}`}>
                      {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                    </span>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
