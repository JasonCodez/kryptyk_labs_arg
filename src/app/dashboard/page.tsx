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
import {
  loadOnboardingState,
  type OnboardingStatus,
} from '@/lib/onboarding';

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

  // New-Player Focus Mode: reuses the existing onboarding state (read-only,
  // never written here) to decide whether to show a trimmed-down dashboard
  // while a genuinely new player's Starter Path is active/paused.
  const [onboardingStatus, setOnboardingStatus] = useState<OnboardingStatus | null>(null);
  const [onboardingReady, setOnboardingReady] = useState(false);
  const [showFullDashboard, setShowFullDashboard] = useState(false);

  // Computed every render (not a hook) so the onboarding-read effect below
  // can depend on it while every hook above stays unconditional.
  const rawUserId = session?.user
    ? (session.user as { id?: string }).id || session.user.email || 'guest'
    : null;

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

  // Reads (never writes) the existing onboarding state once an authenticated
  // user ID is available. Resets the temporary "show everything" choice
  // whenever the authenticated user changes.
  useEffect(() => {
    if (!rawUserId) return;
    const state = loadOnboardingState(rawUserId);
    setOnboardingStatus(state.status);
    setOnboardingReady(true);
    setShowFullDashboard(false);
  }, [rawUserId]);

  /* ── Loading skeleton ─────────────────────────────────── */
  // An active-onboarding player must never briefly see the complete
  // dashboard before Focus Mode has a chance to apply, so the skeleton also
  // covers the window between "authenticated" and the onboarding read
  // finishing.
  if (
    status === 'loading' ||
    loading ||
    (status === 'authenticated' && !onboardingReady)
  ) {
    return <DashboardLoadingState />;
  }

  if (!session?.user) return null;

  const onboardingUserId = (session.user as { id?: string }).id || session.user.email || 'guest';

  const initials = (session.user.name || session.user.email || 'P')
    .split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();

  // A stats-fetch failure (stats === null) must never be treated as "the
  // player is new" — it always falls back to the normal full dashboard.
  const hasMeaningfulProgress =
    stats !== null &&
    (
      stats.totalPuzzlesSolved > 0 ||
      stats.totalPoints > 0 ||
      stats.currentTeams > 0 ||
      stats.rank !== null
    );

  const onboardingInProgress =
    onboardingStatus === 'active' ||
    onboardingStatus === 'paused';

  const shouldUseNewPlayerFocus =
    onboardingReady &&
    onboardingInProgress &&
    stats !== null &&
    !hasMeaningfulProgress &&
    !isAdmin &&
    !showFullDashboard;

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

          {/* ── New-Player Focus panel ──────────────────────── */}
          {shouldUseNewPlayerFocus && (
            <section
              data-testid="dashboard-new-player-focus"
              aria-label="New Player Focus"
              className="pw-bevel"
              style={{
                marginBottom: 40,
                padding: "18px 20px",
                borderRadius: 16,
                background: "linear-gradient(170deg, var(--pw-surface-2) 0%, var(--pw-bg-elevated) 100%)",
                border: "1px solid color-mix(in srgb, var(--pw-brand-primary) 30%, var(--pw-border-default))",
              }}
            >
              <p
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: "var(--pw-brand-accent)",
                  margin: "0 0 6px",
                }}
              >
                New Player Focus
              </p>
              <h2
                style={{
                  fontSize: 16,
                  fontWeight: 900,
                  color: "var(--pw-text-primary)",
                  margin: "0 0 6px",
                }}
              >
                Start with the essentials
              </h2>
              <p
                style={{
                  fontSize: 13,
                  lineHeight: 1.5,
                  color: "var(--pw-text-secondary)",
                  margin: "0 0 16px",
                  maxWidth: 480,
                }}
              >
                Your Starter Path is active, so we’ve kept this view focused on the places that help you begin. Every dashboard tool is still available.
              </p>
              <button
                type="button"
                data-testid="show-full-dashboard-button"
                onClick={() => setShowFullDashboard(true)}
                className="w-full sm:w-auto focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{
                  minHeight: 44,
                  padding: "12px 20px",
                  borderRadius: 10,
                  fontWeight: 700,
                  fontSize: 14,
                  color: "var(--pw-text-primary)",
                  background: "var(--pw-brand-primary)",
                  border: "1px solid var(--pw-border-default)",
                  cursor: "pointer",
                  outlineColor: "var(--pw-brand-secondary)",
                }}
              >
                Show all dashboard tools
              </button>
            </section>
          )}

          {shouldUseNewPlayerFocus ? (
            <DashboardNavigationHub mode="starter" />
          ) : (
            <div data-testid="dashboard-full-content">
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
