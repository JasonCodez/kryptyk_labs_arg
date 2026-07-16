"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Pressable from "@/components/juice/Pressable";
import { prefersReducedMotion } from "@/lib/juice";
import type { CrosswordClue, CrosswordPresentationState } from "@/components/puzzle/CrosswordPuzzle";

type Direction = "across" | "down";

interface CrosswordClueSheetProps {
  open: boolean;
  direction: Direction;
  acrossClues: CrosswordClue[];
  downClues: CrosswordClue[];
  solvedClues: ReadonlySet<string>;
  activeClue: CrosswordPresentationState["activeClue"];
  onDirectionChange: (direction: Direction) => void;
  onSelectClue: (direction: Direction, number: number) => void;
  onClose: () => void;
}

export default function CrosswordClueSheet({
  open,
  direction,
  acrossClues,
  downClues,
  solvedClues,
  activeClue,
  onDirectionChange,
  onSelectClue,
  onClose,
}: CrosswordClueSheetProps) {
  const headingId = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const clueRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const systemReduceMotion = useReducedMotion();
  const reduceMotion = Boolean(systemReduceMotion || prefersReducedMotion());

  useEffect(() => {
    if (!open) return;

    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = window.requestAnimationFrame(() => {
      dialogRef.current?.focus({ preventScroll: true });
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
        )
      );
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", handleKeyDown);
      returnFocusRef.current?.focus({ preventScroll: true });
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !activeClue || activeClue.direction !== direction) return;
    const key = `${direction}-${activeClue.number}`;
    const frame = window.requestAnimationFrame(() => {
      clueRefs.current.get(key)?.scrollIntoView({ block: "nearest" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeClue, direction, open]);

  if (typeof document === "undefined") return null;

  const clues = direction === "across" ? acrossClues : downClues;
  const acrossSolved = acrossClues.filter((clue) => solvedClues.has(`across-${clue.number}`)).length;
  const downSolved = downClues.filter((clue) => solvedClues.has(`down-${clue.number}`)).length;
  const duration = reduceMotion ? 0 : 0.22;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="crossword-clue-sheet-layer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration }}
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) onClose();
          }}
        >
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={headingId}
            tabIndex={-1}
            className="crossword-clue-sheet"
            initial={reduceMotion ? false : { y: "100%" }}
            animate={{ y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { y: "100%" }}
            transition={{ duration, ease: [0.22, 1, 0.36, 1] }}
            drag={reduceMotion ? false : "y"}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.32 }}
            onDragEnd={(_event, info) => {
              if (info.offset.y > 100 || info.velocity.y > 650) onClose();
            }}
          >
            <div className="crossword-clue-sheet-handle" aria-hidden />
            <div className="crossword-clue-sheet-header">
              <div>
                <h2 id={headingId}>Crossword clues</h2>
                <p>Select a clue to return to the grid.</p>
              </div>
              <Pressable type="button" className="crossword-sheet-close" onClick={onClose} aria-label="Close clues">
                ×
              </Pressable>
            </div>

            <div className="crossword-clue-sheet-tabs" role="tablist" aria-label="Clue direction">
              {(["across", "down"] as const).map((tabDirection) => {
                const selected = tabDirection === direction;
                const solved = tabDirection === "across" ? acrossSolved : downSolved;
                const total = tabDirection === "across" ? acrossClues.length : downClues.length;
                return (
                  <Pressable
                    key={tabDirection}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    className="crossword-clue-sheet-tab"
                    data-active={selected || undefined}
                    onClick={() => onDirectionChange(tabDirection)}
                  >
                    {tabDirection} <span>{solved}/{total}</span>
                  </Pressable>
                );
              })}
            </div>

            <div className="crossword-clue-sheet-list" role="tabpanel">
              {clues.map((clue) => {
                const key = `${direction}-${clue.number}`;
                const solved = solvedClues.has(key);
                const active = activeClue?.direction === direction && activeClue.number === clue.number;
                return (
                  <Pressable
                    key={key}
                    ref={(node) => {
                      if (node) clueRefs.current.set(key, node);
                      else clueRefs.current.delete(key);
                    }}
                    type="button"
                    className="crossword-sheet-clue"
                    data-active={active || undefined}
                    data-solved={solved || undefined}
                    aria-current={active ? "true" : undefined}
                    onClick={() => {
                      onSelectClue(direction, clue.number);
                      onClose();
                    }}
                  >
                    <span className="crossword-sheet-clue-number">{clue.number}</span>
                    <span>{clue.text}</span>
                    {solved && <span className="crossword-sheet-clue-check" aria-label="Solved">✓</span>}
                  </Pressable>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
