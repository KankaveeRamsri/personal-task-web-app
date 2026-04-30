"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface AuthFormProps {
  initialMode: "signin" | "signup";
}

export default function AuthForm({ initialMode }: AuthFormProps) {
  const router = useRouter();
  const emailRef = useRef<HTMLInputElement>(null);
  
  const [mode, setMode] = useState<"signin" | "signup">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Auto-focus email input on mount
  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  const toggleMode = (newMode: "signin" | "signup") => {
    if (newMode === mode) return;
    setMode(newMode);
    // Reset form
    setEmail("");
    setPassword("");
    setError("");
    // Re-focus email
    setTimeout(() => emailRef.current?.focus(), 0);
  };

  const validate = () => {
    if (!email.trim()) {
      setError("Email is required");
      return false;
    }
    if (!password) {
      setError("Password is required");
      return false;
    }
    if (mode === "signup" && password.length < 6) {
      setError("Password must be at least 6 characters");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (!validate()) return;

    setError("");
    setLoading(true);

    const supabase = createClient();
    
    try {
      if (mode === "signin") {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (authError) throw authError;
      } else {
        const { error: authError } = await supabase.auth.signUp({
          email,
          password,
        });
        if (authError) throw authError;
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
      setLoading(false);
    }
  };

  const isButtonDisabled = loading || !email.trim() || !password || (mode === "signup" && password.length < 6);

  return (
    <div className="flex min-h-screen flex-1 items-center justify-center bg-zinc-50 p-6 dark:bg-zinc-950">
      <main className="w-full max-w-md" style={{ animation: "fade-in 0.3s ease-out" }}>
        <div className="mb-8 flex flex-col items-center">
          <Link href="/" className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-900 shadow-xl transition-transform hover:scale-105 active:scale-95 dark:bg-zinc-100">
            <svg className="h-6 w-6 text-white dark:text-zinc-900" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15a2.25 2.25 0 0 1 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />
            </svg>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            {mode === "signin" ? "Welcome back" : "Create an account"}
          </h1>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            {mode === "signin" ? "Sign in to your workspace" : "Get started with your new board"}
          </p>
        </div>

        {/* Mode Toggle */}
        <div className="rounded-2xl border border-zinc-200 bg-zinc-100/50 p-1 dark:border-zinc-800 dark:bg-zinc-900/50 mb-6">
          <div className="flex">
            <button
              type="button"
              onClick={() => toggleMode("signin")}
              className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
                mode === "signin"
                  ? "bg-white text-zinc-900 shadow-md dark:bg-zinc-800 dark:text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => toggleMode("signup")}
              className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
                mode === "signup"
                  ? "bg-white text-zinc-900 shadow-md dark:bg-zinc-800 dark:text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
            >
              Sign Up
            </button>
          </div>
        </div>

        {/* Auth Card */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-2xl shadow-zinc-200/50 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                Email Address
              </label>
              <input
                ref={emailRef}
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); if (error) setError(""); }}
                className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 transition-all focus:border-zinc-900 focus:outline-none focus:ring-4 focus:ring-zinc-900/5 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:border-zinc-100 dark:focus:ring-zinc-100/5"
              />
            </div>
            <div>
              <label htmlFor="password" className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => { setPassword(e.target.value); if (error) setError(""); }}
                className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 transition-all focus:border-zinc-900 focus:outline-none focus:ring-4 focus:ring-zinc-900/5 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:border-zinc-100 dark:focus:ring-zinc-100/5"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-xs font-medium text-red-600 border border-red-100 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900/50" style={{ animation: "shake 0.4s ease-in-out" }}>
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                </svg>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isButtonDisabled}
              className="group relative flex w-full items-center justify-center rounded-xl bg-zinc-900 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-zinc-900/20 transition-all hover:bg-zinc-800 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:scale-100 disabled:hover:bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:shadow-none dark:hover:bg-zinc-200"
            >
              {loading && (
                <svg className="absolute left-4 h-4 w-4 animate-spin text-white dark:text-zinc-900" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 0 1 4 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              )}
              {loading 
                ? (mode === "signin" ? "Signing in..." : "Creating account...") 
                : (mode === "signin" ? "Sign In" : "Create Account")
              }
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-zinc-100 dark:border-zinc-800 text-center">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {mode === "signin" ? "Don't have an account?" : "Already have an account?"}{" "}
              <button
                type="button"
                onClick={() => toggleMode(mode === "signin" ? "signup" : "signin")}
                className="font-bold text-zinc-900 hover:underline dark:text-zinc-100"
              >
                {mode === "signin" ? "Sign up for free" : "Sign in here"}
              </button>
            </p>
          </div>
        </div>

        <div className="mt-8 text-center">
          <Link href="/" className="inline-flex items-center gap-2 text-xs font-bold text-zinc-400 hover:text-zinc-600 transition-colors dark:text-zinc-600 dark:hover:text-zinc-400">
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h16.5" />
            </svg>
            Back to home
          </Link>
        </div>
      </main>

      <style jsx>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
      `}</style>
    </div>
  );
}
