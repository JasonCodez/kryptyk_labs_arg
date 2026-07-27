"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Check, ClipboardList, RefreshCw, UserRound, X } from "lucide-react";
import { Skeleton } from "@/components/Skeleton";
import type { ThemeConfig } from "@/lib/profileThemes";

export interface TeamApplication {
  id: string;
  createdAt: string | null;
  user: {
    id: string | null;
    name: string | null;
    image: string | null;
  } | null;
}

export type ApplicationsLoadStatus = "idle" | "loading" | "ready" | "error";
export type ApplicationDecision = "approve" | "deny";

export interface PendingApplicationAction {
  applicationId: string;
  action: ApplicationDecision;
}

export interface TeamApplicationsPanelProps {
  applications: readonly TeamApplication[];
  loadStatus: ApplicationsLoadStatus;
  pendingAction: PendingApplicationAction | null;
  theme: ThemeConfig;
  onApprove: (applicationId: string) => void;
  onDeny: (applicationId: string) => void;
  onRetry: () => void;
}

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--pw-brand-primary)]";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeDisplayString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeApplicationUser(value: unknown): TeamApplication["user"] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  const id = typeof v.id === "string" ? v.id : null;
  return {
    id,
    name: normalizeDisplayString(v.name),
    image: normalizeDisplayString(v.image),
  };
}

export function normalizeTeamApplications(value: unknown): TeamApplication[] {
  if (!Array.isArray(value)) return [];

  const result: TeamApplication[] = [];
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) continue;
    const e = entry as Record<string, unknown>;
    if (!isNonEmptyString(e.id)) continue;

    const createdAtMs = typeof e.createdAt === "string" ? new Date(e.createdAt).getTime() : NaN;
    result.push({
      id: e.id,
      createdAt: Number.isFinite(createdAtMs) ? (e.createdAt as string) : null,
      user: normalizeApplicationUser(e.user),
    });
  }
  return result;
}

export function getApplicationDisplayName(application: TeamApplication): string {
  const name = application.user?.name;
  return isNonEmptyString(name) ? name.trim() : "Applicant";
}

export function formatApplicationDate(createdAt: string | null): string {
  if (!createdAt) return "Date unavailable";
  const ms = new Date(createdAt).getTime();
  if (!Number.isFinite(ms)) return "Date unavailable";
  return new Date(ms).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function getApplicationInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "A";
  if (words.length === 1) return words[0]!.charAt(0).toUpperCase();
  return (words[0]!.charAt(0) + words[1]!.charAt(0)).toUpperCase();
}

function ApplicantAvatar({ image, displayName, theme }: { image: string | null; displayName: string; theme: ThemeConfig }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [image]);
  const trimmedUrl = (image ?? "").trim();

  if (trimmedUrl.length > 0 && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- arbitrary user-supplied/remote URLs
      <img
        src={trimmedUrl}
        alt=""
        onError={() => setFailed(true)}
        className="h-10 w-10 shrink-0 rounded-full object-cover"
        style={{ border: "1px solid var(--pw-border-default)" }}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold"
      style={{ background: theme.primaryMuted, color: theme.primary, border: `1px solid ${theme.primaryBorder}` }}
    >
      {displayName === "Applicant" ? <UserRound aria-hidden="true" size={18} /> : getApplicationInitials(displayName)}
    </span>
  );
}

function RetryButton({ onRetry }: { onRetry: () => void }) {
  return (
    <button
      type="button"
      onClick={onRetry}
      className={`mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg px-4 text-sm font-bold ${FOCUS_RING}`}
      style={{ background: "var(--pw-error-text)", color: "var(--pw-bg-base)" }}
    >
      <RefreshCw aria-hidden="true" size={16} />
      <span>Try Again</span>
    </button>
  );
}

export default function TeamApplicationsPanel({
  applications,
  loadStatus,
  pendingAction,
  theme,
  onApprove,
  onDeny,
  onRetry,
}: TeamApplicationsPanelProps) {
  const isMutating = pendingAction !== null;

  return (
    <div
      data-testid="team-applications-panel"
      aria-busy={isMutating}
      className="pw-bevel p-5 sm:p-6"
      style={{ backgroundColor: theme.cardBg, border: `1px solid ${theme.cardBorder}`, boxShadow: theme.cardGlow }}
    >
      <h2 className="mb-4 text-lg font-bold" style={{ color: "var(--pw-text-primary)" }}>
        Pending Applications
      </h2>

      {loadStatus === "loading" && (
        <div role="status" aria-label="Loading pending applications" className="space-y-2">
          <span className="sr-only">Loading pending applications</span>
          <Skeleton className="h-16 rounded-lg" />
          <Skeleton className="h-16 rounded-lg" />
        </div>
      )}

      {loadStatus === "error" && (
        <div role="alert" className="text-center py-2">
          <AlertTriangle aria-hidden="true" size={22} style={{ color: "var(--pw-error-text)", margin: "0 auto" }} />
          <p className="mt-2 text-sm" style={{ color: "var(--pw-text-secondary)" }}>
            Applications couldn’t be loaded.
          </p>
          <RetryButton onRetry={onRetry} />
        </div>
      )}

      {loadStatus === "ready" && applications.length === 0 && (
        <div className="text-center py-4">
          <ClipboardList aria-hidden="true" size={22} style={{ color: theme.subtleText, margin: "0 auto" }} />
          <p className="mt-2 text-sm" style={{ color: "#8891AC" }}>No pending applications.</p>
        </div>
      )}

      {loadStatus === "ready" && applications.length > 0 && (
        <div className="space-y-2">
          {applications.map((app) => {
            const displayName = getApplicationDisplayName(app);
            const isRowPending = pendingAction?.applicationId === app.id;
            const isApproving = isRowPending && pendingAction?.action === "approve";
            const isDenying = isRowPending && pendingAction?.action === "deny";

            return (
              <div
                key={app.id}
                data-testid={`team-application-row-${app.id}`}
                className="flex flex-col gap-3 rounded-lg p-4 sm:flex-row sm:items-center sm:justify-between"
                style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid var(--pw-line)" }}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <ApplicantAvatar image={app.user?.image ?? null} displayName={displayName} theme={theme} />
                  <div className="min-w-0">
                    <p className="break-words font-semibold" style={{ color: "var(--pw-text-primary)" }}>{displayName}</p>
                    <p className="text-xs" style={{ color: "#8891AC" }}>Applied {formatApplicationDate(app.createdAt)}</p>
                  </div>
                </div>
                <div className="flex gap-2 sm:shrink-0">
                  <button
                    type="button"
                    data-testid={`team-application-approve-${app.id}`}
                    disabled={isMutating}
                    onClick={() => onApprove(app.id)}
                    className={`flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded px-3 text-sm font-semibold transition-opacity disabled:opacity-60 sm:flex-none ${FOCUS_RING}`}
                    style={{ backgroundColor: "var(--pw-success)", color: "var(--pw-bg-base)" }}
                  >
                    <Check aria-hidden="true" size={15} />
                    <span>{isApproving ? "Approving…" : "Approve"}</span>
                  </button>
                  <button
                    type="button"
                    data-testid={`team-application-deny-${app.id}`}
                    disabled={isMutating}
                    onClick={() => onDeny(app.id)}
                    className={`flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded px-3 text-sm font-semibold transition-opacity disabled:opacity-60 sm:flex-none ${FOCUS_RING}`}
                    style={{
                      backgroundColor: "color-mix(in srgb, var(--pw-error-text) 14%, transparent)",
                      color: "var(--pw-error-text)",
                    }}
                  >
                    <X aria-hidden="true" size={15} />
                    <span>{isDenying ? "Denying…" : "Deny"}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
