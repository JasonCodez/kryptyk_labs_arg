"use client";

import Link from "next/link";
import { Clock, LogIn, LogOut, Mail, Palette, Send } from "lucide-react";
import type { ThemeConfig } from "@/lib/profileThemes";

export type TeamInviteStatus = "none" | "pending" | "accepted" | "declined";

export interface TeamDetailActionsProps {
  userRole: string | null;
  isPublic: boolean;
  isAuthenticated: boolean;
  inviteStatus: TeamInviteStatus;
  themePickerOpen: boolean;
  theme: ThemeConfig;
  onToggleThemePicker: () => void;
  onInviteMembers: () => void;
  onLeaveTeam: () => void;
  onApplyToJoin: () => void;
}

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--pw-brand-primary)]";

const BASE_BUTTON =
  `inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors sm:w-auto ${FOCUS_RING}`;

function isManagementRole(userRole: string): boolean {
  return userRole === "admin" || userRole === "moderator";
}

export default function TeamDetailActions({
  userRole,
  isPublic,
  isAuthenticated,
  inviteStatus,
  themePickerOpen,
  theme,
  onToggleThemePicker,
  onInviteMembers,
  onLeaveTeam,
  onApplyToJoin,
}: TeamDetailActionsProps) {
  const trimmedRole = (userRole ?? "").trim();
  const isMember = trimmedRole.length > 0;
  const isAdmin = trimmedRole === "admin";
  const isModerator = trimmedRole === "moderator";

  return (
    <div data-testid="team-detail-actions" className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
      {isMember ? (
        <>
          {isAdmin && (
            <button
              type="button"
              onClick={onToggleThemePicker}
              aria-expanded={themePickerOpen}
              aria-controls="team-theme-picker"
              className={BASE_BUTTON}
              style={{ backgroundColor: theme.primaryMuted, color: theme.primary, border: `1px solid ${theme.primaryBorder}` }}
            >
              <Palette aria-hidden="true" size={16} />
              <span>Theme</span>
            </button>
          )}
          {(isAdmin || isModerator) && (
            <button
              type="button"
              onClick={onInviteMembers}
              className={BASE_BUTTON}
              style={{ background: theme.btnPrimary, color: theme.btnPrimaryText }}
            >
              <Mail aria-hidden="true" size={16} />
              <span>Invite Members</span>
            </button>
          )}
          <button
            type="button"
            onClick={onLeaveTeam}
            className={BASE_BUTTON}
            style={{
              background: "color-mix(in srgb, var(--pw-error-text) 12%, transparent)",
              color: "var(--pw-error-text)",
              border: "1px solid color-mix(in srgb, var(--pw-error-text) 35%, transparent)",
            }}
          >
            <LogOut aria-hidden="true" size={16} />
            <span>Leave Team</span>
          </button>
        </>
      ) : isPublic ? (
        isAuthenticated ? (
          inviteStatus === "pending" ? (
            <button
              type="button"
              disabled
              className={`${BASE_BUTTON} cursor-not-allowed opacity-70`}
              style={{ background: theme.btnPrimary, color: theme.btnPrimaryText }}
            >
              <Clock aria-hidden="true" size={16} />
              <span>Application Submitted</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onApplyToJoin}
              className={BASE_BUTTON}
              style={{ background: theme.btnPrimary, color: theme.btnPrimaryText }}
            >
              <Send aria-hidden="true" size={16} />
              <span>Apply to Join</span>
            </button>
          )
        ) : (
          <Link
            href="/auth/signin"
            className={BASE_BUTTON}
            style={{ background: theme.btnPrimary, color: theme.btnPrimaryText }}
          >
            <LogIn aria-hidden="true" size={16} />
            <span>Sign in to Join</span>
          </Link>
        )
      ) : null}
    </div>
  );
}
