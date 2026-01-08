"use client";

import React, { useMemo, useRef, useState, useEffect } from "react";
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

    const featureSpan = clamp01(P.featureSpan) * L;
    const neckSpan = clamp01(P.neckSpan) * L;
    const headSpan = clamp01(P.headSpan) * L;

    const mid = L / 2;
    const halfFeature = featureSpan / 2;
    const halfNeck = neckSpan / 2;
    const halfHead = headSpan / 2;

    const a = mid - halfFeature; // feature start
    const b = mid - halfNeck;    // neck start
    const c = mid + halfNeck;    // neck end
    const d = mid + halfFeature; // feature end

    const sh = clamp01(P.shoulderSpan) * L;
    const sh1End = Math.min(b, a + sh);
    const sh2Start = Math.max(c, d - sh);

    const tabDepth = P.tabDepth * L * sign;
    const neckPinch = P.neckPinch * L * -Math.sign(sign);
    const shoulderDepth = P.shoulderDepth * L * -1; // inward scoop

    const pt = (x: number, y: number) => ({ x, y });

    // Head points (width controlled by headSpan)
    const headL = pt(mid - halfHead, tabDepth * 0.92);
    const headR = pt(mid + halfHead, tabDepth * 0.92);
    const apex = pt(mid, tabDepth);

    const capL_c1 = pt(mid - halfHead, tabDepth * 0.92 + tabDepth * 0.08);
    const capL_c2 = pt(mid - halfHead * P.kappa, tabDepth);
    const capR_c1 = pt(mid + halfHead * P.kappa, tabDepth);
    const capR_c2 = pt(mid + halfHead, tabDepth * 0.92 + tabDepth * 0.08);

    const cmds: string[] = [];

    cmds.push(`L ${a} 0`);

    // shoulder scoop in to sh1End (back to baseline)
    cmds.push(
      Ccmd(
        pt(a + sh * 0.35, shoulderDepth * P.smooth),
        pt(sh1End - sh * 0.35, shoulderDepth * P.smooth),
        pt(sh1End, 0)
      )
    );

    cmds.push(`L ${b} 0`);

    // pinch into neckPinch
    cmds.push(
      Ccmd(
        pt(b + neckSpan * 0.08, neckPinch * P.smooth),
        pt(b + neckSpan * 0.18, neckPinch),
        pt(b + neckSpan * 0.26, neckPinch)
      )
    );

    // neck pinch -> headL
    cmds.push(
      Ccmd(
        pt(b + neckSpan * 0.34, neckPinch),
        pt(mid - halfHead - neckSpan * 0.10, tabDepth * 0.55),
        headL
      )
    );

    // headL -> apex
    cmds.push(Ccmd(capL_c1, capL_c2, apex));

    // apex -> headR
    cmds.push(Ccmd(capR_c1, capR_c2, headR));

    // headR -> neck pinch near c
    cmds.push(
      Ccmd(
        pt(mid + halfHead + neckSpan * 0.10, tabDepth * 0.55),
        pt(c - neckSpan * 0.34, neckPinch),
        pt(c - neckSpan * 0.26, neckPinch)
      )
    );

    // neck pinch -> baseline at c
    cmds.push(
      Ccmd(
        pt(c - neckSpan * 0.18, neckPinch),
        pt(c - neckSpan * 0.08, neckPinch * P.smooth),
        pt(c, 0)
      )
    );

    // shoulder scoop out to d
    cmds.push(
      Ccmd(
        pt(sh2Start + sh * 0.35, shoulderDepth * P.smooth),
        pt(d - sh * 0.35, shoulderDepth * P.smooth),
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

  // inset endpoints
  const TL_top = add(TL, mul(alongTop, inset));
  const TR_top = add(TL, mul(alongTop, w - inset));

  const TR_right = add(TR, mul(alongR, inset));
  const BR_right = add(TR, mul(alongR, h - inset));

  const BR_bot = add(BR, mul(alongBot, inset));
  const BL_bot = add(BR, mul(alongBot, w - inset));

  const BL_left = add(BL, mul(alongL, inset));
  const TL_left = add(BL, mul(alongL, h - inset));

  const topLen = w - 2 * inset;
  const rightLen = h - 2 * inset;
  const botLen = w - 2 * inset;
  const leftLen = h - 2 * inset;

  const topDir = edges.top ?? 0;
  const rDir = edges.right ?? 0;
  const bDir = edges.bottom ?? 0;
  const lDir = edges.left ?? 0;

  const d = [
    `M ${TL_top.x} ${TL_top.y}`,
    emitEdge(TL_top, alongTop, outTop, topLen, topDir),
    `L ${TR_right.x} ${TR_right.y}`,
    emitEdge(TR_right, alongR, outR, rightLen, rDir),
    `L ${BR_bot.x} ${BR_bot.y}`,
    emitEdge(BR_bot, alongBot, outBot, botLen, bDir),
    `L ${BL_left.x} ${BL_left.y}`,
    emitEdge(BL_left, alongL, outL, leftLen, lDir),
    `L ${TL_top.x} ${TL_top.y}`,
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
}: JigsawPieceProps & { snapped?: boolean; tabRadius?: number; tabDepth?: number; neckWidth?: number; neckDepth?: number; shoulderLen?: number; shoulderDepth?: number; cornerInset?: number; smooth?: number; isDragging?: boolean }) {
  const clipId = `clip-${id}`;
  const d = useMemo(
    () => piecePath(pieceW, pieceH, edges),
    [pieceW, pieceH, edges]
  );

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
        filter: !snapped && pos.x > boardW ? "drop-shadow(0px 14px 22px rgba(0,0,0,0.45))" : undefined,
        pointerEvents: snapped ? "none" : "auto",
        transform: 'scale(1)'
      }}
    >
      <svg
        width={pieceW}
        height={pieceH}
        viewBox={`0 0 ${pieceW} ${pieceH}`}
        style={{ overflow: "visible" }}
        onPointerDown={snapped ? undefined : (e) => onPointerDown(e, id)}
      >
        <defs>
          <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
            <path d={d} />
          </clipPath>
        </defs>

        <image
          href={imageUrl}
          x={-(boardLeft + col * pieceW)}
          y={-(boardTop + row * pieceH)}
          width={boardW}
          height={boardH}
          preserveAspectRatio="none"
          clipPath={`url(#${clipId})`}
          style={{ pointerEvents: "none" }}
        />

        <path
          d={d}
          fill="rgba(0,128,255,0.25)"
          stroke={highlight ? "rgba(0,255,255,0.55)" : "rgba(255,255,255,0.18)"}
          strokeWidth={1.4}
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
  cornerInset = 0.05,
  smooth = 0.55,
  onComplete,
  onShowRatingModal,
  containerStyle = {},
}: JigsawPuzzleSVGWithTrayProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const shimmerOuterRef = useRef<HTMLDivElement>(null);
  const shimmerInnerRef = useRef<HTMLDivElement>(null);
  const messageRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number>(1);
  const [wrapperWidth, setWrapperWidth] = useState<number | null>(null);
  const [isStacked, setIsStacked] = useState<boolean>(false);
  const startTimeRef = useRef<number>(Date.now());
  const completedRef = useRef<boolean>(false);
  const [showCongrats, setShowCongrats] = useState(false);
  const [awardedPoints, setAwardedPoints] = useState<number | null>(null);

  const pieceW = boardWidth / cols;
  const pieceH = boardHeight / rows;

  // Stage layout:
  // +-------------------------------+
  // |  [ board ]   [ tray ]         |
  // +-------------------------------+
  const trayWidth = Math.round(boardWidth * 0.95);

  // When the available wrapper width is small, stack the tray below the board
  const stageWidth = isStacked ? Math.max(boardWidth, trayWidth) : boardWidth + trayWidth;
  const stageHeight = isStacked ? boardHeight + trayHeight : boardHeight;

  const boardLeft = 0;
  const boardTop = 0;

  const trayLeft = isStacked ? 0 : boardLeft + boardWidth;
  const trayTop = isStacked ? boardTop + boardHeight : boardTop;

  const edgesMap = useMemo(() => buildEdges(rows, cols), [rows, cols]);

  const initialPieces = useMemo(() => {
    const pieces = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const id = `${r}-${c}`;

        const correct = {
          x: boardLeft + c * pieceW,
          y: boardTop + r * pieceH,
        };

        // spawn in tray
        const spawn = {
          x:
            trayLeft +
            Math.random() * (trayWidth - pieceW) +
            (Math.random() * 2 - 1) * trayScatter,
          y:
            trayTop +
            Math.random() * (trayHeight - pieceH) +
            (Math.random() * 2 - 1) * trayScatter,
        };

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
    trayLeft,
    trayTop,
    trayWidth,
    trayHeight,
    trayScatter,
    edgesMap,
  ]);

  const [pieces, setPieces] = useState(initialPieces);
  // Reset pieces when initialPieces changes (e.g., layout switches stacked vs side-by-side)
  // Initialize pieces when core puzzle inputs change (rows/cols/image).
  // Avoid resetting pieces on layout/scale changes to prevent mid-play resets.
  React.useEffect(() => {
    setPieces(initialPieces);
    completedRef.current = false;
    startTimeRef.current = Date.now();
  }, [rows, cols, imageUrl]);
  // Track which group is currently being dragged (for consistent re-render)
  const [draggingGroupId, setDraggingGroupId] = useState<string | null>(null);

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

  const bringGroupToFront: BringGroupToFrontFn = (groupId) => {
    setPieces((prev: Piece[]) => {
      const maxZ = prev.reduce((m, p) => Math.max(m, p.z), 1);
      return prev.map((p: Piece) => (p.groupId === groupId ? { ...p, z: maxZ + 1 } : p));
    });
  };

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
      p.groupId === groupId ? { ...p, pos: { x: p.pos.x + dx, y: p.pos.y + dy } } : p
    );

  interface MergeGroupsFn {
    (arr: Piece[], aGroup: string, bGroup: string): Piece[];
  }

  const mergeGroups: MergeGroupsFn = (arr, aGroup, bGroup) =>
    aGroup === bGroup
      ? arr
      : (() => {
          // If the target group (aGroup) is snapped, keep merged pieces snapped as well.
          const aGroupSnapped = arr.some((p) => p.groupId === aGroup && p.snapped);
          return arr.map((p) =>
            p.groupId === bGroup ? { ...p, groupId: aGroup, snapped: aGroupSnapped || p.snapped } : p
          );
        })();

  interface NeighborIdFn {
    (row: number, col: number): string | null;
  }

  const neighborId: NeighborIdFn = (row, col) => {
    if (row < 0 || col < 0 || row >= rows || col >= cols) return null;
    return `${row}-${col}`;
  };

  interface SnapGroupToBoardIfCloseFn {
    (arr: Piece[], groupId: string): Piece[];
  }

  const snapGroupToBoardIfClose: SnapGroupToBoardIfCloseFn = (arr, groupId) => {
    const group: Piece[] = arr.filter((p) => p.groupId === groupId);
    for (const p of group) {
      const dx: number = p.correct.x - p.pos.x;
      const dy: number = p.correct.y - p.pos.y;
      if (hypot(dx, dy) <= boardSnapTolerance) {
        // Snap group and mark as snapped
        return translateGroup(arr, groupId, dx, dy).map((piece) =>
          piece.groupId === groupId
            ? { ...piece, snapped: true }
            : piece
        );
      }
    }
    return arr;
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

          const expected: PiecePosition = { x: p.pos.x + c.dx, y: p.pos.y + c.dy };
          const d: number = hypot(n.pos.x - expected.x, n.pos.y - expected.y);

          if (d <= neighborSnapTolerance) {
            const shiftX: number = expected.x - n.pos.x;
            const shiftY: number = expected.y - n.pos.y;

            next = translateGroup(next, n.groupId, shiftX, shiftY);
            next = mergeGroups(next, activeGroupId, n.groupId);

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
  
  const onPointerDown: OnPointerDownFn = (e, pieceId) => {
    if (solved) return;
    const el = stageRef.current;
    if (!el) return;

    const current: Piece[] = pieces;
    const byId: Map<string, Piece> = indexById(current);
    const anchor: Piece | undefined = byId.get(pieceId);
    if (!anchor) return;
    if (anchor.snapped) return;

    const rect: DOMRect = el.getBoundingClientRect();
    const px: number = (e.clientX - rect.left) / scale;
    const py: number = (e.clientY - rect.top) / scale;

    const groupId: string = anchor.groupId;
    const groupIds: string[] = getGroupPieceIds(current, groupId);

    // Prevent dragging an entire group if any piece in the group is snapped to the board
    const groupPieces = current.filter((p) => p.groupId === groupId);
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

    setDraggingGroupId(groupId); // trigger re-render for drag scale
    bringGroupToFront(groupId);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

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

    const el = stageRef.current;
    if (!el) return;

    const rect: DOMRect = el.getBoundingClientRect();
    const px: number = (e.clientX - rect.left) / scale;
    const py: number = (e.clientY - rect.top) / scale;

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

    // Let pieces roam across whole stage, with small spill
    const spillX: number = pieceW * 0.5;
    const spillY: number = pieceH * 0.5;
    dx = clamp(dx, -spillX - anchorStart.x, (stageWidth - pieceW + spillX) - anchorStart.x);
    dy = clamp(dy, -spillY - anchorStart.y, (stageHeight - pieceH + spillY) - anchorStart.y);

    setPieces((prev: Piece[]) =>
      prev.map((p: Piece) => {
        if (p.groupId !== groupId) return p;
        const sp: PiecePosition | undefined = startPositions.get(p.id);
        if (!sp) return p;
        return { ...p, pos: { x: sp.x + dx, y: sp.y + dy } };
      })
    );
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

    dragRef.current.active = false;
    dragRef.current.pointerId = null;
    dragRef.current.groupId = null;

    setDraggingGroupId(null); // trigger re-render for drag scale

    setPieces((prev: Piece[]) => {
      let next = prev;
      next = snapGroupToBoardIfClose(next, activeGroupId as string);
      next = snapAndMergeNeighbors(next, activeGroupId as string);
      next = snapGroupToBoardIfClose(next, activeGroupId as string);
      return next;
    });
  };

  const groupsCount = useMemo(() => new Set(pieces.map((p) => p.groupId)).size, [pieces]);

  

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
    const elapsedSeconds = Math.max(0, Math.round((Date.now() - startTimeRef.current) / 1000));

    const runCompletion = async () => {
      try {
        const boardEl = boardRef.current;
        const stageEl = stageRef.current;
        const shimmerOuter = shimmerOuterRef.current;
        const shimmerInner = shimmerInnerRef.current;
        const messageEl = messageRef.current;

        console.log('[Jigsaw] runCompletion start');
        console.log('[Jigsaw] refs', { boardEl, shimmerOuter, shimmerInner, messageEl });
        const tl = gsap.timeline({ defaults: { ease: 'power2.inOut' } });

        // Prefer applying glow to the stage so it won't be clipped by board overflow or transforms
        if (stageEl) {
          const prevOverflow = stageEl.style.overflow;
          stageEl.style.overflow = 'visible';
          tl.to(stageEl, { borderColor: '#FFD700', boxShadow: '0 0 60px 20px rgba(255,215,0,0.95)', duration: 0.9 });
          tl.to(stageEl, { boxShadow: '0 0 0 0 rgba(255,215,0,0)', borderColor: 'rgba(255,255,255,0.14)', duration: 0.6 }, '+=0.15');
          tl.call(() => { stageEl.style.overflow = prevOverflow; });
        } else if (boardEl) {
          tl.to(boardEl, { borderColor: '#FFD700', boxShadow: '0 0 40px 12px rgba(255,215,0,0.95)', duration: 0.8 });
          tl.to(boardEl, { boxShadow: '0 0 0 0 rgba(255,215,0,0)', borderColor: 'rgba(255,255,255,0.14)', duration: 0.6 }, '+=0.15');
        }

        if (shimmerOuter && shimmerInner) {
          shimmerOuter.style.zIndex = '50';
          shimmerOuter.style.pointerEvents = 'none';
          // Start shimmer after the glow finishes so it fully traverses the stage
          tl.set(shimmerOuter, { autoAlpha: 1 });
          // use xPercent animation for reliable motion across transforms and ensure it fully enters/exits
          tl.fromTo(shimmerInner, { xPercent: -200 }, { xPercent: 200, duration: 1.2, ease: 'power2.inOut' });
          // fade shimmer out after pass
          tl.to(shimmerOuter, { autoAlpha: 0, duration: 0.18 }, '>-0.02');
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
          if (stageEl) {
            // fallback glow on stage (not clipped)
            stageEl.style.boxShadow = '0 0 40px 12px rgba(255,215,0,0.95)';
            setTimeout(() => {
              if (stageEl) stageEl.style.boxShadow = '';
            }, 900);
          } else if (boardEl) {
            boardEl.style.boxShadow = '0 0 40px 12px rgba(255,215,0,0.95)';
            setTimeout(() => {
              if (boardEl) {
                boardEl.style.boxShadow = '';
                boardEl.style.borderColor = 'rgba(255,255,255,0.14)';
              }
            }, 900);
          }
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

        setAwardedPoints(typeof pointsResult === 'number' ? pointsResult : null);

        // Show congrats message
        setShowCongrats(true);
        if (messageEl) {
          gsap.fromTo(
            messageEl,
            { autoAlpha: 0, y: 8 },
            { autoAlpha: 1, y: 0, duration: 1.0, ease: 'power2.out' }
          );
        }

        // Wait a moment so user can read message,
        // then gracefully fade the congrats overlay out before opening the modal
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
        // hide internal state so the overlay is removed from DOM flow
        setShowCongrats(false);
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
        if (onShowRatingModal) onShowRatingModal();
      }
    };

    runCompletion();
  }, [solved, onComplete, onShowRatingModal]);

  const sendLooseToTray = () => {
    setPieces((prev) => {
      // Keep any pieces on the board-ish area where they are; move "loose" ones to tray.
      // Loose = groups that are NOT already board-aligned (no piece within board snap range)
      const next = [...prev];
      const groupIds = [...new Set(next.map((p) => p.groupId))];

      const byGroup = new Map();
      for (const gid of groupIds) {
        byGroup.set(gid, next.filter((p) => p.groupId === gid));
      }

      const moved = next.map((p) => ({ ...p, snapped: false }));

      for (const [gid, groupPieces] of byGroup.entries()) {
        const boardAligned: boolean = groupPieces.some(
          (p: Piece) => hypot(p.pos.x - p.correct.x, p.pos.y - p.correct.y) <= boardSnapTolerance + 1
        );
        if (boardAligned) continue;

        // Random tray destination based on the group's top-left
        interface GroupPiece {
          pos: PiecePosition;
        }

        const minX: number = Math.min(...(groupPieces as GroupPiece[]).map((p: GroupPiece) => p.pos.x));
        const minY: number = Math.min(...(groupPieces as { pos: PiecePosition }[]).map((p: { pos: PiecePosition }) => p.pos.y));

        const targetX =
          trayLeft + Math.random() * (trayWidth - pieceW) + (Math.random() * 2 - 1) * trayScatter;
        const targetY =
          trayTop + Math.random() * (trayHeight - pieceH) + (Math.random() * 2 - 1) * trayScatter;

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
      setWrapperWidth(wrapperW || null);

      // decide stacked layout: stack when wrapper width is less than 1200px
      const wouldStack = wrapperW > 0 ? wrapperW < 1200 : false;
      setIsStacked(wouldStack);

      const effectiveStageWidth = wouldStack ? Math.max(boardWidth, trayWidth) : boardWidth + trayWidth;
      if (!wrapperW || !effectiveStageWidth) return;

      // Simple, robust scale: fit stage to wrapper width, never scale above 1
      const next = Math.min(1, wrapperW / effectiveStageWidth);
      setScale(next);
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(wrapper);
    window.addEventListener('resize', update);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [boardWidth, trayWidth]);

  return (
    <div
      ref={wrapperRef}
      style={{
        position: 'relative',
        fontFamily: "system-ui, sans-serif",
        width: '100%',
        height: Math.round(stageHeight * scale),
        overflow: 'hidden',
        maxWidth: '100%',
        ...containerStyle,
      }}
    >
      <div
        ref={stageRef}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
          style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: stageWidth,
          height: stageHeight,
          borderRadius: 18,
          overflow: "hidden",
          background: "#070a0f",
          border: "1px solid rgba(255,255,255,0.14)",
          userSelect: "none",
          touchAction: "none",
          transformOrigin: 'top left',
          transform: `scale(${scale})`,
          // center scaled content within wrapper
          display: 'block',
          marginLeft: 0,
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
            borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "rgba(255,255,255,0.03)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: `url(${imageUrl})`,
              backgroundSize: "100% 100%",
              opacity: 0.11,
              pointerEvents: "none",
            }}
          />
          {/* Shimmer overlay (hidden until completion) */}
          <div
            ref={shimmerOuterRef}
            style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0 }}
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
          </div>
        </div>

        {/* TRAY */}
        <div
          style={{
            position: "absolute",
            left: trayLeft,
            top: trayTop,
            width: trayWidth,
            height: trayHeight,
            borderRadius: 14,
            border: "1px dashed rgba(255,255,255,0.18)",
            background: "rgba(255,255,255,0.02)",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 12,
              top: 10,
              fontSize: 12,
              opacity: 0.6,
              color: "white",
              pointerEvents: "none",
            }}
          >
            TRAY
          </div>
        </div>

        {/* PIECES */}
        {pieces.map((p) => (
          <JigsawPiece
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
            imageUrl={imageUrl}
            pos={p.pos}
            z={p.z}
            groupId={p.groupId}
            onPointerDown={onPointerDown}
            highlight={!!activeGroup && p.groupId === activeGroup}
            snapped={p.snapped || solved}
            isDragging={!!activeGroup && p.groupId === activeGroup}
          />
        ))}

        {solved && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              background: "rgba(0,0,0,0.35)",
              backdropFilter: "blur(6px)",
            }}
          >
          </div>
        )}

        
      </div>

      <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center" }}>
        <button
          onClick={() => setPieces(initialPieces)}
          style={{
            padding: "8px 12px",
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,0.15)",
            background: "white",
            cursor: "pointer",
          }}
        >
          Reset
        </button>

        <button
          onClick={sendLooseToTray}
          style={{
            padding: "8px 12px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.18)",
            background: "rgba(255,255,255,0.06)",
            color: "white",
            cursor: "pointer",
          }}
        >
          Send loose to tray
        </button>

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
    </div>
  );
}


