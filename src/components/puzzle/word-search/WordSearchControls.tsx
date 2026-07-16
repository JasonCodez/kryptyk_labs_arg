"use client";

import Pressable from "@/components/juice/Pressable";

interface Props {
  hintTokens: number;
  hintPending: boolean;
  disabled: boolean;
  zoomed: boolean;
  canZoom: boolean;
  onHint: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
}

export default function WordSearchControls({ hintTokens, hintPending, disabled, zoomed, canZoom, onHint, onZoomIn, onZoomOut, onResetZoom }: Props) {
  return (
    <div className="word-search-controls" aria-label="Word Trove controls">
      <Pressable
        type="button"
        className="word-search-hint-button"
        disabled={disabled || hintPending || hintTokens < 1}
        onClick={onHint}
        aria-busy={hintPending}
      >
        <span aria-hidden>💡</span> {hintPending ? "Finding…" : hintTokens < 1 ? "No hints" : `Hint (${hintTokens})`}
      </Pressable>
      {canZoom && (
        <div className="word-search-zoom-controls" aria-label="Board zoom">
          <Pressable type="button" onClick={onZoomOut} aria-label="Zoom out">−</Pressable>
          <Pressable type="button" onClick={onZoomIn} aria-label="Zoom in">+</Pressable>
          <Pressable type="button" onClick={onResetZoom} disabled={!zoomed} aria-label="Reset zoom">Fit</Pressable>
        </div>
      )}
    </div>
  );
}
