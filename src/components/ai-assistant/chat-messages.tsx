"use client";

import { detectActionIntent } from "@/lib/ai-assistant/action-planner";
import type { AssistantActionPlan } from "@/lib/ai-assistant/action-planner";
import { detectAssistantIntent } from "@/lib/ai-assistant/intent";
import type { ChatMessage, RagSource } from "./types";
import { MarkdownRenderer } from "./markdown-renderer";
import { ActionPreviewCard } from "./action-preview-card";
import { SourceChips } from "./source-chips";

export function SparkleIcon({ className }: { className?: string }) {
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

function LoadingDots() {
  return (
    <span className="flex items-center gap-0.5">
      <span className="h-1.5 w-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500 animate-bounce" style={{ animationDelay: "0ms" }} />
      <span className="h-1.5 w-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500 animate-bounce" style={{ animationDelay: "120ms" }} />
      <span className="h-1.5 w-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500 animate-bounce" style={{ animationDelay: "240ms" }} />
    </span>
  );
}

function getLoadingLabel(messages: ChatMessage[]): string {
  const lastMsg = messages[messages.length - 1];
  if (!lastMsg || lastMsg.role !== "user") return "กำลังคิด";
  const actionType = detectActionIntent(lastMsg.content ?? "");
  if (actionType !== "unknown") return "กำลังวางแผนการดำเนินการ";
  const intent = detectAssistantIntent(lastMsg.content ?? "");
  if (intent === "focus") return "กำลังค้นหางานสำคัญ";
  if (intent === "summary" || intent === "progress") return "กำลังวิเคราะห์ข้อมูล";
  if (intent === "risk") return "กำลังประเมินความเสี่ยง";
  return "กำลังคิด";
}

interface ChatMessagesProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onConfirmCreate: (msgIndex: number, plan: AssistantActionPlan) => void;
  onConfirmUpdate: (msgIndex: number, plan: AssistantActionPlan) => void;
  onConfirmMove: (msgIndex: number, plan: AssistantActionPlan) => void;
  onCancelAction: (msgIndex: number) => void;
  onSourceClick: (src: RagSource) => void;
}

export function ChatMessages({
  messages,
  isLoading,
  onConfirmCreate,
  onConfirmUpdate,
  onConfirmMove,
  onCancelAction,
  onSourceClick,
}: ChatMessagesProps) {
  const showLoading =
    isLoading &&
    !(messages[messages.length - 1]?.role === "assistant" && messages[messages.length - 1]?.content);

  return (
    <>
      {messages.map((msg, i) => {
        if (msg.role === "assistant" && !msg.content && !msg.actionPlan && !msg.ragSources) return null;
        return (
          <div key={i} className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : ""}`}>
            {msg.role === "assistant" && (
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30 mt-0.5">
                <SparkleIcon className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              </div>
            )}
            <div className="flex flex-col gap-1.5 max-w-[85%]">
              <div
                className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "whitespace-pre-line bg-blue-600 text-white dark:bg-blue-500 rounded-br-sm"
                    : "bg-zinc-50 dark:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300 border border-zinc-100 dark:border-zinc-700/40 rounded-bl-sm"
                }`}
              >
                {msg.role === "user" ? msg.content : <MarkdownRenderer content={msg.content} />}
                {msg.ragSources && msg.ragSources.length > 0 && (
                  <SourceChips sources={msg.ragSources} onSourceClick={onSourceClick} />
                )}
                {msg.actionPlan && (
                  <ActionPreviewCard
                    plan={msg.actionPlan}
                    status={msg.actionStatus ?? "pending"}
                    onConfirm={
                      !msg.actionStatus && msg.actionPlan.type === "create_task"
                        ? () => onConfirmCreate(i, msg.actionPlan!)
                        : !msg.actionStatus && msg.actionPlan.type === "update_task"
                          ? () => onConfirmUpdate(i, msg.actionPlan!)
                          : !msg.actionStatus && msg.actionPlan.type === "move_task"
                            ? () => onConfirmMove(i, msg.actionPlan!)
                            : undefined
                    }
                    onCancel={!msg.actionStatus ? () => onCancelAction(i) : undefined}
                  />
                )}
              </div>

              {msg.role === "assistant" && msg.isTimeout && (
                <div className="inline-flex items-center gap-1 self-start rounded-full bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/30 px-2 py-0.5">
                  <svg className="h-2.5 w-2.5 text-red-500 dark:text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                  <span className="text-[9px] font-medium text-red-600 dark:text-red-400">
                    AI ใช้เวลานานเกินไป
                  </span>
                </div>
              )}
              {msg.role === "assistant" && msg.isFallback && !msg.isTimeout && (
                <div className="inline-flex items-center gap-1 self-start rounded-full bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/30 px-2 py-0.5">
                  <svg className="h-2.5 w-2.5 text-amber-500 dark:text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                  <span className="text-[9px] font-medium text-amber-600 dark:text-amber-400">
                    โหมดวิเคราะห์ภายใน
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {showLoading && (
        <div className="flex gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30 mt-0.5">
            <SparkleIcon className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="rounded-2xl rounded-bl-sm border border-zinc-100 dark:border-zinc-700/40 bg-zinc-50 dark:bg-zinc-800/60 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-400 dark:text-zinc-500">
                {getLoadingLabel(messages)}
              </span>
              <LoadingDots />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
