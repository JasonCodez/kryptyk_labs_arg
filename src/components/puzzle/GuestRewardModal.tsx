'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import Link from 'next/link';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';

export interface GuestRewardModalProps {
  xpEarned: number;
  pointsEarned: number;
  puzzleTitle?: string;
  onDismiss: () => void;
  /** When true, replaces sign-up CTAs with a "launching soon" message */
  prelaunch?: boolean;
  title?: string;
  message?: ReactNode;
  signupLabel?: string;
}

const COUNTER_DURATION = 1200; // ms

function useCountUp(target: number) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    startRef.current = null;
    const animate = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const t = Math.min((ts - startRef.current) / COUNTER_DURATION, 1);
      setDisplay(Math.round((1 - Math.pow(1 - t, 3)) * target));
      if (t < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
  }, [target]);

  return display;
}

export default function GuestRewardModal({
  xpEarned,
  pointsEarned,
  puzzleTitle,
  onDismiss,
  prelaunch = false,
  title,
  message,
  signupLabel,
}: GuestRewardModalProps) {
  useBodyScrollLock();
  const displayXp = useCountUp(xpEarned);
  const displayPoints = useCountUp(pointsEarned);

  // Confetti on mount
  useEffect(() => {
    const t = setTimeout(() => {
      confetti({ particleCount: 80, spread: 60, origin: { y: 0.55 }, colors: ['#FFD700', '#FDE74C', '#7DF9AA', '#60CFFF'] });
    }, 200);
    return () => clearTimeout(t);
  }, []);

  const signupUrl = '/auth/register?reason=rewards';

  return (
    <AnimatePresence>
      <motion.div
        key="guest-reward-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      >
        <motion.div
          key="guest-reward-card"
          initial={{ scale: 0.82, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.82, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 220, damping: 20 }}
          className="relative w-full max-w-sm mx-4 rounded-2xl overflow-hidden text-center"
          style={{
            background: 'linear-gradient(160deg, rgba(10,8,0,0.98) 0%, rgba(2,2,2,0.98) 100%)',
            border: '2px solid rgba(255,208,0,0.45)',
            boxShadow: '0 0 48px rgba(255,208,0,0.15), 0 16px 64px rgba(0,0,0,0.8)',
          }}
        >
          {/* Top gold shimmer */}
          <div
            className="absolute top-0 left-0 right-0 h-px"
            style={{ background: 'linear-gradient(90deg, transparent, #FFD700, transparent)' }}
          />

          <div className="p-8">
            {/* Lock icon + label */}
            <div
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black tracking-widest uppercase mb-4"
              style={{ background: 'rgba(255,208,0,0.12)', border: '1px solid rgba(255,208,0,0.3)', color: '#FFD700' }}
            >
              🔒 Rewards Waiting
            </div>

            {/* Headline */}
            <h2 className="text-2xl font-extrabold text-white mb-1">{title ?? 'File Solved!'}</h2>
            {puzzleTitle && (
              <p className="text-sm mb-5" style={{ color: '#9CA3AF' }}>"{puzzleTitle}"</p>
            )}
            {!puzzleTitle && <div className="mb-5" />}

            {/* Rewards row */}
            <div className="flex items-center justify-center gap-6 mb-6 px-4">
              {/* XP */}
              <div className="flex flex-col items-center gap-1">
                <div className="flex items-end gap-1">
                  <span className="text-4xl font-extrabold tabular-nums leading-none" style={{ color: '#FDE74C' }}>
                    +{displayXp}
                  </span>
                  <span className="text-lg font-bold mb-1" style={{ color: '#FFB86B' }}>XP</span>
                </div>
                <span className="text-xs font-mono" style={{ color: '#6B7280' }}>Experience</span>
              </div>

              {/* Divider */}
              <div className="w-px h-12 self-center" style={{ background: 'rgba(255,255,255,0.08)' }} />

              {/* Points */}
              <div className="flex flex-col items-center gap-1">
                <div className="flex items-end gap-1">
                  <span className="text-4xl font-extrabold tabular-nums leading-none" style={{ color: '#7DF9AA' }}>
                    +{displayPoints}
                  </span>
                </div>
                <span className="text-xs font-mono" style={{ color: '#6B7280' }}>Points</span>
              </div>
            </div>

            {/* Locked message */}
            <p className="text-sm mb-6 leading-relaxed" style={{ color: '#9CA3AF' }}>
              {message ?? (prelaunch
                ? <>Your rewards are banked. When we launch on <span style={{ color: '#FFD700', fontWeight: 700 }}>May 1st</span>, sign up and confirm your email — they'll be deposited straight into your account.</>
                : <>Your rewards are saved. Create a free account to{' '}<span style={{ color: '#FFD700', fontWeight: 700 }}>unlock them permanently</span>{' '}and keep your streak and progress.</>
              )}
            </p>

            {/* CTA buttons */}
            <div className="space-y-3">
              {prelaunch ? (
                <>
                  <div
                    className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-extrabold tracking-wide"
                    style={{ background: 'rgba(255,208,0,0.1)', border: '1px solid rgba(255,208,0,0.3)', color: '#FFD700' }}
                  >
                    🗓 Launching May 1st — rewards are waiting!
                  </div>
                  <button
                    onClick={onDismiss}
                    className="block w-full py-2.5 rounded-xl text-sm font-semibold transition-colors"
                    style={{ background: 'rgba(255,255,255,0.04)', color: '#6B7280', border: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    Back to puzzle
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href={signupUrl}
                    className="block w-full py-3 rounded-xl font-extrabold text-sm tracking-wide transition-all hover:brightness-110 active:scale-95"
                    style={{ background: 'linear-gradient(90deg, #FDE74C, #FFB86B)', color: '#020202' }}
                    onClick={onDismiss}
                  >
                    {signupLabel ?? '🎉 Create Free Account'}
                  </Link>
                  <button
                    onClick={onDismiss}
                    className="block w-full py-2.5 rounded-xl text-sm font-semibold transition-colors"
                    style={{ background: 'rgba(255,255,255,0.04)', color: '#6B7280', border: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    Maybe later — I'll keep playing as guest
                  </button>
                </>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
