"use client";

/**
 * JigsawPuzzle — Canvas2D rewrite
 *
 * Architecture:
 *  - Single <canvas> for the board area  (all piece rendering via Canvas2D)
 *  - Horizontal scrollable tray below the board (DOM-level, not canvas-managed)
 *  - requestAnimationFrame render loop with dirty-flag (no unnecessary repaints)
 *  - Path2D cache per piece shape (same bezier math as before, now as Path2D)
 *  - Hit-testing via ctx.isPointInPath on the Path2D cache
 *  - Smooth drag via pointer-events on the canvas; pinch-zoom via two-pointer tracking
 *  - Completion: GSAP shimmer + energy-ring, same as before
 *  - localStorage save/resume preserved
 *  - Same external props API — all callsites unchanged
 */

export { default } from "./JigsawPuzzleCanvas";
export type {
  JigsawCompletionResult,
  JigsawPresentationState,
  JigsawPuzzleHandle,
  JigsawPuzzleProps,
  JigsawStatus,
} from "./JigsawPuzzleCanvas";
