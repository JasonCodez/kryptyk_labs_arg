import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createNotification } from "@/lib/notification-service";
import { requireEscapeRoomTeamContext, progressWhereClause, getSessionMembers } from "@/lib/escapeRoomTeamAuth";
import { applyEscapeStageProgress } from "@/lib/escape-room-progression";
import {
  parseContributionGate,
  recordStageContribution,
  summarizeStageContributions,
} from "@/lib/escape-room-contribution";

function safeJsonParse<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== "string") return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function makeDesignerItemKey(escapeRoomId: string, designerItemId: string) {
  return `item_${escapeRoomId}_${designerItemId}`;
}

type SceneState = {
  currentSceneId?: string | null;
  flags?: string[];
  hiddenItemIds?: string[];
  shownItemIds?: string[];
  disabledHotspotIds?: string[];
  enabledHotspotIds?: string[];
  itemStates?: Record<string, string>;
  itemImageOverrides?: Record<string, string>;
  itemAlphaOverrides?: Record<string, number>;
  itemScaleOverrides?: Record<string, number>;
  itemRotationOverrides?: Record<string, number>;
  itemTintOverrides?: Record<string, string>;
  stageContributions?: Record<string, Record<string, number>>;
};

function normalizeSceneState(raw: unknown): Required<SceneState> {
  const base = (raw && typeof raw === 'object') ? (raw as SceneState) : {};
  const itemStates = Object.fromEntries(
    Object.entries((base.itemStates && typeof base.itemStates === 'object') ? base.itemStates : {}).filter(
      ([itemId, state]) => typeof itemId === 'string' && typeof state === 'string' && itemId.trim().length > 0 && state.trim().length > 0
    )
  ) as Record<string, string>;

  const itemImageOverrides = Object.fromEntries(
    Object.entries((base.itemImageOverrides && typeof base.itemImageOverrides === 'object') ? base.itemImageOverrides : {}).filter(
      ([itemId, imageUrl]) => typeof itemId === 'string' && typeof imageUrl === 'string' && itemId.trim().length > 0 && imageUrl.trim().length > 0
    )
  ) as Record<string, string>;

  const itemAlphaOverrides = Object.fromEntries(
    Object.entries((base.itemAlphaOverrides && typeof base.itemAlphaOverrides === 'object') ? base.itemAlphaOverrides : {}).filter(([itemId, value]) => {
      const n = Number(value);
      return typeof itemId === 'string' && itemId.trim().length > 0 && Number.isFinite(n);
    }).map(([itemId, value]) => [itemId, Math.max(0, Math.min(1, Number(value)))])
  ) as Record<string, number>;

  const itemScaleOverrides = Object.fromEntries(
    Object.entries((base.itemScaleOverrides && typeof base.itemScaleOverrides === 'object') ? base.itemScaleOverrides : {}).filter(([itemId, value]) => {
      const n = Number(value);
      return typeof itemId === 'string' && itemId.trim().length > 0 && Number.isFinite(n) && n > 0;
    }).map(([itemId, value]) => [itemId, Math.max(0.1, Math.min(5, Number(value)))])
  ) as Record<string, number>;

  const itemRotationOverrides = Object.fromEntries(
    Object.entries((base.itemRotationOverrides && typeof base.itemRotationOverrides === 'object') ? base.itemRotationOverrides : {}).filter(([itemId, value]) => {
      const n = Number(value);
      return typeof itemId === 'string' && itemId.trim().length > 0 && Number.isFinite(n);
    }).map(([itemId, value]) => [itemId, Number(value)])
  ) as Record<string, number>;

  const itemTintOverrides = Object.fromEntries(
    Object.entries((base.itemTintOverrides && typeof base.itemTintOverrides === 'object') ? base.itemTintOverrides : {}).filter(
      ([itemId, value]) => typeof itemId === 'string' && itemId.trim().length > 0 && typeof value === 'string' && value.trim().length > 0
    )
  ) as Record<string, string>;

  return {
    currentSceneId: typeof base.currentSceneId === 'string' && base.currentSceneId.trim().length > 0 ? base.currentSceneId.trim() : null,
    flags: Array.isArray(base.flags) ? base.flags.filter((x) => typeof x === 'string' && x.trim().length > 0).map((x) => x.trim()) : [],
    hiddenItemIds: Array.isArray(base.hiddenItemIds) ? base.hiddenItemIds.filter((x) => typeof x === 'string') : [],
    shownItemIds: Array.isArray(base.shownItemIds) ? base.shownItemIds.filter((x) => typeof x === 'string') : [],
    disabledHotspotIds: Array.isArray(base.disabledHotspotIds) ? base.disabledHotspotIds.filter((x) => typeof x === 'string') : [],
    enabledHotspotIds: Array.isArray(base.enabledHotspotIds) ? base.enabledHotspotIds.filter((x) => typeof x === 'string') : [],
    itemStates,
    itemImageOverrides,
    itemAlphaOverrides,
    itemScaleOverrides,
    itemRotationOverrides,
    itemTintOverrides,
    stageContributions: (base.stageContributions && typeof base.stageContributions === 'object')
      ? (base.stageContributions as Record<string, Record<string, number>>)
      : {},
  };
}

async function resolveTargetLayoutIdForScene(
  puzzleId: string,
  escapeRoomId: string,
  targetSceneId: string
): Promise<string | null> {
  const trimmedTarget = targetSceneId.trim();
  if (!trimmedTarget) return null;

  const [puzzle, layouts] = await Promise.all([
    prisma.puzzle.findUnique({ where: { id: puzzleId }, select: { data: true } }),
    prisma.roomLayout.findMany({
      where: { escapeRoomId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, title: true, backgroundUrl: true },
    }),
  ]);

  if (!layouts.length) return null;

  const data = puzzle?.data && typeof puzzle.data === 'object' ? (puzzle.data as Record<string, unknown>) : null;
  const escapeRoomData = data && 'escapeRoomData' in data ? (data.escapeRoomData as Record<string, unknown> | null) : null;
  const scenes = Array.isArray(escapeRoomData?.scenes) ? (escapeRoomData.scenes as Record<string, unknown>[]) : [];

  const targetSceneIdx = scenes.findIndex((scene) => {
    const sceneId = typeof scene?.id === 'string' ? scene.id.trim() : '';
    return sceneId === trimmedTarget;
  });

  if (targetSceneIdx >= 0 && layouts[targetSceneIdx]?.id) {
    return layouts[targetSceneIdx].id;
  }

  const byDirectId = layouts.find((layout) => layout.id === trimmedTarget);
  if (byDirectId?.id) return byDirectId.id;

  const byTitle = layouts.find((layout) => (layout.title || '').trim() === trimmedTarget);
  if (byTitle?.id) return byTitle.id;

  const byBackground = layouts.find((layout) => (layout.backgroundUrl || '').trim() === trimmedTarget);
  if (byBackground?.id) return byBackground.id;

  return null;
}

async function emitEscapeSession(teamId: string, puzzleId: string, payload: Record<string, unknown>) {
  try {
    const { postToSocket } = await import("@/lib/socket-client");
    const room = `escape:${teamId}::${puzzleId}`;
    await postToSocket("/emit", { room, event: "escapeSessionUpdated", payload });
  } catch {
    // non-fatal
  }
}

async function emitEscapeActivity(teamId: string, puzzleId: string, payload: Record<string, unknown>) {
  try {
    const { postToSocket } = await import("@/lib/socket-client");
    const room = `escape:${teamId}::${puzzleId}`;
    await postToSocket("/emit", { room, event: "escapeActivity", payload });
  } catch {
    // non-fatal
  }
}

/**
 * Deducts `penaltySecs` seconds from the run timer by advancing runExpiresAt backward.
 * Returns the applied penalty and the new expiry ISO string (or nulls if no-op).
 */
async function applyTimePenalty(
  progressId: string,
  penaltySecs: number,
  currentRunExpiresAt: Date | null
): Promise<{ penaltyApplied: number; newRunExpiresAt: string | null }> {
  if (penaltySecs <= 0 || !currentRunExpiresAt) {
    return { penaltyApplied: 0, newRunExpiresAt: null };
  }
  const newExpiry = new Date(currentRunExpiresAt.getTime() - penaltySecs * 1000);
  try {
    await prisma.teamEscapeProgress.update({
      where: { id: progressId },
      data: { runExpiresAt: newExpiry },
    });
  } catch {
    return { penaltyApplied: 0, newRunExpiresAt: null };
  }
  return { penaltyApplied: penaltySecs, newRunExpiresAt: newExpiry.toISOString() };
}

function makeActivityId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

type SfxPayload = { url: string; volume?: number };

function normalizeSfx(raw: unknown): SfxPayload | null {
  if (!raw) return null;
  if (typeof raw === 'string') {
    const url = raw.trim();
    return url ? { url } : null;
  }
  if (raw && typeof raw === 'object') {
    const rawObj = raw as Record<string, unknown>;
    const url = typeof rawObj.url === 'string' ? rawObj.url.trim() : '';
    if (!url) return null;
    const v = Number(rawObj.volume);
    const volume = Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : undefined;
    return { url, ...(volume !== undefined ? { volume } : {}) };
  }
  return null;
}

function extractSfx(meta: Record<string, unknown>, kind: 'pickup' | 'use' | 'trigger' | 'loot'): SfxPayload | null {
  try {
    const sfx = meta && typeof meta.sfx === 'object' ? (meta.sfx as Record<string, unknown>) : null;
    if (!sfx) return null;
    return normalizeSfx(sfx[kind]);
  } catch {
    return null;
  }
}

async function buildInventoryItems(escapeRoomId: string, inventory: string[]) {
  let inventoryItems: Record<string, { id: string; key: string; name: string; imageUrl: string | null }> = {};
  try {
    if (!Array.isArray(inventory) || inventory.length === 0) return {};
    const defs = await prisma.itemDefinition.findMany({
      where: { escapeRoomId, key: { in: inventory } },
      select: { id: true, key: true, name: true, imageUrl: true },
    });
    inventoryItems = Object.fromEntries(defs.map((d) => [d.key, d]));
  } catch {
    inventoryItems = {};
  }
  return inventoryItems;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> } | { params: { id: string } }
) {
  try {
    const resolved = params instanceof Promise ? await params : params;
    const puzzleId = resolved.id;

    const body = await request.json().catch(() => ({}));
    const { action, hotspotId, teamId, lobbyId, itemKey, solo } = body as { action?: string; hotspotId?: string; teamId?: string; lobbyId?: string; itemKey?: string; solo?: boolean };
    if (!action || !hotspotId) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

    const ctx = await requireEscapeRoomTeamContext(request, puzzleId, { teamId: lobbyId ? undefined : teamId, lobbyId, solo: !!solo });
    if (ctx instanceof NextResponse) return ctx;

    const user = await prisma.user.findUnique({ where: { id: ctx.userId }, select: { id: true, name: true, email: true } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const sessionMemberRows = await getSessionMembers(ctx);
    const teamUserIds = sessionMemberRows.map((m) => m.userId).filter(Boolean);

    // Resolve escapeRoom for this puzzle
    const escapeRoom = await prisma.escapeRoomPuzzle.findUnique({ where: { puzzleId } });
    if (!escapeRoom) return NextResponse.json({ error: 'Escape room not found' }, { status: 404 });

    const hotspot = await prisma.hotspot.findUnique({
      where: { id: hotspotId },
      include: { layout: { select: { escapeRoomId: true } } },
    });
    if (!hotspot) return NextResponse.json({ error: 'Hotspot not found' }, { status: 404 });
    if (hotspot.layout.escapeRoomId !== escapeRoom.id) {
      return NextResponse.json({ error: 'Hotspot not part of this escape room' }, { status: 403 });
    }

    // Block actions unless a run is actively started (prevents door opens/pickups during briefing).
    const progress = await prisma.teamEscapeProgress.findFirst({
      where: progressWhereClause(ctx),
      select: {
        id: true,
        inventory: true,
        sceneState: true,
        currentStageIndex: true,
        solvedStages: true,
        runStartedAt: true,
        runExpiresAt: true,
        failedAt: true,
        completedAt: true,
      },
    });

    if (!progress) {
      return NextResponse.json(
        { error: 'Escape room has not been started for this team. Start from the team lobby.' },
        { status: 409 }
      );
    }
    if (!progress.runStartedAt) {
      return NextResponse.json({ error: 'The run has not started yet.' }, { status: 409 });
    }
    if (progress.completedAt) {
      return NextResponse.json({ error: 'This escape room run is already complete.' }, { status: 409 });
    }
    if (progress.failedAt) {
      return NextResponse.json({ error: 'This escape room run has already failed and cannot be retried.' }, { status: 409 });
    }

    if (action === 'pickupPreview') {
      if (!hotspot.targetId) return NextResponse.json({ error: 'No item to pick up' }, { status: 400 });

      const item = await prisma.itemDefinition.findUnique({ where: { id: hotspot.targetId } });
      if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 });
      if (item.escapeRoomId !== escapeRoom.id) {
        return NextResponse.json({ error: 'Item not part of this escape room' }, { status: 403 });
      }

      const pickupMeta = safeJsonParse<Record<string, unknown>>(hotspot.meta, {});
      const pickupSfx = extractSfx(pickupMeta, 'pickup');
      const presetRaw = typeof pickupMeta?.pickupAnimationPreset === 'string' ? pickupMeta.pickupAnimationPreset : 'cinematic';
      const pickupAnimationPreset = ['cinematic', 'quickSpin', 'floatIn', 'powerDrop', 'spiral', 'bounce', 'glitch', 'flash'].includes(presetRaw)
        ? presetRaw
        : 'cinematic';
      const pickupAnimationUrl = typeof pickupMeta?.pickupAnimationUrl === 'string' && pickupMeta.pickupAnimationUrl ? pickupMeta.pickupAnimationUrl : null;

      return NextResponse.json({
        success: true,
        preview: {
          id: item.id,
          key: item.key,
          name: item.name,
          imageUrl: item.imageUrl ?? null,
          pickupAnimationPreset,
          pickupAnimationUrl,
        },
        ...(pickupSfx ? { sfx: pickupSfx } : {}),
      });
    }

    if (action === 'pickup') {
      // If hotspot.targetId points to an ItemDefinition id, add item key to player state
      if (!hotspot.targetId) return NextResponse.json({ error: 'No item to pick up' }, { status: 400 });

      const pickupMeta = safeJsonParse<Record<string, unknown>>(hotspot.meta, {});

      const pickupSfx = extractSfx(pickupMeta, 'pickup');

      const item = await prisma.itemDefinition.findUnique({ where: { id: hotspot.targetId } });
      if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 });
      if (item.escapeRoomId !== escapeRoom.id) {
        return NextResponse.json({ error: 'Item not part of this escape room' }, { status: 403 });
      }

      let inventory: string[] = [];
      try {
        inventory = progress?.inventory ? JSON.parse(progress.inventory) : [];
        if (!Array.isArray(inventory)) inventory = [];
      } catch {
        inventory = [];
      }

      if (!inventory.includes(item.key)) inventory.push(item.key);

      const pickupStageIndex = Math.max(1, Number(progress.currentStageIndex || 1));
      const pickupSceneStateBase = normalizeSceneState(safeJsonParse<Record<string, unknown>>(progress?.sceneState, {}));
      const pickupSceneState = recordStageContribution({
        sceneStateRaw: pickupSceneStateBase,
        stageIndex: pickupStageIndex,
        userId: ctx.userId,
      });

      await prisma.teamEscapeProgress.update({
        where: { id: progress.id },
        data: {
          inventory: JSON.stringify(inventory),
          sceneState: JSON.stringify(pickupSceneState),
        },
      });

      // Provide item metadata for inventory rendering.
      const inventoryItems = await buildInventoryItems(escapeRoom.id, inventory);

      // Let the team UI update inventory quickly (non-blocking)
      await emitEscapeSession(ctx.teamId, puzzleId, {
        teamId: ctx.teamId,
        puzzleId,
        inventory,
        inventoryItems,
        sceneState: pickupSceneState,
      });

      // Real-time team activity feed (non-blocking)
      await emitEscapeActivity(ctx.teamId, puzzleId, {
        teamId: ctx.teamId,
        puzzleId,
        entry: {
          id: makeActivityId(),
          ts: new Date().toISOString(),
          type: 'pickup',
          title: `Picked up: ${item.name}`,
          actor: { id: user.id, name: user.name || user.email || 'Teammate' },
          meta: { itemId: item.id, itemKey: item.key, ...(pickupSfx ? { sfx: pickupSfx } : {}) },
        },
      });

      // Create an in-app notification and activity log for the pickup
      (async () => {
        try {
          await createNotification({
            userId: user.id,
            type: "system",
            title: `Item Picked Up: ${item.name}`,
            message: `You picked up ${item.name}. It has been added to your inventory.`,
            icon: "🧭",
            relatedId: item.id,
          });

          try {
            await prisma.activity.create({
              data: {
                userId: user.id,
                type: "escape_pickup",
                title: `Picked up: ${item.name}`,
                description: `Picked up ${item.name} in ${escapeRoom.roomTitle}`,
                icon: "🧭",
                relatedId: item.id,
                relatedType: "item",
              },
            });
          } catch (actErr) {
            // non-fatal - log and continue
            console.error('Failed to create pickup activity:', actErr);
          }
        } catch (notifyErr) {
          // ignore notification failures
          console.error('Failed to send pickup notification:', notifyErr);
        }
      })();

      // Also notify team members and send a team-level socket event (non-blocking)
      (async () => {
        try {
          const members = await getSessionMembers(ctx);
          const memberUserIds = members.map(m => m.userId).filter(id => id !== user.id);

          for (const memberUserId of memberUserIds) {
            try {
              await createNotification({
                userId: memberUserId,
                type: "team_update",
                title: `Teammate picked up ${item.name}`,
                message: `${user.name || user.email} picked up ${item.name} in ${escapeRoom.roomTitle}`,
                icon: "🧭",
                relatedId: item.id,
              });
            } catch (memberNotifyErr) {
              console.error('Failed to notify team member', memberNotifyErr);
            }
          }

          // Push a team-level socket event if socket server configured
          try {
            const { postToSocket } = await import('@/lib/socket-client');
            await postToSocket('/team-event', {
              teamId: ctx.teamId,
              event: 'pickup',
              userId: user.id,
              itemId: item.id,
              itemName: item.name,
              puzzleId,
            });
          } catch {
            // non-fatal
          }
        } catch (outerErr) {
          console.error('Failed to notify teams for pickup:', outerErr);
        }
      })();

      return NextResponse.json({
        success: true,
        inventory,
        inventoryItems,
        pickedUp: { id: item.id, key: item.key, name: item.name, imageUrl: item.imageUrl ?? null },
        ...(pickupSfx ? { sfx: pickupSfx } : {}),
      });
    }

    if (action === 'use') {
      if (!itemKey || typeof itemKey !== 'string') {
        return NextResponse.json({ error: 'itemKey is required' }, { status: 400 });
      }

      // Must have item in inventory
      let inventory: string[] = [];
      try {
        inventory = progress?.inventory ? JSON.parse(progress.inventory) : [];
        if (!Array.isArray(inventory)) inventory = [];
      } catch {
        inventory = [];
      }
      if (!inventory.includes(itemKey)) {
        return NextResponse.json({ error: 'Item is not in inventory' }, { status: 400 });
      }

      const meta = safeJsonParse<Record<string, unknown>>(hotspot.meta, {});

      const useSfx = extractSfx(meta, 'use');
      const lootSfx = extractSfx(meta, 'loot');
      const requiredItemId = typeof meta.requiredItemId === 'string' ? meta.requiredItemId : null;
      const derivedRequiredItemKey = requiredItemId ? makeDesignerItemKey(String(escapeRoom.id), requiredItemId) : null;

      const requiresItemIds: string[] = Array.isArray(meta.requiresItemIds)
        ? meta.requiresItemIds.filter((x: unknown): x is string => typeof x === 'string')
        : [];
      const derivedRequiresItems: string[] = requiresItemIds.map((id) => makeDesignerItemKey(String(escapeRoom.id), id));

      const requiresItems: string[] = Array.from(
        new Set([
          ...(Array.isArray(meta.requiresItems) ? meta.requiresItems.filter((x: unknown): x is string => typeof x === 'string') : []),
          ...derivedRequiresItems,
        ])
      );
      const requiredItemKey = typeof meta.requiredItemKey === 'string' ? meta.requiredItemKey : derivedRequiredItemKey;

      const useEffect = (meta && typeof meta.useEffect === 'object' && meta.useEffect) ? (meta.useEffect as Record<string, unknown>) : null;

      // Seconds to deduct from the run timer on a wrong/failed interaction.
      const usePenaltySecs = typeof meta.penaltySeconds === 'number' && meta.penaltySeconds > 0
        ? Math.min(Math.floor(meta.penaltySeconds), 300)
        : 0;
      const currentRunExpiresAt: Date | null = progress?.runExpiresAt ? new Date(progress.runExpiresAt) : null;

      // If hotspot specifies required items, enforce that the dragged item is one of them.
      if (requiredItemKey && requiredItemKey !== itemKey) {
        const penalty = await applyTimePenalty(progress.id, usePenaltySecs, currentRunExpiresAt);
        return NextResponse.json({
          error: `That item doesn't work here.`,
          ...(penalty.penaltyApplied > 0 ? { penaltyApplied: penalty.penaltyApplied, newRunExpiresAt: penalty.newRunExpiresAt } : {}),
        }, { status: 409 });
      }
      if (requiresItems.length > 0 && !requiresItems.includes(itemKey)) {
        const penalty = await applyTimePenalty(progress.id, usePenaltySecs, currentRunExpiresAt);
        return NextResponse.json({
          error: `That item doesn't work here.`,
          ...(penalty.penaltyApplied > 0 ? { penaltyApplied: penalty.penaltyApplied, newRunExpiresAt: penalty.newRunExpiresAt } : {}),
        }, { status: 409 });
      }

      // If multiple items are required, ensure all are present.
      const missingRequiredForUse = requiresItems.filter((k) => !inventory.includes(k));
      if (requiresItems.length > 0 && missingRequiredForUse.length > 0) {
        const penalty = await applyTimePenalty(progress.id, usePenaltySecs, currentRunExpiresAt);
        return NextResponse.json({
          error: `Missing required item(s): ${missingRequiredForUse.join(', ')}`,
          ...(penalty.penaltyApplied > 0 ? { penaltyApplied: penalty.penaltyApplied, newRunExpiresAt: penalty.newRunExpiresAt } : {}),
        }, { status: 409 });
      }

      // If a useEffect is configured, apply it even for non-trigger hotspots.
      // This enables "open container" interactions without advancing stages.
      if (useEffect) {
        const strict = useEffect?.strict === true;

        const baseSceneState = normalizeSceneState(safeJsonParse<Record<string, unknown>>(progress?.sceneState, {}));
        const flags = new Set(baseSceneState.flags || []);
        const hiddenItemIds = new Set(baseSceneState.hiddenItemIds);
        const shownItemIds = new Set(baseSceneState.shownItemIds);
        const disabledHotspotIds = new Set(baseSceneState.disabledHotspotIds);
        const enabledHotspotIds = new Set(baseSceneState.enabledHotspotIds);
        const itemStates = { ...(baseSceneState.itemStates || {}) };
        const itemImageOverrides = { ...(baseSceneState.itemImageOverrides || {}) };
        const itemAlphaOverrides = { ...(baseSceneState.itemAlphaOverrides || {}) };
        const itemScaleOverrides = { ...(baseSceneState.itemScaleOverrides || {}) };
        const itemRotationOverrides = { ...(baseSceneState.itemRotationOverrides || {}) };
        const itemTintOverrides = { ...(baseSceneState.itemTintOverrides || {}) };

        const hideItemIds: string[] = Array.isArray(useEffect.hideItemIds) ? useEffect.hideItemIds.filter((x: unknown): x is string => typeof x === 'string') : [];
        const showItemIds: string[] = Array.isArray(useEffect.showItemIds) ? useEffect.showItemIds.filter((x: unknown): x is string => typeof x === 'string') : [];
        const disableHotspotIds: string[] = Array.isArray(useEffect.disableHotspotIds) ? useEffect.disableHotspotIds.filter((x: unknown): x is string => typeof x === 'string') : [];
        const enableHotspotIds: string[] = Array.isArray(useEffect.enableHotspotIds) ? useEffect.enableHotspotIds.filter((x: unknown): x is string => typeof x === 'string') : [];
        const grantFlags: string[] = Array.isArray(useEffect.grantFlags) ? useEffect.grantFlags.filter((x: unknown): x is string => typeof x === 'string' && x.trim().length > 0).map((x: string) => x.trim()) : [];
        const revokeFlags: string[] = Array.isArray(useEffect.revokeFlags) ? useEffect.revokeFlags.filter((x: unknown): x is string => typeof x === 'string' && x.trim().length > 0).map((x: string) => x.trim()) : [];
        const grantItemKeys: string[] = Array.isArray(useEffect.grantItemKeys) ? useEffect.grantItemKeys.filter((x: unknown): x is string => typeof x === 'string') : [];
        const setItemStateById: Record<string, string> = Object.fromEntries(
          Object.entries((useEffect?.setItemStateById && typeof useEffect.setItemStateById === 'object') ? useEffect.setItemStateById : {}).filter(
            ([itemId, state]) => typeof itemId === 'string' && typeof state === 'string' && itemId.trim().length > 0 && state.trim().length > 0
          )
        ) as Record<string, string>;
        const setItemImageById: Record<string, string> = Object.fromEntries(
          Object.entries((useEffect?.setItemImageById && typeof useEffect.setItemImageById === 'object') ? useEffect.setItemImageById : {}).filter(
            ([itemId, imageUrl]) => typeof itemId === 'string' && typeof imageUrl === 'string' && itemId.trim().length > 0 && imageUrl.trim().length > 0
          )
        ) as Record<string, string>;
        const setItemAlphaById: Record<string, number> = Object.fromEntries(
          Object.entries((useEffect?.setItemAlphaById && typeof useEffect.setItemAlphaById === 'object') ? useEffect.setItemAlphaById : {})
            .filter(([itemId, alpha]) => {
              const n = Number(alpha);
              return typeof itemId === 'string' && itemId.trim().length > 0 && Number.isFinite(n);
            })
            .map(([itemId, alpha]) => [itemId, Math.max(0, Math.min(1, Number(alpha)))])
        ) as Record<string, number>;
        const setItemScaleById: Record<string, number> = Object.fromEntries(
          Object.entries((useEffect?.setItemScaleById && typeof useEffect.setItemScaleById === 'object') ? useEffect.setItemScaleById : {})
            .filter(([itemId, scale]) => {
              const n = Number(scale);
              return typeof itemId === 'string' && itemId.trim().length > 0 && Number.isFinite(n) && n > 0;
            })
            .map(([itemId, scale]) => [itemId, Math.max(0.1, Math.min(5, Number(scale)))])
        ) as Record<string, number>;
        const setItemRotationById: Record<string, number> = Object.fromEntries(
          Object.entries((useEffect?.setItemRotationById && typeof useEffect.setItemRotationById === 'object') ? useEffect.setItemRotationById : {})
            .filter(([itemId, rotation]) => {
              const n = Number(rotation);
              return typeof itemId === 'string' && itemId.trim().length > 0 && Number.isFinite(n);
            })
            .map(([itemId, rotation]) => [itemId, Number(rotation)])
        ) as Record<string, number>;
        const setItemTintById: Record<string, string> = Object.fromEntries(
          Object.entries((useEffect?.setItemTintById && typeof useEffect.setItemTintById === 'object') ? useEffect.setItemTintById : {}).filter(
            ([itemId, tint]) => typeof itemId === 'string' && typeof tint === 'string' && itemId.trim().length > 0 && tint.trim().length > 0
          )
        ) as Record<string, string>;

        const consumeItemKeys: string[] = Array.isArray(useEffect.consumeItemKeys)
          ? useEffect.consumeItemKeys.filter((x: unknown): x is string => typeof x === 'string')
          : [];
        const consumeRequiredItems = useEffect.consumeRequiredItems === true;

        // Optional strict validation for designer wiring (useful during authoring/testing).
        if (strict) {
          // Validate hotspot identifiers referenced by useEffect exist for this escape room.
          // Identifiers may be either DB hotspot ids OR designer-authored `zoneId` values.
          const hotspotIdsToCheck = Array.from(new Set([...disableHotspotIds, ...enableHotspotIds])).filter(Boolean);
          if (hotspotIdsToCheck.length > 0) {
            const all = await prisma.hotspot.findMany({
              where: {
                layout: { escapeRoomId: escapeRoom.id },
              },
              select: { id: true, meta: true },
            });
            const foundIdSet = new Set(all.map((h) => String(h.id)));
            const foundZoneIdSet = new Set(
              all
                .map((h) => safeJsonParse<Record<string, unknown>>(h.meta, {}))
                .map((m) => (typeof m?.zoneId === 'string' ? m.zoneId : ''))
                .filter(Boolean)
            );

            const missing = hotspotIdsToCheck.filter((id) => !foundIdSet.has(String(id)) && !foundZoneIdSet.has(String(id)));
            if (missing.length > 0) {
              return NextResponse.json({ error: `Invalid hotspot/zone id(s) in useEffect: ${missing.join(', ')}` }, { status: 400 });
            }
          }

          // Validate item keys referenced by useEffect exist as ItemDefinitions for this escape room.
          const itemKeysToCheck = Array.from(
            new Set([
              ...grantItemKeys,
              ...consumeItemKeys,
              ...(consumeRequiredItems ? requiresItems : []),
              ...(consumeRequiredItems && requiredItemKey ? [requiredItemKey] : []),
            ])
          ).filter(Boolean);

          if (itemKeysToCheck.length > 0) {
            const defs = await prisma.itemDefinition.findMany({
              where: { escapeRoomId: escapeRoom.id, key: { in: itemKeysToCheck } },
              select: { key: true },
            });
            const foundKeys = new Set(defs.map((d) => String(d.key)));
            const missing = itemKeysToCheck.filter((k) => !foundKeys.has(String(k)));
            if (missing.length > 0) {
              return NextResponse.json({ error: `Invalid item key(s) in useEffect: ${missing.join(', ')}` }, { status: 400 });
            }
          }
        }

        for (const id of hideItemIds) {
          hiddenItemIds.add(id);
          shownItemIds.delete(id);
        }
        for (const id of showItemIds) {
          shownItemIds.add(id);
          hiddenItemIds.delete(id);
        }
        for (const id of disableHotspotIds) {
          disabledHotspotIds.add(id);
          enabledHotspotIds.delete(id);
        }
        for (const id of enableHotspotIds) {
          enabledHotspotIds.add(id);
          disabledHotspotIds.delete(id);
        }
        for (const flag of grantFlags) {
          flags.add(flag);
        }
        for (const flag of revokeFlags) {
          flags.delete(flag);
        }
        for (const [itemId, state] of Object.entries(setItemStateById)) {
          itemStates[itemId] = state;
        }
        for (const [itemId, imageUrl] of Object.entries(setItemImageById)) {
          itemImageOverrides[itemId] = imageUrl;
        }
        for (const [itemId, alpha] of Object.entries(setItemAlphaById)) {
          itemAlphaOverrides[itemId] = alpha;
        }
        for (const [itemId, scale] of Object.entries(setItemScaleById)) {
          itemScaleOverrides[itemId] = scale;
        }
        for (const [itemId, rotation] of Object.entries(setItemRotationById)) {
          itemRotationOverrides[itemId] = rotation;
        }
        for (const [itemId, tint] of Object.entries(setItemTintById)) {
          itemTintOverrides[itemId] = tint;
        }

        const consumeItem = meta.consumeItemOnUse !== false;
        const nextInventorySet = new Set<string>(inventory);

        // Consumption wiring:
        // - default: consume the dragged/used item unless consumeItemOnUse === false
        // - optional: consume additional item keys (for combinations)
        // - optional: consume all required items declared in requiresItems/requiredItemKey
        const toConsume = new Set<string>();
        if (consumeItem) toConsume.add(itemKey);
        for (const k of consumeItemKeys) toConsume.add(k);
        if (consumeRequiredItems) {
          for (const k of requiresItems) toConsume.add(k);
          if (requiredItemKey) toConsume.add(requiredItemKey);
        }
        if (strict) {
          const missingConsume = Array.from(toConsume).filter((k) => !nextInventorySet.has(k));
          if (missingConsume.length > 0) {
            return NextResponse.json({ error: `Missing required item(s): ${missingConsume.join(', ')}` }, { status: 409 });
          }
        }
        for (const k of toConsume) nextInventorySet.delete(k);

        // Optionally grant loot to inventory immediately (no separate pickup hotspot required)
        // Keys must correspond to ItemDefinition.key for this escape room.
        const granted: Array<{ key: string; name: string }> = [];
        if (grantItemKeys.length > 0) {
          const uniqueGrantKeys = Array.from(new Set(grantItemKeys)).filter(Boolean);
          if (uniqueGrantKeys.length > 0) {
            const defs = await prisma.itemDefinition.findMany({
              where: { escapeRoomId: escapeRoom.id, key: { in: uniqueGrantKeys } },
              select: { key: true, name: true },
            });

            if (strict) {
              const found = new Set(defs.map((d) => String(d.key)));
              const missing = uniqueGrantKeys.filter((k) => !found.has(String(k)));
              if (missing.length > 0) {
                return NextResponse.json({ error: `Invalid grantItemKeys: ${missing.join(', ')}` }, { status: 400 });
              }
            }

            for (const d of defs) {
              if (!nextInventorySet.has(d.key)) {
                nextInventorySet.add(d.key);
                granted.push({ key: d.key, name: d.name });
              }
            }
          }
        }

        const nextInventory = Array.from(nextInventorySet);
        const sceneStateWithContribution = recordStageContribution({
          sceneStateRaw: {
            currentSceneId: baseSceneState.currentSceneId,
            flags: Array.from(flags),
            hiddenItemIds: Array.from(hiddenItemIds),
            shownItemIds: Array.from(shownItemIds),
            disabledHotspotIds: Array.from(disabledHotspotIds),
            enabledHotspotIds: Array.from(enabledHotspotIds),
            itemStates,
            itemImageOverrides,
            itemAlphaOverrides,
            itemScaleOverrides,
            itemRotationOverrides,
            itemTintOverrides,
            stageContributions: baseSceneState.stageContributions || {},
          },
          stageIndex: Math.max(1, Number(progress.currentStageIndex || 1)),
          userId: ctx.userId,
        });

        const nextSceneState: Required<SceneState> = {
          currentSceneId: baseSceneState.currentSceneId,
          flags: Array.from(flags),
          hiddenItemIds: Array.from(hiddenItemIds),
          shownItemIds: Array.from(shownItemIds),
          disabledHotspotIds: Array.from(disabledHotspotIds),
          enabledHotspotIds: Array.from(enabledHotspotIds),
          itemStates,
          itemImageOverrides,
          itemAlphaOverrides,
          itemScaleOverrides,
          itemRotationOverrides,
          itemTintOverrides,
          stageContributions: (sceneStateWithContribution.stageContributions as Record<string, Record<string, number>>) || {},
        };

        await prisma.teamEscapeProgress.update({
          where: { id: progress.id },
          data: {
            inventory: JSON.stringify(nextInventory),
            sceneState: JSON.stringify(nextSceneState),
          },
          select: { inventory: true, sceneState: true },
        });

        const inventoryItems = await buildInventoryItems(escapeRoom.id, nextInventory);

        await emitEscapeSession(ctx.teamId, puzzleId, {
          teamId: ctx.teamId,
          puzzleId,
          inventory: nextInventory,
          inventoryItems,
          sceneState: nextSceneState,
        });

        let useLabel = (typeof meta.label === 'string' && meta.label.trim()) ? meta.label.trim() : '';
        if (!useLabel) {
          // Resolve a friendly item name from ItemDefinition rather than showing the raw key.
          try {
            const itemDef = await prisma.itemDefinition.findUnique({ where: { key: itemKey }, select: { name: true } });
            useLabel = itemDef?.name ? `Used item: ${itemDef.name}` : `Used item: ${itemKey}`;
          } catch {
            useLabel = `Used item: ${itemKey}`;
          }
        }
        await emitEscapeActivity(ctx.teamId, puzzleId, {
          teamId: ctx.teamId,
          puzzleId,
          entry: {
            id: makeActivityId(),
            ts: new Date().toISOString(),
            type: 'use_item',
            title: useLabel,
            actor: { id: user.id, name: user.name || user.email || 'Teammate' },
            meta: {
              itemKey,
              hotspotId,
              consumed: Array.from(toConsume),
              ...(useSfx ? { sfx: useSfx } : {}),
              useEffect: {
                hideItemIds,
                showItemIds,
                disableHotspotIds,
                enableHotspotIds,
                grantFlags,
                revokeFlags,
                setItemStateById,
                setItemImageById,
                setItemAlphaById,
                setItemScaleById,
                setItemRotationById,
                setItemTintById,
                grantItemKeys,
                consumeItemKeys,
                consumeRequiredItems,
                strict,
              },
            },
          },
        });

        if (granted.length > 0) {
          const names = granted.map((g) => g.name || g.key).filter(Boolean);
          const pretty = names.length === 1 ? names[0] : names.join(', ');
          await emitEscapeActivity(ctx.teamId, puzzleId, {
            teamId: ctx.teamId,
            puzzleId,
            entry: {
              id: makeActivityId(),
              ts: new Date().toISOString(),
              type: 'loot',
              title: `Received: ${pretty}`,
              actor: { id: user.id, name: user.name || user.email || 'Teammate' },
              meta: { grantedKeys: granted.map((g) => g.key), hotspotId, ...(lootSfx ? { sfx: lootSfx } : {}) },
            },
          });
        }

        return NextResponse.json({
          success: true,
          inventory: nextInventory,
          inventoryItems,
          sceneState: nextSceneState,
          consumed: Array.from(toConsume).length > 0 ? { keys: Array.from(toConsume) } : null,
          granted: granted.length > 0 ? { keys: granted.map((g) => g.key) } : null,
          ...(useSfx ? { sfx: useSfx } : {}),
          ...(lootSfx ? { sfxLoot: lootSfx } : {}),
        });
      }

      // Otherwise, "use" falls back to trigger/door semantics.
      const hotspotType = (hotspot.type || '').toLowerCase();
      if (hotspotType !== 'trigger' && meta.actionType !== 'trigger') {
        return NextResponse.json({ error: 'Nothing happens.' }, { status: 409 });
      }

      // Re-run gating that trigger uses (including missing items), but allow the provided item.
      const missing = requiresItems.filter((k) => !inventory.includes(k));
      if (requiresItems.length > 0 && missing.length > 0) {
        return NextResponse.json({ error: `Missing required item(s): ${missing.join(', ')}` }, { status: 409 });
      }

      // Determine total rooms/scenes so we can decide whether this is the final door.
      let totalRooms = 0;
      try {
        const puzzle = await prisma.puzzle.findUnique({ where: { id: puzzleId } });
        const data = puzzle?.data && typeof puzzle.data === 'object' ? (puzzle.data as Record<string, unknown>) : null;
        const escapeRoomData = data && 'escapeRoomData' in data ? (data.escapeRoomData as Record<string, unknown> | null) : null;
        if (escapeRoomData && Array.isArray(escapeRoomData.scenes)) {
          totalRooms = escapeRoomData.scenes.length;
        }
      } catch {
        // ignore
      }
      if (!totalRooms) {
        try {
          totalRooms = await prisma.roomLayout.count({ where: { escapeRoomId: escapeRoom.id } });
        } catch {
          totalRooms = 0;
        }
      }

      const cur = Math.max(1, Number(progress.currentStageIndex || 1));
      const sceneStateForUseAdvance = recordStageContribution({
        sceneStateRaw: normalizeSceneState(safeJsonParse<Record<string, unknown>>(progress?.sceneState, {})),
        stageIndex: cur,
        userId: ctx.userId,
      });
      const contributionSummary = summarizeStageContributions({
        sceneStateRaw: sceneStateForUseAdvance,
        stageIndex: cur,
        teamUserIds,
        gate: parseContributionGate(meta, { requiredDistinct: 1, minActionsPerPlayer: 1 }),
      });
      const nextFromMeta = typeof meta.nextStageIndex === 'number'
        ? meta.nextStageIndex
        : (typeof meta.nextStageOrder === 'number' ? meta.nextStageOrder : null);
      const advanceBy = typeof meta.advanceBy === 'number' && Number.isFinite(meta.advanceBy) ? meta.advanceBy : 1;
      const requestedNext = nextFromMeta ?? (cur + advanceBy);

      let solvedStagesRaw: number[] = [];
      try {
        solvedStagesRaw = progress?.solvedStages ? JSON.parse(progress.solvedStages) : [];
        if (!Array.isArray(solvedStagesRaw)) solvedStagesRaw = [];
      } catch {
        solvedStagesRaw = [];
      }

      const progression = applyEscapeStageProgress({
        currentStageIndex: cur,
        solvedStages: solvedStagesRaw,
        requestedNextStageIndex: requestedNext,
        totalRooms,
        explicitComplete: Boolean(meta.complete) || meta.eventId === 'complete',
      });
      const { isComplete, nextStageIndex, solvedStages } = progression;

      // Consume the used item only on success.
      const nextInventory = inventory.filter((k) => k !== itemKey);

      // Optimistic concurrency: only advance if stage hasn't already moved.
      const useUpdateResult = await prisma.teamEscapeProgress.updateMany({
        where: { id: progress.id, currentStageIndex: cur },
        data: {
          currentStageIndex: nextStageIndex,
          solvedStages: JSON.stringify(solvedStages),
          completedAt: isComplete ? new Date() : undefined,
          inventory: JSON.stringify(nextInventory),
          sceneState: JSON.stringify(sceneStateForUseAdvance),
        },
      });

      const useAlreadyAdvanced = useUpdateResult.count === 0;
      const updated = await prisma.teamEscapeProgress.findUnique({
        where: { id: progress.id },
        select: { currentStageIndex: true, solvedStages: true, completedAt: true, inventory: true, sceneState: true },
      });
      if (!updated) {
        return NextResponse.json({ error: "Progress record not found" }, { status: 500 });
      }

      const currentInventory: string[] = safeJsonParse<string[]>(updated?.inventory, []);
      const inventoryItems = await buildInventoryItems(escapeRoom.id, currentInventory);

      await emitEscapeSession(ctx.teamId, puzzleId, {
        teamId: ctx.teamId,
        puzzleId,
        currentStageIndex: updated.currentStageIndex,
        solvedStages: updated.solvedStages,
        completedAt: updated.completedAt,
        inventory: currentInventory,
        inventoryItems,
        sceneState: normalizeSceneState(safeJsonParse<Record<string, unknown>>(updated.sceneState, {})),
        contribution: contributionSummary,
      });

      if (!useAlreadyAdvanced) {
        await emitEscapeActivity(ctx.teamId, puzzleId, {
          teamId: ctx.teamId,
          puzzleId,
          entry: {
            id: makeActivityId(),
            ts: new Date().toISOString(),
            type: 'use_item',
            title: `Used item: ${itemKey}`,
            actor: { id: user.id, name: user.name || user.email || 'Teammate' },
            meta: { itemKey, hotspotId, nextStageIndex, completed: isComplete, ...(useSfx ? { sfx: useSfx } : {}) },
          },
        });
      }

      return NextResponse.json({
        success: true,
        currentStageIndex: updated.currentStageIndex,
        solvedStages: updated.solvedStages,
        completedAt: updated.completedAt,
        inventory: currentInventory,
        inventoryItems,
        sceneState: normalizeSceneState(safeJsonParse<Record<string, unknown>>(updated.sceneState, {})),
        contribution: contributionSummary,
        consumed: { itemKey },
        ...(useSfx ? { sfx: useSfx } : {}),
      });
    }

    if (action === 'trigger') {
      // Trigger/door hotspot: advance rooms or complete the run.
      const meta = safeJsonParse<Record<string, unknown>>(hotspot.meta, {});
      const triggerUseEffect = (meta && typeof meta.useEffect === 'object' && meta.useEffect) ? (meta.useEffect as Record<string, unknown>) : null;
      const grantFlags: string[] = Array.isArray(triggerUseEffect?.grantFlags)
        ? triggerUseEffect.grantFlags.filter((x: unknown): x is string => typeof x === 'string' && x.trim().length > 0).map((x: string) => x.trim())
        : [];
      const revokeFlags: string[] = Array.isArray(triggerUseEffect?.revokeFlags)
        ? triggerUseEffect.revokeFlags.filter((x: unknown): x is string => typeof x === 'string' && x.trim().length > 0).map((x: string) => x.trim())
        : [];

      const triggerSfx = extractSfx(meta, 'trigger');

      let inventory: string[] = [];
      try {
        inventory = progress?.inventory ? JSON.parse(progress.inventory) : [];
        if (!Array.isArray(inventory)) inventory = [];
      } catch {
        inventory = [];
      }

      // Seconds to deduct from the run timer on a failed trigger (missing required items).
      const triggerPenaltySecs = typeof meta.penaltySeconds === 'number' && meta.penaltySeconds > 0
        ? Math.min(Math.floor(meta.penaltySeconds), 300)
        : 0;
      const triggerRunExpiresAt: Date | null = progress?.runExpiresAt ? new Date(progress.runExpiresAt) : null;

      // Optional gating: require items to be present in inventory
      const requiresItems: string[] = Array.isArray(meta.requiresItems) ? meta.requiresItems.filter((x: unknown): x is string => typeof x === 'string') : [];
      if (requiresItems.length > 0) {
        const missing = requiresItems.filter((k) => !inventory.includes(k));
        if (missing.length > 0) {
          const penalty = await applyTimePenalty(progress.id, triggerPenaltySecs, triggerRunExpiresAt);
          return NextResponse.json({
            error: `Missing required item(s): ${missing.join(', ')}`,
            ...(penalty.penaltyApplied > 0 ? { penaltyApplied: penalty.penaltyApplied, newRunExpiresAt: penalty.newRunExpiresAt } : {}),
          }, { status: 409 });
        }
      }

      const cur = Math.max(1, Number(progress.currentStageIndex || 1));
      const targetSceneId = typeof meta.targetSceneId === 'string' ? meta.targetSceneId.trim() : '';
      if (targetSceneId) {
        const targetLayoutId = await resolveTargetLayoutIdForScene(puzzleId, escapeRoom.id, targetSceneId);
        if (!targetLayoutId) {
          return NextResponse.json({ error: `Target scene not found: ${targetSceneId}` }, { status: 400 });
        }

        const baseSceneState = normalizeSceneState(safeJsonParse<Record<string, unknown>>(progress?.sceneState, {}));
        const nextFlags = new Set(baseSceneState.flags || []);
        for (const flag of grantFlags) nextFlags.add(flag);
        for (const flag of revokeFlags) nextFlags.delete(flag);
        const nextSceneState = recordStageContribution({
          sceneStateRaw: {
            ...baseSceneState,
            currentSceneId: targetLayoutId,
            flags: Array.from(nextFlags),
          },
          stageIndex: cur,
          userId: ctx.userId,
        });

        const updated = await prisma.teamEscapeProgress.update({
          where: { id: progress.id },
          data: {
            sceneState: JSON.stringify(nextSceneState),
          },
          select: { currentStageIndex: true, solvedStages: true, completedAt: true, sceneState: true },
        });

        await emitEscapeSession(ctx.teamId, puzzleId, {
          teamId: ctx.teamId,
          puzzleId,
          currentStageIndex: updated.currentStageIndex,
          solvedStages: updated.solvedStages,
          completedAt: updated.completedAt,
          sceneState: normalizeSceneState(safeJsonParse<Record<string, unknown>>(updated.sceneState, {})),
        });

        await emitEscapeActivity(ctx.teamId, puzzleId, {
          teamId: ctx.teamId,
          puzzleId,
          entry: {
            id: makeActivityId(),
            ts: new Date().toISOString(),
            type: 'navigate',
            title: (typeof meta.label === 'string' && meta.label.trim()) ? meta.label.trim() : 'Moved to another room view',
            actor: { id: user.id, name: user.name || user.email || 'Teammate' },
            meta: {
              hotspotId,
              targetSceneId,
              targetLayoutId,
              ...(grantFlags.length > 0 ? { grantFlags } : {}),
              ...(revokeFlags.length > 0 ? { revokeFlags } : {}),
              ...(triggerSfx ? { sfx: triggerSfx } : {}),
            },
          },
        });

        return NextResponse.json({
          success: true,
          currentStageIndex: updated.currentStageIndex,
          solvedStages: updated.solvedStages,
          completedAt: updated.completedAt,
          sceneState: normalizeSceneState(safeJsonParse<Record<string, unknown>>(updated.sceneState, {})),
          ...(triggerSfx ? { sfx: triggerSfx } : {}),
        });
      }

      // Determine total rooms/scenes so we can decide whether this is the final door.
      let totalRooms = 0;
      try {
        const puzzle = await prisma.puzzle.findUnique({ where: { id: puzzleId } });
        const data = puzzle?.data && typeof puzzle.data === 'object' ? (puzzle.data as Record<string, unknown>) : null;
        const escapeRoomData = data && 'escapeRoomData' in data ? (data.escapeRoomData as Record<string, unknown> | null) : null;
        if (escapeRoomData && Array.isArray(escapeRoomData.scenes)) {
          totalRooms = escapeRoomData.scenes.length;
        }
      } catch {
        // ignore
      }
      if (!totalRooms) {
        try {
          totalRooms = await prisma.roomLayout.count({ where: { escapeRoomId: escapeRoom.id } });
        } catch {
          totalRooms = 0;
        }
      }

      const baseSceneStateForTrigger = normalizeSceneState(safeJsonParse<Record<string, unknown>>(progress?.sceneState, {}));
      const nextTriggerFlags = new Set(baseSceneStateForTrigger.flags || []);
      for (const flag of grantFlags) nextTriggerFlags.add(flag);
      for (const flag of revokeFlags) nextTriggerFlags.delete(flag);

      const sceneStateForTriggerAdvance = recordStageContribution({
        sceneStateRaw: {
          ...baseSceneStateForTrigger,
          flags: Array.from(nextTriggerFlags),
        },
        stageIndex: cur,
        userId: ctx.userId,
      });
      const contributionSummary = summarizeStageContributions({
        sceneStateRaw: sceneStateForTriggerAdvance,
        stageIndex: cur,
        teamUserIds,
        gate: parseContributionGate(meta, { requiredDistinct: 1, minActionsPerPlayer: 1 }),
      });
      const nextFromMeta = typeof meta.nextStageIndex === 'number'
        ? meta.nextStageIndex
        : (typeof meta.nextStageOrder === 'number' ? meta.nextStageOrder : null);
      const advanceBy = typeof meta.advanceBy === 'number' && Number.isFinite(meta.advanceBy) ? meta.advanceBy : 1;
      const requestedNext = nextFromMeta ?? (cur + advanceBy);

      let solvedStagesRaw: number[] = [];
      try {
        solvedStagesRaw = progress?.solvedStages ? JSON.parse(progress.solvedStages) : [];
        if (!Array.isArray(solvedStagesRaw)) solvedStagesRaw = [];
      } catch {
        solvedStagesRaw = [];
      }

      const progression = applyEscapeStageProgress({
        currentStageIndex: cur,
        solvedStages: solvedStagesRaw,
        requestedNextStageIndex: requestedNext,
        totalRooms,
        explicitComplete: Boolean(meta.complete) || meta.eventId === 'complete',
      });
      const { isComplete, nextStageIndex, solvedStages } = progression;

      // Optimistic concurrency: only advance if stage hasn't already moved.
      // Two players clicking the same door at once would both read cur=N, but only
      // the first writer matches WHERE currentStageIndex=N; the second gets count=0
      // and fetches the already-advanced state rather than double-advancing.
      const triggerUpdateResult = await prisma.teamEscapeProgress.updateMany({
        where: { id: progress.id, currentStageIndex: cur },
        data: {
          currentStageIndex: nextStageIndex,
          solvedStages: JSON.stringify(solvedStages),
          completedAt: isComplete ? new Date() : undefined,
          sceneState: JSON.stringify(sceneStateForTriggerAdvance),
        },
      });

      const alreadyAdvanced = triggerUpdateResult.count === 0;
      const updated = await prisma.teamEscapeProgress.findUnique({
        where: { id: progress.id },
        select: { currentStageIndex: true, solvedStages: true, completedAt: true, sceneState: true },
      });
      if (!updated) {
        return NextResponse.json({ error: "Progress record not found" }, { status: 500 });
      }

      await emitEscapeSession(ctx.teamId, puzzleId, {
        teamId: ctx.teamId,
        puzzleId,
        currentStageIndex: updated.currentStageIndex,
        solvedStages: updated.solvedStages,
        completedAt: updated.completedAt,
        sceneState: normalizeSceneState(safeJsonParse<Record<string, unknown>>(updated.sceneState, {})),
        contribution: contributionSummary,
      });

      if (!alreadyAdvanced) {
        const triggerLabel =
          (typeof meta.label === 'string' && meta.label.trim())
            ? meta.label.trim()
            : (isComplete ? 'Escape Complete' : 'Door Opened');

        await emitEscapeActivity(ctx.teamId, puzzleId, {
          teamId: ctx.teamId,
          puzzleId,
          entry: {
            id: makeActivityId(),
            ts: new Date().toISOString(),
            type: isComplete ? 'complete' : 'trigger',
            title: isComplete
              ? 'Completed the escape room'
              : `Advanced to stage ${nextStageIndex}`,
            actor: { id: user.id, name: user.name || user.email || 'Teammate' },
            meta: {
              label: triggerLabel,
              nextStageIndex,
              completed: isComplete,
              hotspotId,
              ...(grantFlags.length > 0 ? { grantFlags } : {}),
              ...(revokeFlags.length > 0 ? { revokeFlags } : {}),
              ...(triggerSfx ? { sfx: triggerSfx } : {}),
            },
          },
        });
      }

      return NextResponse.json({
        success: true,
        currentStageIndex: updated.currentStageIndex,
        solvedStages: updated.solvedStages,
        completedAt: updated.completedAt,
        sceneState: normalizeSceneState(safeJsonParse<Record<string, unknown>>(updated.sceneState, {})),
        contribution: contributionSummary,
        ...(triggerSfx ? { sfx: triggerSfx } : {}),
      });
    }

    if (action === 'miniPuzzlePenalty') {
      const meta = safeJsonParse<Record<string, unknown>>(hotspot.meta, {});
      const miniPuzzle = meta?.miniPuzzle as Record<string, unknown> | undefined;
      const miniPuzzleConfig = miniPuzzle?.config as Record<string, unknown> | undefined;
      const timePenaltySeconds = miniPuzzleConfig?.timePenaltySeconds;
      const penaltySecs =
        typeof timePenaltySeconds === 'number' && timePenaltySeconds > 0
          ? Math.min(Math.floor(timePenaltySeconds), 300)
          : 0;
      const runExpiry: Date | null = progress?.runExpiresAt ? new Date(progress.runExpiresAt) : null;
      const penalty = await applyTimePenalty(progress.id, penaltySecs, runExpiry);

      // Broadcast updated expiry so all teammates' timers sync immediately
      if (penalty.penaltyApplied > 0 && penalty.newRunExpiresAt) {
        await emitEscapeSession(ctx.teamId, puzzleId, {
          teamId: ctx.teamId,
          puzzleId,
          runExpiresAt: penalty.newRunExpiresAt,
        });
      }

      return NextResponse.json({
        success: true,
        penaltyApplied: penalty.penaltyApplied,
        newRunExpiresAt: penalty.newRunExpiresAt,
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e) {
    console.error('Escape-room action failed:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
