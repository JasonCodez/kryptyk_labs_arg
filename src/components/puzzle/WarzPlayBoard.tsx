"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import SudokuPuzzle from "@/components/puzzle/SudokuPuzzle";
import HiddenWordPuzzle from "@/components/puzzle/HiddenWordPuzzle";
import WordSearchPuzzle from "@/components/puzzle/WordSearchPuzzle";
import AnagramBlitz from "@/components/puzzle/AnagramBlitz";
import ArgPuzzle from "@/components/puzzle/ArgPuzzle";
import BlackoutPuzzle from "@/components/puzzle/BlackoutPuzzle";
import JigsawPuzzle from "@/components/puzzle/JigsawPuzzle";
import { motion } from "framer-motion";
import { CircleCheck, TriangleAlert, RefreshCw, Skull, Flag } from "lucide-react";
import { useJigsawImageInfo } from "@/hooks/useJigsawImageInfo";
import { useAppReducedMotion } from "@/hooks/useAppReducedMotion";
import WarzBattleHUD, { formatBattleTime } from "@/components/warz/WarzBattleHUD";
import WarzBattleDialog from "@/components/warz/WarzBattleDialog";

interface WarzPuzzle {
  id: string;
  title: string;
  difficulty: string;
  puzzleType: string;
  data?: Record<string, unknown>;
  sudoku?: {
    puzzleGrid: string;
    solutionGrid: string;
  };
  jigsaw?: {
    imageUrl: string | null;
    gridRows: number;
    gridCols: number;
    snapTolerance: number;
    rotationEnabled: boolean;
  };
}

interface Props {
  puzzle: WarzPuzzle;
  wager: number;
  onDone: (completionSeconds: number, forfeited?: boolean) => void;
  submitError?: string | null;
  onRetry?: () => void;
  submissionPending?: boolean;
  submissionPendingLabel?: string;
}

type BattleTerminalKind = "solved" | "failed" | "forfeited" | null;

export default function WarzPlayBoard({
  puzzle,
  wager,
  onDone,
  submitError,
  onRetry,
  submissionPending = false,
  submissionPendingLabel = "Submitting result…",
}: Props) {
  const reduceMotion = useAppReducedMotion();
  const startRef = useRef<number>(0);

  const [elapsed, setElapsed] = useState(0);
  const [terminalKind, setTerminalKind] = useState<BattleTerminalKind>(null);
  const [submittedSolveSeconds, setSubmittedSolveSeconds] = useState<number | null>(null);
  const [showForfeitConfirm, setShowForfeitConfirm] = useState(false);
  const [showFailedDialog, setShowFailedDialog] = useState(false);
  const [failCountdown, setFailCountdown] = useState(5);

  // Synchronous guards — a React state update alone cannot prevent a
  // duplicate submission within the same tick (two callbacks firing before
  // a re-render lands), so these refs are the actual source of truth.
  const interactionEndedRef = useRef(false);
  const terminalSubmittedRef = useRef(false);

  const forfeitButtonRef = useRef<HTMLButtonElement>(null);
  const keepFightingRef = useRef<HTMLButtonElement>(null);
  const forfeitNowRef = useRef<HTMLButtonElement>(null);

  const jigsawImageInfo = useJigsawImageInfo(puzzle.puzzleType === "jigsaw" ? puzzle.jigsaw?.imageUrl : null);

  useEffect(() => {
    startRef.current = Date.now();
  }, []);

  // A single timer interval for the life of the component — it never
  // depends on state, so a rerender (e.g. opening the Forfeit dialog) can
  // never spawn a second one. The ref check inside decides whether a tick
  // actually updates the visible clock.
  useEffect(() => {
    const interval = setInterval(() => {
      if (!interactionEndedRef.current) {
        setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const submitTerminal = useCallback(
    (completionSeconds: number, forfeited: boolean, kind: Exclude<BattleTerminalKind, null>) => {
      if (terminalSubmittedRef.current) return;

      terminalSubmittedRef.current = true;
      interactionEndedRef.current = true;

      setTerminalKind(kind);

      if (!forfeited) {
        setSubmittedSolveSeconds(completionSeconds);
        setElapsed(completionSeconds);
      }

      setShowForfeitConfirm(false);
      setShowFailedDialog(false);

      onDone(completionSeconds, forfeited || undefined);
    },
    [onDone]
  );

  const handleSolved = useCallback(
    (overrideSeconds?: number) => {
      if (interactionEndedRef.current) return;
      const secs = overrideSeconds ?? Math.max(1, Math.round((Date.now() - startRef.current) / 1000));
      submitTerminal(secs, false, "solved");
    },
    [submitTerminal]
  );

  const handleFailed = useCallback(() => {
    if (interactionEndedRef.current) return;
    interactionEndedRef.current = true;
    setTerminalKind("failed");
    setFailCountdown(5);
    setShowFailedDialog(true);
  }, []);

  // Auto-forfeit countdown after puzzle failure.
  useEffect(() => {
    if (!showFailedDialog || terminalSubmittedRef.current) return;
    if (failCountdown <= 0) {
      submitTerminal(0, true, "failed");
      return;
    }
    const t = setTimeout(() => setFailCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [showFailedDialog, failCountdown, submitTerminal]);

  const handleForfeitBattle = useCallback(() => {
    submitTerminal(0, true, "forfeited");
  }, [submitTerminal]);

  const handleForfeitNow = useCallback(() => {
    submitTerminal(0, true, "failed");
  }, [submitTerminal]);

  const ended = terminalKind !== null;

  const renderPuzzle = () => {
    switch (puzzle.puzzleType) {
      case "word_crack":
        return (
          <HiddenWordPuzzle
            puzzleId={puzzle.id}
            hiddenWordData={puzzle.data ?? {}}
            alreadySolved={false}
            warzMode
            onSolved={() => handleSolved()}
            onFailed={handleFailed}
          />
        );

      case "word_search":
        return (
          <WordSearchPuzzle
            puzzleId={puzzle.id}
            wordSearchData={puzzle.data ?? {}}
            alreadySolved={false}
            warzMode
            persistenceScope="none"
            // The challenger solves before a challenge record/id exists. Puzzle identity is
            // therefore the shared deterministic seed both sides can derive.
            puzzleInstanceId={`shared:${puzzle.id}`}
            onSolved={() => handleSolved()}
          />
        );

      case "sudoku": {
        if (!puzzle.sudoku) return <p style={{ color: "var(--pw-text-primary)" }}>Sudoku data missing.</p>;
        let parsed: number[][] = [];
        let solution: number[][] = [];
        try { parsed = JSON.parse(puzzle.sudoku.puzzleGrid); } catch { parsed = []; }
        try { solution = JSON.parse(puzzle.sudoku.solutionGrid); } catch { solution = []; }
        return (
          <SudokuPuzzle
            puzzleId={`warz-${puzzle.id}`}
            puzzle={parsed}
            solution={solution}
            mode="daily"
            displayMode="standalone"
            onComplete={async (_grid, elapsedSeconds) => {
              handleSolved(elapsedSeconds);
              return { success: true };
            }}
          />
        );
      }

      case "jigsaw": {
        if (!puzzle.jigsaw?.imageUrl) return <p style={{ color: "var(--pw-text-primary)" }}>Jigsaw image missing.</p>;
        if (!jigsawImageInfo.ready) return <p style={{ color: "var(--pw-text-primary)" }}>Loading puzzle image…</p>;
        return (
          <JigsawPuzzle
            imageUrl={puzzle.jigsaw.imageUrl}
            rows={puzzle.jigsaw.gridRows}
            cols={puzzle.jigsaw.gridCols}
            neighborSnapTolerance={puzzle.jigsaw.snapTolerance}
            puzzleId={puzzle.id}
            // The challenger solves before a challenge record/id exists. Puzzle identity is
            // therefore the shared deterministic seed both sides can derive.
            puzzleInstanceId={`shared:${puzzle.id}`}
            mode="warz"
            persistenceScope="none"
            displayMode="standalone"
            rotationEnabled={false}
            suppressInternalCongrats
            onComplete={async (secs) => {
              handleSolved(secs);
              return { success: true };
            }}
          />
        );
      }

      case "anagram_blitz":
        return (
          <AnagramBlitz
            puzzleId={puzzle.id}
            anagramData={puzzle.data ?? {}}
            alreadySolved={false}
            onSolved={() => handleSolved()}
            onFailed={handleFailed}
          />
        );

      case "arg":
        return (
          <ArgPuzzle
            puzzleId={puzzle.id}
            argData={puzzle.data ?? {}}
            alreadySolved={false}
            onSolved={() => handleSolved()}
          />
        );

      case "blackout":
        return (
          <BlackoutPuzzle
            puzzleId={puzzle.id}
            blackoutData={puzzle.data ?? {}}
            alreadySolved={false}
            onSolved={() => handleSolved()}
          />
        );

      default:
        return <p style={{ color: "var(--pw-text-primary)" }}>Unsupported puzzle type: {puzzle.puzzleType}</p>;
    }
  };

  const showSubmissionPanel = terminalKind === "solved";
  const displaySolveTime = submittedSolveSeconds ?? elapsed;

  return (
    <div className="min-w-0 w-full">
      <WarzBattleHUD
        puzzleTitle={puzzle.title}
        wager={wager}
        elapsedSeconds={elapsed}
        ended={ended}
        onForfeit={() => setShowForfeitConfirm(true)}
        forfeitButtonRef={forfeitButtonRef}
      />

      <WarzBattleDialog
        open={showForfeitConfirm}
        role="dialog"
        title="Forfeit Battle?"
        description="Leaving now counts as a loss and submits your battle as a forfeit."
        icon={Flag}
        dismissible
        initialFocusRef={keepFightingRef}
        returnFocusRef={forfeitButtonRef}
        onClose={() => setShowForfeitConfirm(false)}
      >
        <p
          className="mb-2 text-xs font-semibold uppercase tracking-wide"
          style={{ color: "var(--pw-brand-secondary)" }}
        >
          Puzzle Warz
        </p>
        <div
          className="mb-6 rounded-lg p-3 text-sm"
          style={{ background: "var(--pw-surface-2)" }}
        >
          <span style={{ color: "var(--pw-text-muted)" }}>Wager at risk</span>
          <br />
          <span className="font-bold tabular-nums" style={{ color: "var(--pw-brand-secondary)" }}>
            {wager} Points
          </span>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            ref={keepFightingRef}
            type="button"
            onClick={() => setShowForfeitConfirm(false)}
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg border font-semibold"
            style={{ minHeight: 44, borderColor: "var(--pw-border-default)", color: "var(--pw-text-secondary)" }}
          >
            Keep Fighting
          </button>
          <button
            type="button"
            onClick={handleForfeitBattle}
            className="inline-flex min-h-12 flex-1 items-center justify-center rounded-lg font-bold"
            style={{ minHeight: 48, background: "var(--pw-error)", color: "var(--pw-text-primary)" }}
          >
            Forfeit Battle
          </button>
        </div>
      </WarzBattleDialog>

      <WarzBattleDialog
        open={showFailedDialog}
        role="alertdialog"
        title="Puzzle Failed"
        description="This battle will be submitted as a forfeit."
        icon={Skull}
        dismissible={false}
        initialFocusRef={forfeitNowRef}
      >
        <p
          className="mb-2 text-xs font-semibold uppercase tracking-wide"
          style={{ color: "var(--pw-brand-secondary)" }}
        >
          Puzzle Warz
        </p>
        <p className="mb-6 text-lg font-black tabular-nums" style={{ color: "var(--pw-error-text)" }}>
          Forfeiting in {Math.max(0, failCountdown)}…
        </p>
        <button
          ref={forfeitNowRef}
          type="button"
          onClick={handleForfeitNow}
          className="inline-flex min-h-12 w-full items-center justify-center rounded-lg font-bold"
          style={{ minHeight: 48, background: "var(--pw-error)", color: "var(--pw-text-primary)" }}
        >
          Forfeit Now
        </button>
      </WarzBattleDialog>

      <div className={ended ? "pointer-events-none opacity-60" : ""}>{renderPuzzle()}</div>

      {showSubmissionPanel && !submitError && (
        <motion.div
          initial={reduceMotion ? undefined : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="mt-6 rounded-xl border p-5 text-center"
          style={{ background: "color-mix(in srgb, var(--pw-success) 10%, transparent)", borderColor: "var(--pw-success)" }}
        >
          <p className="text-xs font-extrabold uppercase tracking-widest" style={{ color: "var(--pw-success)" }}>
            Puzzle Complete
          </p>
          <p className="mt-1 flex items-center justify-center gap-1.5 text-lg font-black tabular-nums" style={{ color: "var(--pw-text-primary)" }}>
            <CircleCheck aria-hidden="true" size={18} style={{ color: "var(--pw-success)" }} />
            Solved in {formatBattleTime(displaySolveTime)}
          </p>
          {submissionPending && (
            <p role="status" className="mt-2 text-sm" style={{ color: "var(--pw-text-secondary)" }}>
              {submissionPendingLabel}
            </p>
          )}
        </motion.div>
      )}

      {showSubmissionPanel && submitError && (
        <motion.div
          initial={reduceMotion ? undefined : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="mt-6 rounded-xl border p-5 text-center"
          style={{ background: "color-mix(in srgb, var(--pw-error) 10%, transparent)", borderColor: "var(--pw-error)" }}
        >
          <p className="text-xs font-extrabold uppercase tracking-widest" style={{ color: "var(--pw-error-text)" }}>
            Submission Interrupted
          </p>
          <p className="mt-2 flex items-center justify-center gap-1.5 font-bold" style={{ color: "var(--pw-error-text)" }}>
            <TriangleAlert aria-hidden="true" size={16} />
            {submitError}
          </p>
          <p className="mt-1 text-sm" style={{ color: "var(--pw-text-secondary)" }}>
            Your solve time is ready to retry.
          </p>
          <p className="mt-1 text-sm font-semibold tabular-nums" style={{ color: "var(--pw-text-primary)" }}>
            Solved in {formatBattleTime(displaySolveTime)}
          </p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-4 inline-flex min-h-12 items-center justify-center gap-1.5 rounded-lg px-5 font-bold"
              style={{ minHeight: 48, background: "var(--pw-brand-secondary)", color: "var(--pw-bg-base)" }}
            >
              <RefreshCw aria-hidden="true" size={15} />
              Try Again
            </button>
          )}
        </motion.div>
      )}
    </div>
  );
}
