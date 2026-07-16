"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";

export default function JigsawDialogFrame({ title, onClose, children, safestActionRef }: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  safestActionRef?: React.RefObject<HTMLButtonElement | null>;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnRef = useRef<HTMLElement | null>(null);
  useBodyScrollLock();
  useEffect(() => {
    returnRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = requestAnimationFrame(() => (safestActionRef?.current ?? dialogRef.current)?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); return; }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])'));
      if (!focusable.length) return;
      const first = focusable[0]; const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    addEventListener("keydown", onKeyDown);
    return () => { cancelAnimationFrame(frame); removeEventListener("keydown", onKeyDown); returnRef.current?.focus(); };
  }, [onClose, safestActionRef]);
  return <div className="jigsaw-dialog-layer" onPointerDown={(event) => event.target === event.currentTarget && onClose()}>
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} className="jigsaw-dialog">
      <header><h2>{title}</h2><button type="button" onClick={onClose} aria-label="Close">×</button></header>
      {children}
    </div>
  </div>;
}
