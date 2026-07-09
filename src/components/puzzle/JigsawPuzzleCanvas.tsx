"use client";

/**
 * JigsawPuzzleCanvas — Canvas2D implementation
 *
 * Architecture:
 *  - Single <canvas> fills the board area  (all piece rendering via Canvas2D)
 *  - Horizontal scrollable tray below the board (DOM-level, not canvas)
 *  - requestAnimationFrame render loop with dirty-flag (no unnecessary repaints)
 *  - Path2D cache per piece shape (same bezier math as original, now as Path2D)
 *  - Hit-testing via ctx.isPointInPath on the Path2D cache
 *  - Smooth drag via pointer-events directly on the canvas element
 *  - Spring snap animation in rAF loop — no GSAP needed for physics
 *  - Completion: GSAP energy-ring DOM overlay
 *  - localStorage save/resume preserved exactly
 *  - Same external props API — all call-sites unchanged
 */

import React, {
  useRef,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useLayoutEffect,
} from "react";
import { createPortal } from "react-dom";
import gsap from "gsap";
import PuzzleBugReportButton from "./PuzzleBugReportButton";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface EdgeMap { top: number; right: number; bottom: number; left: number }

interface PiecePos { x: number; y: number }

interface Piece {
  id: string;
  row: number;
  col: number;
  edges: EdgeMap;
  correct: PiecePos;
  pos: PiecePos;
  groupId: string;
  z: number;
  snapped: boolean;
}

type PathOpts = {
  featureSpan?: number; neckSpan?: number; headSpan?: number;
  tabDepth?: number; neckPinch?: number; shoulderDepth?: number;
  shoulderSpan?: number; cornerInset?: number; smooth?: number;
  // Shape-designer controls (all as fractions of edge length L)
  extFrac?: number;       // tab depth — default 0.270
  rFrac?: number;         // knob radius — default 0.118
  nHalfFrac?: number;     // neck half-width — default 0.100
  shoulderStart?: number; // shoulder start offset — default 0.150
};

// ─────────────────────────────────────────────────────────────────────────────
// Local-storage helpers
// ─────────────────────────────────────────────────────────────────────────────

interface SavedProgress {
  pieces: Record<string, { relX: number; relY: number; groupId: string; snapped: boolean; z: number }>;
  // groupIds resident in the tray at save time. Absent on saves from before the tray existed
  // (scatter-era) — treated as an incompatible/stale save rather than remapped.
  tray?: string[];
  elapsedMs: number;
  savedAt: number;
}

function getStorageKey(
  puzzleId: string | undefined, imageUrl: string, rows: number, cols: number
): string {
  if (puzzleId) return `jigsaw-progress-${puzzleId}`;
  const slug = (imageUrl ?? "").replace(/[^a-zA-Z0-9]/g, "").slice(-24);
  return `jigsaw-progress-${rows}x${cols}-${slug}`;
}

function saveJigsawProgress(key: string, pieces: Piece[], tray: string[], elapsedMs: number) {
  try {
    const data: SavedProgress = {
      pieces: Object.fromEntries(pieces.map(p => [p.id, {
        relX: p.pos.x - p.correct.x, relY: p.pos.y - p.correct.y,
        groupId: p.groupId, snapped: p.snapped, z: p.z,
      }])),
      tray, elapsedMs, savedAt: Date.now(),
    };
    localStorage.setItem(key, JSON.stringify(data));
  } catch { /* quota / SSR */ }
}

function loadJigsawProgress(key: string): SavedProgress | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as SavedProgress) : null;
  } catch { return null; }
}

function clearJigsawProgress(key: string) {
  try { localStorage.removeItem(key); } catch { /* noop */ }
}

function applyProgress(base: Piece[], saved: SavedProgress): Piece[] {
  return base.map(p => {
    const s = saved.pieces[p.id];
    if (!s) return p;
    return { ...p, pos: { x: p.correct.x + s.relX, y: p.correct.y + s.relY },
      groupId: s.groupId, snapped: s.snapped, z: s.z };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Edge generation  (identical logic as old SVG version)
// ─────────────────────────────────────────────────────────────────────────────

function buildEdges(rows: number, cols: number): Map<string, EdgeMap> {
  const map = new Map<string, EdgeMap>();
  const rnd = () => (Math.random() < 0.5 ? 1 : -1);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const id = `${r}-${c}`;
      const e: EdgeMap = { top: 0, right: 0, bottom: 0, left: 0 };
      if (r > 0) e.top = -map.get(`${r - 1}-${c}`)!.bottom;
      if (c > 0) e.left = -map.get(`${r}-${c - 1}`)!.right;
      e.right = c < cols - 1 ? rnd() : 0;
      e.bottom = r < rows - 1 ? rnd() : 0;
      map.set(id, e);
    }
  }
  return map;
}

// ─────────────────────────────────────────────────────────────────────────────
// Path2D builder  — mirrors `piecePath()` SVG math but into a Path2D object
// ─────────────────────────────────────────────────────────────────────────────

type EdgeCmd = ["L", number, number] | ["C", number, number, number, number, number, number];

function edgeProfile(L: number, dir: number, opts: PathOpts, sizeRef: number): EdgeCmd[] {
  if (dir === 0) return [["L", L, 0]];
  const sign = dir;
  const K    = 0.5523; // cubic bezier circle approximation constant

  // ── Shape-designer params (fall back to reference-matched defaults) ───────
  const ext   = L * (opts.extFrac       ?? 0.270);
  const tabH  = sign * ext;

  const r     = L * (opts.rFrac         ?? 0.118);
  const kCYm  = Math.max(ext - r, r * 0.05); // keep center above baseline
  const kCY   = sign * kCYm;

  const kL    = L * 0.5 - r;
  const kR    = L * 0.5 + r;

  const nHalf = L * (opts.nHalfFrac     ?? 0.100);
  const nL    = L * 0.5 - nHalf;
  const nR    = L * 0.5 + nHalf;
  const nY    = -sign * L * 0.018;

  const fL    = L * (opts.shoulderStart ?? 0.150);
  const fR    = L - fL;
  const sa    = (nL - fL) * 0.65;
  const si    = (nL - fL) * 0.20;

  const nRise = sign * (kCY - nY) * 0.35;

  return [
    ["L", fL, 0],

    // Left shoulder — S-curve: faint outward lift then sweeps inward, arrives flat at neck
    ["C", fL + sa, sign * L * 0.012,   nL - si, nY,   nL, nY],

    // Neck rises to left equator of knob with a vertical (outward-only) tangent
    ["C", nL, nY + (kCY - nY) * 0.42,   kL, kCY - nRise,   kL, kCY],

    // Left half-arc: equator → apex  (K gives near-perfect circle)
    ["C", kL, kCY + sign * r * K,   L * 0.5 - r * K, tabH,   L * 0.5, tabH],

    // Right half-arc: apex → equator (mirror)
    ["C", L * 0.5 + r * K, tabH,   kR, kCY + sign * r * K,   kR, kCY],

    // Right equator descends to neck (mirror of rise)
    ["C", kR, kCY - nRise,   nR, nY + (kCY - nY) * 0.42,   nR, nY],

    // Right shoulder — mirror of left
    ["C", nR + si, nY,   fR - sa, sign * L * 0.012,   fR, 0],

    ["L", L, 0],
  ];
}

function buildPath2D(pw: number, ph: number, edges: EdgeMap, opts: PathOpts): Path2D {
  const sizeRef = Math.min(pw, ph);
  const inset = Math.max(0, Math.min(sizeRef * 0.08, (opts.cornerInset ?? 0)));

  const { top: topDir, right: rDir, bottom: bDir, left: lDir } = edges;
  const rTL = lDir === 0 && topDir === 0 ? inset : 0;
  const rTR = topDir === 0 && rDir === 0 ? inset : 0;
  const rBR = rDir === 0 && bDir === 0 ? inset : 0;
  const rBL = bDir === 0 && lDir === 0 ? inset : 0;

  // Emit edge in world space given a transform (start, along, out directions, length, tab dir)
  function emitEdge(
    path: Path2D,
    sx: number, sy: number,
    ax: number, ay: number, // "along" unit vector
    ox: number, oy: number, // "out" unit vector (tab protrudes this way)
    L: number, dir: number
  ) {
    for (const cmd of edgeProfile(L, dir, opts, sizeRef)) {
      if (cmd[0] === "L") {
        path.lineTo(sx + ax * cmd[1] + ox * cmd[2], sy + ay * cmd[1] + oy * cmd[2]);
      } else {
        // bezierCurveTo
        path.bezierCurveTo(
          sx + ax * cmd[1] + ox * cmd[2], sy + ay * cmd[1] + oy * cmd[2],
          sx + ax * cmd[3] + ox * cmd[4], sy + ay * cmd[3] + oy * cmd[4],
          sx + ax * cmd[5] + ox * cmd[6], sy + ay * cmd[5] + oy * cmd[6],
        );
      }
    }
  }

  const path = new Path2D();
  path.moveTo(rTL, 0);

  // Top edge (along → +x, outward → -y)
  emitEdge(path, rTL, 0, 1, 0, 0, -1, pw - rTL - rTR, topDir);
  if (rTR > 0) path.quadraticCurveTo(pw, 0, pw, rTR); else path.lineTo(pw, 0);

  // Right edge (along → +y, outward → +x)
  emitEdge(path, pw, rTR, 0, 1, 1, 0, ph - rTR - rBR, rDir);
  if (rBR > 0) path.quadraticCurveTo(pw, ph, pw - rBR, ph); else path.lineTo(pw, ph);

  // Bottom edge (along → -x, outward → +y)
  emitEdge(path, pw - rBR, ph, -1, 0, 0, 1, pw - rBR - rBL, bDir);
  if (rBL > 0) path.quadraticCurveTo(0, ph, 0, ph - rBL); else path.lineTo(0, ph);

  // Left edge (along → -y, outward → -x)
  emitEdge(path, 0, ph - rBL, 0, -1, -1, 0, ph - rBL - rTL, lDir);
  if (rTL > 0) path.quadraticCurveTo(0, 0, rTL, 0); else path.lineTo(rTL, 0);

  path.closePath();
  return path;
}

// Rounded rect using the exact same corner construction as buildPath2D's outer-edge corners
// above (quadraticCurveTo with the true rectangular corner as the control point, endpoints
// inset by the radius along each edge) — so the board's own outline, drawn with this, matches
// a corner piece's rounded cut exactly rather than approximating it with a different curve
// family (e.g. a true circular arc) that would leave a mismatched sliver at each corner.
function roundedRectPath(x: number, y: number, w: number, h: number, r: number): Path2D {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  const path = new Path2D();
  path.moveTo(x + rr, y);
  path.lineTo(x + w - rr, y);
  path.quadraticCurveTo(x + w, y, x + w, y + rr);
  path.lineTo(x + w, y + h - rr);
  path.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  path.lineTo(x + rr, y + h);
  path.quadraticCurveTo(x, y + h, x, y + h - rr);
  path.lineTo(x, y + rr);
  path.quadraticCurveTo(x, y, x + rr, y);
  path.closePath();
  return path;
}

// ─────────────────────────────────────────────────────────────────────────────
// Props interface  (identical to old SVG component — all call-sites unchanged)
// ─────────────────────────────────────────────────────────────────────────────

interface JigsawPuzzleProps {
  imageUrl: string;
  rows?: number;
  cols?: number;
  boardWidth?: number;
  boardHeight?: number;
  /** kept for API compat */
  stagePadding?: number;
  trayHeight?: number;
  neighborSnapTolerance?: number;
  boardSnapTolerance?: number;
  trayScatter?: number;
  tabRadius?: number;
  tabDepth?: number;
  neckWidth?: number;
  neckDepth?: number;
  shoulderLen?: number;
  shoulderDepth?: number;
  cornerInset?: number;
  smooth?: number;
  // Shape-designer controls
  pieceExtFrac?: number;
  pieceRFrac?: number;
  pieceNHalfFrac?: number;
  pieceShoulderStart?: number;
  containerStyle?: React.CSSProperties;
  onComplete?: (t?: number) => Promise<number | void> | number | void;
  onShowRatingModal?: () => void;
  suppressInternalCongrats?: boolean;
  onControlsReady?: (api: {
    reset: () => void;
    sendLooseToTray: () => void;
    enterFullscreen: () => void;
    exitFullscreen: () => void;
    isFullscreen: boolean;
  }) => void;
  puzzleId?: string;
  puzzleTitle?: string;
  tableBackground?: string;
  funFact?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const dist2 = (dx: number, dy: number) => Math.hypot(dx, dy);

// ── Piece-placement particle burst ──────────────────────────────────────────
interface BurstParticle {
  x0: number; y0: number;
  angle: number;
  dist: number;
  size: number;
  t0: number;
  dur: number;
  kind: "star" | "spark";
  color: string;
  rot0: number;
  rotSpeed: number;
}

const BURST_COLORS = ["#FFD700", "#FFE873", "#FFF6D8", "#FDBA2A"];

// ── Sound effects ────────────────────────────────────────────────────────────
const PIECE_CONNECT_SFX_URL = "/audio/snap_sound_jigsaw.mp3";
const PIECE_CONNECT_SFX_VOLUME = 0.35;
const PUZZLE_COMPLETE_SFX_URL = "/audio/jigsaw_puzzle_complete.mp3";
const PUZZLE_COMPLETE_SFX_VOLUME = 0.5;

// ── Completion frame ─────────────────────────────────────────────────────────
// Decorative frame image shown around the completed puzzle. It's a PNG with a real
// transparent "hole" where the photo shows through, but the hole isn't flush with the
// image's own edges (there's a thin transparent margin outside the border too) — these
// fractions are the hole's actual boundary, measured directly from the asset's alpha
// channel. If the frame image is ever swapped, re-measure and update these.
const FRAME_IMG_URL = "/images/jigsaw_frame.png";
const FRAME_HOLE = { left: 0.08984, right: 0.91094, top: 0.08958, bottom: 0.90625 };

/**
 * Plays a short sound effect via the Web Audio API instead of HTMLAudioElement. An
 * <audio>/`new Audio()` element streams and buffers progressively — even with
 * preload="auto" and a small round-robin pool (tried first, still cut off), playback can
 * start before the browser finishes buffering, so the tail (or start) stalls. This decodes
 * the entire file into an in-memory AudioBuffer once, up front; every play() call after
 * that starts a fresh AudioBufferSourceNode against the already-fully-decoded buffer, so
 * there is no streaming/buffering path left to race — and overlapping plays (rapid
 * consecutive snaps) are natively independent, no pooling needed.
 */
function useSfxBuffer(url: string, volume: number, enabled: () => boolean) {
  const ctxRef = useRef<AudioContext | null>(null);
  const bufferRef = useRef<AudioBuffer | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const AudioCtxCtor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtxCtor) return;
    const ctx = new AudioCtxCtor();
    ctxRef.current = ctx;
    let cancelled = false;

    fetch(url)
      .then((res) => res.arrayBuffer())
      .then((data) => ctx.decodeAudioData(data))
      .then((buf) => { if (!cancelled) bufferRef.current = buf; })
      .catch(() => {
        // Ignore load/decode failures — playback just becomes a no-op.
      });

    return () => {
      cancelled = true;
      bufferRef.current = null;
      ctxRef.current = null;
      void ctx.close().catch(() => {});
    };
  }, [url]);

  return useCallback(() => {
    if (!enabled()) return;
    const ctx = ctxRef.current;
    const buffer = bufferRef.current;
    if (!ctx || !buffer) return;

    const playNow = () => {
      try {
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        const gain = ctx.createGain();
        gain.gain.value = volume;
        source.connect(gain);
        gain.connect(ctx.destination);
        source.start(0);
      } catch {
        // Ignore playback failures.
      }
    };

    // Browsers auto-suspend an idle AudioContext (autoplay policy on first use, and again
    // after a few seconds of silence) — resume() is async, so starting playback before it
    // resolves schedules the clip while the context is still silently spinning back up,
    // eating the beginning of the sound. Waiting for resume() to actually finish before
    // scheduling anything is what fixes the "only hear the tail" symptom.
    if (ctx.state === "suspended") {
      void ctx.resume().then(playNow).catch(() => {});
    } else {
      playNow();
    }
  }, [enabled, volume]);
}

function createBurstParticles(cx: number, cy: number, pieceSize: number): BurstParticle[] {
  const count = 14;
  const particles: BurstParticle[] = [];
  const t0 = performance.now();
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
    const isStar = Math.random() < 0.6;
    particles.push({
      x0: cx, y0: cy,
      angle,
      dist: pieceSize * (0.55 + Math.random() * 0.55),
      size: pieceSize * (isStar ? (0.09 + Math.random() * 0.07) : (0.045 + Math.random() * 0.035)),
      t0,
      dur: 480 + Math.random() * 260,
      kind: isStar ? "star" : "spark",
      color: BURST_COLORS[(Math.random() * BURST_COLORS.length) | 0],
      rot0: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 6,
    });
  }
  return particles;
}

function drawStar4(ctx: CanvasRenderingContext2D, cx: number, cy: number, rOuter: number, rotation: number) {
  const rInner = rOuter * 0.38;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const angle = rotation + (Math.PI / 4) * i;
    const r = i % 2 === 0 ? rOuter : rInner;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function formatElapsed(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  if (hrs > 0) {
    return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tray piece thumbnail — static render of a tray-resident group (usually a single piece,
// occasionally a small merged cluster sent back from the board). Deliberately simpler than
// the animated per-frame board render: no drag/snap/pop/glow state applies to a piece
// that's just sitting in the tray.
// ─────────────────────────────────────────────────────────────────────────────

// Fraction of a piece's nominal cell size reserved on each side for tab/knob protrusion past
// its own row/col box, in thumbnail renders (tray items, drag-ghost). A single un-merged
// piece's rendered height therefore ends up (1 + 2*THUMB_BLEED_FRAC) × its nominal cell size —
// callers that need to fit a thumbnail within a fixed-height container (the tray strip) must
// size the nominal cell down by that same factor first, or the rendered piece overflows it.
const THUMB_BLEED_FRAC = 0.32;

// Shared by drawTrayThumbnail (to size its own canvas) and the drag-ghost overlay (to size
// the floating DOM element and know how far to shift other tray items to open a gap for it)
// — both need the exact same "how big does this group's thumbnail render" math.
function computeThumbSize(members: Piece[], pw: number, ph: number, cellPx: number): { w: number; h: number; bleed: number; thumbScale: number } {
  const minRow = Math.min(...members.map(m => m.row));
  const minCol = Math.min(...members.map(m => m.col));
  const maxRow = Math.max(...members.map(m => m.row));
  const maxCol = Math.max(...members.map(m => m.col));
  const thumbScale = cellPx / Math.max(pw, ph);
  const bleed = Math.max(pw, ph) * THUMB_BLEED_FRAC; // room for tab protrusion past the nominal cell box
  const contentW = (maxCol - minCol + 1) * pw;
  const contentH = (maxRow - minRow + 1) * ph;
  return { w: (contentW + bleed * 2) * thumbScale, h: (contentH + bleed * 2) * thumbScale, bleed, thumbScale };
}

function drawTrayThumbnail(
  canvas: HTMLCanvasElement,
  members: Piece[],
  pw: number, ph: number,
  pathCache: Map<string, Path2D>,
  img: HTMLImageElement | HTMLCanvasElement | null,
  gridW: number, gridH: number,
  rows: number, cols: number,
  cellPx: number,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx || members.length === 0) return;

  const minRow = Math.min(...members.map(m => m.row));
  const minCol = Math.min(...members.map(m => m.col));
  const { w: cssW, h: cssH, bleed, thumbScale } = computeThumbSize(members, pw, ph, cellPx);
  const dpr = typeof window !== "undefined" ? (window.devicePixelRatio || 1) : 1;

  canvas.width  = Math.max(1, Math.round(cssW * dpr));
  canvas.height = Math.max(1, Math.round(cssH * dpr));
  canvas.style.width  = `${cssW}px`;
  canvas.style.height = `${cssH}px`;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.scale(dpr * thumbScale, dpr * thumbScale);
  ctx.translate(bleed, bleed);

  for (const m of members) {
    const path = pathCache.get(m.id);
    if (!path) continue;
    ctx.save();
    ctx.translate((m.col - minCol) * pw, (m.row - minRow) * ph);
    ctx.save();
    ctx.clip(path);
    if (img) {
      ctx.drawImage(img, -(m.col * pw), -(m.row * ph), gridW, gridH);
    } else {
      const hue = ((m.row * cols + m.col) / (rows * cols)) * 360;
      ctx.fillStyle = `hsl(${hue},38%,28%)`;
      ctx.fill(path);
    }
    ctx.restore();
    ctx.strokeStyle = "rgba(255,255,255,0.32)";
    ctx.lineWidth = 1 / thumbScale;
    ctx.stroke(path);
    ctx.restore();
  }
  ctx.restore();
}

function TrayPieceThumb({
  groupId, members, pw, ph, pathCache, img, gridW, gridH, rows, cols, cellPx, onPick,
  registerNode, shiftPx,
}: {
  groupId: string;
  members: Piece[];
  pw: number; ph: number;
  pathCache: Map<string, Path2D>;
  img: HTMLImageElement | HTMLCanvasElement | null;
  gridW: number; gridH: number;
  rows: number; cols: number;
  cellPx: number;
  onPick: (groupId: string, e: React.PointerEvent<HTMLCanvasElement>) => void;
  /** Registers this tray item's canvas node so the drag-ghost can measure its position
   *  (getBoundingClientRect) to compute where a piece being dragged back in should land. */
  registerNode: (groupId: string, node: HTMLCanvasElement | null) => void;
  /** Animated horizontal offset (px) opening a gap for a piece currently hovering the tray. */
  shiftPx: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) drawTrayThumbnail(ref.current, members, pw, ph, pathCache, img, gridW, gridH, rows, cols, cellPx);
  }, [members, pw, ph, pathCache, img, gridW, gridH, rows, cols, cellPx]);
  useEffect(() => {
    registerNode(groupId, ref.current);
    return () => registerNode(groupId, null);
  }, [groupId, registerNode]);
  return (
    <canvas
      ref={ref}
      onPointerDown={(e) => onPick(groupId, e)}
      style={{
        display: "block", touchAction: "none", cursor: "grab", flexShrink: 0,
        transform: `translateX(${shiftPx}px)`,
        transition: "transform 160ms ease",
      }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function JigsawPuzzleSVGWithTray({
  imageUrl, rows = 4, cols = 6,
  boardWidth = 640, boardHeight = 480,
  trayHeight: trayHeightProp = 160,
  neighborSnapTolerance = 24, boardSnapTolerance = 18,
  tabRadius = 0.18, tabDepth = 0.22,
  neckWidth = 0.22, neckDepth = 0.10,
  shoulderLen = 0.22, shoulderDepth = 0.08,
  cornerInset = 1, smooth = 0.55,
  pieceExtFrac, pieceRFrac, pieceNHalfFrac, pieceShoulderStart,
  onComplete, onShowRatingModal,
  suppressInternalCongrats = false, onControlsReady,
  puzzleId, puzzleTitle, tableBackground, funFact, containerStyle = {},
}: JigsawPuzzleProps) {

  // ── Refs ──────────────────────────────────────────────────────────────────
  const canvasRef       = useRef<HTMLCanvasElement>(null);
  const wrapperRef      = useRef<HTMLDivElement>(null);
  const trayStripRef    = useRef<HTMLDivElement>(null);
  const energyWrapperRef = useRef<HTMLDivElement>(null);
  const energyRingRef   = useRef<HTMLDivElement>(null);
  const energyGlowRef   = useRef<HTMLDivElement>(null);
  const messageRef      = useRef<HTMLDivElement>(null);
  const livingPhotoOuterRef = useRef<HTMLDivElement>(null);
  const livingPhotoImgRef   = useRef<HTMLImageElement>(null);

  // Image
  const imgRef           = useRef<HTMLImageElement | HTMLCanvasElement | null>(null);
  const frameImgRef      = useRef<HTMLImageElement | null>(null);
  const [imageOk, setImageOk] = useState<boolean | null>(null);
  const [effectiveUrl, setEffectiveUrl] = useState<string>(imageUrl ?? "");
  const [proxyTried, setProxyTried]   = useState(false);
  const [reloadKey, setReloadKey]     = useState(0);

  const isJigsawSfxEnabled = useCallback(() => {
    if (typeof window === "undefined") return false;
    try {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
      const userPrefsRaw = window.localStorage.getItem("userPreferences");
      if (userPrefsRaw) {
        const prefs = JSON.parse(userPrefsRaw) as { reduceAnimations?: boolean };
        if (prefs?.reduceAnimations) return false;
      }
      if (window.localStorage.getItem("jigsawSoundEffectsEnabled") === "false") return false;
    } catch {
      // Fall through to enabled.
    }
    return true;
  }, []);

  const playPieceConnectSfx = useSfxBuffer(PIECE_CONNECT_SFX_URL, PIECE_CONNECT_SFX_VOLUME, isJigsawSfxEnabled);
  const playPuzzleCompleteSfx = useSfxBuffer(PUZZLE_COMPLETE_SFX_URL, PUZZLE_COMPLETE_SFX_VOLUME, isJigsawSfxEnabled);

  // Logical dimensions of a piece — always a perfect square, regardless of the grid's row/col
  // shape, so pieces never look stretched. boardWidth/boardHeight are the outer square
  // stage's dimensions (always equal); cellSize is sized off the *longer* of rows/cols so the
  // whole grid (gridW × gridH) fits within that square without overflowing — a grid that
  // isn't itself square (e.g. 4 cols × 3 rows) ends up centered with a little letterboxing on
  // two sides rather than stretched to fill it.
  const cellSize = boardWidth / Math.max(rows, cols);
  const pw = cellSize;
  const ph = cellSize;
  const gridW = cellSize * cols;
  const gridH = cellSize * rows;
  const pwRef = useRef(pw);
  const phRef = useRef(ph);
  pwRef.current = pw; phRef.current = ph;

  // Stage: logical space the canvas covers. boardOffX/Y is the top-left of the piece GRID
  // within the stage — offset by both the fixed stage margin (room for tab overflow and for
  // briefly resting a loose piece/cluster just outside the board edge) and, when the grid
  // isn't itself square, the extra centering needed to place gridW×gridH in the middle of the
  // square board. This never changes size at runtime, so piece positions never need
  // remapping on resize — only the CSS pixel scale (scaleRef) does.
  // p.pos / p.correct are in stage coords; boardOffX/Y is NOT baked in at render time.
  const STAGE_MARGIN  = cellSize * 0.6;
  const boardOffXRef  = useRef(STAGE_MARGIN + (boardWidth  - gridW) / 2);
  const boardOffYRef  = useRef(STAGE_MARGIN + (boardHeight - gridH) / 2);
  const stageDimsRef  = useRef({ w: boardWidth + STAGE_MARGIN * 2, h: boardHeight + STAGE_MARGIN * 2 });

  // DPR-aware canvas pixel dimensions
  const [canvasW, setCanvasW] = useState(boardWidth);
  const [canvasH, setCanvasH] = useState(boardHeight);
  const scaleRef = useRef(1); // stage logical px  →  CSS px (canvas element CSS size)

  // Tray height — sized so a single un-merged piece's full rendered thumbnail (including its
  // tab/knob protrusion, see THUMB_BLEED_FRAC) fits without being clipped by the tray's own
  // vertical overflow:hidden. trayCellPx is the *nominal* piece cell size fed into
  // computeThumbSize, which is deliberately smaller than the tray's own height — the actual
  // rendered thumbnail comes out (1 + 2×THUMB_BLEED_FRAC)× bigger than that (previously this
  // used a flat `TRAY_H - 32` here, which was that render size, not the nominal cell size fed
  // into it — knobs were getting clipped top and bottom as a result).
  const TRAY_H = Math.max(140, trayHeightProp ?? 200);
  const TRAY_PAD_Y = 12; // must match the tray strip's own vertical padding in the JSX below
  const trayCellPx = Math.max(40, (TRAY_H - TRAY_PAD_Y * 2) / (1 + THUMB_BLEED_FRAC * 2));

  // Path2D cache keyed by piece id (rebuilt whenever rows/cols/opts change)
  const pathCacheRef = useRef<Map<string, Path2D>>(new Map());

  // Render-order cache — avoids re-sorting every piece on every single animation frame.
  // The sort order (z-index, dragged group on top) only actually changes when the pieces
  // array itself is replaced (a commit) or the active drag group changes, not on every
  // frame of a continuous drag, so re-deriving it 60×/sec was pure waste on large puzzles.
  const sortedCacheRef = useRef<{ pieces: Piece[]; ag: string | null; sorted: Piece[] } | null>(null);

  // Path opts (memoised from props)
  const pathOpts = useMemo<PathOpts>(() => ({
    featureSpan:  clamp(0.46 + shoulderLen * 0.06,  0.44, 0.54),
    headSpan:     clamp(tabRadius * 1.5,             0.255, 0.33),
    neckSpan:     clamp(neckWidth * 0.74,            0.14,  0.19),
    tabDepth:     clamp(tabDepth * 0.95,             0.17,  0.225),
    neckPinch:    clamp(neckDepth * 0.03,            0.0008, 0.004),
    shoulderSpan: clamp(shoulderLen * 0.56,          0.09,  0.14),
    shoulderDepth:clamp(shoulderDepth * 0.02,        0.0006, 0.0025),
    cornerInset:  clamp(cornerInset * Math.min(pw, ph) * 0.06, 0, Math.min(pw, ph) * 0.08),
    smooth:       clamp(smooth, 0.72, 0.94),
    extFrac:       pieceExtFrac,
    rFrac:         pieceRFrac,
    nHalfFrac:     pieceNHalfFrac,
    shoulderStart: pieceShoulderStart,
  }), [tabRadius, tabDepth, neckWidth, neckDepth, shoulderLen, shoulderDepth, cornerInset, smooth, pw, ph, pieceExtFrac, pieceRFrac, pieceNHalfFrac, pieceShoulderStart]);

  // Pieces state (live copy in ref for renderer, React state for UI)
  const piecesRef = useRef<Piece[]>([]);
  const [pieces, setPiecesState] = useState<Piece[]>([]);
  const setPieces = useCallback((fn: Piece[] | ((p: Piece[]) => Piece[])) => {
    setPiecesState(prev => {
      const next = typeof fn === "function" ? fn(prev) : fn;
      piecesRef.current = next;
      dirtyRef.current = true;
      return next;
    });
  }, []);

  // Tray: ordered list of groupIds currently resident in the tray strip (not on the board/
  // stage at all). A piece is tray-resident iff its groupId appears in trayGroupSetRef — the
  // render loop and hit-testing (both driven by the imperative rAF loop, not React's render
  // cycle) key off that ref directly rather than the trayOrder React state, exactly like
  // piecesRef mirrors the pieces state — updated synchronously in the same tick a drag/drop
  // handler runs, with no dependency on when React gets around to re-rendering.
  const trayOrderRef = useRef<string[]>([]);
  const trayGroupSetRef = useRef<Set<string>>(new Set());
  const [trayOrder, setTrayOrderState] = useState<string[]>([]);
  const setTrayOrder = useCallback((fn: string[] | ((t: string[]) => string[])) => {
    setTrayOrderState(prev => {
      const next = typeof fn === "function" ? fn(prev) : fn;
      trayOrderRef.current = next;
      trayGroupSetRef.current = new Set(next);
      dirtyRef.current = true;
      return next;
    });
  }, []);

  // Drag
  const dragRef = useRef<{
    active: boolean; pointerId: number | null;
    groupId: string | null; anchorId: string | null;
    anchorOff: PiecePos; starts: Map<string, PiecePos>;
    dx: number; dy: number;
    // True whenever the pointer is within the tray strip's vertical band — the dragged group
    // is hidden from the board canvas and shown instead as a floating DOM ghost over the tray.
    ghosting: boolean;
  }>({ active: false, pointerId: null, groupId: null, anchorId: null,
       anchorOff: { x: 0, y: 0 }, starts: new Map(), dx: 0, dy: 0, ghosting: false });

  // ── Tray drag-ghost ───────────────────────────────────────────────────────
  // A dragged piece hovering the tray is rendered as a small floating DOM element (not on the
  // board canvas, which is clamped to its own viewport and can't visually reach the tray strip
  // below it) that tracks the pointer directly, plus a live "gap" preview showing where it'll
  // land if dropped. Position tracking is imperative (direct style writes), matching how the
  // rest of dragging avoids React state in the pointermove hot path.
  const trayItemNodesRef = useRef<Map<string, HTMLCanvasElement>>(new Map());
  const registerTrayNode = useCallback((groupId: string, node: HTMLCanvasElement | null) => {
    if (node) trayItemNodesRef.current.set(groupId, node);
    else trayItemNodesRef.current.delete(groupId);
  }, []);
  const ghostWrapperRef = useRef<HTMLDivElement>(null);
  const ghostCanvasRef  = useRef<HTMLCanvasElement>(null);
  const ghostBoardSizeRef = useRef({ w: 0, h: 0 }); // size at board scale — the ghost's fixed wrapper footprint
  const ghostTraySizeRef  = useRef({ w: 0, h: 0 }); // size at tray scale — the shrink target, and the tray gap width
  const [ghostGroupId, setGhostGroupId] = useState<string | null>(null);
  const [trayInsertIndex, setTrayInsertIndexState] = useState<number | null>(null);
  const trayInsertIndexRef = useRef<number | null>(null);
  const setTrayInsertIndex = useCallback((idx: number | null) => {
    trayInsertIndexRef.current = idx;
    setTrayInsertIndexState(idx);
  }, []);
  const lastTrayHoverComputeRef = useRef(0);
  // Tracks whether the pointer was over the tray's own rect last tick, separately from
  // dragRef.ghosting (which now triggers earlier, at the board canvas's edge) — this is what
  // actually gates the reorder-gap preview and whether a release lands in the tray at all.
  const wasOverTrayRef = useRef(false);

  // Snap spring  
  // Per-piece offsets rather than one shared delta — a drag can trigger both a board-snap
  // (the dragged piece/group) AND a neighbor merge (a separate, stationary group yanked
  // into alignment with it) in the same pointerUp, and each moves by its own distinct amount.
  type SnapOffset = { dx0: number; dy0: number; dx: number; dy: number };
  type SnapAnim = { offsets: Map<string, SnapOffset>; t0: number; dur: number };
  const snapRef = useRef<SnapAnim | null>(null);

  // ── Per-piece animation state ────────────────────────────────────────────
  const snapPopRef    = useRef<Map<string, { t0: number; dur: number }>>(new Map());
  const snapGlowRef   = useRef<Map<string, { t0: number; dur: number }>>(new Map());
  const burstParticlesRef = useRef<BurstParticle[]>([]);
  // Per-piece solve pop: each piece gets a random delay + random peak scale
  const solveScaleRef = useRef<Map<string, { t0: number; dur: number; peak: number }>>(new Map());
  const lastFrameRef  = useRef(0);

  // rAF
  const rafRef   = useRef<number | null>(null);
  const dirtyRef = useRef(true);

  // Completion
  const completedRef  = useRef(false);
  // When the decorative frame should start fading in — set once the living-photo reveal
  // (which fully covers the board while it plays) begins dissolving away, not the instant
  // the puzzle is solved, since the frame would otherwise finish fading in while still
  // hidden underneath that overlay and the fade would never actually be seen.
  const frameFadeStartRef = useRef<number | null>(null);
  const FRAME_FADE_DUR = 3200;
  const [showCongrats, setShowCongrats]     = useState(false);
  const [awardedPoints, setAwardedPoints]   = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const startTimeRef  = useRef(Date.now());
  const storageKeyRef = useRef("");

  // Save/resume
  const [resumed, setResumed]       = useState(false);
  const savedElapsedRef             = useRef(0);

  // Fullscreen
  const [isFullscreen, setIsFullscreen] = useState(false);
  const isFullscreenRef = useRef(false);
  const [portalReady, setPortalReady]   = useState(false);

  // UI helpers
  const [isTouchDevice, setIsTouchDevice]               = useState(false);
  const [mobileHintDismissed, setMobileHintDismissed]   = useState(false);
  const [showPreview, setShowPreview]                   = useState(false);
  const controlsAssignedRef = useRef(false);

  // Viewport: pinch-zoom/pan lets a player inspect fine detail on the (always fully visible)
  // board. viewOff is the top-left corner of the viewport in stage logical coordinates.
  // scaleRef maps (stage unit → CSS pixel); clientToLogical adds viewOff back.
  const viewOffXRef = useRef(0);
  const viewOffYRef = useRef(0);

  // User-applied zoom (multiplied on top of layout scaleRef). Updated by pinch and zoom buttons.
  const MIN_ZOOM = 0.4;
  const MAX_ZOOM = 4;
  const userZoomRef = useRef(1);
  const [userZoom, setUserZoom] = useState(1); // mirrors userZoomRef for button rendering only

  // Active pointer positions for pinch/pan gesture detection
  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  // Two-finger pinch gesture state
  const pinchGestureRef = useRef<{ active: boolean; prevMidX: number; prevMidY: number; prevDist: number }>({
    active: false, prevMidX: 0, prevMidY: 0, prevDist: 1,
  });
  // Single-finger pan gesture state
  const panGestureRef = useRef<{ active: boolean; pointerId: number; lastX: number; lastY: number }>({
    active: false, pointerId: -1, lastX: 0, lastY: 0,
  });



  // ── Rebuild Path2D cache ─────────────────────────────────────────────────

  const rebuildCache = useCallback((edgesMap: Map<string, EdgeMap>) => {
    const cache = new Map<string, Path2D>();
    for (const [id, edges] of edgesMap) {
      cache.set(id, buildPath2D(pwRef.current, phRef.current, edges, pathOpts));
    }
    pathCacheRef.current = cache;
  }, [pathOpts]);

  // ── Piece manipulation helpers ───────────────────────────────────────────

  function moveGroup(arr: Piece[], gid: string, dx: number, dy: number): Piece[] {
    return arr.map(p => p.groupId !== gid ? p : { ...p, pos: { x: p.pos.x + dx, y: p.pos.y + dy } });
  }
  function mergeInto(arr: Piece[], target: string, src: string): Piece[] {
    if (target === src) return arr;
    const targetSnapped = arr.some(p => p.groupId === target && p.snapped);
    return arr.map(p => p.groupId !== src ? p : { ...p, groupId: target, snapped: targetSnapped || p.snapped });
  }
  function normaliseGroup(arr: Piece[], gid: string): Piece[] {
    const group = arr.filter(p => p.groupId === gid);
    if (group.length <= 1) return arr;
    if (group.some(p => p.snapped)) {
      return arr.map(p => p.groupId !== gid ? p : { ...p, snapped: true, pos: { ...p.correct } });
    }
    const anchor = [...group].sort((a, b) => a.pos.y - b.pos.y || a.pos.x - b.pos.x || a.id.localeCompare(b.id))[0];
    return arr.map(p => p.groupId !== gid ? p : {
      ...p, pos: {
        x: anchor.pos.x + (p.correct.x - anchor.correct.x),
        y: anchor.pos.y + (p.correct.y - anchor.correct.y),
      }
    });
  }

  // Try to snap group to board position
  function snapToBoardIfClose(arr: Piece[], gid: string, tol: number): { pieces: Piece[]; snapped: boolean; dx: number; dy: number } {
    const group = arr.filter(p => p.groupId === gid);
    if (!group.length) return { pieces: arr, snapped: false, dx: 0, dy: 0 };
    const dxs = group.map(p => p.correct.x - p.pos.x).sort((a, b) => a - b);
    const dys = group.map(p => p.correct.y - p.pos.y).sort((a, b) => a - b);
    const mid = Math.floor(group.length / 2);
    const dx = dxs[mid], dy = dys[mid];
    let maxErr = 0;
    for (const p of group) {
      maxErr = Math.max(maxErr, dist2(p.correct.x - p.pos.x - dx, p.correct.y - p.pos.y - dy));
    }
    if (maxErr > 1.5 || dist2(dx, dy) > tol) return { pieces: arr, snapped: false, dx: 0, dy: 0 };
    const moved = moveGroup(arr, gid, dx, dy);
    const result = moved.map(p => p.groupId !== gid ? p : { ...p, snapped: true, pos: { ...p.correct } });
    return { pieces: result, snapped: true, dx, dy };
  }

  // Merge neighbors that are close enough
  const snapMergeNeighbours = useCallback((arr: Piece[], gid: string, tol: number): Piece[] => {
    let next = arr; let changed = true;
    while (changed) {
      changed = false;
      const byId = new Map(next.map(p => [p.id, p]));
      for (const p of next.filter(pz => pz.groupId === gid)) {
        for (const [dr, dc] of [[-1,0],[0,1],[1,0],[0,-1]]) {
          const nr = p.row + dr, nc = p.col + dc;
          if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
          const nb = byId.get(`${nr}-${nc}`);
          // Tray-resident pieces carry pos === correct as an inert placeholder (they aren't
          // rendered or reachable on the board), which would otherwise look indistinguishable
          // from an actual correctly-placed neighbor below and get pulled onto the board.
          if (!nb || nb.groupId === gid || trayGroupSetRef.current.has(nb.groupId)) continue;
          const expected = { x: p.pos.x + (nb.correct.x - p.correct.x), y: p.pos.y + (nb.correct.y - p.correct.y) };
          if (dist2(nb.pos.x - expected.x, nb.pos.y - expected.y) <= tol) {
            next = moveGroup(next, nb.groupId, expected.x - nb.pos.x, expected.y - nb.pos.y);
            next = mergeInto(next, gid, nb.groupId);
            next = normaliseGroup(next, gid);
            changed = true; break;
          }
        }
        if (changed) break;
      }
    }
    return next;
  }, [rows, cols]);

  // ── Build starter pieces ─────────────────────────────────────────────────
  // Every piece starts tray-resident (no more scatter spawn) — pos is a placeholder until
  // the piece is dragged out of the tray onto the stage.

  function shuffledIds(rows: number, cols: number): string[] {
    const ids: string[] = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) ids.push(`${r}-${c}`);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    return ids;
  }

  const buildInitial = useCallback((
    edgesMap: Map<string, EdgeMap>,
  ): { pieces: Piece[]; trayOrder: string[] } => {
    const list: Piece[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const id = `${r}-${c}`;
        // correct positions are board-relative (board starts at boardOffX, boardOffY in stage space,
        // but we store all positions relative to the stage, i.e. boardOff + grid position).
        const correct = {
          x: boardOffXRef.current + c * pwRef.current,
          y: boardOffYRef.current + r * phRef.current,
        };
        list.push({
          id, row: r, col: c, edges: edgesMap.get(id)!,
          correct, pos: { ...correct },
          groupId: id, z: 1, snapped: false,
        });
      }
    }
    return { pieces: list, trayOrder: shuffledIds(rows, cols) };
  }, [rows, cols]);

  // ── Initialize / re-initialize ───────────────────────────────────────────

  const edgesMapRef = useRef<Map<string, EdgeMap>>(new Map());

  useEffect(() => {
    const edgesMap = buildEdges(rows, cols);
    edgesMapRef.current = edgesMap;
    rebuildCache(edgesMap);

    const key = getStorageKey(puzzleId, imageUrl, rows, cols);
    storageKeyRef.current = key;

    const initial = buildInitial(edgesMap);
    const saved   = loadJigsawProgress(key);
    let finalPieces: Piece[];
    let finalTray: string[];

    // saved.tray is only present in the tray-based save format — an older scatter-era save
    // (no tray field) is treated as incompatible and discarded rather than remapped, since
    // its positions assumed a scatter field that no longer exists.
    if (saved && saved.tray && Object.keys(saved.pieces).length === rows * cols) {
      savedElapsedRef.current = saved.elapsedMs ?? 0;
      startTimeRef.current = Date.now() - savedElapsedRef.current;
      finalPieces = applyProgress(initial.pieces, saved);
      finalTray = saved.tray;
      setResumed(true);
      setTimeout(() => setResumed(false), 3500);
    } else {
      savedElapsedRef.current = 0;
      startTimeRef.current = Date.now();
      finalPieces = initial.pieces;
      finalTray = initial.trayOrder;
    }

    setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startTimeRef.current) / 1000)));

    completedRef.current = false;
    frameFadeStartRef.current = null;
    piecesRef.current = finalPieces;
    setPiecesState(finalPieces);
    trayOrderRef.current = finalTray;
    trayGroupSetRef.current = new Set(finalTray);
    setTrayOrderState(finalTray);
    dirtyRef.current = true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, cols, imageUrl]);

  // ── Rebuild path cache when shape opts change (slider adjustments) ───────
  useEffect(() => {
    if (!edgesMapRef.current.size) return; // not yet initialized
    rebuildCache(edgesMapRef.current);
    dirtyRef.current = true;
  }, [rebuildCache]); // rebuildCache ref changes whenever pathOpts changes

  // ── Image loading ────────────────────────────────────────────────────────

  useEffect(() => {
    setEffectiveUrl(imageUrl ?? "");
    setImageOk(null);
    setProxyTried(false);
  }, [imageUrl]);

  useEffect(() => {
    if (!effectiveUrl) { setImageOk(false); return; }
    let cancelled = false;
    const img = new Image();
    // crossOrigin intentionally omitted: canvas taint is acceptable (no toDataURL/getImageData
    // calls), and omitting it lets R2/CDN images load without requiring CORS headers.
    img.onload = () => {
      if (cancelled) return;
      // Every piece draw stretches the source image to fill the piece grid (gridW × gridH,
      // aspect ratio cols:rows) — so for pieces to come out undistorted, the source needs
      // that same aspect ratio *before* it ever reaches a drawImage call. Source images are
      // authored 1:1 and grids are often close to square too, but whenever the two don't
      // already match exactly, center-crop here once, up front, rather than special-casing
      // every per-piece draw call (which would need to stretch non-uniformly to compensate —
      // exactly the distortion this avoids).
      const { naturalWidth: nw, naturalHeight: nh } = img;
      const targetAspect = cols / rows;
      const srcAspect = nw / nh;
      if (nw > 0 && nh > 0 && Math.abs(srcAspect - targetAspect) > 0.001) {
        const sw = srcAspect > targetAspect ? nh * targetAspect : nw;
        const sh = srcAspect > targetAspect ? nh : nw / targetAspect;
        const sx = (nw - sw) / 2;
        const sy = (nh - sh) / 2;
        const cropped = document.createElement("canvas");
        cropped.width = Math.round(sw);
        cropped.height = Math.round(sh);
        const cctx = cropped.getContext("2d");
        if (cctx) {
          cctx.drawImage(img, sx, sy, sw, sh, 0, 0, cropped.width, cropped.height);
          imgRef.current = cropped;
        } else {
          imgRef.current = img;
        }
      } else {
        imgRef.current = img;
      }
      setImageOk(true);
      dirtyRef.current = true;
    };
    img.onerror = () => {
      if (cancelled) return;
      // blob: URLs are local and can't be proxied — skip straight to failure
      if (!proxyTried && imageUrl && !effectiveUrl.startsWith("blob:")) {
        setProxyTried(true);
        setEffectiveUrl(`/api/image-proxy?url=${encodeURIComponent(imageUrl)}`);
      } else {
        imgRef.current = null;
        setImageOk(false);
        dirtyRef.current = true;
      }
    };
    // blob: URLs don't support query parameters — skip cache-busting for them
    const isBlob = effectiveUrl.startsWith("blob:");
    img.src = isBlob
      ? effectiveUrl
      : effectiveUrl + (effectiveUrl.includes("?") ? "&" : "?") + `_ck=${reloadKey}`;
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveUrl, reloadKey, proxyTried, cols, rows]);

  // Decorative completion-frame image — static asset, loaded once regardless of which
  // puzzle image is in play.
  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      frameImgRef.current = img;
      dirtyRef.current = true;
    };
    img.src = FRAME_IMG_URL;
    return () => { cancelled = true; };
  }, []);

  // ── Responsive canvas resize ─────────────────────────────────────────────

  useLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    // The stage (board + fixed margin) never changes size at runtime — only the CSS pixel
    // scale mapping it onto the screen does. That means, unlike the old scatter-era version
    // of this effect, there's no "stage resized, remap piece positions" step needed here:
    // logical positions stay valid across every resize, only scaleRef/canvas CSS size change.
    const { w: stageW, h: stageH } = stageDimsRef.current;

    const update = () => {
      const viewportW = Math.round(window.visualViewport?.width ?? window.innerWidth ?? window.screen.width ?? boardWidth);
      const viewportH = Math.round(window.visualViewport?.height ?? window.innerHeight ?? window.screen.height ?? boardHeight);
      const availW = Math.min(wrapper.clientWidth || boardWidth, viewportW);

      // Always the same portrait-style layout — a square board sized to fit whatever space
      // is available, with room reserved below it for the tray strip — regardless of device
      // orientation or fullscreen state.
      let boardSide: number;
      if (isFullscreen) {
        const availH = Math.max(160, viewportH - TRAY_H - 24);
        boardSide = Math.min(viewportW * 0.94, availH * 0.94);
      } else {
        const availH = Math.max(160, Math.min(viewportH * 0.7, viewportH - TRAY_H - 160));
        boardSide = Math.min(availW, availH);
      }

      const s = boardSide / boardWidth; // boardWidth === boardHeight (always square)
      scaleRef.current = s;

      const rw = Math.round(stageW * s);
      const rh = Math.round(stageH * s);
      setCanvasW(rw);
      setCanvasH(rh);
      const canvas = canvasRef.current;
      if (canvas) {
        const dpr           = window.devicePixelRatio || 1;
        canvas.width        = rw * dpr;
        canvas.height       = rh * dpr;
        canvas.style.width  = `${rw}px`;
        canvas.style.height = `${rh}px`;
        // Re-center viewport: when the stage fits inside the canvas (e.g. after zoom-out),
        // viewOff should be negative so the stage is centered rather than top-left.
        const totalS  = s * userZoomRef.current;
        const viewW2  = rw / totalS;
        const viewH2  = rh / totalS;
        viewOffXRef.current = stageW <= viewW2 ? (stageW - viewW2) / 2 : clamp(viewOffXRef.current, 0, stageW - viewW2);
        viewOffYRef.current = stageH <= viewH2 ? (stageH - viewH2) / 2 : clamp(viewOffYRef.current, 0, stageH - viewH2);
        dirtyRef.current    = true;
      }
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(wrapper);
    const onOrient = () => setTimeout(update, 150);
    // Coalesce rapid-fire resize events (e.g. mobile URL bar show/hide animation) into one
    // recompute per frame rather than reacting to every intermediate event.
    let resizeRaf = 0;
    const onResize = () => {
      if (resizeRaf) return;
      resizeRaf = requestAnimationFrame(() => { resizeRaf = 0; update(); });
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onOrient);
    return () => {
      ro.disconnect();
      if (resizeRaf) cancelAnimationFrame(resizeRaf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onOrient);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFullscreen, boardWidth, boardHeight]);

  // ── Auto-save (debounced) ────────────────────────────────────────────────

  useEffect(() => {
    if (completedRef.current || !storageKeyRef.current) return;
    const id = setTimeout(() => {
      if (!completedRef.current) {
        saveJigsawProgress(storageKeyRef.current, piecesRef.current, trayOrderRef.current, Math.max(0, Date.now() - startTimeRef.current));
      }
    }, 800);
    return () => clearTimeout(id);
  }, [pieces, trayOrder]);

  // ── Solved check ─────────────────────────────────────────────────────────

  const isSolved = useMemo(() => {
    if (!pieces.length) return false;
    if (trayOrder.length > 0) return false; // pieces still in the tray can't be "on the board"
    const g = pieces[0].groupId;
    return pieces.every(p => p.groupId === g) &&
           pieces.every(p => dist2(p.pos.x - p.correct.x, p.pos.y - p.correct.y) < 1);
  }, [pieces, trayOrder]);
  const isSolvedRef = useRef(false);
  isSolvedRef.current = isSolved;

  // Live stopwatch (no countdown): tracks elapsed time until solve.
  useEffect(() => {
    if (isSolved || completedRef.current) return;
    const tick = () => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startTimeRef.current) / 1000)));
    };
    tick();
    const intervalId = window.setInterval(tick, 1000);
    return () => window.clearInterval(intervalId);
  }, [isSolved, rows, cols, imageUrl, puzzleId, playPuzzleCompleteSfx]);

  // ── rAF render loop ──────────────────────────────────────────────────────

  useEffect(() => {
    const render = (now: number) => {
      rafRef.current = requestAnimationFrame(render);

      // Advance snap spring
      const snap = snapRef.current;
      if (snap) {
        const t = Math.min(1, (now - snap.t0) / snap.dur);
        // Ease-out-cubic front-loads ~90%+ of the motion into the first half of the
        // duration — for a small correction distance that reads as "already snapped" long
        // before the timer finishes, no matter how large dur is. Ease-in-out paces the
        // motion evenly across the whole duration instead, so a longer dur actually reads
        // as a slower glide throughout, not just a longer imperceptible tail.
        const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        // Recompute from the fixed starting offset (dx0/dy0) every frame — mutating dx/dy
        // in place by repeatedly multiplying it by (1-ease) compounds the decay across every
        // rendered frame (~60/sec), collapsing the offset to near-zero within a few frames
        // regardless of `dur`. That's why neither the duration bump nor the easing-curve
        // change actually changed the perceived snap speed: this bug made the glide finish
        // almost instantly every time, no matter what those values were set to.
        for (const off of snap.offsets.values()) {
          off.dx = off.dx0 * (1 - ease);
          off.dy = off.dy0 * (1 - ease);
        }
        if (t >= 1) snapRef.current = null;
        dirtyRef.current = true;
      }

      // Keep render loop alive while snap/glow/solve-scale animations are running
      lastFrameRef.current = now;
      if (snapPopRef.current.size > 0 || snapGlowRef.current.size > 0) dirtyRef.current = true;
      if (burstParticlesRef.current.length > 0) dirtyRef.current = true;
      if (solveScaleRef.current.size > 0) {
        let anyActive = false;
        for (const [id, anim] of solveScaleRef.current) {
          if ((now - anim.t0) < anim.dur) { anyActive = true; break; }
          else solveScaleRef.current.delete(id);
        }
        if (anyActive) dirtyRef.current = true;
      }

      if (!dirtyRef.current) return;
      dirtyRef.current = false;

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const W = canvas.width, H = canvas.height;
      const s = scaleRef.current * userZoomRef.current * dpr;
      // `s` bakes in devicePixelRatio, which is exactly right for scaling *positions* into the
      // canvas's (dpr-scaled) pixel buffer — but reusing it for line widths / shadow blur radii
      // / offsets means those shrink as dpr climbs (a "2 device px" stroke is a crisp 2 CSS px
      // line at dpr=1, but only 0.67 CSS px — sub-pixel, forced to anti-alias into a soft gray
      // smudge — at dpr=3). Desktops are commonly dpr=1 so this never showed up there; phones
      // are almost universally dpr=2–3, which is exactly the "fine on desktop, smudgy seams on
      // mobile" split. Anything sized for how it should look on screen (not for how it maps into
      // the pixel buffer) needs the dpr-*less* scale below instead.
      const sCss = scaleRef.current * userZoomRef.current;

      ctx.clearRect(0, 0, W, H);

      // Background
      const bgImg = document.getElementById("jigsaw-table-bg") as HTMLImageElement | null;
      if (tableBackground && bgImg?.complete && bgImg.naturalWidth > 0) {
        ctx.drawImage(bgImg, 0, 0, W, H);
      } else {
        ctx.fillStyle = "#000000";
        ctx.fillRect(0, 0, W, H);
      }

      ctx.save();
      ctx.scale(s, s);   // from here: 1 unit = 1 stage logical px
      ctx.translate(-viewOffXRef.current, -viewOffYRef.current); // apply viewport offset

      const _pw = pwRef.current, _ph = phRef.current;
      const _bOffX = boardOffXRef.current, _bOffY = boardOffYRef.current;
      const solved = isSolvedRef.current;

      // Stage frame — a visible border around the full stage bounds, which is always a perfect
      // square (boardWidth === boardHeight, guaranteed by useJigsawBoardDims). The board rect
      // drawn below it can be narrower than the stage when the grid itself isn't square (e.g.
      // more columns than rows) — it's deliberately letterboxed rather than stretched, to keep
      // every piece a true square. Without this frame, that letterboxed margin was invisible
      // (near-identical dark fill colors on both), so the square shape of the overall play area
      // didn't read as square at all — it just looked like whatever aspect ratio the grid rect
      // happened to be.
      if (!solved) {
        const { w: stageW, h: stageH } = stageDimsRef.current;
        ctx.strokeStyle = "rgba(255,255,255,0.14)";
        ctx.lineWidth = 1.5 / sCss;
        ctx.strokeRect(0.75 / sCss, 0.75 / sCss, stageW - 1.5 / sCss, stageH - 1.5 / sCss);
      }

      // Board area background + faint reference image. Rounded with the exact same corner
      // radius the four corner pieces cut into their own outer corner (pathOpts.cornerInset) —
      // a plain sharp-cornered rect here left a visible sliver of exposed background poking out
      // past each corner piece's rounded cut.
      if (!solved) {
        const boardRectPath = roundedRectPath(_bOffX, _bOffY, gridW, gridH, pathOpts.cornerInset ?? 0);
        ctx.fillStyle = "#111111";
        ctx.fill(boardRectPath);
        // Board border
        ctx.strokeStyle = "rgba(255,255,255,0.22)";
        ctx.lineWidth = 1.5 / sCss;
        ctx.stroke(boardRectPath);
      }

      // Sort: z-order, dragging group on top. Cached — the relative order only changes when
      // the pieces array is replaced or the active drag group changes, not every frame.
      const drag = dragRef.current;
      const ag   = drag.active ? drag.groupId : null;
      const sortCache = sortedCacheRef.current;
      let sorted: Piece[];
      if (sortCache && sortCache.pieces === piecesRef.current && sortCache.ag === ag) {
        sorted = sortCache.sorted;
      } else {
        sorted = [...piecesRef.current].sort((a, b) => {
          const da = ag && a.groupId === ag ? 1 : 0;
          const db = ag && b.groupId === ag ? 1 : 0;
          return (da - db) || (a.z - b.z);
        });
        sortedCacheRef.current = { pieces: piecesRef.current, ag, sorted };
      }

      // Visible-viewport bounds (stage-logical space, with a small margin) — pieces fully
      // outside this rect are skipped entirely rather than paying for shadow/clip/bevel/etc.
      // Large scattered puzzles can have most of the board off-screen at any given pan/zoom,
      // so this matters a lot more as piece count grows.
      const viewW = W / s;
      const viewH = H / s;
      const cullPad = Math.max(_pw, _ph) * 0.3;
      const viewL = viewOffXRef.current - cullPad;
      const viewT = viewOffYRef.current - cullPad;
      const viewR = viewOffXRef.current + viewW + cullPad;
      const viewB = viewOffYRef.current + viewH + cullPad;

      for (const p of sorted) {
        if (trayGroupSetRef.current.has(p.groupId)) continue; // rendered in the tray strip instead
        if (drag.active && drag.ghosting && p.groupId === drag.groupId) continue; // rendered as a floating DOM ghost over the tray instead
        const path = pathCacheRef.current.get(p.id);
        if (!path) continue;

        const dragging = ag !== null && p.groupId === ag;
        // p.pos is in stage space (includes boardOff); Path2D starts at (0,0) in piece-local space
        let px = p.pos.x, py = p.pos.y;
        if (dragging) { px += drag.dx; py += drag.dy; }
        const snapOff = snapRef.current?.offsets.get(p.id);
        if (snapOff) {
          px += snapOff.dx; py += snapOff.dy;
        }

        if (px + _pw < viewL || px > viewR || py + _ph < viewT || py > viewB) continue;

        ctx.save();
        ctx.translate(px, py);

        // Snap-pop spring
        const snapPop = snapPopRef.current.get(p.id);
        if (snapPop) {
          const pt = Math.min(1, (now - snapPop.t0) / snapPop.dur);
          if (pt >= 1) snapPopRef.current.delete(p.id);
          else {
            const fxScale = 1 + 0.09 * Math.sin(pt * Math.PI);
            ctx.translate(_pw / 2, _ph / 2);
            ctx.scale(fxScale, fxScale);
            ctx.translate(-_pw / 2, -_ph / 2);
          }
        }

        // Solve pop — per-piece random delay + scale
        const solvePop = solveScaleRef.current.get(p.id);
        if (solvePop) {
          const st = (now - solvePop.t0) / solvePop.dur;
          if (st >= 0 && st < 1) {
            const fxScale = 1 + solvePop.peak * Math.sin(st * Math.PI);
            ctx.translate(_pw / 2, _ph / 2);
            ctx.scale(fxScale, fxScale);
            ctx.translate(-_pw / 2, -_ph / 2);
          } else if (st >= 1) {
            solveScaleRef.current.delete(p.id);
          }
        }

        // Drop shadow. shadowBlur is one of the most expensive Canvas2D operations, and the
        // whole canvas redraws every frame regardless of which piece is actually moving — so
        // blurring dozens of static pieces every frame (as an earlier version of this did)
        // tanked drag performance. Only the actively-dragged piece (just one at a time) gets
        // a real blurred shadow; every other piece gets a cheap hard-edged shadow instead —
        // a plain solid offset fill, no blur math at all — which still reads as "lifted off
        // the table" at this scale for a fraction of the cost.
        if (dragging) {
          ctx.shadowColor = "rgba(0,0,0,0.45)";
          ctx.shadowBlur  = 16 / sCss;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 9 / sCss;
        } else {
          ctx.save();
          ctx.translate(0, (p.snapped ? 4 : 3) / sCss);
          ctx.fillStyle = p.snapped ? "rgba(0,0,0,0.30)" : "rgba(0,0,0,0.24)";
          ctx.fill(path);
          ctx.restore();
        }

        // Clip + image
        // Each piece (row, col) must show slice [col*pw..(col+1)*pw, row*ph..(row+1)*ph] of the
        // image, regardless of its current position in the stage.  Drawing the full image at
        // (-col*pw, -row*ph) in piece-local space (after translate(px,py)) achieves exactly that.
        const imgX = -(p.col * _pw);
        const imgY = -(p.row * _ph);
        ctx.save();
        ctx.clip(path);
        if (imageOk && imgRef.current) {
          ctx.drawImage(imgRef.current, imgX, imgY, gridW, gridH);
        } else {
          const hue = ((p.row * cols + p.col) / (rows * cols)) * 360;
          ctx.fillStyle = `hsl(${hue},38%,28%)`;
          ctx.fill(path); // fill(path) covers tab protrusions; fillRect(0,0,pw,ph) would miss them
        }
        // Highlight sweep
        ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
        const hl = ctx.createLinearGradient(0, 0, _pw, _ph);
        hl.addColorStop(0, `rgba(255,255,255,${dragging ? 0.13 : 0.05})`);
        hl.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = hl;
        ctx.fill(path); // same: fill(path) covers tabs

        // Inner bevel — a light rim along the top-left-facing edge and a dark rim along the
        // bottom-right-facing edge, both within the same clip already active above (reusing it
        // instead of a second ctx.clip() call, which isn't free either). Cheap emboss trick:
        // stroke the same path twice, offset a hair in complementary directions — clipping cuts
        // off everything except the sliver just inside each edge, so it reads as a raised,
        // chiseled border without needing per-edge normal math for the tabs.
        //
        // Applied to every piece, placed or not — a real (or stylized) jigsaw piece stays
        // visibly embossed once connected; every seam is a highlight/shadow pair giving it
        // dimension, not a flat cut line drawn over the photo. Each piece only ever draws the
        // rim on ITS OWN inside edge, so a shared seam between two placed pieces naturally shows
        // both halves of the pair (one piece's dark rim, the other's light rim either side of
        // the seam) — that reads as one embossed groove with real depth, not "doubled" lines, as
        // long as the two rims sit close enough together to read as a pair rather than two
        // independent lines (hence the fairly tight bevelPx offset below).
        const isPlaced = p.snapped || solved;
        const bevelPx = 1.3 / sCss;
        ctx.translate(bevelPx, bevelPx);
        ctx.strokeStyle = "rgba(255,255,255,0.55)";
        ctx.lineWidth = 1.9 / sCss;
        ctx.stroke(path);
        ctx.translate(-bevelPx * 2, -bevelPx * 2);
        ctx.strokeStyle = "rgba(0,0,0,0.42)";
        ctx.lineWidth = 2.3 / sCss;
        ctx.stroke(path);
        ctx.restore();

        // Outline — a moderate seam line right at the true edge, on top of the bevel pair above,
        // giving the groove a crisp center line instead of just two soft rims either side of a
        // gap. Snapped/solved pieces use a dark seam (reads as a recessed groove between
        // connected pieces) rather than a light one — a bright outline on an already-placed
        // piece read as a stray highlight rather than a seam.
        ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
        ctx.strokeStyle = isPlaced
          ? "rgba(0,0,0,0.3)"
          : dragging ? "rgba(255,255,255,0.65)" : "rgba(255,255,255,0.30)";
        ctx.lineWidth = dragging ? 1.6 / sCss : isPlaced ? 1 / sCss : 1 / sCss;
        ctx.stroke(path);

        // Snap glow — gold outline eases in and out on board placement
        const snapGlow = snapGlowRef.current.get(p.id);
        if (snapGlow) {
          const gt = Math.min(1, (now - snapGlow.t0) / snapGlow.dur);
          if (gt >= 1) {
            snapGlowRef.current.delete(p.id);
          } else {
            const glowAlpha = Math.sin(gt * Math.PI);
            ctx.shadowColor = `rgba(255,200,50,${glowAlpha * 0.85})`;
            ctx.shadowBlur  = 14 / sCss;
            ctx.strokeStyle = `rgba(255,215,0,${glowAlpha * 0.80})`;
            ctx.lineWidth   = 2 / sCss;
            ctx.stroke(path);
            ctx.shadowBlur  = 0;
            ctx.shadowColor = "transparent";
          }
        }

        ctx.restore();
      }

      // Decorative frame around the completed image — drawn on top of every piece once
      // solved, turning the finished board into a "framed picture" rather than just
      // stopping at plain assembled tiles. Uses an actual designed frame asset (a hand-tried
      // canvas-drawn gradient version didn't read as a real bevel), stretched so its
      // transparent "hole" (see FRAME_HOLE) lines up exactly with the board rect — whatever
      // border/padding the source image has around that hole just extends outward from
      // there, so it works regardless of the board's own aspect ratio.
      // Fades in — see frameFadeStartRef — timed to when the living-photo reveal overlay
      // (which fully covers the board while playing) itself dissolves away.
      if (solved && frameFadeStartRef.current !== null && frameImgRef.current) {
        const fadeT = Math.min(1, (now - frameFadeStartRef.current) / FRAME_FADE_DUR);
        // Ease-out-quad front-loads most of the fade into the first half of FRAME_FADE_DUR,
        // same problem diagnosed for the snap glide — the frame looked "already faded in"
        // well before the timer finished. Ease-in-out-quad paces it evenly across the whole
        // duration so a longer FRAME_FADE_DUR actually reads as slower throughout.
        const frameAlpha = fadeT < 0.5 ? 2 * fadeT * fadeT : 1 - Math.pow(-2 * fadeT + 2, 2) / 2;
        if (frameAlpha > 0) {
          const frameImg = frameImgRef.current;
          const holeW = FRAME_HOLE.right - FRAME_HOLE.left;
          const holeH = FRAME_HOLE.bottom - FRAME_HOLE.top;
          const scaleX = gridW / (frameImg.naturalWidth * holeW);
          const scaleY = gridH / (frameImg.naturalHeight * holeH);
          let drawW = frameImg.naturalWidth * scaleX;
          let drawH = frameImg.naturalHeight * scaleY;
          let drawX = _bOffX - FRAME_HOLE.left * frameImg.naturalWidth * scaleX;
          let drawY = _bOffY - FRAME_HOLE.top * frameImg.naturalHeight * scaleY;

          // The frame's own border extends past the hole (and so past the board) by design —
          // that's what shows as the actual frame. STAGE_MARGIN (the space reserved around the
          // board) is sized for piece tab overflow, not for this, so a wide or tall grid can
          // easily ask for more overhang than that margin provides, clipping the frame at the
          // canvas edge. Shrink the whole frame uniformly (preserving its own proportions, and
          // its center on the board) to fit within the stage bounds if it would otherwise
          // overhang past them, rather than letting it get cut off.
          const { w: stageW, h: stageH } = stageDimsRef.current;
          const shrink = Math.min(1, stageW / drawW, stageH / drawH);
          if (shrink < 1) {
            const cx = _bOffX + gridW / 2, cy = _bOffY + gridH / 2;
            drawX = cx - (cx - drawX) * shrink;
            drawY = cy - (cy - drawY) * shrink;
            drawW *= shrink;
            drawH *= shrink;
          }

          ctx.save();
          ctx.globalAlpha = frameAlpha;
          ctx.drawImage(frameImg, drawX, drawY, drawW, drawH);
          ctx.restore();
        }
        if (fadeT < 1) dirtyRef.current = true;
      }

      // Piece-placement particle burst — drawn on top of all pieces, still in stage space
      if (burstParticlesRef.current.length > 0) {
        const kept: BurstParticle[] = [];
        for (const particle of burstParticlesRef.current) {
          const t = (now - particle.t0) / particle.dur;
          if (t >= 1) continue;
          kept.push(particle);

          const ease = 1 - Math.pow(1 - t, 2);
          const px = particle.x0 + Math.cos(particle.angle) * particle.dist * ease;
          const py = particle.y0 + Math.sin(particle.angle) * particle.dist * ease;
          const alpha = 1 - t * t;
          const size = particle.size * (1 - t * 0.35);

          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.fillStyle = particle.color;
          ctx.shadowColor = particle.color;
          ctx.shadowBlur = 6 / sCss;

          if (particle.kind === "star") {
            drawStar4(ctx, px, py, size, particle.rot0 + particle.rotSpeed * t);
            ctx.fill();
          } else {
            ctx.beginPath();
            ctx.arc(px, py, size, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }
        burstParticlesRef.current = kept;
      }

      ctx.restore(); // undo scale
    };

    rafRef.current = requestAnimationFrame(render);
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
  }, [boardWidth, boardHeight, gridW, gridH, rows, cols, imageOk, tableBackground, pathOpts]);

  useEffect(() => { dirtyRef.current = true; }, [imageOk, pieces]);

  // ── Hit testing ──────────────────────────────────────────────────────────

  const hitTest = useCallback((lx: number, ly: number): Piece | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const drag = dragRef.current;
    const ag   = drag.active ? drag.groupId : null;
    const sorted = [...piecesRef.current].sort((a, b) => {
      const da = ag && a.groupId === ag ? 1 : 0;
      const db = ag && b.groupId === ag ? 1 : 0;
      return (db - da) || (b.z - a.z);
    });
    for (const p of sorted) {
      if (p.snapped) continue;
      if (trayGroupSetRef.current.has(p.groupId)) continue; // lives in the tray, not on the board
      const path = pathCacheRef.current.get(p.id);
      if (!path) continue;
      let px = p.pos.x, py = p.pos.y;
      const snapOff = snapRef.current?.offsets.get(p.id);
      if (snapOff) {
        px += snapOff.dx; py += snapOff.dy;
      }
      // lx/ly are in stage logical space; piece path is in piece-local space (0,0 at piece origin)
      if (ctx.isPointInPath(path, lx - px, ly - py)) return p;
    }
    return null;
  }, []);

  // ── Client → logical canvas coords ──────────────────────────────────────

  // Clamp viewport so the stage can never be panned beyond its edges.
  const clampViewport = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const s    = scaleRef.current * userZoomRef.current;
    const dpr  = window.devicePixelRatio || 1;
    const viewW = canvas.width  / (s * dpr);
    const viewH = canvas.height / (s * dpr);
    const { w: stageW, h: stageH } = stageDimsRef.current;
    // When the stage fits inside the viewport (zoomed out), center it; otherwise pan-clamp.
    viewOffXRef.current = stageW <= viewW
      ? (stageW - viewW) / 2
      : clamp(viewOffXRef.current, 0, stageW - viewW);
    viewOffYRef.current = stageH <= viewH
      ? (stageH - viewH) / 2
      : clamp(viewOffYRef.current, 0, stageH - viewH);
  }, []);

  const applyZoom = useCallback((factor: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect     = canvas.getBoundingClientRect();
    const centerX  = rect.width  / 2;
    const centerY  = rect.height / 2;
    const s        = scaleRef.current;
    const oldZoom  = userZoomRef.current;
    const newZoom  = clamp(oldZoom * factor, MIN_ZOOM, MAX_ZOOM);
    // Keep canvas center fixed in stage coords
    const midStageX = centerX / (s * oldZoom) + viewOffXRef.current;
    const midStageY = centerY / (s * oldZoom) + viewOffYRef.current;
    userZoomRef.current  = newZoom;
    viewOffXRef.current  = midStageX - centerX / (s * newZoom);
    viewOffYRef.current  = midStageY - centerY / (s * newZoom);
    clampViewport();
    // When returning to or above 100%, pull any out-of-stage pieces back into stage
    if (newZoom >= 1) {
      const { w: sw, h: sh } = stageDimsRef.current;
      const _pw = pwRef.current, _ph = phRef.current;
      const clamped = piecesRef.current.map(p => {
        if (p.snapped) return p;
        const nx = clamp(p.pos.x, 0, sw - _pw);
        const ny = clamp(p.pos.y, 0, sh - _ph);
        return (nx === p.pos.x && ny === p.pos.y) ? p : { ...p, pos: { x: nx, y: ny } };
      });
      piecesRef.current = clamped;
      setPiecesState(clamped);
    }
    setUserZoom(newZoom);
    dirtyRef.current = true;
  }, [clampViewport]);

  const resetZoom = useCallback(() => {
    userZoomRef.current = 1;
    viewOffXRef.current = 0;
    viewOffYRef.current = 0;
    // Pull any out-of-stage pieces (placed while zoomed out) back into stage
    const { w: sw, h: sh } = stageDimsRef.current;
    const _pw = pwRef.current, _ph = phRef.current;
    const clamped = piecesRef.current.map(p => {
      if (p.snapped) return p;
      const nx = clamp(p.pos.x, 0, sw - _pw);
      const ny = clamp(p.pos.y, 0, sh - _ph);
      return (nx === p.pos.x && ny === p.pos.y) ? p : { ...p, pos: { x: nx, y: ny } };
    });
    piecesRef.current = clamped;
    setPiecesState(clamped);
    setUserZoom(1);
    dirtyRef.current = true;
  }, []);

  const clientToLogical = useCallback((cx: number, cy: number): PiecePos => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: cx, y: cy };
    const rect = canvas.getBoundingClientRect();
    const s = scaleRef.current * userZoomRef.current;
    return {
      x: (cx - rect.left) / s + viewOffXRef.current,
      y: (cy - rect.top)  / s + viewOffYRef.current,
    };
  }, []);

  // ── Tray drag-ghost helpers ───────────────────────────────────────────────
  // The ghost's *content* is always drawn once, at board scale (the biggest it'll ever need to
  // be for this drag) — shrinking it toward tray scale is a CSS `scale()` on the canvas element,
  // not a redraw. The size is a discrete on-canvas-vs-on-tray state, not something driven by how
  // far the pointer has moved: crossing the board canvas's edge flips the target size, and a CSS
  // transition animates smoothly between the two fixed sizes over a fixed duration — the piece
  // doesn't start resizing until it actually crosses the boundary, and further pointer movement
  // past that point doesn't change how big it is.
  const GHOST_TRANSITION_MS = 200;
  // Pending "finish growing back to board scale, then hand off to canvas rendering" timer —
  // rather than cutting to canvas rendering the instant the boundary is crossed, the grow
  // animation is allowed to finish first so the size change reads as one continuous motion.
  const ghostHandoffTimerRef = useRef<number | null>(null);

  const applyGhostScale = useCallback((toTray: boolean) => {
    const board = ghostBoardSizeRef.current;
    const tray = ghostTraySizeRef.current;
    const canvas = ghostCanvasRef.current;
    if (!canvas || !board.w) return;
    canvas.style.transform = `scale(${toTray ? tray.w / board.w : 1})`;
  }, []);

  // Screen-space Y of the board's own visible bottom edge — deliberately NOT the canvas
  // element's own bounding rect. The canvas is sized to the full *stage* (board + STAGE_MARGIN
  // buffer on every side, for tab overflow and for resting a loose piece just off the board),
  // which extends further down than where the board visually appears to end. Gating the
  // ghost/tray transition on the canvas element's true edge meant a piece dragged toward the
  // tray kept getting clamped to the (still visually "on the canvas") margin strip below the
  // board — reading as stuck at a wall for that whole buffer before finally popping free right
  // at the tray. Using the board's actual rendered edge instead removes that dead zone.
  const getBoardBottomClientY = useCallback((): number | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const totalS = scaleRef.current * userZoomRef.current;
    const boardBottomStage = boardOffYRef.current + gridH;
    return rect.top + (boardBottomStage - viewOffYRef.current) * totalS;
  }, [gridH]);

  // Draws the ghost's content (once, at board scale) and positions its wrapper, centered at
  // (clientX, clientY) using the wrapper's fixed board-scale footprint — the visible piece is
  // then scaled *inside* that footprint via applyGhostScale, which (with the canvas's default
  // center transform-origin) stays centered on the pointer without the wrapper itself moving.
  // `startAtTraySize` controls whether the very first paint shows tray scale immediately (no
  // animation — used when picking a piece up directly out of the tray, since it's already
  // sitting at that size) or board scale (used when a board piece first crosses out over the
  // tray, matching what it looked like a frame ago; the caller animates the shrink afterward).
  const showGhostFor = useCallback((groupId: string, clientX: number, clientY: number, startAtTraySize: boolean) => {
    const members = piecesRef.current.filter(p => p.groupId === groupId);
    if (!members.length) return;
    const boardCellPx = pwRef.current * scaleRef.current * userZoomRef.current;
    const boardSize = computeThumbSize(members, pwRef.current, phRef.current, boardCellPx);
    const traySize  = computeThumbSize(members, pwRef.current, phRef.current, trayCellPx);
    ghostBoardSizeRef.current = boardSize;
    ghostTraySizeRef.current = traySize;
    if (ghostCanvasRef.current) {
      drawTrayThumbnail(
        ghostCanvasRef.current, members, pwRef.current, phRef.current, pathCacheRef.current,
        imageOk ? imgRef.current : null, gridW, gridH, rows, cols, boardCellPx,
      );
    }
    const wrapper = ghostWrapperRef.current;
    if (wrapper) {
      wrapper.style.width  = `${boardSize.w}px`;
      wrapper.style.height = `${boardSize.h}px`;
      wrapper.style.transform = `translate(${clientX - boardSize.w / 2}px, ${clientY - boardSize.h / 2}px)`;
    }
    applyGhostScale(startAtTraySize);
    setGhostGroupId(groupId);
  }, [imageOk, gridW, gridH, rows, cols, trayCellPx, applyGhostScale]);

  // Repositions an already-shown ghost every pointermove tick — position only, no
  // size/content recompute, kept out of React state entirely for smooth 60fps tracking.
  const moveGhost = useCallback((clientX: number, clientY: number) => {
    const wrapper = ghostWrapperRef.current;
    const { w, h } = ghostBoardSizeRef.current;
    if (wrapper) wrapper.style.transform = `translate(${clientX - w / 2}px, ${clientY - h / 2}px)`;
  }, []);

  const hideGhost = useCallback(() => {
    if (ghostHandoffTimerRef.current !== null) {
      clearTimeout(ghostHandoffTimerRef.current);
      ghostHandoffTimerRef.current = null;
    }
    setGhostGroupId(null);
    setTrayInsertIndex(null);
    wasOverTrayRef.current = false;
  }, [setTrayInsertIndex]);

  // Snapshot every tray item's midpoint once, at the moment the ghost enters the tray zone —
  // NOT re-measured on every recompute, because items shift sideways (CSS transform) once a
  // gap preview opens, and getBoundingClientRect() reports that *post-shift* position. Reading
  // live rects while also applying the shift they cause created a feedback loop where the
  // computed insertion index no longer matched what the gap preview actually showed, so the
  // piece could land somewhere other than where it looked like it would on release. The
  // underlying layout doesn't change during a single hover (no other piece is added/removed
  // while this one is being dragged), so one snapshot per hover-entry stays valid throughout.
  const trayBaseLayoutRef = useRef<Map<string, number>>(new Map());
  const snapshotTrayLayout = useCallback(() => {
    const mids = new Map<string, number>();
    for (const [id, node] of trayItemNodesRef.current) {
      const rect = node.getBoundingClientRect();
      mids.set(id, rect.left + rect.width / 2);
    }
    trayBaseLayoutRef.current = mids;
  }, []);

  const computeTrayInsertIndex = useCallback((centerX: number): number => {
    const order = trayOrderRef.current;
    const mids = trayBaseLayoutRef.current;
    for (let i = 0; i < order.length; i++) {
      const mid = mids.get(order[i]);
      if (mid === undefined) continue;
      if (centerX < mid) return i;
    }
    return order.length;
  }, []);

  // ── Lift a group out of the tray onto the board ──────────────────────────
  // Sets up dragRef exactly like onPointerDown does for a freshly-grabbed on-stage piece,
  // then hands the pointer off to the main canvas via Pointer Capture — every subsequent
  // pointermove/pointerup for this pointer id fires on the canvas element from here on, so
  // the existing (unmodified) onPointerMove/onPointerUp handlers take over the drag.
  const beginDragFromTray = useCallback((groupId: string, e: React.PointerEvent<HTMLCanvasElement>) => {
    if (completedRef.current || isSolvedRef.current) return;
    e.preventDefault();

    const members = piecesRef.current.filter(p => p.groupId === groupId);
    if (!members.length) return;

    const lp = clientToLogical(e.clientX, e.clientY);
    const _pw = pwRef.current, _ph = phRef.current;
    const minRow = Math.min(...members.map(m => m.row));
    const minCol = Math.min(...members.map(m => m.col));
    const maxRow = Math.max(...members.map(m => m.row));
    const maxCol = Math.max(...members.map(m => m.col));
    const groupW = (maxCol - minCol + 1) * _pw;
    const groupH = (maxRow - minRow + 1) * _ph;

    // Deliberately NOT clamped to the stage bounds: the pointer is physically in the tray at
    // pickup time, well outside the stage, so clamping here would peg the piece's logical
    // starting position to the stage edge instead of "centered under the pointer" — a baseline
    // error that has no visible effect while ghosted (the DOM ghost ignores this value and just
    // follows the raw pointer), but resurfaces the instant the piece hands off to canvas
    // rendering, as a jump to wherever that wrong baseline says it should be.
    const originX = lp.x - groupW / 2;
    const originY = lp.y - groupH / 2;

    const positions = new Map<string, PiecePos>();
    for (const m of members) {
      positions.set(m.id, { x: originX + (m.col - minCol) * _pw, y: originY + (m.row - minRow) * _ph });
    }
    const anchor = members.find(m => m.row === minRow && m.col === minCol) ?? members[0];
    const anchorPos = positions.get(anchor.id)!;

    setTrayOrder(prev => prev.filter(id => id !== groupId));
    setPieces(prev => prev.map(p => {
      const pos = positions.get(p.id);
      return pos ? { ...p, pos } : p;
    }));

    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { canvasRef.current?.setPointerCapture(e.pointerId); } catch { /* noop */ }

    dragRef.current = {
      active: true, pointerId: e.pointerId,
      groupId, anchorId: anchor.id,
      anchorOff: { x: lp.x - anchorPos.x, y: lp.y - anchorPos.y },
      starts: positions, dx: 0, dy: 0,
      ghosting: true, // picked up from the tray — it's already sitting there, so it lifts as a ghost from the start
    };
    // startAtTraySize=true: it's already sitting in the tray, so it lifts at tray size with no
    // animation — the grow-to-board-size animation only happens later, if/when it's dragged up
    // across the board canvas's edge.
    showGhostFor(groupId, e.clientX, e.clientY, true);
    // Picked up directly from the tray, so it's already hovering it — snapshot now (see
    // snapshotTrayLayout) and show the initial gap preview immediately, same as crossing into
    // the tray mid-drag would.
    wasOverTrayRef.current = true;
    snapshotTrayLayout();
    setTrayInsertIndex(computeTrayInsertIndex(e.clientX));
    dirtyRef.current = true;
  }, [clientToLogical, setPieces, setTrayOrder, showGhostFor, setTrayInsertIndex, snapshotTrayLayout, computeTrayInsertIndex]);

  // ── Canvas pointer handlers ──────────────────────────────────────────────

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (completedRef.current || isSolvedRef.current) return;

    // Track all active pointers
    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    e.currentTarget.setPointerCapture(e.pointerId);

    const ptrs = activePointersRef.current;

    // Two fingers → pinch-zoom + pan; cancel any ongoing piece drag or pan
    if (ptrs.size >= 2) {
      if (dragRef.current.active) {
        dragRef.current.active = false;
        dragRef.current.pointerId = null;
        dragRef.current.groupId = null;
        dragRef.current.dx = 0;
        dragRef.current.dy = 0;
        dragRef.current.ghosting = false;
        hideGhost();
      }
      panGestureRef.current.active = false;
      const vals = [...ptrs.values()];
      const midX = (vals[0].x + vals[1].x) / 2;
      const midY = (vals[0].y + vals[1].y) / 2;
      const dist = Math.max(Math.hypot(vals[1].x - vals[0].x, vals[1].y - vals[0].y), 1);
      pinchGestureRef.current = { active: true, prevMidX: midX, prevMidY: midY, prevDist: dist };
      return;
    }

    // One finger — check for piece hit first
    const lp  = clientToLogical(e.clientX, e.clientY);
    const hit = hitTest(lp.x, lp.y);

    if (!hit) {
      // No piece hit → single-finger pan
      panGestureRef.current = { active: true, pointerId: e.pointerId, lastX: e.clientX, lastY: e.clientY };
      return;
    }

    e.stopPropagation();

    const group = piecesRef.current.filter(p => p.groupId === hit.groupId);
    if (group.some(p => p.snapped)) return;

    // z-order is handled by dragRef during drag; committed on pointerUp — no React re-render here
    const starts = new Map<string, PiecePos>();
    for (const p of group) starts.set(p.id, { ...p.pos });

    dragRef.current = {
      active: true, pointerId: e.pointerId,
      groupId: hit.groupId, anchorId: hit.id,
      anchorOff: { x: lp.x - hit.pos.x, y: lp.y - hit.pos.y },
      starts, dx: 0, dy: 0,
      ghosting: false, // grabbed from the board — starts in normal on-canvas drag mode
    };
    dirtyRef.current = true;
  }, [clientToLogical, hitTest, clampViewport, hideGhost]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    // Update tracked pointer position
    if (activePointersRef.current.has(e.pointerId)) {
      activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    // ── Pinch gesture ────────────────────────────────────────────────────
    const pinch = pinchGestureRef.current;
    const ptrs  = activePointersRef.current;
    if (pinch.active && ptrs.size >= 2) {
      const vals  = [...ptrs.values()];
      const midX  = (vals[0].x + vals[1].x) / 2;
      const midY  = (vals[0].y + vals[1].y) / 2;
      const dist  = Math.max(Math.hypot(vals[1].x - vals[0].x, vals[1].y - vals[0].y), 1);
      const zoomDelta = dist / pinch.prevDist;
      const newZoom   = clamp(userZoomRef.current * zoomDelta, MIN_ZOOM, MAX_ZOOM);
      const canvas    = canvasRef.current;
      if (canvas) {
        const rect     = canvas.getBoundingClientRect();
        const s        = scaleRef.current;
        // Stage coords under the previous midpoint must stay fixed after zoom
        const midStageX = (pinch.prevMidX - rect.left) / (s * userZoomRef.current) + viewOffXRef.current;
        const midStageY = (pinch.prevMidY - rect.top)  / (s * userZoomRef.current) + viewOffYRef.current;
        userZoomRef.current = newZoom;
        viewOffXRef.current = midStageX - (midX - rect.left) / (s * newZoom);
        viewOffYRef.current = midStageY - (midY - rect.top)  / (s * newZoom);
        clampViewport();
      }
      pinch.prevMidX = midX;
      pinch.prevMidY = midY;
      pinch.prevDist = dist;
      dirtyRef.current = true;
      return;
    }

    // ── Single-finger pan ────────────────────────────────────────────────
    const pan = panGestureRef.current;
    if (pan.active && pan.pointerId === e.pointerId) {
      const s  = scaleRef.current * userZoomRef.current;
      const dx = (e.clientX - pan.lastX) / s;
      const dy = (e.clientY - pan.lastY) / s;
      viewOffXRef.current -= dx;
      viewOffYRef.current -= dy;
      clampViewport();
      pan.lastX = e.clientX;
      pan.lastY = e.clientY;
      dirtyRef.current = true;
      return;
    }

    // ── Piece drag ───────────────────────────────────────────────────────
    const drag = dragRef.current;
    if (!drag.active || e.pointerId !== drag.pointerId) return;
    const lp   = clientToLogical(e.clientX, e.clientY);
    const aStart = drag.starts.get(drag.anchorId!);
    if (!aStart) return;

    const rawDx = lp.x - drag.anchorOff.x - aStart.x;
    const rawDy = lp.y - drag.anchorOff.y - aStart.y;

    const _pw = pwRef.current, _ph = phRef.current;

    // ── Tray hover ───────────────────────────────────────────────────────
    // Computed BEFORE the viewport clamp below, so a ghosting transition on this exact tick is
    // already reflected when dx/dy get computed this same tick — no one-tick lag/inconsistency
    // between "just started/stopped ghosting" and "how the position gets clamped".
    //
    // Two separate thresholds, not one:
    //  - "ghosting" (detach from the board into a floating thumbnail) triggers the instant the
    //    pointer passes the board's own visible bottom edge — NOT the canvas element's bounding
    //    rect, which is sized to the full *stage* (board + a STAGE_MARGIN buffer around every
    //    side, for tab overflow / resting a loose piece just off the board) and so extends
    //    further down than the board visually appears to. Gating on the canvas element's true
    //    edge left that whole margin strip reading as "still on the canvas" — the piece stayed
    //    clamped there, looking stuck at a wall, until the pointer reached all the way down to
    //    the tray itself.
    //  - "over tray" (drives the reorder-gap preview and whether a release lands in the tray at
    //    all) still specifically means "over the tray strip's own rect".
    // The size itself is a discrete on-canvas-vs-off-canvas state (see the "Tray drag-ghost
    // helpers" block above) — crossing this line flips the target size once, animated by a CSS
    // transition, rather than continuously resizing along with further pointer movement.
    const boardBottomY = getBoardBottomClientY();
    const shouldGhost = boardBottomY !== null && e.clientY > boardBottomY;

    if (shouldGhost) {
      // Reversed back off the board while a "grow back, then hand off" was pending — cancel the
      // hand-off and re-target the shrink instead of letting it finish growing regardless.
      if (ghostHandoffTimerRef.current !== null) {
        clearTimeout(ghostHandoffTimerRef.current);
        ghostHandoffTimerRef.current = null;
        applyGhostScale(true);
      }
      if (!drag.ghosting) {
        drag.ghosting = true;
        // Starts at board size (matching what was just on the canvas); the shrink to tray size
        // is triggered a frame later so the browser registers that starting size first and the
        // transition actually has something to animate from.
        showGhostFor(drag.groupId!, e.clientX, e.clientY, false);
        requestAnimationFrame(() => applyGhostScale(true));
      }
    } else if (drag.ghosting && ghostHandoffTimerRef.current === null) {
      // Crossed back onto the board canvas — animate growing back to board size, then hand off
      // to canvas rendering once that finishes, rather than cutting the instant the edge is
      // crossed (which would just reintroduce the original snap/pop this was built to avoid).
      applyGhostScale(false);
      ghostHandoffTimerRef.current = window.setTimeout(() => {
        ghostHandoffTimerRef.current = null;
        drag.ghosting = false;
        hideGhost();
      }, GHOST_TRANSITION_MS);
    }
    if (drag.ghosting) {
      moveGhost(e.clientX, e.clientY);
    }

    // Constrain drag to the current visible viewport in stage-logical coords, unless ghosted
    // (see above — while ghosted, the DOM ghost already follows the pointer unconstrained, so
    // the underlying logical delta should too, or the two disagree the instant it hands back to
    // canvas rendering). When zoomed out the viewport extends into the dark padding area, giving
    // extra placement room; when zoomed in, the constraint keeps pieces within the visible
    // section.
    const cvs    = canvasRef.current;
    const dpr    = window.devicePixelRatio || 1;
    const totalS = scaleRef.current * userZoomRef.current;
    const vpLeft   = viewOffXRef.current;
    const vpTop    = viewOffYRef.current;
    const vpRight  = cvs ? vpLeft + cvs.width  / (totalS * dpr) - _pw : stageDimsRef.current.w - _pw;
    const vpBottom = cvs ? vpTop  + cvs.height / (totalS * dpr) - _ph : stageDimsRef.current.h - _ph;

    let minX = Infinity, minY = Infinity;
    for (const sp of drag.starts.values()) { minX = Math.min(minX, sp.x); minY = Math.min(minY, sp.y); }

    if (drag.ghosting) {
      drag.dx = rawDx;
      drag.dy = rawDy;
    } else {
      drag.dx = clamp(rawDx, vpLeft - minX,  vpRight  - minX);
      drag.dy = clamp(rawDy, vpTop  - minY,  vpBottom - minY);
    }
    dirtyRef.current = true;

    if (shouldGhost) {
      const trayRect = trayStripRef.current?.getBoundingClientRect();
      const overTray = !!trayRect &&
        e.clientX >= trayRect.left && e.clientX <= trayRect.right &&
        e.clientY >= trayRect.top  && e.clientY <= trayRect.bottom;
      if (overTray !== wasOverTrayRef.current) {
        wasOverTrayRef.current = overTray;
        if (overTray) {
          snapshotTrayLayout();
          lastTrayHoverComputeRef.current = performance.now();
          setTrayInsertIndex(computeTrayInsertIndex(e.clientX));
        } else {
          setTrayInsertIndex(null);
        }
      } else if (overTray) {
        const now = performance.now();
        if (now - lastTrayHoverComputeRef.current > 50) {
          lastTrayHoverComputeRef.current = now;
          setTrayInsertIndex(computeTrayInsertIndex(e.clientX));
        }
      }
    } else if (wasOverTrayRef.current) {
      wasOverTrayRef.current = false;
      setTrayInsertIndex(null);
    }
  }, [clientToLogical, clampViewport, getBoardBottomClientY, applyGhostScale, showGhostFor, hideGhost, moveGhost, snapshotTrayLayout, setTrayInsertIndex, computeTrayInsertIndex]);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    activePointersRef.current.delete(e.pointerId);

    // End pinch when fewer than 2 pointers remain
    const pinch = pinchGestureRef.current;
    if (pinch.active) {
      if (activePointersRef.current.size < 2) {
        pinch.active = false;
        setUserZoom(userZoomRef.current); // sync state for button rendering
      }
      return;
    }

    // End single-finger pan
    const pan = panGestureRef.current;
    if (pan.active && pan.pointerId === e.pointerId) {
      pan.active = false;
      return;
    }

    const drag = dragRef.current;
    if (!drag.active || e.pointerId !== drag.pointerId) return;

    const { groupId, starts, dx, dy } = drag;
    // Captured before hideGhost() below, which clears trayInsertIndexRef as part of resetting
    // the ghost visuals — reading it after that point would always see null and silently fall
    // back to "append at the end", regardless of where the gap preview actually showed.
    const insertAt = trayInsertIndexRef.current;
    drag.active = false; drag.pointerId = null; drag.groupId = null;
    drag.dx = 0; drag.dy = 0; drag.ghosting = false;
    hideGhost();
    if (!groupId) return;

    // Commit drag positions + bring group to front (z-bump deferred from pointerDown)
    const maxZ = piecesRef.current.reduce((m, p) => Math.max(m, p.z), 1);
    let next = piecesRef.current.map(p => {
      if (p.groupId !== groupId) return p;
      const sp = starts.get(p.id);
      return sp ? { ...p, pos: { x: sp.x + dx, y: sp.y + dy }, z: maxZ + 1 } : p;
    });

    // Snapshot positions right after the drop, before any board-snap or neighbor-merge
    // correction runs — diffed against the final positions below so every piece that gets
    // nudged (not just the dragged group) can glide instead of jumping instantly.
    const preSnapPositions = new Map(next.map(p => [p.id, { x: p.pos.x, y: p.pos.y }]));

    // When this drag would resolve the very last unsolved piece/group, there's no ambiguity
    // left about where it belongs — so it's safe to be much more forgiving about snap
    // distance for it specifically. (Occasional reports of "the last piece just won't
    // snap, had to refresh" are most consistent with a transient mobile viewport/scale
    // hiccup throwing off the normal tolerance — being generous here for the one case
    // where correctness can never be in question sidesteps that regardless of cause.)
    const totalUnsolved = next.filter(p => !p.snapped).length;
    const isFinalPiece = totalUnsolved === starts.size;
    const adjBoard    = isFinalPiece
      ? Math.max(pwRef.current, phRef.current) * 1.5
      : boardSnapTolerance / scaleRef.current;
    const adjNeighbor = neighborSnapTolerance / scaleRef.current;

    const s1 = snapToBoardIfClose(next, groupId, adjBoard);
    next = s1.pieces;
    next = snapMergeNeighbours(next, groupId, adjNeighbor);

    const s2 = snapToBoardIfClose(next, groupId, adjBoard);
    next = s2.pieces;

    const endedSnapped = next.some(p => p.groupId === groupId && p.snapped);

    // Dropped back over the tray strip and didn't end up snapped to the board — the group
    // (possibly enlarged by the neighbor-merge above, if it picked up an already-loose piece
    // resting on the board) goes back into the tray, inserted at the slot the player was
    // hovering over (falling back to appending at the end if the insert-index somehow never
    // got set — e.g. a very fast flick with sparse move events).
    if (!endedSnapped) {
      const trayRect = trayStripRef.current?.getBoundingClientRect();
      const droppedInTray = !!trayRect &&
        e.clientX >= trayRect.left && e.clientX <= trayRect.right &&
        e.clientY >= trayRect.top  && e.clientY <= trayRect.bottom;
      if (droppedInTray) {
        setPieces(next);
        setTrayOrder(prev => {
          const idx = clamp(insertAt ?? prev.length, 0, prev.length);
          const copy = [...prev];
          copy.splice(idx, 0, groupId);
          return copy;
        });
        return;
      }
    }

    if (s1.snapped || s2.snapped) {
      playPieceConnectSfx();
    }

    // Snap-to-board → pop + gold glow + particle burst (single piece only — not a multi-piece group)
    if ((s1.snapped || s2.snapped) && starts.size === 1) {
      const pieceId = [...starts.keys()][0];
      snapPopRef.current.set(pieceId, { t0: performance.now(), dur: 380 });
      snapGlowRef.current.set(pieceId, { t0: performance.now(), dur: 700 });

      const reduced = typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!reduced) {
        const placedPiece = next.find(p => p.id === pieceId);
        if (placedPiece) {
          const cx = placedPiece.pos.x + pwRef.current / 2;
          const cy = placedPiece.pos.y + phRef.current / 2;
          burstParticlesRef.current.push(...createBurstParticles(cx, cy, Math.min(pwRef.current, phRef.current)));
        }
      }
    }

    // Build the glide from whatever actually moved during resolution above — this covers
    // both the dragged group snapping onto the board (s1/s2) AND any stationary neighbor
    // group that snapMergeNeighbours pulled into alignment, which previously jumped
    // instantly with no animation at all since only the board-snap delta was tracked.
    const offsets = new Map<string, SnapOffset>();
    for (const p of next) {
      const before = preSnapPositions.get(p.id);
      if (!before) continue;
      const ddx = before.x - p.pos.x;
      const ddy = before.y - p.pos.y;
      if (dist2(ddx, ddy) > 0.1) {
        offsets.set(p.id, { dx0: ddx, dy0: ddy, dx: ddx, dy: ddy });
      }
    }
    if (offsets.size > 0) {
      snapRef.current = {
        offsets,
        // The piece(s) gliding from wherever they were dropped/merged-from into their exact
        // correct spot — needs enough time to read as felt motion rather than a jump.
        t0: performance.now(), dur: 500,
      };
    }

    setPieces(next);
  }, [boardSnapTolerance, neighborSnapTolerance, snapMergeNeighbours, setPieces, setTrayOrder, hideGhost, playPieceConnectSfx]);

  const onPointerLeave = useCallback(() => {
    dirtyRef.current = true;
  }, []);

  // ── Completion effect ────────────────────────────────────────────────────

  useEffect(() => {
    if (!isSolved || completedRef.current) return;
    completedRef.current = true;
    playPuzzleCompleteSfx();
    // Smooth piece scale-up on solve
    // Scatter each piece with a random delay (0–600 ms) and random peak scale (4–12%)
    const now = performance.now();
    for (const p of piecesRef.current) {
      const delay = Math.random() * 600;
      const dur   = 500 + Math.random() * 400;
      const peak  = 0.04 + Math.random() * 0.08;
      solveScaleRef.current.set(p.id, { t0: now + delay, dur, peak });
    }
    dirtyRef.current = true;
    dirtyRef.current = true;
    clearJigsawProgress(storageKeyRef.current);
    const elapsed = Math.max(0, Math.floor((Date.now() - startTimeRef.current) / 1000));
    setElapsedSeconds(elapsed);

    (async () => {
      try {
        const reduced = typeof window !== "undefined" &&
          window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const tl = gsap.timeline({ defaults: { ease: "power2.inOut" } });
        const label = "flare";
        tl.addLabel(label);

        // Positions `el` to exactly cover the board's current on-screen rect, accounting for
        // user zoom + pan (viewOffXRef/viewOffYRef) — not just the base fit-to-container scale.
        // Skipping zoom/pan here is what caused the reveal to drift off the board edges.
        const positionBoardOverlay = (el: HTMLElement) => {
          const canvas = canvasRef.current;
          if (!canvas || !el.parentElement) return;
          const canvasRect = canvas.getBoundingClientRect();
          const parentRect = el.parentElement.getBoundingClientRect();
          const cssScale = scaleRef.current * userZoomRef.current;
          const boardCssX = (boardOffXRef.current - viewOffXRef.current) * cssScale;
          const boardCssY = (boardOffYRef.current - viewOffYRef.current) * cssScale;
          el.style.inset  = '';
          el.style.left   = `${canvasRect.left - parentRect.left + boardCssX}px`;
          el.style.top    = `${canvasRect.top  - parentRect.top  + boardCssY}px`;
          el.style.width  = `${gridW * cssScale}px`;
          el.style.height = `${gridH * cssScale}px`;
        };

        const canvas = canvasRef.current;
        if (canvas && !reduced) {
          tl.to(canvas, { boxShadow: "0 0 46px 14px rgba(255,215,0,0.75)", duration: 0.18, ease: "power3.out" }, label);
          tl.to(canvas, { boxShadow: "0 0 0px 0px rgba(255,215,0,0)", duration: 0.38 }, `${label}+=0.18`);
        }
        if (!reduced && wrapperRef.current) {
          tl.fromTo(wrapperRef.current,
            { x: 0, y: 0 },
            { x: 1.2, y: -0.8, duration: 0.06, yoyo: true, repeat: 4, ease: "power2.inOut", clearProps: "x,y" },
            label);
        }
        if (!reduced && energyRingRef.current && energyGlowRef.current && energyWrapperRef.current) {
          positionBoardOverlay(energyWrapperRef.current);
          tl.set([energyRingRef.current, energyGlowRef.current], { autoAlpha: 0, scale: 0.25, transformOrigin: "50% 50%" }, label);
          tl.to([energyRingRef.current, energyGlowRef.current], { autoAlpha: 1, duration: 0.05 }, label);
          tl.to(energyGlowRef.current, { scale: 1.6, autoAlpha: 0, duration: 0.55, ease: "power3.out" }, `${label}+=0.03`);
          tl.to(energyRingRef.current, { scale: 2.0, autoAlpha: 0, duration: 0.62, ease: "power3.out" }, `${label}+=0.02`);
        }
        tl.play();
        await new Promise<void>(res => tl.eventCallback("onComplete", res));

        // Kick off scoring in the background — don't make the player wait on it
        // before the living-photo reveal plays.
        let pts: number | void | undefined;
        const scored = (async () => {
          if (onComplete) {
            try { const r = onComplete(elapsed); pts = r instanceof Promise ? await r : r; } catch { /* noop */ }
          }
        })();

        // ── Living photo reveal — slow Ken Burns zoom/pan on the completed image ──
        if (!reduced && livingPhotoOuterRef.current && livingPhotoImgRef.current) {
          const outer = livingPhotoOuterRef.current;
          positionBoardOverlay(outer);
          const img = livingPhotoImgRef.current;
          const panX = (Math.random() < 0.5 ? -1 : 1) * (3 + Math.random() * 2);
          const panY = (Math.random() < 0.5 ? -1 : 1) * (2 + Math.random() * 1.5);
          gsap.set(img, { scale: 1.0, xPercent: 0, yPercent: 0, transformOrigin: "50% 50%" });
          const kbTl = gsap.timeline();
          kbTl.to(outer, { autoAlpha: 1, duration: 0.35, ease: "power1.out" }, 0);
          kbTl.to(img, { scale: 1.14, xPercent: panX, yPercent: panY, duration: 3.8, ease: "sine.inOut" }, 0);
          // Start the frame's (slow) fade-in right at the top of the reveal instead of
          // waiting until the overlay starts dissolving — it's hidden underneath the
          // still-opaque overlay either way, so starting early just means a slower fade has
          // enough time to finish before the overlay clears, instead of still visibly
          // fading once the photo is already dissolving away.
          kbTl.call(() => { frameFadeStartRef.current = performance.now(); dirtyRef.current = true; }, undefined, 0);
          kbTl.to(outer, { autoAlpha: 0, duration: 0.5, ease: "power1.in" }, "-=0.4");
          await new Promise<void>(res => kbTl.eventCallback("onComplete", res));
        } else {
          frameFadeStartRef.current = performance.now();
          dirtyRef.current = true;
          await new Promise(r => setTimeout(r, 1000));
        }

        await scored;

        if (!suppressInternalCongrats) {
          setShowCongrats(true);
          if (messageRef.current)
            gsap.fromTo(messageRef.current, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 1, ease: "power2.out" });
        }

        if (typeof pts === "number") {
          setAwardedPoints(0);
          await new Promise<void>(resolve => {
            const obj = { val: 0 };
            gsap.to(obj, { val: pts as number, duration: 0.9, ease: "power2.out",
              onUpdate: () => setAwardedPoints(Math.round(obj.val)),
              onComplete: () => { setAwardedPoints(pts as number); resolve(); },
            });
          });
        } else {
          setAwardedPoints(null);
        }

        await new Promise(r => setTimeout(r, 1700));
        if (messageRef.current)
          await new Promise<void>(res =>
            gsap.to(messageRef.current!, { autoAlpha: 0, y: 8, duration: 0.45, ease: "power2.in", onComplete: res }));
        if (!suppressInternalCongrats) setShowCongrats(false);
        if (isFullscreen) { setIsFullscreen(false); await new Promise(r => setTimeout(r, 200)); }
        if (onShowRatingModal) onShowRatingModal();
      } catch (err) {
        console.error("Jigsaw completion error:", err);
        if (onComplete) { try { onComplete(elapsed); } catch { /* noop */ } }
        if (isFullscreen) setIsFullscreen(false);
        if (onShowRatingModal) onShowRatingModal();
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSolved]);

  // ── Controls API ─────────────────────────────────────────────────────────

  // Sends every loose (non-snapped) group back to the tray. Now that there's no scatter
  // field to declutter, this is just "any group not on the board goes to the tray" — the
  // anti-overlap re-pack algorithm this used to be is gone entirely.
  const sendLooseToTray = useCallback(() => {
    const looseGroupIds = [...new Set(
      piecesRef.current.filter(p => !p.snapped).map(p => p.groupId)
    )];
    if (!looseGroupIds.length) return;
    setTrayOrder(prev => [...prev, ...looseGroupIds.filter(gid => !prev.includes(gid))]);
  }, [setTrayOrder]);
  const sendLooseRef = useRef(sendLooseToTray);
  useEffect(() => { sendLooseRef.current = sendLooseToTray; }, [sendLooseToTray]);

  useEffect(() => {
    if (!onControlsReady || controlsAssignedRef.current) return;
    const api = {
      reset: () => {
        clearJigsawProgress(storageKeyRef.current);
        const fresh = buildInitial(edgesMapRef.current);
        completedRef.current = false;
    frameFadeStartRef.current = null;
        startTimeRef.current = Date.now();
        savedElapsedRef.current = 0;
        setElapsedSeconds(0);
        setPieces(fresh.pieces);
        setTrayOrder(fresh.trayOrder);
      },
      sendLooseToTray: () => sendLooseRef.current(),
      enterFullscreen: () => setIsFullscreen(true),
      exitFullscreen:  () => setIsFullscreen(false),
      get isFullscreen() { return isFullscreenRef.current; },
    };
    try { onControlsReady(api as never); controlsAssignedRef.current = true; } catch { /* noop */ }
  }, [onControlsReady, buildInitial, setPieces, setTrayOrder]);

  // One-time setup
  useEffect(() => {
    setPortalReady(true);
    setIsTouchDevice(window.matchMedia("(pointer: coarse)").matches || "ontouchstart" in window);
  }, []);
  // Cleanup on unmount
  useEffect(() => { isFullscreenRef.current = isFullscreen; }, [isFullscreen]);
  useEffect(() => {
    if (!isFullscreen) return;
    const fn = (e: KeyboardEvent) => e.key === "Escape" && setIsFullscreen(false);
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [isFullscreen]);

  const groupCount = useMemo(() => new Set(pieces.map(p => p.groupId)).size, [pieces]);

  const piecesByGroup = useMemo(() => {
    const m = new Map<string, Piece[]>();
    for (const p of pieces) {
      const arr = m.get(p.groupId);
      if (arr) arr.push(p); else m.set(p.groupId, [p]);
    }
    return m;
  }, [pieces]);

  // ── JSX ──────────────────────────────────────────────────────────────────

  const ui = (
    <div
      ref={wrapperRef}
      style={{
        position: isFullscreen ? "fixed" : "relative",
        inset: isFullscreen ? 0 : undefined,
        zIndex: isFullscreen ? 12000 : undefined,
        width: isFullscreen ? "100vw" : "100%",
        height: isFullscreen ? "100vh" : undefined,
        backgroundColor: "#000000",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        ...containerStyle,
      }}
    >
      {/* ── Canvas area ──────────────────────────────── */}
      <div style={{ position: "relative", flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <canvas
          ref={canvasRef}
          width={canvasW} height={canvasH}
          style={{
            display: "block", position: "relative",
            touchAction: "none", userSelect: "none", cursor: "default",
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerLeave={onPointerLeave}
        />

        {/* Energy ring — positioned to the board rect at animation time (see positionBoardOverlay) */}
        <div ref={energyWrapperRef}
             style={{ position: "absolute", pointerEvents: "none", zIndex: 1001, overflow: "visible" }}>
          <div ref={energyGlowRef}
               style={{ position: "absolute", left: "50%", top: "50%", width: "115%", height: "115%",
                        transform: "translate(-50%,-50%)", borderRadius: 9999, opacity: 0,
                        background: "radial-gradient(circle,rgba(255,215,0,0.42) 0%,rgba(255,215,0,0.16) 36%,rgba(255,215,0,0) 72%)",
                        willChange: "transform,opacity" }} />
          <div ref={energyRingRef}
               style={{ position: "absolute", left: "50%", top: "50%", width: "110%", height: "110%",
                        transform: "translate(-50%,-50%)", borderRadius: 9999,
                        border: "2px solid rgba(255,215,0,0.80)",
                        boxShadow: "0 0 22px 6px rgba(255,215,0,0.22)", opacity: 0,
                        willChange: "transform,opacity" }} />
        </div>

        {/* Living photo reveal — Ken Burns zoom/pan on the completed image */}
        <div ref={livingPhotoOuterRef}
             style={{ position: "absolute", pointerEvents: "none", opacity: 0, zIndex: 1002, overflow: "hidden" }}>
          {effectiveUrl && (
            <img ref={livingPhotoImgRef} src={effectiveUrl} alt=""
                 style={{ position: "absolute", inset: 0, width: "100%", height: "100%",
                          objectFit: "cover", transformOrigin: "50% 50%", willChange: "transform" }} />
          )}
        </div>

        {/* Congrats message */}
        <div ref={messageRef}
             style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center",
                      pointerEvents: "none", zIndex: 9999, opacity: 0 }}>
          <div style={{ background: "rgba(0,0,0,0.72)", padding: "20px 28px", borderRadius: 14,
                        textAlign: "center", maxWidth: "min(720px,90%)" }}>
            <div style={{ color: "#FDE74C", fontSize: 24, fontWeight: 800, marginBottom: 8 }}>
              Congratulations! Puzzle completed!
            </div>
            <div style={{ color: "#DDDBF1", fontSize: 16 }}>
              You&apos;ve been awarded{" "}
              <span style={{ color: "#FDE74C", fontWeight: 800 }}>{awardedPoints ?? "..."}</span>{" "}
              points!
            </div>
            {funFact && (
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.12)" }}>
                <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 5 }}>Fun Fact</div>
                <div style={{ color: "#DDDBF1", fontSize: 14, lineHeight: 1.55 }}>{funFact}</div>
              </div>
            )}
          </div>
        </div>

        {/* Resumed banner — sits below the stats row (also top-anchored) rather than at the same
            top offset; centered, it's wide enough on a narrow phone screen to otherwise overlap
            the stats badges sitting flush left. */}
        {resumed && (
          <div style={{ position: "absolute", top: 46, left: "50%", transform: "translateX(-50%)",
                        zIndex: 9000, background: "rgba(16,185,129,0.92)", color: "white",
                        fontSize: 13, fontWeight: 600, padding: "6px 14px", borderRadius: 20,
                        pointerEvents: "none", whiteSpace: "nowrap", boxShadow: "0 2px 8px rgba(0,0,0,0.4)" }}>
            ✓ Progress restored — pick up where you left off
          </div>
        )}

        {/* Mobile hint — parked above the (now single-row) zoom controls and preview button
            rather than sharing their vertical band, since a centered pill with this much text
            plus two buttons is wide enough on a phone screen to otherwise overlap both the zoom
            controls (bottom-left) and preview button (bottom-right) at once. Allowed to wrap
            (rather than a strict single line) and capped to the viewport width so it can't
            overflow off narrower screens either. */}
        {isTouchDevice && !isFullscreen && !mobileHintDismissed && !isSolved && (
          <div style={{ position: "absolute", bottom: 58, left: "50%", transform: "translateX(-50%)",
                        zIndex: 9100, display: "flex", flexWrap: "wrap", justifyContent: "center", alignItems: "center", gap: 8,
                        background: "rgba(10,20,40,0.88)", color: "white", fontSize: 12, fontWeight: 500,
                        padding: "7px 12px", borderRadius: 22, boxShadow: "0 2px 12px rgba(0,0,0,0.5)",
                        border: "1px solid rgba(255,255,255,0.12)",
                        maxWidth: "calc(100vw - 24px)", textAlign: "center" }}>
            <span>Pinch to zoom · 1 finger to pan · tap piece to drag</span>
            <button type="button" onClick={() => setIsFullscreen(true)}
                    style={{ background: "rgba(99,102,241,0.9)", border: "none", color: "white",
                             padding: "3px 10px", borderRadius: 12, cursor: "pointer", fontWeight: 700, fontSize: 12 }}>
              Fullscreen
            </button>
            <button type="button" onClick={() => setMobileHintDismissed(true)}
                    aria-label="Dismiss"
                    style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)",
                             cursor: "pointer", fontSize: 16, lineHeight: 1, padding: "0 2px" }}>
              ×
            </button>
          </div>
        )}

        {/* Zoom controls — horizontal rather than a stacked column: a 3-button-tall column ate
            up a large vertical strip of an already-small mobile board, covering pieces near the
            bottom-left corner. A single row is much shorter and stays out of the way. */}
        {!isSolved && (
          <div style={{ position: "absolute", bottom: 12, left: 12, zIndex: 9100,
                        display: "flex", flexDirection: "row", gap: 4 }}>
            <button
              type="button"
              onClick={() => applyZoom(1.25)}
              disabled={userZoom >= MAX_ZOOM}
              title="Zoom in"
              style={{ width: 34, height: 34, borderRadius: 10,
                       background: "rgba(10,20,40,0.85)", color: "rgba(255,255,255,0.9)",
                       border: "1px solid rgba(255,255,255,0.2)", cursor: userZoom >= MAX_ZOOM ? "default" : "pointer",
                       fontSize: 18, fontWeight: 700, lineHeight: 1, opacity: userZoom >= MAX_ZOOM ? 0.4 : 1 }}>
              +
            </button>
            <button
              type="button"
              onClick={resetZoom}
              disabled={userZoom === 1}
              title="Reset zoom"
              style={{ width: 34, height: 34, borderRadius: 10,
                       background: "rgba(10,20,40,0.85)", color: "rgba(255,255,255,0.75)",
                       border: "1px solid rgba(255,255,255,0.15)", cursor: userZoom === 1 ? "default" : "pointer",
                       fontSize: 11, fontWeight: 700, lineHeight: 1, opacity: userZoom === 1 ? 0.4 : 1 }}>
              {Math.round(userZoom * 100)}%
            </button>
            <button
              type="button"
              onClick={() => applyZoom(0.8)}
              disabled={userZoom <= MIN_ZOOM}
              title="Zoom out"
              style={{ width: 34, height: 34, borderRadius: 10,
                       background: "rgba(10,20,40,0.85)", color: "rgba(255,255,255,0.9)",
                       border: "1px solid rgba(255,255,255,0.2)", cursor: userZoom <= MIN_ZOOM ? "default" : "pointer",
                       fontSize: 18, fontWeight: 700, lineHeight: 1, opacity: userZoom <= MIN_ZOOM ? 0.4 : 1 }}>
              −
            </button>
          </div>
        )}

        {/* Preview button */}
        {imageOk && effectiveUrl && !isSolved && (
          <button type="button" onClick={() => setShowPreview(v => !v)}
                  style={{ position: "absolute", bottom: 12, right: 12, zIndex: 9100,
                           background: showPreview ? "rgba(99,102,241,0.9)" : "rgba(10,20,40,0.85)",
                           color: "rgba(255,255,255,0.9)", border: "1px solid rgba(255,255,255,0.2)",
                           borderRadius: 14, padding: "5px 13px", fontSize: 12, fontWeight: 600,
                           cursor: "pointer", userSelect: "none", display: "flex", alignItems: "center", gap: 5 }}>
            🖼 {showPreview ? "Hide Preview" : "Preview Image"}
          </button>
        )}

        {/* Preview overlay */}
        {showPreview && effectiveUrl && (
          <div onClick={() => setShowPreview(false)}
               style={{ position: "fixed", inset: 0, zIndex: 9500, display: "flex",
                        alignItems: "center", justifyContent: "center",
                        background: "rgba(0,0,0,0.85)", cursor: "pointer" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={effectiveUrl} alt="Puzzle preview"
                 style={{ maxWidth: "90vw", maxHeight: "80vh", width: "auto", height: "auto",
                          objectFit: "contain", borderRadius: 8,
                          boxShadow: "0 8px 40px rgba(0,0,0,0.7)", border: "2px solid rgba(255,255,255,0.2)",
                          pointerEvents: "none", display: "block" }} />
            <div style={{ position: "absolute", top: 12, right: 12, color: "rgba(255,255,255,0.7)",
                          fontSize: 13, fontWeight: 600 }}>
              Tap to close
            </div>
          </div>
        )}

        {/* Image error */}
        {imageOk === false && (
          <div style={{ position: "absolute", left: 12, top: 12, background: "rgba(0,0,0,0.6)",
                        color: "white", padding: "6px 10px", borderRadius: 8, fontSize: 12, zIndex: 200 }}>
            Image failed to load.{" "}
            <button type="button" onClick={() => {
                      setImageOk(null); setReloadKey(k => k + 1);
                      setProxyTried(false); setEffectiveUrl(imageUrl ?? "");
                    }}
                    style={{ marginLeft: 8, background: "#2b6cb0", color: "white", border: "none",
                             padding: "4px 8px", borderRadius: 6, cursor: "pointer" }}>
              Retry
            </button>
          </div>
        )}

        {/* Fullscreen-only controls — the page's own toolbar (Fullscreen / Return Loose
            Pieces) lives outside this component and is unreachable once fullscreen portals
            everything into document.body, so it needs its own entry point here too. */}
        {isFullscreen && (
          <div style={{ position: "absolute", right: 12, top: 12, zIndex: 13000,
                        display: "flex", gap: 8 }}>
            {!isSolved && (
              <button type="button" onClick={sendLooseToTray}
                      style={{ padding: "6px 10px", borderRadius: 8, background: "#facc15",
                               color: "#000", border: "1px solid #eab308",
                               cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                Return Loose Pieces
              </button>
            )}
            {puzzleId && (
              <PuzzleBugReportButton
                puzzleId={puzzleId}
                puzzleTitle={puzzleTitle || "This puzzle"}
                style={{ padding: "6px 10px", borderRadius: 8, background: "rgba(0,0,0,0.5)",
                         color: "white", border: "1px solid rgba(255,255,255,0.06)", cursor: "pointer",
                         fontSize: 13, fontWeight: 600 }}
              />
            )}
            <button type="button" onClick={() => setIsFullscreen(false)}
                    style={{ padding: "6px 8px", borderRadius: 8, background: "rgba(0,0,0,0.5)",
                             color: "white", border: "1px solid rgba(255,255,255,0.06)", cursor: "pointer" }}>
              Exit Fullscreen
            </button>
          </div>
        )}

        {/* Stats — hidden once solved: there's nothing left to track, and on a small mobile
            screen this corner is exactly where the post-completion modal (rating/XP, rendered
            by the parent page above this component) needs the space instead. */}
        {!isSolved && (
        <div style={{ position: "absolute", top: 10, left: 10, zIndex: 200,
                      display: "flex", gap: 8, alignItems: "center", pointerEvents: "none" }}>
          <div style={{ background: "rgba(0,0,0,0.55)", color: "rgba(255,255,255,0.86)", fontSize: 11,
                        fontWeight: 700, padding: "4px 10px", borderRadius: 12,
                        border: "1px solid rgba(255,255,255,0.12)", letterSpacing: "0.02em" }}>
            ⏱ {formatElapsed(elapsedSeconds)}
          </div>
          <div style={{ background: "rgba(0,0,0,0.55)", color: "rgba(255,255,255,0.8)", fontSize: 11,
                        fontWeight: 600, padding: "4px 10px", borderRadius: 12,
                        border: "1px solid rgba(255,255,255,0.1)", letterSpacing: "0.02em" }}>
            {pieces.filter(p => p.snapped).length}/{pieces.length} placed
          </div>
          {groupCount > 1 && (
            <div style={{ background: "rgba(0,0,0,0.55)", color: "rgba(255,255,255,0.6)", fontSize: 11,
                          fontWeight: 600, padding: "4px 10px", borderRadius: 12,
                          border: "1px solid rgba(255,255,255,0.08)" }}>
              {groupCount} groups
            </div>
          )}
        </div>
        )}
      </div>

      {/* ── Tray strip ───────────────────────────────── */}
      <div
        ref={trayStripRef}
        style={{
          flexShrink: 0,
          height: TRAY_H,
          display: "flex",
          alignItems: "center",
          gap: 10,
          overflowX: "auto",
          overflowY: "hidden",
          touchAction: "pan-x",
          WebkitOverflowScrolling: "touch",
          padding: "12px 14px",
          background: "rgba(255,255,255,0.03)",
          borderTop: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        {trayOrder.length === 0 && (
          <div style={{ margin: "0 auto", color: "rgba(255,255,255,0.35)", fontSize: 13, fontStyle: "italic" }}>
            {isSolved ? "Puzzle complete!" : "All pieces are on the board"}
          </div>
        )}
        {trayOrder.map((groupId, i) => (
          <TrayPieceThumb
            key={groupId}
            groupId={groupId}
            members={piecesByGroup.get(groupId) ?? []}
            pw={pw} ph={ph}
            pathCache={pathCacheRef.current}
            img={imageOk ? imgRef.current : null}
            gridW={gridW} gridH={gridH}
            rows={rows} cols={cols}
            cellPx={trayCellPx}
            onPick={beginDragFromTray}
            registerNode={registerTrayNode}
            shiftPx={trayInsertIndex !== null && i >= trayInsertIndex ? ghostTraySizeRef.current.w + 10 : 0}
          />
        ))}
      </div>

      {/* Floating drag-ghost — shown while a piece/cluster is being dragged past the board's
          edge, since the board canvas is clamped to its own bounds and can't visually follow
          the pointer down into the tray strip. The wrapper's footprint is fixed at board scale
          and only ever translated (positioning); the canvas inside it is scaled down toward
          tray size via applyGhostScale as the drag approaches the tray, so the piece shrinks
          continuously in step with the pointer instead of snapping between two fixed sizes.
          Both are driven imperatively (showGhostFor / moveGhost), not via a declarative effect,
          since they need to track the pointer every move tick without a React re-render. */}
      <div
        ref={ghostWrapperRef}
        style={{
          position: "fixed", left: 0, top: 0, zIndex: 14000,
          pointerEvents: "none",
          display: ghostGroupId ? "block" : "none",
          filter: "drop-shadow(0 6px 14px rgba(0,0,0,0.55))",
        }}
      >
        <canvas
          ref={ghostCanvasRef}
          style={{ display: "block", transformOrigin: "50% 50%", transition: `transform ${GHOST_TRANSITION_MS}ms ease` }}
        />
      </div>

    </div>
  );

  if (isFullscreen && portalReady && typeof document !== "undefined") {
    return createPortal(ui, document.body);
  }
  return ui;
}
