"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Pressable from "@/components/juice/Pressable";

interface PuzzleHeaderProps {
  /** Where the back button navigates (e.g. "/daily"). */
  backHref: string;
  title: string;
  /** Optional secondary line — day number, category, etc. */
  subtitle?: ReactNode;
  /** Optional timer / progress element rendered before the right-side actions. */
  progress?: ReactNode;
  /** Optional right-side actions (streak pill, menu, etc.). */
  actions?: ReactNode;
  /** Optional click handler for the back control (still navigates via backHref). */
  onBack?: () => void;
}

interface PuzzleHeaderCrosswordActionsProps {
  onClues: () => void;
  onHelp: () => void;
  overflow?: ReactNode;
}

function HeaderActionIcon({ kind }: { kind: "clues" | "help" | "more" }) {
  if (kind === "help") {
    return <span className="pw-play-header-action-glyph" aria-hidden>?</span>;
  }
  if (kind === "more") {
    return <span className="pw-play-header-action-glyph" aria-hidden>•••</span>;
  }
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M8 6h13M8 12h13M8 18h13" />
      <path d="M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  );
}

function PuzzleHeaderOverflowMenu({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 58, right: 8 });
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const button = buttonRef.current;
    if (button) {
      const rect = button.getBoundingClientRect();
      setPosition({ top: rect.bottom + 6, right: Math.max(8, window.innerWidth - rect.right) });
    }

    const handlePointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !buttonRef.current?.contains(target)) setOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    window.addEventListener("pointerdown", handlePointer);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("pointerdown", handlePointer);
      window.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <>
      <Pressable
        ref={buttonRef}
        type="button"
        className="pw-play-header-action"
        aria-label="More puzzle actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <HeaderActionIcon kind="more" />
      </Pressable>
      {open && typeof document !== "undefined" && createPortal(
        <div
          ref={menuRef}
          role="menu"
          className="pw-play-header-menu"
          style={{ position: "fixed", top: position.top, right: position.right }}
          onClick={() => setOpen(false)}
        >
          {children}
        </div>,
        document.body
      )}
    </>
  );
}

export function PuzzleHeaderCrosswordActions({
  onClues,
  onHelp,
  overflow,
}: PuzzleHeaderCrosswordActionsProps) {
  return (
    <div className="pw-play-header-action-group">
      <Pressable type="button" className="pw-play-header-action" onClick={onClues} aria-label="Open crossword clues">
        <HeaderActionIcon kind="clues" />
        <span className="pw-play-header-action-text">Clues</span>
      </Pressable>
      <Pressable type="button" className="pw-play-header-action" onClick={onHelp} aria-label="How to play crossword">
        <HeaderActionIcon kind="help" />
        <span className="pw-play-header-action-text">Help</span>
      </Pressable>
      {overflow && <PuzzleHeaderOverflowMenu>{overflow}</PuzzleHeaderOverflowMenu>}
    </div>
  );
}

/**
 * Compact top bar for the full-screen puzzle play shell. Replaces the global
 * navbar during gameplay on mobile. Provides a 48px back target, safe-area
 * inset, and slots for a subtitle, timer/progress, and right-side actions.
 */
export default function PuzzleHeader({
  backHref,
  title,
  subtitle,
  progress,
  actions,
  onBack,
}: PuzzleHeaderProps) {
  return (
    <header className="pw-play-header">
      <Link
        href={backHref}
        onClick={onBack}
        aria-label="Back"
        className="pw-play-header-back pw-press"
        data-testid="puzzle-header-back"
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </Link>

      <div className="pw-play-header-titles">
        <span className="pw-play-header-title" data-testid="puzzle-header-title">{title}</span>
        {subtitle != null && subtitle !== "" && (
          <span className="pw-play-header-subtitle" data-testid="puzzle-header-subtitle">{subtitle}</span>
        )}
      </div>

      {progress && (
        <div className="pw-play-header-progress" data-testid="puzzle-header-progress">
          {progress}
        </div>
      )}
      {actions && (
        <div className="pw-play-header-actions" data-testid="puzzle-header-actions">
          {actions}
        </div>
      )}
    </header>
  );
}
