/**
 * Gemini LLM client — server-side only.
 * Wraps the existing Gemini generateContent call that was previously
 * inlined in the chat route, kept here as a fallback provider.
 *
 * Environment variables required:
 *   GEMINI_API_KEY — Google AI Studio key
 */

const GEMINI_FALLBACK_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_OUTPUT_TOKENS = 512;

export interface GeminiContentPart {
  text: string;
}

export interface GeminiContent {
  role: string;
  parts: GeminiContentPart[];
}

/**
 * Call the Gemini generateContent API.
 * Returns the assistant's plain-text reply.
 * Throws an Error with message "timeout" or "api_error" on failure.
 */
export async function callGemini(
  contents: GeminiContent[],
  maxOutputTokens: number = DEFAULT_MAX_OUTPUT_TOKENS,
  temperature = 0.2,
  timeoutMs: number = GEMINI_FALLBACK_TIMEOUT_MS,
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("missing_key");
  }

  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        generationConfig: {
          temperature,
          maxOutputTokens,
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      console.error(`[Gemini] API error: HTTP ${res.status}`);
      throw new Error("api_error");
    }

    const data = await res.json();
    const rawReply: unknown = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (typeof rawReply !== "string" || !rawReply.trim()) {
      throw new Error("api_error");
    }

    return rawReply.trim();
  } catch (err) {
    clearTimeout(timeoutId);

    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("timeout");
    }
    if (err instanceof Error && (err.message === "api_error" || err.message === "missing_key")) {
      throw err;
    }
    console.error("[Gemini] Unexpected error:", err instanceof Error ? err.message : String(err));
    throw new Error("api_error");
  }
}

/**
 * Stream the Gemini streamGenerateContent API.
 * Yields text chunks as they arrive.
 * Throws an Error with message "timeout" or "api_error" on failure.
 */
export async function* streamGemini(
  contents: GeminiContent[],
  maxOutputTokens: number = DEFAULT_MAX_OUTPUT_TOKENS,
  temperature = 0.2,
  timeoutMs: number = GEMINI_FALLBACK_TIMEOUT_MS,
): AsyncGenerator<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("missing_key");
  }

  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=${apiKey}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        generationConfig: {
          temperature,
          maxOutputTokens,
        },
      }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("timeout");
    }
    console.error("[Gemini Stream] Connection error:", err instanceof Error ? err.message : String(err));
    throw new Error("api_error");
  }

  clearTimeout(timeoutId);

  if (!res.ok) {
    console.error(`[Gemini Stream] API error: HTTP ${res.status}`);
    throw new Error("api_error");
  }

  const reader = res.body?.getReader();
  if (!reader) {
    throw new Error("api_error");
  }

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data: ")) continue;
        const jsonStr = trimmed.slice(6);
        if (!jsonStr || jsonStr === "[DONE]") continue;

        try {
          const parsed = JSON.parse(jsonStr);
          const text: unknown = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (typeof text === "string" && text) {
            yield text;
          }
        } catch {
          // skip malformed SSE lines
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
