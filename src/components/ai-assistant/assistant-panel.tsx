"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useBoardData } from "@/hooks/useBoardData";
import {
  formatFocusResponse,
  formatOverdueResponse,
  formatProgressResponse,
  formatBoardSummary,
  getOverdueTasks,
  getTasksDueToday,
} from "@/lib/ai-assistant/insights";
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
  "มีงานไหนเสี่ยง overdue ไหม?",
  "สรุป progress ตอนนี้",
];

const FOLLOW_UP_ACTIONS: { label: string; filter: FilterType; prompt: string }[] = [
  { label: "ดูเฉพาะงานของฉัน", filter: "mine", prompt: "สรุปงานของฉัน" },
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

function generateResponse(
  prompt: string,
  tasks: Task[],
  lists: List[],
): string {
  if (prompt.includes("โฟกัส")) return formatFocusResponse(tasks, lists);
  if (prompt.includes("สรุปบอร์ด") || prompt.includes("สรุป board") || prompt.includes("สรุปใหม่"))
    return formatBoardSummary(tasks, lists);
  if (prompt.includes("overdue") || prompt.includes("เสี่ยง"))
    return formatOverdueResponse(tasks, lists);
  if (prompt.includes("progress") || prompt.includes("ความคืบหน้า"))
    return formatProgressResponse(tasks, lists);
  if (prompt.includes("งานของฉัน")) {
    if (tasks.length === 0) return "📋 ไม่มีงานของคุณในบอร์ดนี้ครับ";
    return formatFocusResponse(tasks, lists);
  }
  return formatBoardSummary(tasks, lists);
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
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handlePrompt = useCallback(
    (prompt: string, filter: FilterType = "all") => {
      if (isLoading) return;

      setMessages((prev) => [...prev, { role: "user", content: prompt }]);
      setIsLoading(true);

      const delay = 300 + Math.random() * 500;
      setTimeout(() => {
        const filtered = applyFilter(tasks, lists, filter, userEmail);
        const response = generateResponse(prompt, filtered, lists);
        setMessages((prev) => [...prev, { role: "assistant", content: response }]);
        setIsLoading(false);
      }, delay);
    },
    [isLoading, tasks, lists, userEmail],
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
              <span className="inline-flex items-center gap-1">
                กำลังวิเคราะห์ข้อมูล
                <span className="animate-pulse">...</span>
              </span>
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
            disabled
            placeholder="พิมพ์คำถาม... (เร็วๆ นี้)"
            className="flex-1 bg-transparent text-sm text-zinc-400 dark:text-zinc-500 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 outline-none cursor-not-allowed"
          />
          <button
            disabled
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-200 dark:bg-zinc-700 text-zinc-400 dark:text-zinc-500 cursor-not-allowed"
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
