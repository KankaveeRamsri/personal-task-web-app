/**
 * MiniMax LLM client — server-side only.
 * Uses the OpenAI-compatible Chat Completions endpoint.
 *
 * Environment variables required (never NEXT_PUBLIC_*):
 *   MINIMAX_API_KEY   — secret API key
 *   MINIMAX_BASE_URL  — base URL, default https://api.minimax.io/v1
 *   MINIMAX_MODEL     — model name, default MiniMax-M2.7-highspeed
 */

const DEFAULT_BASE_URL = "https://api.minimax.io/v1";
const DEFAULT_MODEL = "MiniMax-M2.7-highspeed";
const MINIMAX_TIMEOUT_MS = 30_000;

export interface MiniMaxMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Call MiniMax Chat Completions API.
 * Returns the assistant's plain-text reply.
 * Throws an Error with message "timeout" or "api_error" on failure —
 * never leaks the API key in error messages.
 */
export async function callMiniMax(
  messages: MiniMaxMessage[],
  temperature = 0.3,
): Promise<string> {
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) {
    throw new Error("missing_key");
  }

  const baseUrl =
    process.env.MINIMAX_BASE_URL?.replace(/\/$/, "") ?? DEFAULT_BASE_URL;
  const model = process.env.MINIMAX_MODEL ?? DEFAULT_MODEL;
  const url = `${baseUrl}/chat/completions`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), MINIMAX_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      // Log status without exposing the key
      console.error(`[MiniMax] API error: HTTP ${res.status}`);
      throw new Error("api_error");
    }

    const data = await res.json();
    const text: unknown = data?.choices?.[0]?.message?.content;

    if (typeof text !== "string" || !text.trim()) {
      console.error("[MiniMax] Empty or invalid response content");
      throw new Error("api_error");
    }

    return text.trim();
  } catch (err) {
    clearTimeout(timeoutId);

    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("timeout");
    }
    // Re-throw recognised error codes as-is; wrap unexpected errors
    if (err instanceof Error && (err.message === "api_error" || err.message === "missing_key")) {
      throw err;
    }
    console.error("[MiniMax] Unexpected error:", err instanceof Error ? err.message : String(err));
    throw new Error("api_error");
  }
}
