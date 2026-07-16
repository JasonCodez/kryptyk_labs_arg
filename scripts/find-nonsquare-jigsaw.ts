// Read-only report of every jigsaw puzzle whose grid isn't square (gridRows !== gridCols).
// Per Phase 6.3, jigsaw grids must always be square — this does NOT auto-fix anything (a
// non-square grid can't be silently stretched/cropped into compliance without picking an
// intended square size, which needs a human decision). Run with no arguments to just list
// affected records.
//
// To apply a targeted fix once you've confirmed which record and intended size from the
// report output, pass --fix <puzzleId> <size>, e.g.:
//   npx tsx scripts/find-nonsquare-jigsaw.ts --fix clabc123 4
//
// Usage: npx tsx scripts/find-nonsquare-jigsaw.ts [--fix <puzzleId> <size>]
import "dotenv/config";

async function main() {
  const prismaModule = await import("../src/lib/prisma");
  const prisma = prismaModule.default ?? prismaModule;

  const args = process.argv.slice(2);
  const fixIndex = args.indexOf("--fix");

  if (fixIndex !== -1) {
    const puzzleId = args[fixIndex + 1];
    const size = Number(args[fixIndex + 2]);
    if (!puzzleId || !Number.isFinite(size) || size < 2 || size > 15) {
      console.error("Usage: --fix <puzzleId> <size>, where size is 2-15");
      process.exit(1);
    }
    const record = await prisma.jigsawPuzzle.findUnique({ where: { puzzleId } });
    if (!record) {
      console.error(`No jigsawPuzzle found for puzzleId ${puzzleId}`);
      process.exit(1);
    }
    console.log(`Updating ${puzzleId}: ${record.gridRows}x${record.gridCols} -> ${size}x${size}`);
    await prisma.jigsawPuzzle.update({ where: { puzzleId }, data: { gridRows: size, gridCols: size } });
    console.log("Done. The old save signature no longer matches, so any in-progress player saves for this puzzle will start fresh.");
    return;
  }

  const records = await prisma.jigsawPuzzle.findMany({
    select: { puzzleId: true, gridRows: true, gridCols: true, imageUrl: true, puzzle: { select: { title: true, puzzleType: true } } },
  });

  const nonSquare = records.filter((r: { gridRows: number; gridCols: number }) => r.gridRows !== r.gridCols);

  console.log(`Jigsaw puzzles checked: ${records.length}`);
  console.log(`Non-square records found: ${nonSquare.length}`);
  for (const r of nonSquare) {
    console.log(`  - puzzleId=${r.puzzleId} title="${r.puzzle?.title ?? "(untitled)"}" grid=${r.gridRows}x${r.gridCols} imageUrl=${r.imageUrl ?? "(none)"}`);
  }
  if (nonSquare.length === 0) {
    console.log("No action needed.");
  } else {
    console.log("\nThese are NOT auto-fixed. Decide the intended square size for each, then re-run with:");
    console.log("  npx tsx scripts/find-nonsquare-jigsaw.ts --fix <puzzleId> <size>");
  }
}

main().catch((e) => {
  console.error("find-nonsquare-jigsaw failed", e);
  process.exit(1);
});
