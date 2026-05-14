/**
 * POST /api/ai/chat/message
 * Body: { sessionId: string; role: "user" | "assistant"; content: string }
 *
 * Saves a single message to the session.
 * Used by the frontend to persist user messages and streamed assistant replies.
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/api";
import { createClient } from "@/lib/auth/server";
import { saveMessage } from "@/lib/ai/chat-session";

export async function POST(request: Request) {
  const { user, response: authResponse } = await requireAuth();
  if (authResponse) return authResponse;
  const userId = user!.id;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { sessionId, role, content } = body as Record<string, unknown>;

  if (typeof sessionId !== "string" || !sessionId.trim()) {
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
  }
  if (role !== "user" && role !== "assistant") {
    return NextResponse.json({ error: "role must be user or assistant" }, { status: 400 });
  }
  if (typeof content !== "string" || !content.trim()) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }

  const supabase = await createClient();

  // Verify session ownership (RLS also enforces, but explicit check is safer)
  const { data: session, error: sessionError } = await supabase
    .from("ai_chat_sessions")
    .select("id, user_id")
    .eq("id", sessionId.trim())
    .eq("user_id", userId)
    .maybeSingle();

  if (sessionError || !session) {
    return NextResponse.json({ error: "Session not found or access denied" }, { status: 404 });
  }

  const ok = await saveMessage(supabase, sessionId.trim(), role, content);
  if (!ok) {
    // Save failure should not break the chat — return 200 with ok:false
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  return NextResponse.json({ ok: true });
}
