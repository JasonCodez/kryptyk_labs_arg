'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import WelcomeModal from '@/components/WelcomeModal';
import DashboardTour from '@/components/DashboardTour';
import GameButton from '@/components/game-ui/GameButton';

interface UserStats {
  totalPuzzlesSolved: number;
  totalPoints: number;
  currentTeams: number;
  rank: number | null;
}

/* ── count-up ─────────────────────────────────────────────── */
function useCountUp(target: number, duration = 1600, trigger = false) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!trigger || target === 0) return;
    let start: number | null = null;
    const step = (ts: number) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      setCount(Math.floor((1 - Math.pow(1 - p, 3)) * target));
      if (p < 1) requestAnimationFrame(step);
      else setCount(target);
    };
    requestAnimationFrame(step);
  }, [target, duration, trigger]);
  return (!trigger || target === 0) ? target : count;
}

/* ── stat card ────────────────────────────────────────────── */
interface StatCardProps {
  label: string;
  value: number | string;
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
  prefix?: string;
  suffix?: string;
  delay: number;
  visible: boolean;
  animate?: boolean;
}
function StatCard({ label, value, icon, color, bgColor, borderColor, prefix = '', suffix = '', delay, visible, animate = false }: StatCardProps) {
  const numVal = typeof value === 'number' ? value : 0;
  const counted = useCountUp(numVal, 1400, animate && visible);
  const displayVal = typeof value === 'string' ? value : counted;
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="pw-bevel relative overflow-hidden"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: `linear-gradient(160deg, ${bgColor.replace(/[\d.]+\)$/, '0.22)')}, var(--pw-surface) 65%)`,
        border: `1px solid ${hovered ? color : borderColor}`,
        padding: '24px',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(24px)',
        transition: `opacity 0.6s ease ${delay}s, transform 0.6s ease ${delay}s, border-color 0.25s, box-shadow 0.25s`,
        boxShadow: `0 12px 28px rgba(0,0,0,0.35), inset 0 2px 0 rgba(255,255,255,0.35), inset 0 -6px 14px rgba(0,0,0,0.12), ${hovered ? `0 8px 32px ${bgColor}` : `0 0 18px -6px ${bgColor}`}`,
        cursor: 'default',
      }}
    >
      <span className="game-gloss-overlay" aria-hidden style={{ opacity: 0.4 }} />
      <div className="relative" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color }}>{label}</p>
        <div style={{
          width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
          backgroundColor: bgColor, border: `1px solid ${borderColor}`, boxShadow: `0 0 14px -3px ${color}`,
        }}>
          {icon}
        </div>
      </div>
      <p className="relative" style={{ fontSize: 36, fontWeight: 800, color: '#fff', lineHeight: 1, letterSpacing: '-0.02em', textShadow: `0 0 24px ${bgColor}` }}>
        {prefix}{displayVal}{suffix}
      </p>
    </div>
  );
}

/* ── featured banner (Witness) ───────────────────────────── */
interface WitnessTeaser {
  caseNumber: number;
  classification: string;
  totalPlays: number;
  completed: boolean;
}
function FeaturedBanner({ visible }: { visible: boolean }) {
  const [teaser, setTeaser] = useState<WitnessTeaser | null>(null);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    fetch('/api/debrief/today')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return;
        const plays = data.stats?.totalPlays ?? 0;
        setTeaser({
          caseNumber: data.caseNumber ?? data.scenario?.caseNumber ?? 0,
          classification: data.classification ?? data.scenario?.classification ?? 'CLASSIFIED',
          totalPlays: plays,
          completed: !!data.completed,
        });
      })
      .catch(() => {});
  }, []);

  // Don't show until we know the completion state; hide once completed
  if (teaser?.completed) return null;

  return (
    <Link
      href="/debrief"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'block',
        textDecoration: 'none',
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 20,
        border: `1px solid ${hovered ? 'rgba(139,61,255,0.55)' : 'rgba(139,61,255,0.22)'}`,
        background: 'linear-gradient(135deg, rgba(11,14,26,0.98) 0%, rgba(19,24,41,0.95) 60%, rgba(11,14,26,0.98) 100%)',
        padding: '36px 40px',
        marginBottom: 40,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(24px)',
        transition: `opacity 0.65s ease 0.05s, transform 0.65s ease 0.05s, border-color 0.3s, box-shadow 0.3s`,
        boxShadow: hovered
          ? '0 20px 60px rgba(139,61,255,0.16), 0 0 0 1px rgba(139,61,255,0.2) inset'
          : '0 8px 40px rgba(0,0,0,0.5)',
        cursor: 'pointer',
      }}
    >
      {/* Scan-line overlay */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(139,61,255,0.02) 3px, rgba(139,61,255,0.02) 4px)',
        borderRadius: 20,
      }} />

      {/* Corner accent lines */}
      <div style={{ position: 'absolute', top: 12, left: 12, width: 20, height: 20, borderTop: '2px solid rgba(139,61,255,0.5)', borderLeft: '2px solid rgba(139,61,255,0.5)', borderRadius: '2px 0 0 0' }} />
      <div style={{ position: 'absolute', top: 12, right: 12, width: 20, height: 20, borderTop: '2px solid rgba(139,61,255,0.5)', borderRight: '2px solid rgba(139,61,255,0.5)', borderRadius: '0 2px 0 0' }} />
      <div style={{ position: 'absolute', bottom: 12, left: 12, width: 20, height: 20, borderBottom: '2px solid rgba(139,61,255,0.5)', borderLeft: '2px solid rgba(139,61,255,0.5)', borderRadius: '0 0 0 2px' }} />
      <div style={{ position: 'absolute', bottom: 12, right: 12, width: 20, height: 20, borderBottom: '2px solid rgba(139,61,255,0.5)', borderRight: '2px solid rgba(139,61,255,0.5)', borderRadius: '0 0 2px 0' }} />

      {/* Glow blob */}
      <div style={{
        position: 'absolute', top: -60, right: -60, width: 300, height: 300,
        background: 'radial-gradient(circle, rgba(139,61,255,0.1) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 32 }}>
        {/* Icon block */}
        <div style={{
          flexShrink: 0,
          width: 80, height: 80, borderRadius: 18,
          background: 'rgba(139,61,255,0.1)',
          border: '1px solid rgba(139,61,255,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 36,
          boxShadow: hovered ? '0 0 24px rgba(139,61,255,0.25)' : 'none',
          transition: 'box-shadow 0.3s, transform 0.3s',
          transform: hovered ? 'scale(1.08)' : 'scale(1)',
        }}>
          🔍
        </div>

        {/* Copy */}
        <div style={{ flex: 1, minWidth: 220 }}>
          {/* Eyebrow */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase',
              color: '#8B3DFF', padding: '3px 10px', borderRadius: 999,
              background: 'rgba(139,61,255,0.12)', border: '1px solid rgba(139,61,255,0.28)',
            }}>
              Featured Puzzle
            </span>
            {teaser && (
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase',
                color: 'rgba(255,201,60,0.9)', display: 'flex', alignItems: 'center', gap: 5,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#FFC93C', boxShadow: '0 0 6px rgba(255,201,60,0.7)', animation: 'db-pulse 2s ease-in-out infinite', display: 'inline-block' }} />
                Live Today
              </span>
            )}
          </div>

          <h2 style={{
            fontSize: 'clamp(22px, 3.5vw, 34px)', fontWeight: 900, color: '#fff',
            margin: '0 0 6px', letterSpacing: '-0.02em', lineHeight: 1.1,
          }}>
            The Debrief
          </h2>

          {teaser && (
            <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', color: 'rgba(139,61,255,0.8)', marginBottom: 8 }}>
              CASE #{String(teaser.caseNumber).padStart(4, '0')} &nbsp;·&nbsp;
              <span style={{ color: '#FF5A5A' }}>{teaser.classification.toUpperCase()}</span>
            </div>
          )}

          <p style={{ color: '#8891AC', fontSize: 14, lineHeight: 1.6, margin: 0, maxWidth: 500 }}>
            You have 35 seconds to read an incident report. Then it disappears. Five questions follow. Every detail matters.
          </p>
        </div>

        {/* Stats + CTA */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 16, flexShrink: 0 }}>
          {teaser && teaser.totalPlays > 0 && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', lineHeight: 1 }}>
                {teaser.totalPlays.toLocaleString()}
              </div>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#5B6483', marginTop: 3 }}>
                Investigators
              </div>
            </div>
          )}

          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '11px 24px', borderRadius: 12, fontWeight: 700, fontSize: 13,
            letterSpacing: '0.04em',
            background: hovered ? 'rgba(139,61,255,0.22)' : 'rgba(139,61,255,0.12)',
            border: `1px solid ${hovered ? 'rgba(139,61,255,0.6)' : 'rgba(139,61,255,0.35)'}`,
            color: '#8B3DFF',
            transition: 'all 0.25s',
            whiteSpace: 'nowrap',
          }}>
            Enter the Case
            <span style={{ transition: 'transform 0.25s', transform: hovered ? 'translateX(4px)' : 'none', display: 'inline-block' }}>→</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

/* ── action card ──────────────────────────────────────────── */
interface ActionCardProps {
  href: string;
  icon: string;
  title: string;
  desc: string;
  accent: 'teal' | 'gold' | 'muted';
  delay: number;
  visible: boolean;
  badge?: string;
  tourId?: string;
}
function ActionCard({ href, icon, title, desc, accent, delay, visible, badge, tourId }: ActionCardProps) {
  const [hovered, setHovered] = useState(false);
  const colors = {
    teal:  { bg: 'rgba(255,79,163,0.10)',  border: 'rgba(255,79,163,0.35)',  hover: 'rgba(255,79,163,0.65)',  glow: 'rgba(255,79,163,0.25)',  icon: 'rgba(255,79,163,0.20)',  iconBorder: 'rgba(255,79,163,0.4)',  accent: '#FF4FA3' },
    gold:  { bg: 'rgba(255,201,60,0.08)',  border: 'rgba(255,201,60,0.32)',  hover: 'rgba(255,201,60,0.6)',   glow: 'rgba(255,201,60,0.20)', icon: 'rgba(255,201,60,0.14)',  iconBorder: 'rgba(255,201,60,0.35)', accent: '#FFC93C' },
    muted: { bg: 'rgba(139,61,255,0.08)', border: 'rgba(139,61,255,0.28)',  hover: 'rgba(139,61,255,0.55)',  glow: 'rgba(139,61,255,0.20)',icon: 'rgba(139,61,255,0.16)', iconBorder: 'rgba(139,61,255,0.35)',accent: '#8B3DFF' },
  };
  const c = colors[accent];

  return (
    <Link
      href={href}
      id={tourId}
      className="pw-bevel"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'block',
        textDecoration: 'none',
        background: `radial-gradient(220px 140px at 100% 0%, ${c.glow}, transparent 65%), linear-gradient(160deg, var(--pw-surface-hi), var(--pw-surface) 70%)`,
        border: `1px solid ${hovered ? c.hover : c.border}`,
        padding: '24px',
        opacity: visible ? 1 : 0,
        transform: visible ? (hovered ? 'translateY(-5px)' : 'translateY(0)') : 'translateY(28px)',
        transition: `opacity 0.6s ease ${delay}s, transform 0.5s ease ${delay}s, border-color 0.22s, box-shadow 0.22s`,
        boxShadow: `0 12px 28px rgba(0,0,0,0.35), inset 0 2px 0 rgba(255,255,255,0.3), inset 0 -6px 14px rgba(0,0,0,0.12), ${hovered ? `0 12px 40px ${c.glow}` : `0 0 20px -8px ${c.glow}`}`,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <span className="game-gloss-overlay" aria-hidden style={{ opacity: 0.4 }} />
      {badge && (
        <span className="relative" style={{
          position: 'absolute', top: 14, right: 14,
          fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
          padding: '3px 8px', borderRadius: 999,
          backgroundColor: 'rgba(255,201,60,0.12)', color: '#FFC93C', border: '1px solid rgba(255,201,60,0.25)',
        }}>{badge}</span>
      )}
      <div className="relative" style={{
        width: 48, height: 48, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22, marginBottom: 16,
        backgroundColor: c.icon, border: `1px solid ${c.iconBorder}`,
        boxShadow: `0 0 16px -4px ${c.accent}`,
        transition: 'transform 0.22s, box-shadow 0.22s',
        transform: hovered ? 'scale(1.1)' : 'scale(1)',
      }}>
        {icon}
      </div>
      <h3 className="relative" style={{ color: '#fff', fontWeight: 700, fontSize: 16, marginBottom: 6 }}>{title}</h3>
      <p className="relative" style={{ color: '#8891AC', fontSize: 13, lineHeight: 1.5 }}>{desc}</p>
      <div className="relative" style={{
        marginTop: 16, fontSize: 12, fontWeight: 600, color: c.accent,
        display: 'flex', alignItems: 'center', gap: 4,
        opacity: hovered ? 1 : 0.7, transition: 'opacity 0.22s',
      }}>
        Open <span style={{ transition: 'transform 0.22s', transform: hovered ? 'translateX(3px)' : 'none' }}>→</span>
      </div>
    </Link>
  );
}

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [referral, setReferral] = useState<{ inviteCode: string; link: string; signedUp: number } | null>(null);
  const [referralCopied, setReferralCopied] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  const fetchUserStats = async () => {
    try {
      const response = await fetch('/api/user/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch user stats:', error);
    }
  };

  const fetchAdminStatus = async () => {
    try {
      const response = await fetch('/api/admin/check');
      if (response.ok) {
        const data = await response.json();
        setIsAdmin(data.isAdmin);
      }
    } catch (error) {
      console.error('Failed to check admin status:', error);
    }
  };

  const fetchReferral = async () => {
    try {
      const res = await fetch('/api/user/referral');
      if (res.ok) setReferral(await res.json());
    } catch { /* non-fatal */ }
  };

  useEffect(() => {
    if (session?.user?.email) {
      // Fetch-on-mount: each helper sets its own piece of state once its request resolves.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      Promise.all([fetchUserStats(), fetchAdminStatus(), fetchReferral()]).finally(() => {
        setLoading(false);
        setTimeout(() => setMounted(true), 60);
      });
    }
  }, [session?.user?.email]);

  /* ── Loading skeleton ─────────────────────────────────── */
  if (status === 'loading' || loading) {
    return (
      <div style={{
        background: 'radial-gradient(1300px 800px at 15% -10%, rgba(139,61,255,0.2), transparent 62%), radial-gradient(1100px 700px at 90% 0%, rgba(255,201,60,0.12), transparent 58%), radial-gradient(1000px 650px at 50% 100%, rgba(62,217,122,0.09), transparent 60%), #170B26',
        minHeight: '100vh',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '100px 16px 48px' }}>
          {/* Header skeleton */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 48 }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', backgroundColor: 'rgba(139,61,255,0.12)', animation: 'pulse 1.5s ease-in-out infinite' }} />
            <div>
              <div style={{ width: 200, height: 22, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.06)', marginBottom: 10, animation: 'pulse 1.5s ease-in-out infinite' }} />
              <div style={{ width: 140, height: 14, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.04)', animation: 'pulse 1.5s ease-in-out infinite' }} />
            </div>
          </div>
          {/* Stat skeleton */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 20, marginBottom: 48 }}>
            {[0,1,2,3].map(i => (
              <div key={i} style={{ height: 108, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', animation: `pulse 1.5s ease-in-out ${i * 0.1}s infinite` }} />
            ))}
          </div>
          {/* Card skeleton */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 20 }}>
            {[0,1,2,3,4,5].map(i => (
              <div key={i} style={{ height: 160, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', animation: `pulse 1.5s ease-in-out ${i * 0.08}s infinite` }} />
            ))}
          </div>
        </div>
        <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
      </div>
    );
  }

  if (!session?.user) return null;

  const initials = (session.user.name || session.user.email || 'P')
    .split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();

  const statCards = [
    { label: 'Puzzles Solved', value: stats?.totalPuzzlesSolved ?? 0, icon: '🧩', color: '#FF4FA3', bgColor: 'rgba(255,79,163,0.12)', borderColor: 'rgba(255,79,163,0.35)', animate: true },
    { label: 'Total Points',   value: stats?.totalPoints ?? 0,        icon: '⚡', color: '#FFC93C', bgColor: 'rgba(255,201,60,0.10)',  borderColor: 'rgba(255,201,60,0.32)',  animate: true },
    { label: 'Active Teams',   value: stats?.currentTeams ?? 0,       icon: '👥', color: '#8B3DFF', bgColor: 'rgba(139,61,255,0.10)', borderColor: 'rgba(139,61,255,0.30)', animate: true },
    { label: 'Global Rank',    value: stats?.rank ? `#${stats.rank}` : 'Unranked', icon: '🏆', color: '#E8934A', bgColor: 'rgba(232,147,74,0.10)', borderColor: 'rgba(232,147,74,0.30)', animate: false },
  ];

  const coreCards = [
    { href: '/puzzles',             icon: '🧩', title: 'Solve Puzzles',       desc: 'Dive into active puzzles and earn points',                  accent: 'teal'  as const, tourId: 'tour-card-puzzles' },
    { href: '/warz',                icon: '⚔️', title: 'Warz',                desc: 'Challenge rivals head-to-head. Wager points on speed.',      accent: 'gold'  as const, badge: 'Live', tourId: 'tour-card-warz' },
    { href: '/teams',               icon: '👥', title: 'My Teams',            desc: 'Manage your teams and invite players to collaborate.',       accent: 'gold'  as const, tourId: 'tour-card-teams' },
    { href: '/leaderboards',        icon: '🏆', title: 'Leaderboards',        desc: 'Check global rankings and see where you stand.',             accent: 'teal'  as const, tourId: 'tour-card-leaderboards' },
    { href: '/categories',          icon: '📚', title: 'Browse Categories',   desc: 'Explore puzzles organized by topic and difficulty.',         accent: 'gold'  as const },
    { href: '/achievements',        icon: '🎖️', title: 'Achievements',        desc: 'Unlock badges and earn recognition as you progress.',        accent: 'muted' as const, tourId: 'tour-card-achievements' },
    { href: '/profile',             icon: '👤', title: 'My Profile',          desc: 'View your stats, badges, and customize your profile.',       accent: 'teal'  as const, tourId: 'tour-card-profile' },
    { href: '/dashboard/activity',  icon: '📋', title: 'Activity Feed',       desc: 'Review your recent actions and account history.',            accent: 'muted' as const },
    { href: '/daily',               icon: '📅', title: 'Daily Challenge',     desc: 'Tackle today\'s featured puzzle and keep your streak alive.', accent: 'gold'  as const, tourId: 'tour-card-daily' },
    { href: '/frequency',           icon: '📡', title: 'Frequency',           desc: 'Think like the crowd. Score = how many people agreed with you.', accent: 'teal' as const, badge: 'New', tourId: 'tour-card-frequency' },
    { href: '/faq',                 icon: '❓', title: 'FAQ',                 desc: 'Answers to common questions about puzzles, teams, and more.', accent: 'muted' as const },
  ];

  const adminCards = [
    { href: '/admin/analytics',  icon: '📊', title: 'Analytics',         desc: 'View platform statistics and puzzle analytics.',         accent: 'teal' as const },
    { href: '/admin/puzzles',    icon: '➕', title: 'Create Puzzle',     desc: 'Add new puzzles to the platform.',                       accent: 'muted' as const },
    { href: '/admin/frequency',  icon: '📡', title: 'Frequency Admin',   desc: 'Schedule questions, reveal results, merge answers.',     accent: 'teal' as const },
    { href: '/admin/reports',    icon: '🚩', title: 'Abuse Reports',     desc: 'Review and act on user-submitted reports.',              accent: 'gold' as const },
    { href: '/admin/bug-reports',icon: '🐞', title: 'Bug Reports',       desc: 'Review player-submitted bug reports by puzzle.',         accent: 'muted' as const },
  ];

  return (
    <>
      <style>{`
        @keyframes db-fade-in { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes db-pulse { 0%,100%{opacity:1} 50%{opacity:0.45} }
        @keyframes db-glow { 0%,100%{box-shadow:0 0 0 0 rgba(139,61,255,0)} 50%{box-shadow:0 0 0 6px rgba(139,61,255,0)} }
      `}</style>

      <main style={{
        background: 'radial-gradient(1300px 800px at 15% -10%, rgba(139,61,255,0.2), transparent 62%), radial-gradient(1100px 700px at 90% 0%, rgba(255,201,60,0.12), transparent 58%), radial-gradient(1000px 650px at 50% 100%, rgba(62,217,122,0.09), transparent 60%), #170B26',
        minHeight: '100vh',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '100px 16px 64px' }}>

          {/* ── Welcome header ─────────────────────────────── */}
          <div style={{
            display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between',
            gap: 20, marginBottom: 48,
            opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(20px)',
            transition: 'opacity 0.6s ease, transform 0.6s ease',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
              {/* Avatar */}
              <div style={{ position: 'relative', flexShrink: 0 }}>
                {session.user.image ? (
                  <img src={session.user.image} alt="avatar" style={{ width: 60, height: 60, borderRadius: '50%', border: '2px solid rgba(139,61,255,0.5)', objectFit: 'cover' }} onError={(e) => { const img = e.currentTarget as HTMLImageElement; img.onerror = null; img.src = '/images/default-avatar.svg'; }} />
                ) : (
                  <div style={{
                    width: 60, height: 60, borderRadius: '50%',
                    background: 'linear-gradient(135deg, rgba(139,61,255,0.35) 0%, rgba(139,61,255,0.15) 100%)',
                    border: '2px solid rgba(139,61,255,0.4)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 20, fontWeight: 800, color: '#9BD1D6',
                  }}>{initials}</div>
                )}
                {/* Online dot */}
                <div style={{
                  position: 'absolute', bottom: 2, right: 2, width: 12, height: 12,
                  borderRadius: '50%', backgroundColor: '#3ED97A',
                  border: '2px solid #170B26', boxShadow: '0 0 6px rgba(62,217,122,0.6)',
                }} />
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <h1 style={{ fontSize: 'clamp(20px, 3vw, 28px)', fontWeight: 800, color: '#fff', margin: 0, letterSpacing: '-0.01em' }}>
                    Welcome back, {session.user.name?.split(' ')[0] || 'Player'}
                  </h1>
                  {isAdmin && (
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '3px 8px', borderRadius: 999, backgroundColor: 'rgba(255,201,60,0.1)', color: '#FFC93C', border: '1px solid rgba(255,201,60,0.25)' }}>
                      Admin
                    </span>
                  )}
                </div>
                <p style={{ color: '#8891AC', fontSize: 14, margin: 0 }}>
                  {stats?.rank ? `Global Rank #${stats.rank} · ` : ''}{stats?.totalPoints?.toLocaleString() || 0} pts
                </p>
              </div>
            </div>

          </div>

          {/* ── Featured puzzle hero banner ─────────────────── */}
          <div id="tour-featured"><FeaturedBanner visible={mounted} /></div>

          {/* ── Stat cards ──────────────────────────────────── */}
          <div id="tour-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16, marginBottom: 48 }}>
            {statCards.map((s, i) => (
              <StatCard key={i} {...s} delay={0.08 + i * 0.1} visible={mounted} />
            ))}
          </div>

          {/* ── Referral widget ─────────────────────────── */}
          {referral && (
            <div className="pw-bevel" style={{
              marginBottom: 48,
              padding: '22px 26px',
              background: 'radial-gradient(320px 160px at 0% 0%, rgba(255,201,60,0.16), transparent 65%), linear-gradient(160deg, var(--pw-surface-hi), var(--pw-surface) 70%)',
              border: '1px solid rgba(255,201,60,0.3)',
              boxShadow: '0 0 24px -10px rgba(255,201,60,0.5)',
              display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16,
              opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(18px)',
              transition: 'opacity 0.6s ease 0.35s, transform 0.5s ease 0.35s',
            }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#FFC93C', marginBottom: 4, textShadow: '0 0 16px rgba(255,201,60,0.4)' }}>
                  🔗 Invite Friends
                </div>
                <div style={{ fontSize: 13, color: '#8891AC', lineHeight: 1.5 }}>
                  {referral.signedUp > 0
                    ? `${referral.signedUp} player${referral.signedUp !== 1 ? 's' : ''} joined via your link`
                    : 'Share your link — every solver on the board makes it more competitive'}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <code style={{
                  fontSize: 12, fontFamily: 'ui-monospace, monospace', color: '#FFC93C',
                  background: 'rgba(255,201,60,0.1)', border: '1px solid rgba(255,201,60,0.25)',
                  borderRadius: 8, padding: '6px 12px', letterSpacing: '0.05em',
                  maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  display: 'block',
                }}>
                  {referral.link}
                </code>
                <GameButton
                  variant={referralCopied ? 'grass' : 'gold'}
                  size="sm"
                  onClick={async () => {
                    await navigator.clipboard.writeText(referral.link);
                    setReferralCopied(true);
                    setTimeout(() => setReferralCopied(false), 2000);
                  }}
                >
                  {referralCopied ? '✓ Copied!' : 'Copy Link'}
                </GameButton>
              </div>
            </div>
          )}

          {/* ── Core nav cards ──────────────────────────────── */}
          <div style={{ marginBottom: isAdmin ? 48 : 0 }}>
            <p style={{
              fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase',
              color: '#8891AC', marginBottom: 20,
              opacity: mounted ? 1 : 0, transition: 'opacity 0.6s ease 0.4s',
            }}>
              Navigate
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
              {coreCards.map((c, i) => (
                <ActionCard key={i} {...c} delay={0.12 + i * 0.07} visible={mounted} tourId={c.tourId} />
              ))}
            </div>
          </div>

          {/* ── Admin cards ─────────────────────────────────── */}
          {isAdmin && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <p style={{
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase',
                  color: '#FFC93C', margin: 0,
                  opacity: mounted ? 1 : 0, transition: 'opacity 0.6s ease 0.5s',
                }}>
                  Admin
                </p>
                <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, rgba(255,201,60,0.25), transparent)', opacity: mounted ? 1 : 0, transition: 'opacity 0.6s ease 0.6s' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
                {adminCards.map((c, i) => (
                  <ActionCard key={i} {...c} delay={0.2 + i * 0.1} visible={mounted} />
                ))}
              </div>
            </div>
          )}

        </div>
      </main>

      <WelcomeModal
        userId={(session.user as { id?: string }).id || session.user.email || 'guest'}
      />

      {showOnboarding && (
        <DashboardTour onComplete={() => setShowOnboarding(false)} />
      )}
    </>
  );
}
