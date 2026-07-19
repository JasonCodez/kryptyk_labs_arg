"use client";

import type { ReactNode } from "react";

export interface DashboardPageShellProps {
  children: ReactNode;
  /** Marks the page region as busy while dashboard data is loading. */
  busy?: boolean;
}

/**
 * Shared page chrome for the dashboard's loaded and loading states: the navy
 * background with restrained blue/gold accents, plus the mobile-first gutters,
 * max width, and vertical rhythm — so the skeleton and the real page never
 * shift layout between each other.
 */
export default function DashboardPageShell({ children, busy = false }: DashboardPageShellProps) {
  return (
    <main
      aria-busy={busy ? "true" : undefined}
      className="min-h-screen"
      style={{
        background:
          "radial-gradient(1100px 620px at 50% -12%, color-mix(in srgb, var(--pw-brand-primary) 10%, transparent), transparent 62%), radial-gradient(820px 480px at 90% 4%, color-mix(in srgb, var(--pw-gold) 4%, transparent), transparent 55%), var(--pw-bg-base)",
      }}
    >
      <div className="mx-auto w-full max-w-[1200px] px-3 sm:px-4 pt-[88px] sm:pt-24 pb-12 sm:pb-16">
        {children}
      </div>
    </main>
  );
}
