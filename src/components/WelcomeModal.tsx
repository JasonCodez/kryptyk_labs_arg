"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useRegisterModal } from "@/hooks/useRegisterModal";
import { prefersReducedMotion } from "@/lib/juice/prefs";

/* ── Fireworks canvas ───────────────────────────────────────────────── */

// Canvas can't resolve CSS variables directly, so the palette is read from the
// canonical custom properties at mount, with static fallbacks that mirror the
// token values in globals.css (documented duplication — keep in sync there).
const FIREWORK_TOKEN_FALLBACKS: [token: string, fallback: string][] = [
  ["--pw-brand-primary", "#03ACF4"],
  ["--pw-brand-primary-light", "#5BC9FF"],
  ["--pw-brand-secondary", "#FED007"],
  ["--pw-brand-accent", "#F97102"],
  ["--pw-success", "#3BC46A"],
  ["--pw-error", "#E5484D"],
];

function readFireworkPalette(): string[] {
  const styles = typeof window !== "undefined"
    ? getComputedStyle(document.documentElement)
    : null;
  const colors = FIREWORK_TOKEN_FALLBACKS.map(([token, fallback]) => {
    const value = styles?.getPropertyValue(token).trim();
    return value || fallback;
  });
  // White spark highlights round out the set (see burst()'s 30% white mix).
  colors.push("#ffffff");
  return colors;
}

function WelcomeFireworks() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const c = canvas as HTMLCanvasElement;
    const context = c.getContext("2d");
    if (!context) return; // jsdom / very old browsers — no fireworks, modal still works
    const g: CanvasRenderingContext2D = context;

    const resize = () => { c.width = c.offsetWidth; c.height = c.offsetHeight; };
    resize();
    window.addEventListener("resize", resize);

    const palette = readFireworkPalette();

    type Spark = { x: number; y: number; vx: number; vy: number; alpha: number; color: string; r: number };
    type Rocket = { x: number; y: number; vy: number; color: string; trail: { x: number; y: number }[]; burst: boolean };

    const sparks: Spark[] = [];
    const rockets: Rocket[] = [];

    function burst(x: number, y: number, color: string) {
      for (let i = 0; i < 55; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1.5 + Math.random() * 4;
        sparks.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          alpha: 1,
          color: Math.random() < 0.3 ? "#ffffff" : color,
          r: 1.5 + Math.random() * 2.5,
        });
      }
    }

    function spawnRocket() {
      rockets.push({
        x: c.width * (0.15 + Math.random() * 0.7),
        y: c.height,
        vy: -(6 + Math.random() * 5),
        color: palette[Math.floor(Math.random() * palette.length)],
        trail: [],
        burst: false,
      });
    }

    let frame = 0;
    let running = true;

    function loop() {
      if (!running) return;
      requestAnimationFrame(loop);
      g.clearRect(0, 0, c.width, c.height);

      frame++;
      if (frame % 28 === 0) spawnRocket();

      for (let i = rockets.length - 1; i >= 0; i--) {
        const r = rockets[i];
        r.trail.push({ x: r.x, y: r.y });
        if (r.trail.length > 12) r.trail.shift();
        r.y += r.vy;
        r.vy += 0.08;

        r.trail.forEach((p, ti) => {
          g.beginPath();
          g.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
          g.fillStyle = r.color;
          g.globalAlpha = (ti / r.trail.length) * 0.5;
          g.fill();
        });
        g.globalAlpha = 1;
        g.beginPath();
        g.arc(r.x, r.y, 2.5, 0, Math.PI * 2);
        g.fillStyle = "#fff";
        g.fill();

        if (!r.burst && r.vy >= -1) {
          r.burst = true;
          burst(r.x, r.y, r.color);
          rockets.splice(i, 1);
        }
      }

      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.x += s.vx;
        s.y += s.vy;
        s.vy += 0.12;
        s.vx *= 0.97;
        s.alpha -= 0.018;
        if (s.alpha <= 0) { sparks.splice(i, 1); continue; }
        g.beginPath();
        g.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        g.fillStyle = s.color;
        g.globalAlpha = s.alpha;
        g.fill();
      }
      g.globalAlpha = 1;
    }

    loop();
    return () => { running = false; window.removeEventListener("resize", resize); };
  }, []);

  return (
    <canvas
      ref={ref}
      data-testid="welcome-fireworks"
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}

/* ── Feature highlight item ─────────────────────────────────────────── */
const FEATURES = [
  { icon: "🧩", title: "Hundreds of Puzzles", desc: "Logic, cryptic, word games, and code — fresh challenges every day." },
  { icon: "⚔️", title: "Warz Mode",           desc: "Challenge rivals head-to-head. Wager your points and see who cracks it first." },
  { icon: "👥", title: "Team Up",             desc: "Create or join a team, tackle co-op puzzles, and climb the team leaderboard." },
  { icon: "🏆", title: "Earn & Rise",         desc: "Collect XP, unlock season rewards, and climb the global rankings." },
];

/* ── Main component ─────────────────────────────────────────────────── */
interface WelcomeModalProps {
  userName: string;
  userId: string;
  onTakeTour?: () => void;
}

export default function WelcomeModal({ userName, userId, onTakeTour }: WelcomeModalProps) {
  const [visible, setVisible] = useState(false);
  useRegisterModal('welcome-modal', visible);
  // OS media query (framer hook) + the app's data-reduce-animations toggle —
  // the codebase-standard pairing. Gates entrance springs, the border pulse,
  // and the fireworks loop; the modal stays fully usable without them.
  const reduceMotion = Boolean(useReducedMotion() || prefersReducedMotion());

  useEffect(() => {
    const key = `pw_welcomed_${userId}`;
    if (!localStorage.getItem(key)) {
      // Short delay so the dashboard can render first
      const t = setTimeout(() => setVisible(true), 600);
      return () => clearTimeout(t);
    }
  }, [userId]);

  function dismiss() {
    localStorage.setItem(`pw_welcomed_${userId}`, "1");
    setVisible(false);
  }

  function handleTakeTour() {
    dismiss();
    onTakeTour?.();
  }

  // With reduced motion, elements render in place: no initial offsets, no
  // springs, no stagger. `initial={false}` keeps AnimatePresence exit instant.
  const fade = (delay: number, y = 0) => reduceMotion
    ? { initial: false as const }
    : { initial: { opacity: 0, y }, animate: { opacity: 1, y: 0 }, transition: { delay } };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[200] overflow-y-auto"
          style={{ backgroundColor: "color-mix(in srgb, var(--pw-bg-base) 60%, transparent)", backdropFilter: "blur(4px)" }}
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.4 }}
        >
          {/* Fireworks backdrop — an animation loop, so it never starts under reduced motion */}
          {!reduceMotion && <WelcomeFireworks />}

          {/* Radial glow behind card */}
          <div
            className="absolute pointer-events-none"
            style={{
              width: 700,
              height: 700,
              borderRadius: "50%",
              background: "radial-gradient(circle, color-mix(in srgb, var(--pw-brand-primary) 16%, transparent) 0%, transparent 70%)",
              zIndex: 1,
            }}
          />

          {/* Scrollable inner — centers card vertically, adds breathing room top & bottom */}
          <div className="flex min-h-[100dvh] items-center justify-center px-4 py-8">

          {/* Card */}
          <motion.div
            className="relative w-full mx-4 rounded-3xl overflow-hidden flex flex-col items-center text-center"
            style={{
              maxWidth: 520,
              background: "linear-gradient(160deg, color-mix(in srgb, var(--pw-surface-2) 88%, transparent) 0%, color-mix(in srgb, var(--pw-bg-elevated) 86%, transparent) 60%, color-mix(in srgb, var(--pw-bg-base) 85%, transparent) 100%)",
              border: "1px solid color-mix(in srgb, var(--pw-brand-primary) 35%, transparent)",
              zIndex: 2,
              boxShadow: "0 0 80px color-mix(in srgb, var(--pw-brand-primary) 15%, transparent), 0 32px 80px rgba(0,0,0,0.7)",
            }}
            initial={reduceMotion ? false : { scale: 0.75, opacity: 0, y: 50 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { scale: 0.9, opacity: 0, y: 20 }}
            transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 220, damping: 22, delay: 0.1 }}
          >
            {/* Top border — brand blue into trophy gold; pulses only when motion is allowed */}
            <motion.div
              className="absolute top-0 left-0 right-0 h-[2px] rounded-t-3xl"
              style={{ background: "linear-gradient(90deg, transparent, var(--pw-brand-primary), var(--pw-brand-secondary), var(--pw-brand-primary), transparent)" }}
              animate={reduceMotion ? { opacity: 0.85 } : { opacity: [0.5, 1, 0.5] }}
              transition={reduceMotion ? { duration: 0 } : { duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
            />

            <div className="px-8 pt-10 pb-8 w-full">
              {/* Logo + badge */}
              <motion.div
                className="flex justify-center mb-5"
                initial={reduceMotion ? false : { scale: 0, rotate: -15 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 280, damping: 16, delay: 0.2 }}
              >
                <div
                  className="w-24 h-24 rounded-2xl flex items-center justify-center overflow-hidden"
                  style={{
                    background: "linear-gradient(135deg, color-mix(in srgb, var(--pw-brand-primary) 25%, transparent) 0%, color-mix(in srgb, var(--pw-brand-primary) 8%, transparent) 100%)",
                    border: "1.5px solid color-mix(in srgb, var(--pw-brand-primary) 40%, transparent)",
                    boxShadow: "0 0 30px color-mix(in srgb, var(--pw-brand-primary) 25%, transparent)",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/images/puzzle_warz_logo.png" alt="PuzzleWarz" className="w-16 h-16 object-contain" />
                </div>
              </motion.div>

              {/* Headline */}
              <motion.p
                className="text-xs font-bold tracking-widest uppercase mb-3"
                style={{ color: "var(--pw-brand-primary)" }}
                {...fade(0.35)}
              >
                Welcome to PuzzleWarz
              </motion.p>

              <motion.h1
                className="text-3xl font-black mb-3 leading-tight"
                style={{ letterSpacing: "-0.02em", color: "var(--pw-text-primary)" }}
                {...fade(0.4, 12)}
              >
                Hey {userName}, <br />
                <span style={{ color: "var(--pw-brand-primary)" }}>let the solving begin.</span>
              </motion.h1>

              <motion.p
                className="text-sm leading-relaxed mb-8"
                style={{ color: "var(--pw-text-secondary)" }}
                {...fade(0.5, 8)}
              >
                You&apos;ve joined a community of puzzle solvers competing, collaborating, and climbing the ranks. Here&apos;s what&apos;s waiting for you.
              </motion.p>

              {/* Feature grid — neutral tiles, single brand accent on the icon chip */}
              <div className="grid grid-cols-2 gap-3 mb-8">
                {FEATURES.map((f, i) => (
                  <motion.div
                    key={f.title}
                    className="rounded-2xl text-left p-4"
                    style={{
                      background: "color-mix(in srgb, var(--pw-surface-2) 55%, transparent)",
                      border: "1px solid var(--pw-border-subtle)",
                    }}
                    {...fade(0.55 + i * 0.08, 16)}
                  >
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-lg mb-2"
                      style={{ background: "color-mix(in srgb, var(--pw-brand-primary) 12%, transparent)", border: "1px solid color-mix(in srgb, var(--pw-brand-primary) 20%, transparent)" }}
                    >
                      {f.icon}
                    </div>
                    <p className="text-xs font-bold mb-1" style={{ color: "var(--pw-text-primary)" }}>{f.title}</p>
                    <p className="text-xs leading-relaxed" style={{ color: "var(--pw-text-secondary)" }}>{f.desc}</p>
                  </motion.div>
                ))}
              </div>

              {/* CTA */}
              <motion.div
                {...fade(0.9, 10)}
                className="flex flex-col gap-3"
              >
                <button
                  onClick={handleTakeTour}
                  className="w-full flex items-center justify-center gap-2 rounded-xl py-3 px-6 text-sm font-bold transition-all duration-200 hover:brightness-110"
                  style={{
                    background: "linear-gradient(90deg, var(--pw-brand-primary-light) 0%, var(--pw-action-primary) 100%)",
                    color: "var(--pw-text-on-primary)",
                    boxShadow: "0 4px 20px color-mix(in srgb, var(--pw-brand-primary) 35%, transparent)",
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  Take the Tour 🗺️
                </button>
                <button
                  onClick={dismiss}
                  className="text-xs transition-opacity duration-150 hover:opacity-100"
                  style={{ color: "var(--pw-text-secondary)", background: "none", border: "none", cursor: "pointer" }}
                >
                  Skip tour — go to dashboard
                </button>
              </motion.div>
            </div>

            {/* Bottom tip — gold = reward emphasis */}
            <motion.div
              className="w-full px-8 py-4 flex items-center gap-3"
              style={{ borderTop: "1px solid var(--pw-border-subtle)", background: "color-mix(in srgb, var(--pw-brand-secondary) 4%, transparent)" }}
              {...fade(1.0)}
            >
              <span style={{ color: "var(--pw-brand-secondary)", fontSize: "1rem" }}>💡</span>
              <p className="text-xs text-left" style={{ color: "var(--pw-text-secondary)" }}>
                Check the <strong style={{ color: "var(--pw-brand-secondary)" }}>Season Pass</strong> to start earning exclusive rewards from day one.
              </p>
            </motion.div>
          </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
