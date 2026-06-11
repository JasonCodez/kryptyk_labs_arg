"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useRegisterModal } from "@/hooks/useRegisterModal";

/* ── Fireworks canvas ───────────────────────────────────────────────── */
function WelcomeFireworks() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const c = canvas as HTMLCanvasElement;
    const g = c.getContext("2d") as CanvasRenderingContext2D;

    const resize = () => { c.width = c.offsetWidth; c.height = c.offsetHeight; };
    resize();
    window.addEventListener("resize", resize);

    const palette = ["#3891A6", "#60a5fa", "#FDE74C", "#f59e0b", "#a855f7", "#ec4899", "#ffffff", "#fb7185", "#34d399"];

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
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}

/* ── Feature highlight item ─────────────────────────────────────────── */
const FEATURES = [
  { icon: "🧩", title: "Hundreds of Puzzles", desc: "Logic, cryptic, escape rooms, ARG mysteries — fresh challenges every day." },
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

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[200] overflow-y-auto"
          style={{ backgroundColor: "rgba(2,2,2,0.55)", backdropFilter: "blur(4px)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
        >
          {/* Fireworks backdrop */}
          <WelcomeFireworks />

          {/* Radial glow behind card */}
          <div
            className="absolute pointer-events-none"
            style={{
              width: 700,
              height: 700,
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(56,145,166,0.18) 0%, transparent 70%)",
              zIndex: 1,
            }}
          />

          {/* Scrollable inner — centres card vertically, adds breathing room top & bottom */}
          <div className="flex min-h-[100dvh] items-center justify-center px-4 py-8">

          {/* Card */}
          <motion.div
            className="relative w-full mx-4 rounded-3xl overflow-hidden flex flex-col items-center text-center"
            style={{
              maxWidth: 520,
              background: "linear-gradient(160deg, rgba(7,15,18,0.72) 0%, rgba(4,8,10,0.68) 60%, rgba(2,2,2,0.65) 100%)",
              border: "1px solid rgba(56,145,166,0.35)",
              zIndex: 2,
              boxShadow: "0 0 80px rgba(56,145,166,0.15), 0 32px 80px rgba(0,0,0,0.7)",
            }}
            initial={{ scale: 0.75, opacity: 0, y: 50 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: "spring", stiffness: 220, damping: 22, delay: 0.1 }}
          >
            {/* Animated top border glow */}
            <motion.div
              className="absolute top-0 left-0 right-0 h-[2px] rounded-t-3xl"
              style={{ background: "linear-gradient(90deg, transparent, #3891A6, #FDE74C, #3891A6, transparent)" }}
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
            />

            <div className="px-8 pt-10 pb-8 w-full">
              {/* Logo + badge */}
              <motion.div
                className="flex justify-center mb-5"
                initial={{ scale: 0, rotate: -15 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 280, damping: 16, delay: 0.2 }}
              >
                <div
                  className="w-24 h-24 rounded-2xl flex items-center justify-center overflow-hidden"
                  style={{
                    background: "linear-gradient(135deg, rgba(56,145,166,0.25) 0%, rgba(56,145,166,0.08) 100%)",
                    border: "1.5px solid rgba(56,145,166,0.4)",
                    boxShadow: "0 0 30px rgba(56,145,166,0.25)",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/images/puzzle_warz_logo.png" alt="PuzzleWarz" className="w-16 h-16 object-contain" />
                </div>
              </motion.div>

              {/* Headline */}
              <motion.p
                className="text-xs font-bold tracking-widest uppercase mb-3"
                style={{ color: "#3891A6" }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.35 }}
              >
                Welcome to PuzzleWarz
              </motion.p>

              <motion.h1
                className="text-3xl font-black text-white mb-3 leading-tight"
                style={{ letterSpacing: "-0.02em" }}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                Hey {userName}, <br />
                <span style={{ color: "#3891A6" }}>let the solving begin.</span>
              </motion.h1>

              <motion.p
                className="text-sm leading-relaxed mb-8"
                style={{ color: "#6B7280" }}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                You've joined a community of puzzle solvers competing, collaborating, and climbing the ranks. Here's what's waiting for you.
              </motion.p>

              {/* Feature grid */}
              <div className="grid grid-cols-2 gap-3 mb-8">
                {FEATURES.map((f, i) => (
                  <motion.div
                    key={f.title}
                    className="rounded-2xl text-left p-4"
                    style={{
                      background: "rgba(56,145,166,0.06)",
                      border: "1px solid rgba(56,145,166,0.15)",
                    }}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.55 + i * 0.08 }}
                  >
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-lg mb-2"
                      style={{ background: "rgba(56,145,166,0.12)", border: "1px solid rgba(56,145,166,0.2)" }}
                    >
                      {f.icon}
                    </div>
                    <p className="text-xs font-bold text-white mb-1">{f.title}</p>
                    <p className="text-xs leading-relaxed" style={{ color: "#6B7280" }}>{f.desc}</p>
                  </motion.div>
                ))}
              </div>

              {/* CTA */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9 }}
                className="flex flex-col gap-3"
              >
                <button
                  onClick={handleTakeTour}
                  className="w-full flex items-center justify-center gap-2 rounded-xl py-3 px-6 text-sm font-bold transition-all duration-200"
                  style={{
                    background: "linear-gradient(90deg, #3891A6 0%, #2d7a8e 100%)",
                    color: "#fff",
                    boxShadow: "0 4px 20px rgba(56,145,166,0.35)",
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
                  style={{ color: "#9ca3af", background: "none", border: "none", cursor: "pointer" }}
                >
                  Skip tour — go to dashboard
                </button>
              </motion.div>
            </div>

            {/* Bottom tip */}
            <motion.div
              className="w-full px-8 py-4 flex items-center gap-3"
              style={{ borderTop: "1px solid rgba(56,145,166,0.1)", background: "rgba(56,145,166,0.04)" }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.0 }}
            >
              <span style={{ color: "#3891A6", fontSize: "1rem" }}>💡</span>
              <p className="text-xs text-left" style={{ color: "#4B5563" }}>
                Check the <strong style={{ color: "#6B7280" }}>Season Pass</strong> to start earning exclusive rewards from day one.
              </p>
            </motion.div>
          </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
