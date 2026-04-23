"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";

// ── Static mock data for visual layout ──────────────────────────

const statCards = [
  {
    label: "Total Tasks",
    value: "24",
    change: "+3 this week",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15a2.25 2.25 0 0 1 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />
      </svg>
    ),
  },
  {
    label: "In Progress",
    value: "8",
    change: "2 due today",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.992 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
      </svg>
    ),
  },
  {
    label: "Completed",
    value: "12",
    change: "50% rate",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    ),
  },
  {
    label: "Boards",
    value: "3",
    change: "2 workspaces",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
      </svg>
    ),
  },
];

const recentTasks = [
  { title: "Design landing page hero section", priority: "high", status: "In Progress", board: "Marketing" },
  { title: "Fix authentication redirect loop", priority: "high", status: "To Do", board: "Engineering" },
  { title: "Write API documentation", priority: "medium", status: "In Progress", board: "Engineering" },
  { title: "Update onboarding flow copy", priority: "low", status: "Done", board: "Product" },
  { title: "Review pull request #42", priority: "medium", status: "To Do", board: "Engineering" },
];

const progressItems = [
  { label: "To Do", count: 4, total: 24, color: "bg-zinc-400" },
  { label: "In Progress", count: 8, total: 24, color: "bg-amber-500" },
  { label: "Done", count: 12, total: 24, color: "bg-emerald-500" },
];

// ── Helpers ──────────────────────────────────────────────────────

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function formatDate() {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function priorityBadge(priority: string) {
  const styles: Record<string, string> = {
    high: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
    medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
    low: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  };
  return styles[priority] ?? "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400";
}

function statusDot(status: string) {
  const styles: Record<string, string> = {
    "To Do": "bg-zinc-400",
    "In Progress": "bg-amber-500",
    "Done": "bg-emerald-500",
  };
  return styles[status] ?? "bg-zinc-300";
}

// ── Dashboard Page ───────────────────────────────────────────────

export default function DashboardPage() {
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUserEmail(data.user.email ?? "");
        setUserName(
          data.user.user_metadata?.full_name ||
          data.user.email?.split("@")[0] ||
          ""
        );
      }
    });
  }, []);

  const displayName = userName || userEmail.split("@")[0] || "there";

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* ── A. Welcome Section ──────────────────────────────── */}
      <section className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            {getGreeting()}, {displayName}
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {formatDate()} &middot; Here&apos;s an overview of your workspace
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-1.5">
          {/* Static member avatars for visual context */}
          {["bg-violet-500", "bg-sky-500", "bg-emerald-500"].map((bg, i) => (
            <div
              key={i}
              className={`flex h-8 w-8 items-center justify-center rounded-full ${bg} text-[11px] font-semibold text-white ring-2 ring-white dark:ring-zinc-950 ${i > 0 ? "-ml-2" : ""}`}
            >
              {["A", "B", "C"][i]}
            </div>
          ))}
        </div>
      </section>

      {/* ── B. Summary Cards ────────────────────────────────── */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="flex items-center justify-between">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                {card.icon}
              </span>
            </div>
            <p className="mt-3 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              {card.value}
            </p>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                {card.label}
              </span>
              <span className="text-xs text-zinc-400 dark:text-zinc-500">
                {card.change}
              </span>
            </div>
          </div>
        ))}
      </section>

      {/* ── C. Main Content — 2 columns ─────────────────────── */}
      <section className="grid gap-6 lg:grid-cols-5">
        {/* Left: Recent Tasks (3/5 width) */}
        <div className="lg:col-span-3 rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Recent Tasks
            </h2>
            <span className="text-xs text-zinc-400 dark:text-zinc-500">
              {recentTasks.length} tasks
            </span>
          </div>
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {recentTasks.map((task, i) => (
              <li
                key={i}
                className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
              >
                <span className={`h-2 w-2 shrink-0 rounded-full ${statusDot(task.status)}`} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-200">
                    {task.title}
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">
                    {task.board} &middot; {task.status}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${priorityBadge(task.priority)}`}
                >
                  {task.priority}
                </span>
              </li>
            ))}
          </ul>
          <div className="border-t border-zinc-100 px-5 py-3 dark:border-zinc-800">
            <a
              href="/dashboard/board"
              className="text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              View all tasks &rarr;
            </a>
          </div>
        </div>

        {/* Right: Task Status / Progress (2/5 width) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Progress panel */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
              Task Status
            </h2>
            <div className="space-y-4">
              {progressItems.map((item) => {
                const pct = Math.round((item.count / item.total) * 100);
                return (
                  <div key={item.label}>
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <span className="font-medium text-zinc-700 dark:text-zinc-300">
                        {item.label}
                      </span>
                      <span className="text-xs text-zinc-400 dark:text-zinc-500">
                        {item.count} / {item.total}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-800">
                      <div
                        className={`h-2 rounded-full ${item.color} transition-all`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick actions */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
              Quick Actions
            </h2>
            <div className="space-y-2">
              <a
                href="/dashboard/board"
                className="flex items-center gap-2.5 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                New Task
              </a>
              <a
                href="/dashboard/board"
                className="flex items-center gap-2.5 rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 hover:border-zinc-300 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:border-zinc-600"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
                </svg>
                Open Board
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
