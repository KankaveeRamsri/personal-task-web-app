"use client";

import type { RagSource } from "./types";

const RAG_PRIORITY_META: Record<string, { label: string; color: string }> = {
  high: { label: "สูง", color: "text-red-500 dark:text-red-400" },
  medium: { label: "กลาง", color: "text-amber-500 dark:text-amber-400" },
  low: { label: "ต่ำ", color: "text-emerald-600 dark:text-emerald-400" },
};

function formatDueDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    const months = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
    return `${d.getDate()} ${months[d.getMonth()]}`;
  } catch {
    return "";
  }
}

interface SourceChipsProps {
  sources: RagSource[];
  onSourceClick: (src: RagSource) => void;
}

export function SourceChips({ sources, onSourceClick }: SourceChipsProps) {
  return (
    <div className="mt-2.5 pt-2 border-t border-zinc-200/60 dark:border-zinc-700/40">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500 mb-1.5">
        แหล่งอ้างอิง
      </div>
      <div className="flex flex-wrap gap-1.5">
        {sources.map((src) => {
          const chipTitle = (
            src.title ?? src.preview.split("\n")[0].replace(/^Task:\s*/i, "")
          ).slice(0, 40);
          const priorityMeta = src.priority ? RAG_PRIORITY_META[src.priority] : undefined;
          const dueLabel = src.dueDate ? formatDueDate(src.dueDate) : "";
          return (
            <button
              key={src.taskId}
              type="button"
              title={src.title ?? src.preview}
              onClick={() => onSourceClick(src)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white/80 dark:bg-zinc-800/50 px-2 py-1 text-[10px] text-zinc-500 dark:text-zinc-400 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 dark:hover:border-blue-500/40 dark:hover:bg-blue-900/20 dark:hover:text-blue-400 transition-colors"
            >
              <svg
                className="h-2.5 w-2.5 shrink-0 opacity-70"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244"
                />
              </svg>
              <span className="max-w-[120px] truncate font-medium">{chipTitle}</span>
              {priorityMeta && (
                <span className={`shrink-0 font-semibold ${priorityMeta.color}`}>
                  {priorityMeta.label}
                </span>
              )}
              {dueLabel && (
                <span className="shrink-0 opacity-70">📅 {dueLabel}</span>
              )}
              <span className="shrink-0 tabular-nums opacity-50">
                {Math.round(src.similarity * 100)}%
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
