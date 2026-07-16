"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import SudokuPuzzle from "@/components/puzzle/SudokuPuzzle";
import HiddenWordPuzzle from "@/components/puzzle/HiddenWordPuzzle";
import WordSearchPuzzle from "@/components/puzzle/WordSearchPuzzle";
import AnagramBlitz from "@/components/puzzle/AnagramBlitz";
import ArgPuzzle from "@/components/puzzle/ArgPuzzle";
import BlackoutPuzzle from "@/components/puzzle/BlackoutPuzzle";
import JigsawPuzzle from "@/components/puzzle/JigsawPuzzle";
import { motion, AnimatePresence } from "framer-motion";
import { useJigsawBoardDims } from "@/hooks/useJigsawBoardDims";

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
}

function formatTime(sec: number) {
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function WarzPlayBoard({ puzzle, wager, onDone, submitError, onRetry }: Props) {
  const startRef = useRef<number>(0);
  const [elapsed, setElapsed] = useState(0);
  const [solved, setSolved] = useState(false);
  const [showForfeitConfirm, setShowForfeitConfirm] = useState(false);
  const [showFailedModal, setShowFailedModal] = useState(false);
  const [failCountdown, setFailCountdown] = useState(5);
  const jigsawBoardDims = useJigsawBoardDims(puzzle.puzzleType === 'jigsaw' ? puzzle.jigsaw?.imageUrl : null);

  useEffect(() => {
    startRef.current = Date.now();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!solved) setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [solved]);

  // Auto-forfeit countdown after puzzle failure
  useEffect(() => {
    if (!showFailedModal) return;
    if (failCountdown <= 0) {
      // The countdown subscription owns this terminal transition.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSolved(true);
      onDone(0, true);
      return;
    }
    const t = setTimeout(() => setFailCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [showFailedModal, failCountdown, onDone]);

  const handleSolved = useCallback((overrideSeconds?: number) => {
    if (solved) return;
    setSolved(true);
    const secs = overrideSeconds ?? Math.max(1, Math.round((Date.now() - startRef.current) / 1000));
    onDone(secs);
  }, [solved, onDone]);

  const handleFailed = useCallback(() => {
    if (solved) return;
    // Stop the warz timer and show the failure modal
    setSolved(true);
    setFailCountdown(5);
    setShowFailedModal(true);
  }, [solved]);

  const handleForfeit = () => {
    setSolved(true);
    onDone(0, true);
  };

  const header = (
    <div
      className="flex items-center justify-between px-4 py-3 rounded-xl mb-6 border"
      style={{ backgroundColor: "rgba(253,231,76,0.06)", borderColor: "rgba(253,231,76,0.25)" }}
    >
      <div>
        <span className="text-xs font-bold uppercase tracking-widest mr-2" style={{ color: "#FDE74C" }}>
          ⚔️ Warz
        </span>
        <span className="text-white font-semibold">{puzzle.title}</span>
      </div>

      <div className="flex items-center gap-4">
        <div className="text-sm font-bold" style={{ color: "#FFB86B" }}>
          🪙 {wager} pts wagered
        </div>
        <div className="text-2xl font-black tabular-nums" style={{ color: solved ? "#22c55e" : "#FDE74C" }}>
          {formatTime(elapsed)}
        </div>
        {!solved && (
          <button
            onClick={() => setShowForfeitConfirm(true)}
            className="text-xs px-3 py-1.5 rounded-lg border font-semibold"
            style={{ backgroundColor: "rgba(220,38,38,0.1)", borderColor: "rgba(220,38,38,0.3)", color: "#fca5a5" }}
          >
            Forfeit
          </button>
        )}
      </div>
    </div>
  );

  const forfeitModal = (
    <AnimatePresence>
      {showForfeitConfirm && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.85, opacity: 0 }}
            className="w-full max-w-sm mx-4 rounded-2xl border-2 p-8 text-center shadow-2xl"
            style={{ backgroundColor: "rgba(10,8,0,0.98)", borderColor: "#ef4444" }}
          >
            <div className="text-4xl mb-3">🏳️</div>
            <h2 className="text-xl font-extrabold text-white mb-2">Forfeit this battle?</h2>
            <p className="text-sm mb-6" style={{ color: "#AB9F9D" }}>
              You will automatically lose and your wager of{" "}
              <span className="font-bold" style={{ color: "#FDE74C" }}>{wager} pts</span>{" "}
              goes to your opponent (or split back if they also forfeit).
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowForfeitConfirm(false)}
                className="flex-1 py-2 rounded-lg font-semibold border"
                style={{ borderColor: "#374151", color: "#9ca3af" }}
              >
                Keep Fighting
              </button>
              <button
                onClick={handleForfeit}
                className="flex-1 py-2 rounded-lg font-semibold"
                style={{ backgroundColor: "rgba(220,38,38,0.85)", color: "#fff" }}
              >
                Forfeit
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const failedModal = (
    <AnimatePresence>
      {showFailedModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.85, opacity: 0 }}
            className="w-full max-w-sm mx-4 rounded-2xl border-2 p-8 text-center shadow-2xl"
            style={{ backgroundColor: "rgba(10,8,0,0.99)", borderColor: "#ef4444" }}
          >
            <div className="text-5xl mb-3">💀</div>
            <h2 className="text-2xl font-extrabold mb-2" style={{ color: "#f87171" }}>Puzzle Failed</h2>
            <p className="text-sm mb-2" style={{ color: "#AB9F9D" }}>
              You ran out of attempts. Your wager of{" "}
              <span className="font-bold" style={{ color: "#FDE74C" }}>{wager} pts</span>{" "}
              goes to your opponent.
            </p>
            <p className="text-lg font-black tabular-nums mb-6" style={{ color: "#f87171" }}>
              Forfeiting in {failCountdown}…
            </p>
            <button
              onClick={() => { setSolved(true); onDone(0, true); }}
              className="w-full py-2 rounded-xl font-bold text-sm"
              style={{ backgroundColor: "rgba(220,38,38,0.85)", color: "#fff" }}
            >
              Forfeit Now
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

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
        if (!puzzle.sudoku) return <p className="text-white">Sudoku data missing.</p>;
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
        if (!puzzle.jigsaw?.imageUrl) return <p className="text-white">Jigsaw image missing.</p>;
        if (!jigsawBoardDims) return <p className="text-white">Loading puzzle image…</p>;
        return (
          <JigsawPuzzle
            imageUrl={puzzle.jigsaw.imageUrl}
            rows={puzzle.jigsaw.gridRows}
            cols={puzzle.jigsaw.gridCols}
            boardWidth={jigsawBoardDims.w}
            boardHeight={jigsawBoardDims.h}
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
        return <p className="text-white">Unsupported puzzle type: {puzzle.puzzleType}</p>;
    }
  };

  return (
    <div>
      {header}
      {forfeitModal}
      {failedModal}
      <div className={solved ? "pointer-events-none opacity-60" : ""}>
        {renderPuzzle()}
      </div>
      {solved && !submitError && (
        <div
          className="mt-6 p-4 rounded-xl border text-center font-bold text-lg"
          style={{ backgroundColor: "rgba(34,197,94,0.1)", borderColor: "#22c55e", color: "#4ade80" }}
        >
          ✅ Solved in {formatTime(elapsed)}! Submitting result…
        </div>
      )}
      {solved && submitError && (
        <div
          className="mt-6 p-5 rounded-xl border text-center"
          style={{ backgroundColor: "rgba(220,38,38,0.08)", borderColor: "rgba(220,38,38,0.4)" }}
        >
          <p className="font-bold mb-1" style={{ color: "#fca5a5" }}>⚠️ {submitError}</p>
          <p className="text-sm mb-4" style={{ color: "#9ca3af" }}>Your puzzle time was saved. Try submitting again.</p>
          <div className="flex gap-3 justify-center">
            {onRetry && (
              <button
                onClick={onRetry}
                className="px-5 py-2 rounded-lg font-bold text-sm transition-colors"
                style={{ background: "linear-gradient(135deg, #FDE74C, #FFB86B)", color: "#1a1400" }}
              >
                Retry
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


