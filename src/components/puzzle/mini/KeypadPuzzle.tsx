'use client';
import React, { useState } from 'react';

export interface KeypadConfig {
  /** The correct PIN. Only digits, e.g. "4271". */
  correctCode: string;
  /** Optional flavour hint shown above the keypad. */
  hint?: string;
  /** Optional image URL for an in-scene clue. */
  hintImageUrl?: string;
  /** Max failed attempts before lockout (default 3). */
  maxAttempts?: number;
  /** Seconds deducted from run timer on lockout (default 30). */
  timePenaltySeconds?: number;
}

interface KeypadPuzzleProps {
  config: KeypadConfig;
  onSolve: () => void;
  onWrongAttempt: () => void;
  attemptCount: number;
  maxAttempts: number;
  locked: boolean;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

export default function KeypadPuzzle({
  config,
  onSolve,
  onWrongAttempt,
  attemptCount,
  maxAttempts,
  locked,
}: KeypadPuzzleProps) {
  const codeLength = config.correctCode.length || 4;
  const [entered, setEntered] = useState('');
  const [shake, setShake] = useState(false);

  const pressDigit = (digit: string) => {
    if (locked || shake) return;
    if (entered.length >= codeLength) return;
    const next = entered + digit;
    setEntered(next);
    if (next.length === codeLength) {
      if (next === config.correctCode) {
        onSolve();
      } else {
        setShake(true);
        setTimeout(() => {
          setShake(false);
          setEntered('');
          onWrongAttempt();
        }, 550);
      }
    }
  };

  const backspace = () => {
    if (locked || shake) return;
    setEntered((e) => e.slice(0, -1));
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {config.hintImageUrl && (
        <img
          src={config.hintImageUrl}
          alt="Clue"
          className="max-h-28 rounded-lg border border-cyan-800/40 object-contain"
        />
      )}
      {config.hint && (
        <p className="text-center text-xs text-cyan-400/80 italic max-w-xs">{config.hint}</p>
      )}

      {/* Digit display */}
      <div
        className="flex gap-2 px-4 py-3 rounded-xl bg-slate-950 border transition-colors"
        style={shake ? { borderColor: '#ef4444', animation: 'miniShake 0.45s ease' } : { borderColor: 'rgba(34,211,238,0.3)' }}
      >
        {Array.from({ length: codeLength }).map((_, i) => (
          <div
            key={i}
            className={`w-9 h-11 flex items-center justify-center rounded-md border text-2xl font-mono font-bold transition-all duration-100 ${
              i < entered.length
                ? 'border-cyan-400 bg-cyan-950 text-cyan-200'
                : 'border-slate-700 bg-slate-900 text-slate-600'
            }`}
          >
            {i < entered.length ? '●' : '·'}
          </div>
        ))}
      </div>

      {/* Attempt pips */}
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

      {/* Keypad */}
      <div className="grid grid-cols-3 gap-2">
        {KEYS.map((k, idx) => {
          const isBlank = k === '';
          const isBackspace = k === '⌫';
          return (
            <button
              key={idx}
              disabled={locked || isBlank}
              onClick={() => {
                if (isBackspace) backspace();
                else if (!isBlank) pressDigit(k);
              }}
              className={`w-16 h-14 rounded-xl font-bold text-xl select-none transition-all ${
                isBlank
                  ? 'bg-transparent cursor-default pointer-events-none'
                  : locked
                  ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                  : isBackspace
                  ? 'bg-slate-700 hover:bg-slate-600 active:scale-95 text-amber-300 border border-slate-600'
                  : 'bg-slate-800 hover:bg-cyan-900/50 active:bg-cyan-800 active:scale-95 text-white border border-slate-700 hover:border-cyan-700'
              }`}
            >
              {k}
            </button>
          );
        })}
      </div>
    </div>
  );
}
