"use client";

import { useState, useRef, useEffect } from "react";

export interface BulkActionToolbarProps {
  selectedCount: number;
  listTitles: string[];
  onBulkMove: (targetTitle: string) => void;
  moving: boolean;
  onClearSelection: () => void;
}

const displayTitle = (title: string) =>
  title === "Done" ? "Completed" : title;

export default function BulkActionToolbar({
  selectedCount,
  listTitles,
  onBulkMove,
  moving,
  onClearSelection,
}: BulkActionToolbarProps) {
  const [moveMenuOpen, setMoveMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!moveMenuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMoveMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [moveMenuOpen]);

  if (selectedCount === 0) return null;

  return (
    <div
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 shadow-lg dark:border-zinc-700 dark:bg-zinc-800"
      style={{ animation: "toolbar-in 0.15s ease-out" }}
    >
      <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 px-1.5">
        {selectedCount} selected
      </span>

      <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-700" />

      {/* Move dropdown */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMoveMenuOpen((v) => !v)}
          disabled={moving}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-800 active:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed dark:text-zinc-300 dark:hover:bg-zinc-700 dark:hover:text-zinc-100 dark:active:bg-zinc-600"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
          </svg>
          {moving ? "Moving..." : "Move"}
          <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
            <path d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" />
          </svg>
        </button>
        {moveMenuOpen && (
          <div className="absolute bottom-full left-0 mb-2 w-40 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
            <p className="px-3 py-1 text-[11px] font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
              Move to
            </p>
            {listTitles.map((title) => (
              <button
                key={title}
                onClick={() => {
                  setMoveMenuOpen(false);
                  onBulkMove(title);
                }}
                disabled={moving}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-zinc-700/50"
              >
                {displayTitle(title)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Delete placeholder */}
      <button
        disabled
        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-400 cursor-not-allowed dark:text-zinc-500"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
        </svg>
        Delete
      </button>

      <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-700" />

      <button
        onClick={onClearSelection}
        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 active:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-300 dark:active:bg-zinc-600"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
        Clear
      </button>

      <style jsx>{`
        @keyframes toolbar-in {
          from { opacity: 0; transform: translateX(-50%) translateY(8px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </div>
  );
}
