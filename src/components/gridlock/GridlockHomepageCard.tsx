'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import GridlockFilePuzzle from '@/components/puzzle/GridlockFilePuzzle';
import {
  getAnonStreak,
  isStreakAlive,
  isSolvedToday,
  getSecondsUntilMidnight,
} from '@/lib/gridlockAnon';

interface DailyInfo {
  puzzleId: string;
  puzzle: {
    fileNumber?: number;
    fileTitle?: string;
    flavorText?: string;
    arcDay?: number;
  };
  solvedToday?: number;
}

function formatCountdown(secs: number) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function GridlockHomepageCard({ autoExpand = false }: { autoExpand?: boolean }) {
  const { status } = useSession();
  const isLoggedIn = status === 'authenticated';
  const [daily, setDaily] = useState<DailyInfo | null>(null);
  const [loadingDaily, setLoadingDaily] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [solvedToday, setSolvedToday] = useState(false);
  const [streak, setStreak] = useState({ count: 0, alive: false });
  const [countdown, setCountdown] = useState('');

  // Load streak from localStorage
  useEffect(() => {
    const s = getAnonStreak();
    setStreak({ count: s.count, alive: isStreakAlive(s.lastSolvedDate) });
    setSolvedToday(isSolvedToday(s.lastSolvedDate));
  }, []);

  // Fetch today's daily puzzle
  useEffect(() => {
    fetch('/api/gridlock/daily')
      .then(r => (r.ok ? r.json() : null))
      .then(data => { if (data?.puzzleId) setDaily(data); })
      .catch(() => {})
      .finally(() => setLoadingDaily(false));
  }, []);

  // React to autoExpand changes (e.g. user clicks Solve Now after data already loaded)
  useEffect(() => {
    if (autoExpand) {
      setExpanded(true);
    }
  }, [autoExpand]);

  // Countdown to midnight
  useEffect(() => {
    const tick = () => setCountdown(formatCountdown(getSecondsUntilMidnight()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Refresh streak when puzzle is solved
  const handleSolved = () => {
    const s = getAnonStreak();
    setStreak({ count: s.count, alive: true });
    setSolvedToday(true);
  };

  if (loadingDaily) {
    return (
      <div style={{ maxWidth: 680, margin: '0 auto', borderRadius: 20, border: '1px solid rgba(255,208,0,0.12)', background: 'rgba(255,208,0,0.02)', padding: '32px 28px', textAlign: 'center' }}>
        <span style={{ fontSize: 12, fontFamily: 'monospace', color: '#4b5563', letterSpacing: '0.1em' }}>▶ LOADING GRIDLOCK FILE…</span>
      </div>
    );
  }

  if (!daily) {
    return (
      <div style={{ maxWidth: 680, margin: '0 auto', borderRadius: 20, border: '1px solid rgba(255,208,0,0.12)', background: 'rgba(255,208,0,0.02)', padding: '32px 28px', textAlign: 'center' }}>
        <span style={{ fontSize: 12, fontFamily: 'monospace', color: '#4b5563', letterSpacing: '0.1em' }}>▶ NO FILE ACTIVE TODAY — CHECK BACK SOON</span>
      </div>
    );
  }

  const fileNum = String(daily.puzzle.fileNumber ?? '?').padStart(3, '0');

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      style={{
        maxWidth: 680,
        margin: '0 auto',
        borderRadius: 20,
        border: '1px solid rgba(255,208,0,0.25)',
        background: 'linear-gradient(160deg, rgba(255,208,0,0.04) 0%, rgba(2,2,2,0) 60%)',
        overflow: 'hidden',
      }}
    >
      {/* Card header — always visible */}
      <div style={{ padding: '24px 28px 20px', borderBottom: expanded ? '1px solid rgba(255,208,0,0.12)' : 'none' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            {/* File label */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#FFD700', fontFamily: 'monospace' }}>
                📁 GRIDLOCK FILE #{fileNum}
              </span>
              {daily.puzzle.arcDay && (
                <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#6b7280', letterSpacing: '0.1em' }}>
                  ARC 001 · DAY {daily.puzzle.arcDay}
                </span>
              )}
            </div>

            <h3 style={{ fontSize: 20, fontWeight: 900, color: '#fff', letterSpacing: '-0.02em', marginBottom: 4 }}>
              {daily.puzzle.fileTitle ?? 'Classified File'}
            </h3>
            <p style={{ fontSize: 12, color: '#6B7280', fontStyle: 'italic', fontFamily: 'monospace' }}>
              {daily.puzzle.flavorText ?? ''}
            </p>
          </div>

          {/* Streak pill */}
          {streak.count > 0 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 999,
              background: streak.alive ? 'rgba(255,208,0,0.1)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${streak.alive ? 'rgba(255,208,0,0.35)' : 'rgba(255,255,255,0.1)'}`,
              flexShrink: 0,
            }}>
              <span style={{ fontSize: 14 }}>{streak.alive ? '🔥' : '💀'}</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: streak.alive ? '#FFD700' : '#6b7280', fontFamily: 'monospace' }}>
                {streak.count}
              </span>
              <span style={{ fontSize: 10, color: '#6b7280', fontFamily: 'monospace' }}>
                {streak.alive ? 'day streak' : 'streak lost'}
              </span>
            </div>
          )}
        </div>

        {/* Solved-today banner */}
        {solvedToday && !expanded && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 16,
            padding: '10px 14px',
            borderRadius: 10,
            background: 'rgba(125,249,170,0.07)',
            border: '1px solid rgba(125,249,170,0.2)',
          }}>
            <span style={{ fontSize: 12, fontFamily: 'monospace', color: '#7DF9AA' }}>
              ✓ File cracked today
            </span>
            <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#6b7280' }}>
              Next file in {countdown}
            </span>
          </div>
        )}

        {/* Action row */}
        {!expanded && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: solvedToday ? 12 : 16, flexWrap: 'wrap' }}>
            <button
              onClick={() => setExpanded(true)}
              style={{
                padding: '10px 22px',
                borderRadius: 8,
                fontWeight: 800,
                fontSize: 13,
                letterSpacing: '0.06em',
                textTransform: 'uppercase' as const,
                fontFamily: 'monospace',
                color: '#020202',
                background: '#FFD700',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 0 24px rgba(255,208,0,0.35)',
                transition: 'transform 0.15s, box-shadow 0.15s',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
                (e.currentTarget as HTMLElement).style.boxShadow = '0 0 36px rgba(255,208,0,0.55)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.transform = '';
                (e.currentTarget as HTMLElement).style.boxShadow = '0 0 24px rgba(255,208,0,0.35)';
              }}
            >
              {solvedToday ? '▶ View Result' : '▶ Crack This File'}
            </button>

            {!solvedToday && daily.solvedToday && daily.solvedToday > 0 && (
              <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#9ca3af' }}>
                🔑 {daily.solvedToday.toLocaleString()} cracked today
              </span>
            )}

            {!solvedToday && !daily.solvedToday && (
              <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#6b7280' }}>
                Expires in {countdown}
              </span>
            )}

            {!isLoggedIn && (
              <Link
                href="/auth/register"
                style={{
                  fontSize: 11,
                  fontFamily: 'monospace',
                  color: '#6b7280',
                  textDecoration: 'none',
                  marginLeft: 'auto',
                  transition: 'color 0.15s',
                }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#9ca3af')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#6b7280')}
              >
                Save streak →
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Expanded puzzle */}
      {expanded && (
        <div>
          {/* Close bar */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 20px 0' }}>
            <button
              onClick={() => setExpanded(false)}
              style={{ fontSize: 11, fontFamily: 'monospace', color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              ✕ collapse
            </button>
          </div>
          <div style={{ padding: '0 20px 24px' }}>
            <GridlockFilePuzzle
              puzzleId={daily.puzzleId}
              guestMode={!isLoggedIn}
              mode="daily"
              persistenceScope="daily"
              dailyIdentity={new Date().toISOString().slice(0, 10)}
              hideHeader
              onSolved={handleSolved}
            />
          </div>
        </div>
      )}

      {/* Bottom strip — streak context */}
      <div style={{
        padding: '10px 28px',
        borderTop: '1px solid rgba(255,255,255,0.04)',
        display: 'flex',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 8,
      }}>
        {isLoggedIn ? (
          <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#4b5563' }}>
            ✔ Streak saved to your account &nbsp;·&nbsp; ✔ XP and rank tracked
          </span>
        ) : (
          <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#4b5563' }}>
            ✔ No account needed &nbsp;·&nbsp; ✔ Streak tracked automatically
          </span>
        )}
        <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#4b5563' }}>
          Day 7 unlocks arc reward
        </span>
      </div>
    </motion.div>
  );
}
