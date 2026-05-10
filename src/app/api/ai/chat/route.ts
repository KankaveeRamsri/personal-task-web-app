import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requireAuth } from "@/lib/auth/api";
import { detectAssistantIntent, type AssistantIntent } from "@/lib/ai-assistant/intent";
import {
  detectActionIntent,
  buildFallbackActionPlan,
  type AssistantActionPlan,
  type AssistantActionType,
} from "@/lib/ai-assistant/action-planner";
import { retrieveTaskDocuments, type TaskDocument } from "@/lib/ai/rag/task-retriever";
import { callLLM, getActiveLLMProvider, type LLMMessage } from "@/lib/ai/llm";

export const runtime = "edge";

// ── Constants ──────────────────────────────────────────────────────────

const MAX_MESSAGE_LENGTH = 500;
const MAX_CONTEXT_CHARS = 4000;

// ── Types ──────────────────────────────────────────────────────────────

type ErrorType = "invalid_request" | "missing_key" | "timeout" | "api_error";

interface FallbackResponse {
  reply: string;
  fallback: true;
  errorType: ErrorType;
}

type RagDocument = Pick<TaskDocument, "task_id" | "content" | "similarity" | "hybridScore" | "rankingSignals" | "board_id">;

const MAX_RAG_CONTENT_LENGTH = 300;

function buildRagSection(docs: RagDocument[]): string {
  if (!docs.length) return "";
  const lines = docs.map((d) => {
    const score = d.hybridScore !== undefined ? d.hybridScore.toFixed(3) : d.similarity.toFixed(3);
    return `- Task ID: ${d.task_id}\n  Content: ${d.content.slice(0, MAX_RAG_CONTENT_LENGTH)}\n  Score: ${score}`;
  });
  return `Relevant task context (ranked by relevance + urgency):\n${lines.join("\n")}`;
}

async function fetchRagInternal(
  workspaceId: string,
  query: string,
  boardId?: string,
): Promise<RagDocument[]> {
  try {
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
    } = await supabase.auth.getUser();
    if (!user) return [];

    console.log("[RAG Retrieve] params:", {
      workspaceId,
      boardId: boardId ?? null,
      matchCount: 5,
      matchThreshold: 0,
    });

    const docs = await retrieveTaskDocuments(supabase, query, {
      workspaceId,
      boardId,
      matchCount: 5,
      matchThreshold: 0,
    });

    console.log("[RAG Retrieve] returned document count:", docs.length);
    return docs;
  } catch {
    return [];
  }
}

function fallbackReply(errorType: ErrorType, status: number) {
  const messages: Record<ErrorType, string> = {
    invalid_request: "รูปแบบคำขอไม่ถูกต้อง กรุณาลองใหม่",
    missing_key: "ตอนนี้ AI แบบ LLM ยังไม่พร้อมใช้งาน เลยใช้ผลวิเคราะห์แบบ rule-based แทนครับ",
    timeout: "ระบบใช้เวลาตอบนานเกินไป กรุณาลองใหม่อีกครั้ง",
    api_error: "เกิดข้อผิดพลาดในการเชื่อมต่อ AI กรุณาลองใหม่",
  };
  return NextResponse.json(
    { reply: messages[errorType], fallback: true, errorType } satisfies FallbackResponse,
    { status },
  );
}

// ── LLM provider (abstracted) ──────────────────────────────────────────
// callLLM() is imported from @/lib/ai/llm and dispatches to MiniMax or
// Gemini based on the LLM_PROVIDER environment variable.

// ── Chat prompts ───────────────────────────────────────────────────────

const SYSTEM_PROMPT = `คุณคือ AI ผู้ช่วยจัดการงาน (Task Management Assistant)

กฎ:
- ต้องตอบเป็นภาษาไทย
- ใช้เฉพาะข้อมูลที่ให้เท่านั้น — ห้ามเดาหรือสร้างข้อมูลเอง
- ถ้าข้อมูลไม่เพียงพอ ให้บอกว่าไม่มีข้อมูล
- งานเสร็จ = task.is_completed หรือ list.is_done
- overdue = due_date < วันนี้ และ list.is_done = false
- ห้ามใช้ชื่อ list เพื่อตัดสินว่างานเสร็จ
- ถ้ามี "Relevant task context" ให้ใช้ข้อมูลนั้นตอบคำถามเกี่ยวกับงาน priority, due date, progress หรือ workload
- ถ้า context ไม่เพียงพอ ให้บอกสั้น ๆ ว่าไม่มีข้อมูล
- ห้ามสร้างรายละเอียดงานขึ้นเอง

รูปแบบการตอบ:
- ตอบสั้น กระชับ เป็นประโยชน์
- ใช้ bullet points เมื่อมีหลายรายการ
- ใส่ emoji เพื่อให้อ่านงาน
- ถ้าไม่มีงาน ให้บอกว่าไม่มี`;

const INTENT_INSTRUCTIONS: Record<AssistantIntent, string> = {
  focus: `เน้น: บอกงานที่ควรทำก่อน โดยพิจารณา:
- งาน overdue มากที่สุด
- งาน due วันนี้
- งาน priority สูง
ตอบเป็นลำดับความสำคัญ พร้อมเหตุผลว่าทำไมต้องทำก่อน`,
  summary: `เน้น: สรุปภาพรวมบอร์ด
- จำนวน tasks ทั้งหมด เสร็จแล้ว ค้างอยู่
- overdue / due today / near due
- bottleneck
ตอบเป็น overview กระชับ`,
  risk: `เน้น: วิเคราะห์ความเสี่ยง
- งาน overdue (เลยกี่วัน)
- งานใกล้ครบกำหนด
- งาน priority สูงที่ยังไม่เสร็จ
จัดระดับความเสี่ยงและแนะนำการจัดการ`,
  progress: `เน้น: รายงานความคืบหน้า
- Completion rate
- เทียบจำนวนเสร็จ vs ทั้งหมด
- Active tasks ที่เหลือ
ใช้แถบ progress หรือตัวเลขให้เห็นภาพ`,
  workload: `เน้น: วิเคราะห์ภาระงานต่อคน
- ใครมีงานเยอะที่สุด
- ใครมีงานน้อย
- งานที่ยังไม่มีคนรับผิดชอบ
แนะนำการกระจายงานหากไม่สมดุล`,
  general: `ตอบคำถามโดยใช้ข้อมูลที่ให้มาเท่านั้น ตอบให้ตรงประเด็น`,
};

// ── Action planning prompt ─────────────────────────────────────────────

const ACTION_SYSTEM_PROMPT = `You are an action plan extractor for a task management app.
Extract the user's intent into a structured JSON action plan.

Rules:
- Return ONLY valid JSON, no other text
- Do NOT execute any action
- Use null for fields that are unclear from the message
- If task/list name is ambiguous, add a warning string
- confidence is 0.0 to 1.0
- requiresConfirmation is always true
- summary must be in Thai

JSON format:
{
  "type": "${"create_task" as AssistantActionType}" | "${"update_task" as AssistantActionType}" | "${"move_task" as AssistantActionType}",
  "confidence": 0.85,
  "summary": "Thai summary of the planned action",
  "requiresConfirmation": true,
  "payload": {
    "title": "task title for create",
    "taskTitle": "existing task name for update/move",
    "listName": "target list name for move",
    "dueDateText": "due date text as mentioned",
    "priority": "none" | "low" | "medium" | "high",
    "assigneeName": "person name if mentioned"
  },
  "warnings": ["any ambiguity warnings"]
}`;

function buildActionPrompt(message: string, actionType: AssistantActionType): string {
  return `Action type to extract: ${actionType}

User message: ${message}

Return the JSON action plan:`;
}

// ── JSON parse helper ──────────────────────────────────────────────────

function parseActionPlan(raw: string, actionType: AssistantActionType): AssistantActionPlan | null {
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      type: parsed.type ?? actionType,
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
      summary: typeof parsed.summary === "string" ? parsed.summary : "ไม่สามารถวิเคราะห์ action ได้",
      requiresConfirmation: true,
      payload: {
        title: parsed.payload?.title ?? undefined,
        taskTitle: parsed.payload?.taskTitle ?? undefined,
        listName: parsed.payload?.listName ?? undefined,
        dueDateText: parsed.payload?.dueDateText ?? undefined,
        priority: parsed.payload?.priority ?? undefined,
        assigneeName: parsed.payload?.assigneeName ?? undefined,
        fields: parsed.payload?.fields ?? undefined,
      },
      warnings: Array.isArray(parsed.warnings)
        ? parsed.warnings.filter((w: unknown) => typeof w === "string")
        : [],
    };
  } catch {
    return null;
  }
}

// ── Route ──────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  // 0) Auth check
  const { user, response: authResponse } = await requireAuth();
  if (authResponse) return authResponse;
  void user;

  // 1) Environment check — provider-agnostic
  const provider = getActiveLLMProvider();
  const hasMinimaxKey = Boolean(process.env.MINIMAX_API_KEY);
  const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY);
  const keyAvailable = provider === "minimax" ? hasMinimaxKey : hasGeminiKey;
  if (!keyAvailable) {
    console.error(`[AI Chat] Missing API key for provider: ${provider}`);
    return fallbackReply("missing_key", 500);
  }

  // 2) Parse body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fallbackReply("invalid_request", 400);
  }

  // 3) Validate types
  if (
    !body ||
    typeof body !== "object" ||
    !("message" in body) ||
    typeof (body as Record<string, unknown>).message !== "string"
  ) {
    return fallbackReply("invalid_request", 400);
  }

  const { message, context, workspaceId, boardId, ragContext } = body as {
    message: string;
    context?: Record<string, unknown>;
    workspaceId?: string;
    boardId?: string;
    ragContext?: RagDocument[];
  };

  // 4) Validate message
  const trimmed = message.trim();
  if (!trimmed) {
    return fallbackReply("invalid_request", 400);
  }
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    return fallbackReply("invalid_request", 400);
  }

  // 5) Check for action intent
  const actionType = detectActionIntent(trimmed);
  console.log("[AI Chat] ACTION_INTENT:", actionType, "| message:", trimmed);

  if (actionType !== "unknown") {
    try {
      const actionMessages: LLMMessage[] = [
        { role: "system", content: ACTION_SYSTEM_PROMPT },
        { role: "assistant", content: "เข้าใจครับ ผมจะส่ง action plan เป็น JSON เท่านั้น" },
        { role: "user", content: buildActionPrompt(trimmed, actionType) },
      ];

      const rawReply = await callLLM(actionMessages, { temperature: 0.1, maxOutputTokens: 400 });
      const actionPlan = parseActionPlan(rawReply, actionType);

      if (actionPlan) {
        return NextResponse.json({
          reply: actionPlan.summary,
          actionPlan,
          requiresConfirmation: true,
          intent: "general",
        });
      }

      // Fallback: text preview if JSON parse fails
      return NextResponse.json({
        reply: rawReply,
        intent: "general",
      });
    } catch (err) {
      console.error("[AI Chat] Action planning LLM error:", err instanceof Error ? err.message : String(err));

      // Always try fallback — never execute action without confirmation
      const fallbackPlan = buildFallbackActionPlan(trimmed, actionType);
      if (fallbackPlan) {
        return NextResponse.json({
          reply: fallbackPlan.summary,
          actionPlan: fallbackPlan,
          requiresConfirmation: true,
          fallback: true
        });
      }

      if (err instanceof Error && err.message === "timeout") {
        return fallbackReply("timeout", 504);
      }
      if (err instanceof Error && err.message === "api_error") {
        return fallbackReply("api_error", 502);
      }
      return fallbackReply("api_error", 500);
    }
  }

  // 6) Normal chat flow
  const intent = detectAssistantIntent(trimmed);
  const intentInstruction = INTENT_INSTRUCTIONS[intent];

  let contextJSON = context ? JSON.stringify(context) : "{}";
  if (contextJSON.length > MAX_CONTEXT_CHARS) {
    contextJSON = contextJSON.slice(0, MAX_CONTEXT_CHARS);
  }

  const validRagDocs: RagDocument[] =
    typeof workspaceId === "string" && workspaceId.trim()
      ? await fetchRagInternal(
          workspaceId.trim(),
          trimmed,
          typeof boardId === "string" && boardId.trim() ? boardId.trim() : undefined,
        )
      : Array.isArray(ragContext)
        ? ragContext
        : [];
  const ragSection = buildRagSection(validRagDocs);

  const userContent = [
    `Intent: ${intent}`,
    intentInstruction,
    ...(ragSection ? [ragSection] : []),
    `ข้อมูลบอร์ด:`,
    contextJSON,
    `คำถาม: ${trimmed}`,
  ].join("\n");

  const chatMessages: LLMMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "assistant", content: "เข้าใจครับ ผมจะตอบเป็นภาษาไทย โดยใช้เฉพาะข้อมูลที่ให้มา ตาม intent ที่ระบุ" },
    { role: "user", content: userContent },
  ];

  const ragSources = validRagDocs.length
    ? validRagDocs.map((d) => ({
        taskId: d.task_id,
        similarity: d.similarity,
        hybridScore: d.hybridScore,
        rankingSignals: d.rankingSignals,
        preview: d.content.slice(0, 100),
        ...(d.board_id ? { boardId: d.board_id } : {}),
      }))
    : undefined;

  try {
    const rawReply = await callLLM(chatMessages);
    return NextResponse.json({
      reply: rawReply,
      intent,
      ...(ragSources ? { ragSources } : {}),
    });
  } catch (err) {
    console.error("[AI Chat] Chat LLM error:", err instanceof Error ? err.message : String(err));
    if (err instanceof Error && err.message === "timeout") {
      return fallbackReply("timeout", 504);
    }
    if (err instanceof Error && err.message === "api_error") {
      return fallbackReply("api_error", 502);
    }
    return fallbackReply("api_error", 500);
  }
}
