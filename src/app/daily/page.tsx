"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import DailyIntroCard from "@/components/onboarding/DailyIntroCard";
import DailyHubHeader from "@/components/daily/DailyHubHeader";
import DailyPuzzleLineup, { type DailySummary } from "@/components/daily/DailyPuzzleLineup";
import DailyLineupLoadingState from "@/components/daily/DailyLineupLoadingState";

function getCountdown(): string {
  const now = new Date();
  const next = new Date();
  next.setUTCHours(24, 0, 0, 0);
  const diff = Math.max(0, next.getTime() - now.getTime());
  const hh = String(Math.floor(diff / 3_600_000)).padStart(2, "0");
  const mm = String(Math.floor((diff % 3_600_000) / 60_000)).padStart(2, "0");
  const ss = String(Math.floor((diff % 60_000) / 1_000)).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}


export default function DailyHubPage() {
  const { data: session, status: sessionStatus } = useSession();
  const isAuthenticated = sessionStatus === "authenticated";
  const onboardingUserId = session?.user
    ? (session.user as { id?: string }).id || session.user.email || "guest"
    : null;
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState("00:00:00");
  // The Debrief lives on its own system (WitnessResult, not the shared dailyPuzzleRecord/streak
  // infra the other five cards use) so its completion status is fetched separately.
  const [debriefCompleted, setDebriefCompleted] = useState(false);

  useEffect(() => {
    // Sync-on-mount so the timer shows a real value before the first tick.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCountdown(getCountdown());
    const id = window.setInterval(() => setCountdown(getCountdown()), 1_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/daily/summary", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled) setSummary(data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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

  return (
    <div
      style={{
        // Ambient brand glow over neutral navy — mirrors the app body treatment.
        background:
          "radial-gradient(1300px 800px at 15% -10%, color-mix(in srgb, var(--pw-brand-primary) 12%, transparent), transparent 62%), radial-gradient(1100px 700px at 90% 0%, color-mix(in srgb, var(--pw-brand-secondary) 8%, transparent), transparent 58%), var(--pw-bg-base)",
        minHeight: "100vh",
      }}
    >
      <main className="pt-[88px] sm:pt-24 pb-16 flex flex-col items-center px-3">
        <DailyHubHeader countdown={countdown} />

        {isAuthenticated && onboardingUserId && <DailyIntroCard userId={onboardingUserId} />}

        {loading ? (
          <DailyLineupLoadingState />
        ) : (
          <DailyPuzzleLineup
            summary={summary}
            isAuthenticated={isAuthenticated}
            debriefCompleted={debriefCompleted}
          />
        )}
      </main>
    </div>
  );
}
