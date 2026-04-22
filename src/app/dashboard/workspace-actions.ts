// "use server";

// import { createServerSupabaseClient } from "@/lib/supabase-server";
// import type { Workspace } from "@/types/database";

// export async function createWorkspaceAction(name: string) {
//   const supabase = await createServerSupabaseClient();
//   const {
//     data: { user },
//   } = await supabase.auth.getUser();
//   if (!user) return { ok: false, error: "กรุณาเข้าสู่ระบบ" };

//   const { data, error } = await supabase
//     .from("workspaces")
//     .insert({ name, owner_id: user.id })
//     .select()
//     .single();

//   if (error) return { ok: false, error: error.message };
//   return { ok: true, data: data as Workspace };
// }

"use server";

import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { Workspace } from "@/types/database";

export async function createWorkspaceAction(name: string) {
  console.log("[createWorkspaceAction] called:", name);

  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  console.log("[createWorkspaceAction] userError:", userError);
  console.log("[createWorkspaceAction] user:", user?.id, user?.email);

  if (!user) {
    return { ok: false, error: "กรุณาเข้าสู่ระบบ" };
  }

  const payload = { name, owner_id: user.id };
  console.log("[createWorkspaceAction] payload:", payload);

  const { data, error } = await supabase
    .from("workspaces")
    .insert(payload)
    .select()
    .single();

  console.log("[createWorkspaceAction] insert error:", error);
  console.log("[createWorkspaceAction] insert data:", data);

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data as Workspace };
}