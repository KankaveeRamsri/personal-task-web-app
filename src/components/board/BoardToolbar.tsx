"use client";

import { useState, useRef, useEffect } from "react";
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

  // Delete board
  confirmDeleteBoard: boolean;
  deletingBoard: boolean;
  onDeleteBoard: () => void;
  onSetConfirmDeleteBoard: (v: boolean) => void;

  // Delete workspace
  confirmDeleteWorkspace: boolean;
  deletingWorkspace: boolean;
  deleteWorkspaceConfirmName: string;
  onDeleteWorkspaceConfirmNameChange: (v: string) => void;
  onDeleteWorkspace: () => void;
  onSetConfirmDeleteWorkspace: (v: boolean) => void;
  selectedWorkspaceName: string;
  isOwner: boolean;
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
  confirmDeleteBoard,
  deletingBoard,
  onDeleteBoard,
  onSetConfirmDeleteBoard,
  confirmDeleteWorkspace,
  deletingWorkspace,
  deleteWorkspaceConfirmName,
  onDeleteWorkspaceConfirmNameChange,
  onDeleteWorkspace,
  onSetConfirmDeleteWorkspace,
  selectedWorkspaceName,
  isOwner,
}: BoardToolbarProps) {
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!moreMenuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setMoreMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [moreMenuOpen]);

  const hasDeleteOptions = (selectedBoardId && isManager) || (selectedWorkspaceId && isOwner);

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
              className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-900 shadow-md ring-1 ring-zinc-900/[0.08] transition-all hover:shadow-lg hover:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-white/[0.06] dark:hover:border-zinc-500 dark:focus:ring-zinc-500"
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
              <span className="text-zinc-300 dark:text-zinc-600">/</span>
              {boards.length > 0 ? (
                <select
                  value={selectedBoardId ?? ""}
                  onChange={(e) => onBoardChange(e.target.value)}
                  className="rounded-lg border border-zinc-200/60 bg-zinc-50/50 px-3 py-1.5 text-sm font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 hover:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700/30 dark:bg-zinc-800/30 dark:text-zinc-400 dark:hover:bg-zinc-700/50 dark:hover:text-zinc-300 dark:focus:ring-zinc-600"
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
              className="rounded-lg px-3 py-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-700 hover:bg-zinc-100 active:bg-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-200 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-700/60 dark:active:bg-zinc-700 dark:focus:ring-zinc-600"
            >
              Members
            </button>
          )}
          <div className="w-px h-5 bg-zinc-200 dark:bg-zinc-700/50" />
          <button
            onClick={onToggleNewWorkspace}
            className="rounded-lg bg-indigo-50/70 px-3 py-1.5 text-sm font-medium text-indigo-500 transition-colors hover:bg-indigo-100 hover:text-indigo-700 active:bg-indigo-150 dark:bg-indigo-950/20 dark:text-indigo-400/80 dark:hover:bg-indigo-900/30 dark:hover:text-indigo-300 dark:active:bg-indigo-900/50"
          >
            + Workspace
          </button>
          {selectedWorkspaceId && (
            <button
              onClick={onToggleNewBoard}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-indigo-500 hover:shadow active:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-400/50 dark:bg-indigo-500 dark:hover:bg-indigo-400 dark:active:bg-indigo-600 dark:focus:ring-indigo-400"
            >
              + Board
            </button>
          )}
          {hasDeleteOptions && (
            <div className="relative" ref={moreMenuRef}>
              <button
                onClick={() => setMoreMenuOpen((v) => !v)}
                className="flex items-center justify-center rounded-lg px-2 py-1.5 text-zinc-400 transition-colors hover:text-zinc-600 hover:bg-zinc-100 active:bg-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-200 dark:text-zinc-500 dark:hover:text-zinc-300 dark:hover:bg-zinc-800 dark:active:bg-zinc-700 dark:focus:ring-zinc-600"
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" />
                </svg>
              </button>
              {moreMenuOpen && (
                <div className="absolute right-0 top-full mt-1 w-48 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900 z-20">
                  {selectedBoardId && isManager && (
                    <button
                      onClick={() => { setMoreMenuOpen(false); onSetConfirmDeleteBoard(true); }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
                    >
                      Delete Board
                    </button>
                  )}
                  {selectedBoardId && isManager && isOwner && (
                    <div className="my-1 border-t border-zinc-100 dark:border-zinc-800" />
                  )}
                  {selectedWorkspaceId && isOwner && (
                    <button
                      onClick={() => { setMoreMenuOpen(false); onSetConfirmDeleteWorkspace(true); }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
                    >
                      Delete Workspace
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Delete board confirmation (inline) */}
      {confirmDeleteBoard && selectedBoardId && (
        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50/50 px-4 py-2.5 dark:border-red-900 dark:bg-red-950/30">
          <span className="text-sm text-red-700 dark:text-red-400">Delete this board and all its tasks?</span>
          <button
            onClick={onDeleteBoard}
            disabled={deletingBoard}
            className="rounded-lg bg-red-600 px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-red-700 active:bg-red-800 disabled:opacity-50"
          >
            {deletingBoard ? "..." : "Delete"}
          </button>
          <button
            onClick={() => onSetConfirmDeleteBoard(false)}
            className="text-sm text-zinc-500 transition-colors hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
          >
            Cancel
          </button>
        </div>
      )}

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

      {/* Delete workspace confirmation */}
      {confirmDeleteWorkspace && selectedWorkspaceId && (
        <div className="rounded-xl border border-red-200 bg-red-50/50 p-4 shadow-sm dark:border-red-900 dark:bg-red-950/30">
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-red-700 dark:text-red-400">
              Delete &quot;{selectedWorkspaceName}&quot;?
            </h3>
            <p className="mt-1 text-xs text-red-600/80 dark:text-red-400/70">
              This will permanently delete all boards and tasks in this workspace. This action cannot be undone.
            </p>
          </div>
          <div className="flex flex-col gap-3 max-w-sm">
            <input
              type="text"
              placeholder={`Type "${selectedWorkspaceName}" to confirm`}
              autoFocus
              value={deleteWorkspaceConfirmName}
              onChange={(e) => onDeleteWorkspaceConfirmNameChange(e.target.value)}
              className="w-full rounded-lg border border-red-300 bg-transparent px-3 py-1.5 text-sm placeholder:text-red-300 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200/50 dark:border-red-800 dark:placeholder:text-red-700 dark:focus:ring-red-900/50 dark:focus:border-red-700"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={onDeleteWorkspace}
                disabled={deletingWorkspace || deleteWorkspaceConfirmName !== selectedWorkspaceName}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-700 active:bg-red-800 disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-red-200"
              >
                {deletingWorkspace ? "Deleting..." : "Delete Workspace"}
              </button>
              <button
                onClick={() => onSetConfirmDeleteWorkspace(false)}
                className="rounded-lg px-3 py-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
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
