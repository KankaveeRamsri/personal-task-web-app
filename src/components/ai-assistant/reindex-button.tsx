"use client";

import { useState, useCallback } from "react";

type ReindexStatus = "idle" | "loading" | "success" | "error";

interface ReindexButtonProps {
  workspaceId: string;
  boardId: string;
}

export function ReindexButton({ workspaceId, boardId }: ReindexButtonProps) {
  const [status, setStatus] = useState<ReindexStatus>("idle");
  const [result, setResult] = useState<{ indexed: number; failed: number } | null>(null);

  const handleReindex = useCallback(async () => {
    if (status === "loading") return;
    setStatus("loading");
    setResult(null);
    try {
      const res = await fetch("/api/ai/rag/reindex", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, boardId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Reindex failed");
      setResult({ indexed: (data as { indexed: number }).indexed, failed: (data as { failed: number }).failed });
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }, [workspaceId, boardId, status]);

  return (
    <div className="border-t border-dashed border-zinc-200 dark:border-zinc-700/60 px-4 py-2 flex items-center gap-2 bg-zinc-50/50 dark:bg-zinc-800/30">
      <button
        onClick={handleReindex}
        disabled={status === "loading"}
        className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2.5 py-1 text-[10px] font-medium text-zinc-600 dark:text-zinc-400 transition-colors hover:border-blue-300 hover:bg-blue-50 dark:hover:border-blue-500/40 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {status === "loading" ? "Reindexing…" : "Dev: Reindex Board"}
      </button>
      {status === "success" && result && (
        <span className="text-[10px] text-emerald-600 dark:text-emerald-400">
          Done — {result.indexed} indexed, {result.failed} failed
        </span>
      )}
      {status === "error" && (
        <span className="text-[10px] text-red-600 dark:text-red-400">
          Reindex failed — check console
        </span>
      )}
    </div>
  );
}
