"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useRegisterModal } from "@/hooks/useRegisterModal";

/* ── Step definitions ──────────────────────────────────────────────── */
const STEPS = [
  {
    id: "welcome",
    accent: "#3891A6",
    icon: "🎉",
    eyebrow: "Welcome to PuzzleWarz",
    title: "You're In.",
    body: "Your puzzle journey starts now. Here's a quick look at what's waiting for you.",
    visual: null as string | null,
  },
  {
    id: "frequency",
    accent: "#3891A6",
    icon: "📡",
    eyebrow: "Daily Challenge",
    title: "One Question.\nEvery Day.",
    body: "The Frequency game drops a new question every 24 hours. Answer correctly, build your streak, and earn bonus points. Miss a day and you fall behind.",
    visual: "streak",
  },
  {
    id: "ranks",
    accent: "#FDE74C",
    icon: "🏆",
    eyebrow: "Leaderboard",
    title: "Climb the Ranks.",
    body: "Solve puzzles to earn points and XP. Compete on the global leaderboard, earn season rewards, and challenge rivals head-to-head in Warz Mode.",
    visual: "leaderboard",
  },
  {
    id: "puzzles",
    accent: "#3891A6",
    icon: "🧩",
    eyebrow: "Puzzle Arsenal",
    title: "More Than\nJust Puzzles.",
    body: "Every puzzle type has its own leaderboard and rewards. Mix and match to maximise your point haul.",
    visual: "puzzles",
  },
];

/* ── Inline visuals ─────────────────────────────────────────────────── */
function StreakVisual() {
  const days = ["M", "T", "W", "T", "F", "S", "S"];
  return (
    <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 20 }}>
      {days.map((d, i) => (
        <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <div
            style={{
              width: 36, height: 36, borderRadius: 10,
              background: i < 4 ? "linear-gradient(135deg,#3891A6,#2d7a8e)" : "rgba(56,145,166,0.1)",
              border: i < 4 ? "1px solid rgba(56,145,166,0.6)" : "1px solid rgba(56,145,166,0.2)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16,
              boxShadow: i < 4 ? "0 0 12px rgba(56,145,166,0.4)" : "none",
            }}
          >
            {i < 4 ? "🔥" : <span style={{ color: "#6b7280", fontSize: 12 }}>–</span>}
          </div>
          <span style={{ fontSize: 10, color: i < 4 ? "#3891A6" : "#6b7280", fontWeight: 600 }}>{d}</span>
        </div>
      ))}
    </div>
  );
}

function LeaderboardVisual() {
  const rows = [
    { rank: 1, name: "ShadowRiddle", pts: "4,820", medal: "🥇" },
    { rank: 2, name: "NeonCipher",   pts: "4,310", medal: "🥈" },
    { rank: 3, name: "YOU",          pts: "3,990", medal: "🥉", highlight: true },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 20 }}>
      {rows.map((r) => (
        <div
          key={r.rank}
          style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "8px 12px", borderRadius: 10,
            background: r.highlight ? "rgba(253,231,76,0.08)" : "rgba(56,145,166,0.06)",
            border: r.highlight ? "1px solid rgba(253,231,76,0.3)" : "1px solid rgba(56,145,166,0.12)",
          }}
        >
          <span style={{ fontSize: 16, width: 22 }}>{r.medal}</span>
          <span style={{ flex: 1, fontSize: 12, fontWeight: r.highlight ? 800 : 600, color: r.highlight ? "#FDE74C" : "#fff" }}>{r.name}</span>
          <span style={{ fontSize: 12, color: "#9ca3af", fontWeight: 600 }}>{r.pts} pts</span>
        </div>
      ))}
    </div>
  );
}

function PuzzlesVisual() {
  const types = [
    { icon: "📡", label: "Frequency",  sub: "Daily · Streak" },
    { icon: "🔤", label: "Hidden Word", sub: "Speed · Letters" },
    { icon: "🔢", label: "Sudoku",     sub: "Logic · Grid" },
  ];
  return (
    <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 20 }}>
      {types.map((t) => (
        <div
          key={t.label}
          style={{
            flex: 1, padding: "10px 8px", borderRadius: 12, textAlign: "center",
            background: "rgba(56,145,166,0.07)",
            border: "1px solid rgba(56,145,166,0.18)",
          }}
        >
          <div style={{ fontSize: 22, marginBottom: 4 }}>{t.icon}</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#fff", marginBottom: 2 }}>{t.label}</div>
          <div style={{ fontSize: 10, color: "#6b7280" }}>{t.sub}</div>
        </div>
      ))}
    </div>
  );
}

/* ── Slide variants ─────────────────────────────────────────────────── */
const variants = {
  enter: (dir: number) => ({ x: dir > 0 ? 260 : -260, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit:  (dir: number) => ({ x: dir > 0 ? -260 : 260, opacity: 0 }),
};

/* ── Main component ─────────────────────────────────────────────────── */
interface OnboardingModalProps {
  onComplete: () => void;
}

export default function OnboardingModal({ onComplete }: OnboardingModalProps) {
  useRegisterModal('onboarding-modal');
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  function finish() {
    localStorage.setItem("pw_onboarding_done", "1");
    onComplete();
  }

  function next() {
    if (isLast) { finish(); return; }
    setDir(1);
    setStep((s) => s + 1);
  }

  function back() {
    setDir(-1);
    setStep((s) => s - 1);
  }

  function renderVisual() {
    if (!current.visual) return null;
    if (current.visual === "streak")      return <StreakVisual />;
    if (current.visual === "leaderboard") return <LeaderboardVisual />;
    if (current.visual === "puzzles")     return <PuzzlesVisual />;
    return null;
  }

  return (
    <motion.div
      className="fixed inset-0 z-[300] flex items-center justify-center"
      style={{ backgroundColor: "rgba(2,2,2,0.92)", backdropFilter: "blur(12px)" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
    >
      {/* Radial glow */}
      <div
        className="absolute pointer-events-none"
        style={{
          width: 600, height: 600, borderRadius: "50%",
          background: `radial-gradient(circle, ${current.accent}22 0%, transparent 70%)`,
          transition: "background 0.5s ease",
          zIndex: 1,
        }}
      />

      {/* Card */}
      <div
        className="relative w-full mx-4 rounded-3xl overflow-hidden"
        style={{
          maxWidth: 460,
          background: "linear-gradient(160deg, #070f12 0%, #04080a 60%, #020202 100%)",
          border: `1px solid ${current.accent}55`,
          boxShadow: `0 0 60px ${current.accent}20, 0 32px 80px rgba(0,0,0,0.7)`,
          zIndex: 2,
          transition: "border-color 0.4s ease, box-shadow 0.4s ease",
        }}
      >
        {/* Animated border glow */}
        <motion.div
          className="absolute top-0 left-0 right-0 h-[2px] rounded-t-3xl"
          style={{ background: `linear-gradient(90deg, transparent, ${current.accent}, transparent)` }}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Skip × */}
        <button
          onClick={finish}
          className="absolute top-4 right-4 z-10 transition-opacity hover:opacity-100"
          style={{ color: "#9ca3af", opacity: 1, background: "none", border: "none", cursor: "pointer", fontSize: 18, lineHeight: 1, padding: "4px 8px" }}
          aria-label="Skip tour"
        >
          ×
        </button>

        {/* Step counter */}
        <div className="absolute top-4 left-5" style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600, letterSpacing: "0.06em" }}>
          {step + 1} / {STEPS.length}
        </div>

        {/* Slide area */}
        <div className="overflow-hidden" style={{ minHeight: 380 }}>
          <AnimatePresence custom={dir} mode="wait">
            <motion.div
              key={step}
              custom={dir}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.28, ease: "easeInOut" }}
              className="px-8 pt-12 pb-4 w-full text-center"
            >
              {/* Icon */}
              <div
                style={{
                  width: 72, height: 72, borderRadius: 20, margin: "0 auto 16px",
                  background: `linear-gradient(135deg, ${current.accent}30, ${current.accent}10)`,
                  border: `1.5px solid ${current.accent}55`,
                  boxShadow: `0 0 28px ${current.accent}30`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 36,
                }}
              >
                {current.icon}
              </div>

              {/* Eyebrow */}
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: current.accent, marginBottom: 8 }}>
                {current.eyebrow}
              </p>

              {/* Title */}
              <h2 style={{ fontSize: "clamp(22px, 5vw, 28px)", fontWeight: 900, color: "#fff", letterSpacing: "-0.02em", marginBottom: 12, whiteSpace: "pre-line", lineHeight: 1.15 }}>
                {current.title}
              </h2>

              {/* Visual */}
              {renderVisual()}

              {/* Body */}
              <p style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.6, marginBottom: 0 }}>
                {current.body}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer: dots + buttons */}
        <div className="px-8 pb-8 pt-4 flex flex-col gap-4">
          {/* Progress dots */}
          <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
            {STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => { setDir(i > step ? 1 : -1); setStep(i); }}
                aria-label={`Go to step ${i + 1}`}
                style={{
                  width: i === step ? 20 : 6, height: 6,
                  borderRadius: 999,
                  background: i === step ? current.accent : "rgba(255,255,255,0.12)",
                  border: "none", cursor: "pointer", padding: 0,
                  transition: "width 0.25s ease, background 0.25s ease",
                }}
              />
            ))}
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 8 }}>
            {step > 0 && (
              <button
                onClick={back}
                style={{
                  flex: "0 0 auto", padding: "11px 16px", borderRadius: 12,
                  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
                  color: "#6B7280", fontSize: 13, fontWeight: 600, cursor: "pointer",
                  letterSpacing: "0.02em",
                }}
              >
                ← Back
              </button>
            )}

            {isLast ? (
              <Link
                href="/dashboard"
                onClick={finish}
                style={{
                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  padding: "12px 20px", borderRadius: 12,
                  background: "linear-gradient(135deg, #7C3AED, #5b21b6)",
                  border: "1px solid rgba(124,58,237,0.5)",
                  boxShadow: "0 4px 24px rgba(124,58,237,0.4)",
                  color: "#fff", fontSize: 13, fontWeight: 800,
                  letterSpacing: "0.06em", textTransform: "uppercase", textDecoration: "none",
                }}
              >
                Start Solving →
              </Link>
            ) : (
              <button
                onClick={next}
                style={{
                  flex: 1, padding: "12px 20px", borderRadius: 12,
                  background: `linear-gradient(135deg, ${current.accent}, ${current.accent}cc)`,
                  border: `1px solid ${current.accent}80`,
                  boxShadow: `0 4px 20px ${current.accent}35`,
                  color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer",
                  letterSpacing: "0.06em", textTransform: "uppercase",
                }}
              >
                Next →
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
