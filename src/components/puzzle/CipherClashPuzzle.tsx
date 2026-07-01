"use client";

import { useState, useEffect, useCallback, useRef } from "react";

/* ── Types ──────────────────────────────────────────────────────────── */

interface CipherClashData {
  phrases: string[];
  revealedLetters?: number;
  roundTimeSec?: number;
  comboMultiplier?: number;
}

interface CipherClashPuzzleProps {
  puzzleId: string;
  cipherClashData: Record<string, unknown>;
  alreadySolved: boolean;
  onSolved: () => void;
}

/* ── Cipher engine (Caesar shift) ───────────────────────────────────── */

const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function generateShift(): number {
  // Random shift between 1 and 25 (never 0)
  return 1 + Math.floor(Math.random() * 25);
}

function buildCipherMap(shift: number): Record<string, string> {
  const map: Record<string, string> = {};
  for (let i = 0; i < 26; i++) {
    map[ALPHA[i]] = ALPHA[(i + shift) % 26];
  }
  return map;
}

function encodePhrase(phrase: string, cipherMap: Record<string, string>): string {
  return phrase
    .toUpperCase()
    .split("")
    .map((ch) => (cipherMap[ch] ? cipherMap[ch] : ch))
    .join("");
}

/* ── Pre-reveal some letters based on difficulty ───────────────────── */

function getPreRevealedMappings(
  cipherMap: Record<string, string>,
  phrases: string[],
  count: number
): Record<string, string> {
  if (count <= 0) return {};
  const allLetters = new Set<string>();
  phrases.forEach((p) =>
    p.toUpperCase().split("").forEach((ch) => {
      if (/[A-Z]/.test(ch)) allLetters.add(ch);
    })
  );
  const letters = [...allLetters];
  // Pick random letters to reveal
  const shuffled = letters.sort(() => Math.random() - 0.5);
  const toReveal = shuffled.slice(0, Math.min(count, shuffled.length));
  const revealed: Record<string, string> = {};
  toReveal.forEach((plain) => {
    revealed[cipherMap[plain]] = plain;
  });
  return revealed;
}

/* ── Main component ─────────────────────────────────────────────────── */

export default function CipherClashPuzzle({
  puzzleId,
  cipherClashData,
  alreadySolved,
  onSolved,
}: CipherClashPuzzleProps) {
  const data = cipherClashData as unknown as CipherClashData;
  const phrases = data.phrases ?? [];
  const revealedCount = data.revealedLetters ?? 3;
  const roundTime = data.roundTimeSec ?? 180;
  const comboMultiplier = data.comboMultiplier ?? 1.5;

  const [shift, setShift] = useState(0);
  const [cipherMap, setCipherMap] = useState<Record<string, string>>({});
  const [claimedMappings, setClaimedMappings] = useState<Record<string, string>>({});
  const [currentPhraseIdx, setCurrentPhraseIdx] = useState(0);
  const [guess, setGuess] = useState("");
  const [timeLeft, setTimeLeft] = useState(roundTime);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [gameState, setGameState] = useState<"ready" | "playing" | "won" | "lost">("ready");
  const [feedback, setFeedback] = useState<{ type: "correct" | "wrong" | ""; text: string }>({ type: "", text: "" });
  const [solvedPhrases, setSolvedPhrases] = useState<Set<number>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Init cipher on mount
  useEffect(() => {
    const s = generateShift();
    setShift(s);
    const map = buildCipherMap(s);
    setCipherMap(map);
    const preRevealed = getPreRevealedMappings(map, phrases, revealedCount);
    setClaimedMappings(preRevealed);
  }, []);

  // Timer
  useEffect(() => {
    if (gameState !== "playing") return;
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          setGameState("lost");
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameState]);

  const currentPhrase = phrases[currentPhraseIdx] ?? "";
  const encodedPhrase = encodePhrase(currentPhrase, cipherMap);

  // Build display: for each cipher letter, show the revealed plaintext or a blank
  const displayChars = encodedPhrase.split("").map((ch, i) => {
    if (!/[A-Z]/.test(ch)) return { cipher: ch, plain: ch, revealed: true, space: ch === " " };
    const plain = claimedMappings[ch];
    return { cipher: ch, plain: plain ?? "_", revealed: !!plain, space: false };
  });

  function startGame() {
    setGameState("playing");
    setTimeLeft(roundTime);
    setScore(0);
    setCombo(0);
    setSolvedPhrases(new Set());
    setCurrentPhraseIdx(0);
    setGuess("");
    setFeedback({ type: "", text: "" });
    const s = generateShift();
    setShift(s);
    const map = buildCipherMap(s);
    setCipherMap(map);
    setClaimedMappings(getPreRevealedMappings(map, phrases, revealedCount));
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  const submitGuess = useCallback(() => {
    if (gameState !== "playing" || !guess.trim()) return;
    const normalized = guess.trim().toUpperCase();
    const target = currentPhrase.toUpperCase();

    if (normalized === target) {
      // Correct! Claim all new letter mappings from this phrase
      const newMappings = { ...claimedMappings };
      let newClaimCount = 0;
      target.split("").forEach((plainChar) => {
        if (/[A-Z]/.test(plainChar)) {
          const cipherChar = cipherMap[plainChar];
          if (!newMappings[cipherChar]) {
            newMappings[cipherChar] = plainChar;
            newClaimCount++;
          }
        }
      });
      setClaimedMappings(newMappings);

      const newCombo = combo + 1;
      setCombo(newCombo);
      const basePoints = 100 + newClaimCount * 25;
      const comboBonus = newCombo > 1 ? Math.floor(basePoints * (comboMultiplier - 1)) : 0;
      const timeBonus = Math.floor(timeLeft * 2);
      const totalPoints = basePoints + comboBonus + timeBonus;
      setScore((s) => s + totalPoints);

      const newSolved = new Set(solvedPhrases);
      newSolved.add(currentPhraseIdx);
      setSolvedPhrases(newSolved);

      setFeedback({
        type: "correct",
        text: `+${totalPoints} pts${newCombo > 1 ? ` (${newCombo}x combo!)` : ""}${newClaimCount > 0 ? ` · ${newClaimCount} new mapping${newClaimCount !== 1 ? "s" : ""} claimed` : ""}`,
      });

      if (newSolved.size === phrases.length) {
        setGameState("won");
        if (timerRef.current) clearInterval(timerRef.current);
        onSolved();
      } else {
        // Advance to next unsolved phrase
        let next = (currentPhraseIdx + 1) % phrases.length;
        while (newSolved.has(next)) next = (next + 1) % phrases.length;
        setCurrentPhraseIdx(next);
      }
    } else {
      setCombo(0);
      setFeedback({ type: "wrong", text: "Incorrect — combo reset!" });
    }
    setGuess("");
    setTimeout(() => setFeedback({ type: "", text: "" }), 2500);
  }, [gameState, guess, currentPhrase, claimedMappings, cipherMap, combo, comboMultiplier, timeLeft, solvedPhrases, currentPhraseIdx, phrases, onSolved]);

  function skipPhrase() {
    if (gameState !== "playing") return;
    setCombo(0);
    let next = (currentPhraseIdx + 1) % phrases.length;
    let tries = 0;
    while (solvedPhrases.has(next) && tries < phrases.length) {
      next = (next + 1) % phrases.length;
      tries++;
    }
    setCurrentPhraseIdx(next);
    setGuess("");
    setFeedback({ type: "", text: "" });
  }

  const formatTime = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  const timerColor =
    timeLeft > 60 ? "#10b981" : timeLeft > 30 ? "#f59e0b" : "#ef4444";

  // Count claimed vs total unique letters
  const allCipherLetters = new Set<string>();
  phrases.forEach((p) =>
    p.toUpperCase().split("").forEach((ch) => {
      if (/[A-Z]/.test(ch)) allCipherLetters.add(cipherMap[ch]);
    })
  );
  const claimedCount = Object.keys(claimedMappings).length;
  const totalUniqueLetters = allCipherLetters.size;

  if (alreadySolved) {
    return (
      <div
        className="mb-6 p-4 rounded-lg border text-white"
        style={{ backgroundColor: "rgba(56, 211, 153, 0.1)", borderColor: "#38D399" }}
      >
        🔓 You already cracked this cipher!
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto">
      {/* Header bar */}
      <div
        className="flex items-center justify-between px-5 py-3 rounded-t-xl"
        style={{ background: "rgba(56,145,166,0.1)", border: "1px solid rgba(56,145,166,0.25)" }}
      >
        <div className="flex items-center gap-4">
          <span className="text-2xl">🔐</span>
          <div>
            <p className="text-xs font-bold tracking-widest uppercase" style={{ color: "#3891A6" }}>
              Cipher Clash
            </p>
            <p className="text-xs" style={{ color: "#6b7280" }}>
              Decode the phrases · Claim the mappings
            </p>
          </div>
        </div>
        {gameState === "playing" && (
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs" style={{ color: "#6b7280" }}>Score</p>
              <p className="text-lg font-black text-white">{score.toLocaleString()}</p>
            </div>
            <div className="text-right">
              <p className="text-xs" style={{ color: "#6b7280" }}>Time</p>
              <p className="text-lg font-black" style={{ color: timerColor }}>
                {formatTime(timeLeft)}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Game area */}
      <div
        className="px-5 py-6 rounded-b-xl"
        style={{
          background: "linear-gradient(160deg, rgba(7,15,18,0.95) 0%, rgba(4,8,10,0.9) 100%)",
          border: "1px solid rgba(56,145,166,0.15)",
          borderTop: "none",
        }}
      >
        {gameState === "ready" && (
          <div className="text-center py-8">
            <h3 className="text-xl font-black text-white mb-3">Ready to Clash?</h3>
            <p className="text-sm mb-2" style={{ color: "#9ca3af" }}>
              Each phrase is encoded with a Caesar shift — every letter is shifted
              forward by the same number of positions in the alphabet. Figure out the shift
              from the revealed letters, then decode every phrase.
            </p>
            <p className="text-sm mb-6" style={{ color: "#6b7280" }}>
              {phrases.length} phrase{phrases.length !== 1 ? "s" : ""} · {formatTime(roundTime)} on the clock · {revealedCount} letters pre-revealed
            </p>
            <button
              onClick={startGame}
              className="px-8 py-3 rounded-xl text-sm font-bold uppercase tracking-wider transition-all hover:brightness-110"
              style={{
                background: "linear-gradient(135deg, #3891A6, #2d7a8e)",
                color: "#fff",
                border: "1px solid rgba(56,145,166,0.5)",
                boxShadow: "0 4px 20px rgba(56,145,166,0.35)",
              }}
            >
              Start Decoding
            </button>
          </div>
        )}

        {gameState === "playing" && (
          <>
            {/* Progress row */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold" style={{ color: "#3891A6" }}>
                  Phrase {solvedPhrases.size + 1} of {phrases.length}
                </span>
                {combo > 1 && (
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded-full"
                    style={{ background: "rgba(253,231,76,0.15)", color: "#FDE74C", border: "1px solid rgba(253,231,76,0.3)" }}
                  >
                    {combo}x Combo
                  </span>
                )}
              </div>
              <span className="text-xs" style={{ color: "#6b7280" }}>
                {claimedCount}/{totalUniqueLetters} mappings claimed
              </span>
            </div>

            {/* Mapping progress bar */}
            <div className="h-1.5 rounded-full overflow-hidden mb-5" style={{ background: "rgba(56,145,166,0.12)" }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${totalUniqueLetters > 0 ? (claimedCount / totalUniqueLetters) * 100 : 0}%`,
                  background: "linear-gradient(90deg, #3891A6, #60a5fa)",
                }}
              />
            </div>

            {/* Cipher display */}
            <div
              className="p-5 rounded-xl mb-4"
              style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold tracking-widest uppercase" style={{ color: "#6b7280" }}>
                  Ciphertext
                </p>
                <p className="text-xs font-mono" style={{ color: "#f59e0b" }}>
                  Shift: every letter moved +N positions in the alphabet
                </p>
              </div>
              <div className="flex flex-wrap gap-1 mb-4 font-mono">
                {displayChars.map((ch, i) =>
                  ch.space ? (
                    <span key={i} className="w-4" />
                  ) : (
                    <span
                      key={i}
                      className="inline-flex flex-col items-center"
                      style={{ minWidth: 24 }}
                    >
                      <span
                        className="text-lg font-bold"
                        style={{ color: ch.revealed ? "#10b981" : "#f59e0b" }}
                      >
                        {ch.cipher}
                      </span>
                      <span
                        className="text-xs mt-0.5"
                        style={{
                          color: ch.revealed ? "#10b981" : "rgba(255,255,255,0.15)",
                          borderBottom: ch.revealed ? "none" : "1px solid rgba(255,255,255,0.2)",
                          minWidth: 12,
                          textAlign: "center",
                        }}
                      >
                        {ch.plain}
                      </span>
                    </span>
                  )
                )}
              </div>

              {/* Claimed mappings reference */}
              <div className="flex flex-wrap gap-1.5 mt-3 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <span className="text-xs mr-1" style={{ color: "#6b7280" }}>Key:</span>
                {Object.entries(claimedMappings)
                  .sort((a, b) => a[1].localeCompare(b[1]))
                  .map(([cipher, plain]) => (
                    <span
                      key={cipher}
                      className="text-xs font-mono px-1.5 py-0.5 rounded"
                      style={{
                        background: "rgba(16,185,129,0.1)",
                        border: "1px solid rgba(16,185,129,0.25)",
                        color: "#10b981",
                      }}
                    >
                      {cipher}={plain}
                    </span>
                  ))}
              </div>
            </div>

            {/* Input */}
            <div className="flex gap-2 mb-3">
              <input
                ref={inputRef}
                type="text"
                value={guess}
                onChange={(e) => setGuess(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitGuess()}
                placeholder="Type the decoded phrase..."
                className="flex-1 px-4 py-3 rounded-xl text-white placeholder-gray-600 font-mono"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  outline: "none",
                }}
                autoComplete="off"
                spellCheck={false}
              />
              <button
                onClick={submitGuess}
                className="px-5 py-3 rounded-xl text-sm font-bold uppercase tracking-wider transition-all hover:brightness-110"
                style={{
                  background: "linear-gradient(135deg, #3891A6, #2d7a8e)",
                  color: "#fff",
                  border: "1px solid rgba(56,145,166,0.5)",
                }}
              >
                Decode
              </button>
              <button
                onClick={skipPhrase}
                className="px-4 py-3 rounded-xl text-sm font-semibold transition-all"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  color: "#6b7280",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                Skip
              </button>
            </div>

            {/* Feedback */}
            {feedback.text && (
              <div
                className="px-4 py-2 rounded-lg text-sm font-semibold text-center"
                style={{
                  background:
                    feedback.type === "correct"
                      ? "rgba(16,185,129,0.1)"
                      : "rgba(239,68,68,0.1)",
                  border: `1px solid ${feedback.type === "correct" ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`,
                  color: feedback.type === "correct" ? "#10b981" : "#ef4444",
                }}
              >
                {feedback.text}
              </div>
            )}
          </>
        )}

        {(gameState === "won" || gameState === "lost") && (
          <div className="text-center py-8">
            <div
              className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center text-3xl"
              style={{
                background: gameState === "won"
                  ? "linear-gradient(135deg, rgba(16,185,129,0.25), rgba(16,185,129,0.08))"
                  : "linear-gradient(135deg, rgba(239,68,68,0.25), rgba(239,68,68,0.08))",
                border: `1.5px solid ${gameState === "won" ? "rgba(16,185,129,0.5)" : "rgba(239,68,68,0.5)"}`,
              }}
            >
              {gameState === "won" ? "🏆" : "⏱️"}
            </div>
            <h3 className="text-xl font-black text-white mb-2">
              {gameState === "won" ? "Cipher Cracked!" : "Time's Up!"}
            </h3>
            <p className="text-sm mb-1" style={{ color: "#9ca3af" }}>
              {gameState === "won"
                ? `You decoded all ${phrases.length} phrases!`
                : `You decoded ${solvedPhrases.size} of ${phrases.length} phrases.`}
            </p>
            <p className="text-2xl font-black mb-6" style={{ color: "#FDE74C" }}>
              {score.toLocaleString()} pts
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={startGame}
                className="px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-wider transition-all hover:brightness-110"
                style={{
                  background: "linear-gradient(135deg, #3891A6, #2d7a8e)",
                  color: "#fff",
                  border: "1px solid rgba(56,145,166,0.5)",
                  boxShadow: "0 4px 20px rgba(56,145,166,0.35)",
                }}
              >
                Play Again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
