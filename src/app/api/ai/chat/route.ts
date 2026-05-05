import { NextResponse } from "next/server";

const SYSTEM_PROMPT = `คุณคือ AI Assistant ช่วยจัดการงาน (Task Management Assistant)
คุณต้องตอบเป็นภาษาไทยเท่านั้น
คุณต้องใช้ข้อมูลที่ให้มาเท่านั้น ห้ามแต่งเรื่อง (no hallucination)

กฎการวิเคราะห์งาน:
- งานเสร็จแล้ว (DONE) = task.is_completed === true หรือ list.is_done === true
- งานเลยกำหนด (Overdue) = due_date < วันนี้ และ งานยังไม่เสร็จ (is_done === false)
- ห้ามใช้ชื่อ list เพื่อตัดสินว่างานเสร็จหรือไม่
- คุณอ่านข้อมูลได้อย่างเดียว (read-only) ห้ามแนะนำให้แก้ไข/ลบงานโดยตรง

รูปแบบการตอบ:
- ตอบสั้น กระชับ เป็นประโยชน์
- ใช้ bullet points เมื่อมีหลายรายการ
- ใส่ emoji เพื่อให้อ่านง่ายเมื่อเหมาะสม
- ถ้าข้อมูลไม่พอ ให้แจ้งว่าไม่มีข้อมูลเพียงพอ`;

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { reply: "", fallback: true, error: "GEMINI_API_KEY not configured" },
      { status: 500 },
    );
  }

  let body: { message?: string; context?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { reply: "", fallback: true, error: "Invalid JSON" },
      { status: 400 },
    );
  }

  const { message, context } = body as {
    message?: string;
    context?: { boardName?: string; summary?: unknown; insights?: unknown };
  };

  if (!message?.trim()) {
    return NextResponse.json(
      { reply: "", fallback: true, error: "Message is required" },
      { status: 400 },
    );
  }

  const contextSection = context
    ? `\n\nข้อมูลบอร์ด${context.boardName ? ` "${context.boardName}"` : ""}:\n${JSON.stringify(context, null, 2)}`
    : "";

  const contents = [
    { role: "user" as const, parts: [{ text: SYSTEM_PROMPT }] },
    { role: "model" as const, parts: [{ text: "เข้าใจครับ ผมพร้อมช่วยวิเคราะห์งานจากข้อมูลที่ให้มา" }] },
    { role: "user" as const, parts: [{ text: `${contextSection}\n\nคำถาม: ${message}` }] },
  ];

  try {
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const res = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 800,
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[AI Chat] Gemini API error:", res.status, errText);
      return NextResponse.json(
        { reply: "", fallback: true, error: "LLM request failed" },
        { status: 500 },
      );
    }

    const data = await res.json();
    const reply =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    if (!reply) {
      return NextResponse.json(
        { reply: "", fallback: true, error: "Empty LLM response" },
        { status: 500 },
      );
    }

    return NextResponse.json({ reply });
  } catch (err) {
    console.error("[AI Chat] Unexpected error:", err);
    return NextResponse.json(
      { reply: "", fallback: true, error: "Unexpected error" },
      { status: 500 },
    );
  }
}
