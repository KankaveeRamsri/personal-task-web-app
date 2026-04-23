import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-1 items-center justify-center bg-gradient-to-br from-slate-50 via-white to-zinc-100 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 px-6 py-20">
      <main className="flex flex-col items-center max-w-2xl text-center space-y-10">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-900 shadow-lg shadow-zinc-900/15 dark:bg-zinc-100 dark:shadow-zinc-100/10">
          <svg className="h-8 w-8 text-white dark:text-zinc-900" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15a2.25 2.25 0 0 1 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />
          </svg>
        </div>

        <div className="space-y-4">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-5xl">
            Task Board
          </h1>
          <p className="text-lg leading-relaxed text-zinc-500 dark:text-zinc-400">
            A collaborative task board. Sign in to manage your workspaces and tasks.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/auth/sign-up"
            className="rounded-xl bg-zinc-900 px-6 py-2.5 text-sm font-semibold text-white shadow-sm shadow-zinc-900/10 transition-all hover:bg-zinc-800 hover:shadow-md dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:shadow-none"
          >
            Sign Up
          </Link>
          <Link
            href="/auth/sign-in"
            className="rounded-xl border border-zinc-200 bg-white/60 px-6 py-2.5 text-sm font-semibold text-zinc-700 backdrop-blur-sm transition-all hover:bg-white hover:shadow-sm dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Sign In
          </Link>
        </div>
      </main>
    </div>
  );
}
