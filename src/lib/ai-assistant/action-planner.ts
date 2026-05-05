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

export function buildFallbackActionPlan(message: string, intent: AssistantActionType): AssistantActionPlan | null {
  const lower = message.toLowerCase();

  const extractDateAndPriority = () => {
    let dueDateText: string | undefined;
    const dateKeywords = ["วันนี้", "พรุ่งนี้", "มะรืน", "มะรืนนี้", "today", "tomorrow", "day after tomorrow"];
    for (const kw of dateKeywords) {
      if (lower.includes(kw)) {
        dueDateText = kw;
        break;
      }
    }
    const isoMatch = lower.match(/\d{4}-\d{2}-\d{2}/);
    if (isoMatch) {
      dueDateText = isoMatch[0];
    }
    let priority: string | undefined;
    const priorityKeywords = ["low", "medium", "high", "none"];
    for (const kw of priorityKeywords) {
      if (lower.includes(`priority ${kw}`) || lower.includes(`ความสำคัญ ${kw}`) || lower.includes(`ความสำคัญเป็น ${kw}`)) {
        priority = kw;
        break;
      }
    }
    return { dueDateText, priority };
  };

  if (intent === "create_task") {
    let title = "";
    const taskIdx = lower.indexOf("task");
    const nganIdx = lower.indexOf("งาน");

    let startIdx = -1;
    if (taskIdx !== -1) startIdx = taskIdx + 4;
    else if (nganIdx !== -1) startIdx = nganIdx + 3;

    if (startIdx !== -1) {
      title = message.substring(startIdx);
      const lowerTitle = title.toLowerCase();

      const stopKeywords = ["กำหนดส่ง", "deadline", "due", "priority"];
      let minIdx = title.length;
      for (const kw of stopKeywords) {
        const idx = lowerTitle.indexOf(kw);
        if (idx !== -1 && idx < minIdx) {
          minIdx = idx;
        }
      }
      title = title.substring(0, minIdx).trim();
    }

    if (!title) return null;

    const { dueDateText, priority } = extractDateAndPriority();

    return {
      type: "create_task",
      confidence: 0.6,
      summary: "ผมสร้าง action preview แบบ fallback ให้แล้วครับ กรุณาตรวจสอบก่อนกดยืนยัน",
      requiresConfirmation: true,
      payload: {
        title,
        dueDateText,
        priority,
      },
      warnings: ["ใช้ fallback parser เพราะ LLM ไม่พร้อมใช้งาน กรุณาตรวจสอบข้อมูลก่อนยืนยัน"]
    };
  }

  if (intent === "update_task") {
    let taskTitle = "";
    const taskIdx = lower.indexOf("task");
    const nganIdx = lower.indexOf("งาน");

    let startIdx = -1;
    if (taskIdx !== -1) startIdx = taskIdx + 4;
    else if (nganIdx !== -1) startIdx = nganIdx + 3;

    if (startIdx !== -1) {
      taskTitle = message.substring(startIdx);
      const lowerTitle = taskTitle.toLowerCase();
      const stopKeywords = ["เป็น", "to", "กำหนดส่ง", "deadline", "due", "priority"];
      let minIdx = taskTitle.length;
      for (const kw of stopKeywords) {
        const idx = lowerTitle.indexOf(kw);
        if (idx !== -1 && idx < minIdx) {
          minIdx = idx;
        }
      }
      taskTitle = taskTitle.substring(0, minIdx).trim();
    }

    if (!taskTitle) return null;

    const { dueDateText, priority } = extractDateAndPriority();

    let newTitle: string | undefined;
    const penIdx = lower.indexOf("เป็น");
    if (penIdx !== -1) {
       let potentialTitle = message.substring(penIdx + 4).trim();
       const stopKeywords = ["กำหนดส่ง", "deadline", "due", "priority"];
       let minIdx = potentialTitle.length;
       for (const kw of stopKeywords) {
         const idx = potentialTitle.toLowerCase().indexOf(kw);
         if (idx !== -1 && idx < minIdx) {
           minIdx = idx;
         }
       }
       potentialTitle = potentialTitle.substring(0, minIdx).trim();
       if (potentialTitle && !["วันนี้", "พรุ่งนี้", "มะรืน", "today", "tomorrow"].includes(potentialTitle.toLowerCase())) {
         if (!lower.includes("priority เป็น") && !lower.includes("ความสำคัญเป็น")) {
            newTitle = potentialTitle;
         }
       }
    }

    const fields: Record<string, unknown> = {};
    if (dueDateText) fields.dueDateText = dueDateText;
    if (priority) fields.priority = priority;
    if (newTitle) fields.title = newTitle;

    return {
      type: "update_task",
      confidence: 0.6,
      summary: "ผมสร้าง action preview แบบ fallback ให้แล้วครับ กรุณาตรวจสอบก่อนกดยืนยัน",
      requiresConfirmation: true,
      payload: {
        taskTitle,
        fields
      },
      warnings: ["ใช้ fallback parser เพราะ LLM ไม่พร้อมใช้งาน กรุณาตรวจสอบข้อมูลก่อนยืนยัน"]
    };
  }

  if (intent === "move_task") {
    let taskTitle = "";
    const taskIdx = lower.indexOf("task");
    const nganIdx = lower.indexOf("งาน");

    let startIdx = -1;
    if (taskIdx !== -1) startIdx = taskIdx + 4;
    else if (nganIdx !== -1) startIdx = nganIdx + 3;

    let listName = "";

    if (startIdx !== -1) {
      taskTitle = message.substring(startIdx);
      const lowerTitle = taskTitle.toLowerCase();
      const stopKeywords = ["ไปที่", "ไป", "to"];
      let minIdx = taskTitle.length;
      let usedKw = "";
      for (const kw of stopKeywords) {
        const idx = lowerTitle.indexOf(kw);
        if (idx !== -1 && idx < minIdx) {
          minIdx = idx;
          usedKw = kw;
        }
      }
      
      if (usedKw) {
         const kwIdxInMessage = message.toLowerCase().indexOf(usedKw, startIdx);
         listName = message.substring(kwIdxInMessage + usedKw.length).trim();
      }
      taskTitle = taskTitle.substring(0, minIdx).trim();
    }

    if (!taskTitle || !listName) return null;

    return {
      type: "move_task",
      confidence: 0.6,
      summary: "ผมสร้าง action preview แบบ fallback ให้แล้วครับ กรุณาตรวจสอบก่อนกดยืนยัน",
      requiresConfirmation: true,
      payload: {
        taskTitle,
        listName
      },
      warnings: ["ใช้ fallback parser เพราะ LLM ไม่พร้อมใช้งาน กรุณาตรวจสอบข้อมูลก่อนยืนยัน"]
    };
  }

  return null;
}
