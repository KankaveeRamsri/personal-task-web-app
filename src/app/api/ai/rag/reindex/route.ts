import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { reindexTasks } from "@/lib/ai/rag/task-indexer";

export const runtime = "edge";

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 50;

export async function POST(request: Request) {
  // Auth: cookie-based Supabase session, anon key only (respects RLS)
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const raw = body as Record<string, unknown>;
  const { workspaceId, boardId, limit: rawLimit } = raw;

  // Validate workspaceId
  if (typeof workspaceId !== "string" || !workspaceId.trim()) {
    return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
  }

  // Validate boardId (optional)
  if (boardId !== undefined && (typeof boardId !== "string" || !boardId.trim())) {
    return NextResponse.json({ error: "boardId must be a non-empty string if provided" }, { status: 400 });
  }

  // Validate limit (1–100, default 50)
  const limit =
    typeof rawLimit === "number" && rawLimit > 0
      ? Math.min(Math.floor(rawLimit), MAX_LIMIT)
      : DEFAULT_LIMIT;

  const t0 = Date.now();
  console.log("[RAG Reindex] start:", {
    workspaceId,
    boardId: boardId ?? null,
    limit,
    userId: user.id,
  });

  try {
    const result = await reindexTasks(supabase, {
      workspaceId: workspaceId.trim(),
      boardId: typeof boardId === "string" ? boardId.trim() : undefined,
      limit,
    });

    const durationMs = Date.now() - t0;
    console.log("[RAG Reindex] done:", { ...result, durationMs });

    return NextResponse.json({
      success: true,
      indexed: result.indexed,
      failed: result.failed,
      errors: result.errors,
      durationMs,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Reindex failed";
    console.error("[RAG Reindex] error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
