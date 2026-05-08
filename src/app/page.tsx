import Link from "next/link";

// ─── Realistic Product Preview Components ────────────────────────────────────
// These render actual Nexdo UI patterns — not mockups, not screenshots.

function AIInsightsPreview() {
  const insights = [
    { type: "alert",   text: "3 tasks overdue >3 days — action required" },
    { type: "warning", text: '"Review" list has 6 pending — possible bottleneck' },
    { type: "info",    text: "45% of active tasks have no assignee — consider delegating" },
    { type: "success", text: "Completion rate 73% — workspace health is strong" },
  ];
  const cls: Record<string, string> = {
    alert:   "border-red-100 bg-red-50/60 text-red-700 dark:border-red-900/30 dark:bg-red-950/20 dark:text-red-400",
    warning: "border-amber-100 bg-amber-50/60 text-amber-700 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-400",
    info:    "border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-400",
    success: "border-emerald-100 bg-emerald-50/60 text-emerald-700 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-400",
  };
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center gap-2 mb-3">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-zinc-900 dark:bg-zinc-100">
          <svg className="h-3 w-3 text-white dark:text-zinc-900" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
          </svg>
        </span>
        <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Nexdo AI</span>
        <span className="text-[10px] text-zinc-400 dark:text-zinc-500">Workspace Insights</span>
      </div>
      <div className="grid grid-cols-1 gap-2">
        {insights.map((insight, i) => (
          <div key={i} className={`rounded-xl border px-3 py-2 text-xs leading-relaxed ${cls[insight.type]}`}>
            {insight.text}
          </div>
        ))}
      </div>
    </div>
  );
}

function FocusTodayPreview() {
  const tasks = [
    {
      title: "Design system review",
      list: "In Progress",
      date: "Mar 15",
      reason: "Overdue 3 days · high priority",
      border: "border-red-100 dark:border-red-900/20",
      reasonColor: "text-red-400/80 dark:text-red-400/70",
    },
    {
      title: "Q2 roadmap planning",
      list: "To Do",
      date: "Today",
      reason: "high priority · due today",
      border: "border-orange-100 dark:border-orange-900/20",
      reasonColor: "text-orange-400/80 dark:text-orange-400/70",
    },
    {
      title: "API documentation",
      list: "In Progress",
      date: "Today",
      reason: "medium priority",
      border: "border-orange-100 dark:border-orange-900/20",
      reasonColor: "text-orange-400/60 dark:text-orange-400/50",
    },
  ];
  return (
    <div className="rounded-2xl border border-amber-200/80 bg-amber-50/40 p-4 shadow-sm dark:border-amber-900/40 dark:bg-amber-950/15">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm">🔥</span>
          <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Focus Today</span>
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">3 tasks</span>
        </div>
      </div>
      <div className="mb-3">
        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-1">
          <span>Progress</span>
          <span>1 / 3 completed</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-zinc-100 dark:bg-zinc-800">
          <div className="h-1.5 w-1/3 rounded-full bg-zinc-900 dark:bg-zinc-100 transition-all" />
        </div>
      </div>
      <div className="space-y-2">
        {tasks.map((task, i) => (
          <div key={i} className={`flex items-start justify-between rounded-lg border bg-white p-2.5 shadow-sm dark:bg-zinc-900 ${task.border}`}>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-zinc-800 dark:text-zinc-200">{task.title}</p>
              <p className="text-[10px] text-zinc-400 mt-0.5">{task.list} · {task.date}</p>
              <p className={`text-[10px] mt-0.5 font-medium ${task.reasonColor}`}>{task.reason}</p>
            </div>
            <svg className="h-3.5 w-3.5 shrink-0 mt-0.5 text-zinc-300" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </div>
        ))}
      </div>
    </div>
  );
}

function WorkloadPreview() {
  const members = [
    { name: "Alex",       initials: "A", count: 5, pct: 62, heavy: true,  barColor: "bg-violet-400", avatarCls: "bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400" },
    { name: "Sarah",      initials: "S", count: 2, pct: 25, heavy: false, barColor: "bg-sky-400",    avatarCls: "bg-sky-100 text-sky-600 dark:bg-sky-900/40 dark:text-sky-400" },
    { name: "Unassigned", initials: "?", count: 1, pct: 13, heavy: false, barColor: "bg-zinc-200 dark:bg-zinc-700", avatarCls: "bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500" },
  ];
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 px-4 py-3">
        <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Team Workload</span>
        <span className="text-[10px] text-zinc-400 dark:text-zinc-500">8 tasks total</span>
      </div>
      <div className="px-4 py-3 space-y-3">
        {members.map((m) => (
          <div key={m.name} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 min-w-0">
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${m.avatarCls}`}>{m.initials}</span>
                <span className="text-xs text-zinc-700 dark:text-zinc-300 truncate">{m.name}</span>
                {m.heavy && (
                  <span className="shrink-0 rounded-full bg-amber-50 px-1.5 py-px text-[9px] font-semibold text-amber-600 dark:bg-amber-900/20 dark:text-amber-400">heavy</span>
                )}
              </span>
              <span className="text-[11px] tabular-nums text-zinc-400 dark:text-zinc-500 shrink-0 ml-2">{m.count} · {m.pct}%</span>
            </div>
            <div className="h-1 rounded-full bg-zinc-100 dark:bg-zinc-800">
              <div className={`h-1 rounded-full transition-all ${m.barColor}`} style={{ width: `${m.pct}%` }} />
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-zinc-100 dark:border-zinc-800 px-4 py-2.5">
        <p className="flex items-center gap-1.5 text-[11px] text-amber-600/80 dark:text-amber-500/70">
          <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded bg-zinc-100 dark:bg-zinc-800">
            <svg className="h-2 w-2 text-zinc-400 dark:text-zinc-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
            </svg>
          </span>
          Alex has a heavier workload than others
        </p>
      </div>
    </div>
  );
}

// ─── Main Landing Page ────────────────────────────────────────────────────────

export default function Home() {
  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col overflow-x-hidden">

      {/* ── Navigation ─────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b border-zinc-100/80 bg-white/90 backdrop-blur-md dark:border-zinc-900 dark:bg-zinc-950/90">
        <div className="flex items-center justify-between px-6 py-3.5 max-w-7xl mx-auto w-full">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-900 dark:bg-zinc-100 shadow-sm">
              <svg className="h-4 w-4 text-white dark:text-zinc-900" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
              </svg>
            </div>
            <span className="text-base font-bold tracking-tight">Nexdo</span>
          </div>
          <div className="flex items-center gap-1">
            <Link
              href="/auth/sign-in"
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100"
            >
              Sign in
            </Link>
            <Link
              href="/auth/sign-up"
              className="rounded-lg bg-zinc-900 px-3.5 py-1.5 text-sm font-semibold text-white transition-all hover:bg-zinc-800 active:scale-95 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <header className="relative flex flex-col items-center justify-center text-center px-6 pt-24 pb-20 max-w-5xl mx-auto w-full">
        {/* Subtle background grid */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.025] dark:opacity-[0.04]"
          style={{
            backgroundImage: "radial-gradient(circle, #000 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />

        {/* Badge */}
        <div
          className="land-fade relative inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3.5 py-1.5 text-xs font-medium text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 mb-8 shadow-sm"
          style={{ animationDelay: "0.05s" }}
        >
          <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
          AI-native workspace
          <span className="ml-1 rounded-full bg-zinc-900 px-1.5 py-px text-[9px] font-bold text-white dark:bg-zinc-100 dark:text-zinc-900">Phase 2</span>
        </div>

        {/* Headline */}
        <h1
          className="land-fade relative text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.05] mb-6 text-zinc-900 dark:text-zinc-50"
          style={{ animationDelay: "0.12s" }}
        >
          Work smarter.
          <br />
          <span className="text-zinc-400 dark:text-zinc-500">Nexdo thinks with you.</span>
        </h1>

        {/* Subheadline */}
        <p
          className="land-fade relative text-lg sm:text-xl text-zinc-500 dark:text-zinc-400 leading-relaxed max-w-2xl mb-10"
          style={{ animationDelay: "0.2s" }}
        >
          An intelligent workspace that understands your tasks, surfaces what matters most,
          and helps your team execute — before things slip.
        </p>

        {/* CTAs */}
        <div
          className="land-fade relative flex flex-col sm:flex-row items-center gap-3"
          style={{ animationDelay: "0.28s" }}
        >
          <Link
            href="/auth/sign-up"
            className="w-full sm:w-auto rounded-xl bg-zinc-900 px-7 py-3.5 text-base font-bold text-white shadow-lg shadow-zinc-900/15 transition-all hover:bg-zinc-800 hover:scale-[1.02] active:scale-[0.98] dark:bg-zinc-100 dark:text-zinc-900 dark:shadow-none dark:hover:bg-zinc-200"
          >
            Start for free
          </Link>
          <Link
            href="/auth/sign-in"
            className="w-full sm:w-auto rounded-xl border border-zinc-200 bg-white px-7 py-3.5 text-base font-bold text-zinc-700 transition-all hover:bg-zinc-50 hover:border-zinc-300 dark:border-zinc-800 dark:bg-transparent dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Sign in →
          </Link>
        </div>

        {/* Social proof hint */}
        <p
          className="land-fade relative mt-8 text-xs text-zinc-400 dark:text-zinc-600"
          style={{ animationDelay: "0.36s" }}
        >
          No credit card required &middot; Free to start &middot; AI-powered from day one
        </p>
      </header>

      {/* ── Product Intelligence Showcase ─────────────────────────────── */}
      <section className="px-4 sm:px-6 pb-24 max-w-7xl mx-auto w-full">
        {/* Label */}
        <div className="text-center mb-10 land-fade" style={{ animationDelay: "0.4s" }}>
          <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-3">
            Intelligent by design
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 mb-3">
            AI embedded in every part of your workflow
          </h2>
          <p className="text-base text-zinc-500 dark:text-zinc-400 max-w-xl mx-auto leading-relaxed">
            Nexdo analyzes your workspace in real-time — surfacing risk, reasoning about priorities,
            and keeping your team executing without the noise.
          </p>
        </div>

        {/* Product preview container */}
        <div
          className="land-scale rounded-3xl border border-zinc-900/10 bg-zinc-950 p-5 sm:p-7 shadow-2xl dark:border-zinc-800"
          style={{ animationDelay: "0.48s" }}
        >
          {/* Mini nav bar for realism */}
          <div className="flex items-center gap-1.5 mb-5 opacity-40">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            <span className="ml-3 h-4 flex-1 max-w-48 rounded-full bg-zinc-800" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="land-fade" style={{ animationDelay: "0.52s" }}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 dark:text-zinc-500 mb-2 px-0.5">
                Workspace Insights
              </p>
              <AIInsightsPreview />
            </div>
            <div className="land-fade" style={{ animationDelay: "0.58s" }}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 dark:text-zinc-500 mb-2 px-0.5">
                Smart Focus Today
              </p>
              <FocusTodayPreview />
            </div>
            <div className="land-fade" style={{ animationDelay: "0.64s" }}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 dark:text-zinc-500 mb-2 px-0.5">
                Workload Intelligence
              </p>
              <WorkloadPreview />
            </div>
          </div>
        </div>
      </section>

      {/* ── Core Features ──────────────────────────────────────────────── */}
      <section className="bg-zinc-50/60 dark:bg-zinc-900/30 border-y border-zinc-100 dark:border-zinc-800/60 px-6 py-24">
        <div className="max-w-7xl mx-auto w-full">
          <div className="text-center mb-14">
            <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-3">Core capabilities</p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 mb-3">
              Everything your team needs, made intelligent
            </h2>
            <p className="text-base text-zinc-500 dark:text-zinc-400 max-w-xl mx-auto">
              Nexdo is built with AI at the core — not as a feature added on top, but woven into how you work.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              {
                icon: (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                  </svg>
                ),
                label: "Smart Prioritization",
                desc: "AI ranks your tasks by urgency, risk, and execution priority — with reasoning you can understand.",
                accent: "bg-violet-50 text-violet-600 dark:bg-violet-900/20 dark:text-violet-400",
              },
              {
                icon: (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 7.125C2.25 6.504 2.754 6 3.375 6h6c.621 0 1.125.504 1.125 1.125v3.75c0 .621-.504 1.125-1.125 1.125h-6a1.125 1.125 0 0 1-1.125-1.125v-3.75ZM14.25 8.625c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v8.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 0 1-1.125-1.125v-8.25ZM3.75 16.125c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v2.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 0 1-1.125-1.125v-2.25Z" />
                  </svg>
                ),
                label: "Workspace Intelligence",
                desc: "Real-time board health analysis, bottleneck detection, overdue risk signals, and workload balance insights.",
                accent: "bg-sky-50 text-sky-600 dark:bg-sky-900/20 dark:text-sky-400",
              },
              {
                icon: (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
                  </svg>
                ),
                label: "AI Execution Assistant",
                desc: "Ask Nexdo to create, update, and move tasks in natural language. It understands intent and confirms before acting.",
                accent: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400",
              },
              {
                icon: (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                  </svg>
                ),
                label: "Context-Aware Search",
                desc: "Semantic retrieval finds what you mean, not just what you typed. Your full task history, instantly accessible.",
                accent: "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400",
              },
            ].map((f, i) => (
              <div
                key={f.label}
                className="group rounded-2xl border border-zinc-200/80 bg-white p-6 transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/60"
              >
                <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl ${f.accent}`}>
                  {f.icon}
                </div>
                <h3 className="text-sm font-bold mb-2 text-zinc-900 dark:text-zinc-100">{f.label}</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How Nexdo AI Works ─────────────────────────────────────────── */}
      <section className="px-6 py-24 max-w-7xl mx-auto w-full">
        <div className="text-center mb-14">
          <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-3">How it works</p>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 mb-3">
            Intelligence that fits your workflow
          </h2>
          <p className="text-base text-zinc-500 dark:text-zinc-400 max-w-lg mx-auto">
            Nexdo stays out of your way — and steps in exactly when it matters.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 max-w-4xl mx-auto">
          {[
            {
              step: "01",
              title: "Organize your workspace",
              desc: "Create boards, lists, and tasks. Assign owners, set priorities, and add due dates. Nexdo adapts to how you already work.",
              icon: (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
                </svg>
              ),
            },
            {
              step: "02",
              title: "AI reads the room",
              desc: "Nexdo continuously analyzes deadlines, workload distribution, task patterns, and priority signals across your workspace.",
              icon: (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                </svg>
              ),
            },
            {
              step: "03",
              title: "Execute with clarity",
              desc: "Get proactive recommendations in your dashboard, smart focus lists with reasoning, and an AI assistant ready to act when asked.",
              icon: (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
                </svg>
              ),
            },
          ].map((step, i) => (
            <div key={step.step} className="flex flex-col items-center text-center sm:items-start sm:text-left">
              <div className="flex items-center gap-3 mb-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100">
                  {step.icon}
                </span>
                <span className="text-xs font-bold text-zinc-300 dark:text-zinc-600 tabular-nums">{step.step}</span>
              </div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 mb-2">{step.title}</h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Technical Credibility ──────────────────────────────────────── */}
      <section className="bg-zinc-950 dark:bg-black border-y border-zinc-800 px-6 py-16">
        <div className="max-w-5xl mx-auto w-full text-center">
          <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-500 mb-3">Under the hood</p>
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
            Built with genuine depth
          </h2>
          <p className="text-sm text-zinc-400 max-w-md mx-auto mb-10 leading-relaxed">
            Real AI infrastructure — not a thin wrapper. Nexdo combines multiple intelligence layers
            to give you insights that are accurate, fast, and actionable.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2.5">
            {[
              "Hybrid semantic ranking",
              "RAG-powered retrieval",
              "Rule-based + LLM insights",
              "Action confirmation safety",
              "Real-time board analysis",
              "Context-aware reasoning",
            ].map((cap) => (
              <span
                key={cap}
                className="rounded-full border border-zinc-700 bg-zinc-900 px-4 py-2 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-600 hover:text-white"
              >
                {cap}
              </span>
            ))}
          </div>

          {/* Mini architecture visual */}
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto text-left">
            {[
              {
                icon: "⚡",
                title: "Instant insights",
                desc: "Rule-based analysis runs client-side in real-time. No API call delay, zero latency.",
              },
              {
                icon: "🧠",
                title: "LLM understanding",
                desc: "When you need it, Nexdo calls a language model with full workspace context for deeper reasoning.",
              },
              {
                icon: "🔍",
                title: "Semantic memory",
                desc: "Embedding-based RAG retrieves the most relevant tasks from your history using hybrid ranking.",
              },
            ].map((item) => (
              <div key={item.title} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
                <p className="text-base mb-2">{item.icon}</p>
                <p className="text-sm font-semibold text-zinc-200 mb-1">{item.title}</p>
                <p className="text-xs text-zinc-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Also Available ─────────────────────────────────────────────── */}
      <section className="px-6 py-20 max-w-7xl mx-auto w-full">
        <div className="text-center mb-12">
          <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-3">Full workspace suite</p>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 mb-3">
            Everything you need in one place
          </h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
          {[
            {
              icon: (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
                </svg>
              ),
              label: "Kanban Boards",
              desc: "Visual workflows with drag-and-drop",
            },
            {
              icon: (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
                </svg>
              ),
              label: "Calendar View",
              desc: "Due dates, schedules, and planning",
            },
            {
              icon: (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
                </svg>
              ),
              label: "Team Management",
              desc: "Roles, permissions, and workload",
            },
            {
              icon: (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
                </svg>
              ),
              label: "Reports & Analytics",
              desc: "Activity trends and productivity stats",
            },
          ].map((item) => (
            <div
              key={item.label}
              className="flex flex-col items-center sm:items-start text-center sm:text-left rounded-2xl border border-zinc-100 bg-white p-5 transition-all hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/60"
            >
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                {item.icon}
              </div>
              <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-1">{item.label}</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA Section ────────────────────────────────────────────────── */}
      <section className="px-6 pb-24 max-w-7xl mx-auto w-full">
        <div className="rounded-3xl bg-zinc-950 dark:bg-zinc-900 border border-zinc-800 px-8 py-16 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-400 mb-6">
            <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live in your workspace
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4 tracking-tight">
            Start working intelligently
          </h2>
          <p className="text-zinc-400 text-base max-w-md mx-auto mb-8 leading-relaxed">
            Join teams that let AI do the analysis — so they can focus on execution.
            Free to start, no credit card needed.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/auth/sign-up"
              className="w-full sm:w-auto rounded-xl bg-white px-7 py-3.5 text-base font-bold text-zinc-900 shadow-lg transition-all hover:bg-zinc-100 hover:scale-[1.02] active:scale-[0.98]"
            >
              Get started free
            </Link>
            <Link
              href="/auth/sign-in"
              className="w-full sm:w-auto rounded-xl border border-zinc-700 px-7 py-3.5 text-base font-semibold text-zinc-300 transition-all hover:border-zinc-600 hover:text-white"
            >
              Sign in →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer className="mt-auto border-t border-zinc-100 dark:border-zinc-900 px-6 py-8">
        <div className="max-w-7xl mx-auto w-full flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-zinc-900 dark:bg-zinc-100">
              <svg className="h-3.5 w-3.5 text-white dark:text-zinc-900" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Nexdo</span>
          </div>
          <p className="text-xs text-zinc-400 dark:text-zinc-600 text-center sm:text-right">
            An intelligent workspace built for focused teams. AI-native from the ground up.
          </p>
        </div>
      </footer>

    </div>
  );
}
