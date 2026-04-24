"use client";

import type { Workspace, Board, WorkspaceRole } from "@/types/database";
import type { MemberWithProfile } from "@/hooks/useWorkspaceMembers";

export interface BoardToolbarProps {
  // Data
  workspaces: Workspace[];
  selectedWorkspaceId: string | null;
  boards: Board[];
  selectedBoardId: string | null;
  members: MemberWithProfile[];
  isManager: boolean;

  // Panel visibility
  showNewWorkspace: boolean;
  showNewBoard: boolean;
  showMembers: boolean;

  // Form state
  newWorkspaceName: string;
  newBoardTitle: string;
  inviteEmail: string;
  inviteRole: WorkspaceRole;
  inviting: boolean;
  confirmRemoveId: string | null;

  // Selectors
  onWorkspaceChange: (id: string) => void;
  onBoardChange: (id: string) => void;

  // Panel toggles
  onToggleNewWorkspace: () => void;
  onToggleNewBoard: () => void;
  onToggleMembers: () => void;
  onCloseMembers: () => void;

  // Form value changes
  onNewWorkspaceNameChange: (value: string) => void;
  onNewBoardTitleChange: (value: string) => void;
  onInviteEmailChange: (value: string) => void;
  onInviteRoleChange: (role: WorkspaceRole) => void;

  // Form submissions
  onCreateWorkspace: (e: React.FormEvent) => void;
  onCreateBoard: (e: React.FormEvent) => void;
  onInvite: (e: React.FormEvent) => void;

  // Cancel actions
  onCancelNewWorkspace: () => void;
  onCancelNewBoard: () => void;

  // Member actions
  onRemoveMember: (userId: string) => void;
  onRoleChange: (userId: string, role: WorkspaceRole) => void;
  onSetConfirmRemoveId: (id: string | null) => void;
}

export default function BoardToolbar({
  workspaces,
  selectedWorkspaceId,
  boards,
  selectedBoardId,
  members,
  isManager,
  showNewWorkspace,
  showNewBoard,
  showMembers,
  newWorkspaceName,
  newBoardTitle,
  inviteEmail,
  inviteRole,
  inviting,
  confirmRemoveId,
  onWorkspaceChange,
  onBoardChange,
  onToggleNewWorkspace,
  onToggleNewBoard,
  onToggleMembers,
  onCloseMembers,
  onNewWorkspaceNameChange,
  onNewBoardTitleChange,
  onInviteEmailChange,
  onInviteRoleChange,
  onCreateWorkspace,
  onCreateBoard,
  onInvite,
  onCancelNewWorkspace,
  onCancelNewBoard,
  onRemoveMember,
  onRoleChange,
  onSetConfirmRemoveId,
}: BoardToolbarProps) {
  return (
    <>
      {/* Navigation toolbar */}
      <div className="flex items-center justify-between gap-4">
        {/* Left: context selectors */}
        <div className="flex items-center gap-2">
          {workspaces.length > 0 ? (
            <select
              value={selectedWorkspaceId ?? ""}
              onChange={(e) => onWorkspaceChange(e.target.value)}
              className="rounded-lg border border-zinc-200 bg-transparent px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-600 dark:focus:ring-zinc-600"
            >
              {workspaces.map((ws) => (
                <option key={ws.id} value={ws.id}>
                  {ws.icon} {ws.name}
                </option>
              ))}
            </select>
          ) : null}
          {selectedWorkspaceId && (
            <>
              <span className="text-zinc-300 dark:text-zinc-700">/</span>
              {boards.length > 0 ? (
                <select
                  value={selectedBoardId ?? ""}
                  onChange={(e) => onBoardChange(e.target.value)}
                  className="rounded-lg border border-zinc-200 bg-transparent px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-600 dark:focus:ring-zinc-600"
                >
                  {boards.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.title}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-sm text-zinc-400">No boards</span>
              )}
            </>
          )}
        </div>
        {/* Right: actions */}
        <div className="flex items-center gap-2">
          {selectedWorkspaceId && (
            <button
              onClick={onToggleMembers}
              className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 transition-colors hover:border-zinc-300 hover:bg-zinc-50 active:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:bg-zinc-800 dark:active:bg-zinc-700 dark:focus:ring-zinc-600"
            >
              Members
            </button>
          )}
          <button
            onClick={onToggleNewWorkspace}
            className="text-sm text-zinc-400 transition-colors hover:text-zinc-600 active:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-300 dark:active:text-zinc-200"
          >
            + Workspace
          </button>
          {selectedWorkspaceId && (
            <button
              onClick={onToggleNewBoard}
              className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 active:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:active:bg-zinc-300 dark:focus:ring-zinc-600"
            >
              + Board
            </button>
          )}
        </div>
      </div>

      {/* New workspace form */}
      {showNewWorkspace && (
        <form onSubmit={onCreateWorkspace} className="flex gap-2 items-center max-w-sm">
          <input
            type="text"
            placeholder="Workspace name"
            autoFocus
            value={newWorkspaceName}
            onChange={(e) => onNewWorkspaceNameChange(e.target.value)}
            className="flex-1 rounded-lg border border-zinc-200 bg-transparent px-3 py-1.5 text-sm focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200/50 dark:focus:ring-zinc-700/50 dark:border-zinc-700 dark:focus:border-zinc-600"
          />
          <button
            type="submit"
            disabled={!newWorkspaceName.trim()}
            className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 active:bg-zinc-800 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:active:bg-zinc-300 dark:focus:ring-zinc-600"
          >
            Create
          </button>
          <button
            type="button"
            onClick={onCancelNewWorkspace}
            className="text-sm text-zinc-400 transition-colors hover:text-zinc-600 active:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-300 dark:active:text-zinc-200"
          >
            Cancel
          </button>
        </form>
      )}

      {/* Members panel */}
      {showMembers && selectedWorkspaceId && (
        <div className="rounded-xl border border-zinc-200 p-4 shadow-sm dark:border-zinc-800">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">
              Members ({members.length})
            </h3>
            <button
              onClick={onCloseMembers}
              className="text-lg leading-none text-zinc-400 transition-colors hover:text-zinc-600"
            >
              &times;
            </button>
          </div>

          {/* Member list */}
          <ul className="mb-3 space-y-2">
            {members.map((m) => (
              <li
                key={m.id}
                className="flex items-center gap-3 text-sm"
              >
                <span className="min-w-0 flex-1 truncate">
                  {m.display_name || m.email}
                </span>
                {m.role === "owner" ? (
                  <span className="shrink-0 text-xs font-medium text-amber-600 dark:text-amber-400">
                    owner
                  </span>
                ) : isManager ? (
                  <>
                    <select
                      value={m.role}
                      onChange={(e) =>
                        onRoleChange(
                          m.user_id,
                          e.target.value as WorkspaceRole
                        )
                      }
                      className="shrink-0 rounded border border-zinc-300 px-1 py-0.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                    >
                      <option value="admin">admin</option>
                      <option value="member">member</option>
                      <option value="viewer">viewer</option>
                    </select>
                    {confirmRemoveId === m.user_id ? (
                      <span className="flex shrink-0 items-center gap-1">
                        <button
                          onClick={() => onRemoveMember(m.user_id)}
                          className="text-xs font-medium text-red-600 hover:text-red-700"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => onSetConfirmRemoveId(null)}
                          className="text-xs text-zinc-400"
                        >
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <button
                        onClick={() => onSetConfirmRemoveId(m.user_id)}
                        className="shrink-0 text-xs text-zinc-400 hover:text-red-500"
                      >
                        Remove
                      </button>
                    )}
                  </>
                ) : (
                  <span className="shrink-0 text-xs text-zinc-500">
                    {m.role}
                  </span>
                )}
              </li>
            ))}
            {members.length === 0 && (
              <li className="py-2 text-xs text-zinc-400">No members</li>
            )}
          </ul>

          {/* Invite form — owner/admin only */}
          {isManager && (
            <form
              onSubmit={onInvite}
              className="flex flex-wrap items-center gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-800"
            >
              <input
                type="email"
                placeholder="Email"
                value={inviteEmail}
                onChange={(e) => onInviteEmailChange(e.target.value)}
                required
                className="min-w-[150px] flex-1 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
              <select
                value={inviteRole}
                onChange={(e) =>
                  onInviteRoleChange(e.target.value as WorkspaceRole)
                }
                className="rounded-lg border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                <option value="admin">admin</option>
                <option value="member">member</option>
                <option value="viewer">viewer</option>
              </select>
              <button
                type="submit"
                disabled={inviting || !inviteEmail.trim()}
                className="rounded-lg bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black"
              >
                {inviting ? "..." : "Invite"}
              </button>
            </form>
          )}
        </div>
      )}

      {/* New board form */}
      {showNewBoard && (
        <form onSubmit={onCreateBoard} className="flex gap-2 items-center max-w-sm">
          <input
            type="text"
            placeholder="Board title"
            autoFocus
            value={newBoardTitle}
            onChange={(e) => onNewBoardTitleChange(e.target.value)}
            className="flex-1 rounded-lg border border-zinc-200 bg-transparent px-3 py-1.5 text-sm focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200/50 dark:focus:ring-zinc-700/50 dark:border-zinc-700 dark:focus:border-zinc-600"
          />
          <button
            type="submit"
            disabled={!newBoardTitle.trim()}
            className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 active:bg-zinc-800 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:active:bg-zinc-300 dark:focus:ring-zinc-600"
          >
            Create
          </button>
          <button
            type="button"
            onClick={onCancelNewBoard}
            className="text-sm text-zinc-400 transition-colors hover:text-zinc-600 active:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-300 dark:active:text-zinc-200"
          >
            Cancel
          </button>
        </form>
      )}
    </>
  );
}
