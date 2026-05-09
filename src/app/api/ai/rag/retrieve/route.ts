import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/api";
import { createClient } from "@/lib/auth/server";
import { retrieveTaskDocuments } from "@/lib/ai/rag/task-retriever";

export const runtime = "edge";

const MAX_MATCH_COUNT = 20;

export async function POST(request: Request) {
  // 0) Auth check
  // NOTE: workspace membership validation (workspaceId owned by user) is deferred to Phase 2C.
  const { response: authResponse } = await requireAuth();
  if (authResponse) return authResponse;

  const supabase = await createClient();

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
  const { query, workspaceId, boardId, matchCount = 5, matchThreshold } = raw;

  if (typeof query !== "string" || !query.trim()) {
    return NextResponse.json({ error: "query is required and must not be empty" }, { status: 400 });
  }

  if (typeof workspaceId !== "string" || !workspaceId.trim()) {
    return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
  }

  const parsedMatchCount = typeof matchCount === "number" ? matchCount : 5;
  if (!Number.isInteger(parsedMatchCount) || parsedMatchCount < 1 || parsedMatchCount > MAX_MATCH_COUNT) {
    return NextResponse.json(
      { error: `matchCount must be an integer between 1 and ${MAX_MATCH_COUNT}` },
      { status: 400 },
    );
  }

  const parsedMatchThreshold = matchThreshold === undefined ? 0 : typeof matchThreshold === "number" ? matchThreshold : 0;
  if (parsedMatchThreshold < 0 || parsedMatchThreshold > 1) {
    return NextResponse.json({ error: "matchThreshold must be between 0 and 1" }, { status: 400 });
  }

  if (boardId !== undefined && (typeof boardId !== "string" || !boardId.trim())) {
    return NextResponse.json({ error: "boardId must be a non-empty string" }, { status: 400 });
  }

  console.log("[RAG Retrieve] params:", {
    workspaceId,
    boardId: boardId ?? null,
    matchCount: parsedMatchCount,
    matchThreshold: parsedMatchThreshold,
  });

  try {
    const documents = await retrieveTaskDocuments(supabase, query.trim(), {
      workspaceId,
      boardId: typeof boardId === "string" ? boardId : undefined,
      matchCount: parsedMatchCount,
      matchThreshold: parsedMatchThreshold,
    });

    console.log("[RAG Retrieve] returned document count:", documents.length);
    return NextResponse.json({ documents });
  } catch (err) {
    console.error("[RAG Retrieve]", err);
    const message = err instanceof Error ? err.message : "Retrieval failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
