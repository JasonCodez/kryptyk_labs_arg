"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, Lock, RefreshCw, Trophy, UsersRound } from "lucide-react";
import InviteTeamModal from "@/components/teams/InviteTeamModal";
import ActionModal from "@/components/ActionModal";
import ConfirmModal from "@/components/ConfirmModal";
import { getThemeConfig } from "@/lib/profileThemes";
import PageContainer from "@/components/ui/PageContainer";
import TeamDetailLoadingState from "@/components/teams/TeamDetailLoadingState";
import TeamDetailHero from "@/components/teams/TeamDetailHero";
import TeamDetailActions, { type TeamInviteStatus } from "@/components/teams/TeamDetailActions";
import TeamThemePicker from "@/components/teams/TeamThemePicker";
import TeamApplicationsPanel, {
  normalizeTeamApplications,
  type TeamApplication,
  type ApplicationsLoadStatus,
  type PendingApplicationAction,
} from "@/components/teams/TeamApplicationsPanel";
import TeamDetailReadOnlyContent, {
  normalizeTeamDetailStats,
  type TeamDetailMember,
  type TeamDetailStatsData,
} from "@/components/teams/TeamDetailReadOnlyContent";

interface TeamMember {
  user: {
    id: string;
    name: string | null;
    email: string | null | undefined;
    image: string | null;
  };
  role: string;
}

interface Team {
  id: string;
  name: string | null;
  description: string | null;
  isPublic: boolean;
  activeTheme: string;
  createdAt: string | null;
  members: TeamMember[];
}

type TeamLoadStatus = "loading" | "ready" | "private" | "not-found" | "error";

function isTeamMember(value: unknown): value is TeamMember {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const m = value as Record<string, unknown>;
  const user = m.user;
  if (typeof user !== "object" || user === null || Array.isArray(user)) return false;
  const u = user as Record<string, unknown>;
  return (
    typeof u.id === "string" &&
    (typeof u.name === "string" || u.name === null) &&
    (typeof u.image === "string" || u.image === null) &&
    (typeof u.email === "string" || u.email === null || u.email === undefined) &&
    typeof m.role === "string"
  );
}

// Defends against a malformed or partial primary Team API payload before it
// ever reaches state. Rejects a malformed base object outright (the caller
// falls back to the normal primary-load error state); individually
// malformed members are simply filtered out rather than rejecting the whole
// team, since a bad member row shouldn't hide an otherwise-valid team.
function normalizeTeamPayload(value: unknown): Team | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;

  if (typeof v.id !== "string") return null;
  if (typeof v.name !== "string" && v.name !== null) return null;
  if (typeof v.description !== "string" && v.description !== null) return null;
  if (typeof v.isPublic !== "boolean") return null;
  if (v.activeTheme !== undefined && v.activeTheme !== null && typeof v.activeTheme !== "string") return null;
  if (typeof v.createdAt !== "string" && v.createdAt !== null && v.createdAt !== undefined) return null;
  if (!Array.isArray(v.members)) return null;

  return {
    id: v.id,
    name: (v.name as string | null) ?? null,
    description: (v.description as string | null) ?? null,
    isPublic: v.isPublic,
    activeTheme: typeof v.activeTheme === "string" && v.activeTheme.trim() ? v.activeTheme : "default",
    createdAt: typeof v.createdAt === "string" ? v.createdAt : null,
    members: v.members.filter(isTeamMember),
  };
}

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--pw-brand-primary)]";

function ShellWrapper({ children }: { children: ReactNode }) {
  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--pw-bg-base)", paddingTop: "calc(56px + env(safe-area-inset-top, 0px))" }}
    >
      <PageContainer size="catalog" className="pb-12 pt-6">
        <div className="mx-auto w-full max-w-5xl">{children}</div>
      </PageContainer>
    </div>
  );
}

function PrivateTeamPanel() {
  return (
    <ShellWrapper>
      <div
        className="rounded-2xl border p-8 text-center"
        style={{ borderColor: "var(--pw-border-default)", background: "var(--pw-surface-1)" }}
      >
        <Lock aria-hidden="true" size={32} style={{ color: "var(--pw-text-muted)", margin: "0 auto" }} />
        <h1 className="mt-3 text-xl font-bold" style={{ color: "var(--pw-text-primary)" }}>Private Team</h1>
        <p className="mt-2 text-sm" style={{ color: "var(--pw-text-secondary)" }}>
          This team is private. You must be a member to view it.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link
            href="/leaderboards/teams"
            className={`inline-flex min-h-11 items-center gap-2 rounded-lg px-4 text-sm font-bold ${FOCUS_RING}`}
            style={{ background: "var(--pw-brand-primary)", color: "var(--pw-bg-base)" }}
          >
            <ArrowLeft aria-hidden="true" size={16} />
            <span>Back to Team Leaderboards</span>
          </Link>
          <Link
            href="/teams"
            className={`inline-flex min-h-11 items-center gap-2 rounded-lg border px-4 text-sm font-bold ${FOCUS_RING}`}
            style={{ borderColor: "var(--pw-border-default)", color: "var(--pw-text-secondary)" }}
          >
            <UsersRound aria-hidden="true" size={16} />
            <span>Explore Teams</span>
          </Link>
        </div>
      </div>
    </ShellWrapper>
  );
}

function TeamNotFoundPanel() {
  return (
    <ShellWrapper>
      <div
        className="rounded-2xl border p-8 text-center"
        style={{ borderColor: "var(--pw-border-default)", background: "var(--pw-surface-1)" }}
      >
        <UsersRound aria-hidden="true" size={32} style={{ color: "var(--pw-text-muted)", margin: "0 auto" }} />
        <h1 className="mt-3 text-xl font-bold" style={{ color: "var(--pw-text-primary)" }}>Team not found</h1>
        <p className="mt-2 text-sm" style={{ color: "var(--pw-text-secondary)" }}>
          This team may have been disbanded, or the link is no longer valid.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link
            href="/teams"
            className={`inline-flex min-h-11 items-center gap-2 rounded-lg px-4 text-sm font-bold ${FOCUS_RING}`}
            style={{ background: "var(--pw-brand-primary)", color: "var(--pw-bg-base)" }}
          >
            <UsersRound aria-hidden="true" size={16} />
            <span>Explore Teams</span>
          </Link>
          <Link
            href="/leaderboards/teams"
            className={`inline-flex min-h-11 items-center gap-2 rounded-lg border px-4 text-sm font-bold ${FOCUS_RING}`}
            style={{ borderColor: "var(--pw-border-default)", color: "var(--pw-text-secondary)" }}
          >
            <Trophy aria-hidden="true" size={16} />
            <span>Team Leaderboards</span>
          </Link>
        </div>
      </div>
    </ShellWrapper>
  );
}

function TeamLoadErrorPanel({ onRetry, pending }: { onRetry: () => void; pending: boolean }) {
  return (
    <ShellWrapper>
      <div
        role="alert"
        className="rounded-2xl border p-8 text-center"
        style={{
          borderColor: "var(--pw-error-text)",
          background: "color-mix(in srgb, var(--pw-error-text) 8%, var(--pw-surface-1))",
        }}
      >
        <AlertTriangle aria-hidden="true" size={32} style={{ color: "var(--pw-error-text)", margin: "0 auto" }} />
        <h1 className="mt-3 text-xl font-bold" style={{ color: "var(--pw-text-primary)" }}>We couldn’t load this team</h1>
        <p className="mt-2 text-sm" style={{ color: "var(--pw-text-secondary)" }}>
          Check your connection and try again.
        </p>
        <button
          type="button"
          onClick={onRetry}
          disabled={pending}
          className={`mt-5 inline-flex min-h-12 items-center gap-2 rounded-lg px-5 text-sm font-bold disabled:opacity-70 ${FOCUS_RING}`}
          style={{ minHeight: 48, background: "var(--pw-error-text)", color: "var(--pw-bg-base)" }}
        >
          <RefreshCw aria-hidden="true" size={16} />
          <span>{pending ? "Trying…" : "Try Again"}</span>
        </button>
      </div>
    </ShellWrapper>
  );
}

export default function TeamDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const teamId = params.id as string;

  const [team, setTeam] = useState<Team | null>(null);
  const [teamLoadStatus, setTeamLoadStatus] = useState<TeamLoadStatus>("loading");
  const [retrying, setRetrying] = useState(false);

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [applications, setApplications] = useState<TeamApplication[]>([]);
  const [applicationsLoadStatus, setApplicationsLoadStatus] = useState<ApplicationsLoadStatus>("idle");
  const [pendingApplicationAction, setPendingApplicationAction] = useState<PendingApplicationAction | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState<string | undefined>(undefined);
  const [modalMessage, setModalMessage] = useState<string | undefined>(undefined);
  const [modalVariant, setModalVariant] = useState<"success" | "error" | "info">("info");
  const [inviteStatus, setInviteStatus] = useState<TeamInviteStatus>('none');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMember, setConfirmMember] = useState<TeamMember | null>(null);
  const [confirmLeaveOpen, setConfirmLeaveOpen] = useState(false);

  const [stats, setStats] = useState<TeamDetailStatsData | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const [showThemePicker, setShowThemePicker] = useState(false);
  const [ownedTeamThemes, setOwnedTeamThemes] = useState<string[]>([]);

  const mountedRef = useRef(false);
  const teamRequestSeqRef = useRef(0);
  const teamAbortRef = useRef<AbortController | null>(null);
  const retryInFlightRef = useRef(false);
  const statsRequestSeqRef = useRef(0);
  const statsAbortRef = useRef<AbortController | null>(null);
  const applicationsRequestSeqRef = useRef(0);
  const applicationsAbortRef = useRef<AbortController | null>(null);
  const applicationActionInFlightRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      teamRequestSeqRef.current += 1;
      teamAbortRef.current?.abort();
      statsRequestSeqRef.current += 1;
      statsAbortRef.current?.abort();
      applicationsRequestSeqRef.current += 1;
      applicationsAbortRef.current?.abort();
    };
  }, []);

  const loadTeam = useCallback(async () => {
    teamAbortRef.current?.abort();
    const seq = ++teamRequestSeqRef.current;
    const controller = new AbortController();
    teamAbortRef.current = controller;

    setTeamLoadStatus("loading");
    setTeam(null);

    const shouldApply = () => mountedRef.current && seq === teamRequestSeqRef.current;

    try {
      const response = await fetch(`/api/teams/${teamId}`, { cache: "no-store", signal: controller.signal });
      if (!shouldApply()) return;

      if (response.status === 403) {
        setTeamLoadStatus("private");
        return;
      }
      if (response.status === 404) {
        setTeamLoadStatus("not-found");
        return;
      }
      if (!response.ok) {
        setTeamLoadStatus("error");
        return;
      }

      const data = await response.json();
      if (!shouldApply()) return;

      const normalized = normalizeTeamPayload(data);
      if (!normalized) {
        setTeamLoadStatus("error");
        return;
      }

      setTeam(normalized);
      setTeamLoadStatus("ready");
    } catch (err) {
      if ((err as Error)?.name === "AbortError" || !shouldApply()) return;
      setTeamLoadStatus("error");
    }
  }, [teamId]);

  useEffect(() => {
    if (status === "loading") return;
    if (teamId) void loadTeam();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, status]);

  const retryTeamLoad = useCallback(async () => {
    if (retryInFlightRef.current) return;
    retryInFlightRef.current = true;
    setRetrying(true);
    try {
      await loadTeam();
    } finally {
      retryInFlightRef.current = false;
      if (mountedRef.current) setRetrying(false);
    }
  }, [loadTeam]);

  // Initial membership/invite-status lookup once a team has loaded successfully and the
  // visitor is signed in — mirrors the existing polling effects' own immediate call below,
  // just triggered by the primary team becoming ready rather than embedded in loadTeam.
  useEffect(() => {
    if (teamLoadStatus !== "ready" || !session?.user?.email || !teamId) return;
    let cancelled = false;
    (async () => {
      try {
        const m = await fetch(`/api/teams/${teamId}/membership`);
        if (!cancelled && m.ok) {
          const jr = await m.json();
          setUserRole(jr.role);
        }
      } catch (e) {
        console.error('Failed to fetch membership role', e);
      }
      try {
        const s = await fetch(`/api/teams/${teamId}/invite-status`);
        if (!cancelled && s.ok) {
          const js = await s.json();
          setInviteStatus(js.status === 'declined' ? 'none' : (js.status ?? 'none'));
        }
      } catch (ie) {
        console.error('Failed to fetch invite status', ie);
      }
    })();
    return () => { cancelled = true; };
  }, [teamLoadStatus, session?.user?.email, teamId]);

  // Load pending applications for admins/moderators — its own stale-safe
  // request lifecycle (seq/AbortController), mirroring the primary team and
  // statistics loaders. Not polled: this remains the existing one-time,
  // role-triggered loading cadence.
  const loadApplications = useCallback(async () => {
    if (!teamId) return;
    applicationsAbortRef.current?.abort();
    const seq = ++applicationsRequestSeqRef.current;
    const controller = new AbortController();
    applicationsAbortRef.current = controller;
    setApplicationsLoadStatus("loading");

    const shouldApply = () => mountedRef.current && seq === applicationsRequestSeqRef.current;

    try {
      const res = await fetch(`/api/teams/${teamId}/applications`, { cache: "no-store", signal: controller.signal });
      if (!shouldApply()) return;
      if (!res.ok) {
        setApplicationsLoadStatus("error");
        return;
      }
      const data = await res.json();
      if (!shouldApply()) return;
      setApplications(normalizeTeamApplications(data));
      setApplicationsLoadStatus("ready");
    } catch (err) {
      if ((err as Error)?.name === "AbortError" || !shouldApply()) return;
      setApplicationsLoadStatus("error");
    }
  }, [teamId]);

  useEffect(() => {
    const isApplicationsManager = userRole === "admin" || userRole === "moderator";

    if (!isApplicationsManager) {
      // Role lost (or never granted) — abort any in-flight request,
      // invalidate its sequence, and clear previously loaded data.
      applicationsAbortRef.current?.abort();
      applicationsRequestSeqRef.current += 1;
      setApplications([]);
      setApplicationsLoadStatus("idle");
      return;
    }

    void loadApplications();

    return () => {
      applicationsRequestSeqRef.current += 1;
      applicationsAbortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
            if (t.ok) {
              const normalized = normalizeTeamPayload(await t.json());
              if (normalized) setTeam(normalized);
            }
          }
        }
      } catch {
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
            if (t.ok) {
              const normalized = normalizeTeamPayload(await t.json());
              if (normalized) setTeam(normalized);
            }
            const m = await fetch(`/api/teams/${teamId}/membership`);
            if (m.ok) setUserRole((await m.json()).role);
          }
        }
      } catch {
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

  // Fetch team stats — only once the primary team has loaded successfully; stale-safe via
  // its own sequence/AbortController, independent of the primary team request lifecycle.
  useEffect(() => {
    if (teamLoadStatus !== "ready") return;

    const seq = ++statsRequestSeqRef.current;
    const controller = new AbortController();
    statsAbortRef.current = controller;
    setStatsLoading(true);
    setStats(null);

    const shouldApply = () => mountedRef.current && seq === statsRequestSeqRef.current;

    (async () => {
      try {
        const res = await fetch(`/api/teams/${teamId}/stats`, { cache: "no-store", signal: controller.signal });
        if (!shouldApply()) return;
        if (!res.ok) {
          setStats(null);
          return;
        }
        const data = await res.json();
        if (!shouldApply()) return;
        setStats(normalizeTeamDetailStats(data));
      } catch (err) {
        if ((err as Error)?.name === "AbortError" || !shouldApply()) return;
        setStats(null);
      } finally {
        if (shouldApply()) setStatsLoading(false);
      }
    })();

    return () => {
      statsRequestSeqRef.current += 1;
      controller.abort();
    };
  }, [teamLoadStatus, teamId]);

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
      } catch { /* ignore */ }
    })();
  }, [userRole]);

  // A retry is itself a foreground load, which flips teamLoadStatus back to
  // "loading" — but the retry button (with its pending "Trying…" state) must
  // stay visible rather than being replaced by the full skeleton, so this
  // check must run before the loading-skeleton branch below.
  if (retrying) {
    return <TeamLoadErrorPanel onRetry={() => void retryTeamLoad()} pending />;
  }

  if (status === "loading" || teamLoadStatus === "loading") {
    return <ShellWrapper><TeamDetailLoadingState /></ShellWrapper>;
  }

  if (teamLoadStatus === "private") {
    return <PrivateTeamPanel />;
  }

  if (teamLoadStatus === "not-found") {
    return <TeamNotFoundPanel />;
  }

  if (teamLoadStatus === "error" || !team) {
    return <TeamLoadErrorPanel onRetry={() => void retryTeamLoad()} pending={false} />;
  }

  const theme = getThemeConfig(team.activeTheme);
  const displayTeamName = team.name && team.name.trim() ? team.name : "Unnamed Team";

  const handleSetTheme = async (themeKey: string) => {
    try {
      const res = await fetch(`/api/teams/${teamId}/theme`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: themeKey }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update theme');
      }
      setTeam((prev) => prev ? { ...prev, activeTheme: themeKey } : prev);
      setShowThemePicker(false);
    } catch (err: any) {
      setModalTitle('Theme update failed');
      setModalMessage(err?.message || 'Failed to change theme');
      setModalVariant('error');
      setModalOpen(true);
    }
  };

  const handleApplyToJoin = async () => {
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
      try { body = await res.json(); } catch { /* ignore */ }
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
  };

  const handleApplicationDecision = async (applicationId: string, action: "approve" | "deny") => {
    if (applicationActionInFlightRef.current) return;
    applicationActionInFlightRef.current = true;
    setPendingApplicationAction({ applicationId, action });
    try {
      const res = await fetch(`/api/teams/${teamId}/applications/${applicationId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || (action === "approve" ? "Failed to approve applicant" : "Failed to deny applicant"));
      }
      setApplications((prev) => prev.filter((a) => a.id !== applicationId));
      if (action === "approve") {
        // Best-effort only: the approval itself already succeeded above, so a
        // failed/rejected/malformed refresh here must never turn a successful
        // approval into a reported failure.
        try {
          const t = await fetch(`/api/teams/${teamId}`);
          if (t.ok) {
            const normalized = normalizeTeamPayload(await t.json());
            if (normalized) setTeam(normalized);
          }
        } catch {
          // Ignore — approval already succeeded.
        }
        setModalTitle('Applicant approved');
        setModalMessage('The applicant has been added to the team.');
        setModalVariant('success');
        setModalOpen(true);
      } else {
        setModalTitle('Applicant denied');
        setModalMessage('The applicant has been denied.');
        setModalVariant('info');
        setModalOpen(true);
      }
    } catch (err) {
      console.error(err);
      setModalTitle(action === "approve" ? 'Approve failed' : 'Deny failed');
      setModalMessage((err as any)?.message || (action === "approve" ? 'Failed to approve applicant' : 'Failed to deny applicant'));
      setModalVariant('error');
      setModalOpen(true);
    } finally {
      applicationActionInFlightRef.current = false;
      if (mountedRef.current) setPendingApplicationAction(null);
    }
  };

  const readOnlyMembers: TeamDetailMember[] = team.members;

  const renderMemberAction = (member: TeamDetailMember): ReactNode => {
    if (!(userRole && ["admin", "moderator"].includes(userRole))) return null;
    if (session?.user?.email && session.user.email === member.user.email) return null;
    return (
      <button
        type="button"
        onClick={() => {
          setConfirmMember({
            user: { id: member.user.id, name: member.user.name, email: member.user.email ?? null, image: member.user.image },
            role: member.role,
          });
          setConfirmOpen(true);
        }}
        className="px-2.5 py-0.5 rounded text-xs font-semibold transition-colors hover:opacity-80"
        style={{ backgroundColor: "rgba(255,59,92,0.18)", color: "#FF3B5C" }}
      >
        Remove
      </button>
    );
  };

  const heroActions = (
    <TeamDetailActions
      userRole={userRole}
      isPublic={team.isPublic}
      isAuthenticated={!!session?.user?.email}
      inviteStatus={inviteStatus}
      themePickerOpen={showThemePicker}
      theme={theme}
      onToggleThemePicker={() => setShowThemePicker((v) => !v)}
      onInviteMembers={() => setShowInviteModal(true)}
      onLeaveTeam={() => setConfirmLeaveOpen(true)}
      onApplyToJoin={() => void handleApplyToJoin()}
    />
  );

  return (
    <div style={{ backgroundColor: theme.pageBg, backgroundImage: theme.headerGradient }} className="min-h-screen">
      <PageContainer size="catalog" className="pb-12 pt-24 sm:pt-28">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
          <TeamDetailHero
            teamId={teamId}
            name={team.name}
            description={team.description}
            isPublic={team.isPublic}
            createdAt={team.createdAt}
            userRole={userRole}
            rank={stats?.rank ?? null}
            totalTeams={stats?.totalTeams ?? null}
            theme={theme}
            actions={heroActions}
          />

          {/* ── Theme Picker (admin only) ── */}
          {showThemePicker && userRole === 'admin' && (
            <TeamThemePicker
              activeTheme={team.activeTheme}
              ownedTeamThemes={ownedTeamThemes}
              theme={theme}
              onClose={() => setShowThemePicker(false)}
              onSelectTheme={(themeKey) => void handleSetTheme(themeKey)}
            />
          )}

          <TeamDetailReadOnlyContent
            members={readOnlyMembers}
            stats={stats}
            statsLoading={statsLoading}
            theme={theme}
            renderMemberAction={renderMemberAction}
          />

          {/* ── Pending Applications (admin/mod only) ── */}
          {userRole && ["admin", "moderator"].includes(userRole) && (
            <TeamApplicationsPanel
              applications={applications}
              loadStatus={applicationsLoadStatus}
              pendingAction={pendingApplicationAction}
              theme={theme}
              onApprove={(applicationId) => void handleApplicationDecision(applicationId, "approve")}
              onDeny={(applicationId) => void handleApplicationDecision(applicationId, "deny")}
              onRetry={() => void loadApplications()}
            />
          )}
        </div>
      </PageContainer>

      {team && (
        <InviteTeamModal
          teamId={team.id}
          teamName={displayTeamName}
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
            if (t.ok) {
              const normalized = normalizeTeamPayload(await t.json());
              if (normalized) setTeam(normalized);
            }
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
        message={`Are you sure you want to leave the team ${displayTeamName}?`}
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
            setModalMessage(`You have left ${displayTeamName}.`);
            setModalVariant('success');
            setModalOpen(true);
            // show the modal briefly, then navigate back to teams list so user sees confirmation
            setTimeout(() => {
              try { router.push('/teams'); } catch { /* ignore */ }
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
