import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireEscapeRoomTeamContext } from "@/lib/escapeRoomTeamAuth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> } | { params: { id: string } }
) {
  try {
    const resolved = params instanceof Promise ? await params : params;
    const puzzleId = resolved.id;

    const ctx = await requireEscapeRoomTeamContext(request, puzzleId, { requireNotFinished: false });
    if (ctx instanceof NextResponse) return ctx;

    // Read current team inventory so collected items can be hidden from the scene.
    let collectedDesignerItemIds = new Set<string>();
    try {
      const progress = await (prisma as any).teamEscapeProgress.findUnique({
        where: { teamId_escapeRoomId: { teamId: ctx.teamId, escapeRoomId: ctx.escapeRoomId } },
        select: { inventory: true },
      });
      const inventoryRaw: unknown = progress?.inventory;
      const inventory: string[] = (typeof inventoryRaw === 'string') ? (JSON.parse(inventoryRaw) as any) : [];
      if (Array.isArray(inventory)) {
        for (const k of inventory) {
          if (typeof k !== 'string') continue;
          // Expected format when created via admin flow: item_<escapeRoomId>_<designerItemId>
          const parts = k.split('_');
          const candidate = parts.length >= 3 ? parts[parts.length - 1] : '';
          if (candidate) collectedDesignerItemIds.add(candidate);
        }
      }
    } catch {
      collectedDesignerItemIds = new Set<string>();
    }

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

    // Convert designer format to player format. If the designer payload is missing (e.g. older seeded rooms),
    // fall back to persisted escape-room records.
    let stages: Array<any> = [];
    if (escapeRoomData && Array.isArray(escapeRoomData.scenes)) {
      stages = escapeRoomData.scenes.map((scene: any, index: number) => ({
        id: scene.id,
        // UI expects 1-based stage indices
        order: index + 1,
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
      }));
    } else {
      // Fallback: use DB stages if present
      try {
        const stored = await prisma.escapeRoomPuzzle.findUnique({
          where: { puzzleId: puzzleId },
          include: {
            stages: { orderBy: { order: 'asc' } },
            layouts: { include: { hotspots: true }, orderBy: { createdAt: 'asc' } },
          },
        });

        if (stored) {
          stages = (stored.stages || []).map((s: any) => ({
            id: s.id,
            order: s.order,
            title: s.title,
            description: s.description || '',
            puzzleType: s.puzzleType,
            puzzleData: s.puzzleData,
            hints: s.hints,
            rewardItem: s.rewardItem || null,
            rewardDescription: s.rewardDescription || null,
          }));

          return NextResponse.json({
            id: puzzleId,
            stages,
            puzzle: {
              title: stored.roomTitle || puzzle.title,
              description: stored.roomDescription || puzzle.description,
              startMode: 'leader-start',
            },
            layouts: (stored.layouts || []).map((l: any) => ({
              id: l.id,
              title: l.title || null,
              backgroundUrl: l.backgroundUrl || null,
              width: l.width || null,
              height: l.height || null,
              hotspots: (l.hotspots || []).map((h: any) => ({ id: h.id, x: h.x, y: h.y, w: h.w, h: h.h, type: h.type, meta: h.meta, targetId: h.targetId || null })),
              items: [],
            })),
          });
        }
      } catch (err) {
        console.error('Failed to load stored escape room for fallback:', err);
      }

      return NextResponse.json({ error: "Escape room data not found" }, { status: 404 });
    }

    // Also try to load persisted layouts from the escapeRoomPuzzle/roomLayout tables
    let layouts: Array<any> = [];
    try {
      const stored = await prisma.escapeRoomPuzzle.findUnique({
        where: { puzzleId: puzzleId },
        include: {
          layouts: {
            include: { hotspots: true },
            orderBy: { createdAt: 'asc' },
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
              srcScene =
                scenes[idx] ||
                scenes.find((s: any) => (s.name || '').trim() === (l.title || '').trim()) ||
                scenes.find((s: any) => (s.backgroundUrl || '').trim() && (s.backgroundUrl || '').trim() === (l.backgroundUrl || '').trim()) ||
                null;
            }
            if (srcScene && Array.isArray(srcScene.items)) {
              items = srcScene.items
                .filter((it: any) => {
                  const id = typeof it?.id === 'string' ? it.id : '';
                  return !id || !collectedDesignerItemIds.has(id);
                })
                .map((it: any) => ({
                  id: it.id,
                  name: it.name,
                  imageUrl: it.imageUrl,
                  description: it.description || (it.properties && it.properties.description) || '',
                  x: it.x,
                  y: it.y,
                  w: it.w,
                  h: it.h,
                  properties: it.properties || {},
                }));
            }
          } catch (err) {
            items = [];
          }
          return {
            id: l.id,
            title: l.title || null,
            backgroundUrl: l.backgroundUrl || null,
            width: l.width || null,
            height: l.height || null,
            hotspots: (l.hotspots || []).map((h: any) => ({ id: h.id, x: h.x, y: h.y, w: h.w, h: h.h, type: h.type, meta: h.meta, targetId: h.targetId || null })),
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
