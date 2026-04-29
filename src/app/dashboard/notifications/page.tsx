"use client";

import { useState } from "react";
import { useNotifications } from "@/hooks/useNotifications";
import type { NotificationItem } from "@/hooks/useNotifications";

const actionStyle: Record<string, string> = {
  task_created:
    "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400",
  task_updated:
    "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400",
  task_moved:
    "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400",
  task_assigned:
    "bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400",
  due_date_changed:
    "bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400",
  task_deleted:
    "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400",
  bulk_moved:
    "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400",
  bulk_deleted:
    "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400",
};

const actionIcon: Record<string, React.ReactNode> = {
  task_created: (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  ),
  task_updated: (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
    </svg>
  ),
  task_moved: (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
    </svg>
  ),
  task_assigned: (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
    </svg>
  ),
  due_date_changed: (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
    </svg>
  ),
  task_deleted: (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
    </svg>
  ),
  bulk_moved: (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
    </svg>
  ),
  bulk_deleted: (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
    </svg>
  ),
};

function formatDescription(item: NotificationItem): string {
  const m = item.metadata ?? {};
  const title = item.task_title ?? (m.task_title as string) ?? "a task";
  const fmt = (col: string) => (col === "Done" ? "Completed" : col);

  switch (item.action) {
    case "task_created":
      return `created "${title}"`;
    case "task_updated":
      return `updated "${title}"`;
    case "task_moved":
      return `moved "${title}" to ${fmt((m.to as string) ?? "")}`;
    case "task_assigned":
      return m.assignee_name
        ? `assigned "${title}" to ${m.assignee_name as string}`
        : `unassigned "${title}"`;
    case "due_date_changed":
      return `changed due date of "${title}"`;
    case "task_deleted":
      return `deleted "${title}"`;
    case "bulk_moved":
      return `moved ${m.count as number} task${(m.count as number) > 1 ? "s" : ""} to ${fmt((m.to as string) ?? "")}`;
    case "bulk_deleted":
      return `deleted ${m.count as number} task${(m.count as number) > 1 ? "s" : ""}`;
    default:
      return item.action;
  }
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / 1000
  );
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatDateSeparator(dateStr: string): string {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

export default function NotificationsPage() {
  const {
    notifications,
    loading,
    error,
    refresh,
    markAllAsRead,
    unreadCount,
  } = useNotifications();
  const [marking, setMarking] = useState(false);
  const [markError, setMarkError] = useState<string | null>(null);

  const handleMarkAllRead = async () => {
    setMarking(true);
    setMarkError(null);
    const ok = await markAllAsRead();
    if (!ok) {
      setMarkError("Failed to mark as read. Please try again.");
    }
    setMarking(false);
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          Notifications
        </h1>
        {!loading && notifications.length > 0 && (
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                disabled={marking}
                className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                {marking ? "Marking..." : "Mark all as read"}
              </button>
            )}
            <button
              onClick={refresh}
              className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              Refresh
            </button>
          </div>
        )}
      </div>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Activity from tasks assigned to you and your workspace.
      </p>

      {markError && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {markError}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="mt-8 flex items-center justify-center py-20">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600 dark:border-zinc-600 dark:border-t-zinc-300" />
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 dark:border-red-800 dark:bg-red-900/20">
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && notifications.length === 0 && (
        <div className="mt-8 flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-white px-6 py-16 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
            </svg>
          </div>
          <h2 className="mt-4 text-base font-semibold text-zinc-900 dark:text-zinc-100">
            No notifications yet
          </h2>
          <p className="mt-2 max-w-sm text-center text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
            When someone assigns a task to you, moves it, or changes a due date, you&apos;ll see it here.
          </p>
        </div>
      )}

      {/* Notification list */}
      {!loading && !error && notifications.length > 0 && (
        <div className="mt-6 space-y-0.5">
          {(() => {
            let lastDate = "";
            const elements: React.ReactNode[] = [];

            for (const item of notifications) {
              const dateLabel = formatDateSeparator(item.created_at);
              if (dateLabel !== lastDate) {
                lastDate = dateLabel;
                elements.push(
                  <div
                    key={`sep-${dateLabel}-${elements.length}`}
                    className="sticky top-0 z-10 bg-background py-2 text-xs font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500"
                  >
                    {dateLabel}
                  </div>
                );
              }

              const icon =
                actionIcon[item.action] ?? actionIcon.task_updated;
              const style =
                actionStyle[item.action] ?? actionStyle.task_updated;
              const actor =
                item.actor_display_name || item.actor_email || "Someone";

              elements.push(
                <a
                  key={item.id}
                  href="/dashboard/board"
                  className={`group flex items-start gap-3 rounded-xl px-3 py-3 transition-colors ${
                    item.is_read
                      ? "hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                      : "bg-blue-50/50 hover:bg-blue-50 dark:bg-blue-950/20 dark:hover:bg-blue-950/30"
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm ${style}`}
                  >
                    {icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] leading-snug text-zinc-700 dark:text-zinc-300">
                      <span className="font-medium text-zinc-900 dark:text-zinc-100">
                        {actor}
                      </span>{" "}
                      {formatDescription(item)}
                    </p>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-zinc-400 dark:text-zinc-500">
                      <span>{timeAgo(item.created_at)}</span>
                      {item.board_title && (
                        <>
                          <span className="text-zinc-300 dark:text-zinc-600">
                            &middot;
                          </span>
                          <span>{item.board_title}</span>
                        </>
                      )}
                      {!item.is_read && (
                        <>
                          <span className="text-zinc-300 dark:text-zinc-600">
                            &middot;
                          </span>
                          <span className="font-medium text-blue-600 dark:text-blue-400">
                            New
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  {!item.is_read && (
                    <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                  )}
                </a>
              );
            }

            return elements;
          })()}
        </div>
      )}
    </div>
  );
}
