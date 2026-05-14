/**
 * GET  /api/ai/chat/session?workspaceId=...&boardId=...
 *   → Returns { sessionId, messages: StoredMessage[] }
 *
 * DELETE /api/ai/chat/session?sessionId=...
 *   → Clears all messages in the session (new chat)
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/api";
import { createClient } from "@/lib/auth/server";
import {
  getOrCreateSession,
  loadSessionMessages,
  clearSessionMessages,
} from "@/lib/ai/chat-session";

// Note: this route uses cookies() which requires Node.js runtime.
// Do NOT add `export const runtime = "edge"` here.

// ── GET: load or create a session and return its messages ──────────────

export async function GET(request: Request) {
  const { user, response: authResponse } = await requireAuth();
  if (authResponse) return authResponse;
  // user is guaranteed non-null here
  const userId = user!.id;

  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId") ?? "";
  const boardId = searchParams.get("boardId") ?? null;

  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
  }

  const supabase = await createClient();

  const session = await getOrCreateSession(
    supabase,
    userId,
    workspaceId,
    boardId || null,
  );

  if (!session) {
    return NextResponse.json({ error: "Access denied or DB error" }, { status: 403 });
  }

  const messages = await loadSessionMessages(supabase, session.id);

  return NextResponse.json({ sessionId: session.id, messages });
}

// ── DELETE: clear all messages in a session (new chat) ─────────────────

export async function DELETE(request: Request) {
  const { user, response: authResponse } = await requireAuth();
  if (authResponse) return authResponse;
  const userId = user!.id;

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId") ?? "";

  if (!sessionId) {
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
  }

  const supabase = await createClient();

  // Verify the session belongs to this user (RLS also enforces this)
  const { data: session, error: sessionError } = await supabase
    .from("ai_chat_sessions")
    .select("id, user_id")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (sessionError || !session) {
    return NextResponse.json({ error: "Session not found or access denied" }, { status: 404 });
  }

  const ok = await clearSessionMessages(supabase, sessionId);
  if (!ok) {
    return NextResponse.json({ error: "Failed to clear session" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
