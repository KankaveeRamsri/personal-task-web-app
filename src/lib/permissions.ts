import type { WorkspaceRole } from "@/types/database";

// ── Role hierarchy ─────────────────────────────────────────
const ROLE_RANK: Record<WorkspaceRole, number> = {
  owner: 4,
  admin: 3,
  member: 2,
  viewer: 1,
};

const EDIT_ROLES: WorkspaceRole[] = ["owner", "admin", "member"];
const MANAGE_ROLES: WorkspaceRole[] = ["owner", "admin"];

// ── Generic helpers ────────────────────────────────────────
function hasRole(role: WorkspaceRole, list: WorkspaceRole[]): boolean {
  return list.includes(role);
}

function rankOf(role: WorkspaceRole): number {
  return ROLE_RANK[role];
}

// ── Permission functions ───────────────────────────────────

/** Can view boards, lists, and tasks */
export function canViewWorkspace(role: WorkspaceRole): boolean {
  return true; // all roles can view
}

/** Can create/edit tasks and lists */
export function canEditTasks(role: WorkspaceRole): boolean {
  return hasRole(role, EDIT_ROLES);
}

/** Can add or remove members */
export function canManageMembers(role: WorkspaceRole): boolean {
  return hasRole(role, MANAGE_ROLES);
}

/** Can delete the workspace */
export function canDeleteWorkspace(role: WorkspaceRole): boolean {
  return role === "owner";
}

/** Can invite new members (admin+, but never as owner) */
export function canInviteMembers(role: WorkspaceRole): boolean {
  return hasRole(role, MANAGE_ROLES);
}

/**
 * Can change a member's role.
 *
 * Rules:
 *  - Cannot change the owner's role.
 *  - Cannot invite anyone as owner.
 *  - Actor must outrank the target's new role.
 */
export function canChangeRole(
  actorRole: WorkspaceRole,
  targetCurrentRole: WorkspaceRole,
  newRole: WorkspaceRole
): boolean {
  // RULE 1: ห้ามเปลี่ยน role ของ owner ปัจจุบัน
  if (targetCurrentRole === "owner") return false;

  // RULE 2: ห้ามตั้งใครเป็น owner ใหม่ (owner transfer เป็น feature แยก)
  if (newRole === "owner") return false;

  // Actor must be admin+ and outrank the new role
  if (!hasRole(actorRole, MANAGE_ROLES)) return false;

  return rankOf(actorRole) > rankOf(newRole);
}

/** Shorthand: is this the owner role? */
export function isOwner(role: WorkspaceRole): boolean {
  return role === "owner";
}
