"use client";

// Site-wide tap feedback via event delegation — one listener in the root layout
// gives every button and link a soft click + haptic tick, including pages and
// components added later, with no per-call-site wiring.
//
// Opt-outs:
//   • <Pressable> renders data-juiced and is skipped (it fires its own cue)
//   • add data-nojuice to any element (or ancestor) that should stay silent

import { useEffect } from "react";
import { juice } from "@/lib/juice";

const INTERACTIVE = "button, a[href], [role='button']";
const SILENT = "[data-juiced], [data-nojuice], input, textarea, select, [contenteditable='true']";

export default function JuiceClickLayer() {
  useEffect(() => {
    let lastPlayed = 0;

    const onPointerDown = (e: PointerEvent) => {
      // Primary button / touch only — no feedback on right-click or middle-click
      if (e.button !== 0) return;
      const target = e.target;
      if (!(target instanceof Element)) return;
      const interactive = target.closest(INTERACTIVE);
      if (!interactive) return;
      if (target.closest(SILENT) || interactive.closest(SILENT)) return;
      if (interactive instanceof HTMLButtonElement && interactive.disabled) return;

      // Rapid-fire guard (double taps, key repeat via pointer) — one click per 80ms
      const now = performance.now();
      if (now - lastPlayed < 80) return;
      lastPlayed = now;

      juice.tap();
    };

    document.addEventListener("pointerdown", onPointerDown, { passive: true });
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  return null;
}
