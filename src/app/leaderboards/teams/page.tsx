"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, Plus, RefreshCw, Trophy, UsersRound } from "lucide-react";
import PageContainer from "@/components/ui/PageContainer";
import TeamLeaderboardLoadingState from "@/components/leaderboards/TeamLeaderboardLoadingState";
import TeamLeaderboardRankSummary from "@/components/leaderboards/TeamLeaderboardRankSummary";
import TeamLeaderboardList from "@/components/leaderboards/TeamLeaderboardList";
import TeamLeaderboardStats from "@/components/leaderboards/TeamLeaderboardStats";
import type { TeamLeaderboardDisplayEntry } from "@/components/leaderboards/TeamLeaderboardList";

interface TeamLeaderboardEntry {
  teamId: string;
  teamName: string | null;
  isPublic: boolean;
  bannerColor: string | null;
  totalPoints: number;
  totalPuzzlesSolved: number;
  memberCount: number;
  rank: number;
}

type LoadStatus = "loading" | "ready" | "error";

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--pw-brand-primary)]";

function ErrorPanel({ onRetry, pending }: { onRetry: () => void; pending: boolean }) {
  return (
    <div
      role="alert"
      className="rounded-xl border p-6 text-center sm:p-8"
      style={{
        borderColor: "var(--pw-error-text)",
        background: "color-mix(in srgb, var(--pw-error-text) 8%, var(--pw-surface-1))",
      }}
    >
      <AlertTriangle aria-hidden="true" size={28} style={{ color: "var(--pw-error-text)", margin: "0 auto" }} />
      <h2 className="mt-2 text-lg font-bold" style={{ color: "var(--pw-text-primary)" }}>
        We couldn’t load team rankings
      </h2>
      <p className="mt-2 text-sm" style={{ color: "var(--pw-text-secondary)" }}>
        Check your connection and try again.
      </p>
      <button
        type="button"
        onClick={onRetry}
        disabled={pending}
        className={`mt-4 inline-flex min-h-12 items-center gap-2 rounded-lg px-5 text-sm font-bold disabled:opacity-70 ${FOCUS_RING}`}
        style={{ minHeight: 48, background: "var(--pw-error-text)", color: "var(--pw-bg-base)" }}
      >
        <RefreshCw aria-hidden="true" size={16} />
        <span>{pending ? "Trying…" : "Try Again"}</span>
      </button>
    </div>
  );
}

function EmptyStatePanel() {
  return (
    <div
      className="rounded-xl border p-6 text-center sm:p-8"
      style={{ borderColor: "var(--pw-border-default)", background: "var(--pw-surface-1)" }}
    >
      <Trophy aria-hidden="true" size={28} style={{ color: "var(--pw-text-muted)", margin: "0 auto" }} />
      <h2 className="mt-2 text-lg font-bold" style={{ color: "var(--pw-text-primary)" }}>
        No ranked teams yet
      </h2>
      <p className="mt-2 text-sm" style={{ color: "var(--pw-text-secondary)" }}>
        Create or join a team, solve puzzles together, and claim the first ranking.
      </p>
      <div className="mt-4 flex justify-center">
        <Link
          href="/teams"
          className={`inline-flex min-h-12 items-center gap-2 rounded-lg px-5 text-sm font-bold ${FOCUS_RING}`}
          style={{ minHeight: 48, background: "var(--pw-brand-primary)", color: "var(--pw-bg-base)" }}
        >
          <UsersRound aria-hidden="true" size={16} />
          <span>Explore Teams</span>
        </Link>
      </div>
    </div>
  );
}

function PageHeader() {
  return (
    <header className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <Link
          href="/leaderboards"
          className={`inline-flex min-h-11 items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold ${FOCUS_RING}`}
          style={{
            borderColor: "var(--pw-border-default)",
            background: "var(--pw-surface-1)",
            color: "var(--pw-text-secondary)",
          }}
        >
          <ArrowLeft aria-hidden="true" size={18} />
          <span>Back to Leaderboards</span>
        </Link>
        <Link
          href="/teams"
          className={`inline-flex min-h-11 items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold ${FOCUS_RING}`}
          style={{ background: "var(--pw-brand-secondary)", color: "var(--pw-bg-base)" }}
        >
          <UsersRound aria-hidden="true" size={18} />
          <Plus aria-hidden="true" size={14} />
          <span>Explore Teams</span>
        </Link>
      </div>
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: "var(--pw-text-muted)" }}>
          PuzzleWarz Competition
        </p>
        <h1 id="team-leaderboards-title" className="mt-2 flex items-center gap-2 text-3xl font-bold sm:text-4xl" style={{ color: "var(--pw-text-primary)" }}>
          <Trophy aria-hidden="true" size={28} style={{ color: "var(--pw-brand-secondary)" }} />
          <span>Team Leaderboards</span>
        </h1>
        <p className="mt-2 max-w-2xl text-sm sm:text-base" style={{ color: "var(--pw-text-secondary)" }}>
          See which teams are climbing through shared puzzle progress.
        </p>
      </div>
    </header>
  );
}

export default function TeamLeaderboardsPage() {
  const { status } = useSession();
  const router = useRouter();

  const [entries, setEntries] = useState<TeamLeaderboardEntry[]>([]);
  const [userTeamRank, setUserTeamRank] = useState<TeamLeaderboardEntry | null>(null);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");
  const [retrying, setRetrying] = useState(false);

  const mountedRef = useRef(false);
  const requestSeqRef = useRef(0);
  const requestAbortRef = useRef<AbortController | null>(null);
  const retryInFlightRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestSeqRef.current += 1;
      requestAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/auth/signin");
    }
  }, [status, router]);

  const fetchTeamLeaderboard = useCallback(async () => {
    requestAbortRef.current?.abort();
    const seq = ++requestSeqRef.current;
    const controller = new AbortController();
    requestAbortRef.current = controller;

    setLoadStatus("loading");

    const shouldApply = () => mountedRef.current && seq === requestSeqRef.current;

    try {
      const response = await fetch("/api/leaderboards/teams", { cache: "no-store", signal: controller.signal });

      if (!shouldApply()) return;

      if (response.status === 401) {
        router.replace("/auth/signin");
        return;
      }

      if (!response.ok) {
        setLoadStatus("error");
        return;
      }

      const data = await response.json();
      if (!shouldApply()) return;

      setEntries(Array.isArray(data.entries) ? data.entries : []);
      setUserTeamRank(data.userTeamRank ?? null);
      setLoadStatus("ready");
    } catch (err) {
      if ((err as Error)?.name === "AbortError" || !shouldApply()) return;
      setLoadStatus("error");
    }
  }, [router]);

  useEffect(() => {
    if (status === "authenticated") void fetchTeamLeaderboard();
  }, [status, fetchTeamLeaderboard]);

  const retryTeamLeaderboard = useCallback(async () => {
    if (retryInFlightRef.current) return;
    retryInFlightRef.current = true;
    setRetrying(true);
    try {
      await fetchTeamLeaderboard();
    } finally {
      retryInFlightRef.current = false;
      if (mountedRef.current) setRetrying(false);
    }
  }, [fetchTeamLeaderboard]);

  const currentUserTeamId = userTeamRank?.teamId ?? null;

  const displayEntries = useMemo<TeamLeaderboardDisplayEntry[]>(
    () =>
      entries.map((entry) => ({
        teamId: entry.teamId,
        teamName: entry.teamName,
        isPublic: entry.isPublic,
        bannerColor: entry.bannerColor,
        totalPoints: entry.totalPoints,
        totalPuzzlesSolved: entry.totalPuzzlesSolved,
        memberCount: entry.memberCount,
        rank: entry.rank,
        isUserTeam: entry.teamId === currentUserTeamId,
      })),
    [entries, currentUserTeamId]
  );

  const currentTeamDisplayEntry = useMemo<TeamLeaderboardDisplayEntry | null>(
    () => (userTeamRank ? { ...userTeamRank, isUserTeam: true } : null),
    [userTeamRank]
  );

  const isBootLoading = status !== "authenticated" || loadStatus === "loading";

  return (
    <div className="min-h-screen" style={{ background: "var(--pw-bg-base)" }}>
      <PageContainer size="content" className="pb-12 pt-24 sm:pt-28">
        <div className="flex flex-col gap-6">
          <PageHeader />

          <section
            aria-labelledby="team-leaderboards-title"
            aria-busy={isBootLoading || retrying}
            className="flex flex-col gap-6"
          >
            {retrying ? (
              <ErrorPanel onRetry={() => void retryTeamLeaderboard()} pending />
            ) : isBootLoading ? (
              <TeamLeaderboardLoadingState />
            ) : loadStatus === "error" ? (
              <ErrorPanel onRetry={() => void retryTeamLeaderboard()} pending={false} />
            ) : (
              <>
                <TeamLeaderboardRankSummary entry={currentTeamDisplayEntry} />
                {entries.length === 0 ? (
                  <EmptyStatePanel />
                ) : (
                  <>
                    <TeamLeaderboardList entries={displayEntries} />
                    <TeamLeaderboardStats entries={displayEntries} />
                  </>
                )}
              </>
            )}
          </section>
        </div>
      </PageContainer>
    </div>
  );
}
