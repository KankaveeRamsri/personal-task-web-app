"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

export default function SettingsPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [userId, setUserId] = useState("");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setEmail(data.user.email ?? "");
        setName(data.user.user_metadata?.full_name ?? "");
        setUserId(data.user.id);
      }
    });
  }, []);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
        Settings
      </h1>

      <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Account
          </h2>
        </div>
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          <div className="flex items-center justify-between px-5 py-4">
            <span className="text-sm text-zinc-500 dark:text-zinc-400">Email</span>
            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {email || "—"}
            </span>
          </div>
          <div className="flex items-center justify-between px-5 py-4">
            <span className="text-sm text-zinc-500 dark:text-zinc-400">Name</span>
            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {name || "—"}
            </span>
          </div>
          <div className="flex items-center justify-between px-5 py-4">
            <span className="text-sm text-zinc-500 dark:text-zinc-400">User ID</span>
            <span className="text-sm font-mono text-zinc-500 dark:text-zinc-400">
              {userId ? `${userId.slice(0, 8)}…${userId.slice(-4)}` : "—"}
            </span>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <button
          onClick={handleSignOut}
          className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
