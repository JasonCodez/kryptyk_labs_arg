"use client";

import type { CSSProperties } from "react";
import { Skeleton } from "@/components/Skeleton";
import DashboardPageShell from "./DashboardPageShell";

const PANEL_STYLE: CSSProperties = {
  borderRadius: 16,
  background: "linear-gradient(170deg, var(--pw-surface-2) 0%, var(--pw-bg-elevated) 100%)",
  border: "1px solid var(--pw-border-default)",
};

/**
 * Loading skeleton mirroring the redesigned dashboard's layout: command
 * header, featured mission, 2x2 stat strip, and two navigation-group panels.
 */
export default function DashboardLoadingState() {
  return (
    <DashboardPageShell busy>
      <p role="status" className="sr-only">
        Loading player hub
      </p>

      {/* Command-header panel */}
      <Skeleton data-testid="skeleton-command-header" style={{ ...PANEL_STYLE, height: 148, marginBottom: 48 }} />

      {/* Featured Mission panel */}
      <Skeleton data-testid="skeleton-featured-mission" style={{ ...PANEL_STYLE, height: 112, marginBottom: 40 }} />

      {/* Four-stat 2x2 area */}
      <div aria-hidden="true" data-testid="skeleton-stats" className="grid grid-cols-2 gap-3" style={{ marginBottom: 48 }}>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} style={{ ...PANEL_STYLE, height: 76 }} />
        ))}
      </div>

      {/* Navigation-group panels */}
      <div aria-hidden="true" data-testid="skeleton-navigation" className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {[0, 1].map((i) => (
          <Skeleton key={i} style={{ ...PANEL_STYLE, height: 180 }} />
        ))}
      </div>
    </DashboardPageShell>
  );
}
