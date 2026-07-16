"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export default function SudokuHelpDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!open) return;
    returnFocusRef.current = document.activeElement as HTMLElement;
    const frame = requestAnimationFrame(() => dialogRef.current?.querySelector<HTMLElement>("button")?.focus());
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>('button,[href],[tabindex]:not([tabindex="-1"])')];
      if (!focusable.length) return;
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => { cancelAnimationFrame(frame); document.removeEventListener("keydown", onKey); returnFocusRef.current?.focus(); };
  }, [onClose, open]);
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="sudoku-dialog-backdrop" onPointerDown={(event) => event.target === event.currentTarget && onClose()}>
      <div ref={dialogRef} className="sudoku-help-dialog" role="dialog" aria-modal="true" aria-labelledby="sudoku-help-title">
        <button type="button" className="sudoku-dialog-close" onClick={onClose} aria-label="Close help">×</button>
        <h2 id="sudoku-help-title">How to play Sudoku</h2>
        <p>Fill each row, column, and 3×3 box with the numbers 1–9 without repeats.</p>
        <p>Select a cell, then use the number pad. Notes add candidates; Undo restores your last move. Rule conflicts are highlighted without revealing the answer.</p>
        <button type="button" className="sudoku-dialog-primary" onClick={onClose}>Got it</button>
      </div>
    </div>, document.body
  );
}
