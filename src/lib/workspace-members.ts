import type { SupabaseClient } from "@supabase/supabase-js";
import type { WorkspaceRole, WorkspaceMember } from "@/types/database";
import {
  canInviteMembers,
  canManageMembers,
  canChangeRole,
} from "@/lib/permissions";

// ── Result type ────────────────────────────────────────────
type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

// ── Internal: get actor's role in workspace ────────────────
async function getActorRole(
  supabase: SupabaseClient,
  workspaceId: string,
  userId: string
): Promise<WorkspaceRole | null> {
  const { data } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .single();
  return (data?.role as WorkspaceRole) ?? null;
}

// ── Invite member by email ─────────────────────────────────
export async function inviteMember(
  supabase: SupabaseClient,
  workspaceId: string,
  email: string,
  role: WorkspaceRole = "member"
): Promise<Result<WorkspaceMember>> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "กรุณาเข้าสู่ระบบ" };

  // 1. ตรวจสอบสิทธิ์ผู้เชิญก่อน
  const actorRole = await getActorRole(supabase, workspaceId, user.id);
  if (!actorRole || !canInviteMembers(actorRole))
    return { ok: false, error: "คุณไม่มีสิทธิ์เชิญสมาชิก" };

  // 2. ห้ามเชิญด้วย role = owner
  if (role === "owner")
    return { ok: false, error: "ไม่สามารถเชิญในฐานะ owner ได้" };

  // 3. หา target user จาก email
  const { data: targetProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .single();

  if (!targetProfile)
    return { ok: false, error: "ไม่พบผู้ใช้ที่ใช้อีเมลนี้" };

  // 4. ห้ามเชิญตัวเอง (เปรียบเทียบ user id โดยตรง)
  if (targetProfile.id === user.id)
    return { ok: false, error: "ไม่สามารถเชิญตัวเองได้" };

  // 5. ตรวจสอบว่ายังไม่เป็นสมาชิก
  const { data: existing } = await supabase
    .from("workspace_members")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", targetProfile.id)
    .maybeSingle();

  if (existing)
    return { ok: false, error: "ผู้ใช้นี้เป็นสมาชิกอยู่แล้ว" };

  // 6. เพิ่มสมาชิก
  const { data, error } = await supabase
    .from("workspace_members")
    .insert({ workspace_id: workspaceId, user_id: targetProfile.id, role })
    .select()
    .single();

  if (error) return { ok: false, error: error.message };

  return { ok: true, data: data as WorkspaceMember };
}

// ── Remove member ──────────────────────────────────────────
export async function removeMember(
  supabase: SupabaseClient,
  workspaceId: string,
  targetUserId: string
): Promise<Result<void>> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "กรุณาเข้าสู่ระบบ" };

  // ห้ามลบตัวเอง
  if (targetUserId === user.id)
    return { ok: false, error: "ไม่สามารถลบตัวเองออกได้ (ใช้ leave workspace)" };

  // ตรวจสอบ role ของคนถูกลบ
  const { data: target } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", targetUserId)
    .single();

  if (!target) return { ok: false, error: "ไม่พบสมาชิกที่ต้องการลบ" };

  // ห้ามลบ owner
  if (target.role === "owner")
    return { ok: false, error: "ไม่สามารถลบ owner ออกจาก workspace ได้" };

  // ตรวจสอบสิทธิ์ผู้ลบ
  const actorRole = await getActorRole(supabase, workspaceId, user.id);
  if (!actorRole || !canManageMembers(actorRole))
    return { ok: false, error: "คุณไม่มีสิทธิ์ลบสมาชิก" };

  const { error } = await supabase
    .from("workspace_members")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("user_id", targetUserId);

  if (error) return { ok: false, error: error.message };

  return { ok: true, data: undefined };
}

// ── Update member role ─────────────────────────────────────
export async function updateMemberRole(
  supabase: SupabaseClient,
  workspaceId: string,
  targetUserId: string,
  newRole: WorkspaceRole
): Promise<Result<WorkspaceMember>> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "กรุณาเข้าสู่ระบบ" };

  // ห้ามเปลี่ยน role ตัวเอง
  if (targetUserId === user.id)
    return { ok: false, error: "ไม่สามารถเปลี่ยน role ของตัวเองได้" };

  // ดึง role ปัจจุบันของ target
  const { data: target } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", targetUserId)
    .single();

  if (!target) return { ok: false, error: "ไม่พบสมาชิกที่ต้องการแก้ไข" };

  // ตรวจสอบสิทธิ์ + กฎ owner
  const actorRole = await getActorRole(supabase, workspaceId, user.id);
  if (!actorRole) return { ok: false, error: "คุณไม่มีสิทธิ์ใน workspace นี้" };

  if (!canChangeRole(actorRole, target.role as WorkspaceRole, newRole))
    return { ok: false, error: "คุณไม่มีสิทธิ์เปลี่ยน role นี้" };

  const { data, error } = await supabase
    .from("workspace_members")
    .update({ role: newRole })
    .eq("workspace_id", workspaceId)
    .eq("user_id", targetUserId)
    .select()
    .single();

  if (error) return { ok: false, error: error.message };

  return { ok: true, data: data as WorkspaceMember };
}
