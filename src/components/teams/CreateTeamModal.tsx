"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Users } from "lucide-react";

export interface CreateTeamModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export interface CreateTeamDraft {
  name: string;
  description: string;
  isPublic: boolean;
}

export interface NormalizedCreateTeamDraft {
  name: string;
  description: string;
  isPublic: boolean;
}

export type CreateTeamValidationErrors = {
  name?: string;
  description?: string;
};

type FocusableControl = HTMLInputElement | HTMLTextAreaElement | HTMLButtonElement;

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--pw-brand-primary)]";

export function normalizeCreateTeamDraft(draft: CreateTeamDraft): NormalizedCreateTeamDraft {
  return {
    name: draft.name.trim(),
    description: draft.description.trim(),
    isPublic: draft.isPublic,
  };
}

export function validateCreateTeamDraft(draft: NormalizedCreateTeamDraft): CreateTeamValidationErrors {
  const errors: CreateTeamValidationErrors = {};

  if (!draft.name) {
    errors.name = "Enter a team name.";
  } else if (draft.name.length > 100) {
    errors.name = "Team names can be up to 100 characters.";
  }

  if (draft.description.length > 500) {
    errors.description = "Descriptions can be up to 500 characters.";
  }

  return errors;
}

// A Fetch response body can only be consumed once, so this reads it exactly
// once as text and then attempts JSON parsing locally — calling both
// res.json() and res.text() on the same real Response is not reliable.
export async function readCreateTeamError(response: Response): Promise<string> {
  const raw = await response.text().catch(() => "");
  const trimmed = raw.trim();

  if (!trimmed) {
    return "Failed to create team";
  }

  try {
    const parsed: unknown = JSON.parse(trimmed);

    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      const error = (parsed as Record<string, unknown>).error;
      if (typeof error === "string" && error.trim()) {
        return error.trim();
      }
    }

    return "Failed to create team";
  } catch {
    return trimmed;
  }
}

export function CreateTeamModal({ onClose, onSuccess }: CreateTeamModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<CreateTeamValidationErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const mountedRef = useRef(false);
  const submitInFlightRef = useRef(false);
  const requestAbortRef = useRef<AbortController | null>(null);
  const requestSequenceRef = useRef(0);
  const triggerRef = useRef<Element | null>(null);

  const dialogRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const publicRadioRef = useRef<HTMLInputElement>(null);
  const privateRadioRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const submitRef = useRef<HTMLButtonElement>(null);
  const errorSummaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    mountedRef.current = true;
    triggerRef.current = document.activeElement;
    nameInputRef.current?.focus();

    return () => {
      mountedRef.current = false;
      requestSequenceRef.current += 1;
      requestAbortRef.current?.abort();
      requestAbortRef.current = null;
      submitInFlightRef.current = false;

      const trigger = triggerRef.current;
      if (trigger instanceof HTMLElement && trigger.isConnected) {
        trigger.focus();
      }
      triggerRef.current = null;
    };
  }, []);

  // Lock background scroll for the lifetime of the modal, restoring the
  // page's previous overflow value exactly once on cleanup.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  // While the POST is pending, every control is disabled — move focus to
  // the dialog container itself so a keyboard user never loses their place.
  useEffect(() => {
    if (pending) dialogRef.current?.focus();
  }, [pending]);

  // The error summary only exists in the DOM once serverError is set, so
  // focusing it must happen after that render commits, not synchronously
  // alongside the setServerError call.
  useEffect(() => {
    if (serverError) errorSummaryRef.current?.focus();
  }, [serverError]);

  const handleClose = () => {
    if (pending) return;
    onClose();
  };

  // Full keyboard focus containment: Escape/Tab/Shift+Tab all stay local to
  // the dialog. While pending, Tab is fully suppressed (no enabled controls
  // to move between) so focus can never reach the Teams hub beneath it.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
        return;
      }
      if (e.key !== "Tab") return;

      if (pending) {
        e.preventDefault();
        dialogRef.current?.focus();
        return;
      }

      const focusable: FocusableControl[] = [
        nameInputRef.current,
        descriptionRef.current,
        publicRadioRef.current,
        privateRadioRef.current,
        cancelRef.current,
        submitRef.current,
      ].filter((el): el is FocusableControl => el !== null && !el.disabled);

      if (focusable.length === 0) {
        e.preventDefault();
        dialogRef.current?.focus();
        return;
      }

      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      const active = document.activeElement;

      if (e.shiftKey) {
        if (active === first || !focusable.includes(active as FocusableControl)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last || !focusable.includes(active as FocusableControl)) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  // Redirect focus back inside the dialog if it ever ends up outside it
  // (e.g. a programmatic .focus() call on an underlying Teams hub control).
  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      const dialogEl = dialogRef.current;
      if (!dialogEl) return;
      const target = e.target as Node | null;
      if (target && dialogEl.contains(target)) return;
      if (pending) {
        dialogEl.focus();
      } else {
        (nameInputRef.current ?? dialogEl).focus();
      }
    };

    document.addEventListener("focusin", onFocusIn);
    return () => document.removeEventListener("focusin", onFocusIn);
  }, [pending]);

  const handleNameChange = (value: string) => {
    setName(value);
    if (fieldErrors.name) {
      const trimmed = value.trim();
      if (trimmed && trimmed.length <= 100) {
        setFieldErrors((prev) => ({ ...prev, name: undefined }));
      }
    }
  };

  const handleDescriptionChange = (value: string) => {
    setDescription(value);
    if (fieldErrors.description) {
      const trimmed = value.trim();
      if (trimmed.length <= 500) {
        setFieldErrors((prev) => ({ ...prev, description: undefined }));
      }
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitInFlightRef.current) return;

    const normalized = normalizeCreateTeamDraft({ name, description, isPublic });
    const errors = validateCreateTeamDraft(normalized);

    if (errors.name || errors.description) {
      setFieldErrors(errors);
      if (errors.name) {
        nameInputRef.current?.focus();
      } else {
        descriptionRef.current?.focus();
      }
      return;
    }

    setFieldErrors({});
    submitInFlightRef.current = true;
    requestAbortRef.current?.abort();
    const controller = new AbortController();
    requestAbortRef.current = controller;
    const seq = ++requestSequenceRef.current;
    setServerError(null);
    setPending(true);

    const shouldApply = () => mountedRef.current && seq === requestSequenceRef.current;

    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: normalized.name, description: normalized.description, isPublic: normalized.isPublic }),
        signal: controller.signal,
      });
      if (!shouldApply()) return;

      if (!res.ok) {
        const message = await readCreateTeamError(res);
        if (!shouldApply()) return;
        setServerError(message);
        setPending(false);
        submitInFlightRef.current = false;
        return;
      }
    } catch (err) {
      if ((err as Error)?.name === "AbortError" || !shouldApply()) return;
      setServerError("An error occurred. Please try again.");
      setPending(false);
      submitInFlightRef.current = false;
      return;
    }

    // Success is deliberately outside the try/catch above — a parent
    // callback exception must never be mistaken for a network/server
    // failure. The synchronous submit guard deliberately stays set; the
    // parent unmounts this component via its generation-bound onSuccess.
    onSuccess();
  };

  const nameErrorId = fieldErrors.name ? "create-team-name-error" : undefined;
  const descriptionErrorId = fieldErrors.description ? "create-team-description-error" : undefined;

  return (
    // z-[210]: the mobile bottom-sheet layout anchors this dialog to the
    // bottom of the viewport, the same strip AppBottomNav occupies at
    // z-index 200 — this must sit above it or its own Cancel/Create
    // controls become unclickable behind the tab bar, exactly like the
    // cookie banner's documented z-index override for the same reason.
    <div className="fixed inset-0 z-[210] flex items-end justify-center sm:items-center sm:p-4">
      <div
        aria-hidden="true"
        data-testid="create-team-backdrop"
        className="absolute inset-0 bg-black/60"
        onClick={handleClose}
      />
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-team-dialog-heading"
        aria-describedby="create-team-dialog-description"
        aria-busy={pending}
        data-testid="create-team-dialog"
        className="pw-pop-in relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl border sm:max-h-[85vh] sm:max-w-lg sm:rounded-2xl focus:outline-none"
        style={{
          backgroundColor: "var(--pw-surface-1)",
          borderColor: "var(--pw-border-default)",
        }}
      >
        <div
          className="overflow-y-auto p-5 sm:p-6"
          style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom, 0px))" }}
        >
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
              style={{ background: "var(--pw-surface-2)", color: "var(--pw-brand-primary)" }}
            >
              <Users size={20} />
            </span>
            <div className="min-w-0">
              <h2 id="create-team-dialog-heading" className="text-lg font-bold" style={{ color: "var(--pw-text-primary)" }}>
                Create New Team
              </h2>
              <p id="create-team-dialog-description" className="mt-1 text-sm" style={{ color: "var(--pw-text-secondary)" }}>
                Build a crew, solve together, and make your mark.
              </p>
            </div>
          </div>

          {serverError && (
            <div
              ref={errorSummaryRef}
              role="alert"
              tabIndex={-1}
              data-testid="create-team-error"
              className="mt-4 rounded-lg border p-3 text-sm focus:outline-none"
              style={{
                borderColor: "var(--pw-error-text)",
                background: "color-mix(in srgb, var(--pw-error-text) 10%, transparent)",
                color: "var(--pw-error-text)",
              }}
            >
              {serverError}
            </div>
          )}

          <form className="mt-5 space-y-5" onSubmit={handleSubmit} noValidate>
            <div>
              <div className="flex items-baseline justify-between gap-2">
                <label htmlFor="create-team-name-field" className="text-sm font-semibold" style={{ color: "var(--pw-text-primary)" }}>
                  Team name <span aria-hidden="true">*</span>
                  <span className="sr-only"> (required)</span>
                </label>
                <span className="text-xs" style={{ color: "var(--pw-text-muted)" }}>{name.length}/100</span>
              </div>
              <input
                ref={nameInputRef}
                id="create-team-name-field"
                type="text"
                autoComplete="off"
                maxLength={100}
                placeholder="Enter team name"
                value={name}
                disabled={pending}
                aria-invalid={!!fieldErrors.name}
                aria-describedby={nameErrorId}
                data-testid="create-team-name"
                onChange={(e) => handleNameChange(e.target.value)}
                className={`mt-1.5 w-full rounded-lg border px-3 py-2 text-sm disabled:opacity-60 ${FOCUS_RING}`}
                style={{
                  background: "var(--pw-surface-2)",
                  borderColor: fieldErrors.name ? "var(--pw-error-text)" : "var(--pw-border-default)",
                  color: "var(--pw-text-primary)",
                }}
              />
              {fieldErrors.name && (
                <p id={nameErrorId} className="mt-1.5 text-xs" style={{ color: "var(--pw-error-text)" }}>
                  {fieldErrors.name}
                </p>
              )}
            </div>

            <div>
              <div className="flex items-baseline justify-between gap-2">
                <label htmlFor="create-team-description-field" className="text-sm font-semibold" style={{ color: "var(--pw-text-primary)" }}>
                  Description <span className="font-normal" style={{ color: "var(--pw-text-muted)" }}>Optional</span>
                </label>
                <span className="text-xs" style={{ color: "var(--pw-text-muted)" }}>{description.length}/500</span>
              </div>
              <textarea
                ref={descriptionRef}
                id="create-team-description-field"
                rows={4}
                maxLength={500}
                placeholder="What kind of puzzles does your team enjoy?"
                value={description}
                disabled={pending}
                aria-invalid={!!fieldErrors.description}
                aria-describedby={descriptionErrorId}
                data-testid="create-team-description"
                onChange={(e) => handleDescriptionChange(e.target.value)}
                className={`mt-1.5 w-full resize-none rounded-lg border px-3 py-2 text-sm disabled:opacity-60 ${FOCUS_RING}`}
                style={{
                  background: "var(--pw-surface-2)",
                  borderColor: fieldErrors.description ? "var(--pw-error-text)" : "var(--pw-border-default)",
                  color: "var(--pw-text-primary)",
                }}
              />
              {fieldErrors.description && (
                <p id={descriptionErrorId} className="mt-1.5 text-xs" style={{ color: "var(--pw-error-text)" }}>
                  {fieldErrors.description}
                </p>
              )}
            </div>

            <div role="radiogroup" aria-label="Team visibility">
              <p className="text-sm font-semibold" style={{ color: "var(--pw-text-primary)" }}>Team visibility</p>
              <div className="mt-1.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <label
                  className="flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm"
                  style={{
                    borderColor: isPublic ? "var(--pw-brand-primary)" : "var(--pw-border-default)",
                    background: isPublic ? "color-mix(in srgb, var(--pw-brand-primary) 10%, transparent)" : "var(--pw-surface-2)",
                  }}
                >
                  <input
                    ref={publicRadioRef}
                    type="radio"
                    name="create-team-visibility"
                    checked={isPublic}
                    disabled={pending}
                    onChange={() => setIsPublic(true)}
                    data-testid="create-team-visibility-public"
                    className={`mt-0.5 ${FOCUS_RING}`}
                  />
                  <span>
                    <span className="block font-semibold" style={{ color: "var(--pw-text-primary)" }}>Public</span>
                    <span className="block text-xs" style={{ color: "var(--pw-text-secondary)" }}>Anyone can discover and join this team.</span>
                  </span>
                </label>
                <label
                  className="flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm"
                  style={{
                    borderColor: !isPublic ? "var(--pw-brand-primary)" : "var(--pw-border-default)",
                    background: !isPublic ? "color-mix(in srgb, var(--pw-brand-primary) 10%, transparent)" : "var(--pw-surface-2)",
                  }}
                >
                  <input
                    ref={privateRadioRef}
                    type="radio"
                    name="create-team-visibility"
                    checked={!isPublic}
                    disabled={pending}
                    onChange={() => setIsPublic(false)}
                    data-testid="create-team-visibility-private"
                    className={`mt-0.5 ${FOCUS_RING}`}
                  />
                  <span>
                    <span className="block font-semibold" style={{ color: "var(--pw-text-primary)" }}>Private</span>
                    <span className="block text-xs" style={{ color: "var(--pw-text-secondary)" }}>Only invited players can join this team.</span>
                  </span>
                </label>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                ref={cancelRef}
                type="button"
                data-testid="create-team-cancel"
                disabled={pending}
                onClick={handleClose}
                className={`inline-flex min-h-11 items-center justify-center rounded-lg border px-4 text-sm font-semibold disabled:opacity-60 ${FOCUS_RING}`}
                style={{ borderColor: "var(--pw-border-default)", color: "var(--pw-text-secondary)" }}
              >
                Cancel
              </button>
              <button
                ref={submitRef}
                type="submit"
                data-testid="create-team-submit"
                disabled={pending}
                className={`inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-bold disabled:opacity-70 ${FOCUS_RING}`}
                style={{ background: "var(--pw-brand-primary)", color: "var(--pw-bg-base)" }}
              >
                {pending ? "Creating…" : "Create Team"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
