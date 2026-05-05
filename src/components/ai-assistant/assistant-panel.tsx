"use client";

import { useEffect, useRef, useState, useCallback } from "react";
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
import type { Task, List } from "@/types/database";

// ── Types ────────────────────────────────────────────────────────────

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

type FilterType = "all" | "mine" | "overdue" | "today";

// ── Constants ────────────────────────────────────────────────────────

const SUGGESTED_PROMPTS = [
  "วันนี้ควรโฟกัสงานไหน?",
  "สรุปบอร์ดนี้ให้หน่อย",
  "วิเคราะห์ความเสี่ยง",
  "สรุป progress ตอนนี้",
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

const RULE_BASED_KEYWORDS = [
  "โฟกัส", "สรุปบอร์ด", "สรุป board", "สรุปใหม่",
  "ความเสี่ยง", "เสี่ยง", "วิเคราะห์", "overdue",
  "progress", "ความคืบหน้า", "งานของฉัน",
];

function isRuleBasedPrompt(prompt: string): boolean {
  return RULE_BASED_KEYWORDS.some((kw) => prompt.includes(kw));
}

function generateRuleResponse(
  prompt: string,
  tasks: Task[],
  lists: List[],
): string {
  if (prompt.includes("โฟกัส")) return formatFocusResponse(tasks, lists);
  if (prompt.includes("สรุปบอร์ด") || prompt.includes("สรุป board") || prompt.includes("สรุปใหม่"))
    return formatFullInsightResponse(tasks, lists);
  if (prompt.includes("ความเสี่ยง") || prompt.includes("เสี่ยง") || prompt.includes("วิเคราะห์"))
    return formatRiskAnalysis(tasks, lists);
  if (prompt.includes("overdue"))
    return formatOverdueResponse(tasks, lists);
  if (prompt.includes("progress") || prompt.includes("ความคืบหน้า"))
    return formatProgressResponse(tasks, lists);
  if (prompt.includes("งานของฉัน")) {
    if (tasks.length === 0) return "📋 ไม่มีงานของคุณในบอร์ดนี้ครับ";
    return formatFocusResponse(tasks, lists);
  }
  return formatFullInsightResponse(tasks, lists);
}

async function callLLM(
  message: string,
  tasks: Task[],
  lists: List[],
  boardName: string,
): Promise<string> {
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
    }),
  });

  const data = await res.json();

  if (!res.ok || data.fallback || !data.reply) {
    throw new Error(data.error ?? "LLM call failed");
  }

  return data.reply;
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
  const { tasks, lists, boards, selectedBoardId } = useBoardData();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handlePrompt = useCallback(
    (prompt: string, filter: FilterType = "all") => {
      if (isLoading) return;

      setMessages((prev) => [...prev, { role: "user", content: prompt }]);
      setIsLoading(true);

      // Rule-based path: suggested prompts and known keywords
      if (isRuleBasedPrompt(prompt)) {
        const delay = 300 + Math.random() * 500;
        setTimeout(() => {
          const filtered = applyFilter(tasks, lists, filter, userEmail);
          const response = generateRuleResponse(prompt, filtered, lists);
          setMessages((prev) => [...prev, { role: "assistant", content: response }]);
          setIsLoading(false);
        }, delay);
        return;
      }

      // LLM path: custom messages
      const boardName = boards.find((b) => b.id === selectedBoardId)?.title ?? "";
      callLLM(prompt, tasks, lists, boardName)
        .then((reply) => {
          setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
        })
        .catch(() => {
          const filtered = applyFilter(tasks, lists, filter, userEmail);
          const fallback = generateRuleResponse(prompt, filtered, lists);
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: fallback + "\n\n_(ใช้ข้อมูลจากระบบ — LLM ไม่พร้อมใช้งาน)_" },
          ]);
        })
        .finally(() => setIsLoading(false));
    },
    [isLoading, tasks, lists, userEmail, boards, selectedBoardId],
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

  return (
    <div className="flex h-full flex-col rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
      {/* Chat area */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {/* Welcome */}
        <div className="flex gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/30 mt-0.5">
            <SparkleIcon className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800/60 px-3.5 py-2.5 text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
            {hasBoard ? (
              <>
                สวัสดีครับ! 👋 ผมคือ AI Assistant ของคุณ<br />
                กำลังวิเคราะห์บอร์ด{" "}
                <span className="font-medium text-indigo-600 dark:text-indigo-400">
                  &ldquo;{boardTitle}&rdquo;
                </span>
                <br />
                เลือกคำถามด้านล่างหรือถามอะไรก็ได้เกี่ยวกับงานได้เลยครับ
              </>
            ) : (
              <>
                สวัสดีครับ! 👋 ผมคือ AI Assistant ของคุณ<br />
                กรุณาเลือกบอร์ดก่อน จึงจะวิเคราะห์งานให้ได้ครับ
              </>
            )}
          </div>
        </div>

        {/* Chat messages */}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : ""}`}
          >
            {msg.role === "assistant" && (
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/30 mt-0.5">
                <SparkleIcon className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-line ${
                msg.role === "user"
                  ? "bg-indigo-600 text-white dark:bg-indigo-500"
                  : "bg-zinc-50 text-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/30 mt-0.5">
              <SparkleIcon className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800/60 px-3.5 py-2.5 text-sm text-zinc-400 dark:text-zinc-500">
              {(() => {
                const lastMsg = messages[messages.length - 1];
                const isCustom = lastMsg?.role === "user" && !isRuleBasedPrompt(lastMsg.content ?? "");
                return isCustom ? (
                  <span className="inline-flex items-center gap-1">
                    กำลังคิด
                    <span className="animate-pulse">...</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1">
                    กำลังวิเคราะห์ข้อมูล
                    <span className="animate-pulse">...</span>
                  </span>
                );
              })()}
            </div>
          </div>
        )}

        <div ref={chatEndRef} />

        {/* Initial suggested prompts */}
        {showInitialPrompts && (
          <div className="space-y-2 pt-2">
            {SUGGESTED_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                onClick={() => handlePrompt(prompt)}
                disabled={!hasBoard}
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700/60 bg-white dark:bg-zinc-800/40 px-3.5 py-2.5 text-left text-sm text-zinc-700 dark:text-zinc-300 transition-all hover:border-indigo-300 hover:bg-indigo-50/50 dark:hover:border-indigo-500/40 dark:hover:bg-indigo-900/20 hover:text-indigo-700 dark:hover:text-indigo-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-zinc-200 disabled:hover:bg-white dark:disabled:hover:border-zinc-700/60 dark:disabled:hover:bg-zinc-800/40 dark:disabled:hover:text-zinc-300"
              >
                {prompt}
              </button>
            ))}
          </div>
        )}

        {/* Follow-up actions */}
        {!isLoading && messages.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {FOLLOW_UP_ACTIONS.map((action) => (
              <button
                key={action.label}
                onClick={() => handlePrompt(action.prompt, action.filter)}
                disabled={!hasBoard}
                className="inline-flex items-center rounded-lg border border-zinc-200 dark:border-zinc-700/60 bg-white dark:bg-zinc-800/40 px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 transition-all hover:border-indigo-300 hover:bg-indigo-50/50 dark:hover:border-indigo-500/40 dark:hover:bg-indigo-900/20 hover:text-indigo-700 dark:hover:text-indigo-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-zinc-100 dark:border-zinc-800/80 px-5 py-3">
        <div className="flex items-center gap-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 px-3.5 py-2.5">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading || !hasBoard}
            placeholder={hasBoard ? "พิมพ์คำถามเกี่ยวกับงาน..." : "เลือกบอร์ดก่อน..."}
            className="flex-1 bg-transparent text-sm text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 outline-none disabled:text-zinc-400 dark:disabled:text-zinc-500 disabled:cursor-not-allowed"
          />
          <button
            onClick={handleSubmit}
            disabled={isLoading || !hasBoard || !inputValue.trim()}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white transition-colors hover:bg-indigo-700 disabled:bg-zinc-200 dark:disabled:bg-zinc-700 disabled:text-zinc-400 dark:disabled:text-zinc-500 disabled:cursor-not-allowed"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
