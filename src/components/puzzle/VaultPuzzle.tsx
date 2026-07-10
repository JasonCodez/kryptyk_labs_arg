"use client";

import { useEffect, useState } from "react";
import { MAX_PUZZLE_ATTEMPTS } from "@/lib/puzzleConstants";
import { createDefaultVaultData, getVaultPuzzleData } from "@/lib/vault";

interface Props {
  puzzleId: string;
  vaultData: unknown;
  onSolved?: () => void;
  alreadySolved?: boolean;
  failedAttempts?: number;
}

function normalizeWord(value: string): string {
  return value.toUpperCase().replace(/[^A-Z]/g, "");
}

export default function VaultPuzzle({
  puzzleId,
  vaultData,
  onSolved,
  alreadySolved = false,
  failedAttempts: initialFailedAttempts = 0,
}: Props) {
  const data = getVaultPuzzleData(vaultData) ?? createDefaultVaultData();
  const expectedCenter = String(data.grid[data.missing.row][data.missing.col]);
  const storageKey = `vault-progress:${puzzleId}`;
  const progressSignature = `${expectedCenter}:${data.targetWord}:${data.finalCode}`;

  const [centerGuess, setCenterGuess] = useState(alreadySolved ? expectedCenter : "");
  const [wordGuess, setWordGuess] = useState(alreadySolved ? data.targetWord : "");
  const [codeGuess, setCodeGuess] = useState(alreadySolved ? data.finalCode : "");
  const [stageOneSolved, setStageOneSolved] = useState(alreadySolved);
  const [stageTwoSolved, setStageTwoSolved] = useState(alreadySolved);
  const [completed, setCompleted] = useState(alreadySolved);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [failedAttempts, setFailedAttempts] = useState(initialFailedAttempts);
  const [revealedAnswer, setRevealedAnswer] = useState<string | null>(alreadySolved ? data.finalCode : null);

  useEffect(() => {
    if (alreadySolved || typeof window === "undefined") {
      return;
    }

    try {
      const saved = localStorage.getItem(storageKey);
      if (!saved) {
        return;
      }

      const parsed = JSON.parse(saved) as {
        signature?: string;
        centerGuess?: string;
        wordGuess?: string;
        codeGuess?: string;
        stageOneSolved?: boolean;
        stageTwoSolved?: boolean;
      };

      if (parsed.signature !== progressSignature) {
        localStorage.removeItem(storageKey);
        return;
      }

      if (typeof parsed.centerGuess === "string") {
        setCenterGuess(parsed.centerGuess);
      }
      if (typeof parsed.wordGuess === "string") {
        setWordGuess(parsed.wordGuess);
      }
      if (typeof parsed.codeGuess === "string") {
        setCodeGuess(parsed.codeGuess);
      }
      if (parsed.stageOneSolved === true) {
        setStageOneSolved(true);
      }
      if (parsed.stageTwoSolved === true) {
        setStageTwoSolved(true);
      }
    } catch {
      // ignore corrupted local state
    }
  }, [alreadySolved, progressSignature, storageKey]);

  useEffect(() => {
    if (!alreadySolved) {
      return;
    }

    setCenterGuess(expectedCenter);
    setWordGuess(data.targetWord);
    setCodeGuess(data.finalCode);
    setStageOneSolved(true);
    setStageTwoSolved(true);
    setCompleted(true);
    setRevealedAnswer(data.finalCode);
  }, [alreadySolved, data.finalCode, data.targetWord, expectedCenter]);

  useEffect(() => {
    setFailedAttempts(initialFailedAttempts);
  }, [initialFailedAttempts]);

  const attemptsLocked = !alreadySolved && failedAttempts >= MAX_PUZZLE_ATTEMPTS;
  const activeStage = completed ? 4 : !stageOneSolved ? 1 : !stageTwoSolved ? 2 : 3;

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (alreadySolved || completed || attemptsLocked) {
      try {
        localStorage.removeItem(storageKey);
      } catch {
        // ignore storage failures
      }
      return;
    }

    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          signature: progressSignature,
          centerGuess,
          wordGuess,
          codeGuess,
          stageOneSolved,
          stageTwoSolved,
        })
      );
    } catch {
      // ignore storage failures
    }
  }, [alreadySolved, attemptsLocked, centerGuess, codeGuess, completed, progressSignature, stageOneSolved, stageTwoSolved, storageKey, wordGuess]);

  const handleStageOneSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (centerGuess.trim() === expectedCenter) {
      setStageOneSolved(true);
      setError("");
      return;
    }

    setError("That center value does not fit the row and column pattern yet.");
  };

  const handleStageTwoSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (normalizeWord(wordGuess) === normalizeWord(data.targetWord)) {
      setStageTwoSolved(true);
      setError("");
      return;
    }

    setError("That instruction word does not match the letter clues.");
  };

  const handleStageThreeSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (completed || submitting || attemptsLocked) {
      return;
    }

    const normalizedCode = codeGuess.replace(/\D/g, "").slice(0, data.finalCode.length);
    if (normalizedCode.length !== data.finalCode.length) {
      setError(`Enter the full ${data.finalCode.length}-digit vault code.`);
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      try {
        await fetch(`/api/puzzles/${puzzleId}/progress`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "log_attempt" }),
        });
      } catch {
        // non-critical
      }

      const response = await fetch(`/api/puzzles/${puzzleId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer: normalizedCode }),
      });

      const payload = await response.json();

      if (!response.ok) {
        if (payload.attemptsUsed !== undefined) {
          setFailedAttempts(payload.attemptsUsed);
        }
        if (payload.revealAnswer) {
          setRevealedAnswer(payload.revealAnswer);
        }
        setError(payload.error || "Failed to submit the vault code.");
        return;
      }

      if (!payload.correct) {
        if (payload.attemptsUsed !== undefined) {
          setFailedAttempts(payload.attemptsUsed);
        }
        if (payload.locked && payload.revealAnswer) {
          setRevealedAnswer(payload.revealAnswer);
        }

        const remaining = payload.attemptsRemaining;
        const suffix = remaining !== undefined ? ` (${remaining} attempt${remaining !== 1 ? "s" : ""} left)` : "";
        setError((payload.message || "Incorrect code.") + suffix);
        return;
      }

      try {
        await fetch(`/api/puzzles/${puzzleId}/progress`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "attempt_success" }),
        });
      } catch {
        // non-critical
      }

      setCodeGuess(normalizedCode);
      setCompleted(true);
      setRevealedAnswer(normalizedCode);
      onSolved?.();
    } catch {
      setError("Network error while submitting the vault code.");
    } finally {
      setSubmitting(false);
    }
  };

  // Locked overlay — the server already resets the attempt counter the
  // moment it hits the cap (see submit/route.ts's attemptLimitTypes branch),
  // so "Play Again" just needs to reset this component's local state and
  // restart from stage 1.
  if (attemptsLocked) {
    return (
      <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-8 text-center text-white">
        <div className="mb-4 text-4xl">LOCKED</div>
        <p className="text-sm text-red-100">You used all {MAX_PUZZLE_ATTEMPTS} vault attempts.</p>
        {revealedAnswer ? (
          <p className="mt-4 text-lg font-black tracking-[0.35em] text-yellow-300">{revealedAnswer}</p>
        ) : null}
        <button
          type="button"
          onClick={() => {
            setFailedAttempts(0);
            setRevealedAnswer(null);
            setCenterGuess("");
            setWordGuess("");
            setCodeGuess("");
            setStageOneSolved(false);
            setStageTwoSolved(false);
            setError("");
          }}
          className="mt-5 rounded-xl bg-amber-300 px-5 py-3 text-sm font-black uppercase tracking-[0.2em] text-slate-950"
        >
          Play Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 rounded-3xl border border-amber-300/20 bg-slate-950/80 p-6 text-white shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
      <div className="space-y-3 rounded-2xl border border-amber-300/15 bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.18),_transparent_60%)] p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-amber-200/80">The Vault</p>
            <h3 className="mt-2 text-2xl font-black tracking-[0.08em] text-amber-100">Three-stage logic lock</h3>
          </div>
          <div className="rounded-full border border-amber-300/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-amber-200/80">
            {completed ? "Unlocked" : `Attempts ${failedAttempts}/${MAX_PUZZLE_ATTEMPTS}`}
          </div>
        </div>
        <p className="max-w-3xl text-sm leading-6 text-slate-200">{data.intro}</p>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div>
      ) : null}

      {completed ? (
        <div className="rounded-2xl border border-emerald-400/40 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
          {data.completionMessage}
        </div>
      ) : null}

      {!completed ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-sm text-slate-200">
          Stage {activeStage} of 3
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">Number Grid</p>
        <div className="grid grid-cols-3 gap-3">
          {data.grid.map((row, rowIndex) =>
            row.map((value, colIndex) => {
              const isMissingCell = rowIndex === data.missing.row && colIndex === data.missing.col;
              const displayValue = isMissingCell && !stageOneSolved ? "?" : String(value);

              return (
                <div
                  key={`${rowIndex}-${colIndex}`}
                  className={`rounded-2xl border px-3 py-6 text-center text-2xl font-black tracking-[0.12em] ${
                    isMissingCell
                      ? "border-amber-300/40 bg-amber-400/10 text-amber-100"
                      : "border-slate-700 bg-slate-950/70 text-slate-100"
                  }`}
                >
                  {displayValue}
                </div>
              );
            })
          )}
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">Stage 1</p>
          <p className="mt-3 text-sm leading-6 text-slate-200">{data.stageOnePrompt}</p>
          {!stageOneSolved ? (
            <form className="mt-4 flex flex-col gap-3 sm:flex-row" onSubmit={handleStageOneSubmit}>
              <input
                type="text"
                inputMode="numeric"
                value={centerGuess}
                onChange={(event) => setCenterGuess(event.target.value.replace(/\D/g, "").slice(0, 3))}
                placeholder="Center value"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white placeholder:text-slate-500"
              />
              <button
                type="submit"
                className="rounded-xl bg-amber-300 px-5 py-3 text-sm font-black uppercase tracking-[0.2em] text-slate-950"
              >
                Check
              </button>
            </form>
          ) : (
            <p className="mt-4 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
              Stage 1 complete. The missing center value is now locked into the grid.
            </p>
          )}
        </div>

        {stageOneSolved ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">Stage 2</p>
            <p className="mt-3 text-sm leading-6 text-slate-200">{data.stageTwoPrompt}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {data.clueLines.map((line) => (
                <div key={line.key} className="rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-sm text-slate-200">
                  {line.label}
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-slate-400">
              Work out the letters yourself, then submit the full instruction word.
            </p>
            {!stageTwoSolved ? (
              <form className="mt-4 flex flex-col gap-3 sm:flex-row" onSubmit={handleStageTwoSubmit}>
                <input
                  type="text"
                  value={wordGuess}
                  onChange={(event) => setWordGuess(event.target.value)}
                  placeholder="Instruction word"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 uppercase tracking-[0.18em] text-white placeholder:text-slate-500"
                />
                <button
                  type="submit"
                  className="rounded-xl bg-amber-300 px-5 py-3 text-sm font-black uppercase tracking-[0.2em] text-slate-950"
                >
                  Check
                </button>
              </form>
            ) : (
              <p className="mt-4 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
                Stage 2 complete. Use that instruction on the finished grid to derive the vault code.
              </p>
            )}
          </div>
        ) : null}

        {stageTwoSolved ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">Stage 3</p>
            <p className="mt-3 text-sm leading-6 text-slate-200">{data.stageThreePrompt}</p>
            <p className="mt-4 text-xs text-slate-400">
              Apply the instruction and submit the final {data.finalCode.length}-digit code when you are confident.
            </p>
            <form className="mt-5 flex flex-col gap-3 sm:flex-row" onSubmit={handleStageThreeSubmit}>
              <input
                type="text"
                inputMode="numeric"
                value={codeGuess}
                onChange={(event) => setCodeGuess(event.target.value.replace(/\D/g, "").slice(0, data.finalCode.length))}
                placeholder={`Enter the ${data.finalCode.length}-digit code`}
                disabled={completed}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white placeholder:text-slate-500 disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={completed || submitting}
                className="rounded-xl bg-emerald-400 px-5 py-3 text-sm font-black uppercase tracking-[0.2em] text-slate-950 disabled:cursor-default disabled:opacity-60"
              >
                {completed ? "Unlocked" : submitting ? "Checking" : "Unlock"}
              </button>
            </form>
          </div>
        ) : null}
      </section>
    </div>
  );
}