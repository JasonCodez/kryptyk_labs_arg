import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdminUser } from '@/lib/requireAdmin';
import { Prisma } from '@prisma/client';

const safeJsonParse = <T,>(raw: unknown, fallback: T): T => {
  if (typeof raw !== 'string' || !raw.trim()) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const makeItemKey = (escapeRoomId: string, designerItemId: string) => {
  const raw = String(designerItemId || '').trim();
  if (!raw) return `item_${escapeRoomId}_item`;
  // If the id is already namespaced, keep it stable.
  if (raw.startsWith(`item_${escapeRoomId}_`)) return raw;
  return `item_${escapeRoomId}_${raw}`;
};

// GET: Fetch full escape room config for editing
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> } | { params: { id: string } }
) {
  try {
    const admin = await requireAdminUser();
    if (!admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const resolved = params instanceof Promise ? await params : params;
    const id = resolved.id;
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const escapeRoom = await prisma.escapeRoomPuzzle.findUnique({
      where: { id },
      include: {
        layouts: {
          include: {
            hotspots: true,
            triggers: true,
          },
        },
        itemDefinitions: true,
        puzzle: true,
      },
    });
    if (!escapeRoom) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Preferred source of truth for designer editing is Puzzle.data.escapeRoomData,
    // because it stores item positions (x/y/w/h) that aren't persisted in the DB tables.
    const puzzleData = escapeRoom.puzzle?.data && typeof escapeRoom.puzzle.data === 'object'
      ? (escapeRoom.puzzle.data as Record<string, unknown>)
      : null;
    const escapeRoomData = puzzleData && 'escapeRoomData' in puzzleData
      ? (puzzleData.escapeRoomData as Record<string, unknown>)
      : null;

    let scenes: Record<string, unknown>[] = [];
    if (escapeRoomData && Array.isArray(escapeRoomData.scenes)) {
      scenes = escapeRoomData.scenes as Record<string, unknown>[];
    } else {
      // Fallback: map DB structure to a minimal designer format (zones only).
      scenes = (escapeRoom.layouts || []).map((layout) => ({
        id: layout.id,
        name: layout.title || '',
        backgroundUrl: layout.backgroundUrl || '',
        description: '',
        items: [],
        interactiveZones: (layout.hotspots || []).map((zone) => {
          const meta = safeJsonParse<Record<string, unknown>>(zone.meta, {});
          return {
            id: zone.id,
            label: typeof meta.label === 'string' ? meta.label : '',
            x: zone.x,
            y: zone.y,
            width: zone.w,
            height: zone.h,
            actionType: zone.type,
            itemId: typeof meta.itemId === 'string' ? meta.itemId : undefined,
            imageUrl: typeof meta.imageUrl === 'string' ? meta.imageUrl : undefined,
            modalContent: typeof meta.modalContent === 'string' ? meta.modalContent : '',
            interactions: Array.isArray(meta.interactions)
              ? (meta.interactions as Record<string, unknown>[])
                  .map((x) => ({ label: x?.label, modalContent: x?.modalContent }))
                  .filter((x): x is { label: string; modalContent: string } => typeof x.label === 'string' && typeof x.modalContent === 'string')
              : [],
            linkedPuzzleId: typeof meta.linkedPuzzleId === 'string' ? meta.linkedPuzzleId : undefined,
            eventId: typeof meta.eventId === 'string' ? meta.eventId : undefined,
            targetSceneId: typeof meta.targetSceneId === 'string' ? meta.targetSceneId : undefined,
            collectItemId: zone.targetId,
            pickupAnimationPreset: typeof meta.pickupAnimationPreset === 'string' ? meta.pickupAnimationPreset : 'cinematic',
            pickupAnimationUrl: typeof meta.pickupAnimationUrl === 'string' ? meta.pickupAnimationUrl : undefined,
            sfx: (meta.sfx && typeof meta.sfx === 'object') ? meta.sfx : undefined,
            penaltySeconds: typeof meta.penaltySeconds === 'number' ? meta.penaltySeconds : undefined,
            miniPuzzle: (meta.miniPuzzle && typeof meta.miniPuzzle === 'object') ? meta.miniPuzzle : undefined,
            codeEntry: (meta.codeEntry && typeof meta.codeEntry === 'object') ? meta.codeEntry : undefined,
            requiredItemId: typeof meta.requiredItemId === 'string' ? meta.requiredItemId : undefined,
            consumeItemOnUse: typeof meta.consumeItemOnUse === 'boolean' ? meta.consumeItemOnUse : undefined,
            disabledByDefault: meta.disabledByDefault === true,
            useEffect: (meta.useEffect && typeof meta.useEffect === 'object') ? meta.useEffect : undefined,
          };
        }),
      }));
    }

    return NextResponse.json({
      title: escapeRoomData?.title || escapeRoom.roomTitle,
      description: escapeRoomData?.description || escapeRoom.roomDescription,
      minTeamSize: escapeRoomData?.minTeamSize || escapeRoom.minTeamSize || 1,
      maxPlayers: escapeRoom.maxTeamSize || 8,
      timeLimit: escapeRoomData?.timeLimit ?? escapeRoom.timeLimitSeconds,
      startMode: escapeRoomData?.startMode || 'leader-start',
      playerMode: escapeRoomData?.playerMode || 'shared',
      intro: escapeRoomData?.intro || undefined,
      outro: escapeRoomData?.outro || undefined,
      scenes,
      userSpecialties: [], // Not implemented yet
      isPublished: escapeRoom.puzzle?.isActive ?? false,
    });
  } catch (error) {
    console.error('[ESCAPE ROOM DESIGNER GET] Failed to load escape room designer payload', error);
    return NextResponse.json({ error: 'Failed to load escape room' }, { status: 500 });
  }
}

// PUT: Update escape room config
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> } | { params: { id: string } }
) {
  try {
    const admin = await requireAdminUser();
    if (!admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const resolved = params instanceof Promise ? await params : params;
    const escapeRoomId = resolved.id;

    const data = await req.json();
    const { title, description, timeLimit, startMode, minTeamSize, playerMode, scenes, intro, outro } = data;
    if (!escapeRoomId) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    if (!Array.isArray(scenes)) return NextResponse.json({ error: 'Missing scenes' }, { status: 400 });

    const existing = await prisma.escapeRoomPuzzle.findUnique({
      where: { id: escapeRoomId },
      select: { puzzleId: true },
    });
    if (!existing?.puzzleId) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const puzzleId = existing.puzzleId;

    // Update main room
    const updateData: Record<string, unknown> = {
      roomTitle: title,
      roomDescription: description,
      minTeamSize: (typeof minTeamSize === 'number' && minTeamSize > 0) ? minTeamSize : 1,
      maxTeamSize: Math.max((typeof minTeamSize === 'number' && minTeamSize > 0) ? minTeamSize : 1, 8),
    };
    if (typeof timeLimit !== 'undefined' && timeLimit !== null) updateData.timeLimitSeconds = Number(timeLimit);

    await prisma.$transaction(async (tx) => {
      await tx.escapeRoomPuzzle.update({ where: { id: escapeRoomId }, data: updateData as Prisma.EscapeRoomPuzzleUpdateInput });

      // For simplicity: delete all layouts/items/hotspots/triggers and recreate (can optimize later)
      await tx.roomLayout.deleteMany({ where: { escapeRoomId: escapeRoomId } });
      await tx.itemDefinition.deleteMany({ where: { escapeRoomId: escapeRoomId } });

      // Recreate scenes, items, zones, triggers
      for (const scene of scenes) {
        const layout = await tx.roomLayout.create({
          data: {
            escapeRoomId: escapeRoomId,
            title: scene?.name || null,
            backgroundUrl: scene?.backgroundUrl || null,
            width: scene?.width ? Number(scene.width) : null,
            height: scene?.height ? Number(scene.height) : null,
          },
        });

        const itemIdToDefId = new Map<string, string>();
        const sceneItems: Record<string, unknown>[] = Array.isArray(scene?.items) ? scene.items : [];
        for (const item of sceneItems) {
          const designerItemId = typeof item?.id === 'string' ? item.id : '';
          const created = await tx.itemDefinition.create({
            data: {
              escapeRoomId: escapeRoomId,
              key: makeItemKey(escapeRoomId, designerItemId),
              name: (typeof item?.name === 'string' && item.name.trim()) ? item.name.trim() : 'Item',
              description: typeof item?.description === 'string' ? item.description : null,
              imageUrl: typeof item?.imageUrl === 'string' ? item.imageUrl : null,
              consumable: true,
            },
          });
          if (designerItemId) itemIdToDefId.set(designerItemId, created.id);
        }

        const zones: Record<string, unknown>[] = Array.isArray(scene?.interactiveZones) ? scene.interactiveZones : [];
        for (const zone of zones) {
          const actionType = zone?.actionType || zone?.type || 'modal';
          const rawCollectItemId = (typeof zone?.collectItemId === 'string' && zone.collectItemId) ? zone.collectItemId : null;
          let targetId: string | null = null;
          if (actionType === 'collect' && rawCollectItemId) {
            targetId = itemIdToDefId.get(rawCollectItemId) || rawCollectItemId;
          }
          await tx.hotspot.create({
            data: {
              layoutId: layout.id,
              x: Number(zone?.x) || 0,
              y: Number(zone?.y) || 0,
              w: Number(zone?.width) || 32,
              h: Number(zone?.height) || 32,
              type: String(actionType),
              targetId,
              meta: JSON.stringify({
                // Stable designer id so effects can refer to zones without knowing DB hotspot ids.
                zoneId: typeof zone?.id === 'string' ? zone.id : undefined,
                label: zone?.label,
                modalContent: zone?.modalContent,
                itemId: zone?.itemId,
                imageUrl: zone?.imageUrl,
                description: zone?.description,
                interactions: zone?.interactions,
                linkedPuzzleId: zone?.linkedPuzzleId,
                eventId: zone?.eventId,
                targetSceneId: zone?.targetSceneId,
                pickupAnimationPreset: zone?.pickupAnimationPreset,
                pickupAnimationUrl: zone?.pickupAnimationUrl,
                sfx: zone?.sfx || undefined,
                penaltySeconds: zone?.penaltySeconds || undefined,
                miniPuzzle: zone?.miniPuzzle || undefined,
                codeEntry: zone?.codeEntry || undefined,
                requiredItemId: zone?.requiredItemId,
                consumeItemOnUse: zone?.consumeItemOnUse,
                disabledByDefault: zone?.disabledByDefault,
                useEffect: zone?.useEffect,
                actionType,
              }),
            },
          });
        }

        for (const zone of zones.filter((z) => (z?.actionType || z?.type) === 'trigger')) {
          await tx.roomTrigger.create({
            data: {
              layoutId: layout.id,
              event: zone?.eventId ? String(zone.eventId) : '',
              action: 'trigger',
            },
          });
        }
      }

      // Also persist the full designer payload into Puzzle.data.escapeRoomData so the player view
      // has access to item positions + modal metadata.
      const puzzle = await tx.puzzle.findUnique({ where: { id: puzzleId }, select: { data: true } });
      const curData: Record<string, unknown> = puzzle?.data && typeof puzzle.data === 'object' ? (puzzle.data as Record<string, unknown>) : {};
      const curEscapeRoomData = curData?.escapeRoomData as Record<string, unknown> | undefined;
      const nextData = {
        ...curData,
        escapeRoomData: {
          title,
          description,
          timeLimit,
          startMode: startMode || curEscapeRoomData?.startMode || 'leader-start',
          minTeamSize: (typeof minTeamSize === 'number' && minTeamSize > 0) ? minTeamSize : (curEscapeRoomData?.minTeamSize || 1),
          playerMode: playerMode || curEscapeRoomData?.playerMode || 'shared',
          intro: intro || undefined,
          outro: outro || undefined,
          scenes,
        },
      };
      await tx.puzzle.update({ where: { id: puzzleId }, data: { data: nextData, minTeamSize: (typeof minTeamSize === 'number' && minTeamSize > 0) ? minTeamSize : 1 } });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[ESCAPE ROOM DESIGNER UPDATE] Failed to update escape room designer payload', error);
    return NextResponse.json({ error: 'Failed to update escape room' }, { status: 500 });
  }
}

// PATCH: Publish or unpublish the escape room (toggle puzzle.isActive)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> } | { params: { id: string } }
) {
  try {
    const admin = await requireAdminUser();
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const resolved = params instanceof Promise ? await params : params;
    const escapeRoomId = resolved.id;
    if (!escapeRoomId) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const { publish } = await req.json() as { publish: boolean };
    if (typeof publish !== 'boolean') return NextResponse.json({ error: 'publish must be a boolean' }, { status: 400 });

    const er = await prisma.escapeRoomPuzzle.findUnique({ where: { id: escapeRoomId }, select: { puzzleId: true } });
    if (!er?.puzzleId) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await prisma.puzzle.update({ where: { id: er.puzzleId }, data: { isActive: publish } });

    return NextResponse.json({ success: true, isPublished: publish });
  } catch (error) {
    console.error('[ESCAPE ROOM DESIGNER PUBLISH] Failed to toggle publish state', error);
    return NextResponse.json({ error: 'Failed to update publish state' }, { status: 500 });
  }
}
