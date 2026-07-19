"use client";

import { useCallback, useEffect, useRef } from "react";
import JigsawDialogFrame from "./JigsawDialogFrame";

export default function JigsawPreviewDialog({ imageUrl, puzzleTitle, onClose }: { imageUrl: string; puzzleTitle: string; onClose: () => void }) {
  // Same stabilization as JigsawHelpDialog: the caller passes an inline onClose that changes
  // identity on every parent render, which would otherwise rerun JigsawDialogFrame's
  // initial-focus effect and risk pulling the dialog's scroll position away from the top.
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });
  const stableOnClose = useCallback(() => { onCloseRef.current(); }, []);

  return (
    <JigsawDialogFrame title="Puzzle preview" onClose={stableOnClose}>
      <div className="jigsaw-preview">
        <span className="jigsaw-preview-eyebrow">COMPLETED IMAGE</span>
        <div className="jigsaw-preview-frame">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="jigsaw-preview-image" src={imageUrl} alt={`Completed image for ${puzzleTitle}`} />
        </div>
        <p className="jigsaw-preview-title">{puzzleTitle}</p>
        <button type="button" className="jigsaw-preview-back" onClick={stableOnClose}>
          Back to Puzzle
        </button>
      </div>
    </JigsawDialogFrame>
  );
}
