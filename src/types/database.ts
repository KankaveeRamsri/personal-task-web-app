export type WorkspaceRole = "owner" | "admin" | "member" | "viewer";
export type TaskPriority = "none" | "low" | "medium" | "high";

export type Workspace = {
  id: string;
  name: string;
  description: string;
  icon: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
};

export type WorkspaceMember = {
  id: string;
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  joined_at: string;
};

export type Board = {
  id: string;
  workspace_id: string;
  title: string;
  description: string;
  position: number;
  is_closed: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type List = {
  id: string;
  board_id: string;
  title: string;
  position: number;
  color: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
};

export type Task = {
  id: string;
  list_id: string;
  title: string;
  description: string;
  position: number;
  is_completed: boolean;
  priority: TaskPriority;
  due_date: string | null;
  assignee_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

// Helpers for permission checks on the frontend
export function canEdit(role: WorkspaceRole): boolean {
  return role === "owner" || role === "admin" || role === "member";
}

export function canManage(role: WorkspaceRole): boolean {
  return role === "owner" || role === "admin";
}

export function isOwner(role: WorkspaceRole): boolean {
  return role === "owner";
}
