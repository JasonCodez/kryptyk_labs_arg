"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { AlertTriangle } from "lucide-react";
import DailyIntroCard from "@/components/onboarding/DailyIntroCard";
import DailyHubHeader from "@/components/daily/DailyHubHeader";
import DailyPuzzleLineup, { type DailySummary } from "@/components/daily/DailyPuzzleLineup";
import DailyLineupLoadingState from "@/components/daily/DailyLineupLoadingState";
import PageContainer from "@/components/ui/PageContainer";
import GameButton from "@/components/game-ui/GameButton";

type SummaryFetchStatus = "loading" | "ready" | "error";

function getCountdownParts(): { hh: number; mm: number; ss: number } {
  const now = new Date();
  const next = new Date();
  next.setUTCHours(24, 0, 0, 0);
  const diff = Math.max(0, next.getTime() - now.getTime());
  return {
    hh: Math.floor(diff / 3_600_000),
    mm: Math.floor((diff % 3_600_000) / 60_000),
    ss: Math.floor((diff % 60_000) / 1_000),
  };
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function getCountdown(): string {
  const { hh, mm, ss } = getCountdownParts();
  return `${pad(hh)}:${pad(mm)}:${pad(ss)}`;
}

function getCountdownLabel(): string {
  const { hh, mm, ss } = getCountdownParts();
  return `${pad(hh)} hours, ${pad(mm)} minutes, and ${pad(ss)} seconds`;
}

export default function DailyHubPage() {
  const { data: session, status: sessionStatus } = useSession();
  const isAuthenticated = sessionStatus === "authenticated";
  const onboardingUserId = session?.user
    ? (session.user as { id?: string }).id || session.user.email || "guest"
    : null;
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [summaryFetchStatus, setSummaryFetchStatus] = useState<SummaryFetchStatus>("loading");
  const [retryToken, setRetryToken] = useState(0);
  const [countdown, setCountdown] = useState("00:00:00");
  const [countdownLabel, setCountdownLabel] = useState("0 hours, 0 minutes, and 0 seconds");
  // The Debrief lives on its own system (WitnessResult, not the shared dailyPuzzleRecord/streak
  // infra the other five cards use) so its completion status is fetched separately.
  const [debriefCompleted, setDebriefCompleted] = useState(false);

  useEffect(() => {
    // Sync-on-mount so the timer shows a real value before the first tick.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCountdown(getCountdown());
    setCountdownLabel(getCountdownLabel());
    const id = window.setInterval(() => {
      setCountdown(getCountdown());
      setCountdownLabel(getCountdownLabel());
    }, 1_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    // Reset to loading on every run (including retries) so the skeleton
    // reappears instead of showing stale content while a retry is in flight.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSummaryFetchStatus("loading");
    fetch("/api/daily/summary", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`status ${r.status}`))))
      .then((data) => {
        if (cancelled) return;
        setSummary(data);
        setSummaryFetchStatus("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setSummary(null);
        setSummaryFetchStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [retryToken]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/debrief/today", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data) setDebriefCompleted(!!data.completed);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  function retry() {
    setRetryToken((token) => token + 1);
  }

  const sessionLoading = sessionStatus === "loading";
  const showLineupLoading = sessionLoading || summaryFetchStatus === "loading";

  return (
    <div
      style={{
        // Ambient brand glow over neutral navy — mirrors the app body treatment.
        background:
          "radial-gradient(1300px 800px at 15% -10%, color-mix(in srgb, var(--pw-brand-primary) 12%, transparent), transparent 62%), radial-gradient(1100px 700px at 90% 0%, color-mix(in srgb, var(--pw-brand-secondary) 8%, transparent), transparent 58%), var(--pw-bg-base)",
        minHeight: "100vh",
      }}
    >
      <main className="pt-[88px] sm:pt-24 pb-16 flex flex-col items-center">
        <PageContainer size="catalog" className="flex flex-col items-center">
          <div className="w-full max-w-5xl mx-auto flex flex-col items-center">
            <DailyHubHeader countdown={countdown} countdownLabel={countdownLabel} />

            {isAuthenticated && onboardingUserId && <DailyIntroCard userId={onboardingUserId} />}

            {showLineupLoading ? (
              <DailyLineupLoadingState />
            ) : summaryFetchStatus === "error" ? (
              <div className="w-full max-w-5xl mx-auto text-center py-12">
                <AlertTriangle aria-hidden="true" size={36} style={{ color: "var(--pw-error-text)", margin: "0 auto 14px" }} />
                <p className="text-lg font-bold mb-2" style={{ color: "var(--pw-text-primary)" }}>
                  We couldn&rsquo;t load today&rsquo;s lineup
                </p>
                <p className="text-sm mb-6" style={{ color: "var(--pw-text-secondary)" }}>
                  Check your connection and try again.
                </p>
                <GameButton onClick={retry} variant="primary" size="md">
                  Try again
                </GameButton>
              </div>
            ) : summary ? (
              <DailyPuzzleLineup summary={summary} isAuthenticated={isAuthenticated} debriefCompleted={debriefCompleted} />
            ) : null}
          </div>
        </PageContainer>
      </main>
    </div>
  );
}
