"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "@/components/Navbar";

// ── Types ─────────────────────────────────────────────────────────────────────

type Stage =
  | "loading"
  | "witness-intro"
  | "witness-reading"
  | "witness-questions"
  | "witness-results";

interface ScenarioData {
  id: string;
  caseNumber: string;
  classification: string;
  dateTime: string;
  report: string;
  questions: { question: string; options: string[] }[];
}

interface Stats {
  totalPlays: number;
  scoreDist: number[];
}

interface SubmitResult {
  score: number;
  breakdown: { correct: boolean; correctIndex: number }[];
  scoreDist: number[];
  totalPlays: number;
  percentile: number;
  rewards?: {
    points: number;
    xp: number;
    granted: boolean;
  };
}

// ── Timers ───────────────────────────────────────────────────────────────────

const READ_SECONDS = 35;
const QUESTION_SECONDS = 18;

// ── Helpers ───────────────────────────────────────────────────────────────────

function scoreLabel(score: number): string {
  if (score === 5) return "Perfect recall. You didn't miss a thing.";
  if (score === 4) return "Sharp. One detail escaped you.";
  if (score === 3) return "Solid. Most people stop at three.";
  if (score === 2) return "The report had more than you caught.";
  if (score === 1) return "You're going to need more practice.";
  return "You weren't paying attention. Were you?";
}

function percentileLabel(p: number, score: number): string {
  if (score === 5) return "You outperformed every player who has sat this test.";
  if (p >= 90) return `You beat ${p}% of all players. That's rare.`;
  if (p >= 70) return `You beat ${p}% of players.`;
  if (p >= 50) return `You beat ${p}% of players. Above average.`;
  if (p >= 25) return `You beat ${p}% of players. Room to grow.`;
  return `${p}% of players scored lower. The rest got more right.`;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const BG      = "#080810";
const SURFACE = "rgba(255,255,255,0.035)";
const BORDER  = "rgba(255,255,255,0.08)";
const PURPLE  = "#7C3AED";
const PURPLE_LIGHT = "#a78bfa";
const GOLD    = "#FDE74C";
const TEAL    = "#3891A6";
const DANGER  = "#EF4444";
const SUCCESS = "#38D399";
const MUTED   = "#6B7280";
const TEXT    = "#E5E7EB";
const DOC_BG  = "#0d0d14";

const cardStyle: React.CSSProperties = {
  backgroundColor: SURFACE,
  border: `1px solid ${BORDER}`,
  borderRadius: 12,
  padding: "28px",
};

// ── Sub-components ────────────────────────────────────────────────────────────

function Badge({ children, color = PURPLE_LIGHT }: { children: React.ReactNode; color?: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 12px",
        borderRadius: 999,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.14em",
        textTransform: "uppercase" as const,
        color,
        backgroundColor: `${color}18`,
        border: `1px solid ${color}35`,
      }}
    >
      {children}
    </span>
  );
}

function TimerBar({ secondsLeft, total }: { secondsLeft: number; total: number }) {
  const pct = (secondsLeft / total) * 100;
  const color = secondsLeft <= 8 ? DANGER : secondsLeft <= 15 ? GOLD : TEAL;
  return (
    <div style={{ marginBottom: 24 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 700, color: MUTED, letterSpacing: "0.1em", textTransform: "uppercase" }}>
          Memorize the report
        </span>
        <span
          style={{
            fontSize: 22,
            fontWeight: 900,
            color,
            minWidth: 36,
            textAlign: "right",
            transition: "color 0.3s",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {secondsLeft}
        </span>
      </div>
      <div
        style={{
          height: 4,
          borderRadius: 999,
          backgroundColor: "rgba(255,255,255,0.06)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            backgroundColor: color,
            borderRadius: 999,
            transition: "width 1s linear, background-color 0.3s",
          }}
        />
      </div>
    </div>
  );
}

function OptionButton({
  label,
  index,
  state,
  onClick,
  disabled,
}: {
  label: string;
  index: number;
  state: "idle" | "correct" | "wrong" | "reveal";
  onClick: () => void;
  disabled: boolean;
}) {
  const LABELS = ["A", "B", "C", "D"];
  const bg =
    state === "correct"
      ? `${SUCCESS}22`
      : state === "wrong"
      ? `${DANGER}22`
      : state === "reveal"
      ? `${GOLD}18`
      : "rgba(255,255,255,0.03)";
  const border =
    state === "correct"
      ? `${SUCCESS}70`
      : state === "wrong"
      ? `${DANGER}70`
      : state === "reveal"
      ? `${GOLD}55`
      : "rgba(255,255,255,0.08)";
  const color =
    state === "correct" ? SUCCESS : state === "wrong" ? DANGER : state === "reveal" ? GOLD : TEXT;
  const labelBg =
    state === "correct"
      ? `${SUCCESS}35`
      : state === "wrong"
      ? `${DANGER}35`
      : state === "reveal"
      ? `${GOLD}25`
      : "rgba(255,255,255,0.07)";
  const labelColor =
    state === "correct" ? SUCCESS : state === "wrong" ? DANGER : state === "reveal" ? GOLD : MUTED;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "100%",
        textAlign: "left",
        padding: "13px 16px",
        borderRadius: 9,
        border: `1px solid ${border}`,
        backgroundColor: bg,
        color,
        fontSize: 14,
        fontWeight: 500,
        cursor: disabled ? "default" : "pointer",
        transition: "background-color 0.2s, border-color 0.2s, color 0.2s, transform 0.15s",
        transform: state === "correct" ? "scale(1.01)" : "scale(1)",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <span style={{
        flexShrink: 0,
        width: 26,
        height: 26,
        borderRadius: 6,
        backgroundColor: labelBg,
        color: labelColor,
        fontSize: 12,
        fontWeight: 700,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        letterSpacing: "0.04em",
        transition: "background-color 0.2s, color 0.2s",
      }}>
        {state === "correct" ? "✓" : state === "wrong" ? "✗" : state === "reveal" ? "→" : LABELS[index] ?? "○"}
      </span>
      {label}
    </button>
  );
}

// ── Comparison modal ──────────────────────────────────────────────────────────

function WitnessComparisonModal({
  open,
  onClose,
  submitResult,
  scenario,
}: {
  open: boolean;
  onClose: () => void;
  submitResult: SubmitResult;
  scenario: ScenarioData;
}) {
  const [barVisible, setBarVisible] = useState(false);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => setBarVisible(true), 350);
      return () => clearTimeout(t);
    } else {
      setBarVisible(false);
    }
  }, [open]);

  if (!open) return null;

  const { score } = submitResult;

  const scoreDist = submitResult.scoreDist ?? [0, 0, 0, 0, 0, 0];
  const totalPlays = submitResult.totalPlays;
  const beatCount = scoreDist.slice(0, score).reduce((s, c) => s + c, 0);
  const percentile = totalPlays > 1
    ? Math.round((beatCount / (totalPlays - 1)) * 100)
    : 100;

  const scoreColor = score >= 4 ? SUCCESS : score >= 2 ? GOLD : DANGER;
  const scoreEmoji = score === 5 ? "🏆" : score >= 4 ? "🔥" : score >= 3 ? "👁️" : score >= 1 ? "📋" : "❌";
  const maxCount = Math.max(...scoreDist, 1);

  const shareText = encodeURIComponent(
    `🔍 The Debrief — PuzzleWarz\n\nI recalled ${score}/5 details from today's incident report.\nI beat ${percentile}% of all investigators.\n\nCan you do better?\nhttps://puzzlewarz.com/witness`
  );
  const shareUrl = encodeURIComponent("https://puzzlewarz.com/witness");
  const twitterUrl = `https://x.com/intent/tweet?text=${shareText}`;
  const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        backgroundColor: "rgba(2,2,2,0.88)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "16px",
        backdropFilter: "blur(4px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 480,
          backgroundColor: "#06080e",
          border: "1px solid rgba(0,212,255,0.25)",
          borderRadius: 20,
          padding: "36px 32px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Corner bracket decorations */}
        <div style={{ position: "absolute", top: 12, left: 12, width: 18, height: 18, borderTop: "2px solid rgba(0,212,255,0.45)", borderLeft: "2px solid rgba(0,212,255,0.45)" }} />
        <div style={{ position: "absolute", top: 12, right: 12, width: 18, height: 18, borderTop: "2px solid rgba(0,212,255,0.45)", borderRight: "2px solid rgba(0,212,255,0.45)" }} />
        <div style={{ position: "absolute", bottom: 12, left: 12, width: 18, height: 18, borderBottom: "2px solid rgba(0,212,255,0.45)", borderLeft: "2px solid rgba(0,212,255,0.45)" }} />
        <div style={{ position: "absolute", bottom: 12, right: 12, width: 18, height: 18, borderBottom: "2px solid rgba(0,212,255,0.45)", borderRight: "2px solid rgba(0,212,255,0.45)" }} />

        {/* Ambient glow */}
        <div style={{
          position: "absolute", top: -80, right: -80, width: 260, height: 260,
          background: `radial-gradient(circle, ${scoreColor}0a 0%, transparent 70%)`,
          pointerEvents: "none",
        }} />

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{
            display: "inline-block", marginBottom: 20,
            fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase",
            color: "rgba(0,212,255,0.7)", padding: "4px 12px", borderRadius: 4,
            border: "1px solid rgba(0,212,255,0.28)",
          }}>
            Case #{scenario.caseNumber} — Filed
          </div>

          {/* Score circle */}
          <div style={{
            width: 116, height: 116, borderRadius: "50%", margin: "0 auto 16px",
            background: `radial-gradient(circle, ${scoreColor}14 0%, transparent 70%)`,
            border: `3px solid ${scoreColor}`,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            boxShadow: `0 0 40px ${scoreColor}28`,
          }}>
            <div style={{ fontSize: 34, fontWeight: 900, color: scoreColor, lineHeight: 1 }}>{score}/5</div>
            <div style={{ fontSize: 20, marginTop: 2 }}>{scoreEmoji}</div>
          </div>

          <p style={{ color: TEXT, fontSize: 16, fontWeight: 700, marginBottom: 6 }}>
            {scoreLabel(score)}
          </p>
          {totalPlays > 1 && (
            <p style={{ color: MUTED, fontSize: 13 }}>
              {percentileLabel(percentile, score)}
            </p>
          )}
        </div>

        {/* Comparison section */}
        {totalPlays > 1 && (
          <div style={{
            backgroundColor: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 12, padding: "20px", marginBottom: 20,
          }}>
            <p style={{
              fontSize: 11, fontWeight: 700, letterSpacing: "0.12em",
              textTransform: "uppercase", color: MUTED, marginBottom: 14,
            }}>
              How You Compare
            </p>

            {/* Percentile bar */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: `${MUTED}80` }}>Bottom</span>
                <span style={{ fontSize: 13, color: scoreColor, fontWeight: 800 }}>
                  Top {100 - percentile}%
                </span>
                <span style={{ fontSize: 11, color: `${MUTED}80` }}>Top</span>
              </div>
              <div style={{ position: "relative", height: 14, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.06)" }}>
                <div style={{
                  height: "100%",
                  width: barVisible ? `${percentile}%` : "0%",
                  borderRadius: 999,
                  background: `linear-gradient(90deg, rgba(0,212,255,0.25), ${scoreColor})`,
                  transition: "width 1.3s cubic-bezier(0.4,0,0.2,1)",
                }} />
                <div style={{
                  position: "absolute", top: "50%",
                  left: barVisible ? `${percentile}%` : "0%",
                  transform: "translate(-50%, -50%)",
                  width: 22, height: 22, borderRadius: "50%",
                  backgroundColor: scoreColor,
                  border: "3px solid #06080e",
                  boxShadow: `0 0 12px ${scoreColor}`,
                  transition: "left 1.3s cubic-bezier(0.4,0,0.2,1)",
                  zIndex: 1,
                }} />
              </div>
              <div style={{ textAlign: "center", marginTop: 10 }}>
                <span style={{ fontSize: 26, fontWeight: 900, color: scoreColor }}>{percentile}%</span>
                <span style={{ fontSize: 13, color: MUTED }}> of players scored lower</span>
              </div>
            </div>

            {/* Score distribution mini chart */}
            <div style={{ display: "flex", gap: 5, alignItems: "flex-end", height: 44 }}>
              {[0, 1, 2, 3, 4, 5].map((s) => {
                const count = scoreDist[s] || 0;
                const pct = (count / maxCount) * 100;
                return (
                  <div key={s} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                    <div style={{
                      width: "100%",
                      height: `${Math.max(pct, 6)}%`,
                      borderRadius: "3px 3px 0 0",
                      backgroundColor: s === score ? scoreColor : "rgba(255,255,255,0.09)",
                      boxShadow: s === score ? `0 0 8px ${scoreColor}55` : "none",
                    }} />
                    <span style={{
                      fontSize: 9, fontWeight: s === score ? 800 : 400,
                      color: s === score ? scoreColor : `${MUTED}60`,
                    }}>{s}</span>
                  </div>
                );
              })}
            </div>
            <p style={{ fontSize: 11, color: `${MUTED}55`, textAlign: "center", marginTop: 8 }}>
              {totalPlays.toLocaleString()} investigators · score distribution
            </p>
          </div>
        )}

        {/* Share buttons */}
        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          <a
            href={facebookUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              padding: "11px 14px", borderRadius: 10, textDecoration: "none",
              backgroundColor: "rgba(24,119,242,0.1)",
              border: "1px solid rgba(24,119,242,0.38)",
              color: "#5B9FFF", fontWeight: 700, fontSize: 13,
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="#5B9FFF">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
            Facebook
          </a>
          <a
            href={twitterUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              padding: "11px 14px", borderRadius: 10, textDecoration: "none",
              backgroundColor: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.14)",
              color: "#fff", fontWeight: 700, fontSize: 13,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            Post to X
          </a>
        </div>

        <button
          onClick={onClose}
          style={{
            width: "100%", padding: "12px", borderRadius: 10,
            backgroundColor: "transparent", border: `1px solid ${BORDER}`,
            color: MUTED, fontWeight: 600, fontSize: 14, cursor: "pointer",
          }}
        >
          See full breakdown →
        </button>
      </div>
    </div>
  );
}

// ── Document fire canvas ──────────────────────────────────────────────────────

function DocumentFireCanvas({ active }: { active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const safeCtx = ctx;

    const W = canvas.offsetWidth  || 600;
    const H = canvas.offsetHeight || 400;
    canvas.width  = W;
    canvas.height = H;

    type P = { x: number; y: number; vx: number; vy: number; radius: number; life: number; decay: number; wobble: number; };
    const particles: P[] = [];
    const start = performance.now();

    function tick(now: number) {
      const elapsed = (now - start) / 1000;
      safeCtx.clearRect(0, 0, W, H);

      // ── Char layer: dark ash that rises from the bottom up ──────────────────
      const charFrac = Math.min(elapsed / 2.8, 1.0);
      const charH    = H * charFrac * charFrac * 0.95;
      if (charH > 0) {
        const g = safeCtx.createLinearGradient(0, H, 0, H - charH);
        g.addColorStop(0.00, "rgba(3,1,0,0.96)");
        g.addColorStop(0.50, "rgba(8,2,0,0.80)");
        g.addColorStop(0.85, "rgba(20,4,0,0.42)");
        g.addColorStop(1.00, "rgba(0,0,0,0)");
        safeCtx.globalCompositeOperation = "source-over";
        safeCtx.fillStyle = g;
        safeCtx.fillRect(0, H - charH, W, charH);
      }

      // ── Spawn particles — front rises from bottom to top over ~2.2s ─────────
      const spreadFrac = Math.min(elapsed / 2.2, 1.0);
      const frontY = H * (1.0 - spreadFrac * spreadFrac * 0.96);
      const count  = elapsed < 0.15 ? 1 : elapsed < 0.6 ? 4 : 7;
      for (let i = 0; i < count; i++) {
        const spawnY = frontY + (H - frontY) * Math.random() * 0.4;
        particles.push({
          x:      Math.random() * W,
          y:      spawnY,
          vx:     (Math.random() - 0.5) * 0.9,
          vy:     -(0.9 + Math.random() * 2.0),
          radius: 14 + Math.random() * 26,
          life:   0,
          decay:  0.007 + Math.random() * 0.009,
          wobble: Math.random() * Math.PI * 2,
        });
      }

      // ── Fire particles — additive blending so overlaps become intensely bright
      safeCtx.globalCompositeOperation = "lighter";
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life += p.decay;
        if (p.life >= 1) { particles.splice(i, 1); continue; }
        p.x  += p.vx + Math.sin(now * 0.0022 + p.wobble) * 0.45;
        p.y  += p.vy;
        p.vy *= 0.987;
        const r = p.radius * (1 - p.life * 0.55);

        // Color: white-yellow core → orange → red → transparent
        let rc: number, gc: number, bc: number, a: number;
        if (p.life < 0.18) {
          const t = p.life / 0.18;
          rc = 255; gc = 245; bc = Math.round(200 - t * 80); a = t * 0.85;
        } else if (p.life < 0.42) {
          const t = (p.life - 0.18) / 0.24;
          rc = 255; gc = Math.round(245 - t * 100); bc = Math.round(120 - t * 120); a = 0.85;
        } else if (p.life < 0.68) {
          const t = (p.life - 0.42) / 0.26;
          rc = 255; gc = Math.round(145 - t * 125); bc = 0; a = 0.85 - t * 0.25;
        } else {
          const t = (p.life - 0.68) / 0.32;
          rc = Math.round(255 - t * 110); gc = 20; bc = 0; a = 0.6 - t * 0.6;
        }

        const grd = safeCtx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
        grd.addColorStop(0,    `rgba(${rc},${gc},${bc},${a.toFixed(3)})`);
        grd.addColorStop(0.45, `rgba(${rc},${gc},${bc},${(a * 0.55).toFixed(3)})`);
        grd.addColorStop(1,    "rgba(0,0,0,0)");
        safeCtx.fillStyle = grd;
        safeCtx.beginPath();
        safeCtx.arc(p.x, p.y, r, 0, Math.PI * 2);
        safeCtx.fill();
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [active]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        borderRadius: "inherit",
        pointerEvents: "none",
        zIndex: 3,
      }}
    />
  );
}

// ── How To Play modal ────────────────────────────────────────────────────────

function WitnessHowToPlayModal({ onClose }: { onClose: () => void }) {
  const steps = [
    { icon: "📄", title: "Read the report", body: `You have ${READ_SECONDS} seconds to memorize a classified incident report. Read every detail carefully — it self-destructs once time is up.` },
    { icon: "🧠", title: "Answer recall questions", body: `Five multiple-choice questions test your memory of the report. You have ${QUESTION_SECONDS} seconds per question and cannot go back — trust your instincts.` },
    { icon: "📊", title: "See how you compare", body: "Your recall score and accuracy rating are revealed at the end alongside your percentile ranking. The sharper your memory, the higher you place." },
  ];

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 300,
        backgroundColor: "rgba(2,2,10,0.88)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "16px",
        backdropFilter: "blur(4px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 480,
          backgroundColor: "#06080e",
          border: "1px solid rgba(124,58,237,0.35)",
          borderRadius: 20,
          padding: "32px 28px",
          position: "relative",
        }}
      >
        {/* Corner brackets */}
        {[["top",0,"left",0],["top",0,"right",0],["bottom",0,"left",0],["bottom",0,"right",0]].map(([v,_,h], i) => (
          <div key={i} style={{
            position: "absolute", [v as string]: 12, [h as string]: 12,
            width: 16, height: 16,
            borderTop: v === "top" ? "2px solid rgba(124,58,237,0.5)" : undefined,
            borderBottom: v === "bottom" ? "2px solid rgba(124,58,237,0.5)" : undefined,
            borderLeft: h === "left" ? "2px solid rgba(124,58,237,0.5)" : undefined,
            borderRight: h === "right" ? "2px solid rgba(124,58,237,0.5)" : undefined,
          }} />
        ))}

        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase",
            color: PURPLE_LIGHT, marginBottom: 8,
          }}>
            How to play
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, color: "#fff", letterSpacing: "-0.02em" }}>
            The Debrief
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
          {steps.map((s, i) => (
            <div key={i} style={{
              display: "flex", gap: 14, alignItems: "flex-start",
              backgroundColor: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 12, padding: "14px 16px",
            }}>
              <span style={{ fontSize: 22, flexShrink: 0, marginTop: 1 }}>{s.icon}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 4 }}>{s.title}</div>
                <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.6 }}>{s.body}</div>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={onClose}
          style={{
            width: "100%", padding: "12px",
            borderRadius: 10, border: "none",
            backgroundColor: PURPLE, color: "#fff",
            fontWeight: 700, fontSize: 14, cursor: "pointer",
            letterSpacing: "0.04em",
          }}
        >
          Got it — let's go
        </button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function WitnessPage() {
  const { status } = useSession();
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("loading");
  const [scenario, setScenario] = useState<ScenarioData | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);

  // Witness reading
  const [secondsLeft, setSecondsLeft] = useState(READ_SECONDS);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Witness questions
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [optionState, setOptionState] = useState<("idle" | "correct" | "wrong" | "reveal")[]>([]);
  const [answerLocked, setAnswerLocked] = useState(false);
  const [questionSecondsLeft, setQuestionSecondsLeft] = useState(QUESTION_SECONDS);
  const questionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [tabWarning, setTabWarning] = useState(false);
  // "reading" = started reading but hasn't finished answering yet; the reading window has
  // closed so re-showing the report text is blocked (answer from memory instead). Full
  // completion is no longer tracked here — that's server-authoritative, see the load effect.
  const [alreadyRead, setAlreadyRead] = useState<"reading" | null>(null);

  // Refs so handleTimeout can read latest state without stale closure
  const answersRef = useRef<number[]>([]);
  const currentQRef = useRef(0);
  const answerLockedRef = useRef(false);
  answersRef.current = answers;
  currentQRef.current = currentQ;
  answerLockedRef.current = answerLocked;

  // Witness results
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);
  const [compareModalOpen, setCompareModalOpen] = useState(false);

  // Shared animation helper
  const [visible, setVisible] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const fadeIn = useCallback(() => {
    setVisible(false);
    setTimeout(() => setVisible(true), 60);
  }, []);

  // ── Auth guard ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/auth/signin');
  }, [status, router]);

  // ── Load today's data ──────────────────────────────────────────────────────

  useEffect(() => {
    fetch("/api/debrief/today")
      .then((r) => r.json())
      .then((data) => {
        setScenario(data.scenario);
        setStats(data.stats);
        if (data.completed && data.result) {
          // Already completed today's debrief (server-authoritative) — show the persisted
          // results directly instead of allowing another read-through/answer flow.
          setSubmitResult(data.result);
          setStage("witness-results");
          setVisible(true);
          return;
        }
        // sessionStorage gate — prevent re-reading the report within the same browser session
        // after the reading window closed but before questions were answered.
        const gate = sessionStorage.getItem(`witness_${data.scenario.id}`);
        if (gate === "reading") setAlreadyRead("reading");
        setStage("witness-intro");
        setVisible(true);
      })
      .catch(() => setStage("witness-intro")); // fail open
  }, []);

  // ── Reading timer ──────────────────────────────────────────────────────────

  const startTimer = useCallback(() => {
    setSecondsLeft(READ_SECONDS);
    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(timerRef.current!);
          // auto-advance after the full fire animation completes (~4s)
          setTimeout(() => {
            setStage("witness-questions");
            setCurrentQ(0);
            setOptionState(Array(4).fill("idle"));
            fadeIn();
          }, 5000);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }, [fadeIn]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // ── Question timeout ───────────────────────────────────────────────────────

  /** Called when the 18-second question timer runs out. Reads state via refs
   *  to avoid stale-closure problems inside setInterval callbacks. */
  const handleTimeout = useCallback(() => {
    if (answerLockedRef.current || !scenario) return;
    if (questionTimerRef.current) clearInterval(questionTimerRef.current);
    setAnswerLocked(true);
    // Record -1 = timed out (always graded wrong server-side)
    const newAnswers = [...answersRef.current, -1];
    setAnswers(newAnswers);

    if (currentQRef.current < scenario.questions.length - 1) {
      setTimeout(() => {
        setCurrentQ((q) => q + 1);
        setSelectedOption(null);
        setAnswerLocked(false);
        setOptionState(Array(4).fill("idle"));
        fadeIn();
      }, 500);
    } else {
      fetch("/api/debrief/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarioId: scenario.id, answers: newAnswers }),
      })
        .then((r) => r.json())
        .then((data: SubmitResult) => {
          sessionStorage.setItem(`witness_${scenario.id}`, "complete");
          setSubmitResult(data);
          setStage("witness-results");
          setCompareModalOpen(true);
          fadeIn();
        });
    }
  }, [scenario, fadeIn]); // reads answers/currentQ/answerLocked via refs

  // ── Per-question countdown (resets on each new question) ──────────────────

  useEffect(() => {
    if (stage !== "witness-questions") return;
    setQuestionSecondsLeft(QUESTION_SECONDS);
    if (questionTimerRef.current) clearInterval(questionTimerRef.current);

    questionTimerRef.current = setInterval(() => {
      setQuestionSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(questionTimerRef.current!);
          // Small defer so we don't call state-setters inside a state updater
          setTimeout(() => handleTimeout(), 50);
          return 0;
        }
        return s - 1;
      });
    }, 1000);

    return () => {
      if (questionTimerRef.current) clearInterval(questionTimerRef.current);
    };
  }, [currentQ, stage, handleTimeout]);

  // ── Tab-switch detection during questions ─────────────────────────────────

  useEffect(() => {
    if (stage !== "witness-questions") {
      setTabWarning(false);
      return;
    }
    const onVisibility = () =>
      setTabWarning(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [stage]);

  // ── Witness question handlers ──────────────────────────────────────────────

  const handleOptionClick = useCallback(
    (optionIdx: number) => {
      if (answerLocked || !scenario) return;
      // Stop the question countdown the moment they click
      if (questionTimerRef.current) clearInterval(questionTimerRef.current);
      setSelectedOption(optionIdx);
      setAnswerLocked(true);

      // Immediately show selection as pending — real answer revealed after submit
      const newStates = scenario.questions[currentQ].options.map(
        (_, i): "idle" | "correct" | "wrong" | "reveal" => {
          if (i === optionIdx) return "reveal"; // "locked in" state
          return "idle";
        }
      );
      setOptionState(newStates);

      setTimeout(() => {
        // advance to next question or submit
        const newAnswers = [...answers, optionIdx];
        setAnswers(newAnswers);

        if (currentQ < (scenario.questions.length - 1)) {
          setCurrentQ((q) => q + 1);
          setSelectedOption(null);
          setAnswerLocked(false);
          setOptionState(Array(4).fill("idle"));
          fadeIn();
        } else {
          // All answered — submit
          setStage("witness-questions"); // keep UI but disable
          fetch("/api/debrief/submit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ scenarioId: scenario.id, answers: newAnswers }),
          })
            .then((r) => r.json())
            .then((data: SubmitResult) => {
              sessionStorage.setItem(`witness_${scenario.id}`, "complete");
              setSubmitResult(data);
              setStage("witness-results");
              setCompareModalOpen(true);
              fadeIn();
            });
        }
      }, 600);
    },
    [answerLocked, answers, currentQ, scenario, fadeIn]
  );

  // ── Transitions ────────────────────────────────────────────────────────────

  const goReading = useCallback(() => {
    if (scenario) sessionStorage.setItem(`witness_${scenario.id}`, "reading");
    setStage("witness-reading");
    fadeIn();
    setTimeout(startTimer, 400);
  }, [fadeIn, startTimer, scenario]);

  // ── Share ──────────────────────────────────────────────────────────────────

  const shareWitness = useCallback(() => {
    if (!submitResult) return;
    const text = `🔍 PuzzleWarz — The Debrief\n\nI recalled ${submitResult.score}/5 critical details.\nI beat ${submitResult.percentile}% of players.\n\nCan you do better?\nhttps://puzzlewarz.com/witness`;
    navigator.clipboard.writeText(text).catch(() => {});
  }, [submitResult]);

  // ── Render ─────────────────────────────────────────────────────────────────

  const fadeStyle: React.CSSProperties = {
    opacity: visible ? 1 : 0,
    transform: visible ? "translateY(0)" : "translateY(20px)",
    transition: "opacity 0.5s ease, transform 0.5s ease",
  };

  if (stage === "loading") {
    return (
      <>
        <Navbar />
        <main style={{ backgroundColor: BG, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ color: MUTED, fontSize: 14, letterSpacing: "0.1em" }}>DECRYPTING…</div>
        </main>
      </>
    );
  }

  return (
    <>
      {showHelp && <WitnessHowToPlayModal onClose={() => setShowHelp(false)} />}
      <style>{`
        @keyframes scan-line {
          0%   { transform: translateY(-100%); }
          100% { transform: translateY(400%); }
        }
        @keyframes flicker {
          0%, 19%, 21%, 23%, 25%, 54%, 56%, 100% { opacity: 1; }
          20%, 24%, 55% { opacity: 0.4; }
        }
        @keyframes stamp-in {
          0%   { transform: scale(2.5) rotate(-15deg); opacity: 0; }
          60%  { transform: scale(0.95) rotate(3deg); opacity: 1; }
          100% { transform: scale(1) rotate(-2deg); opacity: 1; }
        }
        @keyframes pulse-border {
          0%, 100% { box-shadow: 0 0 0 0 rgba(124,58,237,0.4); }
          50%       { box-shadow: 0 0 0 8px rgba(124,58,237,0); }
        }
        @keyframes word-appear {
          from { opacity: 0; transform: scale(0.8) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;700&family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { font-family: 'Inter', system-ui, sans-serif; }
      `}</style>

      <Navbar />

      <main
        style={{
          backgroundColor: BG,
          minHeight: "100vh",
          paddingTop: 80,
          paddingBottom: 80,
        }}
      >
        <div style={{ maxWidth: 680, margin: "0 auto", padding: "0 16px" }}>

          {/* ── WITNESS INTRO ─────────────────────────────────────────── */}
          {stage === "witness-intro" && (
            <div style={fadeStyle}>
              {/* Hero */}
              <div style={{ textAlign: "center", marginBottom: 40 }}>
                <Badge color={PURPLE_LIGHT}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: PURPLE_LIGHT }} />
                  Clearance Test
                </Badge>

                {/* Dossier icon */}
                <div style={{ margin: "28px auto 0", width: 72, height: 72, position: "relative" }}>
                  <svg viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: 72, height: 72 }}>
                    <rect x="8" y="12" width="46" height="54" rx="3" fill="#1a1a2e" stroke="rgba(124,58,237,0.45)" strokeWidth="1.5"/>
                    <rect x="14" y="14" width="46" height="54" rx="3" fill="#141422" stroke="rgba(124,58,237,0.25)" strokeWidth="1"/>
                    <rect x="20" y="28" width="28" height="2" rx="1" fill="rgba(239,68,68,0.7)"/>
                    <rect x="20" y="34" width="22" height="1.5" rx="0.75" fill="rgba(255,255,255,0.18)"/>
                    <rect x="20" y="38" width="25" height="1.5" rx="0.75" fill="rgba(255,255,255,0.18)"/>
                    <rect x="20" y="42" width="18" height="1.5" rx="0.75" fill="rgba(255,255,255,0.18)"/>
                    <rect x="20" y="20" width="12" height="5" rx="1" fill="rgba(239,68,68,0.15)" stroke="rgba(239,68,68,0.5)" strokeWidth="0.75"/>
                    <text x="21" y="24.5" fontSize="4" fill="rgba(239,68,68,0.9)" fontFamily="monospace" fontWeight="700">CLASSF</text>
                  </svg>
                </div>

                <h1
                  style={{
                    fontSize: "clamp(40px, 6vw, 62px)",
                    fontWeight: 900,
                    color: "#fff",
                    letterSpacing: "-0.035em",
                    marginTop: 20,
                    marginBottom: 14,
                    lineHeight: 1.0,
                  }}
                >
                  The Debrief
                </h1>
                <p style={{ color: MUTED, fontSize: 15, lineHeight: 1.75, maxWidth: 400, margin: "0 auto 0" }}>
                  You have <strong style={{ color: TEXT }}>{READ_SECONDS} seconds</strong> to read a classified incident report.
                  It disappears. Then five questions follow.
                </p>
              </div>

              {/* Dossier preview card */}
              <div
                style={{
                  backgroundColor: DOC_BG,
                  border: `1px solid rgba(124,58,237,0.22)`,
                  borderRadius: 12,
                  overflow: "hidden",
                  marginBottom: 28,
                  boxShadow: "0 0 60px rgba(124,58,237,0.06), 0 20px 40px rgba(0,0,0,0.5)",
                }}
              >
                {/* Classification bar */}
                <div style={{
                  background: `linear-gradient(90deg, ${DANGER}dd, ${DANGER}99)`,
                  padding: "6px 20px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, fontWeight: 700, letterSpacing: "0.22em", color: "#fff" }}>
                    {scenario ? scenario.classification : "CLASSIFIED"}
                  </span>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: "rgba(255,255,255,0.65)", letterSpacing: "0.1em" }}>
                    EYES ONLY
                  </span>
                </div>

                {/* Body */}
                <div style={{ padding: "24px 28px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
                    <div>
                      {scenario && (
                        <>
                          <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: MUTED, marginBottom: 4, letterSpacing: "0.05em" }}>
                            INCIDENT REPORT
                          </p>
                          <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 18, fontWeight: 700, color: TEXT, letterSpacing: "0.02em", marginBottom: 2 }}>
                            #{scenario.caseNumber}
                          </p>
                          <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: `${MUTED}99`, letterSpacing: "0.03em" }}>
                            {scenario.dateTime}
                          </p>
                        </>
                      )}
                    </div>
                    {/* Redacted stamp */}
                    <div style={{
                      padding: "8px 14px",
                      border: `2px solid ${DANGER}55`,
                      borderRadius: 4,
                      transform: "rotate(6deg)",
                    }}>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, fontWeight: 700, color: `${DANGER}90`, letterSpacing: "0.15em" }}>SEALED</span>
                    </div>
                  </div>

                  {/* Redacted preview lines */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {["78%", "100%", "88%", "60%", "92%"].map((w, i) => (
                      <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <div style={{ width: w, height: 10, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.06)" }} />
                      </div>
                    ))}
                    <div style={{ display: "flex", gap: 6 }}>
                      {["30%", "25%", "35%"].map((w, i) => (
                        <div key={i} style={{ width: w, height: 10, borderRadius: 2, backgroundColor: `${DANGER}18` }} />
                      ))}
                    </div>
                    {["85%", "70%"].map((w, i) => (
                      <div key={i} style={{ width: w, height: 10, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.06)" }} />
                    ))}
                  </div>

                  {stats && stats.totalPlays > 0 && (
                    <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: `${MUTED}70`, marginTop: 20, letterSpacing: "0.04em" }}>
                      {stats.totalPlays.toLocaleString()} investigators cleared
                    </p>
                  )}
                </div>

                {/* Bottom classification bar */}
                <div style={{
                  background: `linear-gradient(90deg, ${DANGER}dd, ${DANGER}99)`,
                  padding: "5px 20px",
                  textAlign: "center",
                }}>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, fontWeight: 700, letterSpacing: "0.22em", color: "rgba(255,255,255,0.85)" }}>
                    {scenario ? scenario.classification : "CLASSIFIED"} — AUTHORIZED ACCESS ONLY
                  </span>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {alreadyRead ? (
                  <div style={{ textAlign: "center" }}>
                    <div
                      style={{
                        padding: "16px 20px",
                        borderRadius: 10,
                        border: `1px solid ${DANGER}35`,
                        backgroundColor: `${DANGER}0a`,
                        marginBottom: 12,
                      }}
                    >
                      <p style={{ color: DANGER, fontWeight: 700, fontSize: 13, marginBottom: 4, letterSpacing: "0.04em" }}>
                        Document Destroyed
                      </p>
                      <p style={{ color: MUTED, fontSize: 13, lineHeight: 1.5 }}>
                        You already opened this report. The reading window has closed — answer from memory.
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setCurrentQ(0);
                        setOptionState(Array(4).fill("idle"));
                        setStage("witness-questions");
                        fadeIn();
                      }}
                      style={{
                        width: "100%",
                        padding: "15px",
                        borderRadius: 10,
                        fontWeight: 700,
                        fontSize: 15,
                        color: "#fff",
                        backgroundColor: PURPLE,
                        border: "none",
                        cursor: "pointer",
                        letterSpacing: "0.02em",
                      }}
                    >
                      Answer from memory →
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={goReading}
                    style={{
                      width: "100%",
                      padding: "17px",
                      borderRadius: 10,
                      fontWeight: 800,
                      fontSize: 16,
                      color: "#fff",
                      backgroundColor: PURPLE,
                      border: "none",
                      cursor: "pointer",
                      boxShadow: `0 0 40px ${PURPLE}50`,
                      letterSpacing: "0.03em",
                    }}
                  >
                    Open the File →
                  </button>
                )}
                <div style={{ textAlign: "center", marginTop: 4 }}>
                  <button onClick={() => setShowHelp(true)} style={{ background: "rgba(253,231,76,0.08)", border: "1px solid rgba(253,231,76,0.3)", color: "#FDE74C", fontSize: "12px", fontWeight: 700, padding: "6px 14px", borderRadius: "8px", cursor: "pointer", letterSpacing: "0.04em" }}>? How to play</button>
                </div>
              </div>
            </div>
          )}

          {/* ── WITNESS READING ───────────────────────────────────────── */}
          {stage === "witness-reading" && scenario && (
            <div style={fadeStyle}>
              <TimerBar secondsLeft={secondsLeft} total={READ_SECONDS} />

              <div
                style={{
                  backgroundColor: DOC_BG,
                  border: `1px solid ${secondsLeft <= 8 ? DANGER + "55" : "rgba(255,255,255,0.1)"}`,
                  borderRadius: 12,
                  overflow: "hidden",
                  position: "relative",
                  boxShadow: secondsLeft <= 8
                    ? `0 0 40px ${DANGER}22`
                    : "0 20px 50px rgba(0,0,0,0.6)",
                  transition: "border-color 0.5s, box-shadow 0.5s",
                }}
              >
                {/* Classification bar */}
                <div style={{
                  background: `linear-gradient(90deg, ${DANGER}dd, ${DANGER}aa)`,
                  padding: "7px 22px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.8)", animation: secondsLeft > 0 ? "flicker 3s infinite" : "none" }} />
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, fontWeight: 700, letterSpacing: "0.22em", color: "#fff" }}>
                      {scenario.classification}
                    </span>
                  </div>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: "rgba(255,255,255,0.7)", letterSpacing: "0.12em" }}>
                    INCIDENT REPORT #{scenario.caseNumber}
                  </span>
                </div>

                {/* scan line animation */}
                {secondsLeft > 0 && (
                  <div
                    aria-hidden
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: "12%",
                      background: "linear-gradient(to bottom, transparent, rgba(56,145,166,0.05), transparent)",
                      animation: "scan-line 3.5s ease-in-out infinite",
                      pointerEvents: "none",
                      zIndex: 1,
                    }}
                  />
                )}

                {/* Document body */}
                <div style={{ padding: "28px 30px 24px" }}>
                  {/* Header row */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, paddingBottom: 18, borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                    <div>
                      <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: MUTED, letterSpacing: "0.1em", marginBottom: 4 }}>DATE / TIME</p>
                      <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: TEXT, letterSpacing: "0.03em" }}>{scenario.dateTime}</p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: MUTED, letterSpacing: "0.1em", marginBottom: 4 }}>CASE REF</p>
                      <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: TEXT, letterSpacing: "0.03em" }}>#{scenario.caseNumber}</p>
                    </div>
                  </div>

                  {/* Report text */}
                  <div
                    style={{
                      color: "rgba(220,220,230,0.92)",
                      fontSize: 14,
                      lineHeight: 1.95,
                      whiteSpace: "pre-line",
                      fontFamily: "'IBM Plex Mono', monospace",
                      letterSpacing: "0.015em",
                      opacity: secondsLeft === 0 ? 0 : 1,
                      transition: "opacity 1.8s ease 1.0s",
                      userSelect: "none",
                      WebkitUserSelect: "none",
                    }}
                  >
                    {scenario.report.replace(/ /g, " \u200B")}
                  </div>
                </div>

                {/* Bottom classification bar */}
                <div style={{
                  background: `linear-gradient(90deg, ${DANGER}dd, ${DANGER}aa)`,
                  padding: "5px 22px",
                  textAlign: "center",
                }}>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, fontWeight: 700, letterSpacing: "0.22em", color: "rgba(255,255,255,0.8)" }}>
                    {scenario.classification} — AUTHORIZED ACCESS ONLY
                  </span>
                </div>

                <AnimatePresence>
                  {secondsLeft === 0 && (
                    <motion.div
                      key="burn-overlay"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.15 }}
                      style={{
                        position: "absolute",
                        inset: 0,
                        borderRadius: 12,
                        overflow: "hidden",
                        zIndex: 5,
                        pointerEvents: "none",
                      }}
                    >
                      <DocumentFireCanvas active />

                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.6, delay: 3.3 }}
                        style={{
                          position: "absolute",
                          inset: 0,
                          zIndex: 10,
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          background: "radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0.55) 0%, transparent 70%)",
                        }}
                      >
                        <p style={{
                          color: "#fff",
                          fontWeight: 800,
                          fontSize: 16,
                          letterSpacing: "0.22em",
                          fontFamily: "'IBM Plex Mono', monospace",
                          textTransform: "uppercase",
                          margin: 0,
                          textShadow: "0 0 28px rgba(251,146,60,0.55), 0 0 55px rgba(239,68,68,0.2)",
                        }}>
                          DOCUMENT DESTROYED
                        </p>
                        <p style={{
                          color: "rgba(255,255,255,0.35)",
                          fontFamily: "'IBM Plex Mono', monospace",
                          fontSize: 10,
                          letterSpacing: "0.14em",
                          margin: "14px 0 0",
                          textTransform: "uppercase",
                        }}>
                          ANSWER FROM MEMORY
                        </p>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {secondsLeft > 5 && (
                <button
                  onClick={() => {
                    if (timerRef.current) clearInterval(timerRef.current);
                    setSecondsLeft(0);
                    setTimeout(() => {
                      setStage("witness-questions");
                      setCurrentQ(0);
                      setOptionState(Array(4).fill("idle"));
                      fadeIn();
                    }, 5000);
                  }}
                  style={{
                    marginTop: 14,
                    width: "100%",
                    padding: "12px",
                    borderRadius: 10,
                    color: MUTED,
                    backgroundColor: "transparent",
                    border: `1px solid ${BORDER}`,
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  I&apos;m ready — start questions
                </button>
              )}
            </div>
          )}

          {/* ── WITNESS QUESTIONS ─────────────────────────────────────── */}
          {stage === "witness-questions" && scenario && (
            <div style={fadeStyle}>
              {/* Tab-switch warning overlay — timer keeps running while hidden */}
              {tabWarning && (
                <div
                  style={{
                    position: "fixed",
                    inset: 0,
                    zIndex: 100,
                    backgroundColor: "rgba(2,2,2,0.94)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 12,
                  }}
                >
                  <div style={{ fontSize: 48 }}>⚠️</div>
                  <p style={{ color: DANGER, fontWeight: 800, fontSize: 18, letterSpacing: "0.05em" }}>
                    TAB SWITCH DETECTED
                  </p>
                  <p style={{ color: MUTED, fontSize: 14 }}>Your timer is still running. Return to this tab.</p>
                </div>
              )}

              <div style={{ marginBottom: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: MUTED, letterSpacing: "0.05em" }}>
                    Question {currentQ + 1} <span style={{ color: `${MUTED}60` }}>/ {scenario.questions.length}</span>
                  </span>
                  <div style={{ display: "flex", gap: 5 }}>
                    {scenario.questions.map((_, qi) => (
                      <div key={qi} style={{
                        width: 28, height: 4, borderRadius: 2,
                        backgroundColor: qi < currentQ ? PURPLE : qi === currentQ ? PURPLE_LIGHT : "rgba(255,255,255,0.08)",
                        transition: "background-color 0.3s",
                      }} />
                    ))}
                  </div>
                </div>
              </div>

              {/* Per-question countdown */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: MUTED, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                    Time remaining
                  </span>
                  <span
                    style={{
                      fontSize: 20,
                      fontWeight: 900,
                      fontVariantNumeric: "tabular-nums",
                      color: questionSecondsLeft <= 5 ? DANGER : questionSecondsLeft <= 10 ? GOLD : MUTED,
                      transition: "color 0.3s",
                    }}
                  >
                    {questionSecondsLeft}s
                  </span>
                </div>
                <div style={{ height: 3, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.06)" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${(questionSecondsLeft / QUESTION_SECONDS) * 100}%`,
                      backgroundColor: questionSecondsLeft <= 5 ? DANGER : questionSecondsLeft <= 10 ? GOLD : PURPLE,
                      borderRadius: 999,
                      transition: "width 1s linear, background-color 0.3s",
                    }}
                  />
                </div>
              </div>

              <div style={{ ...cardStyle, marginBottom: 18, backgroundColor: "rgba(255,255,255,0.025)" }}>
                <p style={{ color: TEXT, fontSize: 17, fontWeight: 600, lineHeight: 1.55, marginBottom: 22 }}>
                  {scenario.questions[currentQ].question}
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                  {scenario.questions[currentQ].options.map((opt, i) => (
                    <OptionButton
                      key={i}
                      label={opt}
                      index={i}
                      state={optionState[i] || "idle"}
                      onClick={() => handleOptionClick(i)}
                      disabled={answerLocked}
                    />
                  ))}
                </div>
              </div>

              <p style={{ textAlign: "center", color: `${MUTED}55`, fontSize: 11, letterSpacing: "0.06em", fontFamily: "'IBM Plex Mono', monospace", textTransform: "uppercase" }}>
                The report is gone. Trust your memory.
              </p>
            </div>
          )}

          {/* ── WITNESS RESULTS ───────────────────────────────────────── */}
          {stage === "witness-results" && submitResult && scenario && (
            <div style={fadeStyle}>
              {(() => {
                const scoreDist = submitResult.scoreDist ?? [0, 0, 0, 0, 0, 0];
                const totalPlays = submitResult.totalPlays;
                const beatCount = scoreDist.slice(0, submitResult.score).reduce((s, c) => s + c, 0);
                const percentile = totalPlays > 1 ? Math.round((beatCount / (totalPlays - 1)) * 100) : 100;
                const st = encodeURIComponent(`🔍 The Debrief — PuzzleWarz\n\nI recalled ${submitResult.score}/5 details.\nI beat ${percentile}% of all investigators.\n\nhttps://puzzlewarz.com/witness`);
                const su = encodeURIComponent("https://puzzlewarz.com/witness");
                return (
                  <>
              <div style={{ textAlign: "center", marginBottom: 36 }}>
                <div style={{ display: "inline-flex", alignItems: "baseline", gap: 4, marginBottom: 10 }}>
                  <span style={{
                    fontSize: 88,
                    fontWeight: 900,
                    color: submitResult.score >= 4 ? SUCCESS : submitResult.score >= 2 ? GOLD : DANGER,
                    lineHeight: 1,
                    letterSpacing: "-0.04em",
                  }}>
                    {submitResult.score}
                  </span>
                  <span style={{ fontSize: 32, fontWeight: 700, color: `${MUTED}80`, letterSpacing: "-0.02em" }}>/5</span>
                </div>
                <p style={{ color: TEXT, fontSize: 19, fontWeight: 700, marginBottom: 6, letterSpacing: "-0.01em" }}>
                  {scoreLabel(submitResult.score)}
                </p>
                <p style={{ color: MUTED, fontSize: 13 }}>
                  {percentileLabel(percentile, submitResult.score)}
                </p>
              </div>

              {submitResult.rewards && (
                <div
                  style={{
                    ...cardStyle,
                    marginBottom: 20,
                    border: `1px solid ${submitResult.rewards.granted ? `${SUCCESS}55` : `${GOLD}55`}`,
                    backgroundColor: submitResult.rewards.granted ? `${SUCCESS}10` : `${GOLD}0E`,
                  }}
                >
                  <p
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      color: submitResult.rewards.granted ? SUCCESS : GOLD,
                      marginBottom: 12,
                    }}
                  >
                    {submitResult.rewards.granted ? "Rewards Earned" : "Rewards Already Claimed"}
                  </p>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
                    <span
                      style={{
                        padding: "8px 12px",
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#FFD700",
                        backgroundColor: "rgba(255,215,0,0.12)",
                        border: "1px solid rgba(255,215,0,0.35)",
                      }}
                    >
                      +{submitResult.rewards.points} points
                    </span>
                    <span
                      style={{
                        padding: "8px 12px",
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#A78BFA",
                        backgroundColor: "rgba(167,139,250,0.12)",
                        border: "1px solid rgba(167,139,250,0.35)",
                      }}
                    >
                      +{submitResult.rewards.xp} XP
                    </span>
                  </div>
                  <p style={{ color: MUTED, fontSize: 12, margin: 0 }}>
                    {submitResult.rewards.granted
                      ? "Based on your correct answers in this Witness run."
                      : "This scenario's reward was already granted for your account."}
                  </p>
                </div>
              )}

              {/* Answer breakdown */}
              <div style={{ ...cardStyle, marginBottom: 20 }}>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: MUTED, marginBottom: 16 }}>
                  Breakdown
                </p>
                {submitResult.breakdown.length < scenario.questions.length ? (
                  // Result recorded before per-question detail was tracked (legacy completion) —
                  // only the aggregate score survived, so there's nothing to break down here.
                  <p style={{ color: MUTED, fontSize: 13, lineHeight: 1.5 }}>
                    Per-question detail isn&apos;t available for this result — only your final score was recorded.
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {scenario.questions.map((q, i) => {
                      const res = submitResult.breakdown[i];
                      return (
                        <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                          <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>
                            {res.correct ? "✅" : "❌"}
                          </span>
                          <div>
                            <p style={{ color: TEXT, fontSize: 13, fontWeight: 500, lineHeight: 1.4 }}>{q.question}</p>
                            {!res.correct && (
                              <p style={{ color: GOLD, fontSize: 12, marginTop: 3 }}>
                                Correct: {q.options[res.correctIndex]}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Score distribution */}
              <div style={{ ...cardStyle, marginBottom: 28 }}>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: MUTED, marginBottom: 16 }}>
                  Score distribution — {totalPlays.toLocaleString()} players
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {[5, 4, 3, 2, 1, 0].map((s) => {
                    const count = scoreDist[s] || 0;
                    const pct = Math.round((count / totalPlays) * 100);
                    return (
                      <div key={s} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ width: 14, fontSize: 12, color: s === submitResult.score ? GOLD : MUTED, fontWeight: s === submitResult.score ? 700 : 400 }}>
                          {s}
                        </span>
                        <div style={{ flex: 1, height: 8, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.05)", overflow: "hidden" }}>
                          <div
                            style={{
                              height: "100%",
                              width: `${pct}%`,
                              borderRadius: 999,
                              backgroundColor: s === submitResult.score ? GOLD : "rgba(255,255,255,0.12)",
                              transition: "width 0.8s ease",
                            }}
                          />
                        </div>
                        <span style={{ width: 32, fontSize: 11, color: MUTED, textAlign: "right" }}>{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <Link
                  href="/dashboard"
                  style={{
                    width: "100%",
                    padding: "16px",
                    borderRadius: 10,
                    fontWeight: 800,
                    fontSize: 15,
                    color: "#fff",
                    backgroundColor: PURPLE,
                    border: "none",
                    cursor: "pointer",
                    boxShadow: `0 0 28px ${PURPLE}45`,
                    letterSpacing: "0.03em",
                    textDecoration: "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  Back to Dashboard →
                </Link>
                <div>
                  <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: "#6b7280", marginBottom: 8, textAlign: "center" as const }}>Share Your Result</p>
                  <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap" as const }}>
                    <button
                      onClick={() => window.open(`https://x.com/intent/tweet?text=${st}`, "_blank", "noopener,noreferrer,width=600,height=500")}
                      title="Share on X / Twitter"
                      style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 11px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.06)", color: "#e5e7eb", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.259 5.631zM17.083 20.248h1.833L7.084 4.126H5.117z"/></svg>
                      X
                    </button>
                    <button
                      onClick={() => window.open(`https://www.facebook.com/sharer/sharer.php?u=${su}`, "_blank", "noopener,noreferrer,width=600,height=500")}
                      title="Share on Facebook"
                      style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 11px", borderRadius: 8, border: "1px solid rgba(24,119,242,0.4)", background: "rgba(24,119,242,0.1)", color: "#5b9cf6", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.313 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.268h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/></svg>
                      Facebook
                    </button>
                    <button
                      onClick={() => window.open(`https://wa.me/?text=${st}`, "_blank", "noopener,noreferrer")}
                      title="Share on WhatsApp"
                      style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 11px", borderRadius: 8, border: "1px solid rgba(37,211,102,0.4)", background: "rgba(37,211,102,0.1)", color: "#4ade80", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                      WhatsApp
                    </button>
                    <button
                      onClick={() => window.open(`https://reddit.com/submit?url=${su}&title=${st}`, "_blank", "noopener,noreferrer,width=600,height=500")}
                      title="Share on Reddit"
                      style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 11px", borderRadius: 8, border: "1px solid rgba(255,69,0,0.4)", background: "rgba(255,69,0,0.1)", color: "#f97316", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/></svg>
                      Reddit
                    </button>
                    <button
                      onClick={() => window.open(`https://t.me/share/url?url=${su}&text=${st}`, "_blank", "noopener,noreferrer,width=600,height=500")}
                      title="Share on Telegram"
                      style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 11px", borderRadius: 8, border: "1px solid rgba(0,136,204,0.4)", background: "rgba(0,136,204,0.1)", color: "#38bdf8", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
                      Telegram
                    </button>
                    <button
                      onClick={shareWitness}
                      title="Copy to clipboard"
                      style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 11px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.04)", color: "#9ca3af", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                    >
                      📋 Copy
                    </button>
                  </div>
                </div>
              </div>
                  </>
                );
              })()}
            </div>
          )}

        </div>
      </main>

      {/* ── Comparison modal ─────────────────────────────────────────── */}
      {compareModalOpen && submitResult && scenario && (
        <WitnessComparisonModal
          open={compareModalOpen}
          onClose={() => setCompareModalOpen(false)}
          submitResult={submitResult}
          scenario={scenario}
        />
      )}
    </>
  );
}
