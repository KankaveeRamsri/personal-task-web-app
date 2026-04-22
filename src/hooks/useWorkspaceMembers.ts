"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import {
  inviteMemberAction,
  removeMemberAction,
  updateMemberRoleAction,
} from "@/app/dashboard/workspace-members-actions";
import type { WorkspaceRole, WorkspaceMember } from "@/types/database";

export type MemberWithProfile = WorkspaceMember & {
  email: string;
  display_name: string;
};

export function useWorkspaceMembers(workspaceId: string | null) {
  const [members, setMembers] = useState<MemberWithProfile[]>([]);
  const [currentRole, setCurrentRole] = useState<WorkspaceRole | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchMembers = useCallback(async () => {
    if (!workspaceId) {
      setMembers([]);
      setCurrentRole(null);
      return;
    }

    setLoading(true);
    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setMembers([]);
      setCurrentRole(null);
      setLoading(false);
      return;
    }

    const { data: memberRows } = await supabase
      .from("workspace_members")
      .select("*")
      .eq("workspace_id", workspaceId);

    if (!memberRows || memberRows.length === 0) {
      setMembers([]);
      setCurrentRole(null);
      setLoading(false);
      return;
    }

    const userIds = memberRows.map((m) => m.user_id);
    const { data: profileRows } = await supabase
      .from("profiles")
      .select("*")
      .in("id", userIds);

    const profileMap = new Map((profileRows ?? []).map((p) => [p.id, p]));

    const merged: MemberWithProfile[] = memberRows.map((m) => ({
      ...m,
      email: profileMap.get(m.user_id)?.email ?? "",
      display_name: profileMap.get(m.user_id)?.display_name ?? "",
    }));

    setMembers(merged);

    const myMember = memberRows.find((m) => m.user_id === user.id);
    setCurrentRole((myMember?.role as WorkspaceRole) ?? null);
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const invite = useCallback(
    async (email: string, role: WorkspaceRole) => {
      if (!workspaceId) return { ok: false as const, error: "No workspace" };
      const result = await inviteMemberAction(workspaceId, email, role);
      if (result.ok) await fetchMembers();
      return result;
    },
    [workspaceId, fetchMembers]
  );

  const remove = useCallback(
    async (userId: string) => {
      if (!workspaceId) return { ok: false as const, error: "No workspace" };
      const result = await removeMemberAction(workspaceId, userId);
      if (result.ok) await fetchMembers();
      return result;
    },
    [workspaceId, fetchMembers]
  );

  const updateRole = useCallback(
    async (userId: string, newRole: WorkspaceRole) => {
      if (!workspaceId) return { ok: false as const, error: "No workspace" };
      const result = await updateMemberRoleAction(
        workspaceId,
        userId,
        newRole
      );
      if (result.ok) await fetchMembers();
      return result;
    },
    [workspaceId, fetchMembers]
  );

  return {
    members,
    currentRole,
    loading,
    refresh: fetchMembers,
    invite,
    remove,
    updateRole,
  };
}
