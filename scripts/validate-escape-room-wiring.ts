import prisma from "@/lib/prisma";

type UseEffect = {
  hideItemIds?: string[];
  showItemIds?: string[];
  disableHotspotIds?: string[];
  enableHotspotIds?: string[];
  grantItemKeys?: string[];
  consumeItemKeys?: string[];
  consumeRequiredItems?: boolean;
  strict?: boolean;
};

function safeJsonParse<T>(raw: unknown, fallback: T): T {
  if (!raw) return fallback;
  if (typeof raw === "object") return raw as T;
  if (typeof raw !== "string") return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function getArg(name: string): string | null {
  const idx = process.argv.findIndex((a) => a === `--${name}`);
  if (idx === -1) return null;
  const next = process.argv[idx + 1];
  if (!next || next.startsWith("--")) return null;
  return next;
}

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

async function main() {
  const puzzleId = getArg("puzzleId");
  if (!puzzleId) {
    console.error("Usage: npx tsx scripts/validate-escape-room-wiring.ts --puzzleId <PUZZLE_ID>");
    process.exit(2);
  }

  const puzzle = await prisma.puzzle.findUnique({ where: { id: puzzleId } });
  if (!puzzle) {
    console.error(`Puzzle not found: ${puzzleId}`);
    process.exit(1);
  }

  const pAny: any = puzzle;
  const escapeRoomData =
    pAny?.data && typeof pAny.data === "object" && "escapeRoomData" in pAny.data ? pAny.data.escapeRoomData : null;
  const sceneItems: Array<{ id: string; sceneId?: string; sceneName?: string }> = [];
  if (escapeRoomData && Array.isArray(escapeRoomData.scenes)) {
    for (const s of escapeRoomData.scenes) {
      const sceneId = typeof s?.id === "string" ? s.id : undefined;
      const sceneName = typeof s?.name === "string" ? s.name : undefined;
      const items = Array.isArray(s?.items) ? s.items : [];
      for (const it of items) {
        const id = typeof it?.id === "string" ? it.id : "";
        if (id) sceneItems.push({ id, sceneId, sceneName });
      }
    }
  }
  const sceneItemIds = new Set(sceneItems.map((i) => i.id));

  const escapeRoom = await prisma.escapeRoomPuzzle.findUnique({
    where: { puzzleId },
    include: {
      layouts: { include: { hotspots: true } },
    },
  });
  if (!escapeRoom) {
    console.error(`EscapeRoomPuzzle not found for puzzleId: ${puzzleId}`);
    process.exit(1);
  }

  const itemDefs = await prisma.itemDefinition.findMany({
    where: { escapeRoomId: escapeRoom.id },
    select: { key: true },
  });
  const itemKeys = new Set(itemDefs.map((d) => d.key));

  const hotspotIds = new Set<string>();
  const hotspots: Array<{ id: string; layoutId: string; meta: unknown; type: string; targetId: string | null }> = [];
  for (const layout of escapeRoom.layouts || []) {
    for (const hs of (layout.hotspots || []) as any[]) {
      const id = String(hs.id);
      hotspotIds.add(id);
      hotspots.push({ id, layoutId: String(layout.id), meta: hs.meta, type: String(hs.type || ""), targetId: hs.targetId ? String(hs.targetId) : null });
    }
  }

  const errors: string[] = [];
  const warnings: string[] = [];

  for (const hs of hotspots) {
    const meta = safeJsonParse<Record<string, any>>(hs.meta, {});
    const requiredItemKey = typeof meta.requiredItemKey === "string" ? meta.requiredItemKey : null;
    const requiresItems = Array.isArray(meta.requiresItems) ? meta.requiresItems.filter((x: any) => typeof x === "string") : [];

    if (requiredItemKey && !itemKeys.has(requiredItemKey)) {
      errors.push(`Hotspot ${hs.id}: meta.requiredItemKey '${requiredItemKey}' is not an ItemDefinition.key for this escape room.`);
    }

    for (const k of requiresItems) {
      if (!itemKeys.has(k)) {
        errors.push(`Hotspot ${hs.id}: meta.requiresItems contains unknown item key '${k}'.`);
      }
    }

    const useEffect = (meta && typeof meta.useEffect === "object" && meta.useEffect) ? (meta.useEffect as UseEffect) : null;
    if (!useEffect) continue;

    const hideItemIds = Array.isArray(useEffect.hideItemIds) ? useEffect.hideItemIds.filter((x) => typeof x === "string") : [];
    const showItemIds = Array.isArray(useEffect.showItemIds) ? useEffect.showItemIds.filter((x) => typeof x === "string") : [];
    const disableHotspotIds = Array.isArray(useEffect.disableHotspotIds) ? useEffect.disableHotspotIds.filter((x) => typeof x === "string") : [];
    const enableHotspotIds = Array.isArray(useEffect.enableHotspotIds) ? useEffect.enableHotspotIds.filter((x) => typeof x === "string") : [];
    const grantItemKeys = Array.isArray(useEffect.grantItemKeys) ? useEffect.grantItemKeys.filter((x) => typeof x === "string") : [];
    const consumeItemKeys = Array.isArray(useEffect.consumeItemKeys) ? useEffect.consumeItemKeys.filter((x) => typeof x === "string") : [];

    for (const id of uniq([...hideItemIds, ...showItemIds])) {
      if (!sceneItemIds.has(id)) {
        warnings.push(`Hotspot ${hs.id}: useEffect references scene item id '${id}', but it wasn't found in puzzle.data.escapeRoomData.scenes[].items[].id.`);
      }
    }

    for (const id of uniq([...disableHotspotIds, ...enableHotspotIds])) {
      if (!hotspotIds.has(id)) {
        errors.push(`Hotspot ${hs.id}: useEffect references unknown hotspot id '${id}'.`);
      }
    }

    for (const k of uniq([...grantItemKeys, ...consumeItemKeys])) {
      if (!itemKeys.has(k)) {
        errors.push(`Hotspot ${hs.id}: useEffect references unknown item key '${k}'.`);
      }
    }
  }

  console.log(`EscapeRoom wiring validation for puzzleId=${puzzleId}`);
  console.log(`- layouts: ${(escapeRoom.layouts || []).length}`);
  console.log(`- hotspots: ${hotspots.length}`);
  console.log(`- itemDefinitions: ${itemDefs.length}`);
  console.log(`- designer scene items: ${sceneItems.length}`);
  console.log("");

  if (errors.length > 0) {
    console.log("Errors:");
    for (const e of errors) console.log(`- ${e}`);
    console.log("");
  }

  if (warnings.length > 0) {
    console.log("Warnings:");
    for (const w of warnings) console.log(`- ${w}`);
    console.log("");
  }

  if (errors.length > 0) {
    process.exit(1);
  }
  console.log("✅ Wiring looks consistent.");
}

main()
  .catch((err) => {
    console.error("Validation failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
