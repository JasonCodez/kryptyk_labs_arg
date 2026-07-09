"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getAnonId } from "@/lib/gridlockAnon";
import {
  DAILY_HIDDENWORD_SNAPSHOT_HEIGHT,
  DAILY_HIDDENWORD_SNAPSHOT_WIDTH,
  type DailyHiddenWordComparisonStats,
  buildDailyHiddenWordShareText,
  buildDailyHiddenWordSnapshotSvg,
} from "@/lib/dailyHiddenWordShare";
import {
  HIDDEN_WORD_GRADE_ORDER,
  getHiddenWordGrade,
  type HiddenWordGameStatus,
  type HiddenWordGuessResult,
} from "@/lib/hiddenWord";

interface DailyHiddenWordSharePanelProps {
  puzzleNumber: number;
  guessResults: HiddenWordGuessResult[][];
  gameStatus: HiddenWordGameStatus;
  maxGuesses: number;
  wordLength: number;
  dailyStreak?: number;
  shareUrl?: string;
}

type DailyComparisonStatsResponse = {
  available?: boolean;
  comparison?: DailyHiddenWordComparisonStats | null;
};

function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

async function svgToPngBlob(svg: string): Promise<Blob> {
  const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const svgUrl = URL.createObjectURL(svgBlob);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Failed to render snapshot image."));
      img.src = svgUrl;
    });

    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth || DAILY_HIDDENWORD_SNAPSHOT_WIDTH;
    canvas.height = image.naturalHeight || DAILY_HIDDENWORD_SNAPSHOT_HEIGHT;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas is unavailable in this browser.");
    }

    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/png");
    });

    if (!blob) {
      throw new Error("Failed to export the snapshot.");
    }

    return blob;
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

export default function DailyHiddenWordSharePanel({
  puzzleNumber,
  guessResults,
  gameStatus,
  maxGuesses,
  wordLength,
  dailyStreak = 0,
  shareUrl = "https://puzzlewarz.com/daily",
}: DailyHiddenWordSharePanelProps) {
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [comparisonStats, setComparisonStats] = useState<DailyHiddenWordComparisonStats | null>(null);
  const [comparisonLoading, setComparisonLoading] = useState(false);

  useEffect(() => {
    if (gameStatus !== "won") {
      setComparisonStats(null);
      setComparisonLoading(false);
      return;
    }

    let ignore = false;
    const params = new URLSearchParams();
    const anonId = getAnonId();
    if (anonId) params.set("anonId", anonId);

    setComparisonLoading(true);
    fetch(`/api/daily/comparison-stats${params.toString() ? `?${params.toString()}` : ""}`, {
      cache: "no-store",
    })
      .then((response) => (response.ok ? response.json() as Promise<DailyComparisonStatsResponse> : null))
      .then((data) => {
        if (ignore) return;
        setComparisonStats(data?.available ? data.comparison ?? null : null);
      })
      .catch(() => {
        if (!ignore) setComparisonStats(null);
      })
      .finally(() => {
        if (!ignore) setComparisonLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [gameStatus, puzzleNumber]);

  const grade = gameStatus === "won" ? getHiddenWordGrade(guessResults.length, maxGuesses) : null;

  // % of today's solvers whose grade was at least as good as yours (S is best) — the
  // grade-focused framing this panel leans on instead of just a raw guess-count percentile.
  const gradeOrBetterPercent = useMemo(() => {
    if (!comparisonStats) return null;
    const yourIndex = HIDDEN_WORD_GRADE_ORDER.indexOf(comparisonStats.yourGrade);
    if (yourIndex === -1 || comparisonStats.totalSolvers === 0) return null;
    const betterOrEqual = HIDDEN_WORD_GRADE_ORDER
      .slice(0, yourIndex + 1)
      .reduce((sum, g) => sum + (comparisonStats.gradeCounts[g] ?? 0), 0);
    return Math.round((betterOrEqual / comparisonStats.totalSolvers) * 100);
  }, [comparisonStats]);

  const shareText = useMemo(() => buildDailyHiddenWordShareText({
    puzzleNumber,
    guessResults,
    gameStatus,
    maxGuesses,
    dailyStreak,
    comparison: comparisonStats,
  }), [comparisonStats, dailyStreak, gameStatus, guessResults, maxGuesses, puzzleNumber]);

  const snapshotSvg = useMemo(() => buildDailyHiddenWordSnapshotSvg({
    puzzleNumber,
    guessResults,
    gameStatus,
    maxGuesses,
    wordLength,
    dailyStreak,
    comparison: comparisonStats,
    shareUrl,
  }), [comparisonStats, dailyStreak, gameStatus, guessResults, maxGuesses, puzzleNumber, shareUrl, wordLength]);

  const previewSrc = useMemo(() => svgToDataUrl(snapshotSvg), [snapshotSvg]);

  const setTransientFeedback = useCallback((message: string) => {
    setFeedback(message);
    window.clearTimeout((setTransientFeedback as unknown as { timer?: number }).timer);
    (setTransientFeedback as unknown as { timer?: number }).timer = window.setTimeout(() => setFeedback(""), 2600);
  }, []);

  const withBusyState = useCallback(async (label: string, action: () => Promise<void>) => {
    setBusyAction(label);
    try {
      await action();
    } finally {
      setBusyAction(null);
    }
  }, []);

  const copyText = useCallback(async () => {
    await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
    setTransientFeedback("Result text copied.");
  }, [setTransientFeedback, shareText, shareUrl]);

  const downloadSnapshot = useCallback(async () => {
    const blob = await svgToPngBlob(snapshotSvg);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `puzzlewarz-daily-${puzzleNumber}.png`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setTransientFeedback("Snapshot downloaded.");
  }, [puzzleNumber, setTransientFeedback, snapshotSvg]);

  const copySnapshot = useCallback(async () => {
    const ClipboardItemCtor = typeof ClipboardItem !== "undefined" ? ClipboardItem : null;
    if (!ClipboardItemCtor || !navigator.clipboard?.write) {
      await downloadSnapshot();
      setTransientFeedback("Image copy is not supported here. Downloaded instead.");
      return;
    }

    const blob = await svgToPngBlob(snapshotSvg);
    await navigator.clipboard.write([new ClipboardItemCtor({ [blob.type]: blob })]);
    setTransientFeedback("Snapshot image copied.");
  }, [downloadSnapshot, setTransientFeedback, snapshotSvg]);

  const shareResult = useCallback(async () => {
    const title = `PuzzleWarz Daily #${puzzleNumber}`;
    if (typeof navigator === "undefined" || typeof navigator.share !== "function") {
      await copyText();
      return;
    }

    const blob = await svgToPngBlob(snapshotSvg);
    const file = new File([blob], `puzzlewarz-daily-${puzzleNumber}.png`, { type: blob.type });

    try {
      if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title,
          text: shareText,
          url: shareUrl,
          files: [file],
        });
      } else {
        await navigator.share({ title, text: `${shareText}\n${shareUrl}` });
      }
      setTransientFeedback("Share sheet opened.");
    } catch (error) {
      if (!(error instanceof Error) || error.name !== "AbortError") {
        throw error;
      }
    }
  }, [copyText, puzzleNumber, setTransientFeedback, shareText, shareUrl, snapshotSvg]);

  const openTextShare = useCallback((platform: "x" | "whatsapp") => {
    const encodedText = encodeURIComponent(`${shareText}\n${shareUrl}`);
    const url = platform === "x"
      ? `https://x.com/intent/tweet?text=${encodedText}`
      : `https://wa.me/?text=${encodedText}`;
    const features = platform === "x" ? "noopener,noreferrer,width=600,height=500" : "noopener,noreferrer";
    window.open(url, "_blank", features);
  }, [shareText, shareUrl]);

  if (gameStatus === "playing" || guessResults.length === 0) {
    return null;
  }

  return (
    <section
      className="rounded-2xl border px-4 py-6 sm:px-5"
      style={{
        background: "rgba(255,255,255,0.03)",
        borderColor: "rgba(56,145,166,0.18)",
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <p className="text-xs font-bold tracking-[0.16em] uppercase" style={{ color: "#9BD6E4" }}>
            Share Snapshot
          </p>
          <h3 className="text-lg font-black text-white mt-1">
            Daily #{puzzleNumber} ready to post
          </h3>
        </div>
        <div className="text-xs font-semibold tracking-[0.14em] uppercase" style={{ color: "#FDE74C" }}>
          {gameStatus === "won" ? `${guessResults.length}/${maxGuesses}` : `X/${maxGuesses}`}
        </div>
      </div>

      <div
        className="rounded-2xl overflow-hidden border"
        style={{
          borderColor: "rgba(255,255,255,0.08)",
          background: "rgba(2,2,2,0.75)",
        }}
      >
        <img
          src={previewSrc}
          alt={`Daily Hidden Word #${puzzleNumber} result snapshot`}
          className="block w-full h-auto"
        />
      </div>

      {gameStatus === "won" && (
        <div
          className="mt-4 rounded-xl border px-4 py-3"
          style={{
            background: "rgba(255,255,255,0.03)",
            borderColor: "rgba(255,255,255,0.08)",
          }}
        >
          {comparisonStats ? (
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <div className="flex items-center gap-3">
                {grade && (
                  <span
                    className="font-black text-2xl leading-none px-2.5 py-1 rounded-lg"
                    style={{ color: grade.color, background: `${grade.color}1a`, border: `1px solid ${grade.color}55` }}
                    title="Your grade"
                  >
                    {grade.grade}
                  </span>
                )}
                <div style={{ color: "#E5E7EB" }}>
                  <span className="font-black text-white">Rank #{comparisonStats.rank}</span>
                  <span style={{ color: "#9CA3AF" }}> of {comparisonStats.totalSolvers} today</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-3 text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: "#9BD6E4" }}>
                <span>More guesses: {comparisonStats.higherGuessCount}</span>
                <span>Same: {comparisonStats.sameGuessCount}</span>
                <span>Fewer guesses: {comparisonStats.lowerGuessCount}</span>
              </div>
              <div style={{ color: "#FDE74C" }}>
                Beat {comparisonStats.beatPercent}% of today's solvers
              </div>
              {gradeOrBetterPercent !== null && (
                <div className="w-full text-xs" style={{ color: "#9BD6E4" }}>
                  {gradeOrBetterPercent}% of today&apos;s solvers matched grade {comparisonStats.yourGrade} or better
                </div>
              )}
            </div>
          ) : (
            <div style={{ color: comparisonLoading ? "#9BD6E4" : "#6B7280" }}>
              {comparisonLoading
                ? "Loading today's rank and solver breakdown..."
                : "Rank and solver breakdown will appear here once today's solve field is available."}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2 mt-5">
        <button
          onClick={() => withBusyState("share", shareResult)}
          disabled={busyAction !== null}
          className="px-4 py-2 rounded-xl text-sm font-bold transition-opacity hover:opacity-85 disabled:opacity-45"
          style={{ background: "linear-gradient(135deg, #38D399, #FDE74C)", color: "#020202" }}
        >
          {busyAction === "share" ? "Sharing..." : "Share"}
        </button>
        <button
          onClick={() => withBusyState("copy-image", copySnapshot)}
          disabled={busyAction !== null}
          className="px-4 py-2 rounded-xl text-sm font-bold transition-opacity hover:opacity-85 disabled:opacity-45"
          style={{ background: "rgba(56,145,166,0.14)", border: "1px solid rgba(56,145,166,0.3)", color: "#9BD6E4" }}
        >
          {busyAction === "copy-image" ? "Copying..." : "Copy Image"}
        </button>
        <button
          onClick={() => withBusyState("download", downloadSnapshot)}
          disabled={busyAction !== null}
          className="px-4 py-2 rounded-xl text-sm font-bold transition-opacity hover:opacity-85 disabled:opacity-45"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#E5E7EB" }}
        >
          {busyAction === "download" ? "Saving..." : "Download PNG"}
        </button>
        <button
          onClick={() => withBusyState("copy-text", copyText)}
          disabled={busyAction !== null}
          className="px-4 py-2 rounded-xl text-sm font-bold transition-opacity hover:opacity-85 disabled:opacity-45"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#AB9F9D" }}
        >
          {busyAction === "copy-text" ? "Copying..." : "Copy Text"}
        </button>
        <button
          onClick={() => openTextShare("x")}
          className="px-4 py-2 rounded-xl text-sm font-bold transition-opacity hover:opacity-85"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#FFFFFF" }}
        >
          Post to X
        </button>
        <button
          onClick={() => openTextShare("whatsapp")}
          className="px-4 py-2 rounded-xl text-sm font-bold transition-opacity hover:opacity-85"
          style={{ background: "rgba(37,211,102,0.12)", border: "1px solid rgba(37,211,102,0.28)", color: "#4ADE80" }}
        >
          WhatsApp
        </button>
      </div>

      <div className="mt-3 min-h-5 text-sm" style={{ color: feedback ? "#38D399" : "#6B7280" }}>
        {feedback || "Use Share where supported, or copy/download the snapshot to post it anywhere."}
      </div>
    </section>
  );
}