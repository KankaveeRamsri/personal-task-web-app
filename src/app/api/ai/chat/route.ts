import { NextResponse } from "next/server";
import { detectAssistantIntent, type AssistantIntent } from "@/lib/ai-assistant/intent";

// ── Constants ──────────────────────────────────────────────────────────

const MAX_MESSAGE_LENGTH = 500;
const MAX_CONTEXT_CHARS = 4000;
const GEMINI_TIMEOUT_MS = 10_000;
const MAX_OUTPUT_TOKENS = 512;

// ── Types ──────────────────────────────────────────────────────────────

type ErrorType = "invalid_request" | "missing_key" | "timeout" | "api_error";

interface FallbackResponse {
  reply: string;
  fallback: true;
  errorType: ErrorType;
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

// ── Prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `คุณคือ AI ผู้ช่วยจัดการงาน (Task Management Assistant)

กฎ:
- ต้องตอบเป็นภาษาไทย
- ใช้เฉพาะข้อมูลที่ให้เท่านั้น — ห้ามเดาหรือสร้างข้อมูลเอง
- ถ้าข้อมูลไม่เพียงพอ ให้บอกว่าไม่มีข้อมูล
- งานเสร็จ = task.is_completed หรือ list.is_done
- overdue = due_date < วันนี้ และ list.is_done = false
- ห้ามใช้ชื่อ list เพื่อตัดสินว่างานเสร็จ

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

// ── Route ──────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  // 1) Environment check
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
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

  const { message, context } = body as {
    message: string;
    context?: Record<string, unknown>;
  };

  // 4) Validate message
  const trimmed = message.trim();
  if (!trimmed) {
    return fallbackReply("invalid_request", 400);
  }
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    return fallbackReply("invalid_request", 400);
  }

  // 5) Build prompt
  const intent = detectAssistantIntent(trimmed);
  const intentInstruction = INTENT_INSTRUCTIONS[intent];

  let contextJSON = context ? JSON.stringify(context) : "{}";
  if (contextJSON.length > MAX_CONTEXT_CHARS) {
    contextJSON = contextJSON.slice(0, MAX_CONTEXT_CHARS);
  }

  const userContent = [
    `Intent: ${intent}`,
    intentInstruction,
    `ข้อมูลบอร์ด:`,
    contextJSON,
    `คำถาม: ${trimmed}`,
  ].join("\n");

  const contents = [
    { role: "user" as const, parts: [{ text: SYSTEM_PROMPT }] },
    {
      role: "model" as const,
      parts: [{ text: "เข้าใจครับ ผมจะตอบเป็นภาษาไทย โดยใช้เฉพาะข้อมูลที่ให้มา ตาม intent ที่ระบุ" }],
    },
    { role: "user" as const, parts: [{ text: userContent }] },
  ];

  // 6) Call Gemini with timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  try {
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const res = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: MAX_OUTPUT_TOKENS,
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const errStatus = res.status;
      console.error(`[AI Chat] Gemini API error: ${errStatus}`);
      return fallbackReply("api_error", 502);
    }

    const data = await res.json();
    const rawReply = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    if (!rawReply) {
      return fallbackReply("api_error", 502);
    }

    return NextResponse.json({ reply: rawReply.trim(), intent });
  } catch (err) {
    clearTimeout(timeoutId);

    if (err instanceof DOMException && err.name === "AbortError") {
      console.error("[AI Chat] Request timed out");
      return fallbackReply("timeout", 504);
    }

    console.error("[AI Chat] Unexpected error");
    return fallbackReply("api_error", 500);
  }
}
