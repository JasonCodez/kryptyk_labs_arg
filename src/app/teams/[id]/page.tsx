"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Mail, Trophy, Users, Target, TrendingUp, Clock, Star, Activity, Palette } from "lucide-react";
import InviteTeamModal from "@/components/teams/InviteTeamModal";
import ActionModal from "@/components/ActionModal";
import ConfirmModal from "@/components/ConfirmModal";
import { getThemeConfig, THEME_CONFIGS, type ThemeConfig } from "@/lib/profileThemes";

interface TeamMember {
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  };
  role: string;
}

interface Team {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  activeTheme: string;
  members: TeamMember[];
  createdAt: string;
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function TeamDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const teamId = params.id as string;

  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [applications, setApplications] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState<string | undefined>(undefined);
  const [modalMessage, setModalMessage] = useState<string | undefined>(undefined);
  const [modalVariant, setModalVariant] = useState<"success" | "error" | "info">("info");
  const [inviteStatus, setInviteStatus] = useState<'none' | 'pending' | 'accepted' | 'declined'>('none');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMember, setConfirmMember] = useState<TeamMember | null>(null);
  const [confirmLeaveOpen, setConfirmLeaveOpen] = useState(false);

  // Team stats
  const [stats, setStats] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // Team theme picker
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [ownedTeamThemes, setOwnedTeamThemes] = useState<string[]>([]);

  useEffect(() => {
    // Allow public viewing; fetch team data regardless of auth status.
    let cancelled = false;
    const fetchTeam = async () => {
      try {
        const response = await fetch(`/api/teams/${teamId}`);
        if (response.status === 404) {
          // Team was disbanded or never existed — show clean not-found screen
          setLoading(false);
          return;
        }
        if (response.status === 403) {
          // Team exists but is private and user is not a member
          if (!cancelled) setError("private");
          if (!cancelled) setLoading(false);
          return;
        }
        if (!response.ok) throw new Error("Failed to fetch team");
        const data = await response.json();
        setTeam(data);

        // If signed-in, ask server for membership/role to avoid relying on client-side member email fields.
        if (session?.user?.email) {
          try {
            const m = await fetch(`/api/teams/${teamId}/membership`);
            if (m.ok) {
              const jr = await m.json();
              setUserRole(jr.role);
            }
            // fetch invite status for current user
            try {
              const s = await fetch(`/api/teams/${teamId}/invite-status`);
              if (s.ok) {
                const js = await s.json();
                setInviteStatus(js.status === 'declined' ? 'none' : (js.status ?? 'none'));
              }
            } catch (ie) {
              console.error('Failed to fetch invite status', ie);
            }
          } catch (e) {
            console.error('Failed to fetch membership role', e);
          }
        }
      } catch (err) {
        setError("Failed to load team");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    if (teamId) fetchTeam();
    return () => { cancelled = true; };
  }, [teamId, status, router]);

  useEffect(() => {
    // If user is admin/moderator, fetch pending applications
    if (userRole && ["admin", "moderator"].includes(userRole) && teamId) {
      (async () => {
        try {
          const res = await fetch(`/api/teams/${teamId}/applications`);
          if (!res.ok) throw new Error("Failed to fetch applications");
          const data = await res.json();
          setApplications(data || []);
        } catch (err) {
          console.error("Failed to load applications:", err);
        }
      })();
    }
  }, [userRole, teamId]);

  // Poll membership role periodically so a promoted member sees the role update without a hard refresh.
  useEffect(() => {
    if (!teamId || !session?.user?.email) return;

    let timer: any = null;
    const poll = async () => {
      try {
        const m = await fetch(`/api/teams/${teamId}/membership`);
        if (!m.ok) return;
        const js = await m.json();
        const newRole = js.role ?? null;
        if (newRole !== userRole) {
          setUserRole(newRole);
          // If promoted to admin, refresh full team details so UI updates
          if (newRole === 'admin') {
            const t = await fetch(`/api/teams/${teamId}`);
            if (t.ok) setTeam(await t.json());
          }
        }
      } catch (e) {
        // ignore
      }
    };

    // Run immediately and then every 10s
    poll();
    timer = setInterval(poll, 10000);
    return () => { if (timer) clearInterval(timer); };
  }, [teamId, session?.user?.email, userRole]);

  // Poll invite status while pending so UI updates if admin responds
  useEffect(() => {
    if (!teamId) return;
    let timer: any = null;
    const check = async () => {
      try {
        const res = await fetch(`/api/teams/${teamId}/invite-status`);
        if (!res.ok) return;
        const data = await res.json();
        if (data?.status && data.status !== inviteStatus) {
          // if declined, allow re-apply by returning to 'none'
          const newStatus = data.status === 'declined' ? 'none' : data.status;
          setInviteStatus(newStatus);
          // if accepted, refresh team and membership
          if (data.status === 'accepted') {
            const t = await fetch(`/api/teams/${teamId}`);
            if (t.ok) setTeam(await t.json());
            const m = await fetch(`/api/teams/${teamId}/membership`);
            if (m.ok) setUserRole((await m.json()).role);
          }
        }
      } catch (err) {
        // ignore
      }
    };

    if (inviteStatus === 'pending') {
      timer = setInterval(check, 5000);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [inviteStatus, teamId]);

  // Fetch team stats
  useEffect(() => {
    if (!teamId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/teams/${teamId}/stats`);
        if (res.ok && !cancelled) {
          setStats(await res.json());
        }
      } catch (e) {
        console.error("Failed to fetch team stats:", e);
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [teamId]);

  // Fetch owned team themes for admin theme picker
  useEffect(() => {
    if (userRole !== 'admin') return;
    (async () => {
      try {
        const res = await fetch('/api/store/inventory');
        if (!res.ok) return;
        const data = await res.json();
        const themes = (data.items || [])
          .filter((i: any) => i.item?.subcategory === 'team_theme')
          .map((i: any) => (i.item?.metadata as any)?.value)
          .filter(Boolean);
        setOwnedTeamThemes(themes);
      } catch (e) { /* ignore */ }
    })();
  }, [userRole]);

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#020202' }}>
        <div style={{ color: '#FDE74C' }} className="text-lg">Loading team...</div>
      </div>
    );
  }

  if (error === "private") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#020202' }}>
        <div className="text-center">
          <div className="text-5xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-white mb-2">Private Team</h2>
          <p className="mb-6" style={{ color: '#AB9F9D' }}>This team is private. You must be a member to view it.</p>
          <Link href="/leaderboards/teams" className="px-5 py-2.5 rounded-lg font-semibold text-sm transition-colors" style={{ backgroundColor: 'rgba(253,231,76,0.15)', color: '#FDE74C', border: '1px solid rgba(253,231,76,0.3)' }}>
            ← Back to Leaderboards
          </Link>
        </div>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#020202' }}>
        <div className="text-center">
          <div className="text-5xl mb-4">🏚️</div>
          <h2 className="text-2xl font-bold text-white mb-2">Team Not Found</h2>
          <p className="mb-6" style={{ color: '#AB9F9D' }}>This team may have been disbanded or the link is no longer valid.</p>
          <Link href="/teams" className="px-5 py-2.5 rounded-lg font-semibold text-sm transition-colors" style={{ backgroundColor: 'rgba(253,231,76,0.15)', color: '#FDE74C', border: '1px solid rgba(253,231,76,0.3)' }}>
            ← Back to Teams
          </Link>
        </div>
      </div>
    );
  }

  // Resolve team theme
  const t = getThemeConfig(team.activeTheme);

  const handleSetTheme = async (theme: string) => {
    try {
      const res = await fetch(`/api/teams/${teamId}/theme`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update theme');
      }
      setTeam((prev) => prev ? { ...prev, activeTheme: theme } : prev);
      setShowThemePicker(false);
    } catch (err: any) {
      setModalTitle('Theme update failed');
      setModalMessage(err?.message || 'Failed to change theme');
      setModalVariant('error');
      setModalOpen(true);
    }
  };

  return (
    <div style={{ backgroundColor: t.pageBg, backgroundImage: t.headerGradient }} className="min-h-screen">
      <div className="px-4 py-6 sm:p-8 pt-24 sm:pt-28">
      <div className="max-w-5xl mx-auto">

        {error && (
          <div className="mb-6 p-4 rounded-lg border text-white" style={{ backgroundColor: 'rgba(171, 159, 157, 0.2)', borderColor: '#AB9F9D' }}>
            {error}
          </div>
        )}

        {/* ── Team Header ── */}
        <div className="rounded-xl p-6 sm:p-8 mb-6" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.cardBorder}`, boxShadow: t.cardGlow }}>
          <div className="flex flex-col sm:flex-row items-start justify-between gap-4 mb-6">
            <div className="min-w-0">
              <h1 className="text-3xl sm:text-4xl font-bold text-white mb-1 truncate">
                {team.name}
              </h1>
              {team.description && (
                <p className="text-sm sm:text-base" style={{ color: t.subtleText }}>{team.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {team.isPublic ? (
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-500/20 text-green-300 border border-green-500/30">
                  Public
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Private
                </span>
              )}
              {stats && stats.rank > 0 && (
                <span className="px-3 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: t.primaryMuted, color: t.accentText, border: `1px solid ${t.primaryBorder}` }}>
                  <Trophy className="w-3 h-3 inline mr-1" />
                  Rank #{stats.rank}
                </span>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            {userRole === 'admin' && (
              <button
                onClick={() => setShowThemePicker(!showThemePicker)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-colors"
                style={{ backgroundColor: t.primaryMuted, color: t.primary, border: `1px solid ${t.primaryBorder}` }}
              >
                <Palette className="w-4 h-4" />
                Theme
              </button>
            )}
            {userRole && ["admin", "moderator"].includes(userRole) && (
              <button
                onClick={() => setShowInviteModal(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-colors"
                style={{ background: t.btnPrimary, color: t.btnPrimaryText }}
              >
                <Mail className="w-4 h-4" />
                Invite Members
              </button>
            )}
            {userRole && (
              <button
                onClick={() => setConfirmLeaveOpen(true)}
                className="px-4 py-2 rounded-lg font-semibold text-sm transition-colors"
                style={{ backgroundColor: 'rgba(185,28,28,0.25)', color: '#fca5a5', border: '1px solid rgba(185,28,28,0.5)' }}
              >
                Leave Team
              </button>
            )}
            {!userRole && team.isPublic && (
              session?.user?.email ? (
                inviteStatus === 'pending' ? (
                  <button disabled className="px-4 py-2 rounded-lg bg-yellow-500 text-black font-semibold text-sm opacity-70 cursor-not-allowed">
                    Application Submitted
                  </button>
                ) : (
                  <button
                    onClick={async () => {
                      setInviteStatus('pending');
                      try {
                        const res = await fetch(`/api/teams/${team.id}/apply`, { method: "POST" });
                        if (res.ok) {
                          setModalTitle('Application submitted');
                          setModalMessage('Your application was submitted. Team admins will be notified.');
                          setModalVariant('success');
                          setModalOpen(true);
                          return;
                        }
                        let body: any = null;
                        try { body = await res.json(); } catch (e) { /* ignore */ }
                        const errorMsg = body?.error || (await res.text().catch(() => null)) || 'Failed to apply';
                        if (typeof errorMsg === 'string' && /pending|already/i.test(errorMsg)) {
                          setInviteStatus('pending');
                          setModalTitle('Application pending');
                          setModalMessage('You already have a pending application or invitation.');
                          setModalVariant('info');
                          setModalOpen(true);
                          return;
                        }
                        throw new Error(errorMsg);
                      } catch (err: any) {
                        setInviteStatus('none');
                        setModalTitle('Application failed');
                        setModalMessage(err?.message || 'Failed to submit application.');
                        setModalVariant('error');
                        setModalOpen(true);
                      }
                    }}
                    className="px-4 py-2 rounded-lg bg-yellow-600 hover:bg-yellow-700 text-black font-semibold text-sm transition-colors"
                  >
                    Apply to Join
                  </button>
                )
              ) : (
                <Link
                  href="/auth/signin"
                  className="px-4 py-2 rounded-lg bg-yellow-600 hover:bg-yellow-700 text-black font-semibold text-sm transition-colors"
                >
                  Sign in to Join
                </Link>
              )
            )}
          </div>
        </div>

        {/* ── Theme Picker (admin only) ── */}
        {showThemePicker && userRole === 'admin' && (
          <div className="rounded-xl p-5 mb-6" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.cardBorder}`, boxShadow: t.cardGlow }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-bold text-sm">Choose Team Theme</h3>
              <button onClick={() => setShowThemePicker(false)} className="text-slate-400 hover:text-white text-sm">✕</button>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-2">
              {['default', ...Object.keys(THEME_CONFIGS).filter(k => k !== 'default' && (ownedTeamThemes.includes(k)))].map((key) => {
                const tc = THEME_CONFIGS[key];
                const isActive = (team.activeTheme || 'default') === key;
                return (
                  <button
                    key={key}
                    onClick={() => handleSetTheme(key)}
                    className="relative rounded-lg p-3 text-center transition-all text-xs font-semibold"
                    style={{
                      backgroundColor: isActive ? tc.primaryMuted : 'rgba(255,255,255,0.03)',
                      border: `2px solid ${isActive ? tc.primary : 'rgba(255,255,255,0.08)'}`,
                      color: tc.primary,
                    }}
                  >
                    <div className="w-6 h-6 rounded-full mx-auto mb-1" style={{ background: tc.btnPrimary.startsWith('linear') ? tc.btnPrimary : tc.primary }} />
                    <span className="capitalize">{key.replace(/_/g, ' ')}</span>
                    {isActive && <span className="absolute top-1 right-1 text-xs">✓</span>}
                  </button>
                );
              })}
              {ownedTeamThemes.length === 0 && (
                <div className="col-span-full text-center py-2">
                  <p className="text-xs" style={{ color: t.subtleText }}>No team themes owned yet.</p>
                  <Link href="/store" className="text-xs font-semibold" style={{ color: t.primary }}>Visit Store →</Link>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Stats Overview ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
          <div className="rounded-xl p-4" style={{ backgroundColor: t.statCardBg, border: `1px solid ${t.statCardBorder}`, boxShadow: t.cardGlow }}>
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="w-4 h-4" style={{ color: t.accentText }} />
              <p className="text-xs font-medium uppercase tracking-wide" style={{ color: t.subtleText }}>Rank</p>
            </div>
            {statsLoading ? (
              <div className="h-7 bg-slate-700/50 rounded animate-pulse" />
            ) : (
              <p className="text-2xl font-bold text-white">
                {stats?.rank ? `#${stats.rank}` : '—'}
                {stats?.totalTeams ? <span className="text-xs text-slate-500 font-normal ml-1">/ {stats.totalTeams}</span> : null}
              </p>
            )}
          </div>
          <div className="rounded-xl p-4" style={{ backgroundColor: t.statCardBg, border: `1px solid ${t.statCardBorder}`, boxShadow: t.cardGlow }}>
            <div className="flex items-center gap-2 mb-2">
              <Star className="w-4 h-4" style={{ color: t.primary }} />
              <p className="text-xs font-medium uppercase tracking-wide" style={{ color: t.subtleText }}>Points</p>
            </div>
            {statsLoading ? (
              <div className="h-7 bg-slate-700/50 rounded animate-pulse" />
            ) : (
              <p className="text-2xl font-bold text-white">
                {stats?.totalEarnedPoints?.toLocaleString() ?? '0'}
              </p>
            )}
          </div>
          <div className="rounded-xl p-4" style={{ backgroundColor: t.statCardBg, border: `1px solid ${t.statCardBorder}`, boxShadow: t.cardGlow }}>
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-4 h-4" style={{ color: t.primary }} />
              <p className="text-xs font-medium uppercase tracking-wide" style={{ color: t.subtleText }}>Solved</p>
            </div>
            {statsLoading ? (
              <div className="h-7 bg-slate-700/50 rounded animate-pulse" />
            ) : (
              <p className="text-2xl font-bold text-white">
                {stats?.totalPuzzlesSolved?.toLocaleString() ?? '0'}
                <span className="text-xs text-slate-500 font-normal ml-1">puzzles</span>
              </p>
            )}
          </div>
          <div className="rounded-xl p-4" style={{ backgroundColor: t.statCardBg, border: `1px solid ${t.statCardBorder}`, boxShadow: t.cardGlow }}>
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4" style={{ color: t.primary }} />
              <p className="text-xs font-medium uppercase tracking-wide" style={{ color: t.subtleText }}>Members</p>
            </div>
            <p className="text-2xl font-bold text-white">
              {team.members.length}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">

          {/* ── Top Contributors ── */}
          <div className="lg:col-span-2 rounded-xl p-6" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.cardBorder}`, boxShadow: t.cardGlow }}>
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5" style={{ color: t.accentText }} />
              <h2 className="text-lg font-bold text-white">Top Contributors</h2>
            </div>
            {statsLoading ? (
              <div className="space-y-3">
                {[1,2,3].map(i => <div key={i} className="h-12 bg-slate-700/30 rounded-lg animate-pulse" />)}
              </div>
            ) : stats?.topContributors?.length > 0 ? (
              <div className="space-y-2">
                {stats.topContributors.slice(0, 5).map((c: any, i: number) => {
                  const maxPts = stats.topContributors[0]?.earnedPoints || 1;
                  const pct = Math.max(5, Math.round((c.earnedPoints / maxPts) * 100));
                  const medals = ['🥇', '🥈', '🥉'];
                  return (
                    <div key={c.userId} className="relative">
                      <div
                        className="absolute inset-0 rounded-lg opacity-20"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: i === 0 ? '#FDE74C' : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : '#3891A6',
                        }}
                      />
                      <div className="relative flex items-center justify-between p-3 rounded-lg">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-lg w-7 h-7 flex items-center justify-center leading-none flex-shrink-0">{medals[i] ?? `${i + 1}.`}</span>
                          {c.image ? (
                            <img src={c.image} alt="" className="w-8 h-8 rounded-full object-cover object-center flex-shrink-0" />
                          ) : (
                            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm" style={{ backgroundColor: t.primaryMuted, color: t.primary }}>
                              👤
                            </div>
                          )}
                          <Link href={`/profile/${c.userId}`} className="text-white font-medium hover:underline truncate">
                            {c.name || 'Member'}
                          </Link>
                        </div>
                        <div className="text-right flex-shrink-0 ml-2">
                          <span className="text-white font-bold">{c.earnedPoints.toLocaleString()}</span>
                          <span className="text-slate-400 text-xs ml-1">pts</span>
                          <span className="text-slate-500 text-xs ml-2">{c.puzzlesSolved} solved</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-slate-400 text-sm">No activity yet. Solve puzzles to climb the ranks!</p>
            )}
          </div>

          {/* ── Team Info Sidebar ── */}
          <div className="rounded-xl p-6" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.cardBorder}`, boxShadow: t.cardGlow }}>
            <h2 className="text-lg font-bold text-white mb-4">Team Info</h2>
            <div className="space-y-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: t.subtleText }}>Created</p>
                <p className="text-white text-sm">{new Date(team.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: t.subtleText }}>Avg Points / Member</p>
                {statsLoading ? (
                  <div className="h-5 w-16 bg-slate-700/50 rounded animate-pulse" />
                ) : (
                  <p className="text-white text-sm font-semibold">{stats?.avgPointsPerMember?.toLocaleString() ?? '0'}</p>
                )}
              </div>
              {userRole && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: t.subtleText }}>Team Code</p>
                  <code className="text-xs font-mono px-2 py-1 rounded" style={{ color: t.primary, backgroundColor: t.inputBg }}>
                    {teamId.substring(0, 8)}
                  </code>
                </div>
              )}
              <div>
                <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: t.subtleText }}>Your Role</p>
                <p className="text-white text-sm">{userRole ? (userRole === 'admin' ? '👑 Admin' : userRole === 'moderator' ? '🛡️ Moderator' : 'Member') : 'Not a member'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Recent Activity ── */}
        <div className="rounded-xl p-6 mb-6" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.cardBorder}`, boxShadow: t.cardGlow }}>
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5" style={{ color: t.primary }} />
            <h2 className="text-lg font-bold text-white">Recent Activity</h2>
          </div>
          {statsLoading ? (
            <div className="space-y-3">
              {[1,2,3,4].map(i => <div key={i} className="h-10 bg-slate-700/30 rounded-lg animate-pulse" />)}
            </div>
          ) : stats?.recentActivity?.length > 0 ? (
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {stats.recentActivity.map((a: any, i: number) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-slate-900/30 border border-slate-700/30">
                  {a.userImage ? (
                    <img src={a.userImage} alt="" className="w-7 h-7 rounded-full object-cover object-center flex-shrink-0" onError={(e) => { const img = e.currentTarget as HTMLImageElement; img.onerror = null; img.src = '/images/default-avatar.svg'; }} />
                  ) : (
                    <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs" style={{ backgroundColor: t.primaryMuted, color: t.primary }}>
                      👤
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm truncate">
                      <span className="font-medium">{a.userName}</span>
                      {' solved '}
                      <span style={{ color: t.primary }}>{a.puzzleTitle || 'a puzzle'}</span>
                    </p>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      {a.difficulty && (
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                          a.difficulty === 'easy' ? 'bg-green-500/20 text-green-300' :
                          a.difficulty === 'medium' ? 'bg-yellow-500/20 text-yellow-300' :
                          a.difficulty === 'hard' ? 'bg-red-500/20 text-red-300' :
                          'bg-slate-500/20 text-slate-300'
                        }`}>
                          {a.difficulty}
                        </span>
                      )}
                      <span>+{a.pointsEarned} pts</span>
                      {a.solvedAt && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTimeAgo(new Date(a.solvedAt))}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-400 text-sm">No puzzles solved yet. Get started!</p>
          )}
        </div>

        {/* ── Members ── */}
        <div className="rounded-xl p-6 mb-6" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.cardBorder}`, boxShadow: t.cardGlow }}>
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5" style={{ color: t.primary }} />
            <h2 className="text-lg font-bold text-white">Members</h2>
            <span className="text-slate-400 text-sm">({team.members.length})</span>
          </div>
          <div className="space-y-2">
            {(stats?.topContributors || team.members).map((member: any) => {
              const m = stats?.topContributors
                ? member
                : { userId: member.user.id, name: member.user.name, image: member.user.image, role: member.role, joinedAt: null, earnedPoints: 0, puzzlesSolved: 0 };
              const teamMember = team.members.find((tm) => tm.user.id === m.userId);
              return (
                <div
                  key={m.userId}
                  className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 sm:p-4 rounded-lg bg-slate-900/30 border border-slate-700/30"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {m.image ? (
                      <img src={m.image} alt="" className="w-10 h-10 rounded-full object-cover object-center flex-shrink-0" onError={(e) => { const img = e.currentTarget as HTMLImageElement; img.onerror = null; img.src = '/images/default-avatar.svg'; }} />
                    ) : (
                      <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: t.primaryMuted, color: t.primary }}>
                        👤
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-white font-semibold truncate">
                        <Link href={`/profile/${m.userId}`} className="hover:underline">
                          {m.name || "Member"}
                        </Link>
                      </p>
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        {m.joinedAt && (
                          <span>Joined {new Date(m.joinedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        )}
                        {stats && <span>· {m.puzzlesSolved} solved · {m.earnedPoints.toLocaleString()} pts</span>}
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 sm:mt-0 flex items-center gap-2">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        (m.role || teamMember?.role) === "admin"
                          ? "bg-yellow-500/20 text-yellow-300"
                          : (m.role || teamMember?.role) === "moderator"
                          ? "bg-purple-500/20 text-purple-300"
                          : "bg-slate-600/20 text-slate-300"
                      }`}
                    >
                      {(m.role || teamMember?.role) === "admin" ? "👑 Admin" : (m.role || teamMember?.role) === "moderator" ? "🛡️ Mod" : "Member"}
                    </span>

                    {userRole && ["admin", "moderator"].includes(userRole) && session?.user?.email !== teamMember?.user?.email && teamMember && (
                      <button
                        onClick={() => {
                          setConfirmMember(teamMember);
                          setConfirmOpen(true);
                        }}
                        className="px-2.5 py-0.5 rounded bg-red-600/80 hover:bg-red-600 text-white text-xs transition-colors"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Pending Applications (admin/mod only) ── */}
        {userRole && ["admin", "moderator"].includes(userRole) && (
          <div className="rounded-xl p-6 mb-6" style={{ backgroundColor: t.cardBg, border: `1px solid ${t.cardBorder}`, boxShadow: t.cardGlow }}>
            <h2 className="text-lg font-bold text-white mb-4">Pending Applications</h2>
            {applications.length === 0 ? (
              <p className="text-sm text-slate-400">No pending applications.</p>
            ) : (
              <div className="space-y-2">
                {applications.map((app) => (
                  <div key={app.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-lg bg-slate-900/30 border border-slate-700/30">
                    <div className="flex items-center gap-3">
                      {app.user?.image ? (
                        <img src={app.user.image} alt="" className="w-10 h-10 rounded-full object-cover object-center" onError={(e) => { const img = e.currentTarget as HTMLImageElement; img.onerror = null; img.src = '/images/default-avatar.svg'; }} />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-teal-500/20 flex items-center justify-center text-teal-300">👤</div>
                      )}
                      <div>
                        <p className="text-white font-semibold">{app.user?.name || app.user?.email || 'Applicant'}</p>
                        <p className="text-xs text-slate-400">Applied {new Date(app.createdAt).toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="mt-3 sm:mt-0 flex gap-2">
                      <button
                        onClick={async () => {
                          try {
                            const res = await fetch(`/api/teams/${teamId}/applications/${app.id}`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ action: 'approve' }),
                            });
                            if (!res.ok) {
                              const txt = await res.text();
                              throw new Error(txt || 'Failed to approve applicant');
                            }
                            setApplications((prev) => prev.filter(a => a.id !== app.id));
                            const t = await fetch(`/api/teams/${teamId}`);
                            if (t.ok) setTeam(await t.json());
                            setModalTitle('Applicant approved');
                            setModalMessage('The applicant has been added to the team.');
                            setModalVariant('success');
                            setModalOpen(true);
                          } catch (err) {
                            console.error(err);
                            setModalTitle('Approve failed');
                            setModalMessage((err as any)?.message || 'Failed to approve applicant');
                            setModalVariant('error');
                            setModalOpen(true);
                          }
                        }}
                        className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm transition-colors"
                      >
                        Approve
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            const res = await fetch(`/api/teams/${teamId}/applications/${app.id}`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ action: 'deny' }),
                            });
                            if (!res.ok) {
                              const txt = await res.text();
                              throw new Error(txt || 'Failed to deny applicant');
                            }
                            setApplications((prev) => prev.filter(a => a.id !== app.id));
                            setModalTitle('Applicant denied');
                            setModalMessage('The applicant has been denied.');
                            setModalVariant('info');
                            setModalOpen(true);
                          } catch (err) {
                            console.error(err);
                            setModalTitle('Deny failed');
                            setModalMessage((err as any)?.message || 'Failed to deny applicant');
                            setModalVariant('error');
                            setModalOpen(true);
                          }
                        }}
                        className="px-3 py-1 rounded bg-red-600/80 hover:bg-red-600 text-white font-semibold text-sm transition-colors"
                      >
                        Deny
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
      </div>

      {team && (
        <InviteTeamModal
          teamId={team.id}
          teamName={team.name}
          isOpen={showInviteModal}
          onClose={() => setShowInviteModal(false)}
          onSuccess={() => {
            // Optionally refresh team data to show new member
          }}
        />
      )}
      <ConfirmModal
        isOpen={confirmOpen}
        title={`Remove member`}
        message={confirmMember ? `Are you sure you want to remove ${confirmMember.user.name || confirmMember.user.email} from the team?` : ''}
        confirmLabel="Remove"
        cancelLabel="Cancel"
        onCancel={() => { setConfirmOpen(false); setConfirmMember(null); }}
        onConfirm={async () => {
          if (!confirmMember) return;
          setConfirmOpen(false);
          try {
            const res = await fetch(`/api/teams/${team.id}/members/${confirmMember.user.id}`, {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
            });
            if (!res.ok) {
              let body: any = null;
              try { body = await res.json(); } catch (_) { /* ignore */ }
              const txt = body?.error || (await res.text().catch(() => null)) || 'Failed to remove member';
              throw new Error(txt);
            }
            // Refresh team members
            const t = await fetch(`/api/teams/${teamId}`);
            if (t.ok) setTeam(await t.json());
            setModalTitle('Member removed');
            setModalMessage(`${confirmMember.user.name || confirmMember.user.email} was removed from the team.`);
            setModalVariant('success');
            setModalOpen(true);
          } catch (err) {
            console.error(err);
            setModalTitle('Remove failed');
            setModalMessage((err as any)?.message || 'Failed to remove member');
            setModalVariant('error');
            setModalOpen(true);
          } finally {
            setConfirmMember(null);
          }
        }}
      />
      <ConfirmModal
        isOpen={confirmLeaveOpen}
        title={`Leave team`}
        message={`Are you sure you want to leave the team ${team.name}?`}
        confirmLabel="Leave"
        cancelLabel="Cancel"
        onCancel={() => setConfirmLeaveOpen(false)}
        onConfirm={async () => {
          setConfirmLeaveOpen(false);
          try {
            const res = await fetch(`/api/teams/${team.id}/membership`, { method: 'DELETE' });
            if (!res.ok) {
              // Prefer JSON error message when available
              let body: any = null;
              try { body = await res.json(); } catch (_) { /* ignore */ }
              const txt = body?.error || (await res.text().catch(() => null)) || 'Failed to leave team';
              throw new Error(txt);
            }
            setModalTitle('Left team');
            setModalMessage(`You have left ${team.name}.`);
            setModalVariant('success');
            setModalOpen(true);
            // show the modal briefly, then navigate back to teams list so user sees confirmation
            setTimeout(() => {
              try { router.push('/teams'); } catch (e) { /* ignore */ }
            }, 1200);
          } catch (err) {
            console.error(err);
            setModalTitle('Leave failed');
            setModalMessage((err as any)?.message || 'Failed to leave team');
            setModalVariant('error');
            setModalOpen(true);
          }
        }}
      />
      <ActionModal
        isOpen={modalOpen}
        title={modalTitle}
        message={modalMessage}
        variant={modalVariant}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}
