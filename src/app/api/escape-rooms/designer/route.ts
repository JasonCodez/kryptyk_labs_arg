import { PrismaClient } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    // Destructure the designer config
    const { title, description, timeLimit, scenes, userSpecialties } = data;
    // For now, require a dummy puzzleId (should be replaced with real puzzle linkage)
    const dummyPuzzle = await prisma.puzzle.findFirst();
    if (!dummyPuzzle) return NextResponse.json({ error: 'No puzzle found. Please create a puzzle first.' }, { status: 400 });
    const createData: any = {
      roomTitle: title,
      roomDescription: description,
      puzzleId: dummyPuzzle.id,
      // Escape rooms are team-only and always require exactly 4 players.
      minTeamSize: 4,
      maxTeamSize: 4,
    };
    if (typeof timeLimit !== 'undefined' && timeLimit !== null) createData.timeLimitSeconds = Number(timeLimit);

    const escapeRoom = await prisma.escapeRoomPuzzle.create({
      data: createData,
    });
    // Create scenes (RoomLayout)
    for (const scene of scenes) {
      const layout = await prisma.roomLayout.create({
        data: {
          escapeRoomId: escapeRoom.id,
          title: scene.name,
          backgroundUrl: scene.backgroundUrl,
        },
      });
      // Create items (ItemDefinition)
      for (const item of scene.items) {
        await prisma.itemDefinition.create({
          data: {
            escapeRoomId: escapeRoom.id,
            key: item.id,
            name: item.name,
            description: item.description,
            imageUrl: item.imageUrl,
          },
        });
      }
      // Create interactive zones (Hotspot)
      for (const zone of scene.interactiveZones) {
        await prisma.hotspot.create({
          data: {
            layoutId: layout.id,
            x: zone.x,
            y: zone.y,
            w: zone.width,
            h: zone.height,
            type: zone.actionType,
            targetId: zone.collectItemId || null,
            meta: JSON.stringify({
              label: zone.label,
              modalContent: zone.modalContent,
              itemId: (zone as any).itemId,
              imageUrl: (zone as any).imageUrl,
              interactions: (zone as any).interactions,
              linkedPuzzleId: zone.linkedPuzzleId,
              eventId: zone.eventId,
            }),
          },
        });
      }
      // Create triggers (RoomTrigger) for trigger zones
      for (const zone of (scene.interactiveZones.filter((z: any) => z.actionType === 'trigger'))) {
        await prisma.roomTrigger.create({
          data: {
            layoutId: layout.id,
            event: zone.eventId || '',
            action: 'trigger',
          },
        });
      }
    }
    // Optionally: Save userSpecialties (not implemented here)
    return NextResponse.json({ success: true, escapeRoomId: escapeRoom.id });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || String(error), stack: error?.stack }, { status: 500 });
  }
}
