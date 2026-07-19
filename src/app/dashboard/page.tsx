'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import WelcomeModal from '@/components/WelcomeModal';
import DashboardTour from '@/components/DashboardTour';
import StarterPathCard from '@/components/onboarding/StarterPathCard';
import DashboardCommandHeader from '@/components/dashboard/DashboardCommandHeader';
import DashboardNavigationHub from '@/components/dashboard/DashboardNavigationHub';
import DashboardStatsStrip from '@/components/dashboard/DashboardStatsStrip';
import DashboardFeaturedMission from '@/components/dashboard/DashboardFeaturedMission';
import DashboardInviteCard from '@/components/dashboard/DashboardInviteCard';
import DashboardPageShell from '@/components/dashboard/DashboardPageShell';
import DashboardLoadingState from '@/components/dashboard/DashboardLoadingState';

interface UserStats {
  totalPuzzlesSolved: number;
  totalPoints: number;
  currentTeams: number;
  rank: number | null;
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
    return <DashboardLoadingState />;
  }

  if (!session?.user) return null;

  const onboardingUserId = (session.user as { id?: string }).id || session.user.email || 'guest';

  const initials = (session.user.name || session.user.email || 'P')
    .split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();

  const adminCards = [
    { href: '/admin/analytics',  icon: '📊', title: 'Analytics',         desc: 'View platform statistics and puzzle analytics.',         accent: 'teal' as const },
    { href: '/admin/puzzles',    icon: '➕', title: 'Create Puzzle',     desc: 'Add new puzzles to the platform.',                       accent: 'muted' as const },
    { href: '/admin/frequency',  icon: '📡', title: 'Frequency Admin',   desc: 'Schedule questions, reveal results, merge answers.',     accent: 'teal' as const },
    { href: '/admin/reports',    icon: '🚩', title: 'Abuse Reports',     desc: 'Review and act on user-submitted reports.',              accent: 'gold' as const },
    { href: '/admin/bug-reports',icon: '🐞', title: 'Bug Reports',       desc: 'Review player-submitted bug reports by puzzle.',         accent: 'muted' as const },
  ];

  return (
    <>
      <DashboardPageShell>
          {/* ── Player Hub command header ───────────────────── */}
          <DashboardCommandHeader
            displayName={session.user.name || 'Player'}
            initials={initials}
            avatarUrl={session.user.image}
            totalPoints={stats?.totalPoints ?? 0}
            rank={stats?.rank ?? null}
            isAdmin={isAdmin}
          />

          {/* ── Starter Path onboarding progress ────────────── */}
          <StarterPathCard userId={onboardingUserId} />

          {/* ── Featured mission card ────────────────────────── */}
          <div id="tour-featured">
            <DashboardFeaturedMission />
          </div>

          {/* ── Stat strip ───────────────────────────────────── */}
          <DashboardStatsStrip
            puzzlesSolved={stats?.totalPuzzlesSolved ?? 0}
            totalPoints={stats?.totalPoints ?? 0}
            activeTeams={stats?.currentTeams ?? 0}
            rank={stats?.rank ?? null}
          />

          {/* ── Invite Friends card ─────────────────────── */}
          {referral && (
            <DashboardInviteCard
              inviteLink={referral.link}
              signedUp={referral.signedUp}
            />
          )}

          {/* ── Core nav cards ──────────────────────────────── */}
          <div style={{ marginBottom: isAdmin ? 48 : 0 }}>
            <DashboardNavigationHub />
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

      </DashboardPageShell>

      <WelcomeModal userId={onboardingUserId} />

      {showOnboarding && (
        <DashboardTour onComplete={() => setShowOnboarding(false)} />
      )}
    </>
  );
}
