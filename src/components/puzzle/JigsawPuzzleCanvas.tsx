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

function saveJigsawProgress(key: string, pieces: Piece[], elapsedMs: number) {
  try {
    const data: SavedProgress = {
      pieces: Object.fromEntries(pieces.map(p => [p.id, {
        relX: p.pos.x - p.correct.x, relY: p.pos.y - p.correct.y,
        groupId: p.groupId, snapped: p.snapped, z: p.z,
      }])),
      elapsedMs, savedAt: Date.now(),
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
  const kCYm  = Math.max(ext - r, r * 0.05); // keep centre above baseline
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
  puzzleId, tableBackground, funFact, containerStyle = {},
}: JigsawPuzzleProps) {

  // ── Refs ──────────────────────────────────────────────────────────────────
  const canvasRef       = useRef<HTMLCanvasElement>(null);
  const wrapperRef      = useRef<HTMLDivElement>(null);
  const energyWrapperRef = useRef<HTMLDivElement>(null);
  const energyRingRef   = useRef<HTMLDivElement>(null);
  const energyGlowRef   = useRef<HTMLDivElement>(null);
  const messageRef      = useRef<HTMLDivElement>(null);
  const livingPhotoOuterRef = useRef<HTMLDivElement>(null);
  const livingPhotoImgRef   = useRef<HTMLImageElement>(null);

  // Image
  const imgRef           = useRef<HTMLImageElement | null>(null);
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

  // Logical dimensions of board (never changes after init)
  const pw = boardWidth / cols;
  const ph = boardHeight / rows;
  const pwRef = useRef(pw);
  const phRef = useRef(ph);
  pwRef.current = pw; phRef.current = ph;

  // Stage: logical space that the canvas covers. On desktop = STAGE_SCALE × board (fixed).
  // On mobile the stage adapts to fill the available container (dynamic dimensions).
  // boardOffX/Y = top-left of the board within the stage; updated by the resize effect only.
  // p.pos / p.correct are in stage coords; boardOffX/Y is NOT baked in at render time.
  const STAGE_SCALE = 1.8;
  const boardOffXRef  = useRef((boardWidth  * (STAGE_SCALE - 1)) / 2);
  const boardOffYRef  = useRef((boardHeight * (STAGE_SCALE - 1)) / 2);
  const stageDimsRef  = useRef({ w: boardWidth * STAGE_SCALE, h: boardHeight * STAGE_SCALE });

  // DPR-aware canvas pixel dimensions
  const [canvasW, setCanvasW] = useState(boardWidth);
  const [canvasH, setCanvasH] = useState(boardHeight);
  const scaleRef = useRef(1); // stage logical px  →  CSS px (canvas element CSS size)

  // Tray height
  const TRAY_H = Math.max(80, trayHeightProp ?? 160);

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

  // Drag  
  const dragRef = useRef<{
    active: boolean; pointerId: number | null;
    groupId: string | null; anchorId: string | null;
    anchorOff: PiecePos; starts: Map<string, PiecePos>;
    dx: number; dy: number;
  }>({ active: false, pointerId: null, groupId: null, anchorId: null,
       anchorOff: { x: 0, y: 0 }, starts: new Map(), dx: 0, dy: 0 });

  // Snap spring  
  // Per-piece offsets rather than one shared delta — a drag can trigger both a board-snap
  // (the dragged piece/group) AND a neighbour merge (a separate, stationary group yanked
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
  // Keeps non-fullscreen mobile height stable while browser bars show/hide during scroll.
  const mobileViewportBaseRef = useRef<{ w: number; h: number } | null>(null);

  // Viewport: on mobile we zoom into the board area rather than showing the full scatter stage.
  // viewOff is the top-left corner of the viewport in stage logical coordinates.
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

  // Merge neighbours that are close enough
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
          if (!nb || nb.groupId === gid) continue;
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

  // ── Spawn helper ─────────────────────────────────────────────────────────

  const pickSpawn = useCallback((logW: number, logH: number): PiecePos => {
    const _pw = pwRef.current, _ph = phRef.current;
    // logW/logH are the stage dimensions in board-relative coords (stage = STAGE_SCALE × board)
    // The board occupies boardOffX..boardOffX+boardWidth, boardOffY..boardOffY+boardHeight
    const _bOffX = boardOffXRef.current, _bOffY = boardOffYRef.current;
    const pad = Math.round(Math.min(_pw, _ph) * 0.08);
    const fL = _bOffX - pad, fT = _bOffY - pad, fR = _bOffX + boardWidth + pad, fB = _bOffY + boardHeight + pad;
    const maxX = logW - _pw, maxY = logH - _ph;
    const outside = (x: number, y: number) => x + _pw <= fL || x >= fR || y + _ph <= fT || y >= fB;
    type Rect = { x0: number; x1: number; y0: number; y1: number; area: number };
    const rects: Rect[] = [];
    const add = (x0: number, x1: number, y0: number, y1: number) => {
      const ax = clamp(x0, 0, maxX), bx = clamp(x1, 0, maxX);
      const ay = clamp(y0, 0, maxY), by = clamp(y1, 0, maxY);
      if (bx > ax && by > ay) rects.push({ x0: ax, x1: bx, y0: ay, y1: by, area: (bx - ax) * (by - ay) });
    };
    add(0, fL - _pw, 0, maxY);
    add(fR, maxX, 0, maxY);
    add(fL, fR - _pw, 0, fT - _ph);
    add(fL, fR - _pw, fB, maxY);
    if (rects.length > 0) {
      const total = rects.reduce((s, r) => s + r.area, 0) || 1;
      let pick = Math.random() * total;
      let chosen = rects[0];
      for (const r of rects) { pick -= r.area; if (pick <= 0) { chosen = r; break; } }
      for (let i = 0; i < 30; i++) {
        const x = chosen.x0 + Math.random() * (chosen.x1 - chosen.x0);
        const y = chosen.y0 + Math.random() * (chosen.y1 - chosen.y0);
        if (outside(x, y)) return { x, y };
      }
    }
    for (let i = 0; i < 200; i++) {
      const x = Math.random() * maxX, y = Math.random() * maxY;
      if (outside(x, y)) return { x, y };
    }
    return { x: 0, y: 0 };
  }, [boardWidth, boardHeight]);

  // ── Build starter pieces ─────────────────────────────────────────────────

  const buildInitial = useCallback((
    edgesMap: Map<string, EdgeMap>,
  ): Piece[] => {
    // Stage dimensions from current layout (set by the resize effect)
    const stageLogW = stageDimsRef.current.w;
    const stageLogH = stageDimsRef.current.h;
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
          correct, pos: pickSpawn(stageLogW, stageLogH),
          groupId: id, z: 1, snapped: false,
        });
      }
    }
    return list;
  }, [rows, cols, boardWidth, boardHeight, pickSpawn]);

  // ── Initialise / re-initialise ───────────────────────────────────────────

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

    if (saved && Object.keys(saved.pieces).length === rows * cols) {
      savedElapsedRef.current = saved.elapsedMs ?? 0;
      startTimeRef.current = Date.now() - savedElapsedRef.current;
      finalPieces = applyProgress(initial, saved);
      setResumed(true);
      setTimeout(() => setResumed(false), 3500);
    } else {
      savedElapsedRef.current = 0;
      startTimeRef.current = Date.now();
      finalPieces = initial;
    }

    setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startTimeRef.current) / 1000)));

    completedRef.current = false;
    frameFadeStartRef.current = null;
    piecesRef.current = finalPieces;
    setPiecesState(finalPieces);
    dirtyRef.current = true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, cols, imageUrl]);

  // ── Rebuild path cache when shape opts change (slider adjustments) ───────
  useEffect(() => {
    if (!edgesMapRef.current.size) return; // not yet initialised
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
      imgRef.current = img;
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
  }, [effectiveUrl, reloadKey, proxyTried]);

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

    const update = () => {
      const isMobile = window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 720;
      const viewportW = Math.round(window.visualViewport?.width ?? window.innerWidth ?? window.screen.width ?? boardWidth);
      const viewportH = Math.round(window.visualViewport?.height ?? window.innerHeight ?? window.screen.height ?? boardHeight);
      const availW = Math.min(wrapper.clientWidth || boardWidth, viewportW);
      let physW: number, physH: number, s: number;
      let newStageW: number, newStageH: number;

      if (isFullscreen) {
        mobileViewportBaseRef.current = null;
        const fsW = viewportW;
        const fsH = viewportH;
        // Fullscreen (mobile and desktop alike): stage fills the actual screen viewport rather
        // than a fixed multiple of the board's own aspect ratio. A fixed-multiple stage gets
        // letterboxed whenever the board's aspect ratio doesn't match the screen's (nearly
        // always), leaving dead space at the edges pieces could never reach — filling the real
        // viewport gives pieces the full screen to scatter across, board centred within it.
        //
        // The board-fill margin differs by device: mobile keeps the board large (88% of the
        // constraining dimension) since screen space is already scarce there. Desktop uses a
        // much smaller margin — filling 88% of a desktop screen leaves almost no slack in
        // whichever dimension the board's aspect ratio doesn't match, so scattered pieces had
        // nowhere to go but a thin band matching the board's own extent, and overlapped there.
        const fillMargin = isMobile ? 0.88 : 0.55;
        s         = Math.min(fsW * fillMargin / boardWidth, fsH * fillMargin / boardHeight);
        physW     = fsW;
        physH     = fsH;
        newStageW = fsW / s;
        newStageH = fsH / s;
      } else if (isMobile) {
        // Mobile non-fullscreen: canvas fills available width × a large portion of screen height.
        // Stage adapts to those exact CSS dimensions so pieces scatter over the full visible area.
        const base = mobileViewportBaseRef.current;
        if (!base || Math.abs(viewportW - base.w) > 24) {
          mobileViewportBaseRef.current = { w: viewportW, h: viewportH };
        } else if (viewportH > base.h + 140) {
          // Large jumps are likely orientation/layout changes, not URL bar animation.
          base.h = viewportH;
        }

        const stableViewportH = mobileViewportBaseRef.current?.h ?? viewportH;
        const isLandscape = viewportW > stableViewportH;
        const containerMaxH = wrapper.style.maxHeight ? parseInt(wrapper.style.maxHeight) : Infinity;
        const availH      = Math.min(
          isLandscape
            ? Math.max(180, stableViewportH - 90)  // landscape — leave room for tray + nav
            : stableViewportH * 0.78,              // portrait  — 78 % of screen height
          containerMaxH
        );
        s         = Math.min(availW * 0.88 / boardWidth, availH * 0.88 / boardHeight);
        physW     = Math.round(availW);
        physH     = Math.round(availH);
        newStageW = availW / s;
        newStageH = availH / s;
      } else {
        mobileViewportBaseRef.current = null;
        // Desktop non-fullscreen: fixed STAGE_SCALE, letterboxed into wrapper
        const stageAspect = boardWidth / boardHeight; // STAGE_SCALE cancels out
        const availH = Math.min(window.innerHeight * 0.62, Math.max(320, availW / stageAspect));
        s         = Math.min(availW / (boardWidth * STAGE_SCALE), availH / (boardHeight * STAGE_SCALE));
        physW     = Math.round(boardWidth  * STAGE_SCALE * s);
        physH     = Math.round(boardHeight * STAGE_SCALE * s);
        newStageW = boardWidth  * STAGE_SCALE;
        newStageH = boardHeight * STAGE_SCALE;
      }

      const newOffX    = (newStageW - boardWidth)  / 2;
      const newOffY    = (newStageH - boardHeight) / 2;
      const prevOffX   = boardOffXRef.current;
      const prevOffY   = boardOffYRef.current;
      const prevStageW = stageDimsRef.current.w;
      const prevStageH = stageDimsRef.current.h;
      const dOffX      = newOffX - prevOffX;
      const dOffY      = newOffY - prevOffY;

      boardOffXRef.current = newOffX;
      boardOffYRef.current = newOffY;
      stageDimsRef.current = { w: newStageW, h: newStageH };
      viewOffXRef.current  = 0;
      viewOffYRef.current  = 0;
      scaleRef.current     = s;

      // Shift all piece positions when the board moves within the stage (e.g. orientation change)
      const stageSizeChanged = Math.abs(newStageW - prevStageW) > 0.5 || Math.abs(newStageH - prevStageH) > 0.5;
      if ((Math.abs(dOffX) > 0.5 || Math.abs(dOffY) > 0.5 || stageSizeChanged) && piecesRef.current.length > 0) {
        const _pw = pwRef.current, _ph = phRef.current;
        const shifted = piecesRef.current.map(p => {
          // Pieces parked off-stage (tray) get re-parked beyond the new stage bounds
          if (p.pos.x > prevStageW + 50 || p.pos.y > prevStageH + 50) {
            return { ...p, pos: { x: newStageW + 100, y: newStageH + 100 } };
          }
          const newCorrect = { x: p.correct.x + dOffX, y: p.correct.y + dOffY };
          if (p.snapped) {
            // Snapped pieces: use their authoritative correct position
            return { ...p, pos: { ...newCorrect }, correct: newCorrect };
          }
          // Non-snapped: shift then clamp into the new stage bounds so pieces stay grabbable
          const newPos = {
            x: clamp(p.pos.x + dOffX, 0, newStageW - _pw),
            y: clamp(p.pos.y + dOffY, 0, newStageH - _ph),
          };
          return { ...p, pos: newPos, correct: newCorrect };
        });
        piecesRef.current = shifted;
        setPiecesState(shifted);
        dirtyRef.current = true;
      }

      const rw = physW, rh = physH;
      setCanvasW(rw);
      setCanvasH(rh);
      const canvas = canvasRef.current;
      if (canvas) {
        const dpr           = window.devicePixelRatio || 1;
        canvas.width        = rw * dpr;
        canvas.height       = rh * dpr;
        canvas.style.width  = `${rw}px`;
        canvas.style.height = `${rh}px`;
        // Re-centre viewport: when stage fits inside the canvas (e.g. after fullscreen exit or
        // zoom-out), viewOff should be negative so the stage is centred rather than top-left.
        const totalS  = s * userZoomRef.current;
        const viewW2  = rw / totalS;
        const viewH2  = rh / totalS;
        const { w: sw, h: sh } = stageDimsRef.current;
        viewOffXRef.current = sw <= viewW2 ? (sw - viewW2) / 2 : clamp(viewOffXRef.current, 0, sw - viewW2);
        viewOffYRef.current = sh <= viewH2 ? (sh - viewH2) / 2 : clamp(viewOffYRef.current, 0, sh - viewH2);
        dirtyRef.current    = true;
      }
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(wrapper);
    const onOrient = () => setTimeout(update, 150);
    const onResize = () => {
      const mobileNow = window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 720;
      if (mobileNow && !isFullscreen) {
        const base = mobileViewportBaseRef.current;
        const nextW = Math.round(window.visualViewport?.width ?? window.innerWidth ?? window.screen.width ?? boardWidth);
        if (base && Math.abs(nextW - base.w) < 2) return;
      }
      update();
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onOrient);
    return () => {
      ro.disconnect();
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
        saveJigsawProgress(storageKeyRef.current, piecesRef.current, Math.max(0, Date.now() - startTimeRef.current));
      }
    }, 800);
    return () => clearTimeout(id);
  }, [pieces]);

  // ── Solved check ─────────────────────────────────────────────────────────

  const isSolved = useMemo(() => {
    if (!pieces.length) return false;
    const g = pieces[0].groupId;
    return pieces.every(p => p.groupId === g) &&
           pieces.every(p => dist2(p.pos.x - p.correct.x, p.pos.y - p.correct.y) < 1);
  }, [pieces]);
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

      // Board area background + faint reference image
      if (!solved) {
        ctx.fillStyle = "#111111";
        ctx.fillRect(_bOffX, _bOffY, boardWidth, boardHeight);
        // Board border
        ctx.strokeStyle = "rgba(255,255,255,0.22)";
        ctx.lineWidth = 1.5 / s;
        ctx.strokeRect(_bOffX, _bOffY, boardWidth, boardHeight);
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
          ctx.shadowBlur  = 16 / s;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 9 / s;
        } else {
          ctx.save();
          ctx.translate(0, (p.snapped ? 4 : 3) / s);
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
          ctx.drawImage(imgRef.current, imgX, imgY, boardWidth, boardHeight);
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
        // bottom-right-facing edge, both within the same clip already active above (reusing
        // it instead of a second ctx.clip() call, which isn't free either). Cheap emboss
        // trick: stroke the same path twice, offset a hair in complementary directions —
        // clipping cuts off everything except the sliver just inside each edge, so it reads
        // as a raised, chiselled border around the actual curved shape without needing
        // per-edge normal math for the tabs. The "raised object on a table" look makes sense
        // for a loose piece, but at full strength on already-connected pieces it read as a
        // grid of bright white seams, so it's turned way down once a piece is placed.
        const isPlaced = p.snapped || solved;
        const bevelPx = 1.1 / s;
        ctx.translate(bevelPx, bevelPx);
        ctx.strokeStyle = isPlaced ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.5)";
        ctx.lineWidth = isPlaced ? 1.2 / s : 1.8 / s;
        ctx.stroke(path);
        ctx.translate(-bevelPx * 2, -bevelPx * 2);
        ctx.strokeStyle = "rgba(0,0,0,0.32)";
        ctx.lineWidth = isPlaced ? 1.4 / s : 2.2 / s;
        ctx.stroke(path);
        ctx.restore();

        // Outline. Snapped/solved pieces use a dark seam (reads as a recessed groove between
        // connected pieces, like a real jigsaw) rather than a light one — a bright outline on
        // an already-placed piece read as a stray highlight rather than a seam. 0.55 turned
        // out too strong across every tab/blank curve on a full board — competed with the
        // photo instead of reading as a subtle seam — so this is dialed back, plus a hair
        // thinner specifically for snapped pieces.
        ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
        ctx.strokeStyle = isPlaced
          ? "rgba(0,0,0,0.1)"
          : dragging ? "rgba(255,255,255,0.65)" : "rgba(255,255,255,0.30)";
        ctx.lineWidth = dragging ? 1.6 / s : isPlaced ? 0.85 / s : 1 / s;
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
            ctx.shadowBlur  = 14 / s;
            ctx.strokeStyle = `rgba(255,215,0,${glowAlpha * 0.80})`;
            ctx.lineWidth   = 2 / s;
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
          const scaleX = boardWidth / (frameImg.naturalWidth * holeW);
          const scaleY = boardHeight / (frameImg.naturalHeight * holeH);
          const drawW = frameImg.naturalWidth * scaleX;
          const drawH = frameImg.naturalHeight * scaleY;
          const drawX = _bOffX - FRAME_HOLE.left * frameImg.naturalWidth * scaleX;
          const drawY = _bOffY - FRAME_HOLE.top * frameImg.naturalHeight * scaleY;

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
          ctx.shadowBlur = 6 / s;

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
  }, [boardWidth, boardHeight, rows, cols, imageOk, tableBackground]);

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
    // Keep canvas centre fixed in stage coords
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
    };
    dirtyRef.current = true;
  }, [clientToLogical, hitTest, clampViewport]);

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

    // Constrain drag to the current visible viewport in stage-logical coords.
    // When zoomed out the viewport extends into the dark padding area, giving extra placement
    // room. When zoomed in the constraint keeps pieces within the visible section.
    const cvs    = canvasRef.current;
    const dpr    = window.devicePixelRatio || 1;
    const totalS = scaleRef.current * userZoomRef.current;
    const vpLeft   = viewOffXRef.current;
    const vpTop    = viewOffYRef.current;
    const vpRight  = cvs ? vpLeft + cvs.width  / (totalS * dpr) - _pw : stageDimsRef.current.w - _pw;
    const vpBottom = cvs ? vpTop  + cvs.height / (totalS * dpr) - _ph : stageDimsRef.current.h - _ph;

    let minX = Infinity, minY = Infinity;
    for (const sp of drag.starts.values()) { minX = Math.min(minX, sp.x); minY = Math.min(minY, sp.y); }

    drag.dx = clamp(rawDx, vpLeft - minX,  vpRight  - minX);
    drag.dy = clamp(rawDy, vpTop  - minY,  vpBottom - minY);
    dirtyRef.current = true;
  }, [clientToLogical, clampViewport]);

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
    drag.active = false; drag.pointerId = null; drag.groupId = null;
    drag.dx = 0; drag.dy = 0;
    if (!groupId) return;

    // Commit drag positions + bring group to front (z-bump deferred from pointerDown)
    const maxZ = piecesRef.current.reduce((m, p) => Math.max(m, p.z), 1);
    let next = piecesRef.current.map(p => {
      if (p.groupId !== groupId) return p;
      const sp = starts.get(p.id);
      return sp ? { ...p, pos: { x: sp.x + dx, y: sp.y + dy }, z: maxZ + 1 } : p;
    });

    // Snapshot positions right after the drop, before any board-snap or neighbour-merge
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
    // both the dragged group snapping onto the board (s1/s2) AND any stationary neighbour
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
  }, [boardSnapTolerance, neighborSnapTolerance, snapMergeNeighbours, setPieces, playPieceConnectSfx]);

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
          el.style.width  = `${boardWidth  * cssScale}px`;
          el.style.height = `${boardHeight * cssScale}px`;
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

  const sendLooseToTray = useCallback(() => {
    setPieces(prev => {
      const logW = stageDimsRef.current.w;
      const logH = stageDimsRef.current.h;
      const _pw = pwRef.current, _ph = phRef.current;
      // Buffer between scattered groups (and between a group and the board) — sized off
      // piece dimensions rather than a flat pixel value so it scales with grid density.
      // Bigger than a plain "don't touch" gap because tabs/blanks bulge out past a piece's
      // nominal pw×ph box (~20% per side), so a tight bounding-box gap still looked like
      // visual overlap once you counted the protruding tabs.
      const fullBuffer = Math.max(_pw, _ph) * 0.5;
      type Rect = { x0: number; y0: number; x1: number; y1: number };
      const overlapArea = (a: Rect, b: Rect) => {
        const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
        const h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
        return w > 0 && h > 0 ? w * h : 0;
      };
      const overlaps = (a: Rect, b: Rect) => overlapArea(a, b) > 0;

      const _bOffX = boardOffXRef.current, _bOffY = boardOffYRef.current;
      const placedRects: Rect[] = [
        { x0: _bOffX - fullBuffer, y0: _bOffY - fullBuffer, x1: _bOffX + boardWidth + fullBuffer, y1: _bOffY + boardHeight + fullBuffer },
      ];

      const gids = [...new Set(prev.map(p => p.groupId))];
      let next = [...prev.map(p => ({ ...p }))];

      // Place bigger merged clusters first — packs more reliably than random order, since
      // large groups have fewer valid spots left the longer you wait to place them.
      const groupsBySize = gids
        .map(gid => ({ gid, group: next.filter(p => p.groupId === gid) }))
        .filter(({ group }) => !group.some(p => p.snapped))
        .sort((a, b) => b.group.length - a.group.length);

      for (const { gid, group } of groupsBySize) {
        const minX = Math.min(...group.map(p => p.pos.x));
        const minY = Math.min(...group.map(p => p.pos.y));
        const maxX = Math.max(...group.map(p => p.pos.x + _pw));
        const maxY = Math.max(...group.map(p => p.pos.y + _ph));
        const gw = maxX - minX, gh = maxY - minY;
        const rangeX = Math.max(0, logW - gw);
        const rangeY = Math.max(0, logH - gh);

        const tryFind = (buf: number, attempts: number): { x: number; y: number } | null => {
          for (let i = 0; i < attempts; i++) {
            const x = clamp(Math.random() * rangeX, 0, rangeX);
            const y = clamp(Math.random() * rangeY, 0, rangeY);
            const candidate: Rect = { x0: x - buf, y0: y - buf, x1: x + gw + buf, y1: y + gh + buf };
            if (!placedRects.some(r => overlaps(candidate, r))) return { x, y };
          }
          return null;
        };

        // Progressively relax the required clearance if the stage is too cramped to fit
        // everything with a full gap (small mobile screens especially, where the board
        // itself already fills most of the stage). Every group must end up somewhere —
        // silently leaving a piece unmoved is exactly what read as "the button did
        // nothing" for some/all pieces on mobile.
        let chosen = tryFind(fullBuffer, 40) ?? tryFind(fullBuffer * 0.4, 40) ?? tryFind(0, 40);

        if (!chosen) {
          // Still nothing fully clear of everything else — take the least-overlapping of a
          // batch of random candidates rather than leaving the piece in place.
          let best: { x: number; y: number } | null = null;
          let bestOverlap = Infinity;
          for (let i = 0; i < 25; i++) {
            const x = clamp(Math.random() * rangeX, 0, rangeX);
            const y = clamp(Math.random() * rangeY, 0, rangeY);
            const candidate: Rect = { x0: x, y0: y, x1: x + gw, y1: y + gh };
            const total = placedRects.reduce((sum, r) => sum + overlapArea(candidate, r), 0);
            if (total < bestOverlap) { bestOverlap = total; best = { x, y }; }
            if (total === 0) break;
          }
          chosen = best ?? { x: 0, y: 0 };
        }

        placedRects.push({ x0: chosen.x, y0: chosen.y, x1: chosen.x + gw, y1: chosen.y + gh });
        const shifted = { x: chosen.x - minX, y: chosen.y - minY };
        next = next.map(p => p.groupId !== gid ? p : { ...p, pos: { x: p.pos.x + shifted.x, y: p.pos.y + shifted.y } });
      }
      return next;
    });
  }, [boardWidth, boardHeight, setPieces]);
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
        setPieces(fresh);
      },
      sendLooseToTray: () => sendLooseRef.current(),
      enterFullscreen: () => setIsFullscreen(true),
      exitFullscreen:  () => setIsFullscreen(false),
      get isFullscreen() { return isFullscreenRef.current; },
    };
    try { onControlsReady(api as never); controlsAssignedRef.current = true; } catch { /* noop */ }
  }, [onControlsReady, buildInitial, setPieces]);

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

        {/* Resumed banner */}
        {resumed && (
          <div style={{ position: "absolute", top: 10, left: "50%", transform: "translateX(-50%)",
                        zIndex: 9000, background: "rgba(16,185,129,0.92)", color: "white",
                        fontSize: 13, fontWeight: 600, padding: "6px 14px", borderRadius: 20,
                        pointerEvents: "none", whiteSpace: "nowrap", boxShadow: "0 2px 8px rgba(0,0,0,0.4)" }}>
            ✓ Progress restored — pick up where you left off
          </div>
        )}

        {/* Mobile hint */}
        {isTouchDevice && !isFullscreen && !mobileHintDismissed && !isSolved && (
          <div style={{ position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)",
                        zIndex: 9100, display: "flex", alignItems: "center", gap: 8,
                        background: "rgba(10,20,40,0.88)", color: "white", fontSize: 12, fontWeight: 500,
                        padding: "7px 12px", borderRadius: 22, boxShadow: "0 2px 12px rgba(0,0,0,0.5)",
                        border: "1px solid rgba(255,255,255,0.12)", whiteSpace: "nowrap" }}>
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

        {/* Zoom controls */}
        {!isSolved && (
          <div style={{ position: "absolute", bottom: 12, left: 12, zIndex: 9100,
                        display: "flex", flexDirection: "column", gap: 4 }}>
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

        {/* Fullscreen-only controls — the page's own toolbar (Fullscreen / Scatter loose
            pieces) lives outside this component and is unreachable once fullscreen portals
            everything into document.body, so scatter needs its own entry point here too. */}
        {isFullscreen && (
          <div style={{ position: "absolute", right: 12, top: 12, zIndex: 13000,
                        display: "flex", gap: 8 }}>
            {!isSolved && (
              <button type="button" onClick={sendLooseToTray}
                      style={{ padding: "6px 10px", borderRadius: 8, background: "#facc15",
                               color: "#000", border: "1px solid #eab308",
                               cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                Scatter loose pieces
              </button>
            )}
            <button type="button" onClick={() => setIsFullscreen(false)}
                    style={{ padding: "6px 8px", borderRadius: 8, background: "rgba(0,0,0,0.5)",
                             color: "white", border: "1px solid rgba(255,255,255,0.06)", cursor: "pointer" }}>
              Exit Fullscreen
            </button>
          </div>
        )}

        {/* Stats */}
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
      </div>

    </div>
  );

  if (isFullscreen && portalReady && typeof document !== "undefined") {
    return createPortal(ui, document.body);
  }
  return ui;
}
