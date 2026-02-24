'use client';
import React, { useState, useCallback, useEffect } from 'react';
import KeypadPuzzle, { KeypadConfig } from './KeypadPuzzle';
import WirePuzzle, { WireConfig } from './WirePuzzle';
import DialPuzzle, { DialConfig } from './DialPuzzle';

export type MiniPuzzleType = 'keypad' | 'wire' | 'dial';

const PUZZLE_TITLES: Record<MiniPuzzleType, string> = {
  keypad: '🔐 Keypad Lock',
  wire:   '🔌 Wire Connector',
  dial:   '⚙️ Dial Combination',
};

export interface MiniPuzzleModalProps {
  open: boolean;
  /** Puzzle variant to render. */
  puzzleType: MiniPuzzleType;
  /** Type-specific config (KeypadConfig | WireConfig | DialConfig). */
  config: KeypadConfig | WireConfig | DialConfig | null;
  /** Display name shown in the modal header. Falls back to puzzle type name. */
  label?: string;
  /** DB hotspot id — used to call server actions. */
  hotspotId: string;
  puzzleId: string;
  teamId: string;
  /**
   * Called when the player solves the puzzle.
   * The parent should POST `action:"trigger"` to the action route.
   */
  onSolve: (hotspotId: string) => Promise<void>;
  /**
   * Called after the server has applied a time penalty.
   * The parent should update `runExpiresAt` and show the penalty toast.
   */
  onPenalty: (secs: number, newExpiry: string | null) => void;
  onClose: () => void;
}

export default function MiniPuzzleModal({
  open,
  puzzleType,
  config,
  label,
  hotspotId,
  puzzleId,
  teamId,
  onSolve,
  onPenalty,
  onClose,
}: MiniPuzzleModalProps) {
  const maxAttempts: number = (config as any)?.maxAttempts ?? 3;

  const [attempts, setAttempts] = useState(0);
  const [locked, setLocked] = useState(false);
  const [lockMsg, setLockMsg] = useState('');
  const [solving, setSolving] = useState(false);
  /** Incrementing key forces child puzzle to re-mount (i.e. reset state) after lockout. */
  const [resetKey, setResetKey] = useState(0);

  // Reset internal state whenever the modal opens
  useEffect(() => {
    if (open) {
      setAttempts(0);
      setLocked(false);
      setLockMsg('');
      setSolving(false);
      setResetKey((k) => k + 1);
    }
  }, [open]);

  const handleWrongAttempt = useCallback(async () => {
    const next = attempts + 1;
    setAttempts(next);

    if (maxAttempts > 0 && next >= maxAttempts) {
      setLocked(true);

      // Call server to apply time penalty and broadcast updated runExpiresAt
      let penaltyApplied = 0;
      let newRunExpiresAt: string | null = null;
      try {
        const r = await fetch(`/api/puzzles/escape-room/${puzzleId}/action`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'miniPuzzlePenalty', hotspotId, teamId }),
        });
        const jb = await r.json().catch(() => null);
        penaltyApplied = jb?.penaltyApplied ?? 0;
        newRunExpiresAt = jb?.newRunExpiresAt ?? null;
      } catch {
        // non-fatal — penalty will show visually even without timer update
      }

      onPenalty(penaltyApplied, newRunExpiresAt);

      const penaltyLine = penaltyApplied > 0 ? ` −${penaltyApplied}s penalty applied.` : '';
      setLockMsg(`Too many failed attempts.${penaltyLine} Puzzle restarting…`);

      // Unlock after 3 seconds and reset puzzle
      setTimeout(() => {
        setLocked(false);
        setAttempts(0);
        setLockMsg('');
        setResetKey((k) => k + 1);
      }, 3000);
    }
  }, [attempts, maxAttempts, hotspotId, puzzleId, teamId, onPenalty]);

  const handleSolve = useCallback(async () => {
    if (solving) return;
    setSolving(true);
    try {
      await onSolve(hotspotId);
    } catch {
      setSolving(false);
    }
  }, [solving, hotspotId, onSolve]);

  if (!open || !config) return null;

  const title = label || PUZZLE_TITLES[puzzleType] || 'Puzzle';

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-lg mx-4 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">

        {/* Accent line */}
        <div className="h-0.5 w-full bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <h2 className="text-lg font-bold text-cyan-100 tracking-wide">{title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 text-xl leading-none transition-all"
            aria-label="Close puzzle"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-6">
          {/* Status banners */}
          {lockMsg && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-red-950/60 border border-red-700/50 text-red-300 text-sm font-semibold text-center">
              ❌ {lockMsg}
            </div>
          )}
          {solving && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-emerald-950/60 border border-emerald-700/50 text-emerald-300 text-sm font-semibold text-center">
              ✅ Solved! Loading…
            </div>
          )}

          {/* Puzzle component — keyed so it re-mounts on reset */}
          <div key={resetKey}>
            {puzzleType === 'keypad' && (
              <KeypadPuzzle
                config={config as KeypadConfig}
                onSolve={handleSolve}
                onWrongAttempt={handleWrongAttempt}
                attemptCount={attempts}
                maxAttempts={maxAttempts}
                locked={locked || solving}
              />
            )}
            {puzzleType === 'wire' && (
              <WirePuzzle
                config={config as WireConfig}
                onSolve={handleSolve}
                onWrongAttempt={handleWrongAttempt}
                attemptCount={attempts}
                maxAttempts={maxAttempts}
                locked={locked || solving}
              />
            )}
            {puzzleType === 'dial' && (
              <DialPuzzle
                config={config as DialConfig}
                onSolve={handleSolve}
                onWrongAttempt={handleWrongAttempt}
                attemptCount={attempts}
                maxAttempts={maxAttempts}
                locked={locked || solving}
              />
            )}
          </div>
        </div>
      </div>

      {/* Global CSS for the shake animation shared by all three puzzle types */}
      <style jsx global>{`
        @keyframes miniShake {
          0%, 100% { transform: translateX(0); }
          15%  { transform: translateX(-6px); }
          30%  { transform: translateX(6px); }
          45%  { transform: translateX(-5px); }
          60%  { transform: translateX(5px); }
          75%  { transform: translateX(-3px); }
          90%  { transform: translateX(3px); }
        }
      `}</style>
    </div>
  );
}
