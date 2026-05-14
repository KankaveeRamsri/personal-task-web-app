"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useBoardData } from "@/hooks/useBoardData";
import {
  formatFocusResponse,
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
import type { ChatMessage, RagSource, FilterType, ActionStatus } from "./types";
import { ChatMessages, SparkleIcon } from "./chat-messages";
import { ChatInput } from "./chat-input";
import { ReindexButton } from "./reindex-button";
import { WorkspaceBoardSelector } from "./workspace-board-selector";
import { useChatSession } from "@/hooks/useChatSession";

// ── Constants ────────────────────────────────────────────────────────

const MAX_TITLE_LENGTH = 120;
const VALID_PRIORITIES: TaskPriority[] = ["none", "low", "medium", "high"];
const HISTORY_LIMIT = 5;
const HISTORY_MAX_CONTENT = 300;

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

// ── Pure helpers ─────────────────────────────────────────────────────

function extractHistory(
  messages: ChatMessage[],
  limit: number,
): Array<{ role: "user" | "assistant"; content: string }> {
  const result: Array<{ role: "user" | "assistant"; content: string }> = [];
  for (let i = messages.length - 1; i >= 0 && result.length < limit; i--) {
    const msg = messages[i];
    if (msg.actionPlan || msg.isFallback || msg.isTimeout) continue;
    if (msg.actionStatus && msg.actionStatus !== "pending") continue;
    const content = msg.content.trim().slice(0, HISTORY_MAX_CONTENT);
    if (!content) continue;
    result.push({ role: msg.role, content });
  }
  result.reverse();
  return result;
}

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

// ── Fetch helpers ─────────────────────────────────────────────────────

interface StreamChatCallbacks {
  onChunk: (text: string) => void;
  onSources: (sources: RagSource[]) => void;
  onError: (msg: string, isTimeout: boolean) => void;
}

async function callLLM(
  message: string,
  tasks: Task[],
  lists: List[],
  boardName: string,
  workspaceId?: string,
  boardId?: string,
  history?: Array<{ role: "user" | "assistant"; content: string }>,
): Promise<{
  reply: string;
  isFallback: boolean;
  isTimeout?: boolean;
  actionPlan?: AssistantActionPlan;
  requiresConfirmation?: boolean;
  ragSources?: RagSource[];
}> {
  const aiContext = buildAIContext(tasks, lists);
  const res = await fetch("/api/ai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      context: { boardName, ...aiContext },
      ...(workspaceId ? { workspaceId, boardId } : {}),
      ...(history && history.length > 0 ? { history } : {}),
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

async function streamChat(
  message: string,
  tasks: Task[],
  lists: List[],
  boardName: string,
  callbacks: StreamChatCallbacks,
  workspaceId?: string,
  boardId?: string,
  history?: Array<{ role: "user" | "assistant"; content: string }>,
): Promise<void> {
  const aiContext = buildAIContext(tasks, lists);
  const res = await fetch("/api/ai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      context: { boardName, ...aiContext },
      ...(workspaceId ? { workspaceId, boardId } : {}),
      ...(history && history.length > 0 ? { history } : {}),
    }),
  });

  if (!res.ok || !res.body) {
    callbacks.onError("เกิดข้อผิดพลาดในการเชื่อมต่อ AI กรุณาลองใหม่", false);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";

      for (const block of events) {
        if (!block.trim()) continue;
        let eventType = "";
        let dataStr = "";
        for (const line of block.split("\n")) {
          if (line.startsWith("event:")) eventType = line.slice(6).trim();
          else if (line.startsWith("data:")) dataStr = line.slice(5).trim();
        }
        if (!dataStr) continue;

        if (eventType === "sources") {
          try {
            const sources = JSON.parse(dataStr) as RagSource[];
            callbacks.onSources(sources);
          } catch { /* skip malformed JSON */ }
        } else if (eventType === "error") {
          let code = "api_error";
          try { code = JSON.parse(dataStr) as string; } catch { /* skip */ }
          const errMsg =
            code === "timeout"
              ? "AI ใช้เวลาตอบนานเกินไป กรุณาลองใหม่ หรือลองถามให้สั้นลง"
              : "เกิดข้อผิดพลาดในการเชื่อมต่อ AI กรุณาลองใหม่";
          callbacks.onError(errMsg, code === "timeout");
        } else if (eventType !== "done") {
          try {
            const chunk = JSON.parse(dataStr) as string;
            if (chunk) callbacks.onChunk(chunk);
          } catch { /* skip malformed chunk */ }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// ── Component ─────────────────────────────────────────────────────────

interface AssistantPanelProps {
  userEmail: string;
}

export function AssistantPanel({ userEmail }: AssistantPanelProps) {
  const router = useRouter();
  const {
    workspaces,
    selectedWorkspaceId,
    setSelectedWorkspaceId,
    boards,
    selectedBoardId,
    setSelectedBoardId,
    lists,
    tasks,
    loading: boardDataLoading,
    createTask,
    updateTask,
    moveTask,
  } = useBoardData();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  // ── Persistent chat session ────────────────────────────────────────
  const { isSessionLoading, restoredMessages, saveUserMessage, saveAssistantMessage, clearChat } =
    useChatSession(selectedWorkspaceId ?? null, selectedBoardId ?? null);

  // Restore messages when board/session loads
  useEffect(() => {
    if (restoredMessages !== null && !isSessionLoading) {
      setMessages(restoredMessages);
    }
  }, [restoredMessages, isSessionLoading]);

  const boardTitle = boards.find((b) => b.id === selectedBoardId)?.title;
  const hasBoard = !!selectedBoardId;
  const showInitialPrompts = messages.length === 0 && !isLoading && !isSessionLoading;

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // ── Source click ────────────────────────────────────────────────────

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

  // ── Action status helpers ───────────────────────────────────────────

  const updateMessageActionStatus = useCallback(
    (index: number, status: ActionStatus, extra?: Partial<ChatMessage>) => {
      setMessages((prev) =>
        prev.map((msg, i) => (i === index ? { ...msg, actionStatus: status, ...extra } : msg)),
      );
    },
    [],
  );

  const resolveDefaultList = useCallback((): string | null => {
    const nonDone = lists.find((l) => !l.is_done);
    return nonDone?.id ?? null;
  }, [lists]);

  // ── Action confirm/cancel ───────────────────────────────────────────

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
        const result = await createTask(listId, title, { priority, due_date: parsedDueDate });
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
            {
              role: "assistant",
              content: `ดำเนินการสำเร็จและบันทึก activity แล้วครับ (สร้าง task "${title}"${dateMsg})`,
            },
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

      const exactMatch = tasks.filter((t) => t.title.toLowerCase() === taskTitle.toLowerCase());
      const candidates =
        exactMatch.length > 0
          ? exactMatch
          : tasks.filter((t) => t.title.toLowerCase().includes(taskTitle.toLowerCase()));

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
          { role: "assistant", content: "พบงานชื่อใกล้เคียงหลายรายการ กรุณาระบุชื่อให้ชัดเจนขึ้น" },
        ]);
        return;
      }

      const updates: Partial<Task> = {};
      const fields = plan.payload.fields ?? {};

      if (typeof fields.title === "string" && fields.title.trim()) {
        updates.title = fields.title.trim().slice(0, MAX_TITLE_LENGTH);
      }

      const rawPriority = fields.priority ?? plan.payload.priority;
      if (typeof rawPriority === "string" && VALID_PRIORITIES.includes(rawPriority as TaskPriority)) {
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
            {
              role: "assistant",
              content: `ไม่สามารถตีความวันที่ "${rawDueDate}" ได้ กรุณาระบุวันที่ใหม่ให้ชัดเจนขึ้น`,
            },
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
              metadata: {
                originalMessage: messages[msgIndex - 1]?.content,
                actionPlan: plan,
                changedFields: updates,
              },
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

      const exactTask = tasks.filter((t) => t.title.toLowerCase() === taskTitle.toLowerCase());
      const taskCandidates =
        exactTask.length > 0
          ? exactTask
          : tasks.filter((t) => t.title.toLowerCase().includes(taskTitle.toLowerCase()));

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

      const exactList = lists.filter((l) => l.title.toLowerCase() === listName.toLowerCase());
      const listCandidates =
        exactList.length > 0
          ? exactList
          : lists.filter((l) => l.title.toLowerCase().includes(listName.toLowerCase()));

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
              metadata: {
                originalMessage: messages[msgIndex - 1]?.content,
                actionPlan: plan,
                targetList: targetList.title,
              },
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
    [tasks, lists, moveTask, updateMessageActionStatus, selectedWorkspaceId, selectedBoardId, messages],
  );

  // ── Chat flow ─────────────────────────────────────────────────────

  // ── New chat handler ───────────────────────────────────────────────

  const handleNewChat = useCallback(async () => {
    if (isLoading) return;
    await clearChat();
    setMessages([]);
  }, [isLoading, clearChat]);

  // ── Chat flow ─────────────────────────────────────────────────────

  const handlePrompt = useCallback(
    (prompt: string, filter: FilterType = "all") => {
      if (isLoading) return;

      setMessages((prev) => [...prev, { role: "user", content: prompt }]);
      // Save user message to DB (fire-and-forget)
      saveUserMessage(prompt);
      setIsLoading(true);

      const actionType = detectActionIntent(prompt);
      if (actionType !== "unknown") {
        const boardName = boards.find((b) => b.id === selectedBoardId)?.title ?? "";
        callLLM(prompt, tasks, lists, boardName, selectedWorkspaceId ?? undefined, selectedBoardId ?? undefined)
          .then(({ reply, isFallback, actionPlan, requiresConfirmation }) => {
            if (isFallback) {
              if (actionPlan) {
                setMessages((prev) => [
                  ...prev,
                  { role: "assistant", content: reply, actionPlan, requiresConfirmation },
                ]);
                // Do NOT save action plan messages to DB
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
                // Do NOT save fallback messages to DB
              }
            } else {
              setMessages((prev) => [
                ...prev,
                { role: "assistant", content: reply, actionPlan, requiresConfirmation },
              ]);
              // Save clean LLM reply to DB
              if (!actionPlan) {
                saveAssistantMessage(reply);
              }
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

      const intent = detectAssistantIntent(prompt);
      const boardName = boards.find((b) => b.id === selectedBoardId)?.title ?? "";
      const chatHistory = extractHistory(messages, HISTORY_LIMIT);

      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      // Accumulate streamed text locally — never call saveAssistantMessage inside a
      // state updater (concurrent mode / Strict Mode may invoke updaters multiple times).
      let streamedContent = "";

      streamChat(
        prompt,
        tasks,
        lists,
        boardName,
        {
          onChunk(text) {
            streamedContent += text;
            setMessages((prev) =>
              prev.map((msg, i) =>
                i === prev.length - 1 ? { ...msg, content: msg.content + text } : msg,
              ),
            );
          },
          onSources(sources) {
            setMessages((prev) =>
              prev.map((msg, i) =>
                i === prev.length - 1 ? { ...msg, ragSources: sources } : msg,
              ),
            );
          },
          onError(msg, isTimeout) {
            streamedContent = ""; // reset on error — don't persist error messages
            setMessages((prev) =>
              prev.map((msg2, i) =>
                i === prev.length - 1
                  ? { ...msg2, content: msg, isFallback: true, isTimeout }
                  : msg2,
              ),
            );
          },
        },
        selectedWorkspaceId ?? undefined,
        selectedBoardId ?? undefined,
        chatHistory,
      )
        .then(() => {
          // Save once, directly — not inside a state updater
          if (streamedContent) {
            saveAssistantMessage(streamedContent);
          }
        })
        .catch(() => {
          const filtered = applyFilter(tasks, lists, filter, userEmail);
          const fallback = generateResponseByIntent(intent, filtered, lists);
          setMessages((prev) =>
            prev.map((msg, i) =>
              i === prev.length - 1
                ? {
                    ...msg,
                    content: fallback + "\n\n_(ใช้โหมดวิเคราะห์ภายในแทนชั่วคราว)_",
                    isFallback: true,
                  }
                : msg,
            ),
          );
        })
        .finally(() => setIsLoading(false));
    },
    [isLoading, messages, tasks, lists, userEmail, boards, selectedBoardId, selectedWorkspaceId, saveUserMessage, saveAssistantMessage],
  );

  const handleSubmit = useCallback(() => {
    const trimmed = inputValue.trim();
    if (!trimmed || isLoading) return;
    setInputValue("");
    handlePrompt(trimmed);
  }, [inputValue, isLoading, handlePrompt]);

  // ── Render ────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col nx-card shadow-sm overflow-hidden">
      {/* Header: workspace/board selector + new chat */}
      <div className="flex shrink-0 items-center gap-2 border-b border-zinc-100 px-4 pb-2.5 pt-3 dark:border-zinc-800/60">
        <WorkspaceBoardSelector
          workspaces={workspaces}
          selectedWorkspaceId={selectedWorkspaceId ?? null}
          onWorkspaceChange={setSelectedWorkspaceId}
          boards={boards}
          selectedBoardId={selectedBoardId ?? null}
          onBoardChange={setSelectedBoardId}
          isLoading={boardDataLoading || isSessionLoading}
        />
        {messages.length > 0 && (
          <button
            id="ai-new-chat-btn"
            onClick={() => void handleNewChat()}
            disabled={isLoading}
            title="เริ่มแชทใหม่"
            className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700/60 bg-white dark:bg-zinc-800/40 px-2.5 py-1 text-xs font-medium text-zinc-500 dark:text-zinc-400 transition-all hover:border-red-300 hover:bg-red-50 dark:hover:border-red-500/40 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
              <path fillRule="evenodd" d="M8 15A7 7 0 1 0 8 1a7 7 0 0 0 0 14ZM6.75 5.75a.75.75 0 0 1 1.5 0v2.5h2.5a.75.75 0 0 1 0 1.5h-2.5v2.5a.75.75 0 0 1-1.5 0v-2.5h-2.5a.75.75 0 0 1 0-1.5h2.5v-2.5Z" clipRule="evenodd" />
            </svg>
            แชทใหม่
          </button>
        )}
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">

        {/* Empty state / compact welcome */}
        {isSessionLoading && messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-sm text-zinc-400 dark:text-zinc-500">
            <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            กำลังโหลดประวัติแชท...
          </div>
        ) : showInitialPrompts ? (
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
                    <span className="text-[11px] font-medium leading-snug text-zinc-700 dark:text-zinc-300">
                      {p.text}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
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

        {/* Messages + loading */}
        <ChatMessages
          messages={messages}
          isLoading={isLoading}
          onConfirmCreate={handleConfirmCreate}
          onConfirmUpdate={handleConfirmUpdate}
          onConfirmMove={handleConfirmMove}
          onCancelAction={handleCancelAction}
          onSourceClick={handleSourceClick}
        />

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

      {/* Dev: Reindex Board */}
      {hasBoard && selectedWorkspaceId && selectedBoardId && (
        <ReindexButton workspaceId={selectedWorkspaceId} boardId={selectedBoardId} />
      )}

      {/* Input */}
      <ChatInput
        value={inputValue}
        onChange={setInputValue}
        onSubmit={handleSubmit}
        isLoading={isLoading}
        hasBoard={hasBoard}
      />
    </div>
  );
}
