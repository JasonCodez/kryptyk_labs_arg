"use client";

import { useCallback, useEffect, useState } from "react";

export type DailyPuzzleType = "sudoku" | "crossword" | "word_search" | "jigsaw";

export interface DailyPuzzleContent {
  available: boolean;
  dayNumber: number;
  puzzleId?: string;
  // sudoku
  puzzleGrid?: string;
  solutionGrid?: string;
  difficulty?: string;
  // jigsaw
  imageUrl?: string;
  gridRows?: number;
  gridCols?: number;
  snapTolerance?: number;
  rotationEnabled?: boolean;
}

export interface DailyPuzzleReward {
  points: number;
  xp: number;
  streakDay: number;
}

interface DailyPuzzleStatus {
  completedToday: boolean;
  streak: number;
  streakDay: number;
  nextReward: DailyPuzzleReward;
  streakShields: number;
  skipTokens: number;
}

interface CompletionResult {
  success?: boolean;
  message?: string;
  shieldUsed?: boolean;
  reward?: DailyPuzzleReward;
  error?: string;
}

interface UseDailyPuzzleResult {
  loading: boolean;
  available: boolean;
  dayNumber: number;
  streak: number;
  streakDay: number;
  nextReward: DailyPuzzleReward | null;
  completedToday: boolean;
  streakShields: number;
  skipTokens: number;
  content: DailyPuzzleContent | null;
  error: string | null;
  /** POSTs completion, then re-fetches status so streak/reward numbers stay authoritative. */
  submitCompletion: (metadata?: Record<string, unknown>) => Promise<CompletionResult | null>;
}

/**
 * Fetches today's daily-puzzle content + streak status for one of the 4 non-word daily
 * puzzle types (sudoku/crossword/word_search/jigsaw — the word puzzle keeps its own
 * bespoke daily/page.tsx logic, since it has guest-play + localStorage guess-grid state
 * this hook doesn't need to model). Each puzzle type's own page renders the matching
 * puzzle component with `content` and calls `submitCompletion()` on solve.
 */
export function useDailyPuzzle(puzzleType: DailyPuzzleType): UseDailyPuzzleResult {
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState<DailyPuzzleContent | null>(null);
  const [status, setStatus] = useState<DailyPuzzleStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    const res = await fetch(`/api/daily/${puzzleType}/complete`, { credentials: "same-origin" });
    if (!res.ok) return null;
    return (await res.json()) as DailyPuzzleStatus;
  }, [puzzleType]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      fetch(`/api/daily/${puzzleType}/content`, { credentials: "same-origin" }).then((r) => r.json()),
      fetchStatus(),
    ])
      .then(([contentData, statusData]) => {
        if (cancelled) return;
        setContent(contentData as DailyPuzzleContent);
        setStatus(statusData);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load today's puzzle");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [puzzleType, fetchStatus]);

  const submitCompletion = useCallback(
    async (metadata?: Record<string, unknown>): Promise<CompletionResult | null> => {
      try {
        const resp = await fetch(`/api/daily/${puzzleType}/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify(metadata ? { metadata } : {}),
        });
        const data = (await resp.json()) as CompletionResult;
        const refreshed = await fetchStatus();
        if (refreshed) setStatus(refreshed);
        return data;
      } catch {
        return null;
      }
    },
    [puzzleType, fetchStatus]
  );

  return {
    loading,
    available: content?.available ?? false,
    dayNumber: content?.dayNumber ?? 0,
    streak: status?.streak ?? 0,
    streakDay: status?.streakDay ?? 1,
    nextReward: status?.nextReward ?? null,
    completedToday: status?.completedToday ?? false,
    streakShields: status?.streakShields ?? 0,
    skipTokens: status?.skipTokens ?? 0,
    content,
    error,
    submitCompletion,
  };
}
