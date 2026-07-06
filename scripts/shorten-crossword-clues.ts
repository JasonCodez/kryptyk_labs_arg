import { PrismaClient, Prisma } from "@prisma/client";
import { shortenClueText } from "../src/lib/crosswordClueText";

const prisma = new PrismaClient();

type CrosswordClue = { text?: string; [key: string]: unknown };
type CrosswordData = {
  clues?: { across?: CrosswordClue[]; down?: CrosswordClue[] };
  [key: string]: unknown;
};

async function main() {
  const puzzles = await prisma.puzzle.findMany({
    where: { puzzleType: "crossword" },
    select: { id: true, title: true, data: true },
  });

  let updatedPuzzles = 0;
  let updatedClues = 0;

  for (const puzzle of puzzles) {
    const data = puzzle.data as CrosswordData | null;
    if (!data?.clues) continue;

    let changed = false;
    for (const direction of ["across", "down"] as const) {
      for (const clue of data.clues[direction] ?? []) {
        if (typeof clue.text !== "string") continue;
        const shortened = shortenClueText(clue.text);
        if (shortened !== clue.text) {
          console.log(`  [${puzzle.title}] (${clue.text.length} -> ${shortened.length} chars)`);
          console.log(`    before: ${clue.text}`);
          console.log(`    after:  ${shortened}`);
          clue.text = shortened;
          changed = true;
          updatedClues++;
        }
      }
    }

    if (changed) {
      await prisma.puzzle.update({
        where: { id: puzzle.id },
        data: { data: data as Prisma.InputJsonValue },
      });
      updatedPuzzles++;
    }
  }

  console.log(`\nDone. Shortened ${updatedClues} clue(s) across ${updatedPuzzles} of ${puzzles.length} crossword puzzle(s).`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
