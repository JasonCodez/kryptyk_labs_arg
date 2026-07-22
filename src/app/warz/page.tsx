"use client";

import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { CircleCheckBig, TriangleAlert, RefreshCw, Ban } from "lucide-react";
import PageContainer from "@/components/ui/PageContainer";
import { useAppReducedMotion } from "@/hooks/useAppReducedMotion";
import WarzLobbyHeader, { type WarzLobbyCurrentUser } from "@/components/warz/WarzLobbyHeader";
import WarzChallengeCard, { type WarzChallenge } from "@/components/warz/WarzChallengeCard";
import WarzPuzzlePickerDialog, { type EligiblePuzzle } from "@/components/warz/WarzPuzzlePickerDialog";
import WarzLobbyLoadingState from "@/components/warz/WarzLobbyLoadingState";

type TabKey = "open" | "mine" | "history";
type LobbyFetchStatus = "loading" | "ready" | "error";

const POLL_INTERVAL_MS = 30000;

const EMPTY_COPY: Record<TabKey, { heading: string; support: string }> = {
  open: { heading: "No open challenges", support: "Be the first to issue one." },
  mine: { heading: "You haven’t battled yet", support: "Issue a challenge to get started." },
  history: {
    heading: "No battle history yet",
    support: "Completed, expired, and cancelled battles will appear here.",
  },
};

function WarzLobbyInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reduceMotion = useAppReducedMotion();

  const [status, setStatus] = useState<LobbyFetchStatus>("loading");
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [currentUser, setCurrentUser] = useState<WarzLobbyCurrentUser | null>(null);
  const [challenges, setChallenges] = useState<WarzChallenge[]>([]);
  const [tab, setTab] = useState<TabKey>("open");

  const [showPicker, setShowPicker] = useState(false);
  const [eligiblePuzzles, setEligiblePuzzles] = useState<EligiblePuzzle[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const pickerFetchedRef = useRef(false);

  const [successVisible, setSuccessVisible] = useState(searchParams.get("created") === "1");

  const issueButtonRef = useRef<HTMLButtonElement>(null);
  const requestSeq = useRef(0);
  const isFetchingRef = useRef(false);
  const initialLoadDoneRef = useRef(false);

  const fetchLobby = useCallback(
    async (isBackground: boolean) => {
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;
      const seq = ++requestSeq.current;
      try {
        const [chalRes, userRes] = await Promise.all([
          fetch("/api/warz?status=ALL&limit=50"),
          fetch("/api/user/info"),
        ]);

        if (seq !== requestSeq.current) return; // stale — a newer request superseded this one

        if (userRes.status === 401) {
          router.replace("/auth/register?reason=warz");
          return;
        }

        if (!chalRes.ok || !userRes.ok) {
          if (isBackground) setRefreshFailed(true);
          else setStatus("error");
          return;
        }

        const chalData = await chalRes.json();
        const userData = await userRes.json();
        if (seq !== requestSeq.current) return;

        setChallenges(chalData.challenges ?? []);
        setCurrentUser({
          id: userData.id,
          username: userData.username ?? null,
          totalPoints: userData.totalPoints ?? 0,
          level: userData.level ?? 1,
        });
        setStatus("ready");
        setRefreshFailed(false);
      } catch {
        if (seq === requestSeq.current) {
          if (isBackground) setRefreshFailed(true);
          else setStatus("error");
        }
      } finally {
        initialLoadDoneRef.current = true;
        isFetchingRef.current = false;
      }
    },
    [router]
  );

  const retryInitial = useCallback(() => {
    setStatus("loading");
    fetchLobby(false);
  }, [fetchLobby]);

  useEffect(() => {
    fetchLobby(false);
    return () => {
      requestSeq.current += 1; // invalidates any still-in-flight response after unmount
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!initialLoadDoneRef.current) return;
      fetchLobby(true);
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchLobby]);

  useEffect(() => {
    if (!successVisible) return;
    const t = setTimeout(() => setSuccessVisible(false), 4000);
    return () => clearTimeout(t);
  }, [successVisible]);

  const requestEligiblePuzzles = useCallback(async () => {
    setPickerLoading(true);
    setPickerError(null);
    try {
      const res = await fetch("/api/warz/eligible-puzzles");
      if (!res.ok) {
        setPickerError("failed");
        return;
      }
      const data = await res.json();
      setEligiblePuzzles(data.puzzles ?? []);
      pickerFetchedRef.current = true;
    } catch {
      setPickerError("failed");
    } finally {
      setPickerLoading(false);
    }
  }, []);

  const handleOpenPicker = useCallback(() => {
    setShowPicker(true);
    if (!pickerFetchedRef.current) requestEligiblePuzzles();
  }, [requestEligiblePuzzles]);

  const handleSelectPuzzle = useCallback(
    (puzzle: EligiblePuzzle) => {
      setShowPicker(false);
      const inviteParam = searchParams.get("invite");
      const suffix = inviteParam ? `?invite=${encodeURIComponent(inviteParam)}` : "";
      router.push(`/warz/play/${puzzle.id}${suffix}`);
    },
    [router, searchParams]
  );

  const handleCancelled = useCallback((challengeId: string) => {
    setChallenges((prev) => prev.map((c) => (c.id === challengeId ? { ...c, status: "CANCELLED" } : c)));
  }, []);

  const now = Date.now();
  const featuredChallenges = useMemo(
    () =>
      challenges
        .filter((c) => c.status === "OPEN" && c.spotlightUntil && new Date(c.spotlightUntil).getTime() > now)
        .sort((a, b) => new Date(b.spotlightUntil as string).getTime() - new Date(a.spotlightUntil as string).getTime()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [challenges]
  );
  const featuredIds = useMemo(() => new Set(featuredChallenges.map((c) => c.id)), [featuredChallenges]);

  const openChallenges = challenges.filter((c) => c.status === "OPEN" && !featuredIds.has(c.id));
  const myChallenges = currentUser
    ? challenges.filter((c) => c.challenger.id === currentUser.id || c.opponent?.id === currentUser.id)
    : [];
  const historyChallenges = challenges.filter(
    (c) => c.status === "COMPLETED" || c.status === "EXPIRED" || c.status === "CANCELLED"
  );

  const openCount = challenges.filter((c) => c.status === "OPEN").length; // includes spotlighted
  const activeCount = currentUser
    ? challenges.filter(
        (c) =>
          (c.challenger.id === currentUser.id || c.opponent?.id === currentUser.id) &&
          (c.status === "OPEN" || c.status === "IN_PROGRESS")
      ).length
    : 0;
  const completedCount = challenges.filter((c) => c.status === "COMPLETED").length;

  const displayChallenges = tab === "open" ? openChallenges : tab === "mine" ? myChallenges : historyChallenges;

  const tabs: Array<{ key: TabKey; label: string; count: number }> = [
    { key: "open", label: "Open Challenges", count: openChallenges.length },
    { key: "mine", label: "My Battles", count: myChallenges.length },
    { key: "history", label: "History", count: historyChallenges.length },
  ];

  return (
    <div className="min-h-screen" style={{ background: "var(--pw-bg-base)" }}>
      <PageContainer size="catalog" className="py-8">
        <div className="mx-auto flex max-w-5xl flex-col gap-6">
          <WarzLobbyHeader
            currentUser={currentUser}
            openCount={openCount}
            activeCount={activeCount}
            completedCount={completedCount}
            targetingRival={Boolean(searchParams.get("invite"))}
            onIssueChallenge={handleOpenPicker}
            issueButtonRef={issueButtonRef}
          />

          <AnimatePresence>
            {successVisible && (
              <motion.p
                role="status"
                initial={reduceMotion ? undefined : { opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
                className="inline-flex items-center gap-2 self-center rounded-full px-4 py-2 text-sm font-bold"
                style={{
                  color: "var(--pw-success)",
                  background: "color-mix(in srgb, var(--pw-success) 12%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--pw-success) 35%, transparent)",
                }}
              >
                <CircleCheckBig aria-hidden="true" size={16} />
                Challenge posted. Waiting for an opponent.
              </motion.p>
            )}
          </AnimatePresence>

          {status === "loading" && <WarzLobbyLoadingState />}

          {status === "error" && (
            <div
              className="flex flex-col items-center gap-3 rounded-2xl p-8 text-center"
              style={{ background: "var(--pw-surface-1)" }}
            >
              <TriangleAlert aria-hidden="true" size={32} style={{ color: "var(--pw-error-text)" }} />
              <h2 className="text-lg font-extrabold" style={{ color: "var(--pw-text-primary)" }}>
                We couldn&rsquo;t load the Warz arena
              </h2>
              <p className="text-sm" style={{ color: "var(--pw-text-secondary)" }}>
                Check your connection and try again.
              </p>
              <button
                type="button"
                onClick={retryInitial}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-4 text-sm font-bold"
                style={{
                  color: "var(--pw-brand-primary)",
                  background: "color-mix(in srgb, var(--pw-brand-primary) 15%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--pw-brand-primary) 35%, transparent)",
                }}
              >
                <RefreshCw aria-hidden="true" size={15} />
                Try again
              </button>
            </div>
          )}

          {status === "ready" && (
            <>
              {refreshFailed && (
                <p className="text-center text-xs" style={{ color: "var(--pw-warning)" }}>
                  Couldn&rsquo;t refresh just now &mdash; showing the last known challenges.
                </p>
              )}

              {featuredChallenges.length > 0 && (
                <section aria-label="Spotlighted challenges" className="mx-auto flex w-full max-w-4xl flex-col gap-3">
                  <h2
                    className="text-sm font-extrabold uppercase tracking-widest"
                    style={{ color: "var(--pw-brand-secondary)" }}
                  >
                    Spotlighted Challenges
                  </h2>
                  {featuredChallenges.map((c) => (
                    <WarzChallengeCard
                      key={c.id}
                      challenge={c}
                      currentUserId={currentUser?.id ?? ""}
                      featured
                      onCancelled={handleCancelled}
                    />
                  ))}
                </section>
              )}

              <div className="mx-auto w-full max-w-4xl">
                <div
                  role="tablist"
                  aria-label="Challenge groups"
                  className="mb-4 flex gap-1 rounded-xl p-1"
                  style={{ background: "var(--pw-surface-2)" }}
                >
                  {tabs.map((t) => {
                    const selected = tab === t.key;
                    return (
                      <button
                        key={t.key}
                        type="button"
                        role="tab"
                        aria-selected={selected}
                        aria-controls={`warz-tabpanel-${t.key}`}
                        id={`warz-tab-${t.key}`}
                        onClick={() => setTab(t.key)}
                        className="min-h-11 flex-1 rounded-lg px-2 text-xs font-bold sm:text-sm"
                        style={{
                          background: selected
                            ? "color-mix(in srgb, var(--pw-brand-secondary) 18%, transparent)"
                            : "transparent",
                          color: selected ? "var(--pw-brand-secondary)" : "var(--pw-text-muted)",
                        }}
                      >
                        {t.label} ({t.count})
                      </button>
                    );
                  })}
                </div>

                <div
                  role="tabpanel"
                  id={`warz-tabpanel-${tab}`}
                  aria-labelledby={`warz-tab-${tab}`}
                  className="flex flex-col gap-3"
                >
                  {displayChallenges.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-12 text-center">
                      <Ban aria-hidden="true" size={28} style={{ color: "var(--pw-text-muted)" }} />
                      <h3 className="text-sm font-bold" style={{ color: "var(--pw-text-primary)" }}>
                        {EMPTY_COPY[tab].heading}
                      </h3>
                      <p className="text-xs" style={{ color: "var(--pw-text-muted)" }}>
                        {EMPTY_COPY[tab].support}
                      </p>
                    </div>
                  ) : (
                    displayChallenges.map((c) => (
                      <WarzChallengeCard
                        key={c.id}
                        challenge={c}
                        currentUserId={currentUser?.id ?? ""}
                        onCancelled={handleCancelled}
                      />
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </PageContainer>

      <WarzPuzzlePickerDialog
        open={showPicker}
        puzzles={eligiblePuzzles}
        loading={pickerLoading}
        error={pickerError}
        onRetry={requestEligiblePuzzles}
        onSelect={handleSelectPuzzle}
        onClose={() => setShowPicker(false)}
        returnFocusRef={issueButtonRef}
      />
    </div>
  );
}

export default function WarzLobbyPage() {
  return (
    <Suspense>
      <WarzLobbyInner />
    </Suspense>
  );
}
