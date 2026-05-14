/**
 * AI Chat Session persistence layer.
 *
 * Handles create/load/save for ai_chat_sessions and ai_chat_messages.
 * Called from API routes only — never from the browser directly.
 *
 * Rules:
 * - Only save role=user|assistant messages.
 * - Never save action/debug/internal messages (enforced by caller).
 * - Limit loaded history to LOAD_LIMIT latest messages.
 * - Save failures are caught and logged; they must not crash the caller.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

// ── Types ──────────────────────────────────────────────────────────────

export interface StoredMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface ChatSession {
  id: string;
  user_id: string;
  workspace_id: string;
  board_id: string | null;
  created_at: string;
  updated_at: string;
}

// Maximum messages to load back from DB for context
const LOAD_LIMIT = 20;

// ── Helpers ────────────────────────────────────────────────────────────

/**
 * Verify the user is a member of the workspace.
 * Returns true if access is permitted.
 */
async function verifyWorkspaceMembership(
  supabase: SupabaseClient,
  userId: string,
  workspaceId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[ChatSession] membership check error:", error.message);
    return false;
  }
  return data !== null;
}

// ── Public API ─────────────────────────────────────────────────────────

/**
 * Get or create a chat session for the given user/workspace/board combination.
 * Returns null on DB error or if workspace membership check fails.
 */
export async function getOrCreateSession(
  supabase: SupabaseClient,
  userId: string,
  workspaceId: string,
  boardId: string | null,
): Promise<ChatSession | null> {
  // Safety: verify workspace membership before touching data
  const isMember = await verifyWorkspaceMembership(supabase, userId, workspaceId);
  if (!isMember) {
    console.warn("[ChatSession] getOrCreateSession: user not a workspace member", {
      userId,
      workspaceId,
    });
    return null;
  }

  // Try to find the latest existing session.
  // Supabase query builder is immutable — build separate branches for board_id.
  const baseQuery = supabase
    .from("ai_chat_sessions")
    .select("*")
    .eq("user_id", userId)
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false })
    .limit(1);

  const { data: existing, error: selectError } = await (
    boardId ? baseQuery.eq("board_id", boardId) : baseQuery.is("board_id", null)
  ).maybeSingle();

  if (selectError) {
    console.error("[ChatSession] select error:", selectError.message);
    return null;
  }

  if (existing) {
    return existing as ChatSession;
  }

  // Create a new session
  const insert: Record<string, string | null> = {
    user_id: userId,
    workspace_id: workspaceId,
    board_id: boardId ?? null,
  };

  const { data: created, error: insertError } = await supabase
    .from("ai_chat_sessions")
    .insert(insert)
    .select()
    .single();

  if (insertError) {
    console.error("[ChatSession] insert error:", insertError.message);
    return null;
  }

  return created as ChatSession;
}

/**
 * Load the latest LOAD_LIMIT messages from a session.
 * Returns [] on error — never throws.
 */
export async function loadSessionMessages(
  supabase: SupabaseClient,
  sessionId: string,
): Promise<StoredMessage[]> {
  // Load the last LOAD_LIMIT messages ordered by created_at ASC (oldest first)
  // We do: order DESC limit, then reverse in memory so the array is oldest→newest.
  const { data, error } = await supabase
    .from("ai_chat_messages")
    .select("id, role, content, created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(LOAD_LIMIT);

  if (error) {
    console.error("[ChatSession] loadSessionMessages error:", error.message);
    return [];
  }

  // Reverse so the array is chronologically ascending
  return ((data ?? []) as StoredMessage[]).reverse();
}

/**
 * Save a single message (user or assistant) to the session.
 * Never throws — logs and returns false on failure.
 */
export async function saveMessage(
  supabase: SupabaseClient,
  sessionId: string,
  role: "user" | "assistant",
  content: string,
): Promise<boolean> {
  const trimmed = content.trim();
  if (!trimmed) return false;

  const { error } = await supabase.from("ai_chat_messages").insert({
    session_id: sessionId,
    role,
    content: trimmed,
  });

  if (error) {
    console.error("[ChatSession] saveMessage error:", error.message);
    return false;
  }

  // Bump session updated_at so we can sort by most-recent
  const { error: bumpError } = await supabase
    .from("ai_chat_sessions")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", sessionId);

  if (bumpError) {
    console.warn("[ChatSession] bump updated_at error:", bumpError.message);
  }

  return true;
}

/**
 * Delete all messages in a session (clear chat).
 * Leaves the session row itself intact.
 * Never throws.
 */
export async function clearSessionMessages(
  supabase: SupabaseClient,
  sessionId: string,
): Promise<boolean> {
  const { error } = await supabase
    .from("ai_chat_messages")
    .delete()
    .eq("session_id", sessionId);

  if (error) {
    console.error("[ChatSession] clearSessionMessages error:", error.message);
    return false;
  }

  return true;
}
