"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useBoardData } from "@/hooks/useBoardData";
import {
  formatFocusResponse,
  formatOverdueResponse,
  formatProgressResponse,
  formatRiskAnalysis,
  formatFullInsightResponse,
  getOverdueTasks,
  getTasksDueToday,
} from "@/lib/ai-assistant/insights";
import { buildAIContext } from "@/lib/ai-assistant/context-builder";
import { detectAssistantIntent, type AssistantIntent } from "@/lib/ai-assistant/intent";
import { detectActionIntent } from "@/lib/ai-assistant/action-planner";
import type { AssistantActionPlan } from "@/lib/ai-assistant/action-planner";
import { logActivity } from "@/lib/activity-log";
import { parseAssistantDueDate } from "@/lib/ai-assistant/date-parser";
import type { Task, List, TaskPriority } from "@/types/database";

// ── Types ────────────────────────────────────────────────────────────

type ActionStatus = "pending" | "executing" | "success" | "failed" | "cancelled";

interface RagSource {
  taskId: string;
  similarity: number;
  preview: string;
  boardId?: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  isFallback?: boolean;
  isTimeout?: boolean;
  actionPlan?: AssistantActionPlan;
  requiresConfirmation?: boolean;
  actionStatus?: ActionStatus;
  ragSources?: RagSource[];
}

type FilterType = "all" | "mine" | "overdue" | "today";

// ── Constants ────────────────────────────────────────────────────────

const MAX_INPUT_LENGTH = 500;
const MAX_TITLE_LENGTH = 120;
const VALID_PRIORITIES: TaskPriority[] = ["none", "low", "medium", "high"];

const SUGGESTED_PROMPTS = [
  { icon: "🔍", text: "มี task ไหนเกี่ยวกับ deployment บ้าง" },
  { icon: "⚠️", text: "สรุปงาน overdue ให้หน่อย" },
  { icon: "📋", text: "ช่วยหา task ที่ควรทำวันนี้" },
  { icon: "✏️", text: "สร้าง task ทำ report ส่งพรุ่งนี้" },
];

const FOLLOW_UP_ACTIONS: { label: string; filter: FilterType; prompt: string }[] = [
  { label: "ดูเฉพาะงานของฉัน", filter: "mine", prompt: "สรุปงานของฉัน" },
  { label: "วิเคราะห์ความเสี่ยง", filter: "all", prompt: "วิเคราะห์ความเสี่ยง" },
  { label: "ดูงาน overdue เพิ่ม", filter: "overdue", prompt: "งาน overdue" },
  { label: "สรุปใหม่", filter: "all", prompt: "สรุปบอร์ดนี้ให้หน่อย" },
];

// ── Helpers ──────────────────────────────────────────────────────────

function applyFilter(
  tasks: Task[],
  lists: List[],
  filter: FilterType,
  userEmail: string,
): Task[] {
  switch (filter) {
    case "mine":
      return tasks.filter((t) => t.created_by === userEmail);
    case "overdue":
      return getOverdueTasks(tasks, lists);
    case "today":
      return getTasksDueToday(tasks, lists);
    default:
      return tasks;
  }
}

function generateResponseByIntent(
  intent: AssistantIntent,
  tasks: Task[],
  lists: List[],
): string {
  switch (intent) {
    case "focus":
      return formatFocusResponse(tasks, lists);
    case "summary":
      return formatFullInsightResponse(tasks, lists);
    case "risk":
      return formatRiskAnalysis(tasks, lists);
    case "progress":
      return formatProgressResponse(tasks, lists);
    case "workload":
      return formatFullInsightResponse(tasks, lists);
    default:
      return formatFullInsightResponse(tasks, lists);
  }
}

async function callLLM(
  message: string,
  tasks: Task[],
  lists: List[],
  boardName: string,
  workspaceId?: string,
  boardId?: string,
): Promise<{ reply: string; isFallback: boolean; isTimeout?: boolean; actionPlan?: AssistantActionPlan; requiresConfirmation?: boolean; ragSources?: RagSource[] }> {
  const aiContext = buildAIContext(tasks, lists);

  const res = await fetch("/api/ai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      context: {
        boardName,
        ...aiContext,
      },
      ...(workspaceId ? { workspaceId, boardId } : {}),
    }),
  });

  const data = await res.json();

  if (!res.ok || data.fallback) {
    return {
      reply: data.reply ?? "เกิดข้อผิดพลาด กรุณาลองใหม่",
      isFallback: true,
      isTimeout: data.errorType === "timeout",
      actionPlan: data.actionPlan,
      requiresConfirmation: data.requiresConfirmation,
    };
  }

  return {
    reply: data.reply ?? "",
    isFallback: false,
    actionPlan: data.actionPlan ?? undefined,
    requiresConfirmation: data.requiresConfirmation ?? false,
    ragSources: Array.isArray(data.ragSources) ? data.ragSources : undefined,
  };
}

// ── Action Preview Card ──────────────────────────────────────────────

const ACTION_TYPE_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  create_task: { label: "สร้าง Task", icon: "➕", color: "text-emerald-600 dark:text-emerald-400" },
  update_task: { label: "แก้ไข Task", icon: "✏️", color: "text-amber-600 dark:text-amber-400" },
  move_task: { label: "ย้าย Task", icon: "🔄", color: "text-blue-600 dark:text-blue-400" },
};

const STATUS_LABELS: Record<ActionStatus, { label: string; color: string }> = {
  pending: { label: "", color: "" },
  executing: { label: "กำลังดำเนินการ...", color: "text-blue-600 dark:text-blue-400" },
  success: { label: "ดำเนินการสำเร็จ ✓", color: "text-emerald-600 dark:text-emerald-400" },
  failed: { label: "ดำเนินการไม่สำเร็จ ✗", color: "text-red-600 dark:text-red-400" },
  cancelled: { label: "ยกเลิกแล้ว", color: "text-zinc-500 dark:text-zinc-400" },
};

function ActionPreviewCard({
  plan,
  status,
  onConfirm,
  onCancel,
}: {
  plan: AssistantActionPlan;
  status: ActionStatus;
  onConfirm?: () => void;
  onCancel?: () => void;
}) {
  const meta = ACTION_TYPE_LABELS[plan.type] ?? {
    label: "ดำเนินการ",
    icon: "📋",
    color: "text-zinc-600 dark:text-zinc-400",
  };
  const statusMeta = STATUS_LABELS[status];

  const payloadLines: string[] = [];
  if (plan.payload.title) payloadLines.push(`📝 Task: ${plan.payload.title}`);
  if (plan.payload.taskTitle) payloadLines.push(`📝 Task: ${plan.payload.taskTitle}`);
  if (plan.payload.listName) payloadLines.push(`📋 List: ${plan.payload.listName}`);
  if (plan.payload.dueDateText) payloadLines.push(`📅 Due: ${plan.payload.dueDateText}`);
  if (plan.payload.priority && plan.payload.priority !== "none")
    payloadLines.push(`🔴 Priority: ${plan.payload.priority}`);
  if (plan.payload.assigneeName) payloadLines.push(`👤 Assign: ${plan.payload.assigneeName}`);

  const isResolved = status !== "pending";
  const isExecutable = plan.type === "create_task" || plan.type === "update_task" || plan.type === "move_task";
  const canConfirm = isExecutable && !isResolved;

  const confirmLabel =
    plan.type === "create_task"
      ? "Confirm & Create Task"
      : plan.type === "update_task"
        ? "Confirm & Update Task"
        : plan.type === "move_task"
          ? "Confirm & Move Task"
          : "Confirm";

  return (
    <div className="mt-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/60 overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-zinc-200/80 dark:border-zinc-700/60 bg-white dark:bg-zinc-800/40">
        <span className="text-base leading-none">{meta.icon}</span>
        <span className={`text-xs font-semibold ${meta.color}`}>{meta.label}</span>
        {statusMeta.label ? (
          <span className={`ml-auto text-xs font-medium ${statusMeta.color}`}>
            {statusMeta.label}
          </span>
        ) : (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-zinc-100 dark:bg-zinc-700/60 px-2 py-0.5 text-[10px] text-zinc-500 dark:text-zinc-400">
            {Math.round(plan.confidence * 100)}% confident
          </span>
        )}
      </div>

      <div className="px-4 py-3 space-y-1.5">
        {payloadLines.map((line) => (
          <div key={line} className="text-xs text-zinc-700 dark:text-zinc-300">{line}</div>
        ))}
      </div>

      {plan.warnings.length > 0 && (
        <div className="px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border-t border-amber-100 dark:border-amber-800/30 space-y-1">
          {plan.warnings.map((w, i) => (
            <div key={i} className="text-xs text-amber-700 dark:text-amber-400">
              ⚠️ {w}
            </div>
          ))}
        </div>
      )}

      <div className="px-4 py-2.5 border-t border-zinc-200/80 dark:border-zinc-700/60 flex items-center justify-between gap-2">
        <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
          {isResolved ? "" : "ตรวจสอบรายละเอียดก่อนยืนยัน"}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {!isResolved && onCancel && (
            <button
              onClick={onCancel}
              className="rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 px-3 py-1 text-xs font-medium text-zinc-600 dark:text-zinc-300 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-600"
            >
              ยกเลิก
            </button>
          )}
          {canConfirm && onConfirm && (
            <button
              onClick={onConfirm}
              className={`rounded-lg px-3 py-1 text-xs font-medium text-white transition-colors ${
                plan.type === "create_task"
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : plan.type === "update_task"
                    ? "bg-amber-600 hover:bg-amber-700"
                    : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {confirmLabel}
            </button>
          )}
          {!canConfirm && !isResolved && (
            <button
              disabled
              className="rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-1 text-xs font-medium text-zinc-400 dark:text-zinc-500 cursor-not-allowed"
            >
              ไม่รองรับ Action นี้
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Shared SVGs ──────────────────────────────────────────────────────

function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
      />
    </svg>
  );
}

// ── Component ────────────────────────────────────────────────────────

interface AssistantPanelProps {
  userEmail: string;
}

export function AssistantPanel({ userEmail }: AssistantPanelProps) {
  const router = useRouter();
  const { tasks, lists, boards, selectedWorkspaceId, selectedBoardId, createTask, updateTask, moveTask } = useBoardData();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  // ── Dev: Reindex ────────────────────────────────────────────────
  // Temporary dev-only reindex control. Easy to remove later.
  type ReindexStatus = "idle" | "loading" | "success" | "error";
  const [reindexStatus, setReindexStatus] = useState<ReindexStatus>("idle");
  const [reindexResult, setReindexResult] = useState<{ indexed: number; failed: number } | null>(null);

  const handleReindex = useCallback(async () => {
    if (!selectedWorkspaceId || !selectedBoardId || reindexStatus === "loading") return;
    setReindexStatus("loading");
    setReindexResult(null);
    try {
      const res = await fetch("/api/ai/rag/reindex", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: selectedWorkspaceId, boardId: selectedBoardId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Reindex failed");
      setReindexResult({ indexed: data.indexed, failed: data.failed });
      setReindexStatus("success");
    } catch {
      setReindexStatus("error");
    }
  }, [selectedWorkspaceId, selectedBoardId, reindexStatus]);

  const handleSourceClick = useCallback(
    (src: RagSource) => {
      if (src.boardId) {
        router.push(`/dashboard/board?boardId=${src.boardId}&taskId=${src.taskId}`);
      } else {
        console.log("[RAG Source] taskId:", src.taskId);
      }
    },
    [router],
  );

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handlePrompt = useCallback(
    (prompt: string, filter: FilterType = "all") => {
      if (isLoading) return;

      setMessages((prev) => [...prev, { role: "user", content: prompt }]);
      setIsLoading(true);

      // Action intent check FIRST — route to LLM for action planning
      const actionType = detectActionIntent(prompt);
      if (actionType !== "unknown") {
        const boardName = boards.find((b) => b.id === selectedBoardId)?.title ?? "";
        callLLM(prompt, tasks, lists, boardName, selectedWorkspaceId ?? undefined, selectedBoardId ?? undefined)
          .then(({ reply, isFallback, actionPlan, requiresConfirmation }) => {
            if (isFallback) {
              if (actionPlan) {
                setMessages((prev) => [
                  ...prev,
                  {
                    role: "assistant",
                    content: reply,
                    actionPlan,
                    requiresConfirmation,
                  },
                ]);
              } else {
                const filtered = applyFilter(tasks, lists, filter, userEmail);
                const ruleReply = generateResponseByIntent("general", filtered, lists);
                setMessages((prev) => [
                  ...prev,
                  {
                    role: "assistant",
                    content: ruleReply + "\n\n_(ใช้โหมดวิเคราะห์ภายในแทนชั่วคราว)_",
                    isFallback: true,
                  },
                ]);
              }
            } else {
              setMessages((prev) => [
                ...prev,
                {
                  role: "assistant",
                  content: reply,
                  actionPlan,
                  requiresConfirmation,
                },
              ]);
            }
          })
          .catch(() => {
            const filtered = applyFilter(tasks, lists, filter, userEmail);
            const fallback = generateResponseByIntent("general", filtered, lists);
            setMessages((prev) => [
              ...prev,
              {
                role: "assistant",
                content: fallback + "\n\n_(ใช้โหมดวิเคราะห์ภายในแทนชั่วคราว)_",
                isFallback: true,
              },
            ]);
          })
          .finally(() => setIsLoading(false));
        return;
      }

      // LLM path: all non-action messages (intent used by route for prompt tuning)
      const intent = detectAssistantIntent(prompt);
      const boardName = boards.find((b) => b.id === selectedBoardId)?.title ?? "";
      callLLM(
        prompt,
        tasks,
        lists,
        boardName,
        selectedWorkspaceId ?? undefined,
        selectedBoardId ?? undefined,
      )
        .then(({ reply, isFallback, actionPlan, requiresConfirmation, ragSources }) => {
          if (isFallback) {
            if (actionPlan) {
              setMessages((prev) => [
                ...prev,
                {
                  role: "assistant",
                  content: reply,
                  actionPlan,
                  requiresConfirmation,
                },
              ]);
            } else {
              const filtered = applyFilter(tasks, lists, filter, userEmail);
              const ruleReply = generateResponseByIntent(intent, filtered, lists);
              setMessages((prev) => [
                ...prev,
                {
                  role: "assistant",
                  content: ruleReply + "\n\n_(ใช้โหมดวิเคราะห์ภายในแทนชั่วคราว)_",
                  isFallback: true,
                },
              ]);
            }
          } else {
            setMessages((prev) => [
              ...prev,
              {
                role: "assistant",
                content: reply,
                actionPlan,
                requiresConfirmation,
                ...(ragSources ? { ragSources } : {}),
              },
            ]);
          }
        })
        .catch(() => {
          const filtered = applyFilter(tasks, lists, filter, userEmail);
          const fallback = generateResponseByIntent(intent, filtered, lists);
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: fallback + "\n\n_(ใช้โหมดวิเคราะห์ภายในแทนชั่วคราว)_",
              isFallback: true,
            },
          ]);
        })
        .finally(() => setIsLoading(false));
    },
    [isLoading, tasks, lists, userEmail, boards, selectedBoardId, selectedWorkspaceId],
  );

  const handleSubmit = useCallback(() => {
    const trimmed = inputValue.trim();
    if (!trimmed || isLoading) return;
    setInputValue("");
    handlePrompt(trimmed);
  }, [inputValue, isLoading, handlePrompt]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  const boardTitle = boards.find((b) => b.id === selectedBoardId)?.title;
  const hasBoard = !!selectedBoardId;
  const showInitialPrompts = messages.length === 0 && !isLoading;

  const resolveDefaultList = useCallback((): string | null => {
    const nonDone = lists.find((l) => !l.is_done);
    return nonDone?.id ?? null;
  }, [lists]);

  const updateMessageActionStatus = useCallback(
    (index: number, status: ActionStatus, extra?: Partial<ChatMessage>) => {
      setMessages((prev) =>
        prev.map((msg, i) =>
          i === index ? { ...msg, actionStatus: status, ...extra } : msg,
        ),
      );
    },
    [],
  );

  const handleConfirmCreate = useCallback(
    async (msgIndex: number, plan: AssistantActionPlan) => {
      const title = (plan.payload.title ?? "").trim().slice(0, MAX_TITLE_LENGTH);
      if (!title) {
        updateMessageActionStatus(msgIndex, "failed");
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "ข้อมูล action ไม่ครบ กรุณาลองพิมพ์ใหม่ให้ชัดเจนขึ้น" },
        ]);
        return;
      }

      const listId = resolveDefaultList();
      if (!listId) {
        updateMessageActionStatus(msgIndex, "failed");
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "ไม่พบ list ที่ใส่ได้ในบอร์ดนี้ครับ" },
        ]);
        return;
      }

      const priority = VALID_PRIORITIES.includes(plan.payload.priority as TaskPriority)
        ? (plan.payload.priority as TaskPriority)
        : "none";

      const parsedDueDate = parseAssistantDueDate(plan.payload.dueDateText);

      updateMessageActionStatus(msgIndex, "executing");

      try {
        const result = await createTask(listId, title, { 
          priority, 
          due_date: parsedDueDate 
        });

        if (result) {
          if (selectedWorkspaceId) {
            await logActivity({
              workspaceId: selectedWorkspaceId,
              boardId: selectedBoardId ?? undefined,
              taskId: result.id,
              action: "ai_create_task",
              metadata: { originalMessage: messages[msgIndex - 1]?.content, actionPlan: plan },
            });
          }

          const dateMsg = parsedDueDate ? ` กำหนดส่ง ${parsedDueDate}` : "";
          updateMessageActionStatus(msgIndex, "success");
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: `ดำเนินการสำเร็จและบันทึก activity แล้วครับ (สร้าง task "${title}"${dateMsg})` },
          ]);
        } else {
          updateMessageActionStatus(msgIndex, "failed");
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: "คุณไม่มีสิทธิ์ให้ AI ทำ action นี้ในบอร์ดนี้ครับ" },
          ]);
        }
      } catch {
        updateMessageActionStatus(msgIndex, "failed");
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "คุณไม่มีสิทธิ์ให้ AI ทำ action นี้ในบอร์ดนี้ครับ" },
        ]);
      }
    },
    [createTask, resolveDefaultList, updateMessageActionStatus, selectedWorkspaceId, selectedBoardId, messages],
  );

  const handleCancelAction = useCallback(
    (msgIndex: number) => {
      updateMessageActionStatus(msgIndex, "cancelled");
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "ยกเลิกการดำเนินการแล้วครับ" },
      ]);
    },
    [updateMessageActionStatus],
  );

  const handleConfirmUpdate = useCallback(
    async (msgIndex: number, plan: AssistantActionPlan) => {
      const taskTitle = (plan.payload.taskTitle ?? "").trim();
      if (!taskTitle) {
        updateMessageActionStatus(msgIndex, "failed");
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "ข้อมูล action ไม่ครบ กรุณาลองพิมพ์ใหม่ให้ชัดเจนขึ้น" },
        ]);
        return;
      }

      // Search by exact match first, then case-insensitive contains
      const exactMatch = tasks.filter(
        (t) => t.title.toLowerCase() === taskTitle.toLowerCase(),
      );
      const candidates =
        exactMatch.length > 0
          ? exactMatch
          : tasks.filter((t) =>
              t.title.toLowerCase().includes(taskTitle.toLowerCase()),
            );

      if (candidates.length === 0) {
        updateMessageActionStatus(msgIndex, "failed");
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `ไม่พบงานชื่อ "${taskTitle}" ในบอร์ดนี้ครับ` },
        ]);
        return;
      }

      if (candidates.length > 1) {
        updateMessageActionStatus(msgIndex, "failed");
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "พบงานชื่อใกล้เคียงหลายรายการ กรุณาระบุชื่อให้ชัดเจนขึ้น",
          },
        ]);
        return;
      }

      // Build allowed updates only
      const updates: Partial<Task> = {};
      const fields = plan.payload.fields ?? {};

      if (typeof fields.title === "string" && fields.title.trim()) {
        const newTitle = fields.title.trim().slice(0, MAX_TITLE_LENGTH);
        updates.title = newTitle;
      }

      const rawPriority = fields.priority ?? plan.payload.priority;
      if (
        typeof rawPriority === "string" &&
        VALID_PRIORITIES.includes(rawPriority as TaskPriority)
      ) {
        updates.priority = rawPriority as TaskPriority;
      }

      const rawDueDate = fields.dueDateText ?? plan.payload.dueDateText;
      if (typeof rawDueDate === "string") {
        const parsedDueDate = parseAssistantDueDate(rawDueDate);
        if (parsedDueDate) {
          updates.due_date = parsedDueDate;
        } else if (rawDueDate.trim()) {
          updateMessageActionStatus(msgIndex, "failed");
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: `ไม่สามารถตีความวันที่ "${rawDueDate}" ได้ กรุณาระบุวันที่ใหม่ให้ชัดเจนขึ้น` },
          ]);
          return;
        }
      }

      if (Object.keys(updates).length === 0) {
        updateMessageActionStatus(msgIndex, "failed");
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "ข้อมูล action ไม่ครบ กรุณาลองพิมพ์ใหม่ให้ชัดเจนขึ้น" },
        ]);
        return;
      }

      updateMessageActionStatus(msgIndex, "executing");

      try {
        const result = await updateTask(candidates[0].id, updates);

        if (result) {
          if (selectedWorkspaceId) {
            await logActivity({
              workspaceId: selectedWorkspaceId,
              boardId: selectedBoardId ?? undefined,
              taskId: result.id,
              action: "ai_update_task",
              metadata: { originalMessage: messages[msgIndex - 1]?.content, actionPlan: plan, changedFields: updates },
            });
          }

          const dateMsg = updates.due_date ? ` เป็นกำหนดส่ง ${updates.due_date}` : "";
          updateMessageActionStatus(msgIndex, "success");
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: `ดำเนินการสำเร็จและบันทึก activity แล้วครับ (อัปเดตงาน "${candidates[0].title}"${dateMsg})`,
            },
          ]);
        } else {
          updateMessageActionStatus(msgIndex, "failed");
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: "คุณไม่มีสิทธิ์ให้ AI ทำ action นี้ในบอร์ดนี้ครับ",
            },
          ]);
        }
      } catch {
        updateMessageActionStatus(msgIndex, "failed");
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "คุณไม่มีสิทธิ์ให้ AI ทำ action นี้ในบอร์ดนี้ครับ",
          },
        ]);
      }
    },
    [tasks, updateTask, updateMessageActionStatus, selectedWorkspaceId, selectedBoardId, messages],
  );

  const handleConfirmMove = useCallback(
    async (msgIndex: number, plan: AssistantActionPlan) => {
      const taskTitle = (plan.payload.taskTitle ?? "").trim();
      const listName = (plan.payload.listName ?? "").trim();

      if (!taskTitle || !listName) {
        updateMessageActionStatus(msgIndex, "failed");
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "ข้อมูล action ไม่ครบ กรุณาลองพิมพ์ใหม่ให้ชัดเจนขึ้น" },
        ]);
        return;
      }

      // Search task by title
      const exactTask = tasks.filter(
        (t) => t.title.toLowerCase() === taskTitle.toLowerCase(),
      );
      const taskCandidates =
        exactTask.length > 0
          ? exactTask
          : tasks.filter((t) =>
              t.title.toLowerCase().includes(taskTitle.toLowerCase()),
            );

      if (taskCandidates.length === 0) {
        updateMessageActionStatus(msgIndex, "failed");
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `ไม่พบงานชื่อ "${taskTitle}" ในบอร์ดนี้ครับ` },
        ]);
        return;
      }

      if (taskCandidates.length > 1) {
        updateMessageActionStatus(msgIndex, "failed");
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "พบงานชื่อใกล้เคียงหลายรายการ กรุณาระบุชื่อให้ชัดเจนขึ้น" },
        ]);
        return;
      }

      // Search target list by name
      const exactList = lists.filter(
        (l) => l.title.toLowerCase() === listName.toLowerCase(),
      );
      const listCandidates =
        exactList.length > 0
          ? exactList
          : lists.filter((l) =>
              l.title.toLowerCase().includes(listName.toLowerCase()),
            );

      if (listCandidates.length === 0) {
        updateMessageActionStatus(msgIndex, "failed");
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `ไม่พบ list ชื่อ "${listName}" ในบอร์ดนี้ครับ` },
        ]);
        return;
      }

      if (listCandidates.length > 1) {
        updateMessageActionStatus(msgIndex, "failed");
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "พบ list ชื่อใกล้เคียงหลายรายการ กรุณาระบุชื่อให้ชัดเจนขึ้น" },
        ]);
        return;
      }

      const task = taskCandidates[0];
      const targetList = listCandidates[0];

      updateMessageActionStatus(msgIndex, "executing");

      try {
        const ok = await moveTask(task.id, targetList.id, task.list_id, {
          is_completed: targetList.is_done,
        });

        if (ok) {
          if (selectedWorkspaceId) {
            await logActivity({
              workspaceId: selectedWorkspaceId,
              boardId: selectedBoardId ?? undefined,
              taskId: task.id,
              action: "ai_move_task",
              metadata: { originalMessage: messages[msgIndex - 1]?.content, actionPlan: plan, targetList: targetList.title },
            });
          }

          updateMessageActionStatus(msgIndex, "success");
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: `ดำเนินการสำเร็จและบันทึก activity แล้วครับ (ย้ายงาน "${task.title}" ไปที่ "${targetList.title}")`,
            },
          ]);
        } else {
          updateMessageActionStatus(msgIndex, "failed");
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: "คุณไม่มีสิทธิ์ให้ AI ทำ action นี้ในบอร์ดนี้ครับ",
            },
          ]);
        }
      } catch {
        updateMessageActionStatus(msgIndex, "failed");
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "คุณไม่มีสิทธิ์ให้ AI ทำ action นี้ในบอร์ดนี้ครับ",
          },
        ]);
      }
    },
    [tasks, lists, moveTask, updateMessageActionStatus, selectedWorkspaceId, selectedBoardId, messages],
  );

  return (
    <div className="flex h-full flex-col nx-card shadow-sm overflow-hidden">
      {/* Chat area */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">

        {/* Empty state — shown before any messages */}
        {showInitialPrompts ? (
          <div className="flex flex-col items-center gap-5 pt-6 pb-2">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border border-blue-100 dark:border-blue-800/30 shadow-sm">
              <SparkleIcon className="h-7 w-7 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="text-center">
              {hasBoard ? (
                <>
                  <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                    วิเคราะห์บอร์ด &ldquo;{boardTitle}&rdquo;
                  </h2>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    ถามอะไรก็ได้ หรือให้ AI จัดการงานให้โดยตรง
                  </p>
                </>
              ) : (
                <>
                  <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                    Nexdo AI
                  </h2>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    กรุณาเลือกบอร์ดก่อน จึงจะวิเคราะห์งานให้ได้
                  </p>
                </>
              )}
            </div>
            {hasBoard && (
              <div className="grid grid-cols-2 gap-2 w-full max-w-xs">
                {SUGGESTED_PROMPTS.map((p) => (
                  <button
                    key={p.text}
                    onClick={() => handlePrompt(p.text)}
                    disabled={isLoading}
                    className="flex flex-col items-start gap-2 rounded-xl border border-zinc-200 dark:border-zinc-700/60 bg-zinc-50/50 dark:bg-zinc-800/40 p-3 text-left transition-all hover:border-blue-300 hover:bg-blue-50/60 dark:hover:border-blue-500/40 dark:hover:bg-blue-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="text-lg leading-none">{p.icon}</span>
                    <span className="text-[11px] font-medium leading-snug text-zinc-700 dark:text-zinc-300">{p.text}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Compact welcome — shown when there are messages */
          <div className="flex gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30 mt-0.5">
              <SparkleIcon className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="rounded-2xl border border-zinc-100 dark:border-zinc-700/40 bg-zinc-50 dark:bg-zinc-800/60 px-3.5 py-2.5 text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
              {hasBoard ? (
                <>
                  สวัสดีครับ! 👋 วิเคราะห์บอร์ด{" "}
                  <span className="font-medium text-blue-600 dark:text-blue-400">
                    &ldquo;{boardTitle}&rdquo;
                  </span>
                </>
              ) : (
                <>สวัสดีครับ! กรุณาเลือกบอร์ดก่อน</>
              )}
            </div>
          </div>
        )}

        {/* Chat messages */}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : ""}`}
          >
            {msg.role === "assistant" && (
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30 mt-0.5">
                <SparkleIcon className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              </div>
            )}
            <div className="flex flex-col gap-1.5 max-w-[85%]">
              <div
                className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-line ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white dark:bg-blue-500 rounded-br-sm"
                    : "bg-zinc-50 dark:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300 border border-zinc-100 dark:border-zinc-700/40 rounded-bl-sm"
                }`}
              >
                {msg.content}
                {msg.ragSources && msg.ragSources.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-zinc-200/60 dark:border-zinc-700/40">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500 mb-1.5">
                      Sources
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {msg.ragSources.map((src) => {
                        const label =
                          src.preview.length > 55
                            ? src.preview.slice(0, 55) + "…"
                            : src.preview;
                        return (
                          <button
                            key={src.taskId}
                            type="button"
                            title={src.preview}
                            onClick={() => handleSourceClick(src)}
                            className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white/80 dark:bg-zinc-800/50 px-2 py-1 text-[10px] text-zinc-500 dark:text-zinc-400 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 dark:hover:border-blue-500/40 dark:hover:bg-blue-900/20 dark:hover:text-blue-400 transition-colors"
                          >
                            <svg className="h-2.5 w-2.5 shrink-0 opacity-70" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
                            </svg>
                            <span className="max-w-[140px] truncate">{label}</span>
                            <span className="shrink-0 tabular-nums opacity-60">{Math.round(src.similarity * 100)}%</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {msg.actionPlan && (
                  <ActionPreviewCard
                    plan={msg.actionPlan}
                    status={msg.actionStatus ?? "pending"}
                    onConfirm={
                      !msg.actionStatus && msg.actionPlan.type === "create_task"
                        ? () => handleConfirmCreate(i, msg.actionPlan!)
                        : !msg.actionStatus && msg.actionPlan.type === "update_task"
                          ? () => handleConfirmUpdate(i, msg.actionPlan!)
                          : !msg.actionStatus && msg.actionPlan.type === "move_task"
                            ? () => handleConfirmMove(i, msg.actionPlan!)
                            : undefined
                    }
                    onCancel={
                      !msg.actionStatus ? () => handleCancelAction(i) : undefined
                    }
                  />
                )}
              </div>
              {/* Fallback mode indicator */}
              {msg.role === "assistant" && msg.isTimeout && (
                <div className="inline-flex items-center gap-1 self-start rounded-full bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/30 px-2 py-0.5">
                  <svg className="h-2.5 w-2.5 text-red-500 dark:text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                  <span className="text-[9px] font-medium text-red-600 dark:text-red-400">AI ใช้เวลานานเกินไป</span>
                </div>
              )}
              {msg.role === "assistant" && msg.isFallback && !msg.isTimeout && (
                <div className="inline-flex items-center gap-1 self-start rounded-full bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/30 px-2 py-0.5">
                  <svg className="h-2.5 w-2.5 text-amber-500 dark:text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                  <span className="text-[9px] font-medium text-amber-600 dark:text-amber-400">โหมดวิเคราะห์ภายใน</span>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30 mt-0.5">
              <SparkleIcon className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="rounded-2xl rounded-bl-sm border border-zinc-100 dark:border-zinc-700/40 bg-zinc-50 dark:bg-zinc-800/60 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-400 dark:text-zinc-500">
                  {(() => {
                    const lastMsg = messages[messages.length - 1];
                    if (!lastMsg || lastMsg.role !== "user") return "กำลังคิด";
                    const actionType = detectActionIntent(lastMsg.content ?? "");
                    if (actionType !== "unknown") return "กำลังวางแผนการดำเนินการ";
                    const intent = detectAssistantIntent(lastMsg.content ?? "");
                    if (intent === "focus") return "กำลังค้นหางานสำคัญ";
                    if (intent === "summary" || intent === "progress") return "กำลังวิเคราะห์ข้อมูล";
                    if (intent === "risk") return "กำลังประเมินความเสี่ยง";
                    return "กำลังคิด";
                  })()}
                </span>
                <span className="flex items-center gap-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="h-1.5 w-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500 animate-bounce" style={{ animationDelay: "120ms" }} />
                  <span className="h-1.5 w-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500 animate-bounce" style={{ animationDelay: "240ms" }} />
                </span>
              </div>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />

        {/* Follow-up action chips */}
        {!isLoading && messages.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {FOLLOW_UP_ACTIONS.map((action) => (
              <button
                key={action.label}
                onClick={() => handlePrompt(action.prompt, action.filter)}
                disabled={isLoading || !hasBoard}
                className="inline-flex items-center rounded-full border border-zinc-200 dark:border-zinc-700/60 bg-white dark:bg-zinc-800/40 px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 transition-all hover:border-blue-300 hover:bg-blue-50 dark:hover:border-blue-500/40 dark:hover:bg-blue-900/20 hover:text-blue-700 dark:hover:text-blue-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Dev: Reindex Board ──────────────────────────────────────── */}
      {/* Temporary dev-only tool. Remove this block when no longer needed. */}
      {hasBoard && (
        <div className="border-t border-dashed border-zinc-200 dark:border-zinc-700/60 px-4 py-2 flex items-center gap-2 bg-zinc-50/50 dark:bg-zinc-800/30">
          <button
            onClick={handleReindex}
            disabled={reindexStatus === "loading"}
            className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2.5 py-1 text-[10px] font-medium text-zinc-600 dark:text-zinc-400 transition-colors hover:border-blue-300 hover:bg-blue-50 dark:hover:border-blue-500/40 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {reindexStatus === "loading" ? "Reindexing…" : "Dev: Reindex Board"}
          </button>
          {reindexStatus === "success" && reindexResult && (
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400">
              Done — {reindexResult.indexed} indexed, {reindexResult.failed} failed
            </span>
          )}
          {reindexStatus === "error" && (
            <span className="text-[10px] text-red-600 dark:text-red-400">
              Reindex failed — check console
            </span>
          )}
        </div>
      )}

      {/* Input area */}
      <div className="border-t border-zinc-100 dark:border-zinc-800/80 px-4 py-3">
        <div className="flex items-center gap-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/40 px-3.5 py-2 focus-within:border-blue-300 dark:focus-within:border-blue-500/40 transition-colors">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading || !hasBoard}
            placeholder={hasBoard ? "พิมพ์คำถามเกี่ยวกับงาน..." : "เลือกบอร์ดก่อน..."}
            maxLength={MAX_INPUT_LENGTH}
            className="flex-1 bg-transparent text-sm text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 outline-none disabled:text-zinc-400 dark:disabled:text-zinc-500 disabled:cursor-not-allowed"
          />
          <button
            onClick={handleSubmit}
            disabled={isLoading || !hasBoard || !inputValue.trim()}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white transition-colors hover:bg-blue-700 disabled:bg-zinc-200 dark:disabled:bg-zinc-700 disabled:text-zinc-400 dark:disabled:text-zinc-500 disabled:cursor-not-allowed"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
            </svg>
          </button>
        </div>
        {inputValue.length > MAX_INPUT_LENGTH * 0.8 && (
          <div className="mt-1 text-right text-[10px] text-zinc-400 dark:text-zinc-500 tabular-nums">
            {inputValue.length}/{MAX_INPUT_LENGTH}
          </div>
        )}
      </div>
    </div>
  );
}
