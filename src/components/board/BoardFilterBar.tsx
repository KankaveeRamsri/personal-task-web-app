"use client";

import type { MemberWithProfile } from "@/hooks/useWorkspaceMembers";

export interface BoardFilterBarProps {
  members: MemberWithProfile[];
  searchQuery: string;
  filterPriority: string;
  filterAssigneeId: string;
  filterDueDate: string;
  hasActiveFilters: boolean;
  onSearchChange: (value: string) => void;
  onPriorityChange: (value: string) => void;
  onAssigneeChange: (value: string) => void;
  onDueDateChange: (value: string) => void;
  onClearFilters: () => void;
}

const selectClass =
  "rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-600 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-400 dark:focus:border-zinc-600";

export default function BoardFilterBar({
  members,
  searchQuery,
  filterPriority,
  filterAssigneeId,
  filterDueDate,
  hasActiveFilters,
  onSearchChange,
  onPriorityChange,
  onAssigneeChange,
  onDueDateChange,
  onClearFilters,
}: BoardFilterBarProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="relative flex-1 min-w-[180px] max-w-xs">
        <svg
          className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
          />
        </svg>
        <input
          type="text"
          placeholder="Search tasks..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full rounded-md border border-zinc-200 bg-white pl-8 pr-3 py-1.5 text-xs text-zinc-700 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-300 dark:placeholder:text-zinc-500 dark:focus:border-zinc-600"
        />
      </div>

      <select
        value={filterPriority}
        onChange={(e) => onPriorityChange(e.target.value)}
        className={selectClass}
      >
        <option value="all">Priority: All</option>
        <option value="low">Low</option>
        <option value="medium">Medium</option>
        <option value="high">High</option>
      </select>

      <select
        value={filterAssigneeId}
        onChange={(e) => onAssigneeChange(e.target.value)}
        className={selectClass}
      >
        <option value="all">Assignee: All</option>
        <option value="unassigned">Unassigned</option>
        {members.map((m) => (
          <option key={m.user_id} value={m.user_id}>
            {m.display_name || m.email}
          </option>
        ))}
      </select>

      <select
        value={filterDueDate}
        onChange={(e) => onDueDateChange(e.target.value)}
        className={selectClass}
      >
        <option value="all">Due: All</option>
        <option value="overdue">Overdue</option>
        <option value="today">Today</option>
        <option value="upcoming">Upcoming</option>
        <option value="no_due_date">No due date</option>
      </select>

      {hasActiveFilters && (
        <button
          onClick={onClearFilters}
          className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
        >
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
          Clear
        </button>
      )}
    </div>
  );
}
