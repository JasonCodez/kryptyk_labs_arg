import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> } | { params: { id: string } }
) {
  try {
    const resolved = params instanceof Promise ? await params : params;
    const puzzleId = resolved.id;

    // First get the puzzle to access the escape room data
    // Avoid selecting `data` explicitly (client types may disagree); fetch the full record and access `data` dynamically.
    const puzzle = await prisma.puzzle.findUnique({
      where: { id: puzzleId },
    });

    if (!puzzle) return NextResponse.json({ error: "Puzzle not found" }, { status: 404 });

    // Get the escape room data from the puzzle (cast to any to avoid generated client type mismatches)
    const pAny: any = puzzle;
    const escapeRoomData = pAny.data && typeof pAny.data === 'object' && 'escapeRoomData' in pAny.data
      ? pAny.data.escapeRoomData
      : null;

    if (!escapeRoomData) return NextResponse.json({ error: "Escape room data not found" }, { status: 404 });

    // Convert designer format to player format
    const stages = escapeRoomData.scenes?.map((scene: any, index: number) => ({
      id: scene.id,
      order: index,
      title: scene.name || `Scene ${index + 1}`,
      description: scene.description || '',
      puzzleType: 'escape-room-scene',
      puzzleData: JSON.stringify({
        scene,
        items: scene.items || [],
        interactiveZones: scene.interactiveZones || [],
      }),
      hints: '[]',
      rewardItem: null,
      rewardDescription: null,
    })) || [];

    // Also try to load persisted layouts from the escapeRoomPuzzle/roomLayout tables
    let layouts: Array<any> = [];
    try {
      const stored = await prisma.escapeRoomPuzzle.findUnique({
        where: { puzzleId: puzzleId },
        include: {
          layouts: {
            include: { hotspots: true },
          },
        },
      });
      if (stored && Array.isArray(stored.layouts) && stored.layouts.length > 0) {
        layouts = stored.layouts.map((l: any, idx: number) => {
          // Try to attach designer items (positions + imageUrl) when available in the original designer payload
          let items: any[] = [];
          try {
            const scenes = escapeRoomData && escapeRoomData.scenes && Array.isArray(escapeRoomData.scenes) ? escapeRoomData.scenes : null;
            let srcScene: any = null;
            if (scenes) {
              // Prefer same-index mapping, otherwise match by title
              srcScene = scenes[idx] || scenes.find((s: any) => (s.name || '').trim() === (l.title || '').trim()) || null;
            }
            if (srcScene && Array.isArray(srcScene.items)) items = srcScene.items.map((it: any) => ({ id: it.id, name: it.name, imageUrl: it.imageUrl, x: it.x, y: it.y, w: it.w, h: it.h, properties: it.properties || {} }));
          } catch (err) {
            items = [];
          }
          return {
            id: l.id,
            title: l.title || null,
            backgroundUrl: l.backgroundUrl || null,
            width: l.width || null,
            height: l.height || null,
            hotspots: (l.hotspots || []).map((h: any) => ({ id: h.id, x: h.x, y: h.y, w: h.w, h: h.h, type: h.type, meta: h.meta })),
            items,
          };
        });
      }
    } catch (err) {
      // ignore layout loading errors — fall back to no layouts
      console.error('Failed to load stored layouts for escape room:', err);
    }

    return NextResponse.json({
      id: puzzleId,
      stages,
      puzzle: {
        title: escapeRoomData.title || puzzle.title,
        description: escapeRoomData.description || puzzle.description,
        startMode: (escapeRoomData && escapeRoomData.startMode) ? escapeRoomData.startMode : 'leader-start'
      },
      layouts
    });
  } catch (e) {
    console.error('Error fetching escape room:', e);
    return NextResponse.json({ error: 'Failed to load escape room' }, { status: 500 });
  }
}
