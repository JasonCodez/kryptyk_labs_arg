"use client";

import { useEffect, useRef } from "react";
import type { ThemeConfig } from "@/lib/profileThemes";

export interface TeamLeaveDialogProps {
  isOpen: boolean;
  teamName: string | null;
  pending: boolean;
  theme: ThemeConfig;
  onCancel: () => void;
  onConfirm: () => void;
}

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--pw-brand-primary)]";

export function getLeaveTeamDisplayName(teamName: string | null | undefined): string {
  if (typeof teamName === "string" && teamName.trim()) return teamName.trim();
  return "Unnamed Team";
}

export default function TeamLeaveDialog({
  isOpen,
  teamName,
  pending,
  theme,
  onCancel,
  onConfirm,
}: TeamLeaveDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<Element | null>(null);
  // Distinguishes a normal cancellation (Cancel/Escape/backdrop) from the
  // dialog closing because the leave request resolved — only the former
  // should restore focus to the original trigger.
  const cancelledRef = useRef(false);

  const open = isOpen;

  const handleCancel = () => {
    if (pending) return;
    cancelledRef.current = true;
    onCancel();
  };

  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement;
      cancelledRef.current = false;
      cancelRef.current?.focus();
      return;
    }
    const trigger = triggerRef.current;
    if (cancelledRef.current && trigger instanceof HTMLElement && trigger.isConnected) {
      trigger.focus();
    }
    triggerRef.current = null;
    cancelledRef.current = false;
  }, [open]);

  // While leaving is pending, both buttons are disabled — move focus to the
  // dialog container itself so a keyboard user never loses their place, and
  // so Tab has somewhere safe to stay pinned to below.
  useEffect(() => {
    if (open && pending) {
      dialogRef.current?.focus();
    }
  }, [open, pending]);

  // Full keyboard focus containment: Escape/Tab/Shift+Tab all stay local to
  // the dialog. While pending, Tab is fully suppressed (no enabled controls
  // to move between) so focus can never reach the underlying page.
  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleCancel();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  if (!open) return null;

  const displayName = getLeaveTeamDisplayName(teamName);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom, 0px))" }}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-black/60"
        onClick={handleCancel}
      />
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="team-leave-dialog-heading"
        aria-describedby="team-leave-dialog-description"
        aria-busy={pending}
        data-testid="team-leave-dialog"
        className="relative w-full rounded-2xl border p-5 pw-pop-in sm:p-6 focus:outline-none"
        style={{
          maxWidth: "min(92vw, 420px)",
          backgroundColor: theme.cardBg,
          borderColor: theme.cardBorder,
          boxShadow: theme.cardGlow,
        }}
      >
        <h2 id="team-leave-dialog-heading" className="text-lg font-bold" style={{ color: "var(--pw-text-primary)" }}>
          Leave team
        </h2>
        <p id="team-leave-dialog-description" className="mt-2 text-sm" style={{ color: "var(--pw-text-secondary)" }}>
          Are you sure you want to leave the team {displayName}?
        </p>
        <p className="mt-1 text-xs" style={{ color: theme.subtleText }}>
          This action cannot be undone.
        </p>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            data-testid="team-leave-cancel"
            disabled={pending}
            onClick={handleCancel}
            className={`inline-flex min-h-11 items-center justify-center rounded-lg border px-4 text-sm font-semibold disabled:opacity-60 ${FOCUS_RING}`}
            style={{ borderColor: "var(--pw-border-default)", color: "var(--pw-text-secondary)" }}
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            type="button"
            data-testid="team-leave-confirm"
            disabled={pending}
            onClick={() => {
              if (!pending) onConfirm();
            }}
            className={`inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-bold disabled:opacity-70 ${FOCUS_RING}`}
            style={{ background: "var(--pw-error-text)", color: "var(--pw-bg-base)" }}
          >
            {pending ? "Leaving…" : "Leave"}
          </button>
        </div>
      </div>
    </div>
  );
}
