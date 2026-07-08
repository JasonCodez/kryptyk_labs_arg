"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  getEncodedClue,
  getCipherLabel,
  getCipherInstruction,
  type CipherType,
} from "@/lib/blackout-ciphers";

/* ─────────────────────────────────────────────────────────────────────────────
   Types
───────────────────────────────────────────────────────────────────────────── */
interface Redaction {
  placeholder: string;
  hint:        string;
  options:     string[];
  cipherType:  CipherType;
  cipherShift: number;
  cipherKey:   string;
}

interface BlackoutData {
  rawDocument:    string;
  documentTitle:  string;
  classification: string;
  flavorText:     string;
  answerMode:     "free_text" | "multiple_choice";
  redactions:     Redaction[];
  successMessage: string;
  stampSrc?:      string;
  stampOpacity?:  number;
  stampX?:        number;
  stampY?:        number;
  stampScale?:    number;
}

type Segment =
  | { type: "text";      content: string }
  | { type: "redaction"; index: number };

/* ─────────────────────────────────────────────────────────────────────────────
   Helpers
───────────────────────────────────────────────────────────────────────────── */
/* Deterministic "messy marker" style — same seed always produces same result */
function redactionStyle(idx: number, widthPx: number, heightEm: number): React.CSSProperties {
  // cheap deterministic hash
  const h  = Math.imul(idx * 2654435761 + 1, 0x9e3779b9) >>> 0;
  const h2 = Math.imul((idx + 7) * 1000003, 0x6b43a9b5) >>> 0;
  const rot     = ((h  % 120) / 100 - 0.6);          // –0.6 … +0.6 deg
  const skewX   = ((h2 % 60)  / 100 - 0.3);          // –0.3 … +0.3 deg
  const wExtra  = (h  % 5);                           // 0–4 px wider
  const hExtra  = (h2 % 3) * 0.5;                     // 0–1 px taller
  const shade   = 8 + (h % 10);                       // #080808 … #121212
  const hex     = shade.toString(16).padStart(2, "0");
  const bleedX  = rot > 0 ? "1px" : "-1px";
  return {
    display:       "inline-block",
    minWidth:      `${widthPx + wExtra}px`,
    height:        `calc(${heightEm}em + ${hExtra}px)`,
    background:    `#${hex}${hex}${hex}`,
    verticalAlign: "middle",
    margin:        "0 1px",
    transform:     `rotate(${rot}deg) skewX(${skewX}deg)`,
    boxShadow:     `${bleedX} 1px 4px rgba(0,0,0,0.55), inset 0 0 0 1px rgba(255,255,255,0.03)`,
  };
}

function parseDocument(raw: string): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  let ri   = 0;
  const re = /\[\[([^\]]+)\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    if (m.index > last) out.push({ type: "text", content: raw.slice(last, m.index) });
    out.push({ type: "redaction", index: ri++ });
    last = re.lastIndex;
  }
  if (last < raw.length) out.push({ type: "text", content: raw.slice(last) });
  return out;
}

function clsTheme(level: string): { bg: string; fg: string } {
  const l = (level ?? "").toUpperCase();
  if (l === "UNCLASSIFIED") return { bg: "#1a5c1a", fg: "#ffffff" };
  if (l === "CONFIDENTIAL") return { bg: "#003087", fg: "#ffffff" };
  if (l === "SECRET")       return { bg: "#8b0000", fg: "#ffffff" };
  return                           { bg: "#8b0000", fg: "#ffffff" };
}

/* ─────────────────────────────────────────────────────────────────────────────
   Props
───────────────────────────────────────────────────────────────────────────── */
interface BlackoutPuzzleProps {
  puzzleId:      string;
  blackoutData:  Record<string, unknown>;
  alreadySolved?: boolean;
  onSolved?:     () => void;
}

/* ─────────────────────────────────────────────────────────────────────────────
   Main component
───────────────────────────────────────────────────────────────────────────── */
export default function BlackoutPuzzle({
  puzzleId,
  blackoutData,
  alreadySolved = false,
  onSolved,
}: BlackoutPuzzleProps) {
  const data       = blackoutData as unknown as BlackoutData;
  const redactions = (Array.isArray(data.redactions) ? data.redactions : []) as Redaction[];
  const segments   = parseDocument(data.rawDocument ?? "");
  const answerMode = data.answerMode ?? "free_text";
  const clsLabel   = (data.classification ?? "TOP SECRET").toUpperCase();
  const theme      = clsTheme(clsLabel);

  const [solved,    setSolved]    = useState<boolean[]>(() => Array(redactions.length).fill(alreadySolved));
  const [inputs,    setInputs]    = useState<string[]>(() => Array(redactions.length).fill(""));
  const [attempts,  setAttempts]  = useState<number[]>(() => Array(redactions.length).fill(0));
  const [wrong,     setWrong]     = useState<boolean[]>(() => Array(redactions.length).fill(false));
  const [allSolved, setAllSolved] = useState(alreadySolved);
  const [showGuide, setShowGuide] = useState(false);
  const [showIntro, setShowIntro] = useState(!alreadySolved);
  const [started,   setStarted]   = useState(alreadySolved);
  const [elapsed,   setElapsed]   = useState(0);
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const calledRef = useRef(false);
  const terminalRef = useRef<HTMLDivElement>(null);

  const refNum = puzzleId
    ? (parseInt(puzzleId.replace(/-/g, "").slice(0, 4), 16) % 900) + 100
    : 247;
  const docRef = `DOC-${refNum}-${String(new Date().getFullYear() % 100).padStart(2, "0")}`;

  useEffect(() => {
    if (!calledRef.current && solved.length > 0 && solved.every(Boolean)) {
      setAllSolved(true);
      calledRef.current = true;
      if (timerRef.current) clearInterval(timerRef.current);
      onSolved?.();
    }
  }, [solved, onSolved]);

  // Start/stop the elapsed timer
  useEffect(() => {
    if (!started || allSolved) return;
    timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [started, allSolved]);

  const formatTime = useCallback((s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }, []);

  function startPuzzle() {
    setShowIntro(false);
    setStarted(true);
  }

  function checkAnswer(index: number, answer: string) {
    const correct = redactions[index]?.placeholder ?? "";
    if (answer.trim().toLowerCase() === correct.trim().toLowerCase()) {
      setSolved(prev  => { const n = [...prev]; n[index] = true;        return n; });
      setWrong (prev  => { const n = [...prev]; n[index] = false;       return n; });
    } else {
      setWrong   (prev => { const n = [...prev]; n[index] = true;       return n; });
      setAttempts(prev => { const n = [...prev]; n[index] = n[index]+1; return n; });
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>, idx: number) {
    if (e.key === "Enter") { e.preventDefault(); checkAnswer(idx, inputs[idx] ?? ""); }
  }

  function scrollToTerminal() {
    terminalRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const solvedCount = solved.filter(Boolean).length;
  const [isMobile, setIsMobile] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(375);
  const [docFullscreen, setDocFullscreen] = useState(false);
  useEffect(() => {
    const check = () => {
      setIsMobile(window.innerWidth < 640);
      setViewportWidth(window.innerWidth);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  /* ─── constants ──────────────────────────────────────────────── */
  const FONT         = "'Courier New', Courier, monospace";
  const TERMINAL_FONT = "Consolas, 'Cascadia Code', 'Fira Code', 'JetBrains Mono', 'Liberation Mono', monospace";
  const PAPER = "#f0ead8";
  const INK   = "#1a1408";
  const RULE  = "#c5b89a";
  const FADED = "#6b5e45";
  const docZoom = isMobile && !docFullscreen ? Math.max(0.38, (viewportWidth - 16) / 760) : 1;

  /* ─────────────────────────────────────────────────────────────────
     RENDER
  ───────────────────────────────────────────────────────────────────*/
  const PROSE = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
  return (
    <div className="w-full">

      {/* ══════════════════════════════════════════════════════════
           INTRO MODAL
          ══════════════════════════════════════════════════════════ */}
      {showIntro && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 100,
          display: "flex", alignItems: "flex-start", justifyContent: "center",
          background: "rgba(0,0,0,0.88)",
          padding: "16px",
          overflowY: "auto",
        }}>
          <div style={{
            background: "#08080a",
            border: `2px solid ${theme.bg}`,
            boxShadow: `0 0 60px ${theme.bg}55, 0 30px 80px rgba(0,0,0,0.9)`,
            borderRadius: "4px",
            maxWidth: "540px",
            width: "100%",
            overflow: "visible",
            fontFamily: PROSE,
            margin: "auto",
          }}>
            {/* modal classification bar */}
            <div style={{
              background: theme.bg,
              color: theme.fg,
              textAlign: "center",
              padding: "6px 20px",
              fontSize: "11px",
              fontWeight: "bold",
              letterSpacing: "0.55em",
              fontFamily: FONT,
            }}>YOUR EYES ONLY</div>

            {/* modal body */}
            <div style={{ padding: isMobile ? "18px 16px 16px" : "28px 32px 24px" }}>
              <div style={{ textAlign: "center", marginBottom: "20px" }}>
                <div style={{ fontSize: "36px", marginBottom: "8px" }}>⬛</div>
                <h2 style={{
                  fontFamily: FONT,
                  fontSize: "18px",
                  fontWeight: "bold",
                  letterSpacing: "0.15em",
                  color: "#f0ead8",
                  margin: 0,
                  textTransform: "uppercase",
                }}>Classified Document</h2>
                <p style={{ fontFamily: FONT, fontSize: "11px", color: "#8b7355", letterSpacing: "0.1em", margin: "4px 0 0" }}>
                  INTEL OPERATIONS DIVISION
                </p>
              </div>

              {/* Role / context briefing */}
              <div style={{
                background: "rgba(139,0,0,0.08)",
                border: "1px solid rgba(139,0,0,0.3)",
                borderRadius: "4px",
                padding: "12px 14px",
                marginBottom: "16px",
              }}>
                <p style={{ fontSize: "11px", fontFamily: FONT, letterSpacing: "0.08em", color: "#8b4444", margin: "0 0 6px", fontWeight: "bold" }}>
                  ▸ OPERATIVE BRIEFING
                </p>
                <p style={{ fontSize: "13px", lineHeight: "1.65", color: "#c8bfaa", margin: 0 }}>
                  You are an <strong style={{ color: "#f0ead8" }}>intelligence analyst</strong> with temporary clearance to review a sensitive file. This document has been partially redacted by order of a higher authority — key words and phrases have been suppressed before it reached your desk.
                </p>
              </div>

              <div style={{ borderTop: "1px solid #2a2018", borderBottom: "1px solid #2a2018", padding: "16px 0", marginBottom: "20px" }}>
                <p style={{ fontSize: "14px", lineHeight: "1.65", color: "#c8bfaa", margin: "0 0 12px" }}>
                  Your job is to <strong style={{ color: "#f0ead8" }}>reconstruct the missing information</strong> using the encoded cipher clues provided. Every redaction hides a word or phrase that is critical to understanding the full picture.
                </p>
                <p style={{ fontSize: "14px", lineHeight: "1.65", color: "#c8bfaa", margin: 0 }}>
                  Use the <strong style={{ color: "#f0ead8" }}>DECODE TERMINAL</strong> below the document to work through each cipher. Click any black bar to jump directly to its entry.
                </p>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr", gap: "8px", marginBottom: "20px" }}>
                {[
                  { icon: "⬛", label: "Redactions", desc: "Hidden words — click to navigate" },
                  { icon: "🔐", label: "Cipher clues", desc: "Encoded text you must decode" },
                  { icon: "🕐", label: "Timer", desc: "Starts when you press Begin" },
                ].map(({ icon, label, desc }) => (
                  <div key={label} style={{
                    background: "rgba(240,234,216,0.04)",
                    border: "1px solid #2a2018",
                    borderRadius: "4px",
                    padding: "10px 12px",
                  }}>
                    <div style={{ fontSize: "18px", marginBottom: "4px" }}>{icon}</div>
                    <div style={{ fontSize: "12px", fontWeight: "bold", color: "#f0ead8", marginBottom: "2px" }}>{label}</div>
                    <div style={{ fontSize: "11px", color: "#7a6e5e", lineHeight: 1.4 }}>{desc}</div>
                  </div>
                ))}
              </div>

              {answerMode === "free_text" && (
                <p style={{ fontSize: "12px", color: "#7a6e5e", marginBottom: "20px", lineHeight: 1.5 }}>
                  Open the <strong style={{ color: "#9a8e7e" }}>? CIPHER GUIDE</strong> in the terminal at any time if you need a reference for how each cipher works.
                </p>
              )}

              <button
                type="button"
                onClick={startPuzzle}
                style={{
                  width: "100%",
                  padding: "12px",
                  background: theme.bg,
                  color: theme.fg,
                  border: "none",
                  fontFamily: FONT,
                  fontSize: "13px",
                  fontWeight: "bold",
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                }}
              >
                BEGIN DECLASSIFICATION
              </button>
            </div>

            {/* modal classification bar */}
            <div style={{
              background: theme.bg,
              color: theme.fg,
              textAlign: "center",
              padding: "6px 20px",
              fontSize: "11px",
              fontWeight: "bold",
              letterSpacing: "0.55em",
              fontFamily: FONT,
            }}>YOUR EYES ONLY</div>
          </div>
        </div>
      )}
      <div style={{ background: "#0e0e0e", padding: isMobile ? "12px 0 0" : "24px 20px 0", borderRadius: "4px" }}>

        {/* ── Timer bar ── */}
        {started && (
          <div style={{
            maxWidth: "760px",
            margin: isMobile ? "0 0 12px" : "0 auto 12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#070d07",
            border: "1px solid #1a3a1a",
            borderRadius: "4px",
            padding: isMobile ? "8px 12px" : "8px 16px",
          }}>
            <span style={{ fontFamily: TERMINAL_FONT, fontSize: "11px", color: "#4a7a4a", letterSpacing: "0.1em" }}>
              🕐&nbsp;ELAPSED TIME
            </span>
            <span style={{
              fontFamily: TERMINAL_FONT,
              fontSize: "20px",
              fontWeight: "bold",
              letterSpacing: "0.12em",
              color: allSolved ? "#5acc5a" : "#7acc7a",
            }}>
              {formatTime(elapsed)}
            </span>
            {allSolved && (
              <span style={{ fontFamily: TERMINAL_FONT, fontSize: "11px", color: "#5acc5a", letterSpacing: "0.1em" }}>
                ✓&nbsp;COMPLETE
              </span>
            )}
            {!allSolved && (
              <span style={{ fontFamily: TERMINAL_FONT, fontSize: "11px", color: "#3a5a3a", letterSpacing: "0.1em" }}>
                {solvedCount}/{redactions.length}&nbsp;CLEARED
              </span>
            )}
          </div>
        )}

        {/* how to play button */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "8px", maxWidth: "760px", margin: isMobile ? "0 0 8px" : "0 auto 8px" }}>
          <button onClick={() => setShowIntro(true)} style={{ background: "rgba(253,231,76,0.08)", border: "1px solid rgba(253,231,76,0.3)", color: "#FDE74C", fontSize: "11px", fontWeight: 700, padding: "4px 10px", borderRadius: "6px", cursor: "pointer", letterSpacing: "0.04em", fontFamily: "inherit" }}>? How to play</button>
        </div>

        {/* progress bar */}
        {!allSolved && redactions.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "18px" }}>
            <div style={{ flex: 1, height: "2px", background: "#1e1e1e" }}>
              <div style={{
                width: `${(solvedCount / redactions.length) * 100}%`,
                height: "100%",
                background: theme.bg,
                transition: "width 0.4s",
              }} />
            </div>
            <span style={{ fontFamily: FONT, fontSize: "10px", color: "#444", letterSpacing: "0.08em" }}>
              {solvedCount}/{redactions.length}&nbsp;DECLASSIFIED
            </span>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
             PANEL 1 — THE PAPER DOCUMENT
            ═══════════════════════════════════════════════════════════ */}

        {/* Fullscreen / zoom wrapper */}
        <div style={isMobile && docFullscreen ? {
          position: "fixed", inset: 0, zIndex: 90,
          overflowY: "auto", background: "#080808",
        } : {}}>

          {/* Sticky close bar (fullscreen only) */}
          {isMobile && docFullscreen && (
            <div style={{
              position: "sticky", top: 0, zIndex: 91,
              background: "#0a0a0a", borderBottom: "1px solid #1a2a1a",
              padding: "10px 16px", display: "flex",
              justifyContent: "space-between", alignItems: "center",
            }}>
              <span style={{ fontFamily: FONT, fontSize: "10px", color: "#5acc5a", letterSpacing: "0.12em" }}>
                ◉ {docRef}
              </span>
              <button
                onClick={() => setDocFullscreen(false)}
                style={{
                  background: "transparent", border: "1px solid #2a4a2a",
                  color: "#7aaa7a", padding: "5px 14px", fontSize: "11px",
                  fontFamily: FONT, cursor: "pointer", letterSpacing: "0.08em",
                }}
              >
                ✕ CLOSE
              </button>
            </div>
          )}

        <div
          style={{
            background: PAPER,
            color: INK,
            fontFamily: FONT,
            maxWidth: "760px",
            margin: "0 auto",
            boxShadow: "0 12px 60px rgba(0,0,0,0.9)",
            border: `1px solid ${RULE}`,
            position: "relative",
            overflow: "hidden",
            ...(isMobile && !docFullscreen ? { zoom: docZoom, cursor: "zoom-in" } : {}),
          }}
          onClick={isMobile && !docFullscreen ? () => setDocFullscreen(true) : undefined}
        >
          {/* top classification banner */}
          <ClassificationBanner theme={theme} label={clsLabel} struck={allSolved} />

          {/* letterhead */}
          <div style={{
            padding: isMobile ? "12px 16px" : "16px 52px 14px",
            borderBottom: `2px solid ${RULE}`,
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            justifyContent: "space-between",
            alignItems: isMobile ? "flex-start" : "flex-start",
            gap: isMobile ? "8px" : "16px",
          }}>
            <div style={{ fontSize: "10px", lineHeight: "1.75" }}>
              <div style={{ fontSize: "12px", fontWeight: "bold", letterSpacing: "0.12em", textTransform: "uppercase" }}>
                Intelligence Operations Division
              </div>
              <div style={{ letterSpacing: "0.06em" }}>WASHINGTON, D.C. 20505</div>
              <div style={{ marginTop: "4px", fontSize: "9px", color: FADED, letterSpacing: "0.06em" }}>
                HANDLE VIA {clsLabel} CHANNELS ONLY
              </div>
            </div>
            <div style={{ fontSize: "10px", lineHeight: "1.75", textAlign: isMobile ? "left" : "right", flexShrink: 0 }}>
              <div style={{ fontWeight: "bold", letterSpacing: "0.06em" }}>{docRef}</div>
              <div>{new Date().toLocaleDateString("en-US", { day: "2-digit", month: "long", year: "numeric" })}</div>
              <div style={{ marginTop: "4px", fontSize: "9px", color: FADED, letterSpacing: "0.06em" }}>COPY&nbsp;1&nbsp;OF&nbsp;1</div>
            </div>
          </div>

          {/* memo for / subject */}
          {(data.documentTitle || data.flavorText) && (
            <div style={{ padding: isMobile ? "12px 16px 0" : "14px 52px 0", fontSize: "13px", lineHeight: "1.9" }}>
              {data.documentTitle && (
                <div>
                  <span style={{ fontWeight: "bold" }}>MEMORANDUM&nbsp;FOR:&nbsp;</span>
                  <span style={{ textDecoration: "underline", textUnderlineOffset: "3px" }}>{data.documentTitle}</span>
                </div>
              )}
              {data.flavorText && (
                <div><span style={{ fontWeight: "bold" }}>Subject:&nbsp;</span>{data.flavorText}</div>
              )}
            </div>
          )}

          <div style={{ margin: isMobile ? "10px 16px" : "10px 52px", borderTop: `1px solid ${RULE}` }} />

          {/* document body */}
          <div style={{
            padding: isMobile ? "0 16px 24px" : "0 52px 36px",
            fontSize: isMobile ? "14px" : "13px",
            lineHeight: answerMode === "multiple_choice" ? "2.6" : isMobile ? "2.0" : "1.75",
            color: INK,
            whiteSpace: "pre-wrap",
          }}>
            {segments.map((seg, i) => {
              if (seg.type === "text") return <span key={i}>{seg.content}</span>;

              const idx        = seg.index;
              const isSolved   = solved[idx] ?? false;
              const redaction  = redactions[idx];
              const answer     = redaction?.placeholder ?? "";
              const barPx      = Math.max(48, answer.length * 8 + 12);
              const refBadge   = idx + 1;

              /* ── multiple-choice: inline bar + option buttons below ── */
              if (answerMode === "multiple_choice") {
                const opts = Array.isArray(redaction?.options) ? redaction.options : [];
                if (isSolved) {
                  return (
                    <span key={i} style={{ whiteSpace: "nowrap" }}>
                      <span style={{
                        color: "#1a5c1a", fontWeight: "bold",
                        borderBottom: "2px solid #3a8a3a",
                      }}>{answer}</span>
                    </span>
                  );
                }
                return (
                  <span key={i} style={{
                    display: "inline-flex", flexDirection: "column", alignItems: "flex-start",
                    verticalAlign: "middle", margin: "0 2px", gap: "3px",
                  }}>
                    <span style={redactionStyle(idx, barPx, 0.9)} />
                    <span style={{ display: "flex", flexWrap: "wrap", gap: "3px", lineHeight: 1 }}>
                      {opts.map((opt: string, oi: number) => (
                        <button key={oi} type="button" onClick={e => { e.stopPropagation(); checkAnswer(idx, opt); }}
                          style={{
                            padding: "2px 8px", fontSize: "10px", fontFamily: FONT,
                            background: wrong[idx] ? "#fff0ec" : "#fff8f0",
                            border: `1px solid ${wrong[idx] ? "#9b1c1c" : "#a08060"}`,
                            color: INK, cursor: "pointer",
                          }}
                        >{opt}</button>
                      ))}
                    </span>
                  </span>
                );
              }

              /* ── free-text: inline bar + superscript ref badge ── */
              if (isSolved) {
                return (
                  <span key={i} style={{ whiteSpace: "nowrap" }}>
                    <span style={{
                      color: "#1a5c1a", fontWeight: "bold",
                      borderBottom: "2px solid #3a8a3a",
                    }}>{answer}</span>
                  </span>
                );
              }
              return (
                <span key={i}
                  style={{ display: "inline", whiteSpace: "nowrap", cursor: "pointer" }}
                  onClick={e => { e.stopPropagation(); scrollToTerminal(); }}
                  title={`[${refBadge}] — see DECODE TERMINAL below`}
                >
                  <span style={redactionStyle(idx, barPx, 0.85)} /><sup style={{
                    fontSize: "8px",
                    fontWeight: "bold",
                    padding: "0 2px",
                    background: theme.bg,
                    color: theme.fg,
                    lineHeight: 1,
                    letterSpacing: "0.02em",
                  }}>[{refBadge}]</sup>
                </span>
              );
            })}
          </div>

          {/* document footer */}
          <div style={{
            borderTop: `1px solid ${RULE}`,
            padding: isMobile ? "8px 16px" : "8px 52px",
            display: "flex",
            justifyContent: isMobile ? "center" : "space-between",
            fontSize: "8.5px",
            color: FADED,
            letterSpacing: "0.05em",
          }}>
            {isMobile ? (
              <span>{docRef} · CLASSIFIED</span>
            ) : (
              <>
                <span>CLASSIFIED BY: DIRECTOR OF NATIONAL INTELLIGENCE</span>
                <span>DERIVED FROM: MULTIPLE SOURCES</span>
                <span>DECLASSIFY ON: OADR</span>
              </>
            )}
          </div>

          {/* bottom classification banner */}
          <ClassificationBanner theme={theme} label={clsLabel} struck={allSolved} />

          {/* stamp / watermark overlay */}
          {data.stampSrc && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.stampSrc}
              alt=""
              aria-hidden="true"
              style={{
                position: "absolute",
                left: `${data.stampX ?? 50}%`,
                top: `${data.stampY ?? 50}%`,
                transform: `translate(-50%, -50%) scale(${data.stampScale ?? 1})`,
                opacity: data.stampOpacity ?? 0.25,
                maxWidth: "80%",
                pointerEvents: "none",
                userSelect: "none",
                zIndex: 2,
              }}
            />
          )}
        </div>{/* end paper doc div */}

          {/* Tap-to-read affordance (mobile zoom preview only) */}
          {isMobile && !docFullscreen && (
            <div
              onClick={() => setDocFullscreen(true)}
              style={{
                maxWidth: `${Math.round(760 * docZoom)}px`,
                margin: "6px auto 0",
                display: "flex",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <span style={{
                background: theme.bg, color: theme.fg,
                padding: "7px 20px", fontSize: "10px",
                fontFamily: FONT, fontWeight: "bold",
                letterSpacing: "0.15em",
              }}>
                ↗ TAP TO READ FULL DOCUMENT
              </span>
            </div>
          )}
        </div>{/* end fullscreen/zoom wrapper */}

        {/* ═══════════════════════════════════════════════════════════
             PANEL 2 — DECODE TERMINAL  (free_text mode only)
            ═══════════════════════════════════════════════════════════ */}
        {answerMode === "free_text" && redactions.length > 0 && (
          <div
            ref={terminalRef}
            style={{
              maxWidth: "760px",
              margin: "0 auto",
              background: "#040804",
              border: "1px solid #1a3a1a",
              borderTop: "none",
              fontFamily: TERMINAL_FONT,
            }}
          >
            {/* terminal title bar */}
            <div style={{
              background: "#0a180a",
              borderBottom: "1px solid #1a3a1a",
              padding: isMobile ? "9px 12px" : "9px 20px",
              display: "flex",
              flexDirection: isMobile ? "column" : "row",
              justifyContent: "space-between",
              alignItems: isMobile ? "flex-start" : "center",
              gap: isMobile ? "8px" : undefined,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#2a0a0a", display: "inline-block" }} />
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#2a2a0a", display: "inline-block" }} />
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#0a2a0a", display: "inline-block" }} />
                <span style={{ fontSize: "11px", color: "#5acc5a", letterSpacing: "0.15em", marginLeft: "6px", fontFamily: TERMINAL_FONT }}>
                  ◉&nbsp;DECODE TERMINAL
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: isMobile ? "10px" : "12px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => setShowGuide(true)}
                  style={{
                    fontFamily: TERMINAL_FONT,
                    fontSize: "10px",
                    padding: "2px 10px",
                    background: "transparent",
                    color: "#4a9a4a",
                    border: "1px solid #2a5a2a",
                    cursor: "pointer",
                    letterSpacing: "0.08em",
                    transition: "color 0.15s, border-color 0.15s",
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLButtonElement).style.color = "#5acc5a";
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "#4a8a4a";
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLButtonElement).style.color = "#4a9a4a";
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "#2a5a2a";
                  }}
                >
                  ? CIPHER GUIDE
                </button>
                <span style={{ fontSize: "10px", color: "#4a9a4a", letterSpacing: "0.08em", fontFamily: TERMINAL_FONT }}>
                  {solvedCount}&nbsp;/&nbsp;{redactions.length}&nbsp;CLEARED
                </span>
                <span style={{ fontSize: "10px", color: "#3a7a3a", letterSpacing: "0.08em", fontFamily: TERMINAL_FONT }}>
                  🕐&nbsp;{formatTime(elapsed)}
                </span>
              </div>
            </div>

            {/* cipher entries */}
            {redactions.map((r, idx) => {
              const isSolved   = solved[idx] ?? false;
              const ct         = (r.cipherType as CipherType) ?? "none";
              const cs         = r.cipherShift ?? 13;
              const ck         = r.cipherKey ?? "KEY";
              const encoded    = ct !== "none" ? getEncodedClue(r.placeholder, ct, cs, ck) : "";
              const isWrong    = wrong[idx] ?? false;
              const att        = attempts[idx] ?? 0;
              const showHint   = att >= 1 && !!r.hint;

              return (
                <div
                  key={idx}
                  style={{
                    borderBottom: idx < redactions.length - 1 ? "1px solid #0e1e0e" : "none",
                    padding: isMobile ? "14px 12px" : "16px 20px",
                    background: isSolved
                      ? "#020602"
                      : idx % 2 === 0 ? "#040804" : "#050a05",
                    opacity: isSolved ? 0.55 : 1,
                    transition: "opacity 0.5s",
                  }}
                >
                  {/* entry header row */}
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    marginBottom: isSolved ? 0 : "12px",
                    flexWrap: "nowrap",
                    overflow: "hidden",
                  }}>
                    {/* [N] badge */}
                    <span style={{
                      fontSize: "10px",
                      fontWeight: "bold",
                      padding: "1px 7px",
                      background: isSolved ? "#0a2a0a" : theme.bg,
                      color: isSolved ? "#5acc5a" : theme.fg,
                      letterSpacing: "0.06em",
                      flexShrink: 0,
                      transition: "all 0.4s",
                    }}>[{idx + 1}]</span>

                    {isSolved ? (
                      /* solved indicator */
                      <span style={{ fontSize: "12px", color: "#5acc5a", letterSpacing: "0.06em", fontFamily: TERMINAL_FONT }}>
                        ✓ CLEARED —&nbsp;
                        <span style={{ fontWeight: "bold", color: "#4dff4d" }}>{r.placeholder.toUpperCase()}</span>
                      </span>
                    ) : (
                      /* cipher type badge */
                      <span style={{
                        fontSize: "10px",
                        padding: "2px 9px",
                        background: "#0a1a0a",
                        color: "#7acc7a",
                        border: "1px solid #2a5a2a",
                        fontFamily: TERMINAL_FONT,
                        letterSpacing: "0.06em",
                      }}>
                        {getCipherLabel(ct, cs)}
                      </span>
                    )}

                    {/* attempt counter */}
                    {!isSolved && att > 0 && (
                      <span style={{
                        marginLeft: "auto",
                        flexShrink: 0,
                        fontSize: "9px",
                        color: "#dd5555",
                        fontFamily: TERMINAL_FONT,
                        letterSpacing: "0.03em",
                        whiteSpace: "nowrap",
                      }}>
                        {att}✗
                      </span>
                    )}
                  </div>

                  {/* encoded clue block */}
                  {!isSolved && encoded && (
                    <div style={{ marginBottom: "10px" }}>
                      {/* code block */}
                      <div style={{
                        background: "#020502",
                        border: "1px solid #0d1f0d",
                        padding: "12px 16px",
                        position: "relative",
                        overflow: "hidden",
                      }}>
                        {/* scanline overlay */}
                        <div style={{
                          position: "absolute", inset: 0,
                          backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,18,0,0.2) 2px, rgba(0,18,0,0.2) 4px)",
                          pointerEvents: "none",
                        }} />
                        <div style={{
                          fontFamily: TERMINAL_FONT,
                          fontSize: isMobile ? "13px" : "16px",
                          color: "#4dff4d",
                          letterSpacing: isMobile ? "0.04em" : "0.12em",
                          lineHeight: "1.8",
                          whiteSpace: "pre-wrap",
                          overflowWrap: "break-word",
                          wordBreak: "break-word",
                          textShadow: "0 0 8px rgba(77,255,77,0.45)",
                          position: "relative",
                        }}>
                          {encoded}
                        </div>
                      </div>
                      {/* decode instruction */}
                      <div style={{
                        marginTop: "5px",
                        fontSize: "11px",
                        color: "#5a9a5a",
                        fontFamily: TERMINAL_FONT,
                        letterSpacing: "0.02em",
                        paddingLeft: "2px",
                      }}>
                        ▸&nbsp;{getCipherInstruction(ct)}
                      </div>
                    </div>
                  )}

                  {/* context-only note (no cipher) */}
                  {!isSolved && ct === "none" && (
                    <div style={{
                      marginBottom: "10px",
                      padding: "8px 12px",
                      background: "#0a0e0a",
                      border: "1px solid #141e14",
                      fontSize: "11px",
                      color: "#6a9a6a",
                      fontFamily: TERMINAL_FONT,
                      letterSpacing: "0.02em",
                      fontStyle: "italic",
                    }}>
                      ▸&nbsp;No cipher encoded for this entry. Deduce the answer from the document text above.
                    </div>
                  )}

                  {/* hint — shown after ≥1 wrong attempt */}
                  {!isSolved && showHint && (
                    <div style={{
                      marginBottom: "8px",
                      padding: "7px 12px",
                      background: "#120e00",
                      border: "1px solid #2e1e00",
                      fontSize: "11px",
                      color: "#cc8800",
                      fontFamily: TERMINAL_FONT,
                      letterSpacing: "0.02em",
                    }}>
                      INTEL NOTE:&nbsp;{r.hint}
                    </div>
                  )}

                  {/* input row */}
                  {!isSolved && (
                    <div>
                      <div style={{ display: "flex", gap: "0", alignItems: "stretch" }}>
                        {/* prompt glyph */}
                        <span style={{
                          padding: "0 9px",
                          background: "#0a180a",
                          color: "#5acc5a",
                          border: "1px solid #2a5a2a",
                          borderRight: "none",
                          display: "flex",
                          alignItems: "center",
                          fontSize: "12px",
                          userSelect: "none",
                        }}>▶</span>
                        <input
                          type="text"
                          value={inputs[idx] ?? ""}
                          onChange={e => setInputs(prev => { const n = [...prev]; n[idx] = e.target.value; return n; })}
                          onKeyDown={e => handleKeyDown(e, idx)}
                          autoComplete="off"
                          autoCorrect="off"
                          spellCheck={false}
                          placeholder="ENTER DECODED VALUE…"
                          style={{
                            flex: 1,
                            padding: "8px 12px",
                            fontFamily: TERMINAL_FONT,
                            fontSize: "13px",
                            background: isWrong ? "#0e0404" : "#050c05",
                            border: `1px solid ${isWrong ? "#4a1414" : "#1a3a1a"}`,
                            color: isWrong ? "#cc4444" : "#4dff4d",
                            outline: "none",
                            letterSpacing: "0.04em",
                            transition: "border-color 0.2s, background 0.2s, color 0.2s",
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => checkAnswer(idx, inputs[idx] ?? "")}
                          style={{
                            padding: isMobile ? "0 12px" : "0 18px",
                            fontFamily: TERMINAL_FONT,
                            fontSize: "12px",
                            fontWeight: "bold",
                            background: "#0a1e0a",
                            color: "#5acc5a",
                            border: "1px solid #2a5a2a",
                            borderLeft: "none",
                            cursor: "pointer",
                            letterSpacing: isMobile ? "0.05em" : "0.12em",
                            transition: "background 0.15s, color 0.15s",
                            flexShrink: 0,
                          }}
                          onMouseEnter={e => {
                            (e.currentTarget as HTMLButtonElement).style.background = "#102e10";
                            (e.currentTarget as HTMLButtonElement).style.color = "#90ff90";
                          }}
                          onMouseLeave={e => {
                            (e.currentTarget as HTMLButtonElement).style.background = "#0a1e0a";
                            (e.currentTarget as HTMLButtonElement).style.color = "#5acc5a";
                          }}
                        >
                          SUBMIT
                        </button>
                      </div>

                      {/* wrong feedback */}
                      {isWrong && (
                        <div style={{
                          marginTop: "5px",
                          fontSize: "10px",
                        color: "#ee5555",
                        fontFamily: TERMINAL_FONT,
                        letterSpacing: "0.03em",
                        }}>
                          ✗ AUTHENTICATION FAILED — verify your decode and resubmit
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
             SUCCESS PANEL
            ═══════════════════════════════════════════════════════════ */}
        {allSolved && (
          <div style={{
            maxWidth: "760px",
            margin: "0 auto",
            padding: "16px 28px",
            background: "rgba(26,92,26,0.07)",
            border: "1px solid #1a5c1a",
            borderTop: answerMode === "free_text" ? "none" : undefined,
            textAlign: "center",
            fontFamily: FONT,
          }}>
            <div style={{
              fontWeight: "bold",
              letterSpacing: "0.2em",
              fontSize: "13px",
              color: "#2a8a2a",
              textShadow: "0 0 14px rgba(42,138,42,0.35)",
            }}>
              ✓ DOCUMENT FULLY DECLASSIFIED
            </div>
            {data.successMessage && (
              <div style={{ marginTop: "8px", fontSize: "11px", color: "#555", letterSpacing: "0.04em" }}>
                {data.successMessage}
              </div>
            )}
          </div>
        )}

        <div style={{ height: "28px" }} />
      </div>

      {/* cipher guide modal */}
      {showGuide && <CipherGuideModal font={TERMINAL_FONT} onClose={() => setShowGuide(false)} />}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Cipher guide modal
───────────────────────────────────────────────────────────────────────────── */
const CIPHER_GUIDE = [
  {
    name: "ANAGRAM",
    color: "#ffdd55",
    summary: "The letters of the answer have been scrambled into a different order.",
    example: "SILENT  →  TINSEL  (or LISTEN, ENLIST…)",
    howTo: "Rearrange the letters until you find a word or phrase that fits the document context.",
  },
  {
    name: "ASCII DECIMAL",
    color: "#bbddff",
    summary: "Each letter is written as its decimal ASCII code. Uppercase letters run from 65 (A) to 90 (Z).",
    example: "H·E·L·L·O  →  72 · 69 · 76 · 76 · 79",
    howTo: "Look up each number as a letter: 65=A, 66=B, 67=C … 90=Z. Slash (/) = space.",
  },
  {
    name: "ATBASH",
    color: "#55ffcc",
    summary: "Each letter is mirrored in the alphabet: A↔Z, B↔Y, C↔X, and so on.",
    example: "HELLO  →  SVOOL",
    howTo: "Apply the same substitution again — it is its own inverse. A→Z, B→Y, etc.",
  },
  {
    name: "BINARY",
    color: "#99ffcc",
    summary: "Each letter is written as its 8-bit ASCII binary number.",
    example: "A  →  01000001     B  →  01000010",
    howTo: "Convert each 8-bit group to decimal, then to a letter: 65=A, 66=B … 90=Z.",
  },
  {
    name: "CAESAR CIPHER",
    color: "#66ddff",
    summary: "Each letter is shifted forward in the alphabet by a fixed number (the key).",
    example: "KEY = 3:  A→D,  B→E,  Z→C",
    howTo: "Shift each letter BACK by the key number. If the key is 13 (ROT13), encode and decode are identical — just apply it again.",
  },
  {
    name: "HEX CODE",
    color: "#aaffee",
    summary: "Each letter is written as its hexadecimal ASCII value. Uppercase letters run from 41 (A) to 5A (Z).",
    example: "H·E·L·L·O  →  48 45 4C 4C 4F",
    howTo: "Convert each hex number to decimal, then to a letter: 41=A, 42=B … 5A=Z. Slash (/) = space.",
  },
  {
    name: "QWERTY SHIFT",
    color: "#ddbbff",
    summary: "Each letter is replaced by the key immediately to its RIGHT on a QWERTY keyboard, wrapping at the end of each row.",
    example: "Q→W   W→E   E→R       A→S   S→D",
    howTo: "Rows: Q–P (top) · A–L (middle) · Z–M (bottom). Shift each letter ONE position to the LEFT in its row to decode.",
  },
  {
    name: "MORSE CODE",
    color: "#66ffaa",
    summary: "Each letter is encoded as dots (.) and dashes (-), separated by spaces. Slash (/) separates words.",
    example: "S  O  S  →  ...  ---  ...",
    howTo: "Look up each dot/dash group in a Morse chart. Two spaces = next letter; slash = next word.",
  },
  {
    name: "NATO PHONETIC",
    color: "#88ccff",
    summary: "Each letter is replaced by its NATO code word: A=ALPHA, B=BRAVO, C=CHARLIE, and so on.",
    example: "H·I  →  HOTEL · INDIA",
    howTo: "Take the FIRST letter of each code word. ALPHA=A, BRAVO=B … Slash (/) separates words.",
  },
  {
    name: "NUMBER CODE",
    color: "#cc99ff",
    summary: "Each letter is replaced by its position in the alphabet: A=01, B=02 … Z=26.",
    example: "H·E·L·L·O  →  08 · 05 · 12 · 12 · 15",
    howTo: "Convert each number back to its letter (01=A, 02=B, … 26=Z).",
  },
  {
    name: "PHONE KEYPAD",
    color: "#ffee88",
    summary: "Each letter is encoded as its phone key number then press count (A=21, B=22, C=23 on key 2).",
    example: "H·I  →  42 · 43",
    howTo: "First digit = key (2=ABC, 3=DEF, 4=GHI, 5=JKL, 6=MNO, 7=PQRS, 8=TUV, 9=WXYZ). Second digit = which letter on that key.",
  },
  {
    name: "POLYBIUS SQUARE",
    color: "#ffbbff",
    summary: "Each letter maps to its row and column in a 5×5 grid. I and J share one cell.",
    example: "H  →  23  (row 2, col 3)       O  →  34",
    howTo: "Row 1=A–E · Row 2=F–J (I=J) · Row 3=K–O · Row 4=P–T · Row 5=U–Z. First digit = row, second = column.",
  },
  {
    name: "RAIL FENCE",
    color: "#ffcc88",
    summary: "Text is written in a zigzag pattern across 2 rails, then concatenated rail by rail.",
    example: "HELLO: Rail 1 = H_L_O · Rail 2 = _E_L_  →  HLO // EL",
    howTo: "Left of '//' = top rail (original positions 0, 2, 4…). Right = bottom rail (positions 1, 3, 5…). Interleave them alternately to recover the original text.",
  },
  {
    name: "REVERSE CIPHER",
    color: "#ffaa55",
    summary: "The entire word or phrase is spelled backwards.",
    example: "NIGHTFALL  →  LLAFTHGIN",
    howTo: "Read the characters in reverse order.",
  },
  {
    name: "VIGENÈRE CIPHER",
    color: "#ff99bb",
    summary: "Like Caesar, but the shift changes with each letter according to a repeating keyword.",
    example: "Key=CAT: H+C=J,  E+A=E,  L+T=E  →  JEE…",
    howTo: "For each letter, find its matching key letter (A=0, B=1…), then shift BACK by that amount. Repeat the keyword across the full message.",
  },
];

function CipherGuideModal({ font, onClose }: { font: string; onClose: () => void }) {
  const PROSE = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.82)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#080f08",
          border: "1px solid #2a5a2a",
          maxWidth: "660px",
          width: "100%",
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          fontFamily: PROSE,
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* modal title bar */}
        <div style={{
          background: "#0a180a",
          borderBottom: "1px solid #1a3a1a",
          padding: "11px 18px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexShrink: 0,
        }}>
          <span style={{ fontSize: "13px", color: "#5acc5a", letterSpacing: "0.12em", fontFamily: font }}>
            ◉&nbsp;CIPHER REFERENCE GUIDE
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent",
              border: "1px solid #2a5a2a",
              color: "#5acc5a",
              fontFamily: font,
              fontSize: "13px",
              padding: "1px 9px",
              cursor: "pointer",
              lineHeight: 1.4,
            }}
          >✕</button>
        </div>

        {/* intro */}
        <div style={{
          padding: "12px 20px 10px",
          fontSize: "13px",
          color: "#8aaa8a",
          borderBottom: "1px solid #0e1e0e",
          flexShrink: 0,
          lineHeight: 1.65,
        }}>
          Each redacted entry is encoded with one of the ciphers below. The cipher type is shown
          in the decode terminal. Use this guide to work out the answer.
        </div>

        {/* cipher list */}
        <div style={{ overflowY: "auto", padding: "4px 0" }}>
          {CIPHER_GUIDE.map(c => (
            <div key={c.name} style={{
              padding: "14px 20px",
              borderBottom: "1px solid #0e1e0e",
            }}>
              {/* cipher name — keeps monospace + color */}
              <div style={{
                fontSize: "12px",
                fontWeight: "bold",
                fontFamily: font,
                color: c.color,
                letterSpacing: "0.1em",
                marginBottom: "7px",
              }}>{c.name}</div>

              {/* summary — readable sans-serif */}
              <div style={{ fontSize: "13px", color: "#b0c8b0", lineHeight: 1.6, marginBottom: "8px" }}>
                {c.summary}
              </div>

              {/* example — monospace code block */}
              <div style={{
                background: "#020802",
                border: "1px solid #0d1f0d",
                padding: "7px 14px",
                fontFamily: font,
                fontSize: "12px",
                color: "#4dff4d",
                letterSpacing: "0.06em",
                marginBottom: "8px",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}>{c.example}</div>

              {/* how-to — readable sans-serif, slightly muted */}
              <div style={{
                fontSize: "12px",
                color: "#7a9a7a",
                lineHeight: 1.65,
              }}>
                <span style={{ color: "#4a7a4a", marginRight: "4px" }}>▸</span>{c.howTo}
              </div>
            </div>
          ))}
        </div>

        {/* footer */}
        <div style={{
          padding: "10px 18px",
          borderTop: "1px solid #0e1e0e",
          fontSize: "12px",
          color: "#3a6a3a",
          textAlign: "center",
          flexShrink: 0,
        }}>
          Click anywhere outside to close
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Classification banner
───────────────────────────────────────────────────────────────────────────── */
function ClassificationBanner({
  theme,
  label,
  struck,
}: {
  theme: { bg: string; fg: string };
  label: string;
  struck: boolean;
}) {
  return (
    <div style={{
      background: theme.bg,
      color: theme.fg,
      textAlign: "center",
      padding: "5px 20px",
      fontSize: "13px",
      fontWeight: "bold",
      letterSpacing: "0.55em",
      fontFamily: "'Courier New', Courier, monospace",
      textDecoration: struck ? "line-through" : "none",
      userSelect: "none",
    }}>
      {label}
    </div>
  );
}
