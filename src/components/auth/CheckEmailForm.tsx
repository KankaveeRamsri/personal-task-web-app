"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function CheckEmailForm() {
  const searchParams = useSearchParams();
  const rawEmail = searchParams.get("email") ?? "";
  // Only surface the email in the UI if it passes a basic format check —
  // prevents reflected-XSS from a crafted URL while keeping UX clean.
  const email = EMAIL_REGEX.test(rawEmail) ? rawEmail : "";

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
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-zinc-200/70 bg-white p-8 shadow-xl shadow-zinc-200/50 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none text-center">

          {/* Envelope icon */}
          <div className="mb-5 flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
              <svg
                className="h-7 w-7 text-emerald-600 dark:text-emerald-400"
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

          <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Check your inbox
          </h1>

          <p className="mt-2.5 text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
            {email ? (
              <>
                We sent a verification link to{" "}
                <span className="font-semibold text-zinc-700 dark:text-zinc-300 break-all">
                  {email}
                </span>
                . Click the link in the email to activate your account.
              </>
            ) : (
              "We sent a verification link to your email address. Click the link to activate your account."
            )}
          </p>

          <p className="mt-3 text-xs text-zinc-400 dark:text-zinc-600">
            Can&apos;t find it? Check your spam or junk folder.
          </p>

          {/* Open Gmail — simple external link, no package needed */}
          <div className="mt-7">
            <a
              href="https://mail.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-700 shadow-sm transition-all hover:bg-zinc-50 hover:shadow-md dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700/80"
            >
              <svg
                className="h-4 w-4 shrink-0"
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
              Open Gmail
            </a>
          </div>
        </div>

        {/* Footer navigation */}
        <div className="mt-6 flex flex-col items-center gap-3 text-center">
          <Link
            href="/auth/sign-in"
            className="flex items-center gap-1.5 text-sm font-semibold text-zinc-900 hover:underline dark:text-zinc-100"
          >
            Back to sign in
          </Link>
          <Link
            href="/auth/sign-up"
            className="text-sm text-zinc-500 transition-colors hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            Use a different email
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 transition-colors hover:text-zinc-600 dark:text-zinc-600 dark:hover:text-zinc-400"
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h16.5" />
            </svg>
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
