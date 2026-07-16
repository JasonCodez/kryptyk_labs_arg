"use client";

import Link from "next/link";
import type { ReactNode, RefObject } from "react";
import { useJigsawBoardDims } from "@/hooks/useJigsawBoardDims";
import { EscapeRoomPuzzle } from "@/components/puzzle/EscapeRoomPuzzle";
import JimWyzePuzzle from "@/components/puzzle/JimWyzePuzzle";
import DetectiveCasePuzzle from "@/components/puzzle/DetectiveCasePuzzle";
import CrimeCasePuzzle from "@/components/puzzle/CrimeCasePuzzle";
import ParasiteCodePuzzle from "@/components/puzzle/ParasiteCodePuzzle";
import GridlockFilePuzzle from "@/components/puzzle/GridlockFilePuzzle";
import CrackTheSafePuzzle from "@/components/puzzle/CrackTheSafePuzzle";
import HiddenWordPuzzle from "@/components/puzzle/HiddenWordPuzzle";
import WordSearchPuzzle, {
  type WordSearchCompletionResult,
  type WordSearchPresentationState,
  type WordSearchPuzzleHandle,
} from "@/components/puzzle/WordSearchPuzzle";
import CrosswordPuzzle, {
  type CrosswordPresentationState,
  type CrosswordPuzzleHandle,
} from "@/components/puzzle/CrosswordPuzzle";
import LogicGridPuzzle from "@/components/puzzle/LogicGridPuzzle";
import AnagramBlitz, {
  type AnagramBlitzHandle,
  type AnagramPresentationState,
} from "@/components/puzzle/AnagramBlitz";
import ArgPuzzle from "@/components/puzzle/ArgPuzzle";
import BlackoutPuzzle from "@/components/puzzle/BlackoutPuzzle";
import VaultPuzzle from "@/components/puzzle/VaultPuzzle";
import CipherClashPuzzle from "@/components/puzzle/CipherClashPuzzle";
import JigsawPuzzle from "@/components/puzzle/JigsawPuzzle";
import PuzzleFullscreenFrame from "@/components/puzzle/PuzzleFullscreenFrame";
import PuzzleBugReportButton from "@/components/puzzle/PuzzleBugReportButton";
import type { JigsawPuzzle as JigsawPuzzleType } from "@/lib/puzzle-types";

// The admin puzzle creator persists a few extra tunable fields on jigsaw puzzles
// (piece-cut shape knobs, an optional fun fact) that aren't part of the strict
// JigsawPuzzleData type shared with other consumers of that interface.
type JigsawExtraData = JigsawPuzzleType['data'] & {
  pieceExtFrac?: number;
  pieceRFrac?: number;
  pieceNHalfFrac?: number;
  pieceShoulderStart?: number;
  funFact?: string;
};

type JigsawControlsApi = {
  reset: () => void;
  sendLooseToTray: () => void;
  enterFullscreen: () => void;
  exitFullscreen: () => void;
  isFullscreen: boolean;
};

interface PuzzleBase {
  id: string;
  title?: string;
  puzzleType?: string;
  data?: Record<string, unknown>;
  xpReward?: number;
  solutions?: Array<{ points: number | null }>;
}

interface ProgressBase {
  solved?: boolean;
  failedAttempts?: number;
  pointsEarned?: number;
}

interface PuzzleTypeRendererProps {
  puzzle: PuzzleBase;
  progress: ProgressBase | null;
  puzzleId: string;
  teamIdParam?: string;
  lobbyIdParam?: string;
  jigsawPlayable: JigsawPuzzleType | null;
  jigsawControls: JigsawControlsApi | null;
  setJigsawControls: (api: JigsawControlsApi) => void;
  effectiveHintTokens: number;
  onHintUsed: () => Promise<boolean>;
  onSolved: (elapsed?: number, xp?: number) => void;
  onAnagramSolved: (elapsedSeconds: number) => void;
  onJigsawComplete: (timeSpentSeconds?: number) => Promise<number>;
  onJigsawShowRatingModal: () => void;
  crosswordRef?: RefObject<CrosswordPuzzleHandle | null>;
  onCrosswordPresentationChange?: (state: CrosswordPresentationState) => void;
  anagramRef?: RefObject<AnagramBlitzHandle | null>;
  onAnagramPresentationChange?: (state: AnagramPresentationState) => void;
  wordSearchRef?: RefObject<WordSearchPuzzleHandle | null>;
  onWordSearchPresentationChange?: (state: WordSearchPresentationState) => void;
  onWordSearchComplete: () => Promise<WordSearchCompletionResult>;
  // Skip-token button — normally rendered below the puzzle by PuzzleProgressSection, which gets
  // hidden behind the fullscreen overlay. Passed through to PuzzleFullscreenFrame so it stays
  // reachable while a puzzle is fullscreen.
  skipControl?: ReactNode;
}

/**
 * Renders the interactive content for all specialty puzzle types.
 * Returns null for standard types (text / sudoku / code_master) — the
 * parent page handles those via the default <form>.
 */
export function PuzzleTypeRenderer({
  puzzle,
  progress,
  puzzleId,
  teamIdParam,
  lobbyIdParam,
  jigsawPlayable,
  jigsawControls,
  setJigsawControls,
  effectiveHintTokens,
  onHintUsed,
  onSolved,
  onAnagramSolved,
  onJigsawComplete,
  onJigsawShowRatingModal,
  crosswordRef,
  onCrosswordPresentationChange,
  anagramRef,
  onAnagramPresentationChange,
  wordSearchRef,
  onWordSearchPresentationChange,
  onWordSearchComplete,
  skipControl,
}: PuzzleTypeRendererProps) {
  // Detect the jigsaw image's natural aspect ratio so the play board matches it —
  // otherwise the fixed 640x480 default stretches/squishes non-4:3 images.
  const jigsawBoardDims = useJigsawBoardDims(puzzle.puzzleType === 'jigsaw' ? jigsawPlayable?.imageUrl : null);

  if (puzzle.puzzleType === 'jigsaw') {
    const jigsawExtra = jigsawPlayable?.data as JigsawExtraData | undefined;
    return (
      <div className="mb-8">
        {jigsawPlayable && (
          <div className="mb-4 flex flex-col items-stretch gap-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
              <button
                onClick={() => jigsawControls?.enterFullscreen?.()}
                className="w-full sm:w-auto px-3 py-2 rounded bg-gray-800 text-white border border-gray-600 hover:opacity-90"
              >
                Fullscreen
              </button>
              <button
                onClick={() => jigsawControls?.sendLooseToTray?.()}
                className="w-full sm:w-auto px-3 py-2 rounded bg-yellow-400 text-black border border-yellow-500 hover:opacity-90"
              >
                Return Loose Pieces
              </button>
              <PuzzleBugReportButton
                puzzleId={puzzleId}
                puzzleTitle={puzzle.title || "This puzzle"}
                className="w-full sm:w-auto px-3 py-2 rounded bg-gray-800 text-white border border-gray-600 hover:opacity-90"
              />
            </div>
          </div>
        )}
        {!jigsawPlayable ? (
          <div className="p-4 rounded-lg border" style={{ backgroundColor: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.4)", color: "#fca5a5" }}>
            This jigsaw puzzle is missing its image. Upload an image in the admin puzzle creator.
          </div>
        ) : !jigsawBoardDims ? (
          <div className="p-8 text-center text-gray-400">Loading puzzle image…</div>
        ) : (
          <div
            className="rounded-none overflow-hidden border border-gray-700"
            style={{ margin: "0 -2rem" }}
          >
            <JigsawPuzzle
              puzzleId={puzzleId}
              puzzleTitle={puzzle.title || "This puzzle"}
              imageUrl={jigsawPlayable.imageUrl}
              rows={jigsawPlayable.data.gridRows}
              cols={jigsawPlayable.data.gridCols}
              boardWidth={jigsawBoardDims.w}
              boardHeight={jigsawBoardDims.h}
              pieceExtFrac={typeof jigsawExtra?.pieceExtFrac === 'number' ? jigsawExtra.pieceExtFrac : undefined}
              pieceRFrac={typeof jigsawExtra?.pieceRFrac === 'number' ? jigsawExtra.pieceRFrac : undefined}
              pieceNHalfFrac={typeof jigsawExtra?.pieceNHalfFrac === 'number' ? jigsawExtra.pieceNHalfFrac : undefined}
              pieceShoulderStart={typeof jigsawExtra?.pieceShoulderStart === 'number' ? jigsawExtra.pieceShoulderStart : undefined}
              funFact={typeof jigsawExtra?.funFact === 'string' ? jigsawExtra.funFact : undefined}
              onControlsReady={(api) => setJigsawControls(api)}
              suppressInternalCongrats={true}
              onComplete={onJigsawComplete}
              onShowRatingModal={onJigsawShowRatingModal}
            />
          </div>
        )}
      </div>
    );
  }

  if (puzzle.puzzleType === 'escape_room') {
    return (
      <div className="mb-8">
        <PuzzleFullscreenFrame extraControls={skipControl} puzzleId={puzzleId} puzzleTitle={puzzle.title || "This puzzle"}>
          {progress?.solved && (
            <div className="mb-6 p-4 rounded-lg border text-white" style={{ backgroundColor: "rgba(76, 91, 92, 0.3)", borderColor: "#3891A6" }}>
              ✓ You have already solved this puzzle! Visit the puzzles page to try another one.
            </div>
          )}
          <div className="mb-4">
            {!teamIdParam && !lobbyIdParam ? (
              <div className="flex flex-col gap-3 p-4 rounded-lg border" style={{ backgroundColor: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.4)", color: "#fca5a5" }}>
                <span>This escape room requires a team or lobby. Start it from the escape room lobby page.</span>
                <Link
                  href={`/escape-rooms/${puzzleId}/lobby`}
                  className="inline-block px-4 py-2 rounded bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium w-fit"
                >
                  Open Lobby
                </Link>
              </div>
            ) : (
              <EscapeRoomPuzzle
                puzzleId={puzzleId}
                teamId={teamIdParam}
                lobbyId={lobbyIdParam}
                onComplete={() => onSolved()}
              />
            )}
          </div>
        </PuzzleFullscreenFrame>
      </div>
    );
  }

  if (puzzle.puzzleType === 'jim_wyze_case') {
    return (
      <div className="mb-8">
        <PuzzleFullscreenFrame extraControls={skipControl} puzzleId={puzzleId} puzzleTitle={puzzle.title || "This puzzle"}>
          {progress?.solved && (
            <div className="mb-6 p-4 rounded-lg border text-white" style={{ backgroundColor: "rgba(76, 91, 92, 0.3)", borderColor: "#3891A6" }}>
              ✓ You have already solved this Jim Wyze case! Visit the puzzles page to start the next file.
            </div>
          )}
          <JimWyzePuzzle
            puzzleId={puzzleId}
            onComplete={() => onSolved()}
          />
        </PuzzleFullscreenFrame>
      </div>
    );
  }

  if (puzzle.puzzleType === 'detective_case') {
    return (
      <div className="mb-8">
        <PuzzleFullscreenFrame extraControls={skipControl} puzzleId={puzzleId} puzzleTitle={puzzle.title || "This puzzle"}>
          {progress?.solved && (
            <div className="mb-6 p-4 rounded-lg border text-white" style={{ backgroundColor: "rgba(76, 91, 92, 0.3)", borderColor: "#3891A6" }}>
              ✓ You have already solved this case.
            </div>
          )}
          <DetectiveCasePuzzle puzzleId={puzzleId} />
        </PuzzleFullscreenFrame>
      </div>
    );
  }

  if (puzzle.puzzleType === 'crime_rpg') {
    return (
      <div className="mb-8">
        <PuzzleFullscreenFrame extraControls={skipControl} puzzleId={puzzleId} puzzleTitle={puzzle.title || "This puzzle"}>
          <CrimeCasePuzzle
            puzzleId={puzzleId}
            onSolved={() => onSolved()}
          />
        </PuzzleFullscreenFrame>
      </div>
    );
  }

  if (puzzle.puzzleType === 'parasite_code') {
    return (
      <div className="mb-8">
        <PuzzleFullscreenFrame extraControls={skipControl} puzzleId={puzzleId} puzzleTitle={puzzle.title || "This puzzle"}>
          <ParasiteCodePuzzle
            puzzleId={puzzleId}
            onSolved={() => onSolved()}
          />
        </PuzzleFullscreenFrame>
      </div>
    );
  }

  if (puzzle.puzzleType === 'gridlock_file') {
    return (
      <div className="mb-8">
        <PuzzleFullscreenFrame extraControls={skipControl} puzzleId={puzzleId} puzzleTitle={puzzle.title || "This puzzle"}>
          <GridlockFilePuzzle
            puzzleId={puzzleId}
            onSolved={() => onSolved()}
          />
        </PuzzleFullscreenFrame>
      </div>
    );
  }

  if (puzzle.puzzleType === 'crack_safe') {
    return (
      <div className="mb-8">
        <PuzzleFullscreenFrame extraControls={skipControl} puzzleId={puzzleId} puzzleTitle={puzzle.title || "This puzzle"}>
          {progress?.solved && (
            <div className="mb-6 p-4 rounded-lg border text-white"
                 style={{ backgroundColor: "rgba(56, 211, 153, 0.1)", borderColor: "#38D399" }}>
              🔓 You have already cracked this safe!
            </div>
          )}
          <CrackTheSafePuzzle
            puzzleId={puzzleId}
            safeData={(puzzle.data ?? {}) as Record<string, unknown>}
            alreadySolved={progress?.solved ?? false}
            failedAttempts={progress?.failedAttempts ?? 0}
            onSolved={() => onSolved()}
          />
        </PuzzleFullscreenFrame>
      </div>
    );
  }

  if (puzzle.puzzleType === 'word_crack') {
    return (
      <div className="mb-8">
        <PuzzleFullscreenFrame extraControls={skipControl} puzzleId={puzzleId} puzzleTitle={puzzle.title || "This puzzle"}>
          {progress?.solved && (
            <div className="mb-6 p-4 rounded-lg border text-white"
                 style={{ backgroundColor: "rgba(56, 211, 153, 0.1)", borderColor: "#38D399" }}>
              🟩 You already solved this one!
            </div>
          )}
          <HiddenWordPuzzle
            puzzleId={puzzleId}
            hiddenWordData={(puzzle.data ?? {}) as Record<string, unknown>}
            alreadySolved={progress?.solved ?? false}
            failedAttempts={progress?.failedAttempts ?? 0}
            hintTokens={effectiveHintTokens}
            xpReward={puzzle.xpReward ?? 50}
            pointsReward={puzzle.solutions?.[0]?.points ?? 100}
            onHintUsed={onHintUsed}
            onSolved={(xpGained) => onSolved(undefined, xpGained)}
          />
        </PuzzleFullscreenFrame>
      </div>
    );
  }

  if (puzzle.puzzleType === 'crossword') {
    return (
      <div className="crossword-renderer-shell">
        <PuzzleFullscreenFrame extraControls={skipControl} puzzleId={puzzleId} puzzleTitle={puzzle.title || "This puzzle"}>
          {progress?.solved && (
            <div className="mb-6 p-4 rounded-lg border text-white"
                 style={{ backgroundColor: "rgba(56, 211, 153, 0.1)", borderColor: "#38D399" }}>
              🧩 You already solved this crossword!
            </div>
          )}
          <CrosswordPuzzle
            ref={crosswordRef}
            puzzleId={puzzleId}
            crosswordData={(puzzle.data ?? {}) as Record<string, unknown>}
            displayMode="app-shell"
            onPresentationChange={onCrosswordPresentationChange}
            alreadySolved={progress?.solved ?? false}
            hintTokens={effectiveHintTokens}
            onHintUsed={onHintUsed}
            onSolved={(elapsedSeconds) => onSolved(elapsedSeconds)}
          />
        </PuzzleFullscreenFrame>
      </div>
    );
  }

  if (puzzle.puzzleType === 'logic_grid') {
    return (
      <div className="mb-8">
        <PuzzleFullscreenFrame extraControls={skipControl} puzzleId={puzzleId} puzzleTitle={puzzle.title || "This puzzle"}>
          <LogicGridPuzzle
            puzzleId={puzzleId}
            logicGridData={(puzzle.data ?? {}) as Record<string, unknown>}
            alreadySolved={progress?.solved ?? false}
            onSolved={(elapsedSeconds) => onSolved(elapsedSeconds)}
          />
        </PuzzleFullscreenFrame>
      </div>
    );
  }

  if (puzzle.puzzleType === 'word_search') {
    return (
      <div className="word-search-renderer-shell">
        <WordSearchPuzzle
          ref={wordSearchRef}
          puzzleId={puzzleId}
          wordSearchData={(puzzle.data ?? {}) as Record<string, unknown>}
          persistenceScope="catalog"
          alreadySolved={progress?.solved ?? false}
          hintTokens={effectiveHintTokens}
          onHintUsed={onHintUsed}
          displayMode="app-shell"
          onPresentationChange={onWordSearchPresentationChange}
          onComplete={onWordSearchComplete}
        />
      </div>
    );
  }

  if (puzzle.puzzleType === 'anagram_blitz') {
    return (
      <div className="anagram-renderer-shell">
        <AnagramBlitz
          ref={anagramRef}
          puzzleId={puzzleId}
          anagramData={(puzzle.data ?? {}) as Record<string, unknown>}
          alreadySolved={progress?.solved ?? false}
          displayMode="app-shell"
          onPresentationChange={onAnagramPresentationChange}
          onSolved={onAnagramSolved}
          onFailed={() => {}}
        />
      </div>
    );
  }

  if (puzzle.puzzleType === 'arg') {
    return (
      <div className="mb-8">
        <PuzzleFullscreenFrame extraControls={skipControl} puzzleId={puzzleId} puzzleTitle={puzzle.title || "This puzzle"}>
          {progress?.solved && (
            <div className="mb-6 p-4 rounded-lg border text-white"
                 style={{ backgroundColor: "rgba(56, 211, 153, 0.1)", borderColor: "#38D399" }}>
              🕵️ You already cracked this ARG!
            </div>
          )}
          <ArgPuzzle
            puzzleId={puzzleId}
            argData={(puzzle.data ?? {}) as Record<string, unknown>}
            alreadySolved={progress?.solved ?? false}
            onSolved={() => onSolved()}
          />
        </PuzzleFullscreenFrame>
      </div>
    );
  }

  if (puzzle.puzzleType === 'blackout') {
    return (
      <div className="mb-8">
        {progress?.solved && (
          <div className="mb-6 p-4 rounded-lg border text-white"
               style={{ backgroundColor: "rgba(56, 211, 153, 0.1)", borderColor: "#38D399" }}>
            ⬛ You already declassified this document!
          </div>
        )}
        <BlackoutPuzzle
          puzzleId={puzzleId}
          blackoutData={(puzzle.data ?? {}) as Record<string, unknown>}
          alreadySolved={progress?.solved ?? false}
          onSolved={() => onSolved()}
        />
      </div>
    );
  }

  if (puzzle.puzzleType === 'cipher_clash') {
    return (
      <div className="mb-8">
        <PuzzleFullscreenFrame extraControls={skipControl} puzzleId={puzzleId} puzzleTitle={puzzle.title || "This puzzle"}>
          <CipherClashPuzzle
            puzzleId={puzzleId}
            cipherClashData={(puzzle.data ?? {}) as Record<string, unknown>}
            alreadySolved={progress?.solved ?? false}
            onSolved={() => onSolved()}
          />
        </PuzzleFullscreenFrame>
      </div>
    );
  }

  if (puzzle.puzzleType === 'vault') {
    return (
      <div className="mb-8">
        <PuzzleFullscreenFrame extraControls={skipControl} puzzleId={puzzleId} puzzleTitle={puzzle.title || "This puzzle"}>
          {progress?.solved && (
            <div className="mb-6 p-4 rounded-lg border text-white"
                 style={{ backgroundColor: "rgba(56, 211, 153, 0.1)", borderColor: "#38D399" }}>
              You already opened this vault.
            </div>
          )}
          <VaultPuzzle
            puzzleId={puzzleId}
            vaultData={puzzle.data ?? {}}
            alreadySolved={progress?.solved ?? false}
            failedAttempts={progress?.failedAttempts ?? 0}
            onSolved={() => onSolved()}
          />
        </PuzzleFullscreenFrame>
      </div>
    );
  }

  // Standard types (text, sudoku, code_master) → parent renders the default form
  return null;
}
