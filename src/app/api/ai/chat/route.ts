import { NextResponse } from "next/server";

const SYSTEM_PROMPT = `คุณคือ AI ผู้ช่วยจัดการงาน (Task Management Assistant)

กฎ:
- ต้องตอบเป็นภาษาไทย
- ใช้เฉพาะข้อมูลที่ให้เท่านั้น — ห้ามเดาหรือสร้างข้อมูลเอง
- ถ้าข้อมูลไม่เพียงพอ ให้บอกว่าไม่มีข้อมูล
- งานเสร็จ = task.is_completed หรือ list.is_done
- overdue = due_date < วันนี้ และ list.is_done = false
- ห้ามใช้ชื่อ list เพื่อตัดสินว่างานเสร็จ

รูปแบบการตอบ — ใช้ structure นี้เมื่อเหมาะสม:
📌 งานที่ควรโฟกัส
⚠️ ความเสี่ยง
📊 สถานะ
💡 คำแนะนำ

- ตอบสั้น กระชับ เป็นประโยชน์
- ใช้ bullet points เมื่อมีหลายรายการ
- ใส่ emoji เพื่อให้อ่านงาน
- ถ้าไม่มีงาน ให้บอกว่าไม่มี`;

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
    context?: Record<string, unknown>;
  };

  if (!message?.trim()) {
    return NextResponse.json(
      { reply: "", fallback: true, error: "Message is required" },
      { status: 400 },
    );
  }

  const contextJSON = context ? JSON.stringify(context) : "{}";
  const userContent = `ข้อมูลบอร์ด:\n${contextJSON}\n\nคำถาม: ${message}`;

  const contents = [
    { role: "user" as const, parts: [{ text: SYSTEM_PROMPT }] },
    {
      role: "model" as const,
      parts: [
        {
          text: "เข้าใจครับ ผมจะตอบเป็นภาษาไทย โดยใช้เฉพาะข้อมูลที่ให้มา ตามรูปแบบที่กำหนด",
        },
      ],
    },
    { role: "user" as const, parts: [{ text: userContent }] },
  ];

  try {
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const res = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 600,
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
    const rawReply =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    if (!rawReply) {
      return NextResponse.json(
        { reply: "", fallback: true, error: "Empty LLM response" },
        { status: 500 },
      );
    }

    const reply = rawReply.trim();

    return NextResponse.json({ reply });
  } catch (err) {
    console.error("[AI Chat] Unexpected error:", err);
    return NextResponse.json(
      { reply: "", fallback: true, error: "Unexpected error" },
      { status: 500 },
    );
  }
}
