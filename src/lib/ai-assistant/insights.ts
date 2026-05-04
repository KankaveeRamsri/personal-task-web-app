import type { Task, List } from "@/types/database";

// ── Helpers ──────────────────────────────────────────────────────────

function getListMap(lists: List[]): Map<string, List> {
  return new Map(lists.map((l) => [l.id, l]));
}

export function isTaskDone(task: Task, lists: List[]): boolean {
  if (task.is_completed) return true;
  const list = getListMap(lists).get(task.list_id);
  return list?.is_done === true;
}

function isOverdue(task: Task, lists: List[]): boolean {
  if (!task.due_date) return false;
  if (isTaskDone(task, lists)) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(task.due_date) < today;
}

function isDueToday(task: Task): boolean {
  if (!task.due_date) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(task.due_date);
  due.setHours(0, 0, 0, 0);
  return due.getTime() === today.getTime();
}

const PRIORITY_ORDER: Record<string, number> = {
  high: 3,
  medium: 2,
  low: 1,
  none: 0,
};

function daysOverdue(dueDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
}

function getListTitle(listId: string, lists: List[]): string {
  return getListMap(lists).get(listId)?.title ?? "Unknown";
}

// ── Insight Functions ────────────────────────────────────────────────

export function getOverdueTasks(tasks: Task[], lists: List[]): Task[] {
  return tasks.filter((t) => isOverdue(t, lists));
}

export function getTasksDueToday(tasks: Task[], lists: List[]): Task[] {
  return tasks.filter((t) => isDueToday(t) && !isTaskDone(t, lists));
}

export function getCompletedStats(tasks: Task[], lists: List[]): {
  total: number;
  completed: number;
} {
  const total = tasks.length;
  const completed = tasks.filter((t) => isTaskDone(t, lists)).length;
  return { total, completed };
}

export function getBottleneckList(
  lists: List[],
  tasks: Task[],
): { title: string; count: number } | null {
  const nonDoneLists = lists.filter((l) => !l.is_done);
  if (nonDoneLists.length === 0) return null;

  let worst: { title: string; count: number } | null = null;
  for (const list of nonDoneLists) {
    const pending = tasks.filter(
      (t) => t.list_id === list.id && !t.is_completed,
    ).length;
    if (!worst || pending > worst.count) {
      worst = { title: list.title, count: pending };
    }
  }
  return worst;
}

export function getFocusTasks(tasks: Task[], lists: List[]): Task[] {
  const candidates = tasks.filter((t) => !isTaskDone(t, lists));

  return candidates.sort((a, b) => {
    // Overdue first
    const aOverdue = isOverdue(a, lists);
    const bOverdue = isOverdue(b, lists);
    if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;

    // Due today next
    const aToday = isDueToday(a);
    const bToday = isDueToday(b);
    if (aToday !== bToday) return aToday ? -1 : 1;

    // Higher priority next
    const aPri = PRIORITY_ORDER[a.priority] ?? 0;
    const bPri = PRIORITY_ORDER[b.priority] ?? 0;
    if (aPri !== bPri) return bPri - aPri;

    // Earlier due date next
    if (a.due_date && b.due_date) {
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    }
    if (a.due_date) return -1;
    if (b.due_date) return 1;

    return 0;
  });
}

// ── Response Formatters (Thai) ───────────────────────────────────────

export function formatFocusResponse(tasks: Task[], lists: List[]): string {
  const focus = getFocusTasks(tasks, lists);
  if (focus.length === 0) {
    return "✅ ไม่มีงานที่ต้องทำแล้ว — บอร์ดนี้เสร็จหมดแล้วครับ!";
  }

  const top = focus.slice(0, 5);
  const lines = top.map((t) => {
    const tags: string[] = [];
    if (isOverdue(t, lists)) tags.push(`⚠️ เลยกำหนด ${daysOverdue(t.due_date!)} วัน`);
    else if (isDueToday(t)) tags.push("📌 ครบกำหนดวันนี้");
    if (t.priority === "high") tags.push("🔴 priority สูง");
    else if (t.priority === "medium") tags.push("🟡 priority กลาง");
    const tag = tags.length > 0 ? ` (${tags.join(", ")})` : "";
    return `- ${t.title}${tag}`;
  });

  const header = `📌 งานที่ควรโฟกัสวันนี้:`;
  const remaining = focus.length > 5 ? `\n...และอีก ${focus.length - 5} งาน` : "";
  return `${header}\n${lines.join("\n")}${remaining}`;
}

export function formatOverdueResponse(tasks: Task[], lists: List[]): string {
  const overdue = getOverdueTasks(tasks, lists);
  if (overdue.length === 0) {
    return "✅ ไม่มีงานที่เสี่ยง overdue ครับ — จัดการได้ดีมาก!";
  }

  const lines = overdue.map(
    (t) => `- ${t.title} (เลยกำหนด ${daysOverdue(t.due_date!)} วัน · ${getListTitle(t.list_id, lists)})`,
  );
  return `⚠️ มี ${overdue.length} งานที่เลยกำหนด:\n${lines.join("\n")}`;
}

export function formatProgressResponse(tasks: Task[], lists: List[]): string {
  const { total, completed } = getCompletedStats(tasks, lists);
  if (total === 0) {
    return "📊 ยังไม่มีงานในบอร์ดนี้ครับ";
  }

  const pct = Math.round((completed / total) * 100);
  const bar = renderBar(pct);
  const bottleneck = getBottleneckList(lists, tasks);
  const bottleneckLine = bottleneck
    ? `\n\n🚧 คอขวด: List "${bottleneck.title}" มีงานค้างอยู่ ${bottleneck.count} งาน`
    : "";

  return `📊 Progress ตอนนี้:\n${completed} / ${total} งานเสร็จแล้ว (${pct}%)\n${bar}${bottleneckLine}`;
}

export function formatBoardSummary(tasks: Task[], lists: List[]): string {
  if (tasks.length === 0 && lists.length === 0) {
    return "📋 ยังไม่มีข้อมูลในบอร์ดนี้ครับ — ลองสร้าง list และ task ก่อนนะ";
  }

  const { total, completed } = getCompletedStats(tasks, lists);
  const overdue = getOverdueTasks(tasks, lists);
  const dueToday = getTasksDueToday(tasks, lists);
  const bottleneck = getBottleneckList(lists, tasks);

  const parts: string[] = [];
  parts.push(`📋 สรุปบอร์ดนี้:`);
  parts.push(`- ${lists.length} lists, ${total} tasks`);
  parts.push(`- เสร็จแล้ว ${completed}/${total} งาน`);

  if (overdue.length > 0) {
    parts.push(`- ⚠️ ${overdue.length} งานเลยกำหนด`);
  }
  if (dueToday.length > 0) {
    parts.push(`- 📌 ${dueToday.length} งานครบกำหนดวันนี้`);
  }
  if (bottleneck) {
    parts.push(`- 🚧 คอขวด: "${bottleneck.title}" (${bottleneck.count} งานค้าง)`);
  }

  return parts.join("\n");
}

function renderBar(pct: number): string {
  const filled = Math.round(pct / 5);
  const empty = 20 - filled;
  return `[${"█".repeat(filled)}${"░".repeat(empty)}] ${pct}%`;
}
