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

export function isNearDue(task: Task, lists: List[]): boolean {
  if (!task.due_date) return false;
  if (isTaskDone(task, lists)) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(task.due_date);
  due.setHours(0, 0, 0, 0);
  const diffDays = Math.floor(
    (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );
  return diffDays >= 1 && diffDays <= 2;
}

function isOverdueLong(task: Task, lists: List[]): boolean {
  if (!isOverdue(task, lists)) return false;
  return daysOverdue(task.due_date!) > 3;
}

const PRIORITY_ORDER: Record<string, number> = {
  high: 3,
  medium: 2,
  low: 1,
  none: 0,
};

export function daysOverdue(dueDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
}

function getListTitle(listId: string, lists: List[]): string {
  return getListMap(lists).get(listId)?.title ?? "Unknown";
}

// ── Basic Insight Functions ──────────────────────────────────────────

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
    const aOverdue = isOverdue(a, lists);
    const bOverdue = isOverdue(b, lists);
    if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;

    const aToday = isDueToday(a);
    const bToday = isDueToday(b);
    if (aToday !== bToday) return aToday ? -1 : 1;

    const aPri = PRIORITY_ORDER[a.priority] ?? 0;
    const bPri = PRIORITY_ORDER[b.priority] ?? 0;
    if (aPri !== bPri) return bPri - aPri;

    if (a.due_date && b.due_date) {
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    }
    if (a.due_date) return -1;
    if (b.due_date) return 1;

    return 0;
  });
}

// ── Advanced Insight Functions ───────────────────────────────────────

export interface RiskTasks {
  nearDue: Task[];
  overdueLong: Task[];
  highRisk: Task[];
}

export function getRiskTasks(tasks: Task[], lists: List[]): RiskTasks {
  const nearDue = tasks.filter((t) => isNearDue(t, lists));
  const overdueLong = tasks.filter((t) => isOverdueLong(t, lists));

  const highRisk = tasks.filter((t) => {
    if (isTaskDone(t, lists)) return false;
    if (isOverdueLong(t, lists)) return true;
    if (t.priority === "high" && isOverdue(t, lists)) return true;
    if (t.priority === "high" && isNearDue(t, lists)) return true;
    return false;
  });

  return { nearDue, overdueLong, highRisk };
}

export interface ProductivityStats {
  completionRate: number;
  overdueRate: number;
  activeTasks: number;
  totalTasks: number;
}

export function getProductivityStats(
  tasks: Task[],
  lists: List[],
): ProductivityStats {
  const total = tasks.length;
  if (total === 0) {
    return { completionRate: 0, overdueRate: 0, activeTasks: 0, totalTasks: 0 };
  }

  const completed = tasks.filter((t) => isTaskDone(t, lists)).length;
  const overdue = tasks.filter((t) => isOverdue(t, lists)).length;
  const active = tasks.filter((t) => !isTaskDone(t, lists)).length;

  return {
    completionRate: Math.round((completed / total) * 100),
    overdueRate: Math.round((overdue / total) * 100),
    activeTasks: active,
    totalTasks: total,
  };
}

export interface WorkloadEntry {
  assigneeId: string | null;
  count: number;
}

export function getWorkloadByUser(tasks: Task[]): WorkloadEntry[] {
  const map = new Map<string | null, number>();
  for (const t of tasks) {
    if (!isTaskDoneByList(t)) continue; // only active tasks
    const key = t.assignee_id;
    map.set(key, (map.get(key) ?? 0) + 1);
  }

  const entries: WorkloadEntry[] = [];
  for (const [assigneeId, count] of map) {
    entries.push({ assigneeId, count });
  }
  return entries.sort((a, b) => b.count - a.count);
}

// Lightweight done check without lists (uses is_completed only)
function isTaskDoneByList(task: Task): boolean {
  return !task.is_completed;
}

export function getSmartSuggestions(tasks: Task[], lists: List[]): string[] {
  const suggestions: string[] = [];

  const overdue = getOverdueTasks(tasks, lists);
  const risk = getRiskTasks(tasks, lists);
  const productivity = getProductivityStats(tasks, lists);
  const bottleneck = getBottleneckList(lists, tasks);
  const today = getTasksDueToday(tasks, lists);

  if (overdue.length > 0) {
    suggestions.push(
      `คุณมีงาน overdue ${overdue.length} งาน ควรเคลียร์ก่อนเริ่มงานใหม่`,
    );
  }

  if (bottleneck) {
    suggestions.push(
      `List "${bottleneck.title}" เป็น bottleneck (${bottleneck.count} งานค้าง) — ลองกระจายงาน`,
    );
  }

  if (risk.nearDue.length > 0) {
    suggestions.push(
      `มี ${risk.nearDue.length} งานใกล้ครบกำหนด (1-2 วัน) ควรเตรียมตัว`,
    );
  }

  if (today.length >= 4) {
    suggestions.push(
      `คุณมีงาน due วันนี้ ${today.length} งาน ควรจัดลำดับความสำคัญ`,
    );
  }

  if (productivity.completionRate < 30 && productivity.totalTasks > 0) {
    suggestions.push(
      "Completion rate ต่ำกว่า 30% — ลองแบ่งงานใหญ่เป็นงานย่อย",
    );
  }

  if (productivity.overdueRate > 30) {
    suggestions.push(
      "Overdue rate สูงกว่า 30% — ควรทบทวน deadline ให้สมจริง",
    );
  }

  if (risk.highRisk.length > 0) {
    suggestions.push(
      `มี ${risk.highRisk.length} งานความเสี่ยงสูง ควรจัดการด่วน`,
    );
  }

  if (suggestions.length === 0) {
    suggestions.push("ทุกอย่างดูดี! รักษาฟอร์มนี้ไว้ครับ");
  }

  return suggestions;
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

// ── Advanced Formatters ──────────────────────────────────────────────

export function formatRiskAnalysis(tasks: Task[], lists: List[]): string {
  const risk = getRiskTasks(tasks, lists);
  const sections: string[] = [];

  sections.push("⚠️ วิเคราะห์ความเสี่ยง:");

  const hasAnyRisk =
    risk.nearDue.length > 0 ||
    risk.overdueLong.length > 0 ||
    risk.highRisk.length > 0;

  if (!hasAnyRisk) {
    sections.push("  ✅ ไม่มีความเสี่ยงร้ายแรง — สบายใจได้ครับ");
    return sections.join("\n");
  }

  if (risk.nearDue.length > 0) {
    sections.push("");
    sections.push(`  🔶 ใกล้ครบกำหนด (1-2 วัน): ${risk.nearDue.length} งาน`);
    risk.nearDue.slice(0, 3).forEach((t) => {
      sections.push(`    - ${t.title}`);
    });
    if (risk.nearDue.length > 3) {
      sections.push(`    ...และอีก ${risk.nearDue.length - 3} งาน`);
    }
  }

  if (risk.overdueLong.length > 0) {
    sections.push("");
    sections.push(`  🔴 เลยกำหนดนาน (>3 วัน): ${risk.overdueLong.length} งาน`);
    risk.overdueLong.slice(0, 3).forEach((t) => {
      sections.push(`    - ${t.title} (${daysOverdue(t.due_date!)} วัน)`);
    });
    if (risk.overdueLong.length > 3) {
      sections.push(`    ...และอีก ${risk.overdueLong.length - 3} งาน`);
    }
  }

  if (risk.highRisk.length > 0) {
    sections.push("");
    sections.push(`  🚨 ควรจัดการด่วน: ${risk.highRisk.length} งาน`);
    risk.highRisk.slice(0, 3).forEach((t) => {
      const reason: string[] = [];
      if (isOverdueLong(t, lists)) reason.push("เลยนาน");
      if (t.priority === "high") reason.push("priority สูง");
      const tag = reason.length > 0 ? ` (${reason.join(", ")})` : "";
      sections.push(`    - ${t.title}${tag}`);
    });
  }

  return sections.join("\n");
}

export function formatFullInsightResponse(tasks: Task[], lists: List[]): string {
  if (tasks.length === 0 && lists.length === 0) {
    return "📋 ยังไม่มีข้อมูลในบอร์ดนี้ครับ — ลองสร้าง list และ task ก่อนนะ";
  }

  const sections: string[] = [];

  // ── Focus ──
  const focus = getFocusTasks(tasks, lists);
  sections.push("📌 งานที่ควรโฟกัส:");
  if (focus.length === 0) {
    sections.push("  ✅ ไม่มีงานที่ต้องทำแล้ว");
  } else {
    focus.slice(0, 5).forEach((t) => {
      const tags: string[] = [];
      if (isOverdue(t, lists)) tags.push(`⚠️ เลย ${daysOverdue(t.due_date!)} วัน`);
      else if (isDueToday(t)) tags.push("📌 วันนี้");
      else if (isNearDue(t, lists)) tags.push("🔜 ใกล้ครบกำหนด");
      if (t.priority === "high") tags.push("🔴 สูง");
      const tag = tags.length > 0 ? ` (${tags.join(", ")})` : "";
      sections.push(`  - ${t.title}${tag}`);
    });
    if (focus.length > 5) sections.push(`  ...และอีก ${focus.length - 5} งาน`);
  }

  // ── Risk ──
  const risk = getRiskTasks(tasks, lists);
  sections.push("");
  sections.push("⚠️ ความเสี่ยง:");
  if (risk.nearDue.length === 0 && risk.overdueLong.length === 0) {
    sections.push("  ✅ ไม่มีความเสี่ยงร้ายแรง");
  } else {
    if (risk.nearDue.length > 0) {
      sections.push(`  🔶 ใกล้ครบกำหนด (1-2 วัน): ${risk.nearDue.length} งาน`);
    }
    if (risk.overdueLong.length > 0) {
      sections.push(`  🔴 เลยกำหนดนาน (>3 วัน): ${risk.overdueLong.length} งาน`);
    }
    if (risk.highRisk.length > 0) {
      sections.push(`  🚨 ควรจัดการด่วน: ${risk.highRisk.length} งาน`);
    }
  }

  // ── Productivity ──
  const productivity = getProductivityStats(tasks, lists);
  const { total, completed } = getCompletedStats(tasks, lists);
  sections.push("");
  sections.push("📊 ประสิทธิภาพ:");
  sections.push(`  - Completion rate: ${productivity.completionRate}%`);
  sections.push(`  - Overdue rate: ${productivity.overdueRate}%`);
  sections.push(`  - เสร็จแล้ว: ${completed}/${total} งาน`);
  sections.push(`  - กำลังทำ: ${productivity.activeTasks} งาน`);

  // ── Workload ──
  const workload = getWorkloadByUser(tasks);
  if (workload.length > 0) {
    sections.push("");
    sections.push("👥 ภาระงาน:");
    workload.slice(0, 5).forEach((w) => {
      const label = w.assigneeId ?? "Unassigned";
      sections.push(`  - ${label}: ${w.count} งาน`);
    });
    if (workload.length > 5) {
      sections.push(`  ...และอีก ${workload.length - 5} คน`);
    }
  }

  // ── Suggestions ──
  const suggestions = getSmartSuggestions(tasks, lists);
  sections.push("");
  sections.push("💡 คำแนะนำ:");
  suggestions.forEach((s) => sections.push(`  - ${s}`));

  return sections.join("\n");
}

function renderBar(pct: number): string {
  const filled = Math.round(pct / 5);
  const empty = 20 - filled;
  return `[${"█".repeat(filled)}${"░".repeat(empty)}] ${pct}%`;
}
