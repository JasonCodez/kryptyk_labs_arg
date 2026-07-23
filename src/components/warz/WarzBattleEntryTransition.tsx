"use client";

import { motion } from "framer-motion";
import { Swords, ShieldCheck } from "lucide-react";
import { useAppReducedMotion } from "@/hooks/useAppReducedMotion";

export interface WarzBattleEntryTransitionProps {
  mode: "accepted" | "resume";
}

/**
 * Brief, one-shot transition shown between a successful accept/resume action
 * and the active WarzPlayBoard mounting. Purely presentational — performs no
 * requests, no navigation, and never mounts gameplay itself; the page owns
 * the timer that decides when to swap this out for the play board.
 */
export default function WarzBattleEntryTransition({ mode }: WarzBattleEntryTransitionProps) {
  const reduceMotion = useAppReducedMotion();
  const accepted = mode === "accepted";

  return (
    <motion.div
      initial={reduceMotion ? undefined : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduceMotion ? 0 : 0.15 }}
      className="flex flex-col items-center justify-center gap-3 py-24 text-center"
    >
      {accepted ? (
        <Swords aria-hidden="true" size={32} style={{ color: "var(--pw-brand-secondary)" }} />
      ) : (
        <ShieldCheck aria-hidden="true" size={32} style={{ color: "var(--pw-brand-secondary)" }} />
      )}
      <p className="text-sm font-extrabold uppercase tracking-widest" style={{ color: "var(--pw-brand-secondary)" }}>
        {accepted ? "Challenge Accepted" : "Battle Ready"}
      </p>
      <p className="text-sm" style={{ color: "var(--pw-text-secondary)" }}>
        {accepted ? "Battle starting…" : "Preparing your puzzle…"}
      </p>
    </motion.div>
  );
}
