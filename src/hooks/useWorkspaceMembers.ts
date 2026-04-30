"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import {
  canInviteMembers,
  canManageMembers,
  canChangeRole,
} from "@/lib/permissions";
import { logActivity } from "@/lib/activity-log";
import type { WorkspaceRole, WorkspaceMember } from "@/types/database";

export type MemberWithProfile = WorkspaceMember & {
  email: string;
  display_name: string;
};

export function useWorkspaceMembers(workspaceId: string | null) {
  const [members, setMembers] = useState<MemberWithProfile[]>([]);
  const [currentRole, setCurrentRole] = useState<WorkspaceRole | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    if (!workspaceId) {
      setMembers([]);
      setCurrentRole(null);
      setErrorMsg(null);
      return;
    }

    setLoading(true);
    setErrorMsg(null);
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

    const { data: memberRows, error: memberError } = await supabase
      .from("workspace_members")
      .select("*")
      .eq("workspace_id", workspaceId);

    if (memberError) {
      setErrorMsg(memberError.message);
      setLoading(false);
      return;
    }

    if (!memberRows || memberRows.length === 0) {
      setMembers([]);
      setCurrentRole(null);
      setLoading(false);
      return;
    }

    const userIds = memberRows.map((m) => m.user_id);
    const { data: profileRows, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .in("id", userIds);

    if (profileError) {
      setErrorMsg(profileError.message);
      setLoading(false);
      return;
    }

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

      // Log activity
      await logActivity({
        workspaceId,
        action: "invited",
        metadata: { target_user_id: targetProfile.id, role },
      });

      await fetchMembers();
      return { ok: true as const };
    },
    [workspaceId, fetchMembers]
  );

  const remove = useCallback(
    async (userId: string) => {
      if (!workspaceId) return { ok: false as const, error: "No workspace" };

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user)
        return { ok: false as const, error: "กรุณาเข้าสู่ระบบ" };

      if (userId === user.id)
        return { ok: false as const, error: "ไม่สามารถลบตัวเองออกได้ (ใช้ leave workspace)" };

      const { data: target } = await supabase
        .from("workspace_members")
        .select("role")
        .eq("workspace_id", workspaceId)
        .eq("user_id", userId)
        .single();
      if (!target)
        return { ok: false as const, error: "ไม่พบสมาชิกที่ต้องการลบ" };
      if (target.role === "owner")
        return { ok: false as const, error: "ไม่สามารถลบ owner ออกจาก workspace ได้" };

      const { data: myMember } = await supabase
        .from("workspace_members")
        .select("role")
        .eq("workspace_id", workspaceId)
        .eq("user_id", user.id)
        .single();
      const actorRole = myMember?.role as WorkspaceRole | undefined;
      if (!actorRole || !canManageMembers(actorRole))
        return { ok: false as const, error: "คุณไม่มีสิทธิ์ลบสมาชิก" };

      const { error } = await supabase
        .from("workspace_members")
        .delete()
        .eq("workspace_id", workspaceId)
        .eq("user_id", userId);
      if (error)
        return { ok: false as const, error: error.message };

      // Log activity (before removal completes in case of RLS, but here it's already deleted)
      // Actually the requirement said "Before deleting", let's move it up if needed.
      // But we need the actor's permission to insert.
      await logActivity({
        workspaceId,
        action: "removed",
        metadata: { target_user_id: userId },
      });

      await fetchMembers();
      return { ok: true as const, data: undefined };
    },
    [workspaceId, fetchMembers]
  );

  const updateRole = useCallback(
    async (userId: string, newRole: WorkspaceRole) => {
      if (!workspaceId) return { ok: false as const, error: "No workspace" };

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user)
        return { ok: false as const, error: "กรุณาเข้าสู่ระบบ" };

      if (userId === user.id)
        return { ok: false as const, error: "ไม่สามารถเปลี่ยน role ของตัวเองได้" };

      const { data: target } = await supabase
        .from("workspace_members")
        .select("role")
        .eq("workspace_id", workspaceId)
        .eq("user_id", userId)
        .single();
      if (!target)
        return { ok: false as const, error: "ไม่พบสมาชิกที่ต้องการแก้ไข" };

      const { data: myMember } = await supabase
        .from("workspace_members")
        .select("role")
        .eq("workspace_id", workspaceId)
        .eq("user_id", user.id)
        .single();
      const actorRole = myMember?.role as WorkspaceRole | undefined;
      if (!actorRole)
        return { ok: false as const, error: "คุณไม่มีสิทธิ์ใน workspace นี้" };

      if (!canChangeRole(actorRole, target.role as WorkspaceRole, newRole))
        return { ok: false as const, error: "คุณไม่มีสิทธิ์เปลี่ยน role นี้" };

      const { data, error } = await supabase
        .from("workspace_members")
        .update({ role: newRole })
        .eq("workspace_id", workspaceId)
        .eq("user_id", userId)
        .select()
        .single();
      if (error)
        return { ok: false as const, error: error.message };

      // Log activity
      await logActivity({
        workspaceId,
        action: "role_changed",
        metadata: { target_user_id: userId, role: newRole },
      });

      await fetchMembers();
      return { ok: true as const, data };
    },
    [workspaceId, fetchMembers]
  );

  return {
    members,
    currentRole,
    loading,
    errorMsg,
    refresh: fetchMembers,
    invite,
    remove,
    updateRole,
  };
}
