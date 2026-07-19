"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import PuzzlePlayShell from "@/components/app-shell/PuzzlePlayShell";
import RookieRunPuzzle from "@/components/onboarding/RookieRunPuzzle";

/**
 * Rookie Run Mission 01 — the guided starter puzzle. Practice only: no points,
 * XP, streaks, or puzzle records are involved.
 */
export default function RookieRunPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div
        className="flex items-center justify-center"
        style={{ minHeight: "100dvh", background: "var(--pw-bg-base)" }}
      >
        <div className="w-full px-4" style={{ maxWidth: 480 }}>
          <div
            style={{
              height: 56,
              borderRadius: 16,
              backgroundColor: "rgba(255,255,255,0.06)",
              marginBottom: 16,
              animation: "pulse 1.5s ease-in-out infinite",
            }}
          />
          <div
            style={{
              height: 220,
              borderRadius: 16,
              backgroundColor: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.06)",
              animation: "pulse 1.5s ease-in-out 0.1s infinite",
            }}
          />
        </div>
        <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
      </div>
    );
  }

  if (!session?.user) return null;

  // Same user-id derivation the dashboard uses for onboarding state.
  const userId = (session.user as { id?: string }).id || session.user.email || "guest";

  return (
    <PuzzlePlayShell backHref="/dashboard" title="Rookie Run" subtitle="Mission 01">
      <RookieRunPuzzle userId={userId} onReturnToDashboard={() => router.push("/dashboard")} />
    </PuzzlePlayShell>
  );
}
