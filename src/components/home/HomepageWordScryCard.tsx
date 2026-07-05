'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import DailyWordScrySharePanel from '@/components/daily/DailyWordScrySharePanel';
import WordCrackPuzzle from '@/components/puzzle/WordCrackPuzzle';
import GuestRewardModal from '@/components/puzzle/GuestRewardModal';
import { addPendingRewards, getAnonId } from '@/lib/gridlockAnon';
import { useReferralLink } from '@/hooks/useReferralLink';
import { isValidWordScryGuess } from '@/lib/wordScryValidate';
import {
  isSolvedWordScryResult,
  parseStoredWordScryState,
  scoreWordScryGuess,
  serializeWordScryState,
  type WordScryGameStatus,
  type WordScryGuessResult,
} from '@/lib/wordScry';

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

function getCountdownText() {
  const now = new Date();
  const next = new Date();
  next.setUTCHours(24, 0, 0, 0);
  const diff = Math.max(0, next.getTime() - now.getTime());
  const hours = String(Math.floor(diff / 3_600_000)).padStart(2, '0');
  const minutes = String(Math.floor((diff % 3_600_000) / 60_000)).padStart(2, '0');
  const seconds = String(Math.floor((diff % 60_000) / 1_000)).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

export default function HomepageWordScryCard() {
  const { data: session, status: sessionStatus } = useSession();
  const isAuthenticated = sessionStatus === 'authenticated';
  const sessionUid = session?.user?.email ?? session?.user?.name ?? '';
  const referralLink = useReferralLink(isAuthenticated);

  const [word, setWord] = useState('');
  const [dayNum, setDayNum] = useState(0);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState('00:00:00');
  const [notice, setNotice] = useState('');
  const [dailyStreak, setDailyStreak] = useState(0);
  const [nextReward, setNextReward] = useState<{ points: number; xp: number } | null>(null);
  const [guestReward, setGuestReward] = useState<DailyReward | null>(null);
  const [guessResults, setGuessResults] = useState<WordScryGuessResult[][]>([]);
  const [gameStatus, setGameStatus] = useState<WordScryGameStatus>('playing');

  const dateKey = new Date().toISOString().slice(0, 10);
  const storeKey = sessionUid ? `pw_daily_${dateKey}_${sessionUid}` : `pw_daily_${dateKey}`;

  useEffect(() => {
    setCountdown(getCountdownText());
    const timerId = window.setInterval(() => setCountdown(getCountdownText()), 1000);
    return () => window.clearInterval(timerId);
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const timerId = window.setTimeout(() => setNotice(''), 2600);
    return () => window.clearTimeout(timerId);
  }, [notice]);

  useEffect(() => {
    let ignore = false;
    setLoading(true);

    fetch('/api/daily/word')
      .then((response) => (response.ok ? response.json() as Promise<DailyWordResponse> : null))
      .then((data) => {
        if (ignore || !data) return;

        setWord(data.word.toUpperCase());
        setDayNum(data.number);

        const saved = parseStoredWordScryState(localStorage.getItem(storeKey), data.word);
        setGuessResults(saved?.guessResults ?? []);
        setGameStatus(saved?.status ?? 'playing');
      })
      .catch(() => {
        if (!ignore) setNotice('Unable to load today\'s Hidden Word right now.');
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [storeKey]);

  useEffect(() => {
    if (!isAuthenticated) {
      setDailyStreak(0);
      setNextReward(null);
      return;
    }

    fetch('/api/daily/complete')
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!data) return;
        setDailyStreak(data.streak ?? 0);
        setNextReward(data.nextReward ?? null);
      })
      .catch(() => undefined);
  }, [isAuthenticated]);

  const saveState = useCallback((results: WordScryGuessResult[][], status: WordScryGameStatus) => {
    localStorage.setItem(storeKey, serializeWordScryState(results, status));
  }, [storeKey]);

  const recordAuthenticatedCompletion = useCallback(async (won: boolean, guessCount: number) => {
    try {
      const response = await fetch('/api/daily/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ won, guesses: guessCount }),
      });

      const data = response.ok ? await response.json() : null;

      if (won && data?.reward) {
        const reward = data.reward as DailyReward;
        setNotice(`+${reward.points} points and +${reward.xp} XP added to your account.`);
      }

      const refreshed = await fetch('/api/daily/complete');
      if (!refreshed.ok) return;

      const refreshedData = await refreshed.json();
      setDailyStreak(refreshedData.streak ?? 0);
      setNextReward(refreshedData.nextReward ?? null);
    } catch {
      if (won) setNotice('Solved. Account rewards will sync on your daily page.');
    }
  }, []);

  const recordGuestCompletion = useCallback(async (guessCount: number) => {
    try {
      const response = await fetch('/api/daily/guest-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anonId: getAnonId(), guesses: guessCount }),
      });

      const data = await response.json();
      if (!response.ok || !data?.reward) {
        setNotice(data?.error ?? 'Solved. Create an account to save the run.');
        return;
      }

      addPendingRewards(data.reward.xp, data.reward.points);
      setGuestReward(data.reward as DailyReward);
    } catch {
      setNotice('Solved. Create an account to lock in the reward and streak.');
    }
  }, []);

  const handleStateChange = useCallback((payload: { guesses: WordScryGuessResult[][]; status: WordScryGameStatus }) => {
    setGuessResults(payload.guesses);
    setGameStatus(payload.status);
    saveState(payload.guesses, payload.status);
  }, [saveState]);

  const statusCopy = isAuthenticated
    ? 'Solve it here and your daily streak and rewards count immediately.'
    : 'No account needed to start. Solve first, then create an account to collect the rewards and keep the streak.';

  return (
    <>
      <div style={{ display: 'grid', gap: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#38D399', marginBottom: 8 }}>
              Play today's word now
            </p>
            <p style={{ color: '#9CA3AF', fontSize: 14, lineHeight: 1.7, maxWidth: 420 }}>
              {statusCopy}
            </p>
          </div>
          <div style={{ display: 'grid', gap: 8, justifyItems: 'end' }}>
            <div style={{ padding: '8px 12px', borderRadius: 999, background: 'rgba(253,231,76,0.08)', border: '1px solid rgba(253,231,76,0.25)', color: '#FDE74C', fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              #{dayNum || '---'} · resets in {countdown}
            </div>
            {isAuthenticated && dailyStreak > 0 ? (
              <div style={{ fontSize: 12, color: '#38D399', fontWeight: 700 }}>
                🔥 {dailyStreak}-day streak
              </div>
            ) : (
              <div style={{ fontSize: 12, color: '#9BD6E4', fontWeight: 700 }}>
                No account required
              </div>
            )}
          </div>
        </div>

        {isAuthenticated && nextReward && gameStatus === 'playing' && (
          <div style={{ padding: '10px 14px', borderRadius: 14, background: 'rgba(56,211,153,0.05)', border: '1px solid rgba(56,211,153,0.18)', color: '#D1FAE5', fontSize: 13, lineHeight: 1.6 }}>
            Win here and today's streak adds <strong style={{ color: '#38D399' }}>+{nextReward.points} points</strong> and{' '}
            <strong style={{ color: '#FDE74C' }}>+{nextReward.xp} XP</strong>.
          </div>
        )}

        {notice && (
          <div style={{ padding: '10px 14px', borderRadius: 14, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#E5E7EB', fontSize: 13 }}>
            {notice}
          </div>
        )}

        {loading ? (
          <div style={{ minHeight: 360, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9BD6E4', fontSize: 14 }}>
            Loading today's Hidden Word…
          </div>
        ) : (
          <>
            <WordCrackPuzzle
              key={`${storeKey}:${dayNum}`}
              puzzleId={`homepage-daily-${dayNum}`}
              wordCrackData={{ wordLength: word.length || 5, maxGuesses: 6 }}
              alreadySolved={gameStatus === 'won'}
              initialGuesses={guessResults}
              initialStatus={gameStatus}
              showHeader={false}
              showAttemptMeter={false}
              showHints={false}
              disableRetry
              recordGameLossOnFailure={false}
              showAnimatedBackdrops={false}
              submitGuessRequest={async (guess) => {
                if (guess.toUpperCase() !== word.toUpperCase() && !(await isValidWordScryGuess(guess))) {
                  return { error: "Not a valid word" };
                }
                const result = scoreWordScryGuess(guess, word);
                return { result, solved: isSolvedWordScryResult(result) };
              }}
              onStateChange={handleStateChange}
              onRoundComplete={({ status, guesses }) => {
                if (isAuthenticated) {
                  void recordAuthenticatedCompletion(status === 'won', guesses);
                } else {
                  if (status !== 'won') return;
                  void recordGuestCompletion(guesses);
                }
              }}
            />

            {gameStatus !== 'playing' && guessResults.length > 0 && (
              <div style={{ marginTop: 12, marginBottom: 4 }}>
                <DailyWordScrySharePanel
                  puzzleNumber={dayNum}
                  guessResults={guessResults}
                  gameStatus={gameStatus}
                  maxGuesses={6}
                  wordLength={word.length || 5}
                  dailyStreak={dailyStreak}
                  shareUrl={referralLink}
                />
              </div>
            )}

            <div style={{ display: 'grid', gap: 12, marginTop: gameStatus !== 'playing' ? 12 : 8 }}>
              <div style={{ padding: '14px 16px', borderRadius: 16, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9CA3AF', marginBottom: 8 }}>
                  {gameStatus === 'playing' ? 'Live on the homepage' : 'Next move'}
                </p>
                <p style={{ color: '#E5E7EB', fontSize: 14, lineHeight: 1.7, margin: 0 }}>
                  {gameStatus === 'playing'
                    ? 'Solve here first, then jump into Gridlock files, crosswords, Word Troves, and the rest of your longer session stack.'
                    : gameStatus === 'won'
                      ? 'Word locked in. Keep the session moving with the full daily page or drop straight into the wider puzzle library.'
                      : 'No more guesses left here. The full daily page is ready if you want the dedicated daily view.'}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
                <Link href="/daily/word" className="hw-btn-primary" style={{ flex: '1 1 180px', padding: '14px 18px', borderRadius: 14, textDecoration: 'none', color: '#020202', fontWeight: 900, fontSize: 14, letterSpacing: '0.04em', background: 'linear-gradient(135deg, #38D399 0%, #FDE74C 100%)', textAlign: 'center', transition: 'opacity 0.15s, transform 0.15s' }}>
                  Open Full Daily Page →
                </Link>
                {!isAuthenticated && (
                  <Link href="/auth/register?reason=rewards" className="hw-btn-secondary" style={{ flex: '1 1 180px', padding: '14px 18px', borderRadius: 14, textDecoration: 'none', color: '#fff', fontWeight: 800, fontSize: 14, letterSpacing: '0.03em', background: 'rgba(56,145,166,0.12)', border: '1px solid rgba(56,145,166,0.35)', textAlign: 'center', transition: 'opacity 0.15s, transform 0.15s, background 0.15s' }}>
                    Save rewards and streak →
                  </Link>
                )}
              </div>
              <style>{`
                .hw-btn-primary:hover { opacity: 0.88; transform: translateY(-1px); }
                .hw-btn-secondary:hover { background: rgba(56,145,166,0.22) !important; transform: translateY(-1px); }
              `}</style>
            </div>
          </>
        )}
      </div>

      {guestReward && (
        <GuestRewardModal
          title="Guest Rewards Saved"
          xpEarned={guestReward.xp}
          pointsEarned={guestReward.points}
          puzzleTitle={`Daily #${dayNum}`}
          signupLabel="Sign Up to Save Streak + Rewards"
          message={(
            <>
              Your <span style={{ color: '#FDE74C', fontWeight: 700 }}>{guestReward.xp} XP</span> and <span style={{ color: '#7DF9AA', fontWeight: 700 }}>{guestReward.points} points</span> are saved for this guest solve. Sign up free to <span style={{ color: '#FFD700', fontWeight: 700 }}>keep your streak alive</span>, collect today's rewards, and carry them into day {guestReward.streakDay}.
            </>
          )}
          onDismiss={() => setGuestReward(null)}
        />
      )}
    </>
  );
}