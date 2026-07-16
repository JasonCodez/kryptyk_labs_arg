"use client";

import { useEffect, useState } from "react";

export interface JigsawImageInfo {
  ready: boolean;
  width: number | null;
  height: number | null;
  isSquare: boolean;
  error: boolean;
}

const IDLE: JigsawImageInfo = { ready: false, width: null, height: null, isSquare: false, error: false };

// Every jigsaw board is a fixed BOARD_SIZE×BOARD_SIZE logical square (see JigsawPuzzleCanvas) —
// this hook does NOT compute board dimensions from the source image and callers must not pass
// any dimension it returns as a board size. It only reports facts about the source image
// itself (natural size, whether it's square, whether it failed to load) so callers can gate
// rendering until the probe resolves. A non-square legacy source is still center-cropped to
// square at draw time (never stretched) — `isSquare` is informational only.
export function useJigsawImageInfo(imageUrl: string | null | undefined): JigsawImageInfo {
  const [info, setInfo] = useState<{ imageUrl: string } & JigsawImageInfo>({ imageUrl: "", ...IDLE });

  useEffect(() => {
    if (!imageUrl) return;
    let cancelled = false;
    const img = new window.Image();
    img.onload = () => {
      if (cancelled) return;
      const { naturalWidth: w, naturalHeight: h } = img;
      const isSquare = w > 0 && h > 0 && Math.abs(w / h - 1) <= 0.02;
      setInfo({ imageUrl, ready: true, width: w || null, height: h || null, isSquare, error: false });
    };
    img.onerror = () => {
      if (cancelled) return;
      setInfo({ imageUrl, ready: true, width: null, height: null, isSquare: false, error: true });
    };
    img.src = imageUrl;
    return () => { cancelled = true; };
  }, [imageUrl]);

  if (!imageUrl) return IDLE;
  return info.imageUrl === imageUrl ? info : IDLE;
}
