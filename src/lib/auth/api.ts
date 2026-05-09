import { NextResponse } from "next/server";
import { createClient } from "@/lib/auth/server";

export async function requireAuth() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return {
      user: null,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    } as const;
  }

  return { user: data.user, response: null } as const;
}
