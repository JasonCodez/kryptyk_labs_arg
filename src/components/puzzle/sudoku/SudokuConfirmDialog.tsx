"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface Props {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export default function SudokuConfirmDialog({ open, title, description, confirmLabel, onClose, onConfirm }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const safeActionRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const pendingRef = useRef(false);
  const onCloseRef = useRef(onClose);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const activeElement = document.activeElement as HTMLElement | null;
    returnFocusRef.current = activeElement && activeElement !== document.body
      ? activeElement
      : document.querySelector<HTMLElement>('[aria-label="More puzzle actions"]');
    const frame = requestAnimationFrame(() => safeActionRef.current?.focus());
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pendingRef.current) { event.preventDefault(); onCloseRef.current(); return; }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const items = [...dialogRef.current.querySelectorAll<HTMLElement>('button:not(:disabled),[href],[tabindex]:not([tabindex="-1"])')];
      if (!items.length) return;
      const first = items[0]; const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      cancelAnimationFrame(frame); document.removeEventListener("keydown", handleKey);
      const target = returnFocusRef.current?.isConnected && returnFocusRef.current !== document.body
        ? returnFocusRef.current
        : document.querySelector<HTMLElement>('[aria-label="More puzzle actions"]');
      requestAnimationFrame(() => target?.focus());
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="sudoku-dialog-backdrop" onPointerDown={(event) => { if (event.target === event.currentTarget && !pending) onClose(); }}>
      <div ref={dialogRef} className="sudoku-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="sudoku-confirm-title" aria-describedby="sudoku-confirm-description">
        <h2 id="sudoku-confirm-title">{title}</h2>
        <p id="sudoku-confirm-description">{description}</p>
        {error && <p className="sudoku-dialog-error" role="alert">{error}</p>}
        <div>
          <button ref={safeActionRef} type="button" onClick={onClose} disabled={pending}>Keep playing</button>
          <button type="button" disabled={pending} onClick={async () => {
            pendingRef.current = true; setPending(true); setError("");
            try { await onConfirm(); }
            catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to give up. Please try again."); }
            finally { pendingRef.current = false; setPending(false); }
          }}>{pending ? "Giving up…" : confirmLabel}</button>
        </div>
      </div>
    </div>, document.body
  );
}
