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
        setDims({ w: JIGSAW_BOARD_MAX, h: JIGSAW_BOARD_MAX });
        return;
      }
      // The board is always a perfect square — source images are authored 1:1. Scale off
      // the smaller natural dimension so an accidentally non-square upload still yields a
      // square board (JigsawPuzzleCanvas center-crops the image to match at draw time)
      // rather than a stretched/distorted one.
      const scale = Math.min(JIGSAW_BOARD_MAX / nw, JIGSAW_BOARD_MAX / nh, 1);
      const side = Math.round(Math.min(nw, nh) * scale);
      setDims({ w: side, h: side });
    };
    img.onerror = () => {
      if (!cancelled) setDims({ w: JIGSAW_BOARD_MAX, h: JIGSAW_BOARD_MAX });
    };
    img.src = imageUrl;

    return () => {
      cancelled = true;
    };
  }, [imageUrl]);

  return dims;
}
