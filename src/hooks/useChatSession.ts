/**
 * useChatSession
 *
 * Manages AI chat session lifecycle:
 * - Load/create session on board selection
 * - Save user and assistant messages to DB
 * - Clear session (new chat)
 *
 * Uses fire-and-forget saves so failures never block the UI.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import type { ChatMessage } from "@/components/ai-assistant/types";

export interface StoredMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

interface SessionState {
  sessionId: string | null;
  isLoading: boolean;
  error: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────────

async function fetchSession(
  workspaceId: string,
  boardId: string | null,
): Promise<{ sessionId: string; messages: StoredMessage[] } | null> {
  try {
    const params = new URLSearchParams({ workspaceId });
    if (boardId) params.set("boardId", boardId);

    const res = await fetch(`/api/ai/chat/session?${params.toString()}`);
    if (!res.ok) return null;

    const data = (await res.json()) as { sessionId: string; messages: StoredMessage[] };
    return data;
  } catch {
    return null;
  }
}

async function persistMessage(
  sessionId: string,
  role: "user" | "assistant",
  content: string,
): Promise<void> {
  try {
    await fetch("/api/ai/chat/message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, role, content }),
    });
  } catch {
    // Fire-and-forget: never crash on save failure
    console.warn("[useChatSession] persistMessage failed silently");
  }
}

async function clearSession(sessionId: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/ai/chat/session?sessionId=${encodeURIComponent(sessionId)}`, {
      method: "DELETE",
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ── Hook ───────────────────────────────────────────────────────────────

export function useChatSession(
  workspaceId: string | null,
  boardId: string | null,
) {
  const [sessionState, setSessionState] = useState<SessionState>({
    sessionId: null,
    isLoading: false,
    error: null,
  });
  const [restoredMessages, setRestoredMessages] = useState<ChatMessage[] | null>(null);

  // ── Load session when workspace/board changes ──────────────────────

  useEffect(() => {
    if (!workspaceId) return;

    let cancelled = false;

    setSessionState({ sessionId: null, isLoading: true, error: null });
    setRestoredMessages(null);

    fetchSession(workspaceId, boardId).then((result) => {
      if (cancelled) return;

      if (!result) {
        setSessionState({ sessionId: null, isLoading: false, error: "Failed to load session" });
        setRestoredMessages([]);
        return;
      }

      setSessionState({ sessionId: result.sessionId, isLoading: false, error: null });

      // Convert stored messages to ChatMessage format
      const restored: ChatMessage[] = result.messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));
      setRestoredMessages(restored);
    });

    return () => {
      cancelled = true;
    };
  }, [workspaceId, boardId]);

  // ── Save a user message ────────────────────────────────────────────

  const saveUserMessage = useCallback(
    (content: string): void => {
      const { sessionId } = sessionState;
      if (!sessionId || !content.trim()) return;
      void persistMessage(sessionId, "user", content);
    },
    [sessionState],
  );

  // ── Save an assistant message ──────────────────────────────────────

  const saveAssistantMessage = useCallback(
    (content: string): void => {
      const { sessionId } = sessionState;
      if (!sessionId || !content.trim()) return;
      // Skip fallback / action / error messages (they contain internal text)
      void persistMessage(sessionId, "assistant", content);
    },
    [sessionState],
  );

  // ── Clear chat (new chat) ──────────────────────────────────────────

  const clearChat = useCallback(async (): Promise<boolean> => {
    const { sessionId } = sessionState;
    if (!sessionId) return false;
    const ok = await clearSession(sessionId);
    return ok;
  }, [sessionState]);

  return {
    sessionId: sessionState.sessionId,
    isSessionLoading: sessionState.isLoading,
    restoredMessages,
    saveUserMessage,
    saveAssistantMessage,
    clearChat,
  };
}
