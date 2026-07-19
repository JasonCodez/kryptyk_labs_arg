"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import JigsawDialogFrame from "./JigsawDialogFrame";

function IconWarning() {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" focusable="false">
      <path d="M12 3.5 21.5 20h-19L12 3.5Z" strokeLinejoin="round" />
      <path d="M12 9.5v5" strokeLinecap="round" />
      <path d="M12 17.2h.01" strokeLinecap="round" />
    </svg>
  );
}

export default function JigsawResetDialog({ onClose, onReset }: { onClose: () => void; onReset: () => void }) {
  const keepProgressRef = useRef<HTMLButtonElement>(null);
  const [running, setRunning] = useState(false);

  // Same stabilization used by JigsawHelpDialog/JigsawPreviewDialog: the caller passes fresh
  // inline onClose/onReset on every render, which would otherwise rerun JigsawDialogFrame's
  // initial-focus effect (its deps include onClose) and could pull focus/scroll away from
  // Keep Progress.
  const onCloseRef = useRef(onClose);
  const onResetRef = useRef(onReset);
  useEffect(() => { onCloseRef.current = onClose; });
  useEffect(() => { onResetRef.current = onReset; });
  const stableOnClose = useCallback(() => { onCloseRef.current(); }, []);

  // hasResetRef is a synchronous guard against rapid repeated activation (e.g. a double-tap
  // landing before React has re-rendered with running=true and disabled the button) — the
  // `running` state alone only prevents a *second render's* click, not a second click within
  // the same tick.
  const hasResetRef = useRef(false);
  const stableOnReset = useCallback(() => {
    if (hasResetRef.current) return;
    hasResetRef.current = true;
    setRunning(true);
    onResetRef.current();
    onCloseRef.current();
  }, []);

  return (
    <JigsawDialogFrame title="Reset this puzzle?" onClose={stableOnClose} safestActionRef={keepProgressRef}>
      <div className="jigsaw-reset">
        <IconWarning />
        <span className="jigsaw-reset-label">RESET ARRANGEMENT</span>
        <p className="jigsaw-reset-primary">Every piece will return to its initial tray position.</p>
        <p className="jigsaw-reset-support">Your current arrangement will be cleared. This cannot be undone.</p>
        <div className="jigsaw-reset-actions">
          <button type="button" ref={keepProgressRef} className="jigsaw-reset-keep" onClick={stableOnClose}>
            Keep Progress
          </button>
          <button type="button" className="jigsaw-reset-confirm" disabled={running} onClick={stableOnReset}>
            {running ? "Resetting…" : "Reset Puzzle"}
          </button>
        </div>
      </div>
    </JigsawDialogFrame>
  );
}
