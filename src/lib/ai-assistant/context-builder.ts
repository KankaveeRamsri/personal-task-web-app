import type { Task, List } from "@/types/database";
import {
  isTaskDone,
  getOverdueTasks,
  getTasksDueToday,
  getFocusTasks,
  getBottleneckList,
  isNearDue,
  daysOverdue,
} from "./insights";

export interface AIContextSummary {
  totalTasks: number;
  completed: number;
  overdue: number;
  dueToday: number;
  completionRate: number;
}

export interface AIContext {
  summary: AIContextSummary;
  focusTasks: { title: string; due_date: string | null; priority: string }[];
  overdueTasks: { title: string; overdueDays: number }[];
  nearDueTasks: { title: string; dueInDays: number }[];
  bottleneck: { listName: string; taskCount: number } | null;
  workload: { user: string; taskCount: number }[];
}

export function buildAIContext(
  tasks: Task[],
  lists: List[],
): AIContext {
  const completedCount = tasks.filter((t) => isTaskDone(t, lists)).length;
  const overdueList = getOverdueTasks(tasks, lists);
  const dueTodayList = getTasksDueToday(tasks, lists);
  const focusList = getFocusTasks(tasks, lists);
  const bottleneck = getBottleneckList(lists, tasks);
  const total = tasks.length;

  const nearDueList = tasks.filter((t) => isNearDue(t, lists));

  const workloadMap = new Map<string, number>();
  for (const t of tasks) {
    if (isTaskDone(t, lists)) continue;
    const key = t.assignee_id ?? "unassigned";
    workloadMap.set(key, (workloadMap.get(key) ?? 0) + 1);
  }
  const workload = [...workloadMap.entries()]
    .map(([user, taskCount]) => ({ user, taskCount }))
    .sort((a, b) => b.taskCount - a.taskCount)
    .slice(0, 5);

  return {
    summary: {
      totalTasks: total,
      completed: completedCount,
      overdue: overdueList.length,
      dueToday: dueTodayList.length,
      completionRate: total > 0 ? Math.round((completedCount / total) * 100) : 0,
    },
    focusTasks: focusList.slice(0, 5).map((t) => ({
      title: t.title,
      due_date: t.due_date,
      priority: t.priority,
    })),
    overdueTasks: overdueList.slice(0, 5).map((t) => ({
      title: t.title,
      overdueDays: daysOverdue(t.due_date!),
    })),
    nearDueTasks: nearDueList.slice(0, 5).map((t) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const due = new Date(t.due_date!);
      due.setHours(0, 0, 0, 0);
      return {
        title: t.title,
        dueInDays: Math.floor(
          (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
        ),
      };
    }),
    bottleneck: bottleneck
      ? { listName: bottleneck.title, taskCount: bottleneck.count }
      : null,
    workload,
  };
}
