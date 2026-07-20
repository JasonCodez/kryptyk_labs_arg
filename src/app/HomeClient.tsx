"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import { useAppReducedMotion } from "@/hooks/useAppReducedMotion";
import PressableCard from "@/components/ui/PressableCard";
import PageContainer from "@/components/ui/PageContainer";
import ContinuePlayingCard from "@/components/home/ContinuePlayingCard";
import DailyPuzzleHeroCard from "@/components/home/DailyPuzzleHeroCard";

// Discovery roles: daily = secondary (streaks/resets are gold territory),
// catalog = primary (general play), Warz = accent (the one "featured" slot).
const FEATURES = [
  {
    icon: "🗓️",
    title: "More Daily Puzzles",
    accent: "secondary" as const,
    body: "Sudoku, Crossword, Word Trove, and Jigsaw — a fresh set every day.",
    href: "/daily",
    cta: "View Daily Puzzles",
  },
  {
    icon: "🧩",
    title: "Full Catalog",
    accent: "primary" as const,
    body: "Crosswords, Word Troves, jigsaws, anagrams, detective cases, and more.",
    href: "/puzzles",
    cta: "Open Catalog",
  },
  {
    icon: "⚔",
    title: "Warz Battles",
    accent: "accent" as const,
    body: "Head-to-head puzzle battles. Same puzzle, ranked pressure.",
    href: "warz-cta",
    cta: "Enter Warz",
  },
];

export default function HomeClient() {
  const { data: session } = useSession();
  const competeHref = session ? "/warz" : "/auth/register";
  const reduceMotion = useAppReducedMotion();

  return (
    <main
      style={{
        backgroundColor: "var(--pw-bg-base)",
        minHeight: "100vh",
        paddingTop: "calc(56px + env(safe-area-inset-top, 0px))",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      {/* ── Hero: Continue Playing (if active) then Daily Puzzle ── */}
      <PageContainer as="section" size="reading" className="pt-6 pb-2" data-testid="home-hero-container">
        <div className="flex flex-col gap-4">
          <ContinuePlayingCard />
          <DailyPuzzleHeroCard />
        </div>
      </PageContainer>

      {/* ── Feature strip ── */}
      <PageContainer as="section" size="content" className="py-10" data-testid="home-feature-container">
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
                <h3 className="text-base font-extrabold mb-1.5" style={{ color: "var(--pw-text-primary)" }}>{feature.title}</h3>
                <p className="text-sm leading-relaxed mb-3" style={{ color: "var(--pw-text-secondary)" }}>{feature.body}</p>
                <span className="text-sm font-bold" style={{ color: "var(--pw-text-primary)" }}>
                  {feature.href === "warz-cta" ? (session ? feature.cta : "Create Account") : feature.cta} &rarr;
                </span>
              </PressableCard>
            </motion.div>
          ))}
        </div>
      </PageContainer>

      {/* ── Footer ── */}
      <PageContainer as="footer" size="content" className="py-10" style={{ borderTop: "1px solid var(--pw-border-subtle)" }} data-testid="home-footer-container">
        <div className="flex flex-wrap justify-between items-start gap-8 mb-6">
          <div>
            <div className="inline-flex items-center gap-2 mb-2">
              <img src="/images/puzzle_warz_logo.png" alt="PuzzleWarz" className="h-7 w-auto" />
              {/* Wordmark = trophy gold, the brand's reward/identity role. */}
              <span className="text-xs font-extrabold uppercase tracking-widest" style={{ color: "var(--pw-brand-secondary)" }}>PuzzleWarz</span>
            </div>
            <p className="text-xs max-w-[250px] leading-relaxed" style={{ color: "var(--pw-text-secondary)" }}>
              Daily puzzles first. Full catalog right behind them.
            </p>
          </div>
          <div className="flex gap-10 flex-wrap text-sm">
            <div className="flex flex-col gap-2.5">
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--pw-text-secondary)" }}>Play</p>
              {[["Daily Puzzles", "/daily"], ["Puzzle Library", "/puzzles"], ["Leaderboards", "/leaderboards"], ["Warz Battles", competeHref]].map(([label, href]) => (
                <Link key={label} href={href} className="transition-colors hover:text-white" style={{ color: "var(--pw-text-secondary)" }}>{label}</Link>
              ))}
            </div>
            <div className="flex flex-col gap-2.5">
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--pw-text-secondary)" }}>Account</p>
              {[["Sign Up Free", "/auth/register"], ["Sign In", "/auth/signin"], ["Profile", "/profile"]].map(([label, href]) => (
                <Link key={label} href={href} className="transition-colors hover:text-white" style={{ color: "var(--pw-text-secondary)" }}>{label}</Link>
              ))}
            </div>
          </div>
        </div>
        <div className="pt-4 flex flex-wrap justify-between items-center gap-2" style={{ borderTop: "1px solid var(--pw-border-subtle)" }}>
          <p className="text-xs" style={{ color: "var(--pw-text-muted)" }}>&copy; 2026 PuzzleWarz &middot; All rights reserved</p>
          <p className="text-xs" style={{ color: "var(--pw-text-muted)" }}>Start fast. Stay sharp. Finish strong.</p>
        </div>
      </PageContainer>
    </main>
  );
}
