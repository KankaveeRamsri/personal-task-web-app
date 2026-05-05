import type { Task, List } from "@/types/database";
import {
  isTaskDone,
  getOverdueTasks,
  getTasksDueToday,
  getFocusTasks,
  getBottleneckList,
} from "./insights";

export interface AIContextSummary {
  totalTasks: number;
  completed: number;
  overdue: number;
  dueToday: number;
}

export interface AIContext {
  summary: AIContextSummary;
  topTasks: Pick<Task, "id" | "title" | "priority" | "due_date" | "is_completed">[];
  overdueTasks: Pick<Task, "id" | "title" | "priority" | "due_date">[];
  bottleneckList: { title: string; pendingCount: number } | null;
}

const TASK_PICK = (t: Task) => ({
  id: t.id,
  title: t.title,
  priority: t.priority,
  due_date: t.due_date,
  is_completed: t.is_completed,
});

const OVERDUE_PICK = (t: Task) => ({
  id: t.id,
  title: t.title,
  priority: t.priority,
  due_date: t.due_date,
});

export function buildAIContext(
  tasks: Task[],
  lists: List[],
): AIContext {
  const completedCount = tasks.filter((t) => isTaskDone(t, lists)).length;
  const overdueList = getOverdueTasks(tasks, lists);
  const dueTodayList = getTasksDueToday(tasks, lists);
  const focusList = getFocusTasks(tasks, lists);
  const bottleneck = getBottleneckList(lists, tasks);

  return {
    summary: {
      totalTasks: tasks.length,
      completed: completedCount,
      overdue: overdueList.length,
      dueToday: dueTodayList.length,
    },
    topTasks: focusList.slice(0, 5).map(TASK_PICK),
    overdueTasks: overdueList.slice(0, 5).map(OVERDUE_PICK),
    bottleneckList: bottleneck
      ? { title: bottleneck.title, pendingCount: bottleneck.count }
      : null,
  };
}
