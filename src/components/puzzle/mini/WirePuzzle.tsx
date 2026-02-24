'use client';
import React, { useState, useMemo } from 'react';

export interface WireConfig {
  /** Each pair describes a left-terminal → right-terminal connection. */
  pairs: Array<{
    leftLabel: string;
    rightLabel: string;
    /** CSS color string, e.g. "#f87171". Auto-assigned if omitted. */
    color?: string;
  }>;
  hint?: string;
  maxAttempts?: number;
  timePenaltySeconds?: number;
}

const AUTO_COLORS = [
  '#f87171', '#60a5fa', '#4ade80', '#facc15',
  '#c084fc', '#fb923c', '#22d3ee', '#a3e635',
];

/** Deterministic shuffle so all teammates see the same right-side layout. */
function seededShuffle<T>(arr: T[], seed: string): T[] {
  const result = [...arr];
  let s = seed.split('').reduce((a, c) => a + c.charCodeAt(0), 0) || 9371;
  for (let i = result.length - 1; i > 0; i--) {
    s = ((s * 1664525) + 1013904223) >>> 0;
    const j = s % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

interface WirePuzzleProps {
  config: WireConfig;
  onSolve: () => void;
  onWrongAttempt: () => void;
  attemptCount: number;
  maxAttempts: number;
  locked: boolean;
}

export default function WirePuzzle({
  config,
  onSolve,
  onWrongAttempt,
  attemptCount,
  maxAttempts,
  locked,
}: WirePuzzleProps) {
  const { pairs } = config;
  const colors = pairs.map((p, i) => p.color || AUTO_COLORS[i % AUTO_COLORS.length]);

  // Deterministic shuffle of right-side pair indices
  const seed = pairs.map((p) => `${p.leftLabel}=${p.rightLabel}`).join('|');
  const rightOrder = useMemo(() => seededShuffle(pairs.map((_, i) => i), seed), [seed]);

  // connections: leftPairIdx → displaySlot (index into rightOrder)
  const [connections, setConnections] = useState<Record<number, number>>({});
  const [selectedLeft, setSelectedLeft] = useState<number | null>(null);
  const [shake, setShake] = useState(false);

  // Reverse map: displaySlot → leftPairIdx
  const slotToLeft = useMemo(() => {
    const m: Record<number, number> = {};
    Object.entries(connections).forEach(([l, s]) => {
      m[Number(s)] = Number(l);
    });
    return m;
  }, [connections]);

  const allConnected = Object.keys(connections).length === pairs.length;

  const handleLeftClick = (i: number) => {
    if (locked || shake) return;
    const isConnected = connections[i] !== undefined;
    if (isConnected) {
      // Allow re-clicking to disconnect
      const copy = { ...connections };
      delete copy[i];
      setConnections(copy);
      setSelectedLeft(null);
      return;
    }
    setSelectedLeft((prev) => (prev === i ? null : i));
  };

  const handleRightClick = (displaySlot: number) => {
    if (locked || shake || selectedLeft === null) return;
    const next = { ...connections };
    // Disconnect previous occupant of this slot
    const prevLeft = slotToLeft[displaySlot];
    if (prevLeft !== undefined) delete next[prevLeft];
    next[selectedLeft] = displaySlot;
    setConnections(next);
    setSelectedLeft(null);
  };

  const verify = () => {
    if (!allConnected || locked) return;
    const correct = pairs.every((_, i) => {
      const slot = connections[i];
      return slot !== undefined && rightOrder[slot] === i;
    });
    if (correct) {
      onSolve();
    } else {
      setShake(true);
      setTimeout(() => {
        setShake(false);
        setConnections({});
        setSelectedLeft(null);
        onWrongAttempt();
      }, 550);
    }
  };

  return (
    <div
      className="flex flex-col items-center gap-4"
      style={shake ? { animation: 'miniShake 0.45s ease' } : {}}
    >
      {config.hint && (
        <p className="text-xs text-cyan-400/70 italic text-center max-w-xs">{config.hint}</p>
      )}
      <p className="text-[11px] text-gray-500 text-center">
        Click a source terminal, then click its matching target. Click a connected terminal to disconnect.
      </p>

      {maxAttempts > 0 && (
        <div className="flex gap-1.5" aria-label={`Attempts: ${attemptCount} of ${maxAttempts}`}>
          {Array.from({ length: maxAttempts }).map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-colors ${
                i < attemptCount ? 'bg-red-500' : 'bg-slate-600'
              }`}
            />
          ))}
        </div>
      )}

      <div className="flex gap-4 items-stretch">
        {/* LEFT column */}
        <div className="flex flex-col gap-2.5">
          <div className="text-[10px] text-gray-500 font-mono uppercase tracking-widest text-center pb-1">
            Source
          </div>
          {pairs.map((pair, i) => {
            const isConnected = connections[i] !== undefined;
            const isSelected = selectedLeft === i;
            const color = colors[i];
            return (
              <button
                key={i}
                onClick={() => handleLeftClick(i)}
                disabled={locked}
                className={`px-3 py-2 min-w-[96px] rounded-lg font-mono text-sm font-bold border-2 text-left transition-all active:scale-95 ${
                  isSelected
                    ? 'bg-white/10 border-white text-white shadow-lg scale-105'
                    : isConnected
                    ? 'cursor-pointer'
                    : 'bg-slate-800 border-slate-600 text-gray-200 hover:border-slate-400'
                } ${locked ? 'opacity-50 cursor-not-allowed' : ''}`}
                style={
                  isConnected && !isSelected
                    ? { borderColor: color, color, background: `${color}22` }
                    : {}
                }
              >
                {pair.leftLabel}
                {isConnected && (
                  <span className="ml-1.5 text-[10px]">✓</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Middle: wire glimpse */}
        <div className="flex flex-col gap-2.5 items-center justify-start pt-8">
          {pairs.map((_, i) => {
            const slot = connections[i];
            const connected = slot !== undefined;
            return (
              <div key={i} className="flex items-center" style={{ height: 42 }}>
                <div
                  className="h-0.5 rounded-full transition-all duration-200"
                  style={{
                    width: 32,
                    backgroundColor: connected ? colors[i] : '#1e293b',
                    opacity: connected ? 1 : 0.5,
                    boxShadow: connected ? `0 0 8px ${colors[i]}` : 'none',
                  }}
                />
              </div>
            );
          })}
        </div>

        {/* RIGHT column */}
        <div className="flex flex-col gap-2.5">
          <div className="text-[10px] text-gray-500 font-mono uppercase tracking-widest text-center pb-1">
            Target
          </div>
          {rightOrder.map((pairIdx, displaySlot) => {
            const connectedLeft = slotToLeft[displaySlot];
            const isConnected = connectedLeft !== undefined;
            const color = isConnected ? colors[connectedLeft] : undefined;
            const isSelectable = selectedLeft !== null && !locked;
            return (
              <button
                key={displaySlot}
                onClick={() => handleRightClick(displaySlot)}
                disabled={locked || selectedLeft === null}
                className={`px-3 py-2 min-w-[96px] rounded-lg font-mono text-sm font-bold border-2 text-right transition-all active:scale-95 ${
                  isConnected
                    ? 'cursor-pointer'
                    : isSelectable
                    ? 'bg-slate-700 border-cyan-500/60 text-cyan-200 hover:border-cyan-400 hover:scale-105'
                    : 'bg-slate-800 border-slate-600 text-gray-300'
                } ${locked ? 'opacity-50 cursor-not-allowed' : ''}`}
                style={
                  isConnected
                    ? { borderColor: color, color, background: `${color}22` }
                    : {}
                }
              >
                {isConnected && <span className="mr-1.5 text-[10px]">✓</span>}
                {pairs[pairIdx].rightLabel}
              </button>
            );
          })}
        </div>
      </div>

      <button
        onClick={verify}
        disabled={!allConnected || locked}
        className="mt-1 px-7 py-2.5 rounded-xl bg-cyan-700 hover:bg-cyan-600 active:bg-cyan-800 active:scale-95 text-white font-bold text-sm disabled:opacity-30 transition-all"
      >
        VERIFY CONNECTIONS
      </button>
    </div>
  );
}
