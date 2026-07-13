"use client";

import { motion } from "framer-motion";

interface SolvedIconOverlayProps {
  /** Play the pop-in animation once on mount instead of rendering already-settled. Used for
   * the specific card the player just returned from after solving it. */
  animateIn?: boolean;
  /** Checkmark size in px — pass a smaller value for compact (list-row) icon tiles. */
  size?: number;
}

/** Checkmark overlay for the icon tile on a solved puzzle card. Sits absolutely inside a
 * `position: relative` icon tile — see GridPuzzleCard/ListPuzzleCard's icon markup. Uses
 * `borderRadius: inherit` so it matches whatever tile size/radius it's dropped into. */
export default function SolvedIconOverlay({ animateIn = false, size = 28 }: SolvedIconOverlayProps) {
  return (
    <motion.div
      initial={animateIn ? { scale: 0, opacity: 0 } : { scale: 1, opacity: 1 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={animateIn ? { type: "spring", stiffness: 520, damping: 15, delay: 0.1 } : { duration: 0 }}
      className="absolute inset-0 flex items-center justify-center"
      style={{ background: "rgba(16,18,31,0.72)", color: "#2ED991", fontSize: size, fontWeight: 900, borderRadius: "inherit" }}
      aria-hidden
    >
      ✓
    </motion.div>
  );
}
