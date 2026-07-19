'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
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
import DashboardAdminHub from '@/components/dashboard/DashboardAdminHub';

interface UserStats {
  totalPuzzlesSolved: number;
  totalPoints: number;
  currentTeams: number;
  rank: number | null;
}

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
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
          <div className={isAdmin ? 'mb-6 sm:mb-12' : undefined}>
            <DashboardNavigationHub />
          </div>

          {/* ── Admin tools hub ─────────────────────────────── */}
          {isAdmin && <DashboardAdminHub />}

      </DashboardPageShell>

      <WelcomeModal userId={onboardingUserId} />

      {showOnboarding && (
        <DashboardTour onComplete={() => setShowOnboarding(false)} />
      )}
    </>
  );
}
