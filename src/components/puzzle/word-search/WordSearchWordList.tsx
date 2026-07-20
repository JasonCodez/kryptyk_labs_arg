"use client";

import { forwardRef, useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Pressable from "@/components/juice/Pressable";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { prefersReducedMotion } from "@/lib/juice";

interface Props {
  open: boolean;
  words: string[];
  foundWords: ReadonlySet<string>;
  onClose: () => void;
  onOpenDefinition: (word: string) => void;
  /** When false (Warz), found words stay informational-only: no definition affordance or click. */
  definitionsEnabled?: boolean;
}

function IconCheck() {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
      <path d="M3 8.5 6.5 12 13 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconChevron() {
  return (
    <svg className="word-search-word-item-chevron" width={11} height={11} viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
      <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconClose() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

/** Shared, accessible progress indicator: also guards the zero-word edge case against NaN. */
function WordListProgress({ found, total }: { found: number; total: number }) {
  const percent = total > 0 ? Math.round((found / total) * 100) : 0;
  return (
    <div
      className="word-search-list-progress"
      role="progressbar"
      aria-label="Word progress"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={found}
      aria-valuetext={`${found} of ${total} words found`}
    >
      <span
        className="word-search-list-progress-fill"
        style={{ "--word-progress": `${percent}%` } as React.CSSProperties}
      />
    </div>
  );
}

function WordListHeading({ headingId, found, total }: { headingId: string; found: number; total: number }) {
  return (
    <div className="word-search-list-progress-block">
      <h2 id={headingId}>Words to find</h2>
      <p>{found} of {total} found</p>
      <WordListProgress found={found} total={total} />
    </div>
  );
}

function WordItems({ words, foundWords, onOpenDefinition, definitionsEnabled = true }: Omit<Props, "open" | "onClose">) {
  return (
    <div className="word-search-word-items">
      {words.map((word) => {
        const found = foundWords.has(word);
        const canOpenDefinition = found && definitionsEnabled;
        return (
          <button
            type="button"
            key={word}
            className="word-search-word-item"
            data-found={found || undefined}
            data-definition-disabled={(found && !definitionsEnabled) || undefined}
            disabled={!canOpenDefinition}
            onClick={() => onOpenDefinition(word)}
            aria-label={`${word}, ${found ? (definitionsEnabled ? "found; open definition" : "found") : "not found"}`}
          >
            <span className="word-search-word-item-label">{word}</span>
            {found && (
              <span className="word-search-word-item-meta" aria-hidden="true">
                <span className="word-search-word-status">
                  <IconCheck />
                </span>
                {canOpenDefinition && (
                  <>
                    <span className="word-search-word-item-definition-label">Definition</span>
                    <IconChevron />
                  </>
                )}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

interface DesktopProps extends Omit<Props, "open" | "onClose"> {
  onEscape?: () => void;
}

export const WordSearchDesktopWordList = forwardRef<HTMLElement, DesktopProps>(function WordSearchDesktopWordList({ onEscape, ...props }, ref) {
  const headingId = useId();
  return (
    <aside
      ref={ref}
      className="word-search-desktop-list"
      aria-label="Words to find"
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        onEscape?.();
      }}
    >
      <div className="word-search-desktop-list-header">
        <WordListHeading headingId={headingId} found={props.foundWords.size} total={props.words.length} />
      </div>
      <WordItems {...props} />
    </aside>
  );
});

export default function WordSearchWordList({ open, words, foundWords, onClose, onOpenDefinition, definitionsEnabled = true }: Props) {
  const headingId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const reduced = Boolean(useReducedMotion() || prefersReducedMotion());
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = requestAnimationFrame(() => dialogRef.current?.focus());
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); return; }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const items = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])'));
      if (!items.length) { event.preventDefault(); dialogRef.current.focus(); return; }
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("keydown", onKey); restoreRef.current?.focus(); };
  }, [onClose, open]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="word-search-sheet-layer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={headingId}
            tabIndex={-1}
            className="word-search-sheet"
            initial={reduced ? false : { y: "100%" }}
            animate={{ y: 0 }}
            exit={reduced ? { opacity: 0 } : { y: "100%" }}
            drag={reduced ? false : "y"}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.3 }}
            onDragEnd={(_e, info) => (info.offset.y > 100 || info.velocity.y > 650) && onClose()}
          >
            <div className="word-search-sheet-handle" aria-hidden />
            <header className="word-search-sheet-header">
              <WordListHeading headingId={headingId} found={foundWords.size} total={words.length} />
              <Pressable type="button" className="word-search-sheet-close" onClick={onClose} aria-label="Close word list">
                <IconClose />
              </Pressable>
            </header>
            <WordItems
              words={words}
              foundWords={foundWords}
              definitionsEnabled={definitionsEnabled}
              onOpenDefinition={(word) => {
                onClose();
                window.requestAnimationFrame(() => onOpenDefinition(word));
              }}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
