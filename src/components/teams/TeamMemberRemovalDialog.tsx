"use client";

import { useEffect, useRef } from "react";
import { UserMinus } from "lucide-react";
import type { ThemeConfig } from "@/lib/profileThemes";

export interface RemovableTeamMember {
  user: {
    id: string;
    name: string | null;
    email?: string | null;
    image: string | null;
  };
  role: string;
}

export interface TeamMemberRemoveButtonProps {
  memberId: string;
  displayName: string;
  disabled?: boolean;
  onRequestRemove: (memberId: string) => void;
}

export interface TeamMemberRemovalDialogProps {
  isOpen: boolean;
  member: RemovableTeamMember | null;
  pending: boolean;
  theme: ThemeConfig;
  onCancel: () => void;
  onConfirm: () => void;
}

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--pw-brand-primary)]";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function getRemovalMemberDisplayName(member: RemovableTeamMember | null): string {
  const name = member?.user?.name;
  if (isNonEmptyString(name)) return name.trim();
  const email = member?.user?.email;
  if (isNonEmptyString(email)) return email.trim();
  return "Member";
}

export function TeamMemberRemoveButton({
  memberId,
  displayName,
  disabled = false,
  onRequestRemove,
}: TeamMemberRemoveButtonProps) {
  return (
    <button
      type="button"
      data-testid={`team-member-remove-${memberId}`}
      disabled={disabled}
      onClick={() => onRequestRemove(memberId)}
      aria-label={`Remove ${displayName} from team`}
      className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded px-2.5 text-xs font-semibold transition-opacity disabled:opacity-50 ${FOCUS_RING}`}
      style={{
        backgroundColor: "color-mix(in srgb, var(--pw-error-text) 16%, transparent)",
        color: "var(--pw-error-text)",
      }}
    >
      <UserMinus aria-hidden="true" size={13} />
      <span>Remove</span>
    </button>
  );
}

export default function TeamMemberRemovalDialog({
  isOpen,
  member,
  pending,
  theme,
  onCancel,
  onConfirm,
}: TeamMemberRemovalDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<Element | null>(null);

  const open = isOpen && member !== null;

  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement;
      cancelRef.current?.focus();
      return;
    }
    const trigger = triggerRef.current;
    if (trigger instanceof HTMLElement && trigger.isConnected) {
      trigger.focus();
    }
    triggerRef.current = null;
  }, [open]);

  // While a removal is pending, both buttons are disabled — move focus to
  // the dialog container itself so a modal keyboard user never loses their
  // place, and so Tab has somewhere safe to stay pinned to below.
  useEffect(() => {
    if (open && pending) {
      dialogRef.current?.focus();
    }
  }, [open, pending]);

  // Full keyboard focus containment: Escape/Tab/Shift+Tab all stay local to
  // the dialog. While pending, Tab is fully suppressed (no enabled controls
  // to move between) so focus can never reach the underlying page — e.g. the
  // Leave Team control — until the removal settles.
  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (!pending) onCancel();
        return;
      }
      if (e.key !== "Tab") return;

      if (pending) {
        e.preventDefault();
        dialogRef.current?.focus();
        return;
      }

      const focusable = [cancelRef.current, confirmRef.current].filter(
        (el): el is HTMLButtonElement => el !== null && !el.disabled
      );
      if (focusable.length === 0) {
        e.preventDefault();
        dialogRef.current?.focus();
        return;
      }

      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      const active = document.activeElement;

      if (e.shiftKey) {
        if (active === first || !focusable.includes(active as HTMLButtonElement)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last || !focusable.includes(active as HTMLButtonElement)) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, pending, onCancel]);

  // Redirect focus back inside the dialog if it ever ends up outside it
  // (e.g. a programmatic .focus() call on an underlying page control).
  useEffect(() => {
    if (!open) return undefined;

    const onFocusIn = (e: FocusEvent) => {
      const dialogEl = dialogRef.current;
      if (!dialogEl) return;
      const target = e.target as Node | null;
      if (target && dialogEl.contains(target)) return;
      if (pending) {
        dialogEl.focus();
      } else {
        (cancelRef.current ?? dialogEl).focus();
      }
    };

    document.addEventListener("focusin", onFocusIn);
    return () => document.removeEventListener("focusin", onFocusIn);
  }, [open, pending]);

  if (!open || !member) return null;

  const displayName = getRemovalMemberDisplayName(member);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom, 0px))" }}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-black/60"
        onClick={() => {
          if (!pending) onCancel();
        }}
      />
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="team-member-removal-dialog-heading"
        aria-describedby="team-member-removal-dialog-description"
        aria-busy={pending}
        data-testid="team-member-removal-dialog"
        className="relative w-full rounded-2xl border p-5 pw-pop-in sm:p-6 focus:outline-none"
        style={{
          maxWidth: "min(92vw, 420px)",
          backgroundColor: theme.cardBg,
          borderColor: theme.cardBorder,
          boxShadow: theme.cardGlow,
        }}
      >
        <h2 id="team-member-removal-dialog-heading" className="text-lg font-bold" style={{ color: "var(--pw-text-primary)" }}>
          Remove member
        </h2>
        <p id="team-member-removal-dialog-description" className="mt-2 text-sm" style={{ color: "var(--pw-text-secondary)" }}>
          Are you sure you want to remove {displayName} from the team?
        </p>
        <p className="mt-1 text-xs" style={{ color: theme.subtleText }}>
          This action cannot be undone.
        </p>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            data-testid="team-member-removal-cancel"
            disabled={pending}
            onClick={() => {
              if (!pending) onCancel();
            }}
            className={`inline-flex min-h-11 items-center justify-center rounded-lg border px-4 text-sm font-semibold disabled:opacity-60 ${FOCUS_RING}`}
            style={{ borderColor: "var(--pw-border-default)", color: "var(--pw-text-secondary)" }}
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            type="button"
            data-testid="team-member-removal-confirm"
            disabled={pending}
            onClick={() => {
              if (!pending) onConfirm();
            }}
            className={`inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-bold disabled:opacity-70 ${FOCUS_RING}`}
            style={{ background: "var(--pw-error-text)", color: "var(--pw-bg-base)" }}
          >
            {pending ? "Removing…" : "Remove"}
          </button>
        </div>
      </div>
    </div>
  );
}
