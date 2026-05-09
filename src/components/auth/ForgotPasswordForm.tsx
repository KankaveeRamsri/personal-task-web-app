"use client";

import { useState } from "react";
import Link from "next/link";
import { forgotPasswordAction } from "@/lib/auth/actions";
import FormError from "./FormError";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Generic message — never reveals whether the email exists
const SAFE_SUCCESS_MESSAGE =
  "If an account exists for this email, we'll send password reset instructions. Check your inbox (and spam folder).";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [globalError, setGlobalError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const validate = (): boolean => {
    if (!email.trim()) {
      setEmailError("Email is required.");
      return false;
    }
    if (!EMAIL_REGEX.test(email.trim())) {
      setEmailError("Please enter a valid email address.");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading) return;
    setEmailError("");
    setGlobalError("");
    if (!validate()) return;

    setLoading(true);
    const result = await forgotPasswordAction({ email: email.trim() });
    setLoading(false);

    if (!result.success) {
      // Only surface genuine system errors (e.g. rate limit), not "email not found"
      const isRateLimit = result.error.toLowerCase().includes("rate limit") ||
        result.error.toLowerCase().includes("too many");
      if (isRateLimit) {
        setGlobalError(result.error);
      } else {
        // For all other errors, still show the safe generic message
        setSuccess(true);
      }
      return;
    }

    setSuccess(true);
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-zinc-50 to-white p-4 dark:from-zinc-950 dark:to-zinc-900">
        <div className="w-full max-w-md text-center">
          <div className="mb-6 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
              <svg
                className="h-8 w-8 text-emerald-600 dark:text-emerald-400"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75"
                />
              </svg>
            </div>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Check your email
          </h1>
          <p className="mt-3 max-w-sm mx-auto text-sm text-zinc-500 dark:text-zinc-400">
            {SAFE_SUCCESS_MESSAGE}
          </p>
          <div className="mt-8 flex flex-col items-center gap-3">
            <Link
              href="/auth/sign-in"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-900 hover:underline dark:text-zinc-100"
            >
              Back to sign in
            </Link>
            <button
              type="button"
              onClick={() => { setSuccess(false); setEmail(""); }}
              className="text-xs text-zinc-400 hover:text-zinc-600 transition-colors dark:text-zinc-600 dark:hover:text-zinc-400"
            >
              Send again with a different email
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-zinc-50 to-white p-4 dark:from-zinc-950 dark:to-zinc-900">
      <div className="w-full max-w-md">

        {/* Branding */}
        <div className="mb-8 flex flex-col items-center text-center">
          <Link
            href="/"
            className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-900 shadow-lg shadow-zinc-900/20 transition-transform hover:scale-105 active:scale-95 dark:bg-zinc-100"
          >
            <svg
              className="h-6 w-6 text-white dark:text-zinc-900"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15a2.25 2.25 0 0 1 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z"
              />
            </svg>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Reset your password
          </h1>
          <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">
            Enter your email and we&apos;ll send a reset link
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-zinc-200/70 bg-white p-8 shadow-xl shadow-zinc-200/50 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none">
          <form onSubmit={handleSubmit} noValidate className="space-y-5">

            {/* Email */}
            <div>
              <label htmlFor="email" className="nx-label mb-1.5 block">
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                autoFocus
                placeholder="you@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setEmailError("");
                }}
                className={[
                  "w-full rounded-xl border px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 transition-all focus:outline-none focus:ring-4 dark:text-zinc-100 dark:placeholder:text-zinc-600",
                  emailError
                    ? "border-red-300 bg-white focus:border-red-400 focus:ring-red-400/10 dark:border-red-700 dark:bg-zinc-800 dark:focus:border-red-500 dark:focus:ring-red-500/10"
                    : "border-zinc-200 bg-white focus:border-blue-500 focus:ring-blue-500/10 dark:border-zinc-700 dark:bg-zinc-800 dark:focus:border-blue-400 dark:focus:ring-blue-400/10",
                ].join(" ")}
              />
              {emailError && (
                <p className="mt-1.5 text-xs text-red-500 dark:text-red-400">
                  {emailError}
                </p>
              )}
            </div>

            {globalError && <FormError message={globalError} />}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="relative flex w-full items-center justify-center rounded-xl bg-zinc-900 px-4 py-3.5 text-sm font-bold text-white shadow-md shadow-zinc-900/10 transition-all hover:bg-zinc-800 hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {loading && (
                <svg
                  className="absolute left-4 h-4 w-4 animate-spin text-white dark:text-zinc-900"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 0 1 4 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              )}
              {loading ? "Sending…" : "Send Reset Link"}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center">
          <Link
            href="/auth/sign-in"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h16.5" />
            </svg>
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
