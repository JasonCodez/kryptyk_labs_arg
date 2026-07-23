"use client";

import { useEffect, useId, useRef } from "react";
import type { ReactNode, RefObject } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { useAppReducedMotion } from "@/hooks/useAppReducedMotion";

export interface WarzBattleDialogProps {
  open: boolean;
  role?: "dialog" | "alertdialog";
  title: string;
  description: ReactNode;
  icon?: LucideIcon;
  dismissible: boolean;
  initialFocusRef?: RefObject<HTMLElement | null>;
  returnFocusRef?: RefObject<HTMLElement | null>;
  onClose?: () => void;
  children: ReactNode;
}

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  );
}

/**
 * Reusable, accessibility-focused battle dialog — focus trap, initial focus,
 * conditional Escape/backdrop dismissal, and focus return on close. Purely
 * presentational: it never submits a terminal result, starts a countdown,
 * performs a request, or navigates. The caller supplies all behavior.
 */
export default function WarzBattleDialog({
  open,
  role = "dialog",
  title,
  description,
  icon: Icon,
  dismissible,
  initialFocusRef,
  returnFocusRef,
  onClose,
  children,
}: WarzBattleDialogProps) {
  const reduceMotion = useAppReducedMotion();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (!open) {
      if (wasOpenRef.current) {
        returnFocusRef?.current?.focus();
      }
      wasOpenRef.current = false;
      return;
    }
    wasOpenRef.current = true;

    const target = initialFocusRef?.current ?? (panelRef.current ? getFocusable(panelRef.current)[0] : undefined);
    target?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (dismissible) onClose?.();
        return;
      }
      if (event.key === "Tab" && panelRef.current) {
        const focusable = getFocusable(panelRef.current);
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dismissible]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={reduceMotion ? undefined : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduceMotion ? undefined : { opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          style={{ background: "color-mix(in srgb, black 70%, transparent)" }}
          onClick={() => {
            if (dismissible) onClose?.();
          }}
        >
          <motion.div
            ref={panelRef}
            role={role}
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            initial={reduceMotion ? undefined : { opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0, scale: 0.92 }}
            transition={{ duration: 0.15 }}
            className="w-full max-w-sm rounded-2xl border-2 p-6 text-center shadow-2xl sm:p-8"
            style={{ background: "var(--pw-surface-1)", borderColor: "var(--pw-error)" }}
            onClick={(event) => event.stopPropagation()}
          >
            {Icon && (
              <Icon aria-hidden="true" size={32} className="mx-auto mb-3" style={{ color: "var(--pw-error-text)" }} />
            )}
            <h2 id={titleId} className="mb-2 text-xl font-extrabold" style={{ color: "var(--pw-text-primary)" }}>
              {title}
            </h2>
            <div id={descriptionId} className="mb-6 text-sm" style={{ color: "var(--pw-text-secondary)" }}>
              {description}
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
