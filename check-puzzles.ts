import prisma from "./src/lib/prisma";

async function main() {
  const puzzles = await prisma.escapeRoomPuzzle.findMany({
    include: {
      puzzle: true,
      stages: {
        orderBy: { order: "asc" },
      },
    },
  });

  console.log(`Found ${puzzles.length} escape room puzzles:\n`);
  puzzles.forEach((puzzle: any) => {
    console.log(`Puzzle ID: ${puzzle.puzzleId}`);
    console.log(`Title: ${puzzle.puzzle?.title || "N/A"}`);
    console.log(`Stages: ${puzzle.stages.length}`);
    console.log("---");
  });
}

main()
  .catch(console.error)
  .finally(() => process.exit(0));
