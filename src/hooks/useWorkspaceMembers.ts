"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import {
  removeMemberAction,
  updateMemberRoleAction,
} from "@/app/dashboard/workspace-members-actions";
import { canInviteMembers } from "@/lib/permissions";
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
      if (!workspaceId)
        return { ok: false as const, error: "No workspace" };

      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user)
        return { ok: false as const, error: "กรุณาเข้าสู่ระบบ" };

      // 1. ตรวจสอบสิทธิ์ผู้เชิญ
      const { data: myMember } = await supabase
        .from("workspace_members")
        .select("role")
        .eq("workspace_id", workspaceId)
        .eq("user_id", user.id)
        .single();
      const actorRole = myMember?.role as WorkspaceRole | undefined;
      if (!actorRole || !canInviteMembers(actorRole))
        return { ok: false as const, error: "คุณไม่มีสิทธิ์เชิญสมาชิก" };

      // 2. ห้ามเชิญด้วย role = owner
      if (role === "owner")
        return { ok: false as const, error: "ไม่สามารถเชิญในฐานะ owner ได้" };

      // 3. หา target user จาก email
      const { data: targetProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", email)
        .single();
      if (!targetProfile)
        return { ok: false as const, error: "ไม่พบผู้ใช้ที่ใช้อีเมลนี้" };

      // 4. ห้ามเชิญตัวเอง
      if (targetProfile.id === user.id)
        return { ok: false as const, error: "ไม่สามารถเชิญตัวเองได้" };

      // 5. ตรวจสอบว่ายังไม่เป็นสมาชิก
      const { data: existing } = await supabase
        .from("workspace_members")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("user_id", targetProfile.id)
        .maybeSingle();
      if (existing)
        return { ok: false as const, error: "ผู้ใช้นี้เป็นสมาชิกอยู่แล้ว" };

      // 6. เพิ่มสมาชิก
      const { error } = await supabase
        .from("workspace_members")
        .insert({ workspace_id: workspaceId, user_id: targetProfile.id, role });
      if (error)
        return { ok: false as const, error: error.message };

      await fetchMembers();
      return { ok: true as const };
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
