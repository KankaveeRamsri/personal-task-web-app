"use client";

import type { AssistantActionPlan } from "@/lib/ai-assistant/action-planner";
import type { ActionStatus } from "./types";

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

interface ActionPreviewCardProps {
  plan: AssistantActionPlan;
  status: ActionStatus;
  onConfirm?: () => void;
  onCancel?: () => void;
}

export function ActionPreviewCard({ plan, status, onConfirm, onCancel }: ActionPreviewCardProps) {
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
  const isExecutable =
    plan.type === "create_task" || plan.type === "update_task" || plan.type === "move_task";
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
          <div key={line} className="text-xs text-zinc-700 dark:text-zinc-300">
            {line}
          </div>
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
