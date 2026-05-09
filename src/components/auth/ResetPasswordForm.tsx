"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { resetPasswordAction } from "@/lib/auth/actions";
import PasswordInput from "./PasswordInput";
import FormError from "./FormError";

const MIN_PASSWORD_LENGTH = 8;

type PageStatus = "loading" | "ready" | "expired" | "success";

interface FieldErrors {
  password?: string;
  confirmPassword?: string;
}

export default function ResetPasswordForm() {
  const searchParams = useSearchParams();

  const [status, setStatus] = useState<PageStatus>("loading");
  const [sessionError, setSessionError] = useState("");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [globalError, setGlobalError] = useState("");
  const [loading, setLoading] = useState(false);

  // Exchange recovery code for session on mount
  useEffect(() => {
    const initRecovery = async () => {
      const supabase = createClient();
      const code = searchParams.get("code");
      const errorParam = searchParams.get("error");
      const errorDesc = searchParams.get("error_description");

      // Supabase forwarded an error (e.g. expired link)
      if (errorParam) {
        setSessionError(
          errorDesc?.replace(/\+/g, " ") ??
            "Reset link is invalid. Please request a new one."
        );
        setStatus("expired");
        return;
      }

      // PKCE flow: code in query params
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setSessionError(
            "Your reset link has expired or has already been used. Please request a new one."
          );
          setStatus("expired");
          return;
        }
        setStatus("ready");
        return;
      }

      // No code — check for an existing recovery session
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setStatus("ready");
        return;
      }

      // Nothing — user navigated here directly without a valid link
      setSessionError(
        "No active reset session found. Please use the link from your password reset email."
      );
      setStatus("expired");
    };

    initRecovery();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearFieldError = (field: keyof FieldErrors) =>
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));

  const validate = (): boolean => {
    const errs: FieldErrors = {};
    if (!password) {
      errs.password = "Password is required.";
    } else if (password.length < MIN_PASSWORD_LENGTH) {
      errs.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
    }
    if (!confirmPassword) {
      errs.confirmPassword = "Please confirm your password.";
    } else if (password && confirmPassword !== password) {
      errs.confirmPassword = "Passwords do not match.";
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading) return;
    setGlobalError("");
    if (!validate()) return;

    setLoading(true);
    const result = await resetPasswordAction({ password });
    setLoading(false);

    if (!result.success) {
      // If the recovery session expired between code exchange and form submission
      if (
        result.error.includes("expired") ||
        result.error.includes("invalid") ||
        result.error.includes("session")
      ) {
        setSessionError(result.error);
        setStatus("expired");
        return;
      }
      setGlobalError(result.error);
      return;
    }

    setStatus("success");
  };

  // ─── Loading state ────────────────────────────────────────────────────────

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-zinc-50 to-white p-4 dark:from-zinc-950 dark:to-zinc-900">
        <div role="status" className="flex flex-col items-center gap-3 text-zinc-400 dark:text-zinc-600">
          <svg
            className="h-7 w-7 animate-spin"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 0 1 4 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-sm">Verifying reset link…</span>
        </div>
      </div>
    );
  }

  // ─── Expired / invalid link ───────────────────────────────────────────────

  if (status === "expired") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-zinc-50 to-white p-4 dark:from-zinc-950 dark:to-zinc-900">
        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-zinc-200/70 bg-white p-8 shadow-xl shadow-zinc-200/50 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none text-center">
            <div className="mb-5 flex justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                <svg
                  className="h-7 w-7 text-amber-600 dark:text-amber-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
              </div>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              Link expired or invalid
            </h2>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              {sessionError}
            </p>
            <div className="mt-7 flex flex-col items-center gap-3">
              <Link
                href="/auth/forgot-password"
                className="flex w-full items-center justify-center rounded-xl bg-zinc-900 px-4 py-3 text-sm font-bold text-white transition-all hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Request a new link
              </Link>
              <Link
                href="/auth/sign-in"
                className="text-sm text-zinc-500 hover:text-zinc-800 transition-colors dark:text-zinc-400 dark:hover:text-zinc-200"
              >
                Back to sign in
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Success state ────────────────────────────────────────────────────────

  if (status === "success") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-zinc-50 to-white p-4 dark:from-zinc-950 dark:to-zinc-900">
        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-zinc-200/70 bg-white p-8 shadow-xl shadow-zinc-200/50 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none text-center">
            <div className="mb-5 flex justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                <svg
                  className="h-7 w-7 text-emerald-600 dark:text-emerald-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              </div>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              Password updated
            </h2>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              Your password has been changed successfully. You can now sign in with your new password.
            </p>
            <div className="mt-7">
              <Link
                href="/auth/sign-in"
                className="flex w-full items-center justify-center rounded-xl bg-zinc-900 px-4 py-3 text-sm font-bold text-white transition-all hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Go to sign in
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Reset password form ──────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-zinc-50 to-white p-4 dark:from-zinc-950 dark:to-zinc-900">
      <div className="w-full max-w-md">

        {/* Branding */}
        <div className="mb-8 flex flex-col items-center text-center">
          <Link
            href="/"
            aria-label="Nexdo — back to home"
            className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-900 shadow-lg shadow-zinc-900/20 transition-transform hover:scale-105 active:scale-95 dark:bg-zinc-100"
          >
            <svg
              className="h-6 w-6 text-white dark:text-zinc-900"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15a2.25 2.25 0 0 1 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z"
              />
            </svg>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Choose a new password
          </h1>
          <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">
            Must be at least {MIN_PASSWORD_LENGTH} characters
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-zinc-200/70 bg-white p-8 shadow-xl shadow-zinc-200/50 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none">
          <form onSubmit={handleSubmit} noValidate className="space-y-5">

            {/* New password */}
            <div>
              <label htmlFor="password" className="nx-label mb-1.5 block">
                New password
              </label>
              <PasswordInput
                id="password"
                autoComplete="new-password"
                autoFocus
                placeholder="••••••••"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  clearFieldError("password");
                  if (confirmPassword) clearFieldError("confirmPassword");
                }}
                error={!!fieldErrors.password}
              />
              {fieldErrors.password && (
                <p className="mt-1.5 text-xs text-red-500 dark:text-red-400">
                  {fieldErrors.password}
                </p>
              )}
            </div>

            {/* Confirm password */}
            <div>
              <label htmlFor="confirmPassword" className="nx-label mb-1.5 block">
                Confirm new password
              </label>
              <PasswordInput
                id="confirmPassword"
                autoComplete="new-password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  clearFieldError("confirmPassword");
                }}
                error={!!fieldErrors.confirmPassword}
              />
              {fieldErrors.confirmPassword && (
                <p className="mt-1.5 text-xs text-red-500 dark:text-red-400">
                  {fieldErrors.confirmPassword}
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
              {loading ? "Updating password…" : "Update Password"}
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
