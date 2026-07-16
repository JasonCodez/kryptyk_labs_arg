"use client";

import { useEffect, useId, useRef } from "react";
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
}

function WordItems({ words, foundWords, onOpenDefinition }: Omit<Props, "open" | "onClose">) {
  return (
    <div className="word-search-word-items">
      {words.map((word) => {
        const found = foundWords.has(word);
        return (
          <button
            type="button"
            key={word}
            className="word-search-word-item"
            data-found={found || undefined}
            disabled={!found}
            onClick={() => onOpenDefinition(word)}
            aria-label={`${word}, ${found ? "found; open definition" : "not found"}`}
          >
            <span>{word}</span>{found && <span aria-hidden>✓</span>}
          </button>
        );
      })}
    </div>
  );
}

export function WordSearchDesktopWordList(props: Omit<Props, "open" | "onClose">) {
  return (
    <aside className="word-search-desktop-list" aria-label="Words to find">
      <div><h2>Words to find</h2><span>{props.foundWords.size}/{props.words.length}</span></div>
      <WordItems {...props} />
    </aside>
  );
}

export default function WordSearchWordList({ open, words, foundWords, onClose, onOpenDefinition }: Props) {
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
            <header><div><h2 id={headingId}>Words to find</h2><p>{foundWords.size} of {words.length} found</p></div><Pressable type="button" onClick={onClose} aria-label="Close word list">×</Pressable></header>
            <WordItems
              words={words}
              foundWords={foundWords}
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
