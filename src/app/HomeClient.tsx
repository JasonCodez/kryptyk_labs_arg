"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { motion, useReducedMotion } from "framer-motion";
import { prefersReducedMotion } from "@/lib/juice";
import PressableCard from "@/components/ui/PressableCard";
import ContinuePlayingCard from "@/components/home/ContinuePlayingCard";
import DailyPuzzleHeroCard from "@/components/home/DailyPuzzleHeroCard";

const FEATURES = [
  {
    icon: "🗓️",
    title: "More Daily Puzzles",
    accent: "gold" as const,
    body: "Sudoku, Crossword, Word Trove, and Jigsaw — a fresh set every day.",
    href: "/daily",
    cta: "View Daily Puzzles",
  },
  {
    icon: "🧩",
    title: "Full Catalog",
    accent: "teal" as const,
    body: "Crosswords, Word Troves, jigsaws, anagrams, detective cases, and more.",
    href: "/puzzles",
    cta: "Open Catalog",
  },
  {
    icon: "⚔",
    title: "Warz Battles",
    accent: "violet" as const,
    body: "Head-to-head puzzle battles. Same puzzle, ranked pressure.",
    href: "warz-cta",
    cta: "Enter Warz",
  },
];

export default function HomeClient() {
  const { data: session } = useSession();
  const competeHref = session ? "/warz" : "/auth/register";
  const reduceMotion = useReducedMotion() || prefersReducedMotion();

  return (
    <main
      style={{
        backgroundColor: "var(--pw-ink)",
        minHeight: "100vh",
        paddingTop: "calc(56px + env(safe-area-inset-top, 0px))",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      {/* ── Hero: Continue Playing (if active) then Daily Puzzle ── */}
      <section className="px-4 pt-6 pb-2 lg:max-w-2xl lg:mx-auto">
        <div className="flex flex-col gap-4">
          <ContinuePlayingCard />
          <DailyPuzzleHeroCard />
        </div>
      </section>

      {/* ── Feature strip ── */}
      <section className="px-4 py-10 lg:max-w-4xl lg:mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {FEATURES.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={reduceMotion ? undefined : { opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ type: "spring", stiffness: 380, damping: 30, delay: reduceMotion ? 0 : index * 0.08 }}
            >
              <PressableCard href={feature.href === "warz-cta" ? competeHref : feature.href} accent={feature.accent} padding="md">
                <span className="text-2xl block mb-2">{feature.icon}</span>
                <h3 className="text-base font-extrabold mb-1.5" style={{ color: "var(--pw-text)" }}>{feature.title}</h3>
                <p className="text-sm leading-relaxed mb-3" style={{ color: "var(--pw-text-dim)" }}>{feature.body}</p>
                <span className="text-sm font-bold" style={{ color: "var(--pw-text)" }}>
                  {feature.href === "warz-cta" ? (session ? feature.cta : "Create Account") : feature.cta} &rarr;
                </span>
              </PressableCard>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="px-4 py-10 lg:max-w-4xl lg:mx-auto" style={{ borderTop: "1px solid var(--pw-line)" }}>
        <div className="flex flex-wrap justify-between items-start gap-8 mb-6">
          <div>
            <div className="inline-flex items-center gap-2 mb-2">
              <img src="/images/puzzle_warz_logo.png" alt="PuzzleWarz" className="h-7 w-auto" />
              <span className="text-xs font-extrabold uppercase tracking-widest" style={{ color: "var(--pw-success)" }}>PuzzleWarz</span>
            </div>
            <p className="text-xs max-w-[250px] leading-relaxed" style={{ color: "var(--pw-text-dim)" }}>
              Daily puzzles first. Full catalog right behind them.
            </p>
          </div>
          <div className="flex gap-10 flex-wrap text-sm">
            <div className="flex flex-col gap-2.5">
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--pw-text-dim)" }}>Play</p>
              {[["Daily Puzzles", "/daily"], ["Puzzle Library", "/puzzles"], ["Leaderboards", "/leaderboards"], ["Warz Battles", competeHref]].map(([label, href]) => (
                <Link key={label} href={href} className="transition-colors hover:text-white" style={{ color: "var(--pw-text-dim)" }}>{label}</Link>
              ))}
            </div>
            <div className="flex flex-col gap-2.5">
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--pw-text-dim)" }}>Account</p>
              {[["Sign Up Free", "/auth/register"], ["Sign In", "/auth/signin"], ["Profile", "/profile"]].map(([label, href]) => (
                <Link key={label} href={href} className="transition-colors hover:text-white" style={{ color: "var(--pw-text-dim)" }}>{label}</Link>
              ))}
            </div>
          </div>
        </div>
        <div className="pt-4 flex flex-wrap justify-between items-center gap-2" style={{ borderTop: "1px solid var(--pw-line)" }}>
          <p className="text-xs" style={{ color: "var(--pw-text-faint)" }}>&copy; 2026 PuzzleWarz &middot; All rights reserved</p>
          <p className="text-xs" style={{ color: "var(--pw-text-faint)" }}>Start fast. Stay sharp. Finish strong.</p>
        </div>
      </footer>
    </main>
  );
}
