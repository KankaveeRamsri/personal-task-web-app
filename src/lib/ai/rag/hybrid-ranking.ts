export interface RankingSignals {
  semanticScore: number;
  urgencyScore: number;
  priorityScore: number;
  recencyScore: number;
  donePenalty: number;
}

interface TaskMetadata {
  priority?: string | null;
  due_date?: string | null;
  is_completed?: boolean;
  list_is_done?: boolean;
  task_updated_at?: string | null;
}

const WEIGHTS = {
  semantic: 0.65,
  urgency: 0.15,
  priority: 0.10,
  recency: 0.10,
  donePenalty: -0.30,
};

function isTaskDone(m: TaskMetadata): boolean {
  return m.is_completed === true || m.list_is_done === true;
}

function computeUrgency(m: TaskMetadata, today: Date): number {
  if (isTaskDone(m) || !m.due_date) return 0;
  // Compare dates without time component
  const due = new Date(m.due_date + "T00:00:00");
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diffDays = Math.floor((due.getTime() - todayStart.getTime()) / 86_400_000);
  if (diffDays < 0) return 1.0;
  if (diffDays === 0) return 0.9;
  if (diffDays <= 3) return 0.7;
  if (diffDays <= 7) return 0.5;
  if (diffDays <= 14) return 0.3;
  if (diffDays <= 30) return 0.1;
  return 0;
}

function computePriority(m: TaskMetadata): number {
  switch (m.priority) {
    case "high": return 1.0;
    case "medium": return 0.6;
    case "low": return 0.3;
    default: return 0;
  }
}

function computeRecency(m: TaskMetadata, today: Date): number {
  if (!m.task_updated_at) return 0;
  const updated = new Date(m.task_updated_at);
  if (isNaN(updated.getTime())) return 0;
  const diffDays = (today.getTime() - updated.getTime()) / 86_400_000;
  if (diffDays <= 1) return 1.0;
  if (diffDays <= 3) return 0.7;
  if (diffDays <= 7) return 0.5;
  if (diffDays <= 14) return 0.3;
  if (diffDays <= 30) return 0.1;
  return 0;
}

export function computeHybridScore(
  similarity: number,
  metadata: TaskMetadata,
  today: Date = new Date(),
): { hybridScore: number; rankingSignals: RankingSignals } {
  const semanticScore = Math.max(0, Math.min(1, similarity));
  const urgency = computeUrgency(metadata, today);
  const priority = computePriority(metadata);
  const recency = computeRecency(metadata, today);
  const donePenalty = isTaskDone(metadata) ? 1.0 : 0;

  const raw =
    semanticScore * WEIGHTS.semantic +
    urgency * WEIGHTS.urgency +
    priority * WEIGHTS.priority +
    recency * WEIGHTS.recency +
    donePenalty * WEIGHTS.donePenalty;

  return {
    hybridScore: Math.max(0, raw),
    rankingSignals: {
      semanticScore,
      urgencyScore: urgency,
      priorityScore: priority,
      recencyScore: recency,
      donePenalty,
    },
  };
}

export function hybridRank<T extends { similarity: number; metadata?: Record<string, unknown> | null }>(
  documents: T[],
  today: Date = new Date(),
): Array<T & { hybridScore: number; rankingSignals: RankingSignals }> {
  return documents
    .map((doc) => {
      const meta = (doc.metadata ?? {}) as TaskMetadata;
      const { hybridScore, rankingSignals } = computeHybridScore(doc.similarity, meta, today);
      return { ...doc, hybridScore, rankingSignals };
    })
    .sort((a, b) => b.hybridScore - a.hybridScore);
}
