export type JigsawPersistenceScope = "catalog" | "daily" | "none";

export interface JigsawPersistablePiece {
  id: string;
  row: number;
  col: number;
  correct: { x: number; y: number };
  pos: { x: number; y: number };
  groupId: string;
  snapped: boolean;
  z: number;
}

export interface JigsawSavedProgress {
  version: 3;
  signature: string;
  pieces: Record<string, { relX: number; relY: number; groupId: string; snapped: boolean; z: number }>;
  tray: string[];
  elapsedMs: number;
  savedAt: number;
  completionPending?: boolean;
}

export function jigsawStorageKey(scope: JigsawPersistenceScope, puzzleId: string, dailyDayNumber?: number) {
  if (scope === "catalog") return `jigsaw-progress:v2:catalog:${puzzleId}`;
  if (scope === "daily" && Number.isInteger(dailyDayNumber) && Number(dailyDayNumber) > 0) {
    return `jigsaw-progress:v2:daily:${dailyDayNumber}:${puzzleId}`;
  }
  return null;
}

export function serializeJigsawProgress({
  signature,
  pieces,
  tray,
  elapsedMs,
  completionPending = false,
  savedAt = Date.now(),
}: {
  signature: string;
  pieces: JigsawPersistablePiece[];
  tray: string[];
  elapsedMs: number;
  completionPending?: boolean;
  savedAt?: number;
}): JigsawSavedProgress {
  return {
    version: 3,
    signature,
    pieces: Object.fromEntries(pieces.map((piece) => [piece.id, {
      relX: piece.pos.x - piece.correct.x,
      relY: piece.pos.y - piece.correct.y,
      groupId: piece.groupId,
      snapped: piece.snapped,
      z: piece.z,
    }])),
    tray: [...tray],
    elapsedMs: Math.max(0, Number.isFinite(elapsedMs) ? elapsedMs : 0),
    savedAt,
    completionPending,
  };
}

function isConnectedGroup(ids: string[]) {
  if (ids.length < 2) return true;
  const remaining = new Set(ids);
  const queue = [ids[0]];
  remaining.delete(ids[0]);
  while (queue.length) {
    const [row, col] = queue.shift()!.split("-").map(Number);
    for (const neighbor of [`${row - 1}-${col}`, `${row + 1}-${col}`, `${row}-${col - 1}`, `${row}-${col + 1}`]) {
      if (remaining.delete(neighbor)) queue.push(neighbor);
    }
  }
  return remaining.size === 0;
}

export function validateJigsawSave({
  value,
  signature,
  basePieces,
  stageWidth,
  stageHeight,
  allowLegacy = false,
}: {
  value: unknown;
  signature: string;
  basePieces: JigsawPersistablePiece[];
  stageWidth: number;
  stageHeight: number;
  allowLegacy?: boolean;
}): { progress: JigsawSavedProgress; pieces: JigsawPersistablePiece[] } | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<JigsawSavedProgress>;
  // Version 2 saves (which also carried a now-ignored `zoom` field) are otherwise
  // schema-identical to version 3 — accepted here and always rewritten as version 3 below.
  if (!allowLegacy && (![2, 3].includes(candidate.version as number) || candidate.signature !== signature)) return null;
  if (!candidate.pieces || typeof candidate.pieces !== "object" || !Array.isArray(candidate.tray)) return null;
  const expectedIds = new Set(basePieces.map((piece) => piece.id));
  const savedIds = Object.keys(candidate.pieces);
  if (savedIds.length !== expectedIds.size || new Set(savedIds).size !== savedIds.length || savedIds.some((id) => !expectedIds.has(id))) return null;

  const groupMembers = new Map<string, string[]>();
  const pieces: JigsawPersistablePiece[] = [];
  for (const base of basePieces) {
    const saved = candidate.pieces[base.id];
    if (!saved || typeof saved !== "object") return null;
    const { relX, relY, groupId, snapped, z } = saved;
    if (![relX, relY, z].every(Number.isFinite) || typeof groupId !== "string" || !expectedIds.has(groupId) || typeof snapped !== "boolean") return null;
    const group = groupMembers.get(groupId) ?? [];
    group.push(base.id);
    groupMembers.set(groupId, group);
    if (snapped && (Math.abs(relX) > 0.01 || Math.abs(relY) > 0.01)) return null;
    const x = snapped ? base.correct.x : Math.min(stageWidth, Math.max(-stageWidth * 0.25, base.correct.x + relX));
    const y = snapped ? base.correct.y : Math.min(stageHeight, Math.max(-stageHeight * 0.25, base.correct.y + relY));
    pieces.push({ ...base, pos: { x, y }, groupId, snapped, z });
  }
  if ([...groupMembers.values()].some((ids) => !isConnectedGroup(ids))) return null;
  for (const ids of groupMembers.values()) {
    const members = pieces.filter((piece) => ids.includes(piece.id));
    const snappedValues = new Set(members.map((piece) => piece.snapped));
    if (snappedValues.size > 1) return null;
    const anchor = members[0];
    if (!anchor.snapped && members.some((piece) => Math.abs((piece.pos.x - anchor.pos.x) - (piece.correct.x - anchor.correct.x)) > 1.5 || Math.abs((piece.pos.y - anchor.pos.y) - (piece.correct.y - anchor.correct.y)) > 1.5)) return null;
  }
  if (new Set(candidate.tray).size !== candidate.tray.length || candidate.tray.some((id) => !groupMembers.has(id))) return null;
  if (candidate.tray.some((id) => pieces.some((piece) => piece.groupId === id && piece.snapped))) return null;

  const progress: JigsawSavedProgress = {
    version: 3,
    signature,
    pieces: candidate.pieces as JigsawSavedProgress["pieces"],
    tray: [...candidate.tray],
    elapsedMs: Number.isFinite(candidate.elapsedMs) ? Math.max(0, Number(candidate.elapsedMs)) : 0,
    savedAt: Number.isFinite(candidate.savedAt) ? Number(candidate.savedAt) : Date.now(),
    completionPending: Boolean(candidate.completionPending),
  };
  return { progress, pieces };
}

export function restoreJigsawProgress({
  storage,
  scope,
  puzzleId,
  dailyDayNumber,
  signature,
  basePieces,
  stageWidth,
  stageHeight,
}: {
  storage: Storage | null;
  scope: JigsawPersistenceScope;
  puzzleId: string;
  dailyDayNumber?: number;
  signature: string;
  basePieces: JigsawPersistablePiece[];
  stageWidth: number;
  stageHeight: number;
}) {
  const key = jigsawStorageKey(scope, puzzleId, dailyDayNumber);
  if (!storage || !key) return null;
  const parse = (raw: string | null) => { try { return raw ? JSON.parse(raw) : null; } catch { return null; } };
  const current = validateJigsawSave({ value: parse(storage.getItem(key)), signature, basePieces, stageWidth, stageHeight });
  if (current) return current;
  if (scope !== "catalog") return null;
  const legacyKey = `jigsaw-progress-${puzzleId}`;
  const legacy = validateJigsawSave({ value: parse(storage.getItem(legacyKey)), signature, basePieces, stageWidth, stageHeight, allowLegacy: true });
  if (!legacy) return null;
  try {
    storage.setItem(key, JSON.stringify(legacy.progress));
    storage.removeItem(legacyKey);
  } catch {}
  return legacy;
}
