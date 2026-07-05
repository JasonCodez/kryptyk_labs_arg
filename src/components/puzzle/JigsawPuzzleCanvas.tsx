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
 *  - Completion: GSAP shimmer + energy-ring DOM overlays (same as before)
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
  const shimmerOuterRef = useRef<HTMLDivElement>(null);
  const shimmerInnerRef = useRef<HTMLDivElement>(null);
  const shimmerInnerBRef = useRef<HTMLDivElement>(null);
  const shimmerInnerCRef = useRef<HTMLDivElement>(null);
  const energyWrapperRef = useRef<HTMLDivElement>(null);
  const energyRingRef   = useRef<HTMLDivElement>(null);
  const energyGlowRef   = useRef<HTMLDivElement>(null);
  const messageRef      = useRef<HTMLDivElement>(null);
  const livingPhotoOuterRef = useRef<HTMLDivElement>(null);
  const livingPhotoImgRef   = useRef<HTMLImageElement>(null);

  // Image
  const imgRef           = useRef<HTMLImageElement | null>(null);
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

  const playJigsawSfx = useCallback((url: string, volume: number) => {
    if (!isJigsawSfxEnabled()) return;
    try {
      const clip = new Audio(url);
      clip.preload = "auto";
      clip.volume = volume;
      void clip.play().catch(() => {
        // Ignore playback failures (autoplay policy, missing file, etc).
      });
    } catch {
      // Ignore playback failures.
    }
  }, [isJigsawSfxEnabled]);

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
  type SnapAnim = { pieceIds: Set<string>; dx: number; dy: number; t0: number; dur: number };
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
        if (isMobile) {
          // Mobile fullscreen: fill the screen; board centred with ~12% margin per side
          s         = Math.min(fsW * 0.88 / boardWidth, fsH * 0.88 / boardHeight);
          physW     = fsW;
          physH     = fsH;
          newStageW = fsW / s;
          newStageH = fsH / s;
        } else {
          // Desktop fullscreen: fixed STAGE_SCALE
          s         = Math.min(fsW / (boardWidth * STAGE_SCALE), fsH / (boardHeight * STAGE_SCALE));
          physW     = Math.round(boardWidth  * STAGE_SCALE * s);
          physH     = Math.round(boardHeight * STAGE_SCALE * s);
          newStageW = boardWidth  * STAGE_SCALE;
          newStageH = boardHeight * STAGE_SCALE;
        }
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
  }, [isSolved, rows, cols, imageUrl, puzzleId, playJigsawSfx]);

  // ── rAF render loop ──────────────────────────────────────────────────────

  useEffect(() => {
    const render = (now: number) => {
      rafRef.current = requestAnimationFrame(render);

      // Advance snap spring
      const snap = snapRef.current;
      if (snap) {
        const t = Math.min(1, (now - snap.t0) / snap.dur);
        const ease = 1 - Math.pow(1 - t, 3); // ease-out cubic
        snap.dx = snap.dx * (1 - ease);
        snap.dy = snap.dy * (1 - ease);
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

      // Sort: z-order, dragging group on top
      const drag = dragRef.current;
      const ag   = drag.active ? drag.groupId : null;
      const sorted = [...piecesRef.current].sort((a, b) => {
        const da = ag && a.groupId === ag ? 1 : 0;
        const db = ag && b.groupId === ag ? 1 : 0;
        return (da - db) || (a.z - b.z);
      });

      for (const p of sorted) {
        const path = pathCacheRef.current.get(p.id);
        if (!path) continue;

        const dragging = ag !== null && p.groupId === ag;
        // p.pos is in stage space (includes boardOff); Path2D starts at (0,0) in piece-local space
        let px = p.pos.x, py = p.pos.y;
        if (dragging) { px += drag.dx; py += drag.dy; }
        if (snapRef.current && snapRef.current.pieceIds.has(p.id)) {
          px += snapRef.current.dx; py += snapRef.current.dy;
        }

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

        // Drop shadow — snapped pieces get a grounded weight shadow
        if (p.snapped) {
          ctx.shadowColor = "rgba(0,0,0,0.38)";
          ctx.shadowBlur  = 7 / s;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 4 / s;
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
        ctx.restore();

        // Outline
        ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
        ctx.strokeStyle = (p.snapped || solved)
          ? "rgba(255,255,255,0.14)"
          : dragging ? "rgba(255,255,255,0.65)" : "rgba(255,255,255,0.30)";
        ctx.lineWidth = dragging ? 1.6 / s : 1 / s;
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
      if (snapRef.current && snapRef.current.pieceIds.has(p.id)) {
        px += snapRef.current.dx; py += snapRef.current.dy;
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

    const adjBoard    = boardSnapTolerance / scaleRef.current;
    const adjNeighbor = neighborSnapTolerance / scaleRef.current;

    let lastSnapDelta: { dx: number; dy: number } | null = null;
    const s1 = snapToBoardIfClose(next, groupId, adjBoard);
    next = s1.pieces;
    if (s1.snapped) lastSnapDelta = { dx: s1.dx, dy: s1.dy };
    next = snapMergeNeighbours(next, groupId, adjNeighbor);

    const s2 = snapToBoardIfClose(next, groupId, adjBoard);
    next = s2.pieces;
    if (s2.snapped) lastSnapDelta = { dx: s2.dx, dy: s2.dy };

    if (s1.snapped || s2.snapped) {
      playJigsawSfx(PIECE_CONNECT_SFX_URL, PIECE_CONNECT_SFX_VOLUME);
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

    if (lastSnapDelta && dist2(lastSnapDelta.dx, lastSnapDelta.dy) > 0.1) {
      snapRef.current = {
        pieceIds: new Set(starts.keys()),
        dx: -lastSnapDelta.dx, dy: -lastSnapDelta.dy,
        t0: performance.now(), dur: 200,
      };
    }

    setPieces(next);
  }, [boardSnapTolerance, neighborSnapTolerance, snapMergeNeighbours, setPieces, playJigsawSfx]);

  const onPointerLeave = useCallback(() => {
    dirtyRef.current = true;
  }, []);

  // ── Completion effect ────────────────────────────────────────────────────

  useEffect(() => {
    if (!isSolved || completedRef.current) return;
    completedRef.current = true;
    playJigsawSfx(PUZZLE_COMPLETE_SFX_URL, PUZZLE_COMPLETE_SFX_VOLUME);
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
        // Skipping zoom/pan here is what caused the shimmer/reveal to drift off the board edges.
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
        if (shimmerOuterRef.current && shimmerInnerRef.current) {
          // Constrain shimmer sweep to the board area only
          positionBoardOverlay(shimmerOuterRef.current);
          tl.set(shimmerOuterRef.current, { autoAlpha: 1 }, label);
          tl.set([shimmerInnerRef.current, shimmerInnerBRef.current, shimmerInnerCRef.current].filter(Boolean) as gsap.TweenTarget,
            { xPercent: -250, autoAlpha: 0 }, label);
          tl.fromTo(shimmerInnerRef.current, { xPercent: -220, autoAlpha: 0 }, { xPercent: 220, autoAlpha: 1, duration: 0.70, ease: "power3.inOut" }, `${label}+=0.06`);
          if (shimmerInnerBRef.current)
            tl.fromTo(shimmerInnerBRef.current, { xPercent: -240, autoAlpha: 0 }, { xPercent: 240, autoAlpha: 0.85, duration: 0.92, ease: "power2.inOut" }, `${label}+=0.12`);
          if (shimmerInnerCRef.current)
            tl.fromTo(shimmerInnerCRef.current, { xPercent: -260, autoAlpha: 0 }, { xPercent: 260, autoAlpha: 0.95, duration: 0.55, ease: "power4.inOut" }, `${label}+=0.20`);
          tl.to(shimmerOuterRef.current, { autoAlpha: 0, duration: 0.22 }, ">-0.06");
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
          kbTl.to(outer, { autoAlpha: 0, duration: 0.5, ease: "power1.in" }, "-=0.4");
          await new Promise<void>(res => kbTl.eventCallback("onComplete", res));
        } else {
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
      const gids = [...new Set(prev.map(p => p.groupId))];
      let next = [...prev.map(p => ({ ...p }))];
      for (const gid of gids) {
        const group = next.filter(p => p.groupId === gid);
        if (group.some(p => p.snapped)) continue;
        const tgt = {
          x: clamp(Math.random() * (logW - pwRef.current * 2) + pwRef.current, 0, logW - pwRef.current),
          y: clamp(Math.random() * (logH - phRef.current * 2) + phRef.current, 0, logH - phRef.current),
        };
        // Avoid placing on top of board
        const _bOffX = boardOffXRef.current, _bOffY = boardOffYRef.current;
        const onBoard = (x: number, y: number) =>
          x + pwRef.current > _bOffX && x < _bOffX + boardWidth &&
          y + phRef.current > _bOffY && y < _bOffY + boardHeight;
        const minX = Math.min(...group.map(p => p.pos.x));
        const minY = Math.min(...group.map(p => p.pos.y));
        const shifted = { x: tgt.x - minX, y: tgt.y - minY };
        // Only move if destination avoids the board; otherwise keep current pos
        if (!onBoard(minX + shifted.x, minY + shifted.y)) {
          next = next.map(p => p.groupId !== gid ? p : { ...p, pos: { x: p.pos.x + shifted.x, y: p.pos.y + shifted.y } });
        }
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

        {/* Shimmer overlay */}
        <div ref={shimmerOuterRef}
             style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0, zIndex: 999, overflow: "hidden" }}>
          <div ref={shimmerInnerRef}
               style={{ position: "absolute", left: 0, top: 0, width: "60%", height: "100%",
                        background: "linear-gradient(90deg,rgba(255,215,0,0) 0%,rgba(255,215,0,0.92) 52%,rgba(255,215,0,0) 100%)",
                        transform: "skewX(-20deg)", willChange: "transform,opacity" }} />
          <div ref={shimmerInnerBRef}
               style={{ position: "absolute", left: 0, top: 0, width: "85%", height: "100%",
                        background: "linear-gradient(90deg,rgba(255,255,255,0) 0%,rgba(255,215,0,0.36) 35%,rgba(255,215,0,0.22) 52%,rgba(255,215,0,0.28) 68%,rgba(255,255,255,0) 100%)",
                        transform: "skewX(-18deg)", opacity: 0, willChange: "transform,opacity" }} />
          <div ref={shimmerInnerCRef}
               style={{ position: "absolute", left: 0, top: 0, width: "40%", height: "100%",
                        background: "linear-gradient(90deg,rgba(255,215,0,0) 0%,rgba(255,215,0,0.85) 48%,rgba(255,215,0,0) 100%)",
                        transform: "skewX(-22deg)", opacity: 0, willChange: "transform,opacity" }} />
        </div>

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

        {/* Fullscreen exit */}
        {isFullscreen && (
          <button type="button" onClick={() => setIsFullscreen(false)}
                  style={{ position: "absolute", right: 12, top: 12, zIndex: 13000, padding: "6px 8px",
                           borderRadius: 8, background: "rgba(0,0,0,0.5)", color: "white",
                           border: "1px solid rgba(255,255,255,0.06)", cursor: "pointer" }}>
            Exit Fullscreen
          </button>
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
