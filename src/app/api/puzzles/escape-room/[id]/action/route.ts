import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createNotification } from "@/lib/notification-service";
import { requireEscapeRoomTeamContext } from "@/lib/escapeRoomTeamAuth";

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
  hiddenItemIds?: string[];
  shownItemIds?: string[];
  disabledHotspotIds?: string[];
  enabledHotspotIds?: string[];
};

function normalizeSceneState(raw: unknown): Required<SceneState> {
  const base = (raw && typeof raw === 'object') ? (raw as SceneState) : {};
  return {
    hiddenItemIds: Array.isArray(base.hiddenItemIds) ? base.hiddenItemIds.filter((x) => typeof x === 'string') : [],
    shownItemIds: Array.isArray(base.shownItemIds) ? base.shownItemIds.filter((x) => typeof x === 'string') : [],
    disabledHotspotIds: Array.isArray(base.disabledHotspotIds) ? base.disabledHotspotIds.filter((x) => typeof x === 'string') : [],
    enabledHotspotIds: Array.isArray(base.enabledHotspotIds) ? base.enabledHotspotIds.filter((x) => typeof x === 'string') : [],
  };
}

async function emitEscapeSession(teamId: string, puzzleId: string, payload: any) {
  try {
    const { postToSocket } = await import("@/lib/socket-client");
    const room = `escape:${teamId}::${puzzleId}`;
    await postToSocket("/emit", { room, event: "escapeSessionUpdated", payload });
  } catch {
    // non-fatal
  }
}

async function emitEscapeActivity(teamId: string, puzzleId: string, payload: any) {
  try {
    const { postToSocket } = await import("@/lib/socket-client");
    const room = `escape:${teamId}::${puzzleId}`;
    await postToSocket("/emit", { room, event: "escapeActivity", payload });
  } catch {
    // non-fatal
  }
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
    const anyRaw: any = raw;
    const url = typeof anyRaw.url === 'string' ? anyRaw.url.trim() : '';
    if (!url) return null;
    const v = Number(anyRaw.volume);
    const volume = Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : undefined;
    return { url, ...(volume !== undefined ? { volume } : {}) };
  }
  return null;
}

function extractSfx(meta: Record<string, any>, kind: 'pickup' | 'use' | 'trigger' | 'loot'): SfxPayload | null {
  try {
    const sfx = meta && typeof meta.sfx === 'object' ? (meta.sfx as any) : null;
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
    const { action, hotspotId, teamId, itemKey } = body as { action?: string; hotspotId?: string; teamId?: string; itemKey?: string };
    if (!action || !hotspotId) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

    const ctx = await requireEscapeRoomTeamContext(request, puzzleId, { teamId });
    if (ctx instanceof NextResponse) return ctx;

    const user = await prisma.user.findUnique({ where: { id: ctx.userId }, select: { id: true, name: true, email: true } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

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
    const progress = await (prisma as any).teamEscapeProgress.findUnique({
      where: { teamId_escapeRoomId: { teamId: ctx.teamId, escapeRoomId: escapeRoom.id } },
      select: {
        inventory: true,
        sceneState: true,
        currentStageIndex: true,
        solvedStages: true,
        runStartedAt: true,
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

    if (action === 'pickup') {
      // If hotspot.targetId points to an ItemDefinition id, add item key to player state
      if (!hotspot.targetId) return NextResponse.json({ error: 'No item to pick up' }, { status: 400 });

      const pickupMeta = safeJsonParse<Record<string, any>>(hotspot.meta, {});
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

      await (prisma as any).teamEscapeProgress.update({
        where: { teamId_escapeRoomId: { teamId: ctx.teamId, escapeRoomId: escapeRoom.id } },
        data: { inventory: JSON.stringify(inventory) },
      });

      // Provide item metadata for inventory rendering.
      const inventoryItems = await buildInventoryItems(escapeRoom.id, inventory);

      // Let the team UI update inventory quickly (non-blocking)
      await emitEscapeSession(ctx.teamId, puzzleId, {
        teamId: ctx.teamId,
        puzzleId,
        inventory,
        inventoryItems,
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
          const members = await prisma.teamMember.findMany({ where: { teamId: ctx.teamId } });
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
          } catch (socketErr) {
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

      const meta = safeJsonParse<Record<string, any>>(hotspot.meta, {});
      const useSfx = extractSfx(meta, 'use');
      const lootSfx = extractSfx(meta, 'loot');
      const requiredItemId = typeof meta.requiredItemId === 'string' ? meta.requiredItemId : null;
      const derivedRequiredItemKey = requiredItemId ? makeDesignerItemKey(String(escapeRoom.id), requiredItemId) : null;

      const requiresItemIds: string[] = Array.isArray(meta.requiresItemIds)
        ? meta.requiresItemIds.filter((x: any) => typeof x === 'string')
        : [];
      const derivedRequiresItems: string[] = requiresItemIds.map((id) => makeDesignerItemKey(String(escapeRoom.id), id));

      const requiresItems: string[] = Array.from(
        new Set([
          ...(Array.isArray(meta.requiresItems) ? meta.requiresItems.filter((x: any) => typeof x === 'string') : []),
          ...derivedRequiresItems,
        ])
      );
      const requiredItemKey = typeof meta.requiredItemKey === 'string' ? meta.requiredItemKey : derivedRequiredItemKey;

      const useEffect = (meta && typeof meta.useEffect === 'object' && meta.useEffect) ? (meta.useEffect as any) : null;

      // If hotspot specifies required items, enforce that the dragged item is one of them.
      if (requiredItemKey && requiredItemKey !== itemKey) {
        return NextResponse.json({ error: `That item doesn't work here.` }, { status: 409 });
      }
      if (requiresItems.length > 0 && !requiresItems.includes(itemKey)) {
        return NextResponse.json({ error: `That item doesn't work here.` }, { status: 409 });
      }

      // If multiple items are required, ensure all are present.
      const missingRequiredForUse = requiresItems.filter((k) => !inventory.includes(k));
      if (requiresItems.length > 0 && missingRequiredForUse.length > 0) {
        return NextResponse.json({ error: `Missing required item(s): ${missingRequiredForUse.join(', ')}` }, { status: 409 });
      }

      // If a useEffect is configured, apply it even for non-trigger hotspots.
      // This enables "open container" interactions without advancing stages.
      if (useEffect) {
        const strict = useEffect?.strict === true;

        const baseSceneState = normalizeSceneState(safeJsonParse<Record<string, any>>((progress as any)?.sceneState, {}));
        const hiddenItemIds = new Set(baseSceneState.hiddenItemIds);
        const shownItemIds = new Set(baseSceneState.shownItemIds);
        const disabledHotspotIds = new Set(baseSceneState.disabledHotspotIds);
        const enabledHotspotIds = new Set(baseSceneState.enabledHotspotIds);

        const hideItemIds: string[] = Array.isArray(useEffect.hideItemIds) ? useEffect.hideItemIds.filter((x: any) => typeof x === 'string') : [];
        const showItemIds: string[] = Array.isArray(useEffect.showItemIds) ? useEffect.showItemIds.filter((x: any) => typeof x === 'string') : [];
        const disableHotspotIds: string[] = Array.isArray(useEffect.disableHotspotIds) ? useEffect.disableHotspotIds.filter((x: any) => typeof x === 'string') : [];
        const enableHotspotIds: string[] = Array.isArray(useEffect.enableHotspotIds) ? useEffect.enableHotspotIds.filter((x: any) => typeof x === 'string') : [];
        const grantItemKeys: string[] = Array.isArray(useEffect.grantItemKeys) ? useEffect.grantItemKeys.filter((x: any) => typeof x === 'string') : [];

        const consumeItemKeys: string[] = Array.isArray(useEffect.consumeItemKeys)
          ? useEffect.consumeItemKeys.filter((x: any) => typeof x === 'string')
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
            const foundIdSet = new Set(all.map((h: any) => String(h.id)));
            const foundZoneIdSet = new Set(
              all
                .map((h: any) => safeJsonParse<Record<string, any>>(h.meta, {}))
                .map((m: any) => (typeof m?.zoneId === 'string' ? m.zoneId : ''))
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
            const foundKeys = new Set(defs.map((d: any) => String(d.key)));
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
        let granted: Array<{ key: string; name: string }> = [];
        if (grantItemKeys.length > 0) {
          const uniqueGrantKeys = Array.from(new Set(grantItemKeys)).filter(Boolean);
          if (uniqueGrantKeys.length > 0) {
            const defs = await prisma.itemDefinition.findMany({
              where: { escapeRoomId: escapeRoom.id, key: { in: uniqueGrantKeys } },
              select: { key: true, name: true },
            });

            if (strict) {
              const found = new Set(defs.map((d: any) => String(d.key)));
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
        const nextSceneState: Required<SceneState> = {
          hiddenItemIds: Array.from(hiddenItemIds),
          shownItemIds: Array.from(shownItemIds),
          disabledHotspotIds: Array.from(disabledHotspotIds),
          enabledHotspotIds: Array.from(enabledHotspotIds),
        };

        const updated = await (prisma as any).teamEscapeProgress.update({
          where: { teamId_escapeRoomId: { teamId: ctx.teamId, escapeRoomId: escapeRoom.id } },
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

        const useLabel = (typeof meta.label === 'string' && meta.label.trim()) ? meta.label.trim() : `Used item: ${itemKey}`;
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
        const pAny: any = puzzle;
        const escapeRoomData = pAny?.data && typeof pAny.data === 'object' && 'escapeRoomData' in pAny.data ? pAny.data.escapeRoomData : null;
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
      const nextFromMeta = typeof meta.nextStageIndex === 'number'
        ? meta.nextStageIndex
        : (typeof meta.nextStageOrder === 'number' ? meta.nextStageOrder : null);
      const advanceBy = typeof meta.advanceBy === 'number' && Number.isFinite(meta.advanceBy) ? meta.advanceBy : 1;
      const requestedNext = nextFromMeta ?? (cur + advanceBy);

      const isComplete = Boolean(meta.complete) || meta.eventId === 'complete' || (totalRooms > 0 && requestedNext > totalRooms);
      const nextStageIndex = isComplete ? (totalRooms || cur) : Math.max(1, Math.floor(requestedNext));

      let solvedStages: number[] = [];
      try {
        solvedStages = progress?.solvedStages ? JSON.parse(progress.solvedStages) : [];
        if (!Array.isArray(solvedStages)) solvedStages = [];
      } catch {
        solvedStages = [];
      }
      if (!solvedStages.includes(nextStageIndex)) solvedStages.push(nextStageIndex);
      solvedStages.sort((a, b) => a - b);

      // Consume the used item only on success.
      const nextInventory = inventory.filter((k) => k !== itemKey);

      const updated = await (prisma as any).teamEscapeProgress.update({
        where: { teamId_escapeRoomId: { teamId: ctx.teamId, escapeRoomId: escapeRoom.id } },
        data: {
          currentStageIndex: nextStageIndex,
          solvedStages: JSON.stringify(solvedStages),
          completedAt: isComplete ? new Date() : undefined,
          inventory: JSON.stringify(nextInventory),
        },
        select: { currentStageIndex: true, solvedStages: true, completedAt: true, inventory: true },
      });

      const inventoryItems = await buildInventoryItems(escapeRoom.id, nextInventory);

      await emitEscapeSession(ctx.teamId, puzzleId, {
        teamId: ctx.teamId,
        puzzleId,
        currentStageIndex: updated.currentStageIndex,
        solvedStages: updated.solvedStages,
        completedAt: updated.completedAt,
        inventory: nextInventory,
        inventoryItems,
        sceneState: normalizeSceneState(safeJsonParse<Record<string, any>>((progress as any)?.sceneState, {})),
      });

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

      return NextResponse.json({
        success: true,
        currentStageIndex: updated.currentStageIndex,
        solvedStages: updated.solvedStages,
        completedAt: updated.completedAt,
        inventory: nextInventory,
        inventoryItems,
        consumed: { itemKey },
        ...(useSfx ? { sfx: useSfx } : {}),
      });
    }

    if (action === 'trigger') {
      // Trigger/door hotspot: advance rooms or complete the run.
      const meta = safeJsonParse<Record<string, any>>(hotspot.meta, {});
      const triggerSfx = extractSfx(meta, 'trigger');

      let inventory: string[] = [];
      try {
        inventory = progress?.inventory ? JSON.parse(progress.inventory) : [];
        if (!Array.isArray(inventory)) inventory = [];
      } catch {
        inventory = [];
      }

      // Optional gating: require items to be present in inventory
      const requiresItems: string[] = Array.isArray(meta.requiresItems) ? meta.requiresItems.filter((x: any) => typeof x === 'string') : [];
      if (requiresItems.length > 0) {
        const missing = requiresItems.filter((k) => !inventory.includes(k));
        if (missing.length > 0) {
          return NextResponse.json({ error: `Missing required item(s): ${missing.join(', ')}` }, { status: 409 });
        }
      }

      // Determine total rooms/scenes so we can decide whether this is the final door.
      let totalRooms = 0;
      try {
        const puzzle = await prisma.puzzle.findUnique({ where: { id: puzzleId } });
        const pAny: any = puzzle;
        const escapeRoomData = pAny?.data && typeof pAny.data === 'object' && 'escapeRoomData' in pAny.data ? pAny.data.escapeRoomData : null;
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
      const nextFromMeta = typeof meta.nextStageIndex === 'number'
        ? meta.nextStageIndex
        : (typeof meta.nextStageOrder === 'number' ? meta.nextStageOrder : null);
      const advanceBy = typeof meta.advanceBy === 'number' && Number.isFinite(meta.advanceBy) ? meta.advanceBy : 1;
      const requestedNext = nextFromMeta ?? (cur + advanceBy);

      const isComplete = Boolean(meta.complete) || meta.eventId === 'complete' || (totalRooms > 0 && requestedNext > totalRooms);
      const nextStageIndex = isComplete ? (totalRooms || cur) : Math.max(1, Math.floor(requestedNext));

      let solvedStages: number[] = [];
      try {
        solvedStages = progress?.solvedStages ? JSON.parse(progress.solvedStages) : [];
        if (!Array.isArray(solvedStages)) solvedStages = [];
      } catch {
        solvedStages = [];
      }
      if (!solvedStages.includes(nextStageIndex)) solvedStages.push(nextStageIndex);
      solvedStages.sort((a, b) => a - b);

      const updated = await (prisma as any).teamEscapeProgress.update({
        where: { teamId_escapeRoomId: { teamId: ctx.teamId, escapeRoomId: escapeRoom.id } },
        data: {
          currentStageIndex: nextStageIndex,
          solvedStages: JSON.stringify(solvedStages),
          completedAt: isComplete ? new Date() : undefined,
        },
        select: { currentStageIndex: true, solvedStages: true, completedAt: true },
      });

      await emitEscapeSession(ctx.teamId, puzzleId, {
        teamId: ctx.teamId,
        puzzleId,
        currentStageIndex: updated.currentStageIndex,
        solvedStages: updated.solvedStages,
        completedAt: updated.completedAt,
      });

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
            ...(triggerSfx ? { sfx: triggerSfx } : {}),
          },
        },
      });

      return NextResponse.json({
        success: true,
        currentStageIndex: updated.currentStageIndex,
        solvedStages: updated.solvedStages,
        completedAt: updated.completedAt,
        ...(triggerSfx ? { sfx: triggerSfx } : {}),
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e) {
    console.error('Escape-room action failed:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
