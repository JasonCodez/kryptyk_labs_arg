"use client";

import { useRef, useState } from "react";
import JigsawDialogFrame from "./JigsawDialogFrame";

export default function JigsawResetDialog({ onClose, onReset }: { onClose: () => void; onReset: () => void }) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [running, setRunning] = useState(false);
  return <JigsawDialogFrame title="Reset this puzzle?" onClose={onClose} safestActionRef={cancelRef}>
    <p>This clears only this play mode&apos;s saved arrangement and returns every piece to its initial tray position.</p>
    <div className="jigsaw-dialog-actions">
      <button ref={cancelRef} type="button" onClick={onClose}>Keep Progress</button>
      <button type="button" disabled={running} onClick={() => { if (running) return; setRunning(true); onReset(); onClose(); }}>Reset Puzzle</button>
    </div>
  </JigsawDialogFrame>;
}
