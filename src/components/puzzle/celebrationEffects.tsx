"use client";

// Shared celebration effects (fireworks canvas overlay + staged confetti bursts) used by
// any "big win" modal — extracted from PuzzleXpModal so SlotMachineModal can reuse the
// exact same visual language instead of duplicating ~200 lines of canvas/confetti code.

import { useEffect, useRef } from "react";
import confetti from "canvas-confetti";

export const COUNTER_DURATION = 1400; // ms

export type CompletionAnimation = "default" | "confetti" | "lightning" | "fireworks";

export function normalizeCompletionAnimation(value: string | undefined | null): CompletionAnimation {
  const key = String(value ?? "default").toLowerCase();
  if (key === "confetti" || key === "lightning" || key === "fireworks") return key;
  return "default";
}

interface FireworkRocket {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  trail: Array<{ x: number; y: number }>;
  explodeY: number;
}

interface FireworkSpark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  alpha: number;
  radius: number;
}

export function ModalFireworksOverlay() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const c = canvas;
    const g = ctx;
    let raf = 0;

    const rockets: FireworkRocket[] = [];
    const sparks: FireworkSpark[] = [];
    const palette = ["#FDE74C", "#FFB86B", "#FF6B6B", "#60CFFF", "#7DF9AA", "#C084FC", "#FFFFFF"];

    const resize = () => {
      c.width = c.offsetWidth;
      c.height = c.offsetHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const rand = (min: number, max: number) => min + Math.random() * (max - min);

    const spawnRocket = () => {
      const x = c.width * rand(0.1, 0.9);
      const explodeY = c.height * rand(0.12, 0.48);
      const vy = -((c.height - explodeY) / rand(42, 56));

      rockets.push({
        x,
        y: c.height + 4,
        vx: rand(-0.45, 0.45),
        vy,
        color: palette[Math.floor(Math.random() * palette.length)],
        trail: [],
        explodeY,
      });
    };

    const burst = (x: number, y: number) => {
      const c1 = palette[Math.floor(Math.random() * palette.length)];
      const c2 = palette[Math.floor(Math.random() * palette.length)];
      const count = prefersReducedMotion ? 48 : 90;

      for (let i = 0; i < count; i += 1) {
        const angle = (i / count) * Math.PI * 2 + Math.random() * 0.08;
        const speed = rand(1.7, 4.1);
        sparks.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color: Math.random() > 0.45 ? c1 : c2,
          alpha: 1,
          radius: rand(1.3, 2.8),
        });
      }

      // Add a bright center pop for readability.
      for (let i = 0; i < 18; i += 1) {
        const angle = Math.random() * Math.PI * 2;
        const speed = rand(2.2, 5.4);
        sparks.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color: "#FFFFFF",
          alpha: 1,
          radius: rand(1.2, 2.2),
        });
      }
    };

    spawnRocket();
    window.setTimeout(spawnRocket, 230);
    const interval = window.setInterval(spawnRocket, prefersReducedMotion ? 900 : 520);

    const tick = () => {
      raf = requestAnimationFrame(tick);

      g.clearRect(0, 0, c.width, c.height);

      // Rockets and trails.
      for (let i = rockets.length - 1; i >= 0; i -= 1) {
        const r = rockets[i];
        r.trail.unshift({ x: r.x, y: r.y });
        if (r.trail.length > 12) r.trail.length = 12;

        for (let t = 0; t < r.trail.length; t += 1) {
          const p = r.trail[t];
          const trailAlpha = (1 - t / r.trail.length) * 0.45;
          const trailRadius = (1 - t / r.trail.length) * 2;
          g.beginPath();
          g.arc(p.x, p.y, trailRadius, 0, Math.PI * 2);
          g.fillStyle = r.color;
          g.globalAlpha = trailAlpha;
          g.fill();
        }

        g.globalAlpha = 1;
        g.beginPath();
        g.arc(r.x, r.y, 2.4, 0, Math.PI * 2);
        g.fillStyle = "#FFFFFF";
        g.fill();

        r.x += r.vx;
        r.y += r.vy;

        if (r.y <= r.explodeY) {
          burst(r.x, r.y);
          rockets.splice(i, 1);
        }
      }

      // Exploded sparks.
      for (let i = sparks.length - 1; i >= 0; i -= 1) {
        const s = sparks[i];
        g.beginPath();
        g.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        g.fillStyle = s.color;
        g.globalAlpha = s.alpha;
        g.fill();

        s.x += s.vx;
        s.y += s.vy;
        s.vy += 0.055;
        s.vx *= 0.976;
        s.alpha -= prefersReducedMotion ? 0.025 : 0.016;
        s.radius *= 0.994;

        if (s.alpha <= 0) sparks.splice(i, 1);
      }

      g.globalAlpha = 1;
    };

    tick();

    return () => {
      cancelAnimationFrame(raf);
      clearInterval(interval);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 1, opacity: 0.82 }}
      aria-hidden="true"
    />
  );
}

export function runCompletionCelebration(animation: CompletionAnimation): () => void {
  if (animation === "default") return () => {};

  const timers: number[] = [];
  const queue = (delayMs: number, fn: () => void) => {
    timers.push(window.setTimeout(fn, delayMs));
  };
  const fire = (particleRatio: number, opts: confetti.Options) => {
    confetti({
      origin: { y: 0.55 },
      ...opts,
      particleCount: Math.max(1, Math.floor(200 * particleRatio)),
    });
  };

  if (animation === "confetti") {
    queue(300, () => {
      fire(0.25, { spread: 26, startVelocity: 55 });
      fire(0.2, { spread: 60 });
      fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
      fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
      fire(0.1, { spread: 120, startVelocity: 45 });
    });

    queue(800, () => {
      confetti({ particleCount: 80, angle: 60, spread: 55, origin: { x: 0, y: 0.6 } });
      confetti({ particleCount: 80, angle: 120, spread: 55, origin: { x: 1, y: 0.6 } });
    });

    queue(1600, () => {
      confetti({ particleCount: 40, spread: 70, origin: { y: 0.7 }, gravity: 0.6 });
    });
  }

  if (animation === "lightning") {
    const colors = ["#FFFFFF", "#DBEAFE", "#BFDBFE", "#A5B4FC"];
    queue(60, () => {
      fire(0.2, { spread: 22, startVelocity: 78, gravity: 1.25, scalar: 0.88, colors });
    });
    queue(260, () => {
      confetti({ particleCount: 60, angle: 70, spread: 40, origin: { x: 0.05, y: 0.48 }, gravity: 1.3, startVelocity: 62, colors });
      confetti({ particleCount: 60, angle: 110, spread: 40, origin: { x: 0.95, y: 0.48 }, gravity: 1.3, startVelocity: 62, colors });
    });
    queue(560, () => {
      fire(0.24, { spread: 30, startVelocity: 68, gravity: 1.2, scalar: 0.9, colors });
    });
  }

  return () => {
    for (const t of timers) window.clearTimeout(t);
  };
}
