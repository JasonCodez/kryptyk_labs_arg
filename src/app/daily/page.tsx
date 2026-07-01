"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Navbar from "@/components/Navbar";
import DailyWordScrySharePanel from "@/components/daily/DailyWordScrySharePanel";
import GuestRewardModal from "@/components/puzzle/GuestRewardModal";
import StreakTimer from "@/components/StreakTimer";
import WordCrackPuzzle from "@/components/puzzle/WordCrackPuzzle";
import { addPendingRewards, getAnonId } from "@/lib/gridlockAnon";
import {
  isSolvedWordScryResult,
  parseStoredWordScryState,
  scoreWordScryGuess,
  serializeWordScryState,
  type WordScryGameStatus,
  type WordScryGuessResult,
} from "@/lib/wordScry";

const MAX_ROWS = 6;
const WIN_MSGS = ["⚡ LEGENDARY!", "🔮 SHARP EYE!", "💥 IMPRESSIVE!", "👏 NICE WORK!", "😅 JUST MADE IT!", "😤 BY A THREAD!"];

type DailyWordResponse = {
  word: string;
  number: number;
  date: string;
};

type DailyReward = {
  points: number;
  xp: number;
  streakDay: number;
};

function getCountdown(): string {
  const now = new Date();
  const next = new Date();
  next.setUTCHours(24, 0, 0, 0);
  const diff = Math.max(0, next.getTime() - now.getTime());
  const hh = String(Math.floor(diff / 3_600_000)).padStart(2, "0");
  const mm = String(Math.floor((diff % 3_600_000) / 60_000)).padStart(2, "0");
  const ss = String(Math.floor((diff % 60_000) / 1_000)).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export default function DailyPage() {
  const { data: session, status: sessionStatus } = useSession();
  const isAuthenticated = sessionStatus === "authenticated";
  const sessionUid = session?.user?.email ?? session?.user?.name ?? "";
  const dateKey = new Date().toISOString().slice(0, 10);
  const storeKey = sessionUid ? `pw_daily_${dateKey}_${sessionUid}` : `pw_daily_${dateKey}`;

  const [word, setWord] = useState("");
  const [dayNum, setDayNum] = useState(0);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState("00:00:00");
  const [message, setMessage] = useState("");
  const [guessResults, setGuessResults] = useState<WordScryGuessResult[][]>([]);
  const [gameStatus, setGameStatus] = useState<WordScryGameStatus>("playing");
  const [guestReward, setGuestReward] = useState<DailyReward | null>(null);
  const [dailyStreak, setDailyStreak] = useState(0);
  const [skipTokens, setSkipTokens] = useState(0);
  const [shieldNotice, setShieldNotice] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [streakDay, setStreakDay] = useState(1);
  const [nextReward, setNextReward] = useState<{ points: number; xp: number } | null>(null);
  const [earnedReward, setEarnedReward] = useState<DailyReward | null>(null);
  const [showRewardModal, setShowRewardModal] = useState(false);
  const [showUpgradeOffer, setShowUpgradeOffer] = useState(false);
  const [serverGuessCount, setServerGuessCount] = useState<number | null>(null);

  useEffect(() => {
    setCountdown(getCountdown());
    const id = window.setInterval(() => setCountdown(getCountdown()), 1_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!message) return undefined;
    const id = window.setTimeout(() => setMessage(""), 2_500);
    return () => window.clearTimeout(id);
  }, [message]);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setEarnedReward(null);
    setShowRewardModal(false);

    const anonId = getAnonId();
    Promise.all([
      fetch("/api/daily/word").then((response) => (response.ok ? response.json() as Promise<DailyWordResponse> : null)),
      fetch("/api/daily/complete").then((response) => (response.ok ? response.json() : null)).catch(() => null),
      fetch(`/api/daily/guest-complete?anonId=${encodeURIComponent(anonId)}`).then((response) => (response.ok ? response.json() : null)).catch(() => null),
    ])
      .then(([wordData, completeData, guestData]) => {
        if (cancelled || !wordData) return;

        setWord(wordData.word.toUpperCase());
        setDayNum(wordData.number);

        const saved = parseStoredWordScryState(localStorage.getItem(storeKey), wordData.word);
        const serverCompleted = completeData?.completedToday || guestData?.completedToday;
        const serverRecord = completeData?.todayRecord ?? guestData?.todayRecord;

        if (serverCompleted && serverRecord) {
          const serverStatus: WordScryGameStatus = serverRecord.won ? "won" : "lost";
          const resolvedGuesses = saved?.guessResults ?? [];
          setGuessResults(resolvedGuesses);
          setGameStatus(serverStatus);
          if (resolvedGuesses.length === 0 && serverRecord.guesses) {
            setServerGuessCount(serverRecord.guesses);
          }
          if (!saved || saved.status === "playing") {
            localStorage.setItem(storeKey, serializeWordScryState(resolvedGuesses, serverStatus));
          }
        } else {
          setGuessResults(saved?.guessResults ?? []);
          setGameStatus(saved?.status ?? "playing");
        }

        setDailyStreak(completeData?.streak ?? 0);
        setSkipTokens(completeData?.skipTokens ?? 0);
        setStreakDay(completeData?.streakDay ?? 1);
        setNextReward(completeData?.nextReward ?? null);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [storeKey]);

  const saveState = useCallback((results: WordScryGuessResult[][], status: WordScryGameStatus) => {
    localStorage.setItem(storeKey, serializeWordScryState(results, status));
  }, [storeKey]);

  const flash = useCallback((text: string) => {
    setMessage(text);
  }, []);

  const recordAuthenticatedCompletion = useCallback((won: boolean, guesses: number) => {
    fetch("/api/daily/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ won, guesses }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.shieldUsed) setShieldNotice(true);
        if (data.reward) {
          setEarnedReward(data.reward);
          setShowRewardModal(true);
        }
        if (data.showUpgradeOffer) setShowUpgradeOffer(true);
        return fetch("/api/daily/complete");
      })
      .then((response) => (response && response.ok ? response.json() : null))
      .then((data) => {
        if (!data) return;
        setDailyStreak(data.streak ?? 0);
        setStreakDay(data.streakDay ?? 1);
        setNextReward(data.nextReward ?? null);
      })
      .catch(() => undefined);
  }, []);

  const recordGuestCompletion = useCallback(async (guesses: number) => {
    try {
      const response = await fetch("/api/daily/guest-complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anonId: getAnonId(), guesses }),
      });

      const data = await response.json();
      if (!response.ok || !data?.reward) {
        flash(data?.error || "Solved. Create an account to save the run.");
        return;
      }

      addPendingRewards(data.reward.xp, data.reward.points);
      setGuestReward(data.reward as DailyReward);
    } catch {
      flash("Solved. Create an account to lock in the reward and streak.");
    }
  }, [flash]);

  const handleSkip = useCallback(async () => {
    if (skipping || skipTokens < 1 || gameStatus !== "playing") return;

    setSkipping(true);
    try {
      const response = await fetch("/api/daily/skip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });

      if (!response.ok) {
        const data = await response.json();
        flash(data.error || "Failed to skip");
        return;
      }

      setSkipTokens((current) => current - 1);
      setGameStatus("lost");
      saveState(guessResults, "lost");
      flash("Today's puzzle skipped! Streak preserved. 🛡️");

      const refreshed = await fetch("/api/daily/complete");
      if (!refreshed.ok) return;
      const data = await refreshed.json();
      setDailyStreak(data.streak ?? 0);
    } catch {
      flash("Failed to skip puzzle");
    } finally {
      setSkipping(false);
    }
  }, [flash, gameStatus, guessResults, saveState, skipTokens, skipping]);

  const handleStateChange = useCallback((payload: { guesses: WordScryGuessResult[][]; status: WordScryGameStatus }) => {
    setGuessResults(payload.guesses);
    setGameStatus(payload.status);
    saveState(payload.guesses, payload.status);
  }, [saveState]);

  return (
    <div style={{ backgroundColor: "#020202", minHeight: "100vh" }}>
      <Navbar />

      <main className="pt-24 pb-16 flex flex-col items-center px-3">
        <div className="w-full max-w-3xl mt-6 mb-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold tracking-[0.18em] uppercase" style={{ color: "#3891A6" }}>Daily Hidden Word</p>
            <div className="flex items-center gap-3 flex-wrap mt-1">
              <span className="text-white text-2xl font-black tracking-[0.18em]">#{dayNum || "---"}</span>
              <span className="text-xs font-mono" style={{ color: "#FDE74C" }}>Resets in {countdown}</span>
            </div>
          </div>

          {dailyStreak > 0 && (
            <StreakTimer streak={dailyStreak} solvedToday={gameStatus !== "playing"} size="sm" />
          )}
        </div>

        {gameStatus === "playing" && nextReward && (
          <div className="w-full max-w-3xl mb-4 rounded-xl border px-4 py-3"
               style={{ background: "rgba(56,145,166,0.08)", borderColor: "rgba(56,145,166,0.25)", color: "#DDDBF1" }}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm">Win today to extend your streak track.</span>
              <span className="text-xs font-semibold tracking-[0.12em] uppercase" style={{ color: "#38D399" }}>
                Day {streakDay} reward: +{nextReward.points} pts · +{nextReward.xp} xp
              </span>
            </div>
          </div>
        )}

        {message && (
          <div className="mb-3 px-5 py-2 rounded-xl font-bold text-sm"
               style={{ background: "#FFF", color: "#020202", boxShadow: "0 4px 24px rgba(0,0,0,0.6)" }}>
            {message}
          </div>
        )}

        {shieldNotice && (
          <div className="mb-3 px-5 py-2 rounded-xl font-bold text-sm flex items-center gap-2"
               style={{ background: "rgba(56,145,166,0.15)", border: "1px solid #3891A6", color: "#3891A6" }}>
            🛡️ Streak shield used! Your streak was protected.
            <button onClick={() => setShieldNotice(false)} className="ml-auto text-xs opacity-60 hover:opacity-100">✕</button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 mt-20" style={{ color: "#3891A6" }}>
            <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Loading today's puzzle…</span>
          </div>
        ) : (
          <>
            <div className="w-full max-w-3xl">
              <WordCrackPuzzle
                key={`${storeKey}:${dayNum}`}
                puzzleId={`daily-${dayNum}`}
                wordCrackData={{ wordLength: word.length || 5, maxGuesses: MAX_ROWS }}
                alreadySolved={gameStatus === "won"}
                initialGuesses={guessResults}
                initialStatus={gameStatus}
                showHints={false}
                disableRetry
                recordGameLossOnFailure={false}
                solvedGuessCount={serverGuessCount ?? undefined}
                submitGuessRequest={async (guess) => {
                  const result = scoreWordScryGuess(guess, word);
                  return { result, solved: isSolvedWordScryResult(result) };
                }}
                onStateChange={handleStateChange}
                onRoundComplete={({ status, guesses }) => {
                  if (isAuthenticated) {
                    recordAuthenticatedCompletion(status === "won", guesses);
                    return;
                  }

                  if (status === "won") {
                    void recordGuestCompletion(guesses);
                  }
                }}
              />
            </div>

            {gameStatus === "playing" && skipTokens > 0 && (
              <div className="mt-5 flex justify-center">
                <button onClick={handleSkip} disabled={skipping}
                        className="px-4 py-2 rounded-lg text-xs font-semibold transition-opacity hover:opacity-80 disabled:opacity-40"
                        style={{ backgroundColor: "rgba(56,145,166,0.1)", border: "1px solid rgba(56,145,166,0.3)", color: "#3891A6" }}>
                  {skipping ? "Skipping..." : `🎫 Skip today (${skipTokens} token${skipTokens !== 1 ? "s" : ""})`}
                </button>
              </div>
            )}

            {gameStatus !== "playing" && (
              <>
                <div className="w-full max-w-sm mt-6 p-5 rounded-xl text-center"
                     style={{ border: "1px solid rgba(56,211,153,0.18)", background: "rgba(56,211,153,0.04)" }}>
                  <p className="text-xs mb-1" style={{ color: "#666" }}>Next daily in</p>
                  <p className="text-2xl font-mono font-bold mb-4" style={{ color: "#FDE74C" }}>{countdown}</p>

                  <div className="w-full flex justify-center gap-6">
                    {[
                      { label: "Guesses", value: gameStatus === "won" ? `${guessResults.length || serverGuessCount || "?"}/${MAX_ROWS}` : `X/${MAX_ROWS}` },
                      { label: "Puzzle", value: `#${dayNum}` },
                    ].map(({ label, value }) => (
                      <div key={label} className="text-center">
                        <p className="text-2xl font-black text-white">{value}</p>
                        <p className="text-xs" style={{ color: "#555" }}>{label}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {guessResults.length > 0 ? (
                  <div className="w-full max-w-3xl mt-5">
                    <DailyWordScrySharePanel
                      puzzleNumber={dayNum}
                      guessResults={guessResults}
                      gameStatus={gameStatus}
                      maxGuesses={MAX_ROWS}
                      wordLength={word.length || 5}
                      dailyStreak={dailyStreak}
                    />
                  </div>
                ) : (
                  <p className="mt-5 text-sm text-center" style={{ color: "#6b7280" }}>
                    Refresh your browser to reload the share snapshot.
                  </p>
                )}
              </>
            )}
          </>
        )}
      </main>

      {showRewardModal && earnedReward && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center"
             style={{ backgroundColor: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)" }}
             onClick={() => setShowRewardModal(false)}>
          <div className="w-full max-w-sm mx-4 rounded-2xl border-2 p-8 text-center"
               style={{ backgroundColor: "rgba(2,2,2,0.97)", borderColor: "#FDE74C", boxShadow: "0 0 30px rgba(253,231,76,0.2)" }}
               onClick={(event) => event.stopPropagation()}>
            <div className="text-5xl mb-3 select-none">🏆</div>
            <h2 className="text-2xl font-extrabold text-white mb-1">Daily Complete!</h2>
            <p className="text-sm mb-5" style={{ color: "#DDDBF1" }}>
              {WIN_MSGS[Math.max(0, Math.min(guessResults.length - 1, WIN_MSGS.length - 1))]}
            </p>

            <div className="flex justify-center gap-6 mb-5">
              <div className="text-center">
                <span className="text-4xl font-extrabold tabular-nums" style={{ color: "#38D399" }}>+{earnedReward.points}</span>
                <p className="text-xs font-bold mt-1" style={{ color: "#38D399" }}>POINTS</p>
              </div>
              <div className="text-center">
                <span className="text-4xl font-extrabold tabular-nums" style={{ color: "#FDE74C" }}>+{earnedReward.xp}</span>
                <p className="text-xs font-bold mt-1" style={{ color: "#FFB86B" }}>XP</p>
              </div>
            </div>

            <div className="mb-5">
              <p className="text-xs font-bold mb-2" style={{ color: "#888" }}>STREAK PROGRESS</p>
              <div className="flex justify-center gap-1.5">
                {Array.from({ length: 7 }, (_, index) => {
                  const dayIndex = index + 1;
                  const filled = dayIndex <= earnedReward.streakDay;
                  return (
                    <div key={index}
                         className="flex items-center justify-center rounded text-[10px] font-bold"
                         style={{
                           width: 32,
                           height: 28,
                           background: filled ? (dayIndex === 7 ? "linear-gradient(135deg, #FDE74C, #F97316)" : "#38D399") : "#1A1A1A",
                           border: filled ? "none" : "1px solid #2A2A2A",
                           color: filled ? "#020202" : "#444",
                         }}>
                      {dayIndex === 7 ? "★" : dayIndex}
                    </div>
                  );
                })}
              </div>
              <p className="text-xs mt-2" style={{ color: "#3891A6" }}>🔥 Day {earnedReward.streakDay} of 7</p>
            </div>

            <p className="text-sm mb-5" style={{ color: earnedReward.streakDay < 7 ? "#AB9F9D" : "#FDE74C" }}>
              {earnedReward.streakDay < 7 ? "Come back tomorrow to keep your streak alive!" : "🎉 7-day streak complete! Bonus maxed out!"}
            </p>

            <button onClick={() => setShowRewardModal(false)}
                    className="mt-2 px-6 py-2 rounded-xl font-bold text-sm hover:opacity-80 transition-opacity"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#888" }}>
              Continue
            </button>
          </div>
        </div>
      )}

      {showUpgradeOffer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
             style={{ background: "rgba(0,0,0,0.82)", backdropFilter: "blur(8px)" }}
             onClick={() => setShowUpgradeOffer(false)}>
          <div className="relative w-full max-w-sm mx-4 rounded-2xl p-8 text-center"
               style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #020202 100%)", border: "1px solid rgba(253,231,76,0.35)" }}
               onClick={(event) => event.stopPropagation()}>
            <button onClick={() => setShowUpgradeOffer(false)} className="absolute top-3 right-4 text-xl leading-none opacity-60 hover:opacity-100" style={{ color: "#fff" }}>×</button>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🏆</div>
            <div className="font-black text-xl mb-2" style={{ color: "#FDE74C", letterSpacing: "0.03em" }}>You&rsquo;re clearly hooked.</div>
            <div className="text-sm mb-6" style={{ color: "#DDDBF1", lineHeight: 1.7 }}>
              3 wins in. Season Pass unlocks premium tier rewards, exclusive cosmetics, and bonus XP — all for $4.99 a season.
            </div>
            <a href="/season-pass" onClick={() => setShowUpgradeOffer(false)} className="block py-3 px-6 rounded-xl font-black text-sm hover:opacity-90 transition-opacity mb-3" style={{ background: "#FDE74C", color: "#020202", letterSpacing: "0.05em" }}>
              Unlock Season Pass →
            </a>
            <button onClick={() => setShowUpgradeOffer(false)} className="text-xs hover:opacity-80" style={{ color: "#AB9F9D" }}>
              Maybe later
            </button>
          </div>
        </div>
      )}

      {guestReward && (
        <GuestRewardModal
          title="Guest Rewards Saved"
          xpEarned={guestReward.xp}
          pointsEarned={guestReward.points}
          puzzleTitle={`Daily #${dayNum}`}
          signupLabel="Sign Up to Save Streak + Rewards"
          message={(
            <>
              Your <span style={{ color: "#FDE74C", fontWeight: 700 }}>{guestReward.xp} XP</span> and <span style={{ color: "#7DF9AA", fontWeight: 700 }}>{guestReward.points} points</span> are saved for this guest solve. Sign up free to <span style={{ color: "#FFD700", fontWeight: 700 }}>keep your streak alive</span>, collect today's rewards, and carry them into day {guestReward.streakDay}.
            </>
          )}
          onDismiss={() => setGuestReward(null)}
        />
      )}
    </div>
  );
}