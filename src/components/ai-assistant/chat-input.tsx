"use client";

import { useCallback } from "react";

const MAX_INPUT_LENGTH = 500;

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
  hasBoard: boolean;
}

export function ChatInput({ value, onChange, onSubmit, isLoading, hasBoard }: ChatInputProps) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        onSubmit();
      }
    },
    [onSubmit],
  );

  return (
    <div className="border-t border-zinc-100 dark:border-zinc-800/80 px-4 py-3">
      <div className="flex items-center gap-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/40 px-3.5 py-2 focus-within:border-blue-300 dark:focus-within:border-blue-500/40 transition-colors">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading || !hasBoard}
          placeholder={hasBoard ? "พิมพ์คำถามเกี่ยวกับงาน..." : "เลือกบอร์ดก่อน..."}
          maxLength={MAX_INPUT_LENGTH}
          className="flex-1 bg-transparent text-sm text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 outline-none disabled:text-zinc-400 dark:disabled:text-zinc-500 disabled:cursor-not-allowed"
        />
        <button
          onClick={onSubmit}
          disabled={isLoading || !hasBoard || !value.trim()}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white transition-colors hover:bg-blue-700 disabled:bg-zinc-200 dark:disabled:bg-zinc-700 disabled:text-zinc-400 dark:disabled:text-zinc-500 disabled:cursor-not-allowed"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
          </svg>
        </button>
      </div>
      {value.length > MAX_INPUT_LENGTH * 0.8 && (
        <div className="mt-1 text-right text-[10px] text-zinc-400 dark:text-zinc-500 tabular-nums">
          {value.length}/{MAX_INPUT_LENGTH}
        </div>
      )}
    </div>
  );
}
