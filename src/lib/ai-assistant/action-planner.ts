export type AssistantActionType =
  | "create_task"
  | "update_task"
  | "move_task"
  | "unknown";

export interface AssistantActionPlan {
  type: AssistantActionType;
  confidence: number;
  summary: string;
  requiresConfirmation: true;
  payload: {
    title?: string;
    taskTitle?: string;
    listName?: string;
    dueDateText?: string;
    priority?: string;
    assigneeName?: string;
    fields?: Record<string, unknown>;
  };
  warnings: string[];
}

const ACTION_KEYWORDS: { type: AssistantActionType; keywords: string[] }[] = [
  {
    type: "create_task",
    keywords: [
      "สร้าง", "เพิ่ม", "create", "add",
      "สร้าง task", "เพิ่ม task", "add task", "create task",
      "สร้างงาน", "เพิ่มงาน", "new task",
    ],
  },
  {
    type: "update_task",
    keywords: [
      "เปลี่ยน", "แก้", "update", "edit",
      "เปลี่ยน priority", "เปลี่ยน deadline", "เลื่อน",
      "อัปเดต", "update task", "แก้ไข",
    ],
  },
  {
    type: "move_task",
    keywords: [
      "ย้าย", "move",
      "ย้ายงาน", "ย้าย task", "move task", "move to",
    ],
  },
];

export function detectActionIntent(message: string): AssistantActionType {
  const lower = message.toLowerCase();

  for (const { type, keywords } of ACTION_KEYWORDS) {
    if (keywords.some((kw) => lower.includes(kw))) {
      return type;
    }
  }

  return "unknown";
}
