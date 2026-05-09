"use client";

import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { ToastProvider } from "@/components/ui/toast";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    const loadUser = async () => {
      const supabase = createClient();
      const result = await supabase.auth.getUser();
      if (result.error) return;
      const user = result.data.user;
      if (user) setUserEmail(user.email ?? "");
    };
    loadUser();
  }, []);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <ToastProvider>
      <div className="flex h-screen">
        <Sidebar userEmail={userEmail} onSignOut={handleSignOut} />
        <main className="flex flex-1 flex-col overflow-y-auto bg-background p-6 lg:p-8">
          {children}
        </main>
      </div>
    </ToastProvider>
  );
}
