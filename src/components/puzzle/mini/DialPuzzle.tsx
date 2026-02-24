'use client';
import React, { useState } from 'react';

export interface DialConfig {
  dials: Array<{
    /** Display label above the dial, e.g. "I", "NORTH", "★". */
    label: string;
    min: number;
    max: number;
    /** Increment step (default 1). */
    step?: number;
    /** The correct target value. */
    target: number;
    /** Starting value (default = min). */
    startValue?: number;
  }>;
  hint?: string;
  maxAttempts?: number;
  timePenaltySeconds?: number;
}

interface DialPuzzleProps {
  config: DialConfig;
  onSolve: () => void;
  onWrongAttempt: () => void;
  attemptCount: number;
  maxAttempts: number;
  locked: boolean;
}

export default function DialPuzzle({
  config,
  onSolve,
  onWrongAttempt,
  attemptCount,
  maxAttempts,
  locked,
}: DialPuzzleProps) {
  const [values, setValues] = useState<number[]>(
    config.dials.map((d) => d.startValue ?? d.min)
  );
  const [shake, setShake] = useState(false);

  const adjust = (dialIdx: number, dir: 1 | -1) => {
    if (locked || shake) return;
    const dial = config.dials[dialIdx];
    const step = dial.step ?? 1;
    // Round to avoid floating-point drift
    const range = Math.round((dial.max - dial.min) / step);
    const currentStep = Math.round((values[dialIdx] - dial.min) / step);
    const nextStep = ((currentStep + dir + range + 1) % (range + 1));
    const nextVal = dial.min + nextStep * step;
    const updated = [...values];
    updated[dialIdx] = Math.round(nextVal * 1e9) / 1e9;
    setValues(updated);
  };

  const verify = () => {
    if (locked) return;
    const correct = config.dials.every((d, i) => {
      const step = d.step ?? 1;
      return Math.abs(values[i] - d.target) < step * 0.01;
    });
    if (correct) {
      onSolve();
    } else {
      setShake(true);
      setTimeout(() => {
        setShake(false);
        setValues(config.dials.map((d) => d.startValue ?? d.min));
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
        Rotate each dial to the correct value, then confirm.
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

      {/* Dials grid — max 4 per row */}
      <div className="flex flex-wrap justify-center gap-3">
        {config.dials.map((dial, i) => (
          <div
            key={i}
            className="flex flex-col items-center gap-1 bg-slate-900 border border-slate-700 rounded-2xl px-3 py-3 min-w-[72px]"
          >
            {/* Label */}
            <div
              className="text-[10px] text-gray-400 font-mono uppercase tracking-widest text-center max-w-[68px] truncate"
              title={dial.label}
            >
              {dial.label}
            </div>

            {/* Up */}
            <button
              onClick={() => adjust(i, 1)}
              disabled={locked}
              className="w-11 h-8 flex items-center justify-center rounded-lg bg-slate-700 hover:bg-cyan-900 active:bg-cyan-800 active:scale-95 text-white text-base font-bold disabled:opacity-30 transition-all select-none"
              aria-label={`${dial.label} increase`}
            >
              ▲
            </button>

            {/* Value box */}
            <div
              className={`w-14 h-12 flex items-center justify-center rounded-xl border font-mono text-2xl font-bold tabular-nums transition-colors ${
                locked
                  ? 'border-slate-700 text-slate-500 bg-slate-950'
                  : 'border-cyan-700/50 text-cyan-200 bg-slate-950'
              }`}
            >
              {values[i]}
            </div>

            {/* Down */}
            <button
              onClick={() => adjust(i, -1)}
              disabled={locked}
              className="w-11 h-8 flex items-center justify-center rounded-lg bg-slate-700 hover:bg-cyan-900 active:bg-cyan-800 active:scale-95 text-white text-base font-bold disabled:opacity-30 transition-all select-none"
              aria-label={`${dial.label} decrease`}
            >
              ▼
            </button>

            {/* Range hint */}
            <div className="text-[9px] text-slate-600 font-mono">
              {dial.min}–{dial.max}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={verify}
        disabled={locked}
        className="mt-1 px-7 py-2.5 rounded-xl bg-cyan-700 hover:bg-cyan-600 active:bg-cyan-800 active:scale-95 text-white font-bold text-sm disabled:opacity-30 transition-all"
      >
        CONFIRM COMBINATION
      </button>
    </div>
  );
}
