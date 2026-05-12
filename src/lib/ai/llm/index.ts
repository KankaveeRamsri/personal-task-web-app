/**
 * LLM provider abstraction — server-side only.
 *
 * Reads LLM_PROVIDER from process.env to decide which backend to call:
 *   "minimax"  →  MiniMax Chat Completions (OpenAI-compatible)
 *   anything else / unset  →  Gemini (legacy fallback)
 *
 * Both providers expose a unified callLLM() function that accepts a
 * simple messages array and returns a plain assistant-text string.
 * streamLLM() yields text chunks for streaming responses.
 */

import { callMiniMax, streamMiniMax, type MiniMaxMessage } from "./minimax";
import { callGemini, streamGemini, type GeminiContent } from "./gemini";

export type LLMMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string };

const DEFAULT_TIMEOUT_MS = 45_000;

export interface LLMCallOptions {
  /** 0.0–1.0.  Defaults to provider-specific value if omitted. */
  temperature?: number;
  /** Max output tokens — honoured by Gemini; ignored by MiniMax (no direct equivalent in standard spec). */
  maxOutputTokens?: number;
  /** Request timeout in ms. Defaults to AI_CHAT_TIMEOUT_MS env or 45000. */
  timeoutMs?: number;
}

/** Read the configurable chat timeout from env. */
export function getChatTimeoutMs(): number {
  const raw = parseInt(process.env.AI_CHAT_TIMEOUT_MS ?? "", 10);
  return Number.isFinite(raw) && raw > 0 && raw <= 120_000
    ? raw
    : DEFAULT_TIMEOUT_MS;
}

/**
 * Convert the unified LLMMessage[] into Gemini's content format.
 * Gemini uses role "model" instead of "assistant".
 */
function toGeminiContents(messages: LLMMessage[]): GeminiContent[] {
  return messages.map((m) => ({
    role: m.role === "assistant" ? "model" : m.role,
    parts: [{ text: m.content }],
  }));
}

function toMiniMaxMessages(messages: LLMMessage[]): MiniMaxMessage[] {
  return messages.map((m) => ({
    role: m.role === "assistant" ? "assistant" : m.role as "system" | "user",
    content: m.content,
  }));
}

/**
 * Unified LLM call.  Dispatches to MiniMax or Gemini based on
 * the LLM_PROVIDER environment variable.
 *
 * Throws errors with message codes: "missing_key" | "timeout" | "api_error"
 */
export async function callLLM(
  messages: LLMMessage[],
  options: LLMCallOptions = {},
): Promise<string> {
  const provider = process.env.LLM_PROVIDER ?? "gemini";
  const timeout = options.timeoutMs ?? getChatTimeoutMs();

  if (provider === "minimax") {
    return callMiniMax(toMiniMaxMessages(messages), options.temperature ?? 0.3, timeout);
  }

  // Default / fallback: Gemini
  const geminiContents = toGeminiContents(messages);
  return callGemini(geminiContents, options.maxOutputTokens ?? 512, options.temperature ?? 0.2, timeout);
}

/**
 * Unified streaming LLM call.  Yields text chunks as they arrive.
 * Falls back to callLLM (non-streaming) if the provider does not
 * support streaming — in that case yields a single chunk with the
 * full response.
 *
 * Throws errors with message codes: "missing_key" | "timeout" | "api_error"
 */
export async function* streamLLM(
  messages: LLMMessage[],
  options: LLMCallOptions = {},
): AsyncGenerator<string> {
  const provider = process.env.LLM_PROVIDER ?? "gemini";
  const timeout = options.timeoutMs ?? getChatTimeoutMs();

  if (provider === "minimax") {
    yield* streamMiniMax(toMiniMaxMessages(messages), options.temperature ?? 0.3, timeout);
    return;
  }

  // Default: Gemini streaming
  const geminiContents = toGeminiContents(messages);
  yield* streamGemini(geminiContents, options.maxOutputTokens ?? 512, options.temperature ?? 0.2, timeout);
}

/** Re-export the active provider name for logging purposes. */
export function getActiveLLMProvider(): string {
  return process.env.LLM_PROVIDER ?? "gemini";
}
