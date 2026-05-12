import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/api";
import { createClient } from "@/lib/auth/server";
import { reindexTasks } from "@/lib/ai/rag/task-indexer";

export const runtime = "edge";

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 50;

export async function POST(request: Request) {
  // 0) Auth check
  const { user, response: authResponse } = await requireAuth();
  if (authResponse) return authResponse;

  const supabase = await createClient();

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

  // Verify user is a member of the workspace
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId.trim())
    .eq("user_id", user!.id)
    .single();

  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // If boardId provided, verify it belongs to the workspace
  if (typeof boardId === "string" && boardId.trim()) {
    const { data: board } = await supabase
      .from("boards")
      .select("id")
      .eq("id", boardId.trim())
      .eq("workspace_id", workspaceId.trim())
      .single();

    if (!board) {
      return NextResponse.json({ error: "Board not found in workspace" }, { status: 404 });
    }
  }

  const t0 = Date.now();
  console.log("[RAG Reindex] start:", {
    workspaceId,
    boardId: boardId ?? null,
    limit,
    userId: user!.id,
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
