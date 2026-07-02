"use client";

import { useEffect, useState } from "react";

// Matches the admin puzzle creator's preview scaling (page_new.tsx) so the board the
// player sees has the same aspect ratio — and piece proportions — as what the admin saw.
const JIGSAW_BOARD_MAX = 640;

// Detects a jigsaw image's natural aspect ratio and scales it to fit within a
// JIGSAW_BOARD_MAX x JIGSAW_BOARD_MAX box, preserving aspect ratio. Returns null
// until the probe resolves, so callers can defer mounting the board until then —
// JigsawPuzzleCanvas reads boardWidth/boardHeight only at mount.
export function useJigsawBoardDims(imageUrl: string | null | undefined): { w: number; h: number } | null {
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    if (!imageUrl) {
      setDims(null);
      return;
    }

    let cancelled = false;
    const img = new window.Image();
    img.onload = () => {
      if (cancelled) return;
      const { naturalWidth: nw, naturalHeight: nh } = img;
      if (!nw || !nh) {
        setDims({ w: JIGSAW_BOARD_MAX, h: JIGSAW_BOARD_MAX * 0.75 });
        return;
      }
      const scale = Math.min(JIGSAW_BOARD_MAX / nw, JIGSAW_BOARD_MAX / nh, 1);
      setDims({ w: Math.round(nw * scale), h: Math.round(nh * scale) });
    };
    img.onerror = () => {
      if (!cancelled) setDims({ w: JIGSAW_BOARD_MAX, h: JIGSAW_BOARD_MAX * 0.75 });
    };
    img.src = imageUrl;

    return () => {
      cancelled = true;
    };
  }, [imageUrl]);

  return dims;
}
