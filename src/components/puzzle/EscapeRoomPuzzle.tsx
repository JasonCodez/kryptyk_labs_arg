"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type EscapeRoomStage = {
  id: string;
  order: number;
  title: string;
  description: string | null;
  puzzleType: string;
  puzzleData: unknown;
  hints: unknown;
  rewardItem: string | null;
  rewardDescription: string | null;
};

type EscapeRoomResponse = {
  id: string;
  stages: EscapeRoomStage[];
  puzzle?: {
    title: string;
    description: string | null;
  };
};

export function EscapeRoomPuzzle({
  puzzleId,
  onComplete,
}: {
  puzzleId: string;
  onComplete: () => void;
}) {
  const [data, setData] = useState<EscapeRoomResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  const [stageIndex, setStageIndex] = useState(1);
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string>("");

  const completedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError("");

        const res = await fetch(`/api/puzzles/escape-room/${puzzleId}`);
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error || "Failed to load escape room");
        }

        const json = (await res.json()) as EscapeRoomResponse;
        if (!cancelled) {
          setData(json);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load escape room");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [puzzleId]);

  const stage = useMemo(() => {
    if (!data) return null;
    return (
      data.stages.find((s) => s.order === stageIndex) ??
      data.stages[stageIndex] ??
      data.stages[stageIndex - 1] ??
      null
    );
  }, [data, stageIndex]);

  useEffect(() => {
    if (!loading && data && !stage && !completedRef.current) {
      completedRef.current = true;
      onComplete();
    }
  }, [loading, data, stage, onComplete]);

  const hints = useMemo(() => {
    if (!stage) return [] as string[];
    const raw = stage.hints;
    if (Array.isArray(raw)) {
      return raw.map((h) => (typeof h === "string" ? h : JSON.stringify(h)));
    }
    return [];
  }, [stage]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stage || !answer.trim() || submitting) return;

    try {
      setSubmitting(true);
      setMessage("");

      const res = await fetch(`/api/puzzles/escape-room/${puzzleId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stageIndex, answer: answer.trim() }),
      });

      const body = (await res.json().catch(() => null)) as
        | {
            correct?: boolean;
            message?: string;
            nextStageIndex?: number;
          }
        | { error?: string }
        | null;

      if (!res.ok) {
        throw new Error((body as { error?: string } | null)?.error || "Failed to submit answer");
      }

      if (body && "correct" in body && body.correct) {
        setMessage(body.message || "Correct! Moving to next stage...");
        setAnswer("");
        setStageIndex(typeof body.nextStageIndex === "number" ? body.nextStageIndex : stageIndex + 1);
      } else {
        setMessage((body as { message?: string } | null)?.message || "Incorrect answer. Try again.");
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed to submit answer");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="text-gray-300">Loading escape room…</div>;
  }

  if (error) {
    return <div className="text-red-300">{error}</div>;
  }

  if (!data || !stage) {
    return <div className="text-green-300">Escape room complete!</div>;
  }

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-4">
      <div className="mb-3">
        <div className="text-white font-semibold">
          Stage {stage.order}: {stage.title}
        </div>
        {stage.description && <div className="text-gray-300 text-sm mt-1">{stage.description}</div>}
      </div>

      {hints.length > 0 && (
        <div className="mb-3 text-sm text-gray-400">
          Hints: {hints.join(" • ")}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2 items-center">
        <input
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          disabled={submitting}
          placeholder="Enter stage answer…"
          className="flex-1 px-3 py-2 rounded bg-slate-800 border border-slate-700 text-white placeholder-gray-500"
        />
        <button
          type="submit"
          disabled={submitting || !answer.trim()}
          className="px-4 py-2 rounded bg-slate-700 text-white disabled:opacity-50"
        >
          {submitting ? "Checking…" : "Submit"}
        </button>
      </form>

      {message && <div className="mt-3 text-sm text-gray-200">{message}</div>}
    </div>
  );
}
