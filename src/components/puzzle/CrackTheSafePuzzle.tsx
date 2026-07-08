"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePuzzleSkin } from "@/hooks/usePuzzleSkin";
import { MAX_PUZZLE_ATTEMPTS } from "@/lib/puzzleConstants";

type GuessResult = {
  guess: string;
  bulls: number;
  cows: number;
  correct: boolean;
  hints?: string[]; // per-position: "green" | "yellow" | "gray"
};

interface SafeData {
  safecode?: string;
  digits?: number;
  maxAttempts?: number;
  clue?: string;
  surpriseMessage?: string;
  safeImageUrl?: string;
}

interface Props {
  puzzleId: string;
  safeData: SafeData;
  onSolved?: () => void;
  alreadySolved?: boolean;
  failedAttempts?: number;
}

function HowToPlayModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4" onClick={onClose}>
      <div className="max-w-lg w-full rounded-xl p-6 shadow-2xl" style={{ background: "#0f0f1a", border: "1px solid rgba(255,255,255,0.12)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-lg font-extrabold" style={{ color: "#FDE74C" }}>How to Play — Crack the Safe</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none ml-4">✕</button>
        </div>
        <div className="space-y-3 text-sm text-gray-300">
          <p>🔐 <strong>Goal:</strong> Guess the secret combination to crack open the safe.</p>
          <p>⌨️ <strong>Enter digits</strong> into the keypad inputs, then turn the handle (or press Enter) to submit your guess.</p>
          <p>After each guess you get feedback:</p>
          <ul className="list-none space-y-1 pl-2">
            <li>🟢 <strong>Bulls</strong> — correct digit in the correct position</li>
            <li>🟡 <strong>Cows</strong> — correct digit in the wrong position</li>
          </ul>
          <p>Use the feedback to narrow down the code before you run out of attempts.</p>
          <p>💡 <strong>Tip:</strong> Start with digits spread across 0–9 to eliminate possibilities quickly.</p>
        </div>
        <div className="mt-5 text-right">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-bold transition-all hover:opacity-80" style={{ background: "#FDE74C", color: "#000" }}>Got it</button>
        </div>
      </div>
    </div>
  );
}

export default function CrackTheSafePuzzle({ puzzleId, safeData, onSolved, alreadySolved = false, failedAttempts: initialFailedAttempts = 0 }: Props) {
  const digits = Math.max(4, Math.min(8, safeData.digits ?? (safeData.safecode?.length ?? 6)));
  const maxAttempts = safeData.maxAttempts ?? 10;
  const clue = safeData.clue ?? "";
  const surpriseMessage = safeData.surpriseMessage ?? "🎉 You cracked the safe!";
  const safeImageUrl = safeData.safeImageUrl ?? "";

  const [curr, setCurr] = useState<string[]>(Array(digits).fill(""));
  const [history, setHistory] = useState<GuessResult[]>([]);
  const [status, setStatus] = useState<"playing" | "won" | "lost">("playing");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showSurprise, setShowSurprise] = useState(false);
  const [recording, setRecording] = useState(false);
  const [shaking, setShaking] = useState(false);
  // 3-attempt system
  const [failedAttempts, setFailedAttempts] = useState(initialFailedAttempts);
  const [revealedCode, setRevealedCode] = useState<string | null>(null);
  const gameLossRecorded = useRef(false);
  const attemptsLocked = !alreadySolved && failedAttempts >= MAX_PUZZLE_ATTEMPTS;

  /** Reset game state for a fresh attempt. */
  const resetForNewAttempt = () => {
    setHistory([]);
    setCurr(Array(digits).fill(""));
    setStatus("playing");
    setError("");
    setShaking(false);
    setShowSurprise(false);
    gameLossRecorded.current = false;
    setTimeout(() => inputRefs.current[0]?.focus(), 50);
  };

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const safeContainerRef = useRef<HTMLDivElement>(null);
  const [safeScale, setSafeScale] = useState(1);
  const skin = usePuzzleSkin();
  const [showHelp, setShowHelp] = useState(false);

  const attemptsLeft = maxAttempts - history.length;
  const isPlaying = status === "playing";

  // Focus first empty digit on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  // Scale safe to fit container on mobile
  useEffect(() => {
    const el = safeContainerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      setSafeScale(w > 0 ? Math.min(1, w / 420) : 1);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const handleDigitChange = useCallback(
    (index: number, value: string) => {
      if (!isPlaying) return;
      const digit = value.replace(/\D/g, "").slice(-1);
      setCurr((prev) => {
        const next = [...prev];
        next[index] = digit;
        return next;
      });
      if (digit && index < digits - 1) {
        inputRefs.current[index + 1]?.focus();
      }
    },
    [isPlaying, digits]
  );

  const handleKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Backspace") {
        if (curr[index]) {
          setCurr((prev) => { const n = [...prev]; n[index] = ""; return n; });
        } else if (index > 0) {
          inputRefs.current[index - 1]?.focus();
          setCurr((prev) => { const n = [...prev]; n[index - 1] = ""; return n; });
        }
      } else if (e.key === "ArrowLeft" && index > 0) {
        inputRefs.current[index - 1]?.focus();
      } else if (e.key === "ArrowRight" && index < digits - 1) {
        inputRefs.current[index + 1]?.focus();
      } else if (e.key === "Enter") {
        submit();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [curr, digits]
  );

  const submit = useCallback(async () => {
    if (!isPlaying || submitting) return;
    const guess = curr.join("");
    if (guess.length < digits || curr.some((d) => d === "")) {
      setError("Enter all digits before submitting.");
      return;
    }
    setError("");
    setSubmitting(true);

    try {
      const res = await fetch(`/api/puzzles/${puzzleId}/safe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guess }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.locked) {
          if (data.revealCode) setRevealedCode(data.revealCode);
          if (data.attemptsUsed !== undefined) setFailedAttempts(data.attemptsUsed);
          setSubmitting(false);
          return;
        }
        setError(data.error ?? "Failed to check guess.");
        setSubmitting(false);
        return;
      }

      const result: GuessResult = { guess, bulls: data.bulls, cows: data.cows, correct: data.correct, hints: data.hints };
      const next = [...history, result];
      setHistory(next);
      setCurr(Array(digits).fill(""));
      setTimeout(() => inputRefs.current[0]?.focus(), 50);

      if (!data.correct) {
        setShaking(true);
        setTimeout(() => setShaking(false), 600);
      }

      if (data.correct) {
        setStatus("won");
        // Delay the modal so the door-swing + contents animation plays first
        setTimeout(() => setShowSurprise(true), 2200);
        // Record solve via progress endpoint
        setRecording(true);
        try {
          await fetch(`/api/puzzles/${puzzleId}/progress`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "attempt_success" }),
          });
        } catch (_) {
          // non-critical
        } finally {
          setRecording(false);
        }
        // Delay the parent modal so the player can see the open safe first
        setTimeout(() => onSolved?.(), 3500);
      } else if (next.length >= maxAttempts) {
        setStatus("lost");
        if (!gameLossRecorded.current) {
          gameLossRecorded.current = true;
          fetch(`/api/puzzles/${puzzleId}/progress`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "record_game_loss" }),
            credentials: "same-origin",
          })
            .then((r) => r.json())
            .then((d) => {
              if (d.failedAttempts !== undefined) setFailedAttempts(d.failedAttempts);
            })
            .catch(() => {});
        }
      }
    } catch (_) {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [curr, digits, history, isPlaying, maxAttempts, puzzleId, submitting, onSolved]);

  // Locked overlay
  if (attemptsLocked) {
    return (
      <div className="flex flex-col items-center gap-6 p-8 text-center">
        <div className="text-5xl">🔒</div>
        <h3 className="font-black text-2xl" style={{ color: "#ef4444" }}>SAFE SEALED</h3>
        <p style={{ color: "#9ca3af" }}>You&apos;ve used all {MAX_PUZZLE_ATTEMPTS} attempts on this puzzle.</p>
        {revealedCode && (
          <div className="mt-2">
            <p className="text-sm mb-1" style={{ color: "#9ca3af" }}>The code was:</p>
            <span className="font-black text-3xl tracking-[0.3em]" style={{ color: "#FDE74C" }}>
              {revealedCode}
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      {showHelp && <HowToPlayModal onClose={() => setShowHelp(false)} />}
      {/* Inline animations */}
      <style>{`
        @keyframes safe-door-open {
          0%   { transform: rotateY(0deg); }
          70%  { transform: rotateY(132deg); }
          85%  { transform: rotateY(120deg); }
          100% { transform: rotateY(126deg); }
        }
        @keyframes safe-contents-appear {
          0%   { opacity: 0; transform: scale(0.5) translateY(8px); }
          60%  { opacity: 1; transform: scale(1.15) translateY(-4px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes safe-shimmer {
          0%,100% { opacity: 0.6; }
          50%      { opacity: 1; }
        }
        @keyframes safe-shake {
          0%,100%{ transform: translateX(0); }
          15%    { transform: translateX(-8px) rotate(-0.5deg); }
          30%    { transform: translateX(8px) rotate(0.5deg); }
          45%    { transform: translateX(-5px); }
          60%    { transform: translateX(5px); }
          75%    { transform: translateX(-2px); }
        }
        @keyframes safe-fadein {
          from{opacity:0;transform:translateY(8px);}
          to{opacity:1;transform:translateY(0);}
        }
        @keyframes safe-pop {
          0%,100%{transform:scale(1);}
          50%{transform:scale(1.08);}
        }
        @keyframes handle-pulse {
          0%,100% { box-shadow: 2px 4px 16px rgba(0,0,0,0.75); }
          50%      { box-shadow: 2px 4px 28px rgba(200,220,255,0.55); }
        }
        @keyframes safe-ambient-pulse {
          0%,100% { opacity: 0.55; }
          50%      { opacity: 0.85; }
        }
        @keyframes lcd-blink {
          0%,100% { opacity: 1; }
          48%,52% { opacity: 0.3; }
        }
        .safe-door-open   { animation: safe-door-open 0.9s cubic-bezier(0.4,0,0.2,1) forwards; transform-origin: right center; }
        .safe-contents    { animation: safe-contents-appear 0.5s ease 0.6s both; }
        .safe-shimmer     { animation: safe-shimmer 1.8s ease-in-out infinite; }
        .safe-shake       { animation: safe-shake 0.6s cubic-bezier(0.36,0.07,0.19,0.97); }
        .safe-fadein      { animation: safe-fadein 0.3s ease; }
        .safe-pop         { animation: safe-pop 0.2s ease; }
        .safe-handle-ready { animation: handle-pulse 2s ease-in-out infinite; }
        .safe-handle:hover { filter: brightness(1.25) drop-shadow(0 0 8px rgba(200,220,240,0.6)); }
        .safe-handle:active { filter: brightness(0.82); }
        .safe-ambient     { animation: safe-ambient-pulse 3s ease-in-out infinite; }
        .safe-lcd-idle    { animation: lcd-blink 4s ease-in-out infinite; }
      `}</style>

      <div className="w-full max-w-md mx-auto select-none">

        {/* ── Safe graphic ──────────────────────────────────────────── */}
        <div className="flex justify-center mb-6">
          {safeImageUrl ? (
            <div
              className={`relative rounded-2xl overflow-hidden shadow-2xl ${status === "won" ? "safe-unlock" : ""}`}
              style={{
                maxWidth: 280,
                width: "100%",
                border: status === "won" ? "3px solid #38D399" : status === "lost" ? "3px solid #ef4444" : "3px solid #3891A6",
                boxShadow: status === "won" ? "0 0 32px rgba(56,211,153,0.4)" : "0 8px 32px rgba(0,0,0,0.6)",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={safeImageUrl}
                alt="Safe"
                style={{ width: "100%", height: "auto", display: "block" }}
              />
              {status === "won" && (
                <div className="absolute inset-0 flex items-center justify-center"
                     style={{ background: "rgba(56,211,153,0.2)" }}>
                  <span style={{ fontSize: 48, filter: "drop-shadow(0 2px 8px #000)" }}>🔓</span>
                </div>
              )}
              {status === "lost" && (
                <div className="absolute inset-0 flex items-center justify-center"
                     style={{ background: "rgba(239,68,68,0.2)" }}>
                  <span style={{ fontSize: 48, filter: "drop-shadow(0 2px 8px #000)" }}>🔒</span>
                </div>
              )}
            </div>
          ) : (
            /* ── CSS safe — reference image faithful ── */
            <div ref={safeContainerRef} style={{ width: "100%", maxWidth: 420, position: "relative", height: Math.round(430 * safeScale), overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, transformOrigin: "top left", transform: `scale(${safeScale})` }}>
            <div className={shaking ? "safe-shake" : ""}
                 style={{ position: "relative", width: 420, height: 430, display: "inline-block" }}>

              {/* ── Ambient glow halo behind the safe ── */}
              <div className="safe-ambient" style={{
                position: "absolute", inset: -18,
                borderRadius: 28,
                background: status === "won"
                  ? "radial-gradient(ellipse at 50% 50%, rgba(56,211,153,0.22) 0%, transparent 72%)"
                  : status === "lost"
                  ? "radial-gradient(ellipse at 50% 50%, rgba(239,68,68,0.18) 0%, transparent 72%)"
                  : "radial-gradient(ellipse at 50% 50%, rgba(56,145,166,0.14) 0%, transparent 72%)",
                pointerEvents: "none",
              }} />

              {/* ── Outer casing ── */}
              <div style={{
                position: "absolute", left: 0, right: 0, top: 0, height: 418,
                borderRadius: 10,
                background: "linear-gradient(155deg, #585d63 0%, #404448 25%, #2e3238 55%, #3c4048 100%)",
                boxShadow: status === "won"
                  ? "0 0 0 2px #38D399, 0 0 40px rgba(56,211,153,0.35), 0 24px 60px rgba(0,0,0,0.85), 0 8px 20px rgba(0,0,0,0.5)"
                  : status === "lost"
                  ? "0 0 0 2px #ef4444, 0 0 30px rgba(239,68,68,0.3), 0 24px 60px rgba(0,0,0,0.85)"
                  : "0 0 0 1px rgba(255,255,255,0.08), 0 24px 60px rgba(0,0,0,0.85), 0 8px 20px rgba(0,0,0,0.5)",
                overflow: "hidden",
              }}>
                {/* Subtle horizontal texture */}
                {Array.from({ length: 20 }).map((_, i) => (
                  <div key={i} style={{
                    position: "absolute", left: 0, right: 0,
                    top: i * 21, height: 1,
                    background: "rgba(255,255,255,0.016)",
                    pointerEvents: "none",
                  }} />
                ))}
                {/* Top bevel */}
                <div style={{
                  position: "absolute", top: 0, left: 0, right: 0, height: 3,
                  background: "linear-gradient(180deg, rgba(255,255,255,0.09), transparent)",
                  borderRadius: "10px 10px 0 0", pointerEvents: "none",
                }} />

                {/* ── Brand nameplate (top center) ── */}
                <div style={{
                  position: "absolute", top: 10, left: "50%", transform: "translateX(-50%)",
                  background: "linear-gradient(180deg, #8a8e96 0%, #6a6e76 50%, #7e8288 100%)",
                  borderRadius: 4, padding: "3px 16px",
                  border: "1px solid rgba(0,0,0,0.4)",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.22)",
                  pointerEvents: "none", zIndex: 5,
                }}>
                  <span style={{ fontSize: 8, letterSpacing: "0.32em", color: "rgba(0,0,0,0.7)", fontFamily: "monospace", fontWeight: 900 }}>VAULT-X SERIES II</span>
                </div>

                {/* ── Corner reinforcement plates ── */}
                {[
                  { top: 0,   left: 0,   borderRadius: "10px 0 8px 0" },
                  { top: 0,   right: 0,  borderRadius: "0 10px 0 8px" },
                  { bottom: 12, left: 0, borderRadius: "0 8px 0 10px" },
                  { bottom: 12, right: 0,borderRadius: "8px 0 10px 0" },
                ].map((pos, idx) => (
                  <div key={idx} style={{
                    position: "absolute", ...pos,
                    width: 42, height: 42,
                    background: "linear-gradient(135deg, #6e7278 0%, #52565c 55%, #484c52 100%)",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12), inset 0 -1px 0 rgba(0,0,0,0.25)",
                    pointerEvents: "none", zIndex: 3,
                  }}>
                    {/* Rivet */}
                    <div style={{
                      position: "absolute", top: "50%", left: "50%",
                      transform: "translate(-50%,-50%)",
                      width: 10, height: 10, borderRadius: "50%",
                      background: "radial-gradient(circle at 36% 32%, #9ca0a6, #3a3e44)",
                      boxShadow: "inset 0 1px 3px rgba(0,0,0,0.6), 0 1px 1px rgba(255,255,255,0.1)",
                    }}>
                      <div style={{ position: "absolute", top: "50%", left: 2, right: 2, height: 1.5, background: "rgba(0,0,0,0.45)", transform: "translateY(-50%)" }} />
                    </div>
                  </div>
                ))}

                {/* ── Warning / caution stripe at bottom ── */}
                <div style={{
                  position: "absolute", bottom: 12, left: 10, right: 10, height: 18,
                  borderRadius: "0 0 6px 6px",
                  overflow: "hidden", pointerEvents: "none", zIndex: 4,
                  boxShadow: "inset 0 1px 0 rgba(0,0,0,0.3)",
                }}>
                  {Array.from({ length: 22 }).map((_, i) => (
                    <div key={i} style={{
                      position: "absolute", top: 0, bottom: 0,
                      left: i * 19 - 4, width: 10,
                      background: i % 2 === 0 ? "rgba(253,231,76,0.55)" : "rgba(0,0,0,0.45)",
                      transform: "skewX(-22deg)",
                    }} />
                  ))}
                </div>
                {/* Vault interior — left half, revealed when door swings open to left */}
                {status === "won" && (
                  <div style={{
                    position: "absolute", inset: 16,
                    borderRadius: 6,
                    background: "linear-gradient(160deg, #0e1c14, #0a1610)",
                    overflow: "hidden",
                    boxShadow: "inset 0 0 30px rgba(0,0,0,0.7)",
                  }}>
                    {/* Felt lining */}
                    <div style={{
                      position: "absolute", inset: 5, borderRadius: 4,
                      background: "linear-gradient(135deg, #12241a, #0a1812)",
                      border: "1px solid rgba(56,211,153,0.12)",
                    }}>
                      {/* Shelf */}
                      <div style={{ position: "absolute", left: 8, right: 8, top: "52%", height: 2, background: "rgba(56,211,153,0.18)",
                        boxShadow: "0 1px 4px rgba(56,211,153,0.2)" }} />
                      <div className="safe-contents" style={{
                        position: "absolute", inset: 0,
                        display: "flex", flexDirection: "column",
                        alignItems: "center", justifyContent: "space-around",
                        padding: "16px 4px",
                      }}>
                        <span className="safe-shimmer" style={{ fontSize: 44 }}>💎</span>
                        <span className="safe-shimmer" style={{ fontSize: 36, animationDelay: "0.3s" }}>🥇</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ── 3D door: perspective wrapper + preserve-3d pivot ── */}
              <div style={{
                position: "absolute",
                top: 14, left: 14, right: 14, bottom: 24,
                perspective: "700px",
                perspectiveOrigin: "right center",
                pointerEvents: "none",
              }}>
              <div
                className={status === "won" ? "safe-door-open" : ""}
                style={{
                  position: "absolute", inset: 0,
                  transformStyle: "preserve-3d",
                  transformOrigin: "right center",
                  pointerEvents: "auto",
                }}
              >

              {/* ── FRONT FACE ── */}
              <div style={{
                position: "absolute", inset: 0,
                borderRadius: 7,
                background: "linear-gradient(155deg, #555a61 0%, #3e4349 30%, #2d3238 60%, #3a3e46 100%)",
                boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.04)",
                backfaceVisibility: "hidden",
                WebkitBackfaceVisibility: "hidden" as React.CSSProperties["WebkitBackfaceVisibility"],
                overflow: "visible",
              }}>
                {/* Door texture */}
                {Array.from({ length: 18 }).map((_, i) => (
                  <div key={i} style={{
                    position: "absolute", left: 0, right: 0,
                    top: i * 22, height: 1,
                    background: "rgba(255,255,255,0.012)",
                    pointerEvents: "none",
                  }} />
                ))}
                {/* Scanline overlay */}
                <div style={{
                  position: "absolute", inset: 0, borderRadius: 7,
                  backgroundImage: "repeating-linear-gradient(0deg, rgba(0,0,0,0.07) 0px, rgba(0,0,0,0.07) 1px, transparent 1px, transparent 3px)",
                  pointerEvents: "none", zIndex: 1,
                }} />
                {/* Left edge visible highlight */}
                <div style={{
                  position: "absolute", top: 0, left: 0, bottom: 0, width: 2,
                  background: "linear-gradient(90deg, rgba(255,255,255,0.08), transparent)",
                  borderRadius: "5px 0 0 5px", pointerEvents: "none",
                }} />

                {/* ── Chrome handle backing plate (left-center) ── */}
                <div style={{
                  position: "absolute",
                  top: "50%", left: "30%",
                  transform: "translate(-50%, -50%)",
                  width: 110, height: 110,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #d6dae0 0%, #b2b6bc 20%, #969aa0 45%, #c2c6cc 65%, #dce0e6 85%, #bcC0c6 100%)",
                  boxShadow: "0 6px 22px rgba(0,0,0,0.72), inset 0 1px 0 rgba(255,255,255,0.48), inset 0 -2px 5px rgba(0,0,0,0.28)",
                  zIndex: 2,
                  pointerEvents: "none",
                }}>
                  {/* Brushed radial lines */}
                  {Array.from({ length: 20 }).map((_, i) => (
                    <div key={i} style={{
                      position: "absolute", top: "50%", left: "50%",
                      width: "50%", height: 1,
                      background: "rgba(0,0,0,0.065)",
                      transformOrigin: "0 50%",
                      transform: `rotate(${i * 18}deg) translateY(-0.5px)`,
                      pointerEvents: "none",
                    }} />
                  ))}
                  {/* Inset ring groove */}
                  <div style={{
                    position: "absolute", inset: 8, borderRadius: "50%",
                    boxShadow: "inset 0 0 0 1.5px rgba(0,0,0,0.18), 0 0 0 1px rgba(255,255,255,0.12)",
                    pointerEvents: "none",
                  }} />
                  {/* Center hub */}
                  <div style={{
                    position: "absolute", top: "50%", left: "50%",
                    transform: "translate(-50%,-50%)",
                    width: 28, height: 28, borderRadius: "50%",
                    background: "radial-gradient(circle at 36% 32%, #eeeff0, #999 50%, #555)",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.4)",
                    zIndex: 3, pointerEvents: "none",
                  }}>
                    <div style={{ position: "absolute", top: "50%", left: 5, right: 5, height: 2, background: "rgba(0,0,0,0.5)", transform: "translateY(-50%)" }} />
                  </div>
                </div>

                {/* ── Cylindrical lever handle (clickable submit) ── */}
                {(() => {
                  const allFilled = curr.every(d => d !== "");
                  const canPull = isPlaying && !submitting && allFilled;
                  return (
                    // Pivot anchor at center of backing plate
                    <div style={{
                      position: "absolute",
                      top: "50%", left: "30%",
                      pointerEvents: "none",
                      zIndex: 4,
                    }}>
                      <div
                        className={`safe-handle${canPull ? " safe-handle-ready" : ""}`}
                        onClick={canPull ? submit : undefined}
                        title={isPlaying ? (allFilled ? "Turn the handle to open!" : "Enter all digits first") : ""}
                        style={{
                          position: "absolute",
                          top: 0,
                          left: -14,
                          transformOrigin: "14px 0px",
                          transform: "rotate(-42deg)",
                          width: 28,
                          height: 98,
                          borderRadius: 14,
                          background: canPull
                            ? "linear-gradient(90deg, #787c84 0%, #c8ccd4 28%, #eaeef4 50%, #c8ccd4 72%, #787c84 100%)"
                            : "linear-gradient(90deg, #565a62 0%, #969aa2 28%, #b4b8c0 50%, #969aa2 72%, #565a62 100%)",
                          boxShadow: canPull
                            ? "3px 5px 22px rgba(0,0,0,0.75), inset 0 1px 0 rgba(255,255,255,0.4)"
                            : "1px 2px 8px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.12)",
                          cursor: canPull ? "pointer" : "default",
                          transition: "background 0.3s, box-shadow 0.3s",
                          pointerEvents: "auto",
                        }}
                      >
                        {/* Grip rings */}
                        {[20, 36, 52, 68].map(y => (
                          <div key={y} style={{
                            position: "absolute", left: 3, right: 3, top: y, height: 2,
                            background: "rgba(0,0,0,0.16)", borderRadius: 1, pointerEvents: "none",
                          }} />
                        ))}
                        {/* End cap */}
                        <div style={{
                          position: "absolute", bottom: 5, left: 7, right: 7, height: 3,
                          background: "rgba(255,255,255,0.18)", borderRadius: 2, pointerEvents: "none",
                        }} />
                        {/* Turn label — counter-rotated so it reads horizontally */}
                        {canPull && (
                          <div style={{
                            position: "absolute", bottom: -26, left: "50%",
                            transform: "translateX(-50%) rotate(42deg)",
                            fontSize: 8, letterSpacing: "0.16em",
                            color: "rgba(255,255,255,0.45)", fontFamily: "monospace",
                            whiteSpace: "nowrap", pointerEvents: "none",
                          }}>▶ TURN</div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* ── Electronic keypad panel (right-center of door) ── */}
                {(() => {
                  const panelW = Math.max(152, digits * 27 + 24);
                  const kGap = digits > 5 ? 2 : 4;
                  const iW = Math.max(16, Math.min(38, Math.floor((panelW - 22 - (digits - 1) * kGap) / digits)));
                  const iH = iW >= 26 ? 44 : 34;
                  return (
                    <div style={{
                      position: "absolute",
                      top: "50%", right: 18,
                      transform: "translateY(-44%)",
                      width: panelW,
                      background: "linear-gradient(155deg, #c4c8cc 0%, #aeb2b6 35%, #a2a6aa 60%, #b2b6ba 100%)",
                      borderRadius: 8,
                      boxShadow: "0 6px 20px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.62), inset 0 -1px 0 rgba(0,0,0,0.12)",
                      padding: "9px 11px 11px",
                    }}>
                      {/* LCD screen */}
                      <div style={{
                        background: "linear-gradient(180deg, #3a5838 0%, #2a4828 100%)",
                        borderRadius: 4, marginBottom: 8,
                        border: "2px solid #192618",
                        boxShadow: "inset 0 2px 7px rgba(0,0,0,0.65), 0 1px 0 rgba(255,255,255,0.14)",
                        padding: "5px 8px", minHeight: 28,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        {status === "won" ? (
                          <span style={{ color: "#7BEA7B", fontSize: 9, letterSpacing: "0.18em", fontFamily: "monospace" }}>✓ UNLOCKED</span>
                        ) : status === "lost" ? (
                          <span style={{ color: "#EA7B7B", fontSize: 9, letterSpacing: "0.18em", fontFamily: "monospace" }}>✗ LOCKED OUT</span>
                        ) : curr.every(d => d === "") ? (
                          <span className="safe-lcd-idle" style={{ color: "rgba(80,170,80,0.65)", fontSize: 10, fontFamily: "monospace", letterSpacing: 2 }}>
                            {"▮ ".repeat(digits).trim()}
                          </span>
                        ) : (
                          <span style={{ color: "rgba(80,170,80,0.38)", fontSize: 12, fontFamily: "monospace", letterSpacing: 2 }}>
                            {"_ ".repeat(digits).trim()}
                          </span>
                        )}
                      </div>
                      {/* Label */}
                      <div style={{ textAlign: "center", marginBottom: 6 }}>
                        <span style={{ fontSize: 7, letterSpacing: "0.22em", color: "rgba(0,0,0,0.38)", fontFamily: "monospace" }}>ENTER CODE</span>
                      </div>
                      {/* Digit inputs */}
                      <div style={{ display: "flex", justifyContent: "center", gap: kGap }}>
                        {curr.map((d, i) => (
                          <input
                            key={i}
                            ref={(el) => { inputRefs.current[i] = el; }}
                            type="tel"
                            inputMode="numeric"
                            maxLength={1}
                            value={d}
                            disabled={!isPlaying}
                            onChange={(e) => handleDigitChange(i, e.target.value)}
                            onKeyDown={(e) => handleKeyDown(i, e)}
                            onFocus={(e) => e.target.select()}
                            style={{
                              width: iW, height: iH,
                              background: d ? "#0a190a" : "#111",
                              border: d ? "1px solid #38D399" : "1px solid #1c1c1c",
                              borderBottom: d ? "2px solid #38D399" : "2px solid #0a0a0a",
                              borderRadius: 3,
                              color: d ? "#38D399" : "#333",
                              textAlign: "center",
                              fontSize: iW >= 26 ? 20 : 14,
                              fontWeight: 900, fontFamily: "monospace",
                              caretColor: "transparent", outline: "none",
                              boxShadow: "inset 0 2px 5px rgba(0,0,0,0.9)",
                            }}
                          />
                        ))}
                      </div>
                      {/* LED + attempt counter */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, marginTop: 7 }}>
                        <div style={{
                          width: 7, height: 7, borderRadius: "50%",
                          background: status==="won"?"#38D399":status==="lost"?"#ef4444":submitting?"#FDE74C":"#ff4400",
                          boxShadow: status==="won"?"0 0 6px #38D399":status==="lost"?"0 0 6px #ef4444":submitting?"0 0 6px #FDE74C":"0 0 4px #ff4400",
                        }} />
                        <span style={{ fontSize: 7, letterSpacing: "0.12em", color: "rgba(0,0,0,0.36)", fontFamily: "monospace" }}>
                          {status==="won"?"UNLOCKED":status==="lost"?"LOCKED":submitting?"CHECKING":`${history.length}/${maxAttempts}`}
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {/* ── Locking bolts (left edge, retract on open) ── */}
                {[56, 170, 284].map(top => (
                  <div key={top} style={{
                    position: "absolute", left: -5, top,
                    width: status === "won" ? 0 : 18, height: 18,
                    borderRadius: "4px 0 0 4px",
                    background: "linear-gradient(270deg, #555, #999 60%, #ccc)",
                    boxShadow: "-3px 0 8px rgba(0,0,0,0.55)",
                    transition: "width 0.4s ease 0.1s",
                    pointerEvents: "none",
                  }} />
                ))}
              </div>{/* end FRONT FACE */}

              {/* ── LEFT EDGE — 26px of steel thickness, seen as door swings ── */}
              <div style={{
                position: "absolute",
                top: 6, bottom: 6, left: 0,
                width: 26,
                borderRadius: "5px 0 0 5px",
                background: "linear-gradient(90deg, #4a4e56 0%, #6e7278 20%, #9ca0a8 48%, #7a7e86 72%, #4e5258 100%)",
                transform: "rotateY(-90deg)",
                transformOrigin: "left center",
                backfaceVisibility: "hidden",
                WebkitBackfaceVisibility: "hidden" as React.CSSProperties["WebkitBackfaceVisibility"],
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -1px 0 rgba(0,0,0,0.35)",
                pointerEvents: "none",
              }}>
                {/* Horizontal groove lines on the edge */}
                {["22%","50%","78%"].map(top => (
                  <div key={top} style={{
                    position: "absolute", top, left: 3, right: 3, height: 1,
                    background: "rgba(0,0,0,0.28)",
                  }} />
                ))}
              </div>

              {/* ── BACK FACE — interior of the door, no keypad visible ── */}
              <div style={{
                position: "absolute", inset: 0,
                borderRadius: 7,
                background: "linear-gradient(155deg, #3c4048 0%, #2a2e36 40%, #202428 65%, #2c3038 100%)",
                transform: "rotateY(180deg)",
                backfaceVisibility: "hidden",
                WebkitBackfaceVisibility: "hidden" as React.CSSProperties["WebkitBackfaceVisibility"],
                overflow: "hidden",
                pointerEvents: "none",
              }}>
                {/* Heavy steel texture */}
                {Array.from({ length: 14 }).map((_, i) => (
                  <div key={i} style={{
                    position: "absolute", left: 0, right: 0, top: i * 28, height: 1,
                    background: "rgba(255,255,255,0.022)",
                  }} />
                ))}
                {/* Top & bottom bevel */}
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3,
                  background: "linear-gradient(180deg, rgba(255,255,255,0.07), transparent)",
                  borderRadius: "7px 7px 0 0" }} />
                {/* Horizontal reinforcement ribs */}
                {["26%","62%"].map((top, i) => (
                  <div key={i} style={{
                    position: "absolute", left: 18, right: 18, top,
                    height: 20, borderRadius: 3,
                    background: "linear-gradient(180deg, #484c54 0%, #34383e 55%, #282c32 100%)",
                    boxShadow: "0 2px 7px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)",
                  }} />
                ))}
                {/* Bolt recesses matching the 3 bolt positions */}
                {[56, 170, 284].map(top => (
                  <div key={top} style={{
                    position: "absolute", right: 20, top,
                    width: 24, height: 18, borderRadius: 4,
                    background: "radial-gradient(ellipse at 38% 38%, #161a20, #0c0e12)",
                    boxShadow: "inset 0 2px 6px rgba(0,0,0,0.8), inset 0 0 0 1px rgba(255,255,255,0.035)",
                  }} />
                ))}
                {/* Corner screws */}
                {[[20,20],[20,350],[350,20],[350,350]].map(([t,l],i) => (
                  <div key={i} style={{
                    position: "absolute", top: t, left: l,
                    width: 10, height: 10, borderRadius: "50%",
                    background: "radial-gradient(circle at 36% 32%, #666, #2a2e34)",
                    boxShadow: "inset 0 1px 3px rgba(0,0,0,0.7)",
                  }}>
                    <div style={{ position: "absolute", top: "50%", left: 2, right: 2, height: 1.5, background: "rgba(0,0,0,0.5)", transform: "translateY(-50%)" }} />
                  </div>
                ))}
                {/* Manufacturer stamp */}
                <div style={{
                  position: "absolute", bottom: 22, left: "50%", transform: "translateX(-50%)",
                  background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.05)",
                  borderRadius: 3, padding: "3px 12px", whiteSpace: "nowrap",
                }}>
                  <span style={{ fontSize: 7, letterSpacing: "0.18em", color: "rgba(255,255,255,0.18)", fontFamily: "monospace" }}>VAULT-X · 55KG STEEL DOOR</span>
                </div>
              </div>{/* end BACK FACE */}

              </div>{/* end preserve-3d pivot */}
              </div>{/* end perspective wrapper */}

              {/* ── Right-side hinges (on casing) ── */}
              {[50, 280].map(top => (
                <div key={top} style={{
                  position: "absolute", right: 0, top, zIndex: 10,
                  width: 22, height: 54,
                  background: "linear-gradient(270deg, #1e2226, #9a9ea6 48%, #6a6e74)",
                  borderRadius: "6px 0 0 6px",
                  boxShadow: "-3px 0 10px rgba(0,0,0,0.65), inset -1px 0 0 rgba(255,255,255,0.1)",
                  pointerEvents: "none",
                }}>
                  {/* Hinge pin */}
                  <div style={{
                    position: "absolute", top: "50%", left: "50%",
                    transform: "translate(-50%,-50%)",
                    width: 11, height: 11, borderRadius: "50%",
                    background: "radial-gradient(circle at 35% 30%, #d4d8de, #555)",
                    boxShadow: "inset 0 1px 3px rgba(0,0,0,0.5), 0 1px 2px rgba(255,255,255,0.15)",
                  }}>
                    <div style={{ position: "absolute", top: "50%", left: 2, right: 2, height: 1.5, background: "rgba(0,0,0,0.4)", transform: "translateY(-50%)" }} />
                  </div>
                  {/* Hinge top/bottom grooves */}
                  <div style={{ position: "absolute", top: 4, left: 3, right: 3, height: 1, background: "rgba(0,0,0,0.3)" }} />
                  <div style={{ position: "absolute", bottom: 4, left: 3, right: 3, height: 1, background: "rgba(0,0,0,0.3)" }} />
                </div>
              ))}

              {/* ── Rubber feet with floor shadow ── */}
              {[28, 332].map(left => (
                <div key={left} style={{ position: "absolute", bottom: 0, left, pointerEvents: "none" }}>
                  <div style={{
                    width: 34, height: 14,
                    borderRadius: "0 0 8px 8px",
                    background: "linear-gradient(180deg, #2a2a2a, #141414)",
                    boxShadow: "0 5px 10px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)",
                  }} />
                  {/* Foot shadow on floor */}
                  <div style={{
                    position: "absolute", bottom: -6, left: "50%",
                    transform: "translateX(-50%)",
                    width: 30, height: 6,
                    borderRadius: "50%",
                    background: "rgba(0,0,0,0.35)",
                    filter: "blur(3px)",
                  }} />
                </div>
              ))}

              {/* ── Full ground shadow beneath whole safe ── */}
              <div style={{
                position: "absolute", bottom: -10, left: "10%", right: "10%",
                height: 18, borderRadius: "50%",
                background: "rgba(0,0,0,0.45)",
                filter: "blur(10px)",
                pointerEvents: "none", zIndex: 0,
              }} />
            </div>
            </div>
            </div>
          )}
        </div>

        {/* ── Clue ──────────────────────────────────────────────────── */}
        {clue && (
          <div className="mb-5 p-3 rounded-xl text-sm text-center"
        style={{ background: skin.boardBg, border: `1px solid ${skin.boardBorder}`, color: skin.tileText }}>
            {clue}
          </div>
        )}

        {/* ── Stats row ─────────────────────────────────────────────── */}
        <div className="flex justify-between items-center mb-4 px-1">
          <span className="text-xs font-mono" style={{ color: "#555" }}>
            {digits}-digit combination
          </span>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowHelp(true)} className="text-xs font-semibold px-2.5 py-1 rounded-lg transition-all hover:opacity-80" style={{ background: "rgba(253,231,76,0.08)", border: "1px solid rgba(253,231,76,0.3)", color: "#FDE74C" }}>? How to play</button>
            <span className="text-xs font-bold"
                  style={{ color: attemptsLeft <= 2 ? "#ef4444" : attemptsLeft <= 4 ? "#FDE74C" : "#888" }}>
              {isPlaying ? `${attemptsLeft} attempt${attemptsLeft === 1 ? "" : "s"} left` : ""}
            </span>
          </div>
        </div>

        {/* ── Digit inputs (image-safe mode only — CSS safe has inputs on door) ── */}
        {safeImageUrl && isPlaying && (
          <div className="flex justify-center gap-2 mb-4">
            {curr.map((d, i) => (
              <input
                key={i}
                ref={(el) => { inputRefs.current[i] = el; }}
                type="tel"
                inputMode="numeric"
                maxLength={1}
                value={d}
                onChange={(e) => handleDigitChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                onFocus={(e) => e.target.select()}
                className="text-center font-black text-xl rounded-lg transition-all"
                style={{
                  width: `clamp(38px, ${100 / digits - 2}vw, 52px)`,
                  height: `clamp(48px, ${100 / digits - 2}vw, 62px)`,
                  background: d ? skin.inputBg : "#111",
                  border: d ? `2px solid ${skin.inputBorder}` : "2px solid #333",
                  color: d ? "#FFF" : "#444",
                  outline: "none",
                  caretColor: "transparent",
                }}
              />
            ))}
          </div>
        )}

        {/* ── Error ─────────────────────────────────────────────────── */}
        {error && (
          <p className="text-center text-xs mb-3 safe-fadein" style={{ color: "#ef4444" }}>{error}</p>
        )}

        {/* ── Submit button (image-safe mode only) ── */}
        {safeImageUrl && isPlaying && (
          <button
            onClick={submit}
            disabled={submitting || curr.some((d) => d === "")}
            className="w-full py-3 rounded-xl font-black text-sm tracking-widest transition-opacity hover:opacity-80 disabled:opacity-40 mb-6"
            style={{ background: skin.btnBg, color: skin.btnText }}
          >
            {submitting ? "CHECKING…" : `🔐 TRY COMBINATION`}
          </button>
        )}

        {/* ── Guess history ──────────────────────────────────────────── */}
        {history.length > 0 && (
          <div className="space-y-2 mb-4">
            <p className="text-xs font-bold tracking-widest mb-2" style={{ color: "#555" }}>ATTEMPTS</p>
            {history.map((r, i) => (
              <div
                key={i}
                className="safe-fadein flex items-center gap-3 px-3 py-2 rounded-lg"
                style={{
                  background: r.correct ? "rgba(56,211,153,0.1)" : "rgba(255,255,255,0.03)",
                  border: r.correct ? "1px solid rgba(56,211,153,0.3)" : "1px solid #1C1C1C",
                }}
              >
                {/* Attempt number */}
                <span className="text-xs w-5 text-center font-mono" style={{ color: "#444" }}>
                  {i + 1}
                </span>

                {/* Guess digits with per-position color feedback */}
                <div className="flex gap-1">
                  {r.guess.split("").map((d, di) => {
                    const hint = r.hints?.[di] ?? "gray";
                    const bg = hint === "green" ? "rgba(56,211,153,0.25)" : hint === "yellow" ? "rgba(253,231,76,0.2)" : "#1A1A1A";
                    const border = hint === "green" ? "2px solid #38D399" : hint === "yellow" ? "2px solid #FDE74C" : "1px solid #2A2A2A";
                    const color = hint === "green" ? "#38D399" : hint === "yellow" ? "#FDE74C" : "#EEE";
                    return (
                      <span
                        key={di}
                        className="flex items-center justify-center font-black text-sm rounded"
                        style={{ width: 26, height: 28, background: bg, border, color }}
                        title={hint === "green" ? "Correct digit & position" : hint === "yellow" ? "Right digit, wrong position" : "Not in code"}
                      >
                        {d}
                      </span>
                    );
                  })}
                </div>

                {/* Bulls/cows summary (counts only, for reference) */}
                <div className="flex items-center gap-1 ml-auto shrink-0 text-xs font-mono" style={{ color: "#555" }}>
                  <span style={{ color: "#38D399" }}>{r.bulls}🟢</span>
                  <span style={{ color: "#FDE74C" }}>{r.cows}🟡</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Legend ────────────────────────────────────────────────── */}
        {history.length > 0 && isPlaying && (
          <div className="flex justify-center gap-5 mt-2 mb-4">
            {[
              { bg: "rgba(56,211,153,0.25)", border: "2px solid #38D399", color: "#38D399", label: "Right digit + position" },
              { bg: "rgba(253,231,76,0.2)",  border: "2px solid #FDE74C", color: "#FDE74C", label: "Right digit, wrong spot" },
              { bg: "#1A1A1A",               border: "1px solid #2A2A2A", color: "#EEE",    label: "Not in code" },
            ].map(({ bg, border, color, label }) => (
              <div key={label} className="flex items-center gap-1.5">
                <span style={{ display: "inline-block", width: 18, height: 22, borderRadius: 4, background: bg, border, color, fontSize: 11, textAlign: "center", lineHeight: "22px", fontWeight: 900 }}>1</span>
                <span className="text-xs" style={{ color: "#666" }}>{label}</span>
              </div>
            ))}
          </div>
        )}

        {/* ── Game over: lost ────────────────────────────────────────── */}
        {status === "lost" && (
          <div className="p-5 rounded-xl text-center safe-fadein"
               style={{ border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.06)" }}>
            <p className="text-lg font-black mb-1" style={{ color: "#ef4444" }}>Safe Locked 🔒</p>
            <p className="text-sm" style={{ color: "#888" }}>
              You&apos;ve used all {maxAttempts} guesses.
            </p>
            {failedAttempts < MAX_PUZZLE_ATTEMPTS && (
              <>
                <p className="text-sm mt-1" style={{ color: "#9ca3af" }}>
                  {MAX_PUZZLE_ATTEMPTS - failedAttempts} game{MAX_PUZZLE_ATTEMPTS - failedAttempts !== 1 ? "s" : ""} remaining
                </p>
                <button
                  onClick={resetForNewAttempt}
                  className="mt-3 px-5 py-2 rounded-xl font-black text-sm tracking-wider transition-all hover:scale-105 active:scale-95"
                  style={{ background: "#FDE74C", color: "#020202" }}
                >
                  TRY AGAIN
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Surprise modal ─────────────────────────────────────────────── */}
      {showSurprise && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: "rgba(0,0,0,0.85)" }}
          onClick={() => setShowSurprise(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl p-8 text-center safe-fadein safe-pop"
            style={{
              background: "linear-gradient(145deg, #071016, #0a2b22)",
              border: "2px solid #38D399",
              boxShadow: "0 0 60px rgba(56,211,153,0.3)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-5xl mb-4">🔓</div>
            <h2 className="text-2xl font-black mb-3" style={{ color: "#38D399" }}>
              Safe Cracked!
            </h2>
            <p className="text-base leading-relaxed mb-6" style={{ color: "#DDD" }}>
              {surpriseMessage}
            </p>
            <p className="text-xs mb-6" style={{ color: "#555" }}>
              Solved in {history.length} attempt{history.length === 1 ? "" : "s"}
            </p>
            <button
              onClick={() => setShowSurprise(false)}
              className="px-6 py-2.5 rounded-xl font-bold text-sm hover:opacity-80 transition-opacity"
              style={{ background: "#38D399", color: "#020202" }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
