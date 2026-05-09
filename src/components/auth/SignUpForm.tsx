"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import PasswordInput from "./PasswordInput";
import FormError from "./FormError";
import FormSuccess from "./FormSuccess";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

interface FieldErrors {
  fullName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

export default function SignUpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo") ?? "";

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);

  const signInHref = returnTo
    ? `/auth/sign-in?returnTo=${encodeURIComponent(returnTo)}`
    : "/auth/sign-in";

  const validate = (): boolean => {
    const errs: FieldErrors = {};

    if (!email.trim()) {
      errs.email = "Email is required.";
    } else if (!EMAIL_REGEX.test(email.trim())) {
      errs.email = "Please enter a valid email address.";
    }

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

  const clearFieldError = (field: keyof FieldErrors) =>
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading) return;
    if (!validate()) return;

    setError("");
    setSuccess("");
    setLoading(true);

    const supabase = createClient();
    const metadata: Record<string, string> = {};
    if (fullName.trim()) {
      metadata.full_name = fullName.trim();
      metadata.display_name = fullName.trim();
    }

    const { data, error: authError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: Object.keys(metadata).length > 0 ? { data: metadata } : undefined,
    });

    if (authError) {
      const msg =
        authError.message === "User already registered"
          ? "An account with this email already exists."
          : authError.message;
      setError(msg);
      setLoading(false);
      return;
    }

    // Email confirmation required — no session returned
    if (!data.session) {
      setSuccess(
        "Account created! Check your inbox and confirm your email address before signing in."
      );
      setLoading(false);
      return;
    }

    const dest =
      returnTo.startsWith("/") && !returnTo.startsWith("//")
        ? returnTo
        : "/dashboard";
    router.push(dest);
    router.refresh();
  };

  // Show only success state after email confirmation is required
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
                strokeWidth={2}
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
              </svg>
            </div>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Check your inbox
          </h1>
          <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
            {success}
          </p>
          <Link
            href={signInHref}
            className="mt-8 inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-900 hover:underline dark:text-zinc-100"
          >
            Back to sign in
          </Link>
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
            Get started
          </h1>
          <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">
            Create your Nexdo account
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-zinc-200/70 bg-white p-8 shadow-xl shadow-zinc-200/50 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none">
          <form onSubmit={handleSubmit} noValidate className="space-y-5">

            {/* Full name (optional) */}
            <div>
              <label htmlFor="fullName" className="nx-label mb-1.5 block">
                Full name{" "}
                <span className="normal-case font-normal text-zinc-400 dark:text-zinc-600">
                  (optional)
                </span>
              </label>
              <input
                id="fullName"
                type="text"
                autoComplete="name"
                autoFocus
                placeholder="Jane Smith"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 transition-all focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:border-blue-400 dark:focus:ring-blue-400/10"
              />
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="nx-label mb-1.5 block">
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  clearFieldError("email");
                }}
                className={[
                  "w-full rounded-xl border px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 transition-all focus:outline-none focus:ring-4 dark:text-zinc-100 dark:placeholder:text-zinc-600",
                  fieldErrors.email
                    ? "border-red-300 bg-white focus:border-red-400 focus:ring-red-400/10 dark:border-red-700 dark:bg-zinc-800 dark:focus:border-red-500 dark:focus:ring-red-500/10"
                    : "border-zinc-200 bg-white focus:border-blue-500 focus:ring-blue-500/10 dark:border-zinc-700 dark:bg-zinc-800 dark:focus:border-blue-400 dark:focus:ring-blue-400/10",
                ].join(" ")}
              />
              {fieldErrors.email && (
                <p className="mt-1.5 text-xs text-red-500 dark:text-red-400">
                  {fieldErrors.email}
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="nx-label mb-1.5 block">
                Password
                <span className="ml-1.5 normal-case font-normal text-zinc-400 dark:text-zinc-600">
                  (min {MIN_PASSWORD_LENGTH} characters)
                </span>
              </label>
              <PasswordInput
                id="password"
                autoComplete="new-password"
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
                Confirm password
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

            {/* Global error */}
            {error && <FormError message={error} />}

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
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 0 1 4 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              )}
              {loading ? "Creating account…" : "Get Started"}
            </button>

            <p className="text-center text-[11px] text-zinc-400 dark:text-zinc-600">
              By signing up you agree to our{" "}
              <span className="font-medium text-zinc-500 dark:text-zinc-500">
                Terms of Service
              </span>{" "}
              and{" "}
              <span className="font-medium text-zinc-500 dark:text-zinc-500">
                Privacy Policy
              </span>
              .
            </p>
          </form>
        </div>

        {/* Footer */}
        <div className="mt-6 space-y-4 text-center">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Already have an account?{" "}
            <Link
              href={signInHref}
              className="font-semibold text-zinc-900 hover:underline dark:text-zinc-100"
            >
              Sign in
            </Link>
          </p>
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
