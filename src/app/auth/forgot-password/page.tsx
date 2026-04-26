"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const supabase = createClient();
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });

    setSubmitted(true);
    setLoading(false);
  };

  return (
    <div className="flex flex-1 items-center justify-center bg-gradient-to-br from-slate-50 via-white to-zinc-100 p-6 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950">
      <main className="w-full max-w-md rounded-2xl border border-zinc-200/60 bg-white p-8 shadow-lg shadow-zinc-200/40 dark:border-zinc-800/60 dark:bg-zinc-900 dark:shadow-zinc-950/60">
        <div className="space-y-7">
          <div className="flex flex-col items-center space-y-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-900 dark:bg-zinc-100">
              <svg className="h-6 w-6 text-white dark:text-zinc-900" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Reset Password</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center">
              Enter your email and we&apos;ll send you a reset link.
            </p>
          </div>

          {submitted ? (
            <div className="rounded-lg bg-zinc-50 px-4 py-3 text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              If this email exists, a reset link has been sent.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 transition-colors focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-600 dark:focus:ring-zinc-100/10"
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-zinc-800 active:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:active:bg-zinc-300"
              >
                {loading ? "Sending..." : "Send Reset Link"}
              </button>
            </form>
          )}

          <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
            <Link href="/auth/sign-in" className="font-medium text-zinc-900 hover:text-zinc-700 dark:text-zinc-100 dark:hover:text-zinc-300">
              Back to Sign In
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
