"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { AlertTriangle, LogIn, Mail, Plus, RefreshCw, UsersRound } from "lucide-react";
import { Skeleton } from "@/components/Skeleton";

export interface TeamsHubMember {
  user: {
    id: string;
    name: string | null;
    image: string | null;
  };
  role: string;
}

export interface TeamsHubTeam {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  createdAt: string | null;
  members: TeamsHubMember[];
}

export type TeamsHubViewMode = "mine" | "public";
export type TeamsHubLoadStatus = "loading" | "ready" | "error";

export interface TeamsHubContentProps {
  isAuthenticated: boolean;
  sessionUserId: string | null;
  viewMode: TeamsHubViewMode;
  onChangeViewMode: (mode: TeamsHubViewMode) => void;
  loadStatus: TeamsHubLoadStatus;
  teams: TeamsHubTeam[];
  retrying: boolean;
  onRetry: () => void;
  invitationCount: number;
  onOpenInvitations: () => void;
  onOpenCreateTeam: () => void;
}

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--pw-brand-primary)]";

const BASE_BUTTON =
  `inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors ${FOCUS_RING}`;

const BORDER_STYLE = { borderColor: "var(--pw-border-default)" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeMemberRow(value: unknown): TeamsHubMember | null {
  if (!isRecord(value)) return null;
  const user = value.user;
  if (!isRecord(user)) return null;
  if (typeof user.id !== "string") return null;
  const userId = user.id.trim();
  if (!userId) return null;
  if (typeof value.role !== "string") return null;

  return {
    user: {
      id: userId,
      name: typeof user.name === "string" ? user.name : null,
      image: typeof user.image === "string" ? user.image : null,
    },
    role: value.role,
  };
}

function normalizeTeamRow(value: unknown): TeamsHubTeam | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== "string") return null;
  const id = value.id.trim();
  if (!id) return null;
  if (typeof value.name !== "string") return null;
  if (typeof value.isPublic !== "boolean") return null;
  if (!Array.isArray(value.members)) return null;

  const members: TeamsHubMember[] = [];
  for (const row of value.members) {
    const member = normalizeMemberRow(row);
    if (member) members.push(member);
  }

  return {
    id,
    name: value.name,
    description: typeof value.description === "string" ? value.description : null,
    isPublic: value.isPublic,
    createdAt: typeof value.createdAt === "string" ? value.createdAt : null,
    members,
  };
}

// The Teams GET endpoint's payload shape is not guaranteed row-by-row, so
// this defends against a malformed top-level payload (returns null, distinct
// from a valid empty list) and drops individually malformed rows without
// rejecting the whole response — a single bad Team or member shouldn't hide
// an otherwise-valid list. Row order is preserved exactly as returned.
export function normalizeTeamsPayload(value: unknown): TeamsHubTeam[] | null {
  if (!Array.isArray(value)) return null;
  const result: TeamsHubTeam[] = [];
  for (const row of value) {
    const team = normalizeTeamRow(row);
    if (team) result.push(team);
  }
  return result;
}

export function getTeamsHubDisplayName(name: string | null | undefined): string {
  if (typeof name === "string" && name.trim()) return name.trim();
  return "Unnamed Team";
}

export function getTeamsHubDescription(description: string | null | undefined): string {
  if (typeof description === "string" && description.trim()) return description.trim();
  return "No description provided.";
}

export function filterTeamsForView(
  teams: readonly TeamsHubTeam[],
  viewMode: TeamsHubViewMode,
  sessionUserId: string | null
): TeamsHubTeam[] {
  if (viewMode === "public") {
    return teams.filter((team) => team.isPublic === true);
  }
  const trimmedSessionId = (sessionUserId ?? "").trim();
  if (!trimmedSessionId) return [];
  return teams.filter((team) => team.members.some((member) => member.user.id === trimmedSessionId));
}

function memberCountLabel(count: number): string {
  return `${count} member${count === 1 ? "" : "s"}`;
}

function TeamsHubLoadingSkeleton() {
  return (
    <section role="status" aria-label="Loading teams" data-testid="teams-hub-loading" className="space-y-6">
      <span className="sr-only">Loading teams</span>
      <div className="flex items-start gap-3" aria-hidden="true">
        <Skeleton className="h-12 w-12 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-8 w-40 rounded" />
          <Skeleton className="h-4 w-64 max-w-full rounded" />
        </div>
      </div>
      <div className="flex flex-wrap gap-2" aria-hidden="true">
        <Skeleton className="h-11 w-40 rounded-lg" />
        <Skeleton className="h-11 w-32 rounded-lg" />
        <Skeleton className="h-11 w-32 rounded-lg" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
        {[0, 1, 2].map((card) => (
          <div key={card} className="rounded-2xl border p-5" style={BORDER_STYLE}>
            <Skeleton className="h-5 w-2/3 rounded" />
            <Skeleton className="mt-3 h-4 w-full rounded" />
            <Skeleton className="mt-1 h-4 w-4/5 rounded" />
            <Skeleton className="mt-4 h-4 w-24 rounded" />
          </div>
        ))}
      </div>
    </section>
  );
}

function TeamsHubErrorPanel({ retrying, onRetry }: { retrying: boolean; onRetry: () => void }) {
  return (
    <div
      role="alert"
      data-testid="teams-hub-error"
      className="rounded-2xl border p-8 text-center"
      style={{
        borderColor: "var(--pw-error-text)",
        background: "color-mix(in srgb, var(--pw-error-text) 8%, var(--pw-surface-1))",
      }}
    >
      <AlertTriangle aria-hidden="true" size={32} style={{ color: "var(--pw-error-text)", margin: "0 auto" }} />
      <h2 className="mt-3 text-xl font-bold" style={{ color: "var(--pw-text-primary)" }}>We couldn’t load teams</h2>
      <p className="mt-2 text-sm" style={{ color: "var(--pw-text-secondary)" }}>
        Check your connection and try again.
      </p>
      <button
        type="button"
        data-testid="teams-hub-retry"
        onClick={onRetry}
        disabled={retrying}
        className={`mt-5 inline-flex min-h-12 items-center gap-2 rounded-lg px-5 text-sm font-bold disabled:opacity-70 ${FOCUS_RING}`}
        style={{ minHeight: 48, background: "var(--pw-error-text)", color: "var(--pw-bg-base)" }}
      >
        <RefreshCw aria-hidden="true" size={16} />
        <span>{retrying ? "Trying…" : "Try Again"}</span>
      </button>
    </div>
  );
}

function TeamsHubViewSwitcher({
  viewMode,
  onChangeViewMode,
}: {
  viewMode: TeamsHubViewMode;
  onChangeViewMode: (mode: TeamsHubViewMode) => void;
}) {
  function tabClass(active: boolean) {
    return `inline-flex min-h-11 flex-1 items-center justify-center rounded-md px-4 text-sm font-semibold transition-colors sm:flex-none ${FOCUS_RING}`;
  }
  return (
    <div
      data-testid="teams-hub-view-switcher"
      role="group"
      aria-label="Teams view"
      className="inline-flex w-full gap-1 rounded-lg border p-1 sm:w-auto"
      style={{ borderColor: "var(--pw-border-default)", background: "var(--pw-surface-1)" }}
    >
      <button
        type="button"
        data-testid="teams-hub-view-mine"
        aria-pressed={viewMode === "mine"}
        onClick={() => onChangeViewMode("mine")}
        className={tabClass(viewMode === "mine")}
        style={
          viewMode === "mine"
            ? { background: "var(--pw-brand-primary)", color: "var(--pw-bg-base)" }
            : { color: "var(--pw-text-secondary)" }
        }
      >
        My Teams
      </button>
      <button
        type="button"
        data-testid="teams-hub-view-public"
        aria-pressed={viewMode === "public"}
        onClick={() => onChangeViewMode("public")}
        className={tabClass(viewMode === "public")}
        style={
          viewMode === "public"
            ? { background: "var(--pw-brand-primary)", color: "var(--pw-bg-base)" }
            : { color: "var(--pw-text-secondary)" }
        }
      >
        Public Teams
      </button>
    </div>
  );
}

function TeamsHubHeader({
  isAuthenticated,
  viewMode,
  onChangeViewMode,
  invitationCount,
  onOpenInvitations,
  onOpenCreateTeam,
}: {
  isAuthenticated: boolean;
  viewMode: TeamsHubViewMode;
  onChangeViewMode: (mode: TeamsHubViewMode) => void;
  invitationCount: number;
  onOpenInvitations: () => void;
  onOpenCreateTeam: () => void;
}) {
  return (
    <header data-testid="teams-hub-header" className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
          style={{ background: "var(--pw-surface-2)", color: "var(--pw-brand-primary)" }}
        >
          <UsersRound size={22} />
        </span>
        <div className="min-w-0">
          <h1 className="text-3xl font-bold sm:text-4xl" style={{ color: "var(--pw-text-primary)" }}>Teams</h1>
          <p className="mt-1 break-words text-sm sm:text-base" style={{ color: "var(--pw-text-secondary)" }}>
            Join other players, build a crew, and solve together.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        {isAuthenticated ? (
          <TeamsHubViewSwitcher viewMode={viewMode} onChangeViewMode={onChangeViewMode} />
        ) : (
          <span />
        )}

        <div className="flex flex-wrap items-center gap-2">
          {isAuthenticated ? (
            <>
              {invitationCount > 0 && (
                <button
                  type="button"
                  data-testid="teams-hub-invitations"
                  onClick={onOpenInvitations}
                  aria-label={`Invitations, ${invitationCount} pending`}
                  className={BASE_BUTTON}
                  style={{
                    background: "color-mix(in srgb, var(--pw-brand-primary) 16%, transparent)",
                    color: "var(--pw-brand-primary)",
                  }}
                >
                  <Mail aria-hidden="true" size={16} />
                  <span>Invitations</span>
                  <span
                    aria-hidden="true"
                    className="ml-1 inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-xs font-bold"
                    style={{ background: "var(--pw-error-text)", color: "var(--pw-bg-base)" }}
                  >
                    {invitationCount}
                  </span>
                </button>
              )}
              <button
                type="button"
                data-testid="teams-hub-create"
                onClick={onOpenCreateTeam}
                className={BASE_BUTTON}
                style={{ background: "var(--pw-brand-primary)", color: "var(--pw-bg-base)" }}
              >
                <Plus aria-hidden="true" size={16} />
                <span>Create Team</span>
              </button>
            </>
          ) : (
            <Link
              href="/auth/signin"
              data-testid="teams-hub-sign-in"
              className={BASE_BUTTON}
              style={{ background: "var(--pw-brand-primary)", color: "var(--pw-bg-base)" }}
            >
              <LogIn aria-hidden="true" size={16} />
              <span>Sign in to create a team</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

function TeamsHubEmptyState({
  isAuthenticated,
  viewMode,
  onChangeViewMode,
  onOpenCreateTeam,
}: {
  isAuthenticated: boolean;
  viewMode: TeamsHubViewMode;
  onChangeViewMode: (mode: TeamsHubViewMode) => void;
  onOpenCreateTeam: () => void;
}) {
  let heading: string;
  let copy: string;
  let actions: ReactNode;

  if (isAuthenticated && viewMode === "mine") {
    heading = "You’re not on a team yet";
    copy = "Explore public teams or create one of your own.";
    actions = (
      <>
        <button
          type="button"
          onClick={() => onChangeViewMode("public")}
          className={BASE_BUTTON}
          style={{ borderColor: "var(--pw-border-default)", border: "1px solid", color: "var(--pw-text-secondary)" }}
        >
          Explore Public Teams
        </button>
        <button
          type="button"
          onClick={onOpenCreateTeam}
          className={BASE_BUTTON}
          style={{ background: "var(--pw-brand-primary)", color: "var(--pw-bg-base)" }}
        >
          Create Team
        </button>
      </>
    );
  } else if (isAuthenticated) {
    heading = "No public teams yet";
    copy = "Create a team and be the first to welcome new players.";
    actions = (
      <button
        type="button"
        onClick={onOpenCreateTeam}
        className={BASE_BUTTON}
        style={{ background: "var(--pw-brand-primary)", color: "var(--pw-bg-base)" }}
      >
        Create Team
      </button>
    );
  } else {
    heading = "No public teams yet";
    copy = "Sign in to create a team and start building your crew.";
    actions = (
      <Link
        href="/auth/signin"
        className={BASE_BUTTON}
        style={{ background: "var(--pw-brand-primary)", color: "var(--pw-bg-base)" }}
      >
        Sign in to create a team
      </Link>
    );
  }

  return (
    <div data-testid="teams-hub-empty" className="rounded-2xl border p-8 text-center" style={BORDER_STYLE}>
      <UsersRound aria-hidden="true" size={32} style={{ color: "var(--pw-text-muted)", margin: "0 auto" }} />
      <h2 className="mt-3 text-xl font-bold" style={{ color: "var(--pw-text-primary)" }}>{heading}</h2>
      <p className="mt-2 text-sm" style={{ color: "var(--pw-text-secondary)" }}>{copy}</p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">{actions}</div>
    </div>
  );
}

function TeamsHubGrid({ teams }: { teams: TeamsHubTeam[] }) {
  return (
    <div data-testid="teams-hub-grid" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {teams.map((team) => {
        const displayName = getTeamsHubDisplayName(team.name);
        const description = getTeamsHubDescription(team.description);
        const memberCount = team.members.length;
        return (
          <Link
            key={team.id}
            href={`/teams/${team.id}`}
            data-testid={`teams-hub-team-${team.id}`}
            aria-label={`View ${displayName} team`}
            className={`group flex min-h-11 flex-col rounded-2xl border p-5 transition-colors hover:border-[var(--pw-brand-primary)] ${FOCUS_RING}`}
            style={{ background: "var(--pw-surface-1)", borderColor: "var(--pw-border-default)" }}
          >
            <h3 className="break-words text-lg font-bold" style={{ color: "var(--pw-text-primary)" }}>{displayName}</h3>
            <p className="mt-2 line-clamp-2 flex-1 break-words text-sm" style={{ color: "var(--pw-text-secondary)" }}>
              {description}
            </p>
            <div className="mt-4 flex items-center justify-between border-t pt-3" style={{ borderColor: "var(--pw-border-default)" }}>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold" style={{ color: "var(--pw-text-muted)" }}>
                  {memberCountLabel(memberCount)}
                </span>
                <span
                  className="rounded-full px-2 py-0.5 text-xs font-bold"
                  style={
                    team.isPublic
                      ? { background: "color-mix(in srgb, var(--pw-success-text) 18%, transparent)", color: "var(--pw-success-text)" }
                      : { background: "var(--pw-surface-2)", color: "var(--pw-text-muted)" }
                  }
                >
                  {team.isPublic ? "Public" : "Private"}
                </span>
              </div>
              <span className="text-xs font-bold transition-colors group-hover:opacity-80" style={{ color: "var(--pw-brand-primary)" }}>
                View team
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

export default function TeamsHubContent({
  isAuthenticated,
  sessionUserId,
  viewMode,
  onChangeViewMode,
  loadStatus,
  teams,
  retrying,
  onRetry,
  invitationCount,
  onOpenInvitations,
  onOpenCreateTeam,
}: TeamsHubContentProps) {
  if (loadStatus === "loading") {
    return <TeamsHubLoadingSkeleton />;
  }

  if (loadStatus === "error") {
    return <TeamsHubErrorPanel retrying={retrying} onRetry={onRetry} />;
  }

  const effectiveViewMode: TeamsHubViewMode = isAuthenticated ? viewMode : "public";
  const visibleTeams = filterTeamsForView(teams, effectiveViewMode, sessionUserId);

  return (
    <div className="space-y-6">
      <TeamsHubHeader
        isAuthenticated={isAuthenticated}
        viewMode={effectiveViewMode}
        onChangeViewMode={onChangeViewMode}
        invitationCount={invitationCount}
        onOpenInvitations={onOpenInvitations}
        onOpenCreateTeam={onOpenCreateTeam}
      />

      {visibleTeams.length === 0 ? (
        <TeamsHubEmptyState
          isAuthenticated={isAuthenticated}
          viewMode={effectiveViewMode}
          onChangeViewMode={onChangeViewMode}
          onOpenCreateTeam={onOpenCreateTeam}
        />
      ) : (
        <TeamsHubGrid teams={visibleTeams} />
      )}
    </div>
  );
}
