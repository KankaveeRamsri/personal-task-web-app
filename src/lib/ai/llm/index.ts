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

// ── Think-tag sanitization ────────────────────────────────────────────

/** Strip <think>...</think> blocks from a complete response string. */
function stripThinkTags(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

/**
 * Returns the length of the longest suffix of `str` that is also a
 * prefix of "<think>" (lowercase).  Used to hold back potential split tags.
 */
function longestOpenTagSuffix(str: string): number {
  const tag = "<think>";
  for (let i = Math.min(str.length, tag.length - 1); i > 0; i--) {
    if (str.toLowerCase().endsWith(tag.slice(0, i))) return i;
  }
  return 0;
}

/**
 * Wrap an async generator of text chunks, removing <think>...</think>
 * content even when the tags are split across chunk boundaries.
 */
async function* applyThinkFilter(
  source: AsyncGenerator<string>,
): AsyncGenerator<string> {
  let inThink = false;
  let tagBuffer = "";

  for await (const chunk of source) {
    let remaining = tagBuffer + chunk;
    tagBuffer = "";
    let output = "";

    while (remaining.length > 0) {
      if (inThink) {
        const closeIdx = remaining.search(/<\/think>/i);
        if (closeIdx !== -1) {
          // Found closing tag — exit think mode, keep everything after it
          remaining = remaining.slice(closeIdx + "</think>".length);
          inThink = false;
        } else {
          // May contain a partial </think> at the end; hold back up to 8 chars
          const keep = Math.min(remaining.length, 7);
          tagBuffer = remaining.slice(remaining.length - keep);
          remaining = "";
        }
      } else {
        const openIdx = remaining.search(/<think>/i);
        if (openIdx !== -1) {
          // Flush text before the tag, then enter think mode
          output += remaining.slice(0, openIdx);
          remaining = remaining.slice(openIdx + "<think>".length);
          inThink = true;
        } else {
          // Check for a partial <think> tag at the very end of this chunk
          const partial = longestOpenTagSuffix(remaining);
          if (partial > 0) {
            output += remaining.slice(0, remaining.length - partial);
            tagBuffer = remaining.slice(remaining.length - partial);
          } else {
            output += remaining;
          }
          remaining = "";
        }
      }
    }

    if (output) yield output;
  }

  // Any remaining buffer that did not form a complete <think> tag is real content
  if (tagBuffer && !inThink) {
    yield tagBuffer;
  }
}

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
    return stripThinkTags(
      await callMiniMax(toMiniMaxMessages(messages), options.temperature ?? 0.3, timeout),
    );
  }

  // Default / fallback: Gemini
  const geminiContents = toGeminiContents(messages);
  return stripThinkTags(
    await callGemini(geminiContents, options.maxOutputTokens ?? 512, options.temperature ?? 0.2, timeout),
  );
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
    yield* applyThinkFilter(
      streamMiniMax(toMiniMaxMessages(messages), options.temperature ?? 0.3, timeout),
    );
    return;
  }

  // Default: Gemini streaming
  const geminiContents = toGeminiContents(messages);
  yield* applyThinkFilter(
    streamGemini(geminiContents, options.maxOutputTokens ?? 512, options.temperature ?? 0.2, timeout),
  );
}

/** Re-export the active provider name for logging purposes. */
export function getActiveLLMProvider(): string {
  return process.env.LLM_PROVIDER ?? "gemini";
}
