import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

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
    const pAny: any = escapeRoom.puzzle as any;
    const escapeRoomData = pAny?.data && typeof pAny.data === 'object' && 'escapeRoomData' in pAny.data
      ? (pAny.data as any).escapeRoomData
      : null;

    let scenes: any[] = [];
    if (escapeRoomData && Array.isArray(escapeRoomData.scenes)) {
      scenes = escapeRoomData.scenes;
    } else {
      // Fallback: map DB structure to a minimal designer format (zones only).
      scenes = (escapeRoom.layouts || []).map((layout) => ({
        id: layout.id,
        name: layout.title || '',
        backgroundUrl: layout.backgroundUrl || '',
        description: '',
        items: [],
        interactiveZones: (layout.hotspots || []).map((zone) => {
          const meta = safeJsonParse<Record<string, any>>(zone.meta, {});
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
              ? meta.interactions
                  .map((x: any) => ({ label: x?.label, modalContent: x?.modalContent }))
                  .filter((x: any) => typeof x.label === 'string' && typeof x.modalContent === 'string')
              : [],
            linkedPuzzleId: typeof meta.linkedPuzzleId === 'string' ? meta.linkedPuzzleId : undefined,
            eventId: typeof meta.eventId === 'string' ? meta.eventId : undefined,
            collectItemId: zone.targetId,
            pickupAnimationPreset: typeof meta.pickupAnimationPreset === 'string' ? meta.pickupAnimationPreset : 'cinematic',
            penaltySeconds: typeof meta.penaltySeconds === 'number' ? meta.penaltySeconds : undefined,
            miniPuzzle: (meta.miniPuzzle && typeof meta.miniPuzzle === 'object') ? meta.miniPuzzle : undefined,
          };
        }),
      }));
    }

    const er: any = escapeRoom;
    return NextResponse.json({
      title: escapeRoomData?.title || er.roomTitle,
      description: escapeRoomData?.description || er.roomDescription,
      minTeamSize: escapeRoomData?.minTeamSize || er.minTeamSize || 1,
      maxPlayers: er.maxTeamSize || 8,
      timeLimit: escapeRoomData?.timeLimit ?? er.timeLimitSeconds,
      startMode: escapeRoomData?.startMode || 'leader-start',
      playerMode: escapeRoomData?.playerMode || 'shared',
      intro: escapeRoomData?.intro || undefined,
      outro: escapeRoomData?.outro || undefined,
      scenes,
      userSpecialties: [], // Not implemented yet
    });
  } catch (error) {
    return NextResponse.json({ error: (error as any)?.message || String(error), stack: (error as any)?.stack }, { status: 500 });
  }
}

// PUT: Update escape room config
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> } | { params: { id: string } }
) {
  try {
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
    const updateData: any = {
      roomTitle: title,
      roomDescription: description,
      minTeamSize: (typeof minTeamSize === 'number' && minTeamSize > 0) ? minTeamSize : 1,
      maxTeamSize: Math.max((typeof minTeamSize === 'number' && minTeamSize > 0) ? minTeamSize : 1, 8),
    };
    if (typeof timeLimit !== 'undefined' && timeLimit !== null) updateData.timeLimitSeconds = Number(timeLimit);

    await prisma.$transaction(async (tx) => {
      await tx.escapeRoomPuzzle.update({ where: { id: escapeRoomId }, data: updateData });

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
        const sceneItems: any[] = Array.isArray(scene?.items) ? scene.items : [];
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

        const zones: any[] = Array.isArray(scene?.interactiveZones) ? scene.interactiveZones : [];
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
                pickupAnimationPreset: zone?.pickupAnimationPreset,
                sfx: zone?.sfx || undefined,
                penaltySeconds: zone?.penaltySeconds || undefined,
                miniPuzzle: zone?.miniPuzzle || undefined,
                requiredItemId: zone?.requiredItemId,
                consumeItemOnUse: zone?.consumeItemOnUse,
                disabledByDefault: zone?.disabledByDefault,
                useEffect: zone?.useEffect,
                actionType,
              }),
            },
          });
        }

        for (const zone of zones.filter((z: any) => (z?.actionType || z?.type) === 'trigger')) {
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
      const curData: any = puzzle?.data && typeof puzzle.data === 'object' ? puzzle.data : {};
      const nextData = {
        ...curData,
        escapeRoomData: {
          title,
          description,
          timeLimit,
          startMode: startMode || curData?.escapeRoomData?.startMode || 'leader-start',
          minTeamSize: (typeof minTeamSize === 'number' && minTeamSize > 0) ? minTeamSize : (curData?.escapeRoomData?.minTeamSize || 1),
          playerMode: playerMode || curData?.escapeRoomData?.playerMode || 'shared',
          intro: intro || undefined,
          outro: outro || undefined,
          scenes,
        },
      };
      await tx.puzzle.update({ where: { id: puzzleId }, data: { data: nextData, minTeamSize: (typeof minTeamSize === 'number' && minTeamSize > 0) ? minTeamSize : 1 } });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: (error as any)?.message || String(error), stack: (error as any)?.stack }, { status: 500 });
  }
}
