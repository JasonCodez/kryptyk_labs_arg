export interface JigsawEdgeMap {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface JigsawConfiguration {
  puzzleId: string;
  imageIdentity: string;
  rows: number;
  cols: number;
  shape: Record<string, number | null | undefined>;
  rotationEnabled: boolean;
  generationSeed: string;
}

function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function createSeededRandom(seed: string) {
  let state = hashString(seed) || 0x6d2b79f5;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildJigsawEdges(rows: number, cols: number, seed: string) {
  const random = createSeededRandom(`${seed}:edges`);
  const result = new Map<string, JigsawEdgeMap>();
  const direction = () => random() < 0.5 ? 1 : -1;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const id = `${row}-${col}`;
      const edge: JigsawEdgeMap = { top: 0, right: 0, bottom: 0, left: 0 };
      if (row > 0) edge.top = -result.get(`${row - 1}-${col}`)!.bottom;
      if (col > 0) edge.left = -result.get(`${row}-${col - 1}`)!.right;
      edge.right = col < cols - 1 ? direction() : 0;
      edge.bottom = row < rows - 1 ? direction() : 0;
      result.set(id, edge);
    }
  }
  return result;
}

export function shuffledJigsawIds(rows: number, cols: number, seed: string) {
  const random = createSeededRandom(`${seed}:tray`);
  const ids = Array.from({ length: rows * cols }, (_, index) => `${Math.floor(index / cols)}-${index % cols}`);
  for (let index = ids.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [ids[index], ids[swapIndex]] = [ids[swapIndex], ids[index]];
  }
  return ids;
}

export function jigsawGenerationSeed({
  mode,
  puzzleId,
  dailyDayNumber,
  puzzleInstanceId,
}: {
  mode: "catalog" | "daily" | "warz";
  puzzleId: string;
  dailyDayNumber?: number;
  puzzleInstanceId?: string;
}) {
  if (mode === "daily") return `daily:${dailyDayNumber ?? "missing"}:${puzzleId}`;
  if (mode === "warz") return `warz:${puzzleInstanceId ?? puzzleId}`;
  return `catalog:${puzzleId}`;
}

export function jigsawPuzzleSignature(config: JigsawConfiguration) {
  const shape = Object.keys(config.shape).sort().map((key) => [key, config.shape[key] ?? null]);
  return JSON.stringify({
    puzzleId: config.puzzleId,
    imageIdentity: config.imageIdentity,
    rows: config.rows,
    cols: config.cols,
    shape,
    rotationEnabled: config.rotationEnabled,
    generationSeed: config.generationSeed,
  });
}

export function calculateJigsawCompletion<T extends { groupId: string; snapped: boolean }>(pieces: T[], tray: string[]) {
  if (!pieces.length || tray.length) return { solved: false, placedPieces: pieces.filter((piece) => piece.snapped).length };
  const groupId = pieces[0].groupId;
  return {
    solved: pieces.every((piece) => piece.groupId === groupId && piece.snapped),
    placedPieces: pieces.filter((piece) => piece.snapped).length,
  };
}

export function uniqueLooseGroupIds<T extends { groupId: string; snapped: boolean }>(pieces: T[], existingTray: string[]) {
  const result = [...existingTray];
  const seen = new Set(result);
  for (const piece of pieces) {
    if (!piece.snapped && !seen.has(piece.groupId)) {
      seen.add(piece.groupId);
      result.push(piece.groupId);
    }
  }
  return result;
}
