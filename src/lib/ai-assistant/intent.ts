export type AssistantIntent =
  | "focus"
  | "summary"
  | "risk"
  | "progress"
  | "workload"
  | "general";

const INTENT_KEYWORDS: { intent: AssistantIntent; keywords: string[] }[] = [
  {
    intent: "focus",
    keywords: [
      "โฟกัส", "ทำอะไร", "ทำก่อน", "ควรทำ", "งานสำคัญ",
      "priority", "focus", "urgent", "important",
    ],
  },
  {
    intent: "summary",
    keywords: [
      "สรุป", "ภาพรวม", "overview", "summarize", "board",
      "บอร์ดนี้", "สถานการณ์",
    ],
  },
  {
    intent: "risk",
    keywords: [
      "เสี่ยง", "risk", "overdue", "ล่าช้า", "เลยกำหนด",
      "deadline", "ความเสี่ยง", "วิเคราะห์", "ด่วน",
    ],
  },
  {
    intent: "progress",
    keywords: [
      "progress", "completion", "เสร็จ", "productivity",
      "ความคืบหน้า", "เปอร์เซ็นต์", "สถิติ",
    ],
  },
  {
    intent: "workload",
    keywords: [
      "workload", "ใครงาน", "assignee", "ภาระ", "load",
      "ทีม", "แบ่งงาน",
    ],
  },
];

export function detectAssistantIntent(message: string): AssistantIntent {
  const lower = message.toLowerCase();

  for (const { intent, keywords } of INTENT_KEYWORDS) {
    if (keywords.some((kw) => lower.includes(kw))) {
      return intent;
    }
  }

  return "general";
}
