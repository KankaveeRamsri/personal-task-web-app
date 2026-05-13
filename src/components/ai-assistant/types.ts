import type { AssistantActionPlan } from "@/lib/ai-assistant/action-planner";

export type ActionStatus = "pending" | "executing" | "success" | "failed" | "cancelled";

export interface RagSource {
  taskId: string;
  similarity: number;
  preview: string;
  boardId?: string;
  title?: string;
  priority?: string;
  dueDate?: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  isFallback?: boolean;
  isTimeout?: boolean;
  actionPlan?: AssistantActionPlan;
  requiresConfirmation?: boolean;
  actionStatus?: ActionStatus;
  ragSources?: RagSource[];
}

export type FilterType = "all" | "mine" | "overdue" | "today";
