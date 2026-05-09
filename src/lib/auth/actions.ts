"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/auth/server";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getSiteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.NEXT_PUBLIC_VERCEL_URL)
    return `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`;
  return "http://localhost:3000";
}

export function sanitizeReturnTo(returnTo: string | null | undefined): string {
  if (!returnTo) return "/dashboard";
  // Must be a relative path, never protocol-relative (//evil.com) or absolute URL
  if (returnTo.startsWith("/") && !returnTo.startsWith("//")) return returnTo;
  return "/dashboard";
}

export function normalizeAuthError(message: string): string {
  const map: Record<string, string> = {
    "Invalid login credentials": "Incorrect email or password.",
    "Email not confirmed":
      "Please confirm your email address before signing in.",
    "User already registered":
      "An account with this email already exists.",
    "Password should be at least 6 characters":
      "Password must be at least 6 characters.",
    "Email rate limit exceeded":
      "Too many attempts. Please wait a moment and try again.",
    "Signup is disabled": "Account registration is currently disabled.",
    "Token has expired or is invalid":
      "Your reset link has expired. Please request a new one.",
  };
  return map[message] ?? message;
}

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export type AuthResult =
  | { success: true; message?: string }
  | { success: false; error: string };

// ---------------------------------------------------------------------------
// signInAction
// ---------------------------------------------------------------------------

export async function signInAction(input: {
  email: string;
  password: string;
  returnTo?: string;
}): Promise<AuthResult> {
  const { email, password, returnTo } = input;

  if (!email?.trim()) return { success: false, error: "Email is required." };
  if (!password) return { success: false, error: "Password is required." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error) {
    return { success: false, error: normalizeAuthError(error.message) };
  }

  redirect(sanitizeReturnTo(returnTo));
}

// ---------------------------------------------------------------------------
// signUpAction
// ---------------------------------------------------------------------------

export async function signUpAction(input: {
  email: string;
  password: string;
  fullName?: string;
  displayName?: string;
  returnTo?: string;
}): Promise<AuthResult> {
  const { email, password, fullName, displayName, returnTo } = input;

  if (!email?.trim()) return { success: false, error: "Email is required." };
  if (!password) return { success: false, error: "Password is required." };
  if (password.length < 6)
    return {
      success: false,
      error: "Password must be at least 6 characters.",
    };

  const metadata: Record<string, string> = {};
  if (fullName?.trim()) metadata.full_name = fullName.trim();
  if (displayName?.trim()) metadata.display_name = displayName.trim();

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options:
      Object.keys(metadata).length > 0 ? { data: metadata } : undefined,
  });

  if (error) {
    return { success: false, error: normalizeAuthError(error.message) };
  }

  // If Supabase requires email confirmation, there will be no active session.
  // Do not redirect to dashboard — return a friendly message instead.
  if (!data.session) {
    return {
      success: true,
      message:
        "Account created! Check your email to confirm your address before signing in.",
    };
  }

  redirect(sanitizeReturnTo(returnTo));
}

// ---------------------------------------------------------------------------
// signOutAction
// ---------------------------------------------------------------------------

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  // Sign out server-side so the session cookies are cleared before redirect.
  await supabase.auth.signOut();
  redirect("/auth/sign-in");
}

// ---------------------------------------------------------------------------
// forgotPasswordAction
// ---------------------------------------------------------------------------

export async function forgotPasswordAction(input: {
  email: string;
}): Promise<AuthResult> {
  const { email } = input;

  if (!email?.trim()) return { success: false, error: "Email is required." };

  const redirectTo = `${getSiteUrl()}/auth/reset-password`;

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo,
  });

  if (error) {
    return { success: false, error: normalizeAuthError(error.message) };
  }

  return {
    success: true,
    message: "Password reset email sent. Check your inbox.",
  };
}

// ---------------------------------------------------------------------------
// resetPasswordAction
// ---------------------------------------------------------------------------

export async function resetPasswordAction(input: {
  password: string;
}): Promise<AuthResult> {
  const { password } = input;

  if (!password) return { success: false, error: "Password is required." };
  if (password.length < 6)
    return {
      success: false,
      error: "Password must be at least 6 characters.",
    };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { success: false, error: normalizeAuthError(error.message) };
  }

  return { success: true, message: "Password updated successfully." };
}
