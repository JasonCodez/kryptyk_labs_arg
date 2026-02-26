"use client";

import React, { useMemo, useRef, useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import gsap from "gsap";

interface EdgeMap {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

interface PiecePosition {
  x: number;
  y: number;
}

interface JigsawPieceProps {
  id: string;
  row: number;
  col: number;
  edges: EdgeMap;
  pieceW: number;
  pieceH: number;
  boardW: number;
  boardH: number;
  boardLeft: number;
  boardTop: number;
  imageUrl: string;
  pos: PiecePosition;
  z: number;
  groupId: string;
  onPointerDown: (e: React.PointerEvent<SVGSVGElement>, id: string) => void;
  highlight?: boolean;
}

interface JigsawPuzzleSVGWithTrayProps {
  imageUrl: string;
  rows?: number;
  cols?: number;
  boardWidth?: number;
  boardHeight?: number;
  stagePadding?: number;
  trayHeight?: number;
  neighborSnapTolerance?: number;
  boardSnapTolerance?: number;
  trayScatter?: number;
  // Geometry controls
  tabRadius?: number;
  tabDepth?: number;
  neckWidth?: number;
  neckDepth?: number;
  shoulderLen?: number;
  shoulderDepth?: number;
  cornerInset?: number;
  smooth?: number;
  containerStyle?: React.CSSProperties;
  onComplete?: (timeSpentSeconds?: number) => Promise<number | void> | number | void;
  onShowRatingModal?: () => void;
  suppressInternalCongrats?: boolean;
  onControlsReady?: (api: { reset: () => void; sendLooseToTray: () => void; enterFullscreen: () => void; exitFullscreen: () => void; isFullscreen: boolean }) => void;
  /** Unique identifier used to key the localStorage save slot. Strongly recommended. */
  puzzleId?: string;
  /**
   * URL of a background image to display as the "table" behind the puzzle pieces.
   * E.g. "/images/table-bg.jpg". Falls back to a CSS wood-grain if omitted.
   */
  tableBackground?: string;
}

interface Piece {
  id: string;
  row: number;
  col: number;
  edges: EdgeMap;
  correct: PiecePosition;
  pos: PiecePosition;
  groupId: string;
  z: number;
  snapped: boolean;
}

interface DragRef {
  active: boolean;
  pointerId: number;
  groupId: string | null;
  startPositions: Map<string, PiecePosition>;
  anchorPieceId: string | null;
  anchorOffset: PiecePosition;
}

function hypot(dx: number, dy: number): number {
  return Math.hypot(dx, dy);
}
interface ClampFn {
  (n: number, min: number, max: number): number;
}

const clamp: ClampFn = function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
};

  const EPS_GROUP_ALIGN_PX = 1.5;

interface EdgeMap {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

type EdgesMap = Map<string, EdgeMap>;

function buildEdges(rows: number, cols: number): EdgesMap {
  const edges: EdgesMap = new Map();
  const getId = (r: number, c: number): string => `${r}-${c}`;
  const randTab = (): number => (Math.random() < 0.5 ? 1 : -1);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const id = getId(r, c);
      const e: EdgeMap = { top: 0, right: 0, bottom: 0, left: 0 };

      if (r > 0) e.top = -edges.get(getId(r - 1, c))!.bottom;
      if (c > 0) e.left = -edges.get(getId(r, c - 1))!.right;

      e.right = c < cols - 1 ? randTab() : 0;
      e.bottom = r < rows - 1 ? randTab() : 0;

      edges.set(id, e);
    }
  }
  return edges;
}

// ---------------------------------------------------------------------------
// Save / Resume helpers
// ---------------------------------------------------------------------------
type SavedPieceData = { relX: number; relY: number; groupId: string; snapped: boolean; z: number };
interface SavedJigsawProgress {
  pieces: Record<string, SavedPieceData>;
  elapsedMs: number;
  savedAt: number;
}

function getJigsawStorageKey(puzzleId: string | undefined, imageUrl: string, rows: number, cols: number): string {
  if (puzzleId) return `jigsaw-progress-${puzzleId}`;
  // Fallback: derive a key from imageUrl tail + dimensions
  const urlSlug = imageUrl.replace(/[^a-zA-Z0-9]/g, '').slice(-24);
  return `jigsaw-progress-${rows}x${cols}-${urlSlug}`;
}

function saveJigsawProgress(key: string, pieces: Piece[], elapsedMs: number): void {
  try {
    const data: SavedJigsawProgress = {
      pieces: Object.fromEntries(
        pieces.map((p) => [
          p.id,
          { relX: p.pos.x - p.correct.x, relY: p.pos.y - p.correct.y, groupId: p.groupId, snapped: p.snapped, z: p.z },
        ])
      ),
      elapsedMs,
      savedAt: Date.now(),
    };
    localStorage.setItem(key, JSON.stringify(data));
  } catch { /* ignore quota / SSR errors */ }
}

function loadJigsawProgress(key: string): SavedJigsawProgress | null {
  try {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as SavedJigsawProgress;
  } catch { return null; }
}

function clearJigsawProgress(key: string): void {
  try { localStorage.removeItem(key); } catch {}
}

function applyJigsawProgress(initial: Piece[], saved: SavedJigsawProgress): Piece[] {
  return initial.map((p) => {
    const s = saved.pieces[p.id];
    if (!s) return p;
    return { ...p, pos: { x: p.correct.x + s.relX, y: p.correct.y + s.relY }, groupId: s.groupId, snapped: s.snapped, z: s.z };
  });
}
// ---------------------------------------------------------------------------

interface PiecePathEdges {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}

type Orientation = "top" | "right" | "bottom" | "left";

// PATCH: Replace your piecePath with this version.
// It supports dir edges: {-1 slot, 0 flat, +1 tab} and exposes controls via opts.
//
// Usage:
//   const d = piecePath(pieceW, pieceH, edges, { tabRadius: 0.18, shoulderDepth: 0.10 });
// or keep default look by calling piecePath(pieceW, pieceH, edges)

type PiecePathOptions = {
  // Canonical controls (fractions of edge length L unless noted)
  featureSpan?: number;     // width of the whole knob zone (0..1)
  neckSpan?: number;        // width of the neck (0..featureSpan)
  headSpan?: number;        // width of the head (0..featureSpan)  ✅ NEW (acts like radius/diameter control)

  tabDepth?: number;        // depth of tab/slot (0..0.35 typically)
  neckPinch?: number;       // pinch opposite direction (0..0.2 typically)
  shoulderDepth?: number;   // inward scoop (0..0.2 typically)
  shoulderSpan?: number;    // shoulder length (0..0.3 typically)

  cornerInset?: number;     // px (NOT a fraction)
  smooth?: number;          // 0..1
  kappa?: number;           // circle approximation
};

function piecePath(w: number, h: number, edges: EdgeMap, opts: PiecePathOptions = {}) {
  const minSide = Math.min(w, h);

  const P: Required<PiecePathOptions> = {
    featureSpan: 0.55,
    neckSpan: 0.50,
    headSpan: 0.24,

    tabDepth: 0.23,
    neckPinch: 0,
    shoulderDepth: 0,
    shoulderSpan: 0.30,

    cornerInset: 0 * minSide, // px
    smooth: 0.6,
    kappa: 0.5522847498,

    ...opts,
  };

  const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
  const unit = (x: number, y: number) => {
    const d = Math.hypot(x, y) || 1;
    return { x: x / d, y: y / d };
  };
  const add = (a: { x: number; y: number }, b: { x: number; y: number }) => ({ x: a.x + b.x, y: a.y + b.y });
  const mul = (v: { x: number; y: number }, s: number) => ({ x: v.x * s, y: v.y * s });

  const Ccmd = (a: any, b: any, c: any) => `C ${a.x} ${a.y}, ${b.x} ${b.y}, ${c.x} ${c.y}`;

  /**
   * Local edge profile commands from (0,0) -> (L,0).
   * Outward is +Y. Slot is mirror of tab via sign.
   */
  function edgeProfileLocal(L: number, dir: number): string[] {
    if (dir === 0) return [`L ${L} 0`];

    const sign = dir; // +1 tab, -1 slot
    const sizeRef = Math.min(w, h);

    const featureSpan = Math.min(
      Math.max(0.42, Math.min(0.56, clamp01(P.featureSpan))) * sizeRef,
      L * 0.72
    );
    const neckSpan = Math.min(
      Math.max(0.12, Math.min(0.21, clamp01(P.neckSpan))) * sizeRef,
      Math.min(featureSpan * 0.62, L * 0.42)
    );
    const rawHeadSpan = Math.min(
      Math.max(0.22, Math.min(0.32, clamp01(P.headSpan))) * sizeRef,
      Math.min(featureSpan * 0.84, L * 0.58)
    );
    const headSpan = Math.max(rawHeadSpan, neckSpan * 1.34);

    const mid = L / 2;
    const halfFeature = featureSpan / 2;
    const halfNeck = neckSpan / 2;
    const halfHead = headSpan / 2;

    const a = mid - halfFeature;
    const b = mid - halfNeck;
    const c = mid + halfNeck;
    const d = mid + halfFeature;

    const tabDepth = sign * Math.min(P.tabDepth * sizeRef, sizeRef * 0.3, L * 0.28);
    const neckDepth = Math.max(0.0012 * sizeRef, P.neckPinch * sizeRef);
    const neckY = sign * neckDepth;
    const shoulderY = sign * Math.max(0, P.shoulderDepth * sizeRef) * (0.14 + 0.1 * P.smooth);

    const pt = (x: number, y: number) => ({ x, y });

    const headRadius = halfHead;
    const headY = tabDepth - sign * headRadius;
    const apex = pt(mid, tabDepth);

    const shoulderSpan = Math.min(
      Math.max(0.08, Math.min(0.16, clamp01(P.shoulderSpan))) * sizeRef,
      L * 0.28
    );

    const cmds: string[] = [];
    cmds.push(`L ${a} 0`);

    cmds.push(
      Ccmd(
        pt(a + shoulderSpan * 0.9, shoulderY),
        pt(b - shoulderSpan * 0.08, neckY * 0.96),
        pt(b, neckY)
      )
    );

    cmds.push(
      Ccmd(
        pt(b + neckSpan * 0.16, neckY),
        pt(mid - halfHead * 1.0, headY + (tabDepth - headY) * 0.38),
        pt(mid - halfHead * 0.7, headY + (tabDepth - headY) * 0.82)
      )
    );

    cmds.push(
      Ccmd(
        pt(mid - halfHead * 0.44, tabDepth - sign * headRadius * 0.05),
        pt(mid - halfHead * 0.16, tabDepth - sign * headRadius * 0.02),
        apex
      )
    );

    cmds.push(
      Ccmd(
        pt(mid + halfHead * 0.16, tabDepth - sign * headRadius * 0.02),
        pt(mid + halfHead * 0.44, tabDepth - sign * headRadius * 0.05),
        pt(mid + halfHead * 0.7, headY + (tabDepth - headY) * 0.82)
      )
    );

    cmds.push(
      Ccmd(
        pt(mid + halfHead * 1.0, headY + (tabDepth - headY) * 0.38),
        pt(c - neckSpan * 0.16, neckY),
        pt(c, neckY)
      )
    );

    cmds.push(
      Ccmd(
        pt(c + shoulderSpan * 0.08, neckY * 0.96),
        pt(d - shoulderSpan * 0.9, shoulderY),
        pt(d, 0)
      )
    );

    cmds.push(`L ${L} 0`);
    return cmds;
  }

  // Transform local commands to world points
  function emitEdge(
    start: { x: number; y: number },
    along: { x: number; y: number },
    out: { x: number; y: number },
    L: number,
    dir: number
  ): string {
    const cmdsLocal = edgeProfileLocal(L, dir);

    const transformPoint = (x: number, y: number) => add(start, add(mul(along, x), mul(out, y)));

    const transformCmd = (cmd: string) => {
      if (cmd.startsWith("L ")) {
        const [, xs, ys] = cmd.split(" ");
        const p = transformPoint(parseFloat(xs), parseFloat(ys));
        return `L ${p.x} ${p.y}`;
      }
      if (cmd.startsWith("C ")) {
        const rest = cmd.slice(2);
        const parts = rest.split(",").map((s) => s.trim());
        const [x1, y1] = parts[0].split(/\s+/).map(Number);
        const [x2, y2] = parts[1].split(/\s+/).map(Number);
        const [x3, y3] = parts[2].split(/\s+/).map(Number);
        const p1 = transformPoint(x1, y1);
        const p2 = transformPoint(x2, y2);
        const p3 = transformPoint(x3, y3);
        return `C ${p1.x} ${p1.y}, ${p2.x} ${p2.y}, ${p3.x} ${p3.y}`;
      }
      return cmd;
    };

    return cmdsLocal.map(transformCmd).join(" ");
  }

  const inset = P.cornerInset;

  // corners
  const TL = { x: 0, y: 0 };
  const TR = { x: w, y: 0 };
  const BR = { x: w, y: h };
  const BL = { x: 0, y: h };

  // side directions clockwise
  const alongTop = unit(1, 0), outTop = unit(0, -1);
  const alongR = unit(0, 1), outR = unit(1, 0);
  const alongBot = unit(-1, 0), outBot = unit(0, 1);
  const alongL = unit(0, -1), outL = unit(-1, 0);

  const topDir = edges.top ?? 0;
  const rDir = edges.right ?? 0;
  const bDir = edges.bottom ?? 0;
  const lDir = edges.left ?? 0;

  // Per-corner radius: only non-zero when BOTH edges meeting at that corner are flat (dir=0).
  // This means only one corner of each true board-corner piece gets rounded.
  const rTL = (lDir === 0 && topDir === 0) ? inset : 0;
  const rTR = (topDir === 0 && rDir === 0) ? inset : 0;
  const rBR = (rDir === 0 && bDir === 0) ? inset : 0;
  const rBL = (bDir === 0 && lDir === 0) ? inset : 0;

  // Inset endpoints — per-corner so non-rounded corners go exactly to the corner point
  const TL_top   = add(TL, mul(alongTop, rTL));
  const TR_right = add(TR, mul(alongR,   rTR));
  const BR_bot   = add(BR, mul(alongBot, rBR));
  const BL_left  = add(BL, mul(alongL,  rBL));

  const topLen   = w - rTL - rTR;
  const rightLen = h - rTR - rBR;
  const botLen   = w - rBR - rBL;
  const leftLen  = h - rBL - rTL;

  // Emit a rounded corner with Q bezier, or a plain L if not rounded
  const cc = (r: number, corner: {x:number,y:number}, end: {x:number,y:number}) =>
    r > 0 ? `Q ${corner.x} ${corner.y} ${end.x} ${end.y}` : `L ${end.x} ${end.y}`;

  const d = [
    `M ${TL_top.x} ${TL_top.y}`,
    emitEdge(TL_top, alongTop, outTop, topLen, topDir),
    cc(rTR, TR, TR_right),
    emitEdge(TR_right, alongR, outR, rightLen, rDir),
    cc(rBR, BR, BR_bot),
    emitEdge(BR_bot, alongBot, outBot, botLen, bDir),
    cc(rBL, BL, BL_left),
    emitEdge(BL_left, alongL, outL, leftLen, lDir),
    cc(rTL, TL, TL_top),
    "Z",
  ].join(" ");

  return d.replace(/\s+/g, " ").trim();
}





function JigsawPiece({
  id,
  row,
  col,
  edges,
  pieceW,
  pieceH,
  boardW,
  boardH,
  boardLeft,
  boardTop,
  imageUrl,
  pos,
  z,
  groupId,
  onPointerDown,
  highlight = false,
  snapped = false,
  tabRadius,
  tabDepth,
  neckWidth,
  neckDepth,
  shoulderLen,
  shoulderDepth,
  cornerInset,
  smooth,
  isDragging = false,
  dragDx = 0,
  dragDy = 0,
  snapDx = 0,
  snapDy = 0,
  snapAnimating = false,
  imageOk = null,
}: JigsawPieceProps & { snapped?: boolean; tabRadius?: number; tabDepth?: number; neckWidth?: number; neckDepth?: number; shoulderLen?: number; shoulderDepth?: number; cornerInset?: number; smooth?: number; isDragging?: boolean; dragDx?: number; dragDy?: number; snapDx?: number; snapDy?: number; snapAnimating?: boolean; imageOk?: boolean | null }) {
  const clipId = `clip-${id}`;
  const lightWashId = `piece-light-${id}`;
  const shadeWashId = `piece-shade-${id}`;
  const minSide = Math.min(pieceW, pieceH);
  const d = useMemo(
    () => piecePath(pieceW, pieceH, edges, {
      // Traditional cardboard profile: round head, slimmer neck, modest shoulders.
      featureSpan: Math.max(0.44, Math.min(0.54, 0.46 + (shoulderLen ?? 0.22) * 0.06)),
      headSpan: Math.max(0.255, Math.min(0.33, (tabRadius ?? 0.18) * 1.5)),
      neckSpan: Math.max(0.14, Math.min(0.19, (neckWidth ?? 0.22) * 0.74)),
      tabDepth: Math.max(0.17, Math.min(0.225, (tabDepth ?? 0.22) * 0.95)),
      neckPinch: Math.max(0.0008, Math.min(0.004, (neckDepth ?? 0.1) * 0.03)),
      shoulderSpan: Math.max(0.09, Math.min(0.14, (shoulderLen ?? 0.22) * 0.56)),
      shoulderDepth: Math.max(0.0006, Math.min(0.0025, (shoulderDepth ?? 0.08) * 0.02)),
      cornerInset: Math.max(0, Math.min(minSide * 0.08, (cornerInset ?? 1) * minSide * 0.06)),
      smooth: Math.max(0.72, Math.min(0.94, smooth ?? 0.55)),
    }),
    [pieceW, pieceH, edges, tabRadius, tabDepth, neckWidth, neckDepth, shoulderLen, shoulderDepth, cornerInset, smooth, minSide]
  );

  // Subtle "settle" on drop: quick squash then return.
  const [dropSettle, setDropSettle] = useState(false);
  const prevDraggingRef = useRef(false);
  React.useEffect(() => {
    const wasDragging = prevDraggingRef.current;
    prevDraggingRef.current = !!isDragging;

    if (wasDragging && !isDragging) {
      setDropSettle(true);
      const t = setTimeout(() => setDropSettle(false), 90);
      return () => clearTimeout(t);
    }
  }, [isDragging]);

  // NOTE: removed drag scale animation — pieces no longer scale on pick/drop

  // Gold border animation state
  const [showGold, setShowGold] = useState(false);
  const [goldOpacity, setGoldOpacity] = useState(0);

  React.useEffect(() => {
    let fadeTimer: NodeJS.Timeout | undefined;
    if (snapped) {
      setShowGold(true);
      setGoldOpacity(0);
      // Animate gold border in
      let t = 0;
      const step = () => {
        t += 0.06;
        setGoldOpacity(Math.min(1, t * 2));
        if (t < 0.5) {
          fadeTimer = setTimeout(step, 30);
        } else {
          // Hold at full opacity, then fade out
          setTimeout(() => {
            let tf = 1;
            const fade = () => {
              tf -= 0.06;
              setGoldOpacity(Math.max(0, tf));
              if (tf > 0) fadeTimer = setTimeout(fade, 30);
              else setShowGold(false);
            };
            fade();
          }, 600);
        }
      };
      step();
    }
    return () => fadeTimer && clearTimeout(fadeTimer);
  }, [snapped]);

  const tx = (dragDx || 0) + (snapDx || 0);
  const ty = (dragDy || 0) + (snapDy || 0);
  const hasOuterTransform = tx !== 0 || ty !== 0;

  return (
    <div
      style={{
        position: "absolute",
        left: pos.x,
        top: pos.y,
        zIndex: z,
        cursor: snapped ? "default" : "grab",
        touchAction: "none",
        userSelect: "none",
        // Drop-shadow filters are expensive across many SVGs; keep it only for
        // the actively dragged group.
        filter: !snapped && isDragging ? "drop-shadow(0px 14px 22px rgba(0,0,0,0.45))" : undefined,
        pointerEvents: snapped ? "none" : "auto",
        transform: hasOuterTransform ? `translate3d(${tx}px, ${ty}px, 0px)` : undefined,
        transition: snapAnimating ? 'transform 170ms cubic-bezier(0.18, 1.35, 0.32, 1)' : undefined,
        willChange: hasOuterTransform ? 'transform' : undefined,
      }}
      data-piece-id={id}
      data-piece-group={groupId}
    >
      <svg
        width={pieceW}
        height={pieceH}
        viewBox={`0 0 ${pieceW} ${pieceH}`}
        style={{
          overflow: "visible",
          transformOrigin: '50% 50%',
          // Lift on pick-up: animate only the "lift" transform, not the drag translate.
          transform: isDragging
            ? 'translate3d(0px, -2px, 0px) scale(1.025)'
            : (dropSettle ? 'translate3d(0px, 0px, 0px) scale(0.985)' : 'translate3d(0px, 0px, 0px) scale(1)'),
          transition: isDragging
            ? 'transform 120ms cubic-bezier(0.2, 0.8, 0.2, 1)'
            : 'transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1)',
          willChange: 'transform',
        }}
        onPointerDown={snapped ? undefined : (e) => onPointerDown(e, id)}
      >
        <defs>
          <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
            <path d={d} />
          </clipPath>
          <linearGradient id={lightWashId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.18)" />
            <stop offset="36%" stopColor="rgba(255,255,255,0.05)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
          <radialGradient id={shadeWashId} cx="72%" cy="78%" r="78%">
            <stop offset="35%" stopColor="rgba(0,0,0,0)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.08)" />
          </radialGradient>
        </defs>

        <path
          d={d}
          fill="rgba(0,0,0,0.1)"
          transform={isDragging ? "translate(1.35 2.05)" : "translate(0.7 1.05)"}
          style={{ pointerEvents: "none" }}
        />

        {imageOk && (
          <image
            href={imageUrl}
            x={-(col * pieceW)}
            y={-(row * pieceH)}
            width={boardW}
            height={boardH}
            preserveAspectRatio="none"
            clipPath={`url(#${clipId})`}
            style={{ pointerEvents: "none" }}
          />
        )}

        <g clipPath={`url(#${clipId})`} style={{ pointerEvents: "none" }}>
          <rect x={0} y={0} width={pieceW} height={pieceH} fill={`url(#${lightWashId})`} opacity={isDragging ? 0.12 : 0.07} />
          <rect x={0} y={0} width={pieceW} height={pieceH} fill={`url(#${shadeWashId})`} opacity={isDragging ? 0.12 : 0.07} />
        </g>

        <path
          d={d}
          fill={imageOk === false ? "rgba(255,255,255,0.06)" : "none"}
          stroke={highlight ? "rgba(0,255,255,0.52)" : "rgba(255,255,255,0.2)"}
          strokeWidth={1.25}
          style={{ pointerEvents: "none" }}
        />
        <path
          d={d}
          fill="none"
          stroke="rgba(255,255,255,0.16)"
          strokeWidth={0.8}
          style={{ pointerEvents: "none" }}
        />
        {/* Gold border animation */}
        {showGold && (
          <motion.path
            d={d}
            fill="none"
            stroke="gold"
            strokeWidth={4.5}
            initial={{ opacity: 0 }}
            animate={{ opacity: goldOpacity }}
            style={{ pointerEvents: "none" }}
          />
        )}
        <path d={d} fill="none" stroke="transparent" strokeWidth={16} style={{ pointerEvents: "none" }} />
      </svg>
    </div>
  );
}

const MemoJigsawPiece = React.memo(
  JigsawPiece,
  (prev, next) => {
    // Ignore function identity props (e.g. onPointerDown) so pieces don't rerender
    // during drag; ensure the handler itself reads latest state via refs.
    const prevEdges = prev.edges;
    const nextEdges = next.edges;

    return (
      prev.id === next.id &&
      prev.row === next.row &&
      prev.col === next.col &&
      prev.pieceW === next.pieceW &&
      prev.pieceH === next.pieceH &&
      prev.boardW === next.boardW &&
      prev.boardH === next.boardH &&
      prev.boardLeft === next.boardLeft &&
      prev.boardTop === next.boardTop &&
      prev.imageUrl === next.imageUrl &&
      prev.imageOk === next.imageOk &&
      prev.pos.x === next.pos.x &&
      prev.pos.y === next.pos.y &&
      prev.z === next.z &&
      prev.groupId === next.groupId &&
      prev.highlight === next.highlight &&
      prev.snapped === next.snapped &&
      prev.isDragging === next.isDragging &&
      prev.dragDx === next.dragDx &&
      prev.dragDy === next.dragDy &&
      prev.snapDx === next.snapDx &&
      prev.snapDy === next.snapDy &&
      prev.snapAnimating === next.snapAnimating &&
      prev.tabRadius === next.tabRadius &&
      prev.tabDepth === next.tabDepth &&
      prev.neckWidth === next.neckWidth &&
      prev.neckDepth === next.neckDepth &&
      prev.shoulderLen === next.shoulderLen &&
      prev.shoulderDepth === next.shoulderDepth &&
      prev.cornerInset === next.cornerInset &&
      prev.smooth === next.smooth &&
      prevEdges.top === nextEdges.top &&
      prevEdges.right === nextEdges.right &&
      prevEdges.bottom === nextEdges.bottom &&
      prevEdges.left === nextEdges.left
    );
  }
);

export default function JigsawPuzzleSVGWithTray({
  imageUrl,
  rows = 4,
  cols = 6,
  boardWidth = 1200,
  boardHeight = 800,
  stagePadding = 0,
  trayHeight = 800,
  neighborSnapTolerance = 24,
  boardSnapTolerance = 18,
  trayScatter = 24,
  tabRadius = 0.18,
  tabDepth = 0.22,
  neckWidth = 0.22,
  neckDepth = 0.10,
  shoulderLen = 0.22,
  shoulderDepth = 0.08,
  cornerInset = 1,
  smooth = 0.55,
  onComplete,
  onShowRatingModal,
  suppressInternalCongrats = false,
  containerStyle = {},
  onControlsReady,
  puzzleId,
  tableBackground,
}: JigsawPuzzleSVGWithTrayProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const shimmerOuterRef = useRef<HTMLDivElement>(null);
  const shimmerInnerRef = useRef<HTMLDivElement>(null);
  const shimmerInnerBRef = useRef<HTMLDivElement>(null);
  const shimmerInnerCRef = useRef<HTMLDivElement>(null);
  const flareOuterRef = useRef<HTMLDivElement>(null);
  const energyRingRef = useRef<HTMLDivElement>(null);
  const energyGlowRef = useRef<HTMLDivElement>(null);
  const messageRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const isFullscreenRef = useRef(false);
  const [portalReady, setPortalReady] = useState(false);
  const [fsScale, setFsScale] = useState<number>(1);
  const [fsPan, setFsPan] = useState<PiecePosition>({ x: 0, y: 0 });
  const pointersRef = useRef<Map<number, { x: number; y: number; targetIsPiece: boolean }>>(new Map());
  const pinchRef = useRef<{ active: boolean; startDist: number; startScale: number; startPan: PiecePosition; centerClientX: number; centerClientY: number } | null>(null);
  const [scale, setScale] = useState<number>(1);
  const scaleRef = useRef<number>(1);
  // Non-fullscreen user-controlled zoom (multiplied on top of the auto-fit scale) + pan
  const [nfUserScale, setNfUserScale] = useState<number>(1);
  const nfUserScaleRef = useRef<number>(1);
  const [nfPan, setNfPan] = useState<PiecePosition>({ x: 0, y: 0 });
  const nfPanRef = useRef<PiecePosition>({ x: 0, y: 0 });
  // Detect touch/mobile device for UX hints
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [mobileFsHintDismissed, setMobileFsHintDismissed] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [wrapperWidth, setWrapperWidth] = useState<number | null>(null);
  const [wrapperHeight, setWrapperHeight] = useState<number | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const completedRef = useRef<boolean>(false);
  const [showCongrats, setShowCongrats] = useState(false);
  const [awardedPoints, setAwardedPoints] = useState<number | null>(null);
  const storageKeyRef = useRef<string>('');
  const savedElapsedMsRef = useRef<number>(0);
  const [resumedFromSave, setResumedFromSave] = useState(false);
  const resumedTimerRef = useRef<NodeJS.Timeout | null>(null);
  // Allow panning/zooming in fullscreen but clamp to content bounds.
  const fullscreenPanEnabled = true;

  React.useEffect(() => {
    isFullscreenRef.current = isFullscreen;
  }, [isFullscreen]);

  React.useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  const fsScaleRef = useRef<number>(1);
  const fsPanRef = useRef<PiecePosition>({ x: 0, y: 0 });

  React.useEffect(() => {
    fsScaleRef.current = fsScale;
  }, [fsScale]);

  React.useEffect(() => {
    fsPanRef.current = fsPan;
  }, [fsPan]);

  React.useEffect(() => {
    nfUserScaleRef.current = nfUserScale;
  }, [nfUserScale]);

  React.useEffect(() => {
    nfPanRef.current = nfPan;
  }, [nfPan]);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const coarse = window.matchMedia('(pointer: coarse)').matches || ('ontouchstart' in window);
    setIsTouchDevice(coarse);
  }, []);

  React.useEffect(() => {
    // Only portal fullscreen UI after mount (document available)
    setPortalReady(true);
  }, []);

  React.useEffect(() => {
    if (!isFullscreen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFullscreen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isFullscreen]);

  const clampFullscreenPan = (pan: PiecePosition, scaleVal: number): PiecePosition => {
    const wrapper = wrapperRef.current;
    const wrapperW = wrapper?.clientWidth || (typeof window !== 'undefined' ? window.innerWidth : stageWidth);
    const wrapperH = wrapper?.clientHeight || (typeof window !== 'undefined' ? window.innerHeight : stageHeight);

    const visibleW = wrapperW / (scaleVal || 1);
    const visibleH = wrapperH / (scaleVal || 1);

    const centerX = (visibleW - stageWidth) / 2;
    const centerY = (visibleH - stageHeight) / 2;

    // If the viewport can fully show the content, lock pan to centered.
    // Otherwise, clamp within bounds (0 aligns top/left).
    const minX = visibleW >= stageWidth ? centerX : (visibleW - stageWidth);
    const maxX = visibleW >= stageWidth ? centerX : 0;
    const minY = visibleH >= stageHeight ? centerY : (visibleH - stageHeight);
    const maxY = visibleH >= stageHeight ? centerY : 0;

    return {
      x: clamp(pan.x, minX, maxX),
      y: clamp(pan.y, minY, maxY),
    };
  };

  /** Clamp non-fullscreen user pan so content doesn't drift completely off-screen. */
  const clampNfPan = (pan: PiecePosition, userScaleVal: number): PiecePosition => {
    const wrapper = wrapperRef.current;
    const wrapperW = wrapper?.clientWidth || stageWidth;
    const wrapperH = wrapper?.clientHeight || (nonFullscreenHeight || stageHeight);
    const totalScale = Math.max(0.01, (nonFullscreenScale || 1) * (userScaleVal || 1));
    const visibleW = wrapperW / totalScale;
    const visibleH = wrapperH / totalScale;
    const centerX = (visibleW - stageWidth) / 2;
    const centerY = (visibleH - stageHeight) / 2;
    const minX = visibleW >= stageWidth ? centerX : (visibleW - stageWidth);
    const maxX = visibleW >= stageWidth ? centerX : 0;
    const minY = visibleH >= stageHeight ? centerY : (visibleH - stageHeight);
    const maxY = visibleH >= stageHeight ? centerY : 0;
    return { x: clamp(pan.x, minX, maxX), y: clamp(pan.y, minY, maxY) };
  };

  const pieceW = boardWidth / cols;
  const pieceH = boardHeight / rows;
  const scatterMargin = useMemo(() => {
    // Unscaled stage-space margin around the board reserved for loose pieces.
    // Roughly ~1.35 piece size plus a small buffer.
    const base = Math.max(pieceW, pieceH);
    return Math.round(base * 1.35 + 48);
  }, [pieceW, pieceH]);
  const [imageOk, setImageOk] = useState<boolean | null>(null);
  const [imageReloadKey, setImageReloadKey] = useState(0);
  const [proxyAttempted, setProxyAttempted] = useState(false);
  const [effectiveImageUrl, setEffectiveImageUrl] = useState<string | null>(imageUrl || null);

  React.useEffect(() => {
    // If the app build sets NEXT_PUBLIC_FORCE_IMAGE_PROXY=true, prefer loading
    // images through the server proxy immediately to avoid CSP/CORS issues.
    const forceProxy = typeof process !== 'undefined' && (process.env.NEXT_PUBLIC_FORCE_IMAGE_PROXY === '1' || process.env.NEXT_PUBLIC_FORCE_IMAGE_PROXY === 'true');
    if (imageUrl && forceProxy) {
      setEffectiveImageUrl(`/api/image-proxy?url=${encodeURIComponent(imageUrl)}`);
    } else {
      setEffectiveImageUrl(imageUrl || null);
    }
    setImageOk(null);
    setProxyAttempted(false);
  }, [imageUrl]);

  React.useEffect(() => {
    const target = effectiveImageUrl;
    if (!target) {
      setImageOk(false);
      return;
    }

    let cancelled = false;
    const tryLoad = (src: string, onSuccess: () => void, onError: () => void) => {
      const img = new Image();
      try { img.crossOrigin = 'anonymous'; } catch {}
      img.onload = () => { if (!cancelled) onSuccess(); };
      img.onerror = () => { if (!cancelled) onError(); };
      img.src = src;
      return () => { cancelled = true; img.onload = null; img.onerror = null; };
    };

    // First, try direct load
    let cleanup = tryLoad(target, () => setImageOk(true), async () => {
      console.warn('[Jigsaw] direct image load failed for', target);
      if (!proxyAttempted && imageUrl) {
        // attempt proxy
        setProxyAttempted(true);
        const proxy = `/api/image-proxy?url=${encodeURIComponent(imageUrl)}`;
        setEffectiveImageUrl(proxy);
        // Let the proxy attempt run in its own effect (by updating effectiveImageUrl)
      } else {
        setImageOk(false);
      }
    });

    return () => {
      cancelled = true;
      if (cleanup) cleanup();
    };
  }, [effectiveImageUrl, imageReloadKey, proxyAttempted]);

  const nonFullscreenScale = Math.max(0.06, (Number.isFinite(scale) && scale > 0 ? scale : 1));

  const nonFullscreenHeight = (() => {
    if (typeof window === 'undefined') return 780;
    const vh = window.innerHeight || 800;
    // Give extra vertical space for scattered pieces around the board.
    // Clamp so it doesn't become absurdly tall on desktop.
    const target = Math.round(vh * 0.98);
    return Math.max(820, Math.min(1600, target));
  })();

  // Stage layout: board centered, loose pieces scattered around it (no tray).
  // In non-fullscreen, we treat the wrapper as the visible area and make the stage fill it.
  // Stage coordinates are "unscaled" and then we apply `scale()` to fit.
  //
  // IMPORTANT: use the mode-appropriate scale so the world dimensions (and therefore
  // boardLeft/boardTop) stay the same whether or not the user is in fullscreen. This
  // prevents piece positions from jumping when toggling fullscreen on maximised browsers
  // (the most common case) where the container and viewport widths are equal.
  const stageWidth = useMemo(() => {
    const minStageW = boardWidth + scatterMargin * 2;
    const wPx = wrapperWidth ?? boardWidth;
    // In fullscreen use fsScale so the world size matches what fsScale was calibrated against.
    // In normal mode use nonFullscreenScale.
    const effectiveScale = isFullscreen
      ? (Number.isFinite(fsScale) && fsScale > 0 ? fsScale : 1)
      : (nonFullscreenScale || 1);
    return Math.max(minStageW, Math.round(wPx / effectiveScale));
  }, [isFullscreen, wrapperWidth, boardWidth, nonFullscreenScale, fsScale, scatterMargin]);

  const stageHeight = useMemo(() => {
    const minStageH = boardHeight + scatterMargin * 2;
    const hPx = (wrapperHeight ?? nonFullscreenHeight) || boardHeight;
    const effectiveScale = isFullscreen
      ? (Number.isFinite(fsScale) && fsScale > 0 ? fsScale : 1)
      : (nonFullscreenScale || 1);
    return Math.max(minStageH, Math.round(hPx / effectiveScale));
  }, [isFullscreen, wrapperHeight, nonFullscreenHeight, boardHeight, nonFullscreenScale, fsScale, scatterMargin]);

  const boardLeft = Math.max(0, Math.round((stageWidth - boardWidth) / 2));
  const boardTop = Math.max(0, Math.round((stageHeight - boardHeight) / 2));

  const edgesMap = useMemo(() => buildEdges(rows, cols), [rows, cols]);

  const initialPieces = useMemo(() => {
    const pieces = [];

    const pickSpawn = () => {
      // Spawn pieces strictly outside the (padded) board rectangle so the puzzle
      // starts with the board unobscured.
      const pad = Math.max(10, Math.round(Math.min(pieceW, pieceH) * 0.08));
      const maxX = Math.max(0, stageWidth - pieceW);
      const maxY = Math.max(0, stageHeight - pieceH);

      const forbiddenLeft = boardLeft - pad;
      const forbiddenTop = boardTop - pad;
      const forbiddenRight = boardLeft + boardWidth + pad;
      const forbiddenBottom = boardTop + boardHeight + pad;

      const isOutsideForbidden = (x: number, y: number) => {
        return (
          x + pieceW <= forbiddenLeft ||
          x >= forbiddenRight ||
          y + pieceH <= forbiddenTop ||
          y >= forbiddenBottom
        );
      };

      type Rect = { x0: number; x1: number; y0: number; y1: number; area: number };
      const rects: Rect[] = [];

      const addRect = (x0: number, x1: number, y0: number, y1: number) => {
        const xx0 = Math.max(0, Math.min(maxX, x0));
        const xx1 = Math.max(0, Math.min(maxX, x1));
        const yy0 = Math.max(0, Math.min(maxY, y0));
        const yy1 = Math.max(0, Math.min(maxY, y1));
        if (xx1 > xx0 && yy1 > yy0) rects.push({ x0: xx0, x1: xx1, y0: yy0, y1: yy1, area: (xx1 - xx0) * (yy1 - yy0) });
      };

      // Disjoint "ring" regions around the board:
      // - full-height bands on the left and right
      // - top/bottom bands only over the board's x-span
      addRect(0, forbiddenLeft - pieceW, 0, maxY);
      addRect(forbiddenRight, maxX, 0, maxY);
      addRect(forbiddenLeft, forbiddenRight - pieceW, 0, forbiddenTop - pieceH);
      addRect(forbiddenLeft, forbiddenRight - pieceW, forbiddenBottom, maxY);

      if (rects.length > 0) {
        const total = rects.reduce((s, r) => s + r.area, 0) || 1;
        let pick = Math.random() * total;
        let chosen = rects[0];
        for (const r of rects) {
          pick -= r.area;
          if (pick <= 0) {
            chosen = r;
            break;
          }
        }

        // Try a few times in case extreme padding makes edge cases.
        for (let i = 0; i < 30; i++) {
          const x = chosen.x0 + Math.random() * (chosen.x1 - chosen.x0);
          const y = chosen.y0 + Math.random() * (chosen.y1 - chosen.y0);
          if (isOutsideForbidden(x, y)) return { x, y };
        }
      }

      // Fallback: rejection sample anywhere but still enforce outside.
      for (let i = 0; i < 200; i++) {
        const x = Math.random() * maxX;
        const y = Math.random() * maxY;
        if (isOutsideForbidden(x, y)) return { x, y };
      }

      // Last resort: shove to nearest side.
      const candidate = { x: Math.random() * maxX, y: Math.random() * maxY };
      if (isOutsideForbidden(candidate.x, candidate.y)) return candidate;

      const leftX = clamp(forbiddenLeft - pieceW, 0, maxX);
      const rightX = clamp(forbiddenRight, 0, maxX);
      const topY = clamp(forbiddenTop - pieceH, 0, maxY);
      const bottomY = clamp(forbiddenBottom, 0, maxY);
      const options = [
        { x: leftX, y: candidate.y },
        { x: rightX, y: candidate.y },
        { x: candidate.x, y: topY },
        { x: candidate.x, y: bottomY },
      ].filter((p) => isOutsideForbidden(p.x, p.y));

      return options[0] || { x: 0, y: 0 };
    };

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const id = `${r}-${c}`;

        const correct = {
          x: boardLeft + c * pieceW,
          y: boardTop + r * pieceH,
        };

        // spawn scattered around the board (within stage bounds)
        const spawn = pickSpawn();

        pieces.push({
          id,
          row: r,
          col: c,
          edges: edgesMap.get(id)!,
          correct,
          pos: spawn,
          groupId: id,
          z: 1,
          snapped: false,
        });
      }
    }
    return pieces;
  }, [
    rows,
    cols,
    pieceW,
    pieceH,
    boardLeft,
    boardTop,
    boardWidth,
    boardHeight,
    stageWidth,
    stageHeight,
    edgesMap,
  ]);

  // Compute storage key whenever identity-inputs change. Use a ref so helpers can access it.
  React.useEffect(() => {
    storageKeyRef.current = getJigsawStorageKey(puzzleId, imageUrl, rows, cols);
  }, [puzzleId, imageUrl, rows, cols]);

  const [pieces, setPieces] = useState<Piece[]>(() => {
    // Lazy init: try to restore saved progress on first render
    const key = getJigsawStorageKey(puzzleId, imageUrl, rows, cols);
    storageKeyRef.current = key;
    const saved = loadJigsawProgress(key);
    if (saved && Object.keys(saved.pieces).length === rows * cols) {
      savedElapsedMsRef.current = saved.elapsedMs ?? 0;
      return applyJigsawProgress(initialPieces, saved);
    }
    return initialPieces;
  });
  const piecesRef = useRef<Piece[]>(initialPieces);

  // Adjust startTimeRef to account for previously saved elapsed time (set once after mount)
  React.useEffect(() => {
    if (savedElapsedMsRef.current > 0) {
      startTimeRef.current = Date.now() - savedElapsedMsRef.current;
      setResumedFromSave(true);
      if (resumedTimerRef.current) clearTimeout(resumedTimerRef.current);
      resumedTimerRef.current = setTimeout(() => setResumedFromSave(false), 3500);
    }
    return () => { if (resumedTimerRef.current) clearTimeout(resumedTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    piecesRef.current = pieces;
  }, [pieces]);

  // Auto-save whenever pieces change (debounced 800 ms).
  // Skip while in fullscreen: the world-coordinate system may differ from normal mode
  // (boardLeft can shift on non-maximised browsers), so we only persist positions in
  // the stable non-fullscreen coordinate space.
  React.useEffect(() => {
    if (completedRef.current) return; // don't overwrite after completion
    if (isFullscreenRef.current) return; // save only in the stable non-fullscreen coordinate space
    const key = storageKeyRef.current;
    if (!key) return;
    const elapsedMs = Math.max(0, Date.now() - startTimeRef.current);
    const id = setTimeout(() => {
      if (isFullscreenRef.current) return; // re-check inside the debounce
      saveJigsawProgress(key, piecesRef.current, elapsedMs);
    }, 800);
    return () => clearTimeout(id);
  }, [pieces]);

  // When exiting fullscreen, trigger a save so we don't lose progress made during a 
  // fullscreen session (the coordinate space is now stable again).
  React.useEffect(() => {
    if (isFullscreen) return; // only fires on exit (false)
    if (completedRef.current) return;
    const key = storageKeyRef.current;
    if (!key) return;
    const elapsedMs = Math.max(0, Date.now() - startTimeRef.current);
    // Delay slightly so the board sync effect has time to reposition snapped pieces first
    const id = setTimeout(() => saveJigsawProgress(key, piecesRef.current, elapsedMs), 300);
    return () => clearTimeout(id);
  }, [isFullscreen]);

  // Reset pieces when initialPieces changes (e.g., layout switches stacked vs side-by-side)
  // Initialize pieces when core puzzle inputs change (rows/cols/image).
  // Avoid resetting pieces on layout/scale changes to prevent mid-play resets.
  React.useEffect(() => {
    const key = getJigsawStorageKey(puzzleId, imageUrl, rows, cols);
    storageKeyRef.current = key;
    const saved = loadJigsawProgress(key);
    if (saved && Object.keys(saved.pieces).length === rows * cols) {
      savedElapsedMsRef.current = saved.elapsedMs ?? 0;
      startTimeRef.current = Date.now() - savedElapsedMsRef.current;
      setPieces(applyJigsawProgress(initialPieces, saved));
      setResumedFromSave(true);
      if (resumedTimerRef.current) clearTimeout(resumedTimerRef.current);
      resumedTimerRef.current = setTimeout(() => setResumedFromSave(false), 3500);
    } else {
      savedElapsedMsRef.current = 0;
      setPieces(initialPieces);
      startTimeRef.current = Date.now();
    }
    completedRef.current = false;
    hasInteractedRef.current = false;
    // Reset user pan/zoom when the puzzle changes
    setNfUserScale(1);
    setNfPan({ x: 0, y: 0 });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, cols, imageUrl]);

  // The board is centered based on wrapper size, so `boardLeft/boardTop` can change after mount
  // (and on resizes). Keep each piece's `correct` position in sync so snapping/locking works.
  React.useEffect(() => {
    setPieces((prev) => {
      let changed = false;
      let next = prev.map((p) => {
        const correct = { x: boardLeft + p.col * pieceW, y: boardTop + p.row * pieceH };
        const correctChanged = p.correct.x !== correct.x || p.correct.y !== correct.y;
        if (!correctChanged) return p;
        changed = true;
        return {
          ...p,
          correct,
          pos: p.snapped ? { x: correct.x, y: correct.y } : p.pos,
        };
      });

      // Before the user interacts, ensure nothing is sitting on top of the board
      // after a recenter/resize. Move any loose (unsnapped) groups that overlap.
      if (!hasInteractedRef.current) {
        const pad = Math.max(10, Math.round(Math.min(pieceW, pieceH) * 0.08));
        const forbiddenLeft = boardLeft - pad;
        const forbiddenTop = boardTop - pad;
        const forbiddenRight = boardLeft + boardWidth + pad;
        const forbiddenBottom = boardTop + boardHeight + pad;

        const groupIds = [...new Set(next.map((p) => p.groupId))];
        for (const gid of groupIds) {
          const group = next.filter((p) => p.groupId === gid);
          if (group.length === 0) continue;
          if (group.some((p) => p.snapped)) continue;

          const minX = Math.min(...group.map((p) => p.pos.x));
          const minY = Math.min(...group.map((p) => p.pos.y));
          const maxX = Math.max(...group.map((p) => p.pos.x));
          const maxY = Math.max(...group.map((p) => p.pos.y));
          const groupW = (maxX - minX) + pieceW;
          const groupH = (maxY - minY) + pieceH;

          const overlapsForbidden = !(
            minX + groupW <= forbiddenLeft ||
            minX >= forbiddenRight ||
            minY + groupH <= forbiddenTop ||
            minY >= forbiddenBottom
          );

          if (!overlapsForbidden) continue;

          const maxSpawnX = Math.max(0, stageWidth - groupW);
          const maxSpawnY = Math.max(0, stageHeight - groupH);

          const isOutsideForbidden = (x: number, y: number) => {
            return (
              x + groupW <= forbiddenLeft ||
              x >= forbiddenRight ||
              y + groupH <= forbiddenTop ||
              y >= forbiddenBottom
            );
          };

          type Rect = { x0: number; x1: number; y0: number; y1: number; area: number };
          const rects: Rect[] = [];
          const addRect = (x0: number, x1: number, y0: number, y1: number) => {
            const xx0 = Math.max(0, Math.min(maxSpawnX, x0));
            const xx1 = Math.max(0, Math.min(maxSpawnX, x1));
            const yy0 = Math.max(0, Math.min(maxSpawnY, y0));
            const yy1 = Math.max(0, Math.min(maxSpawnY, y1));
            if (xx1 > xx0 && yy1 > yy0) rects.push({ x0: xx0, x1: xx1, y0: yy0, y1: yy1, area: (xx1 - xx0) * (yy1 - yy0) });
          };

          addRect(0, forbiddenLeft - groupW, 0, maxSpawnY);
          addRect(forbiddenRight, maxSpawnX, 0, maxSpawnY);
          addRect(forbiddenLeft, forbiddenRight - groupW, 0, forbiddenTop - groupH);
          addRect(forbiddenLeft, forbiddenRight - groupW, forbiddenBottom, maxSpawnY);

          let target: { x: number; y: number } | null = null;
          if (rects.length > 0) {
            const total = rects.reduce((s, r) => s + r.area, 0) || 1;
            let pick = Math.random() * total;
            let chosen = rects[0];
            for (const r of rects) {
              pick -= r.area;
              if (pick <= 0) {
                chosen = r;
                break;
              }
            }
            for (let i = 0; i < 30; i++) {
              const x = chosen.x0 + Math.random() * (chosen.x1 - chosen.x0);
              const y = chosen.y0 + Math.random() * (chosen.y1 - chosen.y0);
              if (isOutsideForbidden(x, y)) {
                target = { x, y };
                break;
              }
            }
          }

          if (!target) {
            for (let i = 0; i < 200; i++) {
              const x = Math.random() * maxSpawnX;
              const y = Math.random() * maxSpawnY;
              if (isOutsideForbidden(x, y)) {
                target = { x, y };
                break;
              }
            }
          }

          if (!target) continue;
          const dx = target.x - minX;
          const dy = target.y - minY;
          next = next.map((p) => (p.groupId === gid ? { ...p, pos: { x: p.pos.x + dx, y: p.pos.y + dy } } : p));
          changed = true;
        }
      }

      // After repositioning, clamp all loose pieces to ensure they stay within visible stage bounds
      // during orientation/resize changes (especially important on mobile).
      // SKIP in fullscreen: the stage world is navigated via pan/zoom and clamping pieces to the
      // (potentially smaller) fullscreen stage bounds would permanently misplace them.
      if (!isFullscreen) {
        const maxX = Math.max(0, stageWidth - pieceW);
        const maxY = Math.max(0, stageHeight - pieceH);
        next = next.map((p) => {
          if (p.snapped) return p;
          const clampedX = Math.max(0, Math.min(maxX, p.pos.x));
          const clampedY = Math.max(0, Math.min(maxY, p.pos.y));
          if (clampedX !== p.pos.x || clampedY !== p.pos.y) {
            changed = true;
            return { ...p, pos: { x: clampedX, y: clampedY } };
          }
          return p;
        });
      }

      return changed ? next : prev;
    });
  }, [boardLeft, boardTop, boardWidth, boardHeight, stageWidth, stageHeight, pieceW, pieceH, isFullscreen]);

  const effectiveSnapScale = isFullscreen ? (fsScale || 1) : (nonFullscreenScale || 1);
  const effectiveBoardSnapTolerance = boardSnapTolerance / (effectiveSnapScale || 1);
  const effectiveNeighborSnapTolerance = neighborSnapTolerance / (effectiveSnapScale || 1);

  const hasInteractedRef = useRef(false);

  // Track which group is currently being dragged (for consistent re-render)
  const [draggingGroupId, setDraggingGroupId] = useState<string | null>(null);

  // Performance: don't rewrite every piece's position on each pointer move.
  // Track a single drag delta, apply it via CSS translate, and commit once on drop.
  const [dragDelta, setDragDelta] = useState<{ dx: number; dy: number }>({ dx: 0, dy: 0 });
  const dragDeltaRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });
  const pendingDragDeltaRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });
  const dragRafRef = useRef<number | null>(null);

  // Magnetic snap animation: apply a temporary transform offset to the snapped
  // group and ease it to the final locked position.
  const [snapAnim, setSnapAnim] = useState<null | { groupId: string; dx: number; dy: number; phase: 'offset' | 'toZero' }>(null);
  const snapAnimRafRef = useRef<number | null>(null);
  const snapAnimTimeoutRef = useRef<number | null>(null);

  const triggerMagneticSnap = useCallback((groupId: string, snapDx: number, snapDy: number) => {
    if (!groupId) return;
    if (!Number.isFinite(snapDx) || !Number.isFinite(snapDy)) return;
    if (snapDx === 0 && snapDy === 0) return;

    if (snapAnimRafRef.current != null) {
      cancelAnimationFrame(snapAnimRafRef.current);
      snapAnimRafRef.current = null;
    }
    if (snapAnimTimeoutRef.current != null) {
      window.clearTimeout(snapAnimTimeoutRef.current);
      snapAnimTimeoutRef.current = null;
    }

    // Start at an opposite offset so the snap doesn't visually jump.
    setSnapAnim({ groupId, dx: -snapDx, dy: -snapDy, phase: 'offset' });
    snapAnimRafRef.current = requestAnimationFrame(() => {
      snapAnimRafRef.current = null;
      setSnapAnim({ groupId, dx: 0, dy: 0, phase: 'toZero' });
      snapAnimTimeoutRef.current = window.setTimeout(() => {
        snapAnimTimeoutRef.current = null;
        setSnapAnim(null);
      }, 210);
    });
  }, []);

  const dragRef = useRef<{
    active: boolean;
    pointerId: number | null;
    groupId: string | null;
    startPositions: Map<string, PiecePosition>;
    anchorPieceId: string | null;
    anchorOffset: PiecePosition;
  }>({
    active: false,
    pointerId: null,
    groupId: null,
    startPositions: new Map(),
    anchorPieceId: null,
    anchorOffset: { x: 0, y: 0 },
  });

  interface IndexByIdMap {
    [id: string]: Piece;
  }

  type PieceArray = Piece[];

  const indexById = (arr: PieceArray): Map<string, Piece> => {
    const m = new Map<string, Piece>();
    for (const p of arr) m.set(p.id, p);
    return m;
  };

  interface GetGroupPieceIdsFn {
    (arr: Piece[], groupId: string): string[];
  }

  const getGroupPieceIds: GetGroupPieceIdsFn = (arr, groupId) =>
    arr.filter((p) => p.groupId === groupId).map((p) => p.id);

  interface BringGroupToFrontFn {
    (groupId: string): void;
  }

  const bringGroupToFront: BringGroupToFrontFn = useCallback((groupId) => {
    setPieces((prev: Piece[]) => {
      const maxZ = prev.reduce((m, p) => Math.max(m, p.z), 1);
      return prev.map((p: Piece) => (p.groupId === groupId ? { ...p, z: maxZ + 1 } : p));
    });
  }, []);

  interface TranslateGroupFn {
    (
      arr: Piece[],
      groupId: string,
      dx: number,
      dy: number
    ): Piece[];
  }

  const translateGroup: TranslateGroupFn = (arr, groupId, dx, dy) =>
    arr.map((p) =>
      p.groupId === groupId
        ? {
            ...p,
            pos: { x: (p.pos.x + dx) || 0, y: (p.pos.y + dy) || 0 },
          }
        : p
    );

  const normalizeGroupToCorrectOffsets = (arr: Piece[], groupId: string): Piece[] => {
    const group = arr.filter((p) => p.groupId === groupId);
    if (group.length <= 1) return arr;

    // If any piece in the group is snapped (placed), the entire group must be
    // locked to the puzzle grid. This prevents a snapped group from drifting
    // off-grid due to anchor-based normalization during neighbor merges.
    if (group.some((p) => p.snapped)) {
      return arr.map((p) =>
        p.groupId === groupId
          ? { ...p, snapped: true, pos: { x: p.correct.x, y: p.correct.y } }
          : p
      );
    }

    // Pick a stable anchor: top-left-most (then id for tie-break).
    const anchor = [...group].sort((a, b) => (a.pos.y - b.pos.y) || (a.pos.x - b.pos.x) || a.id.localeCompare(b.id))[0];
    const ax = anchor.pos.x;
    const ay = anchor.pos.y;

    return arr.map((p) => {
      if (p.groupId !== groupId) return p;
      const dx = p.correct.x - anchor.correct.x;
      const dy = p.correct.y - anchor.correct.y;
      return {
        ...p,
        pos: { x: ax + dx, y: ay + dy },
      };
    });
  };

  const computeGroupTranslationToCorrect = (group: Piece[]) => {
    if (group.length === 0) return { dx: 0, dy: 0, maxErr: Infinity };
    const dxs = group.map((p) => p.correct.x - p.pos.x).sort((a, b) => a - b);
    const dys = group.map((p) => p.correct.y - p.pos.y).sort((a, b) => a - b);
    const mid = Math.floor(group.length / 2);
    const dx = dxs[mid];
    const dy = dys[mid];
    let maxErr = 0;
    for (const p of group) {
      const ex = (p.correct.x - p.pos.x) - dx;
      const ey = (p.correct.y - p.pos.y) - dy;
      maxErr = Math.max(maxErr, hypot(ex, ey));
    }
    return { dx, dy, maxErr };
  };

  interface MergeGroupsFn {
    (arr: Piece[], aGroup: string, bGroup: string): Piece[];
  }

  const mergeGroups: MergeGroupsFn = (arr, aGroup, bGroup) =>
    aGroup === bGroup
      ? arr
      : (() => {
          // If the target group (aGroup) is snapped, mark merged pieces as snapped too.
          // Avoid forcing per-piece absolute positions here (they will have been
          // translated into place by the caller), which reduces visual jumps.
          const aGroupSnapped = arr.some((p) => p.groupId === aGroup && p.snapped);
          return arr.map((p) =>
            p.groupId === bGroup
              ? {
                  ...p,
                  groupId: aGroup,
                  snapped: aGroupSnapped || p.snapped,
                }
              : p
          );
        })();

  interface NeighborIdFn {
    (row: number, col: number): string | null;
  }

  const neighborId: NeighborIdFn = (row, col) => {
    if (row < 0 || col < 0 || row >= rows || col >= cols) return null;
    return `${row}-${col}`;
  };

  interface SnapGroupToBoardIfCloseResult {
    pieces: Piece[];
    didSnap: boolean;
    dx: number;
    dy: number;
  }

  interface SnapGroupToBoardIfCloseFn {
    (arr: Piece[], groupId: string): SnapGroupToBoardIfCloseResult;
  }

  const snapGroupToBoardIfClose: SnapGroupToBoardIfCloseFn = (arr, groupId) => {
    const group: Piece[] = arr.filter((p) => p.groupId === groupId);
    if (group.length === 0) return { pieces: arr, didSnap: false, dx: 0, dy: 0 };

    // Only lock-to-board if the whole group is already a rigid translation of its
    // correct placement (prevents “random”/drifted groups from teleporting).
    const { dx, dy, maxErr } = computeGroupTranslationToCorrect(group);
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return { pieces: arr, didSnap: false, dx: 0, dy: 0 };
    if (maxErr > EPS_GROUP_ALIGN_PX) return { pieces: arr, didSnap: false, dx: 0, dy: 0 };
    if (hypot(dx, dy) > effectiveBoardSnapTolerance) return { pieces: arr, didSnap: false, dx: 0, dy: 0 };

    // Snap: translate by the computed offset and then quantize to exact correct coords.
    const translated = translateGroup(arr, groupId, dx, dy);
    const pieces = translated.map((piece) =>
      piece.groupId === groupId
        ? { ...piece, snapped: true, pos: { x: piece.correct.x, y: piece.correct.y } }
        : piece
    );
    return { pieces, didSnap: true, dx, dy };
  };

  interface SnapAndMergeNeighborsFn {
    (
      arr: Piece[],
      activeGroupId: string
    ): Piece[];
  }

  interface NeighborCheck {
    nid: string | null;
    dx: number;
    dy: number;
  }

  const snapAndMergeNeighbors: SnapAndMergeNeighborsFn = (arr, activeGroupId) => {
    let changed: boolean = true;
    let next: Piece[] = arr;

    while (changed) {
      changed = false;
      const byId: Map<string, Piece> = indexById(next);
      const activePieces: Piece[] = next.filter((p) => p.groupId === activeGroupId);

      for (const p of activePieces) {
        const checks: NeighborCheck[] = [
          { nid: neighborId(p.row - 1, p.col), dx: 0, dy: -pieceH },
          { nid: neighborId(p.row, p.col + 1), dx: pieceW, dy: 0 },
          { nid: neighborId(p.row + 1, p.col), dx: 0, dy: pieceH },
          { nid: neighborId(p.row, p.col - 1), dx: -pieceW, dy: 0 },
        ];

        for (const c of checks) {
          if (!c.nid) continue;
          const n: Piece | undefined = byId.get(c.nid);
          if (!n) continue;
          if (n.groupId === activeGroupId) continue;

          // Use correct-space offsets (not raw pieceW/pieceH) so merges remain
          // grid-locked even after floating-point drift.
          const expected: PiecePosition = {
            x: p.pos.x + (n.correct.x - p.correct.x),
            y: p.pos.y + (n.correct.y - p.correct.y),
          };
          const d: number = hypot(n.pos.x - expected.x, n.pos.y - expected.y);

          if (d <= effectiveNeighborSnapTolerance) {
            const shiftX: number = expected.x - n.pos.x;
            const shiftY: number = expected.y - n.pos.y;

            next = translateGroup(next, n.groupId, shiftX, shiftY);
            next = mergeGroups(next, activeGroupId, n.groupId);
            next = normalizeGroupToCorrectOffsets(next, activeGroupId);

            changed = true;
            break;
          }
        }
        if (changed) break;
      }
    }

    return next;
  };

  interface OnPointerDownFn {
    (e: React.PointerEvent<SVGSVGElement>, pieceId: string): void;
  }

  const onPointerDown: OnPointerDownFn = useCallback((e, pieceId) => {
    const el = stageRef.current;
    if (!el) return;
    hasInteractedRef.current = true;
      // Prevent single-finger touch from scrolling the page while dragging pieces
      // but allow multi-touch (pinch) gestures to reach the browser (pinch-to-zoom).
      try { e.preventDefault(); } catch {}

    const current: Piece[] = piecesRef.current;

    // Avoid referencing the later `solved` memo here (it would be TDZ in deps);
    // compute a quick check from the latest pieces.
    const isSolvedNow = (() => {
      const g = current[0]?.groupId;
      if (!g) return false;
      if (!current.every((p) => p.groupId === g)) return false;
      const eps = 0.8;
      return current.every((p) => hypot(p.pos.x - p.correct.x, p.pos.y - p.correct.y) <= eps);
    })();
    if (isSolvedNow || completedRef.current) return;

    const byId: Map<string, Piece> = new Map(current.map((p) => [p.id, p] as const));
    const anchor: Piece | undefined = byId.get(pieceId);
    if (!anchor) return;
    if (anchor.snapped) return;

    const rect: DOMRect = el.getBoundingClientRect();
    const scaleVal = scaleRef.current;
    const nonFullscreenScale = Math.max(0.06, (Number.isFinite(scaleVal) && scaleVal > 0 ? scaleVal : 1));
    const effectiveScale = isFullscreenRef.current
      ? fsScaleRef.current
      : nonFullscreenScale * Math.max(0.1, nfUserScaleRef.current);
    const pan = isFullscreenRef.current ? fsPanRef.current : nfPanRef.current;
    const px: number = (e.clientX - rect.left) / effectiveScale - pan.x;
    const py: number = (e.clientY - rect.top) / effectiveScale - pan.y;

    const groupId: string = anchor.groupId;
    const groupPieces = current.filter((p) => p.groupId === groupId);
    const groupIds: string[] = groupPieces.map((p) => p.id);

    // Prevent dragging an entire group if any piece in the group is snapped to the board
    if (groupPieces.some((p) => p.snapped)) return;

    const startPositions: Map<string, PiecePosition> = new Map();
    for (const id of groupIds) {
      const p: Piece | undefined = byId.get(id);
      if (p) {
        startPositions.set(id, { x: p.pos.x, y: p.pos.y });
      }
    }

    dragRef.current.active = true;
    dragRef.current.pointerId = e.pointerId;
    dragRef.current.groupId = groupId;
    dragRef.current.startPositions = startPositions;
    dragRef.current.anchorPieceId = pieceId;
    dragRef.current.anchorOffset = { x: px - anchor.pos.x, y: py - anchor.pos.y };

    // reset delta
    dragDeltaRef.current = { dx: 0, dy: 0 };
    pendingDragDeltaRef.current = { dx: 0, dy: 0 };
    setDragDelta({ dx: 0, dy: 0 });

    setDraggingGroupId(groupId); // trigger re-render for drag scale
    bringGroupToFront(groupId);
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [bringGroupToFront]);

  interface OnPointerMoveEvent extends React.PointerEvent<HTMLDivElement> {
    pointerId: number;
    clientX: number;
    clientY: number;
  }

  interface OnPointerMoveFn {
    (e: OnPointerMoveEvent): void;
  }

  const onPointerMove: OnPointerMoveFn = (e) => {
    if (!dragRef.current.active) return;
    if (e.pointerId !== dragRef.current.pointerId) return;

    const outer = stageRef.current;
    if (!outer) return;

    const rect: DOMRect = outer.getBoundingClientRect();
    const nonFullscreenScale = Math.max(0.06, (Number.isFinite(scale) && scale > 0 ? scale : 1));
    const effectiveScale = isFullscreen
      ? fsScale
      : nonFullscreenScale * Math.max(0.1, nfUserScale);
    const pan = isFullscreen ? fsPan : nfPan;

    // Visible viewport in content (stage) coordinates.
    const visibleW = rect.width / (effectiveScale || 1);
    const visibleH = rect.height / (effectiveScale || 1);
    const viewLeft = -pan.x;
    const viewTop = -pan.y;
    const viewRight = viewLeft + visibleW;
    const viewBottom = viewTop + visibleH;

    const px: number = (e.clientX - rect.left) / effectiveScale - pan.x;
    const py: number = (e.clientY - rect.top) / effectiveScale - pan.y;

    const groupId: string | null = dragRef.current.groupId;
    const anchorId: string | null = dragRef.current.anchorPieceId;
    const startPositions: Map<string, PiecePosition> = dragRef.current.startPositions;

    if (!anchorId) return;
    const anchorStart: PiecePosition | undefined = startPositions.get(anchorId);
    if (!anchorStart) return;

    const nx: number = px - dragRef.current.anchorOffset.x;
    const ny: number = py - dragRef.current.anchorOffset.y;

    let dx: number = nx - anchorStart.x;
    let dy: number = ny - anchorStart.y;

    // Clamp dragging to the currently visible viewport so pieces cannot be dragged
    // outside the viewable area (fullscreen or not).
    const groupPieceStarts: PiecePosition[] = [];
    for (const [id, sp] of startPositions.entries()) {
      if (id) groupPieceStarts.push(sp);
    }

    if (groupPieceStarts.length > 0) {
      const minX = Math.min(...groupPieceStarts.map((p) => p.x));
      const minY = Math.min(...groupPieceStarts.map((p) => p.y));
      const maxX = Math.max(...groupPieceStarts.map((p) => p.x));
      const maxY = Math.max(...groupPieceStarts.map((p) => p.y));
      const groupW = (maxX - minX) + pieceW;
      const groupH = (maxY - minY) + pieceH;

      const dxA = (viewLeft) - minX;
      const dxB = (viewRight - groupW) - minX;
      const dyA = (viewTop) - minY;
      const dyB = (viewBottom - groupH) - minY;

      dx = clamp(dx, Math.min(dxA, dxB), Math.max(dxA, dxB));
      dy = clamp(dy, Math.min(dyA, dyB), Math.max(dyA, dyB));
    } else {
      const dxA = (viewLeft) - anchorStart.x;
      const dxB = (viewRight - pieceW) - anchorStart.x;
      const dyA = (viewTop) - anchorStart.y;
      const dyB = (viewBottom - pieceH) - anchorStart.y;

      dx = clamp(dx, Math.min(dxA, dxB), Math.max(dxA, dxB));
      dy = clamp(dy, Math.min(dyA, dyB), Math.max(dyA, dyB));
    }

    // rAF throttle: update a single small state object instead of remapping all pieces.
    pendingDragDeltaRef.current = { dx, dy };
    if (dragRafRef.current == null) {
      dragRafRef.current = requestAnimationFrame(() => {
        dragRafRef.current = null;
        dragDeltaRef.current = pendingDragDeltaRef.current;
        setDragDelta(pendingDragDeltaRef.current);
      });
    }
  };

  interface OnPointerUpEvent extends React.PointerEvent<HTMLDivElement> {
    pointerId: number;
  }

  interface OnPointerUpFn {
    (e: OnPointerUpEvent): void;
  }

  const onPointerUp: OnPointerUpFn = (e) => {
    if (!dragRef.current.active) return;
    if (e.pointerId !== dragRef.current.pointerId) return;

    const activeGroupId = dragRef.current.groupId;
    const startPositions: Map<string, PiecePosition> = dragRef.current.startPositions;
    const { dx, dy } = dragDeltaRef.current;

    dragRef.current.active = false;
    dragRef.current.pointerId = null;
    dragRef.current.groupId = null;

    setDraggingGroupId(null); // trigger re-render for drag scale

    // Clear the visual delta (we'll commit to state below).
    dragDeltaRef.current = { dx: 0, dy: 0 };
    pendingDragDeltaRef.current = { dx: 0, dy: 0 };
    setDragDelta({ dx: 0, dy: 0 });

    // Compute the post-drop state from the latest pieces snapshot. This lets us
    // also trigger a magnetic snap animation in the same render (no visible jump).
    const prev: Piece[] = piecesRef.current;
    let next: Piece[] = prev;

    if (activeGroupId && (dx !== 0 || dy !== 0)) {
      next = next.map((p: Piece) => {
        if (p.groupId !== activeGroupId) return p;
        const sp: PiecePosition | undefined = startPositions.get(p.id);
        if (!sp) return p;
        return { ...p, pos: { x: sp.x + dx, y: sp.y + dy } };
      });
    }

    let lastSnap: { dx: number; dy: number } | null = null;
    if (activeGroupId) {
      const s1 = snapGroupToBoardIfClose(next, activeGroupId);
      next = s1.pieces;
      if (s1.didSnap) lastSnap = { dx: s1.dx, dy: s1.dy };

      next = snapAndMergeNeighbors(next, activeGroupId);

      const s2 = snapGroupToBoardIfClose(next, activeGroupId);
      next = s2.pieces;
      if (s2.didSnap) lastSnap = { dx: s2.dx, dy: s2.dy };
    }

    if (activeGroupId && lastSnap) {
      triggerMagneticSnap(activeGroupId, lastSnap.dx, lastSnap.dy);
    }

    setPieces(next);

    // release any stage pointer captures related to gestures
    try {
      if (stageRef.current) {
        // release any pointer captures we might have set on the stage
        for (const p of Array.from(pointersRef.current.keys())) {
          try { stageRef.current.releasePointerCapture(p); } catch {}
        }
        pointersRef.current.clear();
        pinchRef.current = null;
      }
    } catch (e) {
      // ignore
    }
  };

  const groupsCount = useMemo(() => new Set(pieces.map((p) => p.groupId)).size, [pieces]);

  // Stage gesture handlers (pan / pinch-to-zoom)
  const onStagePointerDown = (e: React.PointerEvent) => {
    const outer = stageRef.current;
    if (!outer) return;
    // Don't interfere with buttons or other interactive elements
    if ((e.target as HTMLElement).closest('button, a, input, select, textarea')) return;
    hasInteractedRef.current = true;
    const targetIsPiece = (e.target as HTMLElement).closest('[data-piece-id]') !== null;
    if (isFullscreen && !fullscreenPanEnabled && !targetIsPiece) return;
    try { outer.setPointerCapture(e.pointerId); } catch {}
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY, targetIsPiece });

    const pts = Array.from(pointersRef.current.values()).filter(p => !p.targetIsPiece);
    if (pts.length === 1) {
      // start pan — capture current scale+pan for whichever mode we're in
      const startScale = isFullscreen ? fsScale : nfUserScale;
      const startPan = isFullscreen ? fsPan : nfPan;
      pinchRef.current = { active: false, startDist: 0, startScale, startPan, centerClientX: pts[0].x, centerClientY: pts[0].y };
    } else if (pts.length >= 2) {
      // start pinch
      const p1 = pts[0];
      const p2 = pts[1];
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const dist = Math.hypot(dx, dy) || 1;
      const centerX = (p1.x + p2.x) / 2;
      const centerY = (p1.y + p2.y) / 2;
      const startScale = isFullscreen ? fsScale : nfUserScale;
      const startPan = isFullscreen ? fsPan : nfPan;
      pinchRef.current = { active: true, startDist: dist, startScale, startPan, centerClientX: centerX, centerClientY: centerY };
    }
  };

  const onStagePointerMove = (e: React.PointerEvent) => {
    const outer = stageRef.current;
    if (!outer) return;
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY, targetIsPiece: pointersRef.current.get(e.pointerId)!.targetIsPiece });

    const pts = Array.from(pointersRef.current.values()).filter(p => !p.targetIsPiece);
    const rect = outer.getBoundingClientRect();
    if (isFullscreen && !fullscreenPanEnabled) return;
    if (pts.length >= 2 && pinchRef.current && pinchRef.current.startDist > 0) {
      const p1 = pts[0];
      const p2 = pts[1];
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const dist = Math.hypot(dx, dy) || 1;
      const scaleFactor = dist / pinchRef.current.startDist;
      const centerX = (p1.x + p2.x) / 2;
      const centerY = (p1.y + p2.y) / 2;
      if (isFullscreen) {
        const FS_SCALE_MIN = 0.1;
        const FS_SCALE_MAX = 4;
        const newScale = clamp(pinchRef.current.startScale * scaleFactor, FS_SCALE_MIN, FS_SCALE_MAX);
        // keep focal point stable
        const contentLocalX = (centerX - rect.left) / pinchRef.current.startScale - pinchRef.current.startPan.x;
        const contentLocalY = (centerY - rect.top) / pinchRef.current.startScale - pinchRef.current.startPan.y;
        const newPanX = (centerX - rect.left) / newScale - contentLocalX;
        const newPanY = (centerY - rect.top) / newScale - contentLocalY;
        setFsScale(newScale);
        setFsPan(clampFullscreenPan({ x: newPanX, y: newPanY }, newScale));
      } else {
        // Non-fullscreen pinch-to-zoom: scale is a multiplier on top of the auto-fit scale
        const NF_USER_SCALE_MIN = 0.85;
        const NF_USER_SCALE_MAX = 5;
        const newNfScale = clamp(pinchRef.current.startScale * scaleFactor, NF_USER_SCALE_MIN, NF_USER_SCALE_MAX);
        const nfBase = nonFullscreenScale || 1;
        const startTotalScale = nfBase * (pinchRef.current.startScale || 1);
        const newTotalScale = nfBase * newNfScale;
        const contentLocalX = (centerX - rect.left) / startTotalScale - pinchRef.current.startPan.x;
        const contentLocalY = (centerY - rect.top) / startTotalScale - pinchRef.current.startPan.y;
        const newPanX = (centerX - rect.left) / newTotalScale - contentLocalX;
        const newPanY = (centerY - rect.top) / newTotalScale - contentLocalY;
        setNfUserScale(newNfScale);
        setNfPan(clampNfPan({ x: newPanX, y: newPanY }, newNfScale));
      }
      pinchRef.current.active = true;
    } else if (pts.length === 1 && pinchRef.current && !pinchRef.current.active) {
      // handle pan with single finger (background only — not a piece drag)
      const p = pts[0];
      const startCenterX = pinchRef.current.centerClientX;
      const startCenterY = pinchRef.current.centerClientY;
      if (isFullscreen) {
        const deltaX = (p.x - startCenterX) / fsScale;
        const deltaY = (p.y - startCenterY) / fsScale;
        setFsPan(clampFullscreenPan({ x: pinchRef.current.startPan.x + deltaX, y: pinchRef.current.startPan.y + deltaY }, fsScale));
      } else {
        const totalScale = Math.max(0.01, (nonFullscreenScale || 1) * (nfUserScale || 1));
        const deltaX = (p.x - startCenterX) / totalScale;
        const deltaY = (p.y - startCenterY) / totalScale;
        setNfPan(clampNfPan({ x: pinchRef.current.startPan.x + deltaX, y: pinchRef.current.startPan.y + deltaY }, nfUserScale));
      }
    }
  };

  const onStagePointerUp = (e: React.PointerEvent) => {
    try { if (stageRef.current) stageRef.current.releasePointerCapture(e.pointerId); } catch {}
    pointersRef.current.delete(e.pointerId);
    const remaining = Array.from(pointersRef.current.values()).filter(p => !p.targetIsPiece);
    if (remaining.length < 2) pinchRef.current = null;
  };

  // Native wheel handler for fullscreen zoom (needs passive:false to preventDefault)
  React.useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const onWheel = (e: WheelEvent) => {
      if (!isFullscreen) return;
      if (!fullscreenPanEnabled) return;
      e.preventDefault();
      const rect = stage.getBoundingClientRect();
      const delta = -e.deltaY;
      const factor = Math.exp(delta * 0.001);
      const FS_SCALE_MIN = 0.1;
      const FS_SCALE_MAX = 4;
      const newScale = clamp(fsScale * factor, FS_SCALE_MIN, FS_SCALE_MAX);

      // zoom to mouse position
      const mouseX = e.clientX;
      const mouseY = e.clientY;
      const contentLocalX = (mouseX - rect.left) / fsScale - fsPan.x;
      const contentLocalY = (mouseY - rect.top) / fsScale - fsPan.y;
      const newPanX = (mouseX - rect.left) / newScale - contentLocalX;
      const newPanY = (mouseY - rect.top) / newScale - contentLocalY;
      setFsScale(newScale);
      setFsPan(clampFullscreenPan({ x: newPanX, y: newPanY }, newScale));
    };

    stage.addEventListener('wheel', onWheel, { passive: false });
    return () => stage.removeEventListener('wheel', onWheel);
  }, [isFullscreen, fullscreenPanEnabled, fsScale, fsPan]);

  

  const solved = useMemo(() => {
    const g = pieces[0]?.groupId;
    if (!g) return false;
    if (!pieces.every((p) => p.groupId === g)) return false;
    const eps = 0.8;
    return pieces.every((p) => hypot(p.pos.x - p.correct.x, p.pos.y - p.correct.y) <= eps);
  }, [pieces]);

  React.useEffect(() => {
    if (!solved || completedRef.current) return;
    completedRef.current = true;
    // Clear saved progress now that the puzzle is fully completed
    clearJigsawProgress(storageKeyRef.current);
    const elapsedSeconds = Math.max(0, Math.round((Date.now() - startTimeRef.current) / 1000));

    const runCompletion = async () => {
      try {
        const boardEl = boardRef.current;
        const stageEl = stageRef.current;
        const shimmerOuter = shimmerOuterRef.current;
        const shimmerInner = shimmerInnerRef.current;
        const shimmerInnerB = shimmerInnerBRef.current;
        const shimmerInnerC = shimmerInnerCRef.current;
        const flareOuter = flareOuterRef.current;
        const energyRing = energyRingRef.current;
        const energyGlow = energyGlowRef.current;
        const messageEl = messageRef.current;
        const wrapperEl = wrapperRef.current;

        console.log('[Jigsaw] runCompletion start');
        console.log('[Jigsaw] refs', { boardEl, shimmerOuter, shimmerInner, messageEl });
        const prefersReduced = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const tl = gsap.timeline({ defaults: { ease: 'power2.inOut' } });
        let restoreAfterTimeline: (() => void) | null = null;

        // Prefer applying glow to the stage so it won't be clipped by board overflow or transforms
        // Prefer animating the board element so the gold glow stays inside the puzzle container
        if (boardEl) {
          // Temporarily allow glow to escape clipping and bring board above siblings
          const prevBox = boardEl.style.boxShadow || '';
          const prevBorder = boardEl.style.borderColor || '';
          const prevZ = boardEl.style.zIndex || '';
          const prevOverflow = stageEl ? stageEl.style.overflow : '';
          const prevWrapperOverflow = wrapperEl ? wrapperEl.style.overflow : '';
          if (stageEl) stageEl.style.overflow = 'visible';
          if (wrapperEl) wrapperEl.style.overflow = 'visible';
          boardEl.style.zIndex = '100';

          restoreAfterTimeline = () => {
            try {
              boardEl.style.boxShadow = prevBox;
              if (stageEl) stageEl.style.overflow = prevOverflow;
              if (wrapperEl) wrapperEl.style.overflow = prevWrapperOverflow;
              boardEl.style.zIndex = prevZ;
            } catch {
              // ignore
            }
          };

          // Brighten the board border color (no outer glow or scale)
          tl.to(boardEl, {
            borderColor: '#FFD700',
            duration: 0.6,
            ease: 'power2.out',
          });
          tl.to(boardEl, {
            borderColor: prevBorder || 'rgba(255,255,255,0.14)',
            duration: 0.6,
            ease: 'power2.in',
          }, '+=0.15');
        } else if (stageEl) {
          // Fallback: animate glow on stage only using box-shadow so layout isn't affected
          const prevOverflow = stageEl.style.overflow;
          const prevWrapperOverflow = wrapperEl ? wrapperEl.style.overflow : '';
          const prevStageBox = stageEl.style.boxShadow || '';
          stageEl.style.overflow = 'visible';
          if (wrapperEl) wrapperEl.style.overflow = 'visible';

          restoreAfterTimeline = () => {
            try {
              stageEl.style.overflow = prevOverflow;
              stageEl.style.boxShadow = prevStageBox;
              if (wrapperEl) wrapperEl.style.overflow = prevWrapperOverflow;
            } catch {
              // ignore
            }
          };

          tl.to(stageEl, {
            boxShadow: '0 0 60px 20px rgba(255,215,0,0.95)',
            duration: 0.9,
            ease: 'power2.inOut',
          });
          tl.to(stageEl, {
            boxShadow: '0 0 0 0 rgba(255,215,0,0)',
            duration: 0.6,
            ease: 'power2.inOut',
          }, '+=0.15');
        }

        // Epic cinematic flare: subtle camera punch + shockwave ring + multi-pass light sweeps.
        // All effects are transform/opacity only and confined to a small number of elements.
        const flareLabel = 'flare';
        tl.addLabel(flareLabel); // marks current end-of-timeline so all flare tweens start here

        // Add piece-pop to timeline (fires at same time as flare burst). Respect prefers-reduced-motion.
        try {
          if (!prefersReduced && stageEl) {
            const piecesEls = stageEl.querySelectorAll('[data-piece-id]');
            if (piecesEls && piecesEls.length > 0) {
              // staggered pop from center — fires at the same time as the flare burst
              tl.to(piecesEls as any, {
                scale: 1.14,
                y: -6,
                duration: 0.22,
                ease: 'back.out(2)',
                stagger: { each: 0.025, from: 'center' },
                yoyo: true,
                repeat: 1,
                clearProps: 'scale,y,transform',
              }, flareLabel);
            }
          }
        } catch (e) {
          console.warn('[Jigsaw] failed to add piece-pop to timeline', e);
        }

        if (!prefersReduced && wrapperEl) {
          tl.fromTo(
            wrapperEl,
            { x: 0, y: 0, rotate: 0 },
            {
              x: 1.2,
              y: -0.8,
              rotate: 0.12,
              duration: 0.06,
              yoyo: true,
              repeat: 4,
              ease: 'power2.inOut',
              clearProps: 'x,y,rotate',
            },
            flareLabel
          );
        }

        if (boardEl && !prefersReduced) {
          // A quick, intense glow pulse on the board itself.
          tl.fromTo(
            boardEl,
            { boxShadow: '0 0 0px 0px rgba(255,215,0,0)' },
            { boxShadow: '0 0 46px 14px rgba(255,215,0,0.75)', duration: 0.18, ease: 'power3.out' },
            flareLabel
          );
          tl.to(boardEl, { boxShadow: '0 0 0px 0px rgba(255,215,0,0)', duration: 0.38, ease: 'power2.inOut' }, `${flareLabel}+=0.18`);
        }

        if (!prefersReduced && flareOuter && energyRing && energyGlow) {
          tl.set([energyRing, energyGlow], { autoAlpha: 0, scale: 0.25, transformOrigin: '50% 50%' }, flareLabel);
          tl.to([energyRing, energyGlow], { autoAlpha: 1, duration: 0.05, ease: 'none' }, flareLabel);
          tl.to(energyGlow, { scale: 1.6, autoAlpha: 0, duration: 0.55, ease: 'power3.out' }, `${flareLabel}+=0.03`);
          tl.to(energyRing, { scale: 2.0, autoAlpha: 0, duration: 0.62, ease: 'power3.out' }, `${flareLabel}+=0.02`);
        }

        if (shimmerOuter && shimmerInner) {
          // Ensure shimmer sits above pieces
          shimmerOuter.style.zIndex = '999';
          shimmerOuter.style.pointerEvents = 'none';

          tl.set(shimmerOuter, { autoAlpha: 1 }, flareLabel);

          // Multi-pass sweeps for a more cinematic “light burst” feel.
          // Use xPercent for reliable motion across nested transforms.
          tl.set([shimmerInner, shimmerInnerB, shimmerInnerC].filter(Boolean) as any, { xPercent: -250, autoAlpha: 0 }, flareLabel);

          // Primary sweep (bright)
          tl.fromTo(
            shimmerInner,
            { xPercent: -220, autoAlpha: 0 },
            { xPercent: 220, autoAlpha: 1, duration: 0.70, ease: 'power3.inOut' },
            `${flareLabel}+=0.06`
          );

          // Secondary broader sweep (softer, slightly delayed)
          if (shimmerInnerB) {
            tl.fromTo(
              shimmerInnerB,
              { xPercent: -240, autoAlpha: 0 },
              { xPercent: 240, autoAlpha: 0.85, duration: 0.92, ease: 'power2.inOut' },
              `${flareLabel}+=0.12`
            );
          }

          // Fast trailing glint (quick pass)
          if (shimmerInnerC) {
            tl.fromTo(
              shimmerInnerC,
              { xPercent: -260, autoAlpha: 0 },
              { xPercent: 260, autoAlpha: 0.95, duration: 0.55, ease: 'power4.inOut' },
              `${flareLabel}+=0.20`
            );
          }

          // Fade shimmer out after passes
          tl.to(shimmerOuter, { autoAlpha: 0, duration: 0.22 }, '>-0.06');
        }

        // Restore any temporary overflow/zIndex changes after all flare effects.
        if (restoreAfterTimeline) {
          tl.call(() => restoreAfterTimeline && restoreAfterTimeline());
        }

        // play timeline and wait
        tl.play();
        await new Promise((resolve) => tl.eventCallback('onComplete', resolve));

        // Debug: verify overlays are visible; if not, force them and log
        try {
          const computedShimmerOpacity = shimmerOuter ? window.getComputedStyle(shimmerOuter).opacity : null;
          const computedMessageOpacity = messageEl ? window.getComputedStyle(messageEl).opacity : null;
          console.log('[Jigsaw] post-animation computed opacities', { computedShimmerOpacity, computedMessageOpacity });
          if (shimmerOuter && (computedShimmerOpacity === '0' || computedShimmerOpacity === null)) {
            console.warn('[Jigsaw] shimmerOuter still hidden — forcing visibility');
            shimmerOuter.style.opacity = '1';
            shimmerOuter.style.zIndex = '50';
            shimmerOuter.style.pointerEvents = 'none';
          }
          // No glow fallback — border change handled above
          if (messageEl && (computedMessageOpacity === '0' || computedMessageOpacity === null)) {
            console.warn('[Jigsaw] messageEl still hidden — forcing visibility');
            messageEl.style.opacity = '1';
          }
        } catch (dbgErr) {
          console.error('[Jigsaw] debug/fallback error:', dbgErr);
        }

        // Call parent's onComplete to record progress/award points and await result if it returns one
        let pointsResult: number | void | undefined = undefined;
        if (onComplete) {
          try {
            const res = onComplete(elapsedSeconds);
            pointsResult = res instanceof Promise ? await res : res;
          } catch (err) {
            console.error('Jigsaw onComplete handler error:', err);
          }
        }

        // Call parent's onComplete to record progress/award points and await result if it returns one
        let pointsResultAfter: number | void | undefined = pointsResult;

        // Wait 1s after the timeline (shimmer finished), then show the congrats popup
        await new Promise((r) => setTimeout(r, 1000));

        // Show congrats message (unless parent asked us to suppress internal overlay)
        if (!suppressInternalCongrats) {
          setShowCongrats(true);
          if (messageEl) {
            gsap.fromTo(
              messageEl,
              { autoAlpha: 0, y: 8 },
              { autoAlpha: 1, y: 0, duration: 1.0, ease: 'power2.out' }
            );
          }
        }

        // Animate points count-up while message is visible (if numeric)
        if (typeof pointsResultAfter === 'number') {
          try {
            setAwardedPoints(0);
            await new Promise<void>((resolve) => {
              const obj: { val: number } = { val: 0 };
              gsap.to(obj, {
                val: pointsResultAfter as number,
                duration: 0.9,
                ease: 'power2.out',
                onUpdate: () => setAwardedPoints(Math.round(obj.val)),
                onComplete: () => {
                  setAwardedPoints(pointsResultAfter as number);
                  resolve();
                },
              });
            });
          } catch (e) {
            console.error('[Jigsaw] points countup failed', e);
            setAwardedPoints(pointsResultAfter as number);
          }
        } else {
          setAwardedPoints(null);
        }

        // Wait a moment so user can read message, then fade the congrats overlay out
        await new Promise((r) => setTimeout(r, 1700));
        if (messageEl) {
          try {
            await new Promise<void>((resolve) => {
              gsap.to(messageEl, {
                autoAlpha: 0,
                y: 8,
                duration: 0.45,
                ease: 'power2.in',
                onComplete: () => resolve(),
              });
            });
          } catch (e) {
            // ignore animation errors and proceed
          }
        }
        // hide internal state so the overlay is removed from DOM flow (if it was shown)
        if (!suppressInternalCongrats) setShowCongrats(false);
        // Exit fullscreen so parent can present the rating modal without being clipped
        if (isFullscreen) {
          setIsFullscreen(false);
          // give the browser a moment to exit fullscreen/adjust layout
          await new Promise((r) => setTimeout(r, 200));
        }
        if (onShowRatingModal) onShowRatingModal();
      } catch (err) {
        console.error('Error during completion animation:', err);
        // Fallback: still call onComplete if not called
        if (onComplete) {
          try {
            onComplete(elapsedSeconds);
          } catch (e) {
            console.error('Fallback onComplete failed:', e);
          }
        }
        if (isFullscreen) {
          setIsFullscreen(false);
          await new Promise((r) => setTimeout(r, 200));
        }
        if (onShowRatingModal) onShowRatingModal();
      }
    };

    runCompletion();
  }, [solved, onComplete, onShowRatingModal]);

  const sendLooseToTray = () => {
    setPieces((prev) => {
      // Keep any pieces on the board-ish area where they are; move "loose" ones to the scattered area.
      // Loose = groups that are NOT already board-aligned (no piece within board snap range)
      const next = [...prev];
      const groupIds = [...new Set(next.map((p) => p.groupId))];

      const byGroup = new Map();
      for (const gid of groupIds) {
        byGroup.set(gid, next.filter((p) => p.groupId === gid));
      }

      const moved = next.map((p) => ({ ...p, snapped: false }));

      const pad = Math.max(10, Math.round(Math.min(pieceW, pieceH) * 0.08));
      const forbiddenLeft = boardLeft - pad;
      const forbiddenTop = boardTop - pad;
      const forbiddenRight = boardLeft + boardWidth + pad;
      const forbiddenBottom = boardTop + boardHeight + pad;

      const pickScatterTargetForSize = (w: number, h: number) => {
        const maxX = Math.max(0, stageWidth - w);
        const maxY = Math.max(0, stageHeight - h);

        const isOutsideForbidden = (x: number, y: number) =>
          x + w <= forbiddenLeft || x >= forbiddenRight || y + h <= forbiddenTop || y >= forbiddenBottom;

        type Rect = { x0: number; x1: number; y0: number; y1: number; area: number };
        const rects: Rect[] = [];
        const addRect = (x0: number, x1: number, y0: number, y1: number) => {
          const xx0 = Math.max(0, Math.min(maxX, x0));
          const xx1 = Math.max(0, Math.min(maxX, x1));
          const yy0 = Math.max(0, Math.min(maxY, y0));
          const yy1 = Math.max(0, Math.min(maxY, y1));
          if (xx1 > xx0 && yy1 > yy0) rects.push({ x0: xx0, x1: xx1, y0: yy0, y1: yy1, area: (xx1 - xx0) * (yy1 - yy0) });
        };

        addRect(0, forbiddenLeft - w, 0, maxY);
        addRect(forbiddenRight, maxX, 0, maxY);
        addRect(forbiddenLeft, forbiddenRight - w, 0, forbiddenTop - h);
        addRect(forbiddenLeft, forbiddenRight - w, forbiddenBottom, maxY);

        if (rects.length > 0) {
          const total = rects.reduce((s, r) => s + r.area, 0) || 1;
          let pick = Math.random() * total;
          let chosen = rects[0];
          for (const r of rects) {
            pick -= r.area;
            if (pick <= 0) {
              chosen = r;
              break;
            }
          }
          for (let i = 0; i < 40; i++) {
            const x = chosen.x0 + Math.random() * (chosen.x1 - chosen.x0);
            const y = chosen.y0 + Math.random() * (chosen.y1 - chosen.y0);
            if (isOutsideForbidden(x, y)) return { x, y };
          }
        }

        for (let i = 0; i < 200; i++) {
          const x = Math.random() * maxX;
          const y = Math.random() * maxY;
          if (isOutsideForbidden(x, y)) return { x, y };
        }

        return { x: 0, y: 0 };
      };

      for (const [gid, groupPieces] of byGroup.entries()) {
        const boardAligned: boolean = groupPieces.some(
          (p: Piece) => hypot(p.pos.x - p.correct.x, p.pos.y - p.correct.y) <= effectiveBoardSnapTolerance + 1
        );
        if (boardAligned) continue;

        // Random tray destination based on the group's top-left
        interface GroupPiece {
          pos: PiecePosition;
        }

        const minX: number = Math.min(...(groupPieces as GroupPiece[]).map((p: GroupPiece) => p.pos.x));
        const minY: number = Math.min(...(groupPieces as { pos: PiecePosition }[]).map((p: { pos: PiecePosition }) => p.pos.y));
        const maxGX: number = Math.max(...(groupPieces as GroupPiece[]).map((p: GroupPiece) => p.pos.x));
        const maxGY: number = Math.max(...(groupPieces as GroupPiece[]).map((p: GroupPiece) => p.pos.y));
        const groupW = (maxGX - minX) + pieceW;
        const groupH = (maxGY - minY) + pieceH;

        const baseTarget = pickScatterTargetForSize(groupW, groupH);
        let targetX = baseTarget.x + (Math.random() * 2 - 1) * trayScatter;
        let targetY = baseTarget.y + (Math.random() * 2 - 1) * trayScatter;

        // Keep within bounds after jitter.
        targetX = clamp(targetX, 0, Math.max(0, stageWidth - groupW));
        targetY = clamp(targetY, 0, Math.max(0, stageHeight - groupH));

        // Ensure we didn't jitter back onto the forbidden region.
        const outside = (x: number, y: number) =>
          x + groupW <= forbiddenLeft || x >= forbiddenRight || y + groupH <= forbiddenTop || y >= forbiddenBottom;
        if (!outside(targetX, targetY)) {
          const forced = pickScatterTargetForSize(groupW, groupH);
          targetX = forced.x;
          targetY = forced.y;
        }

        const dx = targetX - minX;
        const dy = targetY - minY;

        for (let i = 0; i < moved.length; i++) {
          if (moved[i].groupId === gid) {
            moved[i].pos = { x: moved[i].pos.x + dx, y: moved[i].pos.y + dy };
          }
        }
      }

      return moved;
    });
  };

  const activeGroup = draggingGroupId;

  // Keep the stage scaled to fit its wrapper to avoid overflow in editors
  React.useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

      const update = () => {
      const wrapperW = wrapper.clientWidth || 0;
      const wrapperH = wrapper.clientHeight || 0;
      setWrapperWidth(wrapperW || null);
      setWrapperHeight(wrapperH || null);

      const reservedChrome = 24;
      const availableHeight = isFullscreen && wrapperH ? Math.max(200, wrapperH - reservedChrome) : wrapperH;
      const availableWidth = wrapperW;
      if (!availableWidth || !availableHeight) return;

      // Fit the board PLUS a margin ring (for scattered pieces) into the visible wrapper area.
      const pad = 16;
      const contentW = boardWidth + scatterMargin * 2;
      const contentH = boardHeight + scatterMargin * 2;
      const widthScale = Math.max(0.06, (availableWidth - pad) / contentW);
      const heightScale = Math.max(0.06, (availableHeight - pad) / contentH);
      const fit = Math.min(1, widthScale, heightScale);
      const next = Math.min(1, Math.max(0.06, fit));

      if (isFullscreen) {
        setFsScale(next);
        // Recalculate centered pan when the scale changes during fullscreen.
        // IMPORTANT: do NOT use `stageWidth`/`stageHeight` from the outer closure —
        // those are computed from `wrapperWidth` and `fsScale` state variables that
        // haven't been committed yet (we just called setFsScale / setWrapperWidth
        // above, but React state is asynchronous).  Recalculate inline instead,
        // mirroring the stageWidth/stageHeight useMemo formula exactly.
        const visibleW = availableWidth / (next || 1);
        const visibleH = availableHeight / (next || 1);
        const freshStageW = Math.max(boardWidth + scatterMargin * 2, Math.round(wrapperW / (next || 1)));
        const freshStageH = Math.max(boardHeight + scatterMargin * 2, Math.round(wrapperH / (next || 1)));
        const centerX = (visibleW - freshStageW) / 2;
        const centerY = (visibleH - freshStageH) / 2;
        const minX = visibleW >= freshStageW ? centerX : (visibleW - freshStageW);
        const maxX = visibleW >= freshStageW ? centerX : 0;
        const minY = visibleH >= freshStageH ? centerY : (visibleH - freshStageH);
        const maxY = visibleH >= freshStageH ? centerY : 0;
        setFsPan({
          x: clamp(fsPanRef.current.x, minX, maxX),
          y: clamp(fsPanRef.current.y, minY, maxY),
        });
      } else {
        setScale(next);
      }
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(wrapper);
    window.addEventListener('resize', update);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [boardWidth, boardHeight, scatterMargin, isFullscreen]);

  const controlBarHeight = 56; // px
  const controlBarTop = -Math.round(controlBarHeight / 2);
  const controlsAssignedRef = useRef(false);
  const initialPiecesRef = useRef(initialPieces);
  useEffect(() => {
    initialPiecesRef.current = initialPieces;
  }, [initialPieces]);

  const sendLooseToTrayRef = useRef(sendLooseToTray);
  useEffect(() => {
    sendLooseToTrayRef.current = sendLooseToTray;
  }, [sendLooseToTray]);

  React.useEffect(() => {
    if (!onControlsReady) return;
    if (controlsAssignedRef.current) return;

    const api = {
      reset: () => {
        clearJigsawProgress(storageKeyRef.current);
        setPieces(initialPiecesRef.current);
        completedRef.current = false;
        startTimeRef.current = Date.now();
        savedElapsedMsRef.current = 0;
      },
      sendLooseToTray: () => {
        // Delegate to the live implementation so it uses current layout/tray coords
        sendLooseToTrayRef.current();
      },
      enterFullscreen: () => setIsFullscreen(true),
      exitFullscreen: () => setIsFullscreen(false),
      get isFullscreen() {
        return isFullscreenRef.current;
      },
    } as const;

    try {
      onControlsReady(api as any);
      controlsAssignedRef.current = true;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('onControlsReady threw', e);
    }
    // Intentionally only run once per mount/parent callback change
  }, [onControlsReady]);

  const puzzleUI = (
    <div
      ref={wrapperRef}
      style={{
        position: isFullscreen ? 'fixed' : 'relative',
        left: isFullscreen ? 0 : undefined,
        top: isFullscreen ? 0 : undefined,
        zIndex: isFullscreen ? 12000 : undefined,
        inset: isFullscreen ? '0px' : undefined,
        padding: isFullscreen ? 0 : undefined,
        background: tableBackground
          ? 'transparent'
          : isFullscreen
            ? 'rgba(0,0,0,0.85)'
            : undefined,
        fontFamily: "system-ui, sans-serif",
        width: isFullscreen ? '100vw' : '100%',
        minHeight: isFullscreen ? '100vh' : `${nonFullscreenHeight}px`,
        height: isFullscreen ? '100vh' : `${nonFullscreenHeight}px`,
        margin: isFullscreen ? undefined : '0 auto',
        // Critical for mobile: prevent the (unscaled) stage box from creating
        // horizontal scrolling or appearing to escape its container.
        overflow: 'hidden',
        contain: isFullscreen ? undefined : 'layout paint',
        maxWidth: '100%',
        ...containerStyle,
      }}
    >
      <div
        ref={stageRef}
        onPointerDown={onStagePointerDown}
        onPointerMove={(e) => { onStagePointerMove(e); onPointerMove(e as any); }}
        onPointerUp={(e) => { onStagePointerUp(e); onPointerUp(e as any); }}
        onPointerCancel={(e) => { onStagePointerUp(e); onPointerUp(e as any); }}
        style={{
        position: isFullscreen ? "absolute" : "relative",
        left: isFullscreen ? 0 : undefined,
        top: isFullscreen ? 0 : undefined,
        width: isFullscreen ? '100%' : '100%',
        height: isFullscreen ? '100%' : Math.max(240, nonFullscreenHeight),
        maxWidth: '100%',
        borderRadius: 0,
        overflow: "hidden",
        backgroundColor: tableBackground ? 'transparent' : '#070a0f',
        backgroundImage: tableBackground ? `url(${tableBackground})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        border: "1px solid rgba(255,255,255,0.14)",
        userSelect: "none",
        touchAction: 'none',
        transformOrigin: 'top left',
        display: 'block',
        marginLeft: 0,
        zIndex: 1,
        transform: 'none',
      }}
      >
        {/* Table background image — absolutely fills the stage behind all content */}
        {tableBackground && (
          <img
            src={tableBackground}
            aria-hidden
            alt=""
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center',
              pointerEvents: 'none',
              userSelect: 'none',
              zIndex: 0,
              display: 'block',
            }}
          />
        )}
        {/* Resumed-from-save banner */}
        {resumedFromSave && (
          <div
            style={{
              position: 'absolute',
              top: 10,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 9000,
              background: 'rgba(16, 185, 129, 0.92)',
              color: 'white',
              fontSize: 13,
              fontWeight: 600,
              padding: '6px 14px',
              borderRadius: 20,
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
              boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
              letterSpacing: '0.01em',
            }}
          >
            ✓ Progress restored — pick up where you left off
          </div>
        )}

        {/* Mobile fullscreen hint — shown on touch devices in normal mode */}
        {isTouchDevice && !isFullscreen && !mobileFsHintDismissed && !solved && (
          <div
            style={{
              position: 'absolute',
              bottom: 16,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 9100,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'rgba(10,20,40,0.88)',
              color: 'white',
              fontSize: 13,
              fontWeight: 500,
              padding: '8px 14px',
              borderRadius: 22,
              boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
              border: '1px solid rgba(255,255,255,0.12)',
              whiteSpace: 'nowrap',
            }}
          >
            <span>📱 Pinch to zoom · drag to pan · </span>
            <button
              onClick={() => setIsFullscreen(true)}
              style={{ background: 'rgba(99,102,241,0.9)', border: 'none', color: 'white', padding: '3px 10px', borderRadius: 12, cursor: 'pointer', fontWeight: 700, fontSize: 12 }}
            >
              Fullscreen
            </button>
            <button
              onClick={() => setMobileFsHintDismissed(true)}
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '0 2px' }}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        )}

        {/* Reset view button — shown in non-fullscreen when user has panned/zoomed */}
        {!isFullscreen && (nfUserScale !== 1 || nfPan.x !== 0 || nfPan.y !== 0) && (
          <button
            onClick={() => { setNfUserScale(1); setNfPan({ x: 0, y: 0 }); }}
            style={{
              position: 'absolute',
              top: 10,
              right: 10,
              zIndex: 9100,
              background: 'rgba(10,20,40,0.80)',
              color: 'rgba(255,255,255,0.85)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 14,
              padding: '4px 12px',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            ⤢ Reset View
          </button>
        )}

        {/* Preview button — click to toggle the full puzzle image */}
        {imageOk === true && effectiveImageUrl && !solved && (
          <button
            onClick={() => setShowPreview(v => !v)}
            style={{
              position: 'absolute',
              bottom: 12,
              right: 12,
              zIndex: 9100,
              background: showPreview ? 'rgba(99,102,241,0.9)' : 'rgba(10,20,40,0.85)',
              color: 'rgba(255,255,255,0.9)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 14,
              padding: '5px 13px',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              userSelect: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            🖼 {showPreview ? 'Hide Preview' : 'Preview Image'}
          </button>
        )}

        {/* Full image preview overlay — click anywhere to dismiss */}
        {showPreview && effectiveImageUrl && (
          <div
            onClick={() => setShowPreview(false)}
            onPointerDown={e => e.stopPropagation()}
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 9500,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0,0,0,0.75)',
              cursor: 'pointer',
            }}
          >
            <img
              src={effectiveImageUrl}
              alt="Puzzle preview"
              style={{
                maxWidth: '80%',
                maxHeight: '80%',
                objectFit: 'contain',
                borderRadius: 8,
                boxShadow: '0 8px 40px rgba(0,0,0,0.7)',
                border: '2px solid rgba(255,255,255,0.2)',
                pointerEvents: 'none',
              }}
            />
            <div style={{ position: 'absolute', top: 12, right: 12, color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: 600 }}>
              Click anywhere to close
            </div>
          </div>
        )}

        {/* contentRef sits inside the static outer stage and receives transform for pan/zoom */}
        <div
          ref={contentRef}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: stageWidth,
            height: stageHeight,
            transformOrigin: 'top left',
            zIndex: 1,
            transform: (() => {
              if (isFullscreen) return `scale(${fsScale}) translate(${fsPan.x}px, ${fsPan.y}px)`;
              const totalScale = nonFullscreenScale * Math.max(0.1, nfUserScale);
              const clampedPan = clampNfPan(nfPan, nfUserScale);
              return `scale(${totalScale}) translate(${clampedPan.x}px, ${clampedPan.y}px)`;
            })(),
            willChange: 'transform',
          }}
        >
        {/* BOARD */}
        <div
          ref={boardRef}
          style={{
            position: "absolute",
            left: boardLeft,
            top: boardTop,
            width: boardWidth,
            height: boardHeight,
            borderRadius: Math.round(Math.min(pieceW, pieceH) * 0.06),
            border: "1px solid rgba(255,255,255,0.35)",
            background: solved ? "transparent" : "#d0d0d0",
            boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08), 0 0 24px rgba(0,0,0,0.4)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: imageOk === true && effectiveImageUrl && !tableBackground ? `url(${effectiveImageUrl})` : undefined,
              backgroundSize: "100% 100%",
              backgroundColor: imageOk === false ? 'rgba(255,255,255,0.02)' : undefined,
              opacity: solved ? 0 : (imageOk === true ? 0.11 : 1),
              pointerEvents: "none",
            }}
          />

          {imageOk === false && (
            <div style={{ position: 'absolute', left: 12, top: 12, zIndex: 40 }}>
              <div style={{ background: 'rgba(0,0,0,0.6)', color: 'white', padding: '6px 10px', borderRadius: 8, fontSize: 12 }}>
                Image failed to load.
                <button
                  onClick={() => {
                    setImageOk(null);
                    setImageReloadKey((k) => k + 1);
                    setProxyAttempted(false);
                    setEffectiveImageUrl(imageUrl || null);
                  }}
                  style={{ marginLeft: 8, background: '#2b6cb0', color: 'white', border: 'none', padding: '4px 8px', borderRadius: 6, cursor: 'pointer' }}
                >
                  Retry
                </button>
              </div>
            </div>
          )}
          {/* Shimmer overlay originally here — moved below so it renders above pieces */}
        </div>

        {/* TRAY */}
        {/* No tray: loose pieces are scattered around the centered board */}

        {/* PIECES */}
        {pieces.map((p) => (
          <MemoJigsawPiece
            key={p.id}
            id={p.id}
            row={p.row}
            col={p.col}
            edges={p.edges}
            pieceW={pieceW}
            pieceH={pieceH}
            boardW={boardWidth}
            boardH={boardHeight}
            boardLeft={boardLeft}
            boardTop={boardTop}
            imageUrl={effectiveImageUrl ?? ''}
            pos={p.pos}
            z={p.z}
            groupId={p.groupId}
            onPointerDown={onPointerDown}
            imageOk={imageOk}
            highlight={!!activeGroup && p.groupId === activeGroup}
            snapped={p.snapped || solved}
            tabRadius={tabRadius}
            tabDepth={tabDepth}
            neckWidth={neckWidth}
            neckDepth={neckDepth}
            shoulderLen={shoulderLen}
            shoulderDepth={shoulderDepth}
            cornerInset={cornerInset}
            smooth={smooth}
            isDragging={!!activeGroup && p.groupId === activeGroup}
            dragDx={!!activeGroup && p.groupId === activeGroup ? dragDelta.dx : 0}
            dragDy={!!activeGroup && p.groupId === activeGroup ? dragDelta.dy : 0}
            snapDx={snapAnim && p.groupId === snapAnim.groupId ? snapAnim.dx : 0}
            snapDy={snapAnim && p.groupId === snapAnim.groupId ? snapAnim.dy : 0}
            snapAnimating={!!snapAnim && p.groupId === snapAnim.groupId && snapAnim.phase === 'toZero'}
          />
        ))}

        {/* Shimmer overlay (hidden until completion) - placed after pieces so it sits on top */}
        <div
          ref={shimmerOuterRef}
          style={{ position: 'absolute', left: boardLeft, top: boardTop, width: boardWidth, height: boardHeight, pointerEvents: 'none', opacity: 0, zIndex: 999, overflow: 'hidden' }}
        >
          <div
            ref={shimmerInnerRef}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: '60%',
              height: '100%',
              background: 'linear-gradient(90deg, rgba(255,215,0,0) 0%, rgba(255,215,0,0.92) 52%, rgba(255,215,0,0) 100%)',
              transform: 'skewX(-20deg)',
              willChange: 'transform, opacity'
            }}
          />
          <div
            ref={shimmerInnerBRef}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: '85%',
              height: '100%',
              background: 'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,215,0,0.36) 35%, rgba(255,215,0,0.22) 52%, rgba(255,215,0,0.28) 68%, rgba(255,255,255,0) 100%)',
              transform: 'skewX(-18deg)',
              opacity: 0,
              willChange: 'transform, opacity',
            }}
          />
          <div
            ref={shimmerInnerCRef}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: '40%',
              height: '100%',
              background: 'linear-gradient(90deg, rgba(255,215,0,0) 0%, rgba(255,215,0,0.85) 48%, rgba(255,215,0,0) 100%)',
              transform: 'skewX(-22deg)',
              opacity: 0,
              willChange: 'transform, opacity',
            }}
          />
        </div>

        {/* Shockwave flare overlay (can extend slightly beyond board) */}
        <div
          ref={flareOuterRef}
          style={{ position: 'absolute', left: boardLeft, top: boardTop, width: boardWidth, height: boardHeight, pointerEvents: 'none', opacity: 1, zIndex: 1001, overflow: 'visible' }}
        >
          <div
            ref={energyGlowRef}
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: '115%',
              height: '115%',
              transform: 'translate(-50%, -50%)',
              borderRadius: 9999,
              background: 'radial-gradient(circle, rgba(255,215,0,0.42) 0%, rgba(255,215,0,0.16) 36%, rgba(255,215,0,0) 72%)',
              opacity: 0,
              willChange: 'transform, opacity',
            }}
          />
          <div
            ref={energyRingRef}
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: '110%',
              height: '110%',
              transform: 'translate(-50%, -50%)',
              borderRadius: 9999,
              border: '2px solid rgba(255,215,0,0.80)',
              boxShadow: '0 0 22px 6px rgba(255,215,0,0.22)',
              opacity: 0,
              willChange: 'transform, opacity',
            }}
          />
        </div>

        </div>{/* end contentRef */}

        
      </div>

      
        {/* Large congrats overlay at wrapper level (centered and prominent) */}
      <div
        ref={messageRef}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: '100%',
          height: '100%',
          display: 'grid',
          placeItems: 'center',
          pointerEvents: 'none',
          zIndex: 9999,
          opacity: 0,
        }}
      >
        <div style={{ background: 'rgba(0,0,0,0.7)', padding: '20px 28px', borderRadius: 14, textAlign: 'center', maxWidth: 'min(720px, 90%)' }}>
          <div style={{ color: '#FDE74C', fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Congratulations! Puzzle completed!</div>
          <div style={{ color: '#DDDBF1', fontSize: 16 }}>
            You've been awarded <span style={{ color: '#FDE74C', fontWeight: 800 }}>{awardedPoints ?? '...'}</span> points!
          </div>
        </div>
      </div>

      {/* Fullscreen toggle: overlay only in fullscreen; in normal mode render in the control bar below */}
      {isFullscreen && (
        <button
          onClick={() => setIsFullscreen(false)}
          style={{ position: 'absolute', right: 12, top: 12, zIndex: 13000, padding: '6px 8px', borderRadius: 8, background: 'rgba(0,0,0,0.5)', color: 'white', border: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer' }}
        >
          Exit Fullscreen
        </button>
      )}
    </div>
  );

  // Fullscreen needs to escape any parent layout transforms (e.g. mobile breakout wrappers
  // that use translate) or `position: fixed` won't be viewport-relative.
  if (isFullscreen && portalReady && typeof document !== 'undefined') {
    return createPortal(puzzleUI, document.body);
  }

  return puzzleUI;
}


