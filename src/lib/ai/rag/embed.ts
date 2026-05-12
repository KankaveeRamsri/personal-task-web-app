/**
 * Shared embedding module with provider-based switching and automatic fallback.
 *
 * Modes (EMBEDDING_PROVIDER env var):
 *   "auto"   (default) — OpenAI first, falls back to local service on failure.
 *   "openai"          — OpenAI only, no fallback.
 *   "local"           — sentence-transformers service only, no fallback.
 *
 * Both providers return vectors matching OPENAI_EMBEDDING_DIMENSIONS (default 384)
 * so the existing pgvector column works without migration.
 *
 * WARNING: OpenAI and sentence-transformers produce vectors in different
 * embedding spaces. Mixing vectors from both providers in the same
 * `task_documents` table will degrade retrieval quality because similarity
 * scores become meaningless across spaces. If you reindex with OpenAI,
 * retrieval should also prefer OpenAI. The local fallback exists solely for
 * availability, not for interleaving with OpenAI-indexed documents.
 */

const DEFAULT_DIM = 384;
const OPENAI_TIMEOUT_MS = 15_000;

export type EmbeddingProvider = "auto" | "openai" | "local";

function getProvider(): EmbeddingProvider {
  const raw = process.env.EMBEDDING_PROVIDER?.trim().toLowerCase();
  if (raw === "openai" || raw === "local") return raw;
  return "auto";
}

function getDimensions(): number {
  const raw = process.env.OPENAI_EMBEDDING_DIMENSIONS;
  if (!raw) return DEFAULT_DIM;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_DIM;
}

// ── Local: sentence-transformers via FastAPI ──────────────────────────────────

async function embedLocal(text: string): Promise<number[]> {
  const dim = getDimensions();
  const baseUrl = process.env.EMBEDDING_SERVICE_URL;
  if (!baseUrl) throw new Error("EMBEDDING_SERVICE_URL not configured");

  const res = await fetch(`${baseUrl}/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  if (!res.ok) throw new Error(`Embedding service returned ${res.status}`);

  const data = await res.json();
  const embedding: unknown = data?.embedding;

  if (!Array.isArray(embedding) || embedding.length !== dim) {
    throw new Error(
      `Invalid embedding: expected ${dim} dims, got ${Array.isArray(embedding) ? embedding.length : typeof embedding}`,
    );
  }

  return embedding as number[];
}

// ── OpenAI: text-embedding-3-small ────────────────────────────────────────────

async function embedOpenAI(text: string): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

  const model = process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";
  const dim = getDimensions();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, input: text, dimensions: dim }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error(`OpenAI embeddings timed out after ${OPENAI_TIMEOUT_MS}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const body = await res.text();
    // Redact any accidental key leakage — never log the Authorization header.
    const safe = body.replace(/sk-[A-Za-z0-9]+/g, "sk-***REDACTED***");
    throw new Error(`OpenAI embeddings error ${res.status}: ${safe}`);
  }

  const data = await res.json();
  const embedding: unknown = data?.data?.[0]?.embedding;

  if (!Array.isArray(embedding) || embedding.length !== dim) {
    throw new Error(
      `Invalid OpenAI embedding: expected ${dim} dims, got ${Array.isArray(embedding) ? embedding.length : typeof embedding}`,
    );
  }

  return embedding as number[];
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Embed a single text string using the configured provider.
 *
 * - "auto": tries OpenAI first, falls back to local on failure.
 * - "openai": OpenAI only (throws on failure).
 * - "local": local service only (throws on failure).
 */
export async function embedText(text: string): Promise<number[]> {
  const provider = getProvider();

  if (provider === "local") return embedLocal(text);
  if (provider === "openai") return embedOpenAI(text);

  // "auto" — OpenAI first, then fallback
  try {
    return await embedOpenAI(text);
  } catch (openaiErr) {
    const msg = openaiErr instanceof Error ? openaiErr.message : "unknown OpenAI error";
    console.warn(`[embed] OpenAI failed, falling back to local: ${msg}`);

    try {
      return await embedLocal(text);
    } catch (localErr) {
      const localMsg = localErr instanceof Error ? localErr.message : "unknown local error";
      throw new Error(
        `Embedding failed for both providers — OpenAI: ${msg}; Local: ${localMsg}`,
      );
    }
  }
}
