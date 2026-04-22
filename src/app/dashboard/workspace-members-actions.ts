"use server";

import { createServerSupabaseClient } from "@/lib/supabase-server";
import {
  inviteMember,
  removeMember,
  updateMemberRole,
} from "@/lib/workspace-members";
import type { WorkspaceRole } from "@/types/database";

export async function inviteMemberAction(
  workspaceId: string,
  email: string,
  role: WorkspaceRole
) {
  const supabase = await createServerSupabaseClient();
  return inviteMember(supabase, workspaceId, email, role);
}

export async function removeMemberAction(
  workspaceId: string,
  targetUserId: string
) {
  const supabase = await createServerSupabaseClient();
  return removeMember(supabase, workspaceId, targetUserId);
}

export async function updateMemberRoleAction(
  workspaceId: string,
  targetUserId: string,
  newRole: WorkspaceRole
) {
  const supabase = await createServerSupabaseClient();
  return updateMemberRole(supabase, workspaceId, targetUserId, newRole);
}
