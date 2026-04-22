import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <main className="flex flex-col items-center gap-8 text-center px-6">
        <h1 className="text-4xl font-bold tracking-tight">Task Board</h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400 max-w-md">
          A collaborative task board. Sign in to manage your workspaces and tasks.
        </p>
        <div className="flex gap-4">
          <Link
            href="/auth/sign-up"
            className="rounded-lg bg-black px-6 py-3 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          >
            Sign Up
          </Link>
          <Link
            href="/auth/sign-in"
            className="rounded-lg border border-zinc-300 px-6 py-3 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Sign In
          </Link>
        </div>
      </main>
    </div>
  );
}
