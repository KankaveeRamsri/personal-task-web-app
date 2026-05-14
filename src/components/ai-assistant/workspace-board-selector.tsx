"use client";

import type { Workspace, Board } from "@/types/database";

interface WorkspaceBoardSelectorProps {
  workspaces: Workspace[];
  selectedWorkspaceId: string | null;
  onWorkspaceChange: (id: string) => void;
  boards: Board[];
  selectedBoardId: string | null;
  onBoardChange: (id: string) => void;
  isLoading: boolean;
}

const SELECT_CLASS =
  "min-w-0 flex-1 rounded-lg border border-zinc-200 dark:border-zinc-700/60 " +
  "bg-white dark:bg-zinc-800/60 px-2 py-1 text-xs font-medium " +
  "text-zinc-700 dark:text-zinc-300 cursor-pointer focus:outline-none " +
  "focus:border-blue-400 dark:focus:border-blue-500/60 " +
  "disabled:opacity-50 disabled:cursor-not-allowed transition-colors";

export function WorkspaceBoardSelector({
  workspaces,
  selectedWorkspaceId,
  onWorkspaceChange,
  boards,
  selectedBoardId,
  onBoardChange,
  isLoading,
}: WorkspaceBoardSelectorProps) {
  return (
    <div className="flex items-center gap-1.5 min-w-0 flex-1">
      {/* Workspace select */}
      <select
        value={selectedWorkspaceId ?? ""}
        onChange={(e) => {
          if (e.target.value) onWorkspaceChange(e.target.value);
        }}
        disabled={isLoading || workspaces.length === 0}
        aria-label="Select workspace"
        className={SELECT_CLASS}
      >
        {workspaces.length === 0 ? (
          <option value="">No workspaces</option>
        ) : (
          workspaces.map((ws) => (
            <option key={ws.id} value={ws.id}>
              {ws.name}
            </option>
          ))
        )}
      </select>

      <span className="shrink-0 select-none text-xs text-zinc-300 dark:text-zinc-600">
        /
      </span>

      {/* Board select */}
      <select
        value={selectedBoardId ?? ""}
        onChange={(e) => {
          if (e.target.value) onBoardChange(e.target.value);
        }}
        disabled={isLoading || !selectedWorkspaceId || boards.length === 0}
        aria-label="Select board"
        className={SELECT_CLASS}
      >
        {!selectedWorkspaceId ? (
          <option value="">Select workspace first</option>
        ) : boards.length === 0 ? (
          <option value="">No boards</option>
        ) : (
          boards.map((b) => (
            <option key={b.id} value={b.id}>
              {b.title}
            </option>
          ))
        )}
      </select>

      {/* Loading spinner */}
      {isLoading && (
        <span
          className="shrink-0 h-3.5 w-3.5 animate-spin rounded-full border border-zinc-200 dark:border-zinc-700 border-t-blue-500 dark:border-t-blue-400"
          aria-label="Loading"
        />
      )}
    </div>
  );
}
