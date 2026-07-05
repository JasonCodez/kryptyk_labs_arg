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
  color: string; // hot core color, faded toward emberColor as the spark cools
  emberColor: string;
  alpha: number;
  radius: number;
  trail: Array<{ x: number; y: number }>;
  flicker: number; // per-spark random phase so twinkle isn't synchronized
  crackled: boolean; // whether this spark has already spawned its secondary pop
  crackleAt: number; // life fraction (0-1 of decay) at which it crackles
}

interface FireworkFlash {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  color: string;
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
    const flashes: FireworkFlash[] = [];
    const palette = ["#FDE74C", "#FFB86B", "#FF6B6B", "#60CFFF", "#7DF9AA", "#C084FC", "#FFFFFF"];
    // What each hot spark color cools toward as it burns out — real firework sparks don't
    // just fade to transparent, they shift warmer (ember/smoke tones) before going dark.
    const emberPalette = ["#FF6B35", "#D6401C", "#8A2A0E", "#4A1B08"];

    const resize = () => {
      c.width = c.offsetWidth;
      c.height = c.offsetHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const rand = (min: number, max: number) => min + Math.random() * (max - min);
    const hexToRgb = (hex: string) => {
      const n = parseInt(hex.slice(1), 16);
      return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    };
    // Blends a spark's hot core color toward its cooler ember color as it burns out — plain
    // alpha fade alone reads as "dot disappearing", not a cooling ember.
    const mixColor = (hex1: string, hex2: string, t: number) => {
      const a = hexToRgb(hex1);
      const b = hexToRgb(hex2);
      const r = Math.round(a.r + (b.r - a.r) * t);
      const gc = Math.round(a.g + (b.g - a.g) * t);
      const bl = Math.round(a.b + (b.b - a.b) * t);
      return `rgb(${r},${gc},${bl})`;
    };
    // Scale burst geometry to the overlay's actual size so explosions read as "big" whether
    // the modal is a small phone screen or a large desktop viewport, instead of a fixed pixel
    // radius that looks huge on mobile and tiny on desktop. Capped well below the size ratio
    // itself — on a large desktop viewport this scale also multiplies particle *count*, and
    // an uncapped multiplier there is what caused overlapping bursts to pile up into
    // thousands of drawn particles per frame.
    const sizeScale = () => Math.max(0.6, Math.min(1.2, Math.min(c.width, c.height) / 480));
    // Hard ceiling on simultaneous sparks — several bursts can be alive at once (each one
    // takes ~1-2s to fully decay), so without a cap the total drawn-per-frame count keeps
    // climbing for as long as rockets keep spawning. Trimming the oldest sparks keeps the
    // frame cost bounded regardless of how many bursts overlap.
    const MAX_SPARKS = 220;
    const capSparks = () => {
      if (sparks.length > MAX_SPARKS) sparks.splice(0, sparks.length - MAX_SPARKS);
    };

    const spawnRocket = () => {
      const x = c.width * rand(0.08, 0.92);
      const explodeY = c.height * rand(0.1, 0.46);
      const vy = -((c.height - explodeY) / rand(38, 50));

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
      const scale = sizeScale();
      const c1 = palette[Math.floor(Math.random() * palette.length)];
      const c2 = palette[Math.floor(Math.random() * palette.length)];
      const count = Math.round((prefersReducedMotion ? 26 : 55) * (prefersReducedMotion ? 1 : scale));

      flashes.push({
        x, y,
        radius: 4,
        maxRadius: (prefersReducedMotion ? 34 : 62) * scale,
        alpha: 0.9,
        color: "#FFFFFF",
      });

      for (let i = 0; i < count; i += 1) {
        const angle = (i / count) * Math.PI * 2 + Math.random() * 0.1;
        const speed = rand(2.2, 6.2) * scale;
        sparks.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color: Math.random() > 0.45 ? c1 : c2,
          emberColor: emberPalette[Math.floor(Math.random() * emberPalette.length)],
          alpha: 1,
          radius: rand(1.5, 3.2) * Math.max(0.85, scale * 0.75),
          trail: [],
          flicker: Math.random() * Math.PI * 2,
          crackled: false,
          crackleAt: Math.random() < 0.1 ? rand(0.4, 0.7) : -1,
        });
      }

      // Bright center pop for readability + a handful of long, fast "streamer" sparks that
      // fly further than the rest — real shell bursts aren't a perfectly even sphere.
      for (let i = 0; i < Math.round(10 * scale); i += 1) {
        const angle = Math.random() * Math.PI * 2;
        const speed = rand(3, 8) * scale;
        sparks.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color: "#FFFFFF",
          emberColor: emberPalette[Math.floor(Math.random() * emberPalette.length)],
          alpha: 1,
          radius: rand(1.3, 2.4) * Math.max(0.85, scale * 0.75),
          trail: [],
          flicker: Math.random() * Math.PI * 2,
          crackled: false,
          crackleAt: -1,
        });
      }

      capSparks();
    };

    // Small secondary pops spawned mid-flight off a fraction of sparks — the "crackle"
    // effect seen in real willow/crackle shells, rather than every spark decaying alone.
    const crackle = (x: number, y: number, color: string) => {
      const n = 3;
      for (let i = 0; i < n; i += 1) {
        const angle = Math.random() * Math.PI * 2;
        const speed = rand(0.6, 1.8);
        sparks.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color: "#FFFFFF",
          emberColor: color,
          alpha: 0.9,
          radius: rand(0.8, 1.4),
          trail: [],
          flicker: Math.random() * Math.PI * 2,
          crackled: true,
          crackleAt: -1,
        });
      }

      capSparks();
    };

    spawnRocket();
    window.setTimeout(spawnRocket, 300);
    const interval = window.setInterval(spawnRocket, prefersReducedMotion ? 1100 : 750);

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

      // Bloom flashes at the core of each new burst — brief and bright, giving the
      // explosion a sense of scale/impact beyond just the spread of sparks.
      for (let i = flashes.length - 1; i >= 0; i -= 1) {
        const f = flashes[i];
        const grad = g.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.radius);
        grad.addColorStop(0, f.color);
        grad.addColorStop(1, "rgba(255,255,255,0)");
        g.beginPath();
        g.arc(f.x, f.y, f.radius, 0, Math.PI * 2);
        g.fillStyle = grad;
        g.globalAlpha = f.alpha;
        g.fill();

        f.radius += (f.maxRadius - f.radius) * 0.35;
        f.alpha -= 0.09;
        if (f.alpha <= 0) flashes.splice(i, 1);
      }
      g.globalAlpha = 1;

      // Exploded sparks — each cools from its hot core color toward an ember tone, leaves a
      // short streak trail like a real spark rather than a plain moving dot, and flickers
      // slightly so the burst reads as burning rather than uniformly fading.
      const nowMs = performance.now();
      for (let i = sparks.length - 1; i >= 0; i -= 1) {
        const s = sparks[i];
        const life = 1 - s.alpha; // 0 = just born, ~1 = about to die
        const drawColor = mixColor(s.color, s.emberColor, Math.min(1, life * 1.15));

        s.trail.unshift({ x: s.x, y: s.y });
        if (s.trail.length > (prefersReducedMotion ? 2 : 3)) s.trail.length = prefersReducedMotion ? 2 : 3;
        for (let t = 0; t < s.trail.length; t += 1) {
          const p = s.trail[t];
          const trailAlpha = s.alpha * (1 - t / s.trail.length) * 0.35;
          const trailRadius = s.radius * (1 - t / s.trail.length) * 0.8;
          if (trailRadius <= 0) continue;
          g.beginPath();
          g.arc(p.x, p.y, trailRadius, 0, Math.PI * 2);
          g.fillStyle = drawColor;
          g.globalAlpha = trailAlpha;
          g.fill();
        }

        const twinkle = prefersReducedMotion ? 1 : 0.78 + 0.22 * Math.sin(nowMs * 0.02 + s.flicker);
        g.beginPath();
        g.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        g.fillStyle = drawColor;
        g.globalAlpha = s.alpha * twinkle;
        g.fill();

        s.x += s.vx;
        s.y += s.vy;
        s.vy += 0.05;
        s.vx *= 0.982;
        s.alpha -= prefersReducedMotion ? 0.022 : 0.013;
        s.radius *= 0.992;

        if (!s.crackled && s.crackleAt > 0 && life >= s.crackleAt) {
          s.crackled = true;
          crackle(s.x, s.y, s.emberColor);
        }

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
