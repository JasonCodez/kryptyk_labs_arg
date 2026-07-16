"use client";

import Link from "next/link";
import {
  Children,
  cloneElement,
  Fragment,
  isValidElement,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
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

function actionableElements(children: ReactNode): ReactElement[] {
  return Children.toArray(children).flatMap((child) => {
    if (!isValidElement(child)) return [];
    if (child.type === Fragment) {
      return actionableElements((child.props as { children?: ReactNode }).children);
    }
    return [child];
  });
}

interface PuzzleHeaderCrosswordActionsProps {
  onClues: () => void;
  onHelp: () => void;
  overflow?: ReactNode;
}

interface PuzzleHeaderActionsProps {
  onHelp: () => void;
  helpLabel: string;
  beforeHelp?: ReactNode;
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

  const closeMenu = useCallback((restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) window.requestAnimationFrame(() => buttonRef.current?.focus());
  }, []);

  const openMenu = useCallback(() => {
    const button = buttonRef.current;
    if (button) {
      const rect = button.getBoundingClientRect();
      setPosition({ top: rect.bottom + 6, right: Math.max(8, window.innerWidth - rect.right) });
    }
    setOpen(true);
  }, []);

  const menuItems = actionableElements(children).map((child) => {
    const element = child as ReactElement<{
      className?: string;
      role?: string;
      tabIndex?: number;
    }>;
    return cloneElement(element, {
      className: `pw-play-header-menu-item${element.props.className ? ` ${element.props.className}` : ""}`,
      role: element.props.role ?? "menuitem",
      tabIndex: -1,
    });
  });

  useEffect(() => {
    if (!open) return;
    const focusFrame = window.requestAnimationFrame(() => {
      menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    });

    const handlePointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !buttonRef.current?.contains(target)) closeMenu();
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMenu();
      }
    };
    window.addEventListener("pointerdown", handlePointer);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener("pointerdown", handlePointer);
      window.removeEventListener("keydown", handleKey);
    };
  }, [closeMenu, open]);

  const handleMenuKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    if (!items.length) return;
    const currentIndex = Math.max(0, items.indexOf(document.activeElement as HTMLElement));
    let nextIndex: number | null = null;
    if (event.key === "ArrowDown") nextIndex = (currentIndex + 1) % items.length;
    if (event.key === "ArrowUp") nextIndex = (currentIndex - 1 + items.length) % items.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = items.length - 1;
    if (nextIndex !== null) {
      event.preventDefault();
      items[nextIndex].focus();
    }
  }, []);

  return (
    <>
      <Pressable
        ref={buttonRef}
        type="button"
        className="pw-play-header-action"
        aria-label="More puzzle actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => open ? closeMenu() : openMenu()}
      >
        <HeaderActionIcon kind="more" />
      </Pressable>
      {open && typeof document !== "undefined" && createPortal(
        <div
          ref={menuRef}
          role="menu"
          className="pw-play-header-menu"
          style={{ position: "fixed", top: position.top, right: position.right }}
          onKeyDown={handleMenuKeyDown}
          onBlur={(event) => {
            const next = event.relatedTarget as Node | null;
            if (!next || (!event.currentTarget.contains(next) && !buttonRef.current?.contains(next))) closeMenu();
          }}
          onClick={() => closeMenu()}
        >
          <div className="pw-play-header-menu-stack" role="none">{menuItems}</div>
        </div>,
        document.body
      )}
    </>
  );
}

export function PuzzleHeaderActions({
  onHelp,
  helpLabel,
  beforeHelp,
  overflow,
}: PuzzleHeaderActionsProps) {
  const overflowActions = actionableElements(overflow);
  return (
    <div className="pw-play-header-action-group">
      {beforeHelp}
      <Pressable type="button" className="pw-play-header-action" onClick={onHelp} aria-label={helpLabel}>
        <HeaderActionIcon kind="help" />
        <span className="pw-play-header-action-text">Help</span>
      </Pressable>
      {overflowActions.length > 0 && <PuzzleHeaderOverflowMenu>{overflowActions}</PuzzleHeaderOverflowMenu>}
    </div>
  );
}

export function PuzzleHeaderCrosswordActions({
  onClues,
  onHelp,
  overflow,
}: PuzzleHeaderCrosswordActionsProps) {
  return (
    <PuzzleHeaderActions
      onHelp={onHelp}
      helpLabel="How to play crossword"
      beforeHelp={
        <Pressable type="button" className="pw-play-header-action pw-play-header-crossword-clues" onClick={onClues} aria-label="Open crossword clues">
          <HeaderActionIcon kind="clues" />
          <span className="pw-play-header-action-text">Clues</span>
        </Pressable>
      }
      overflow={overflow}
    />
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
