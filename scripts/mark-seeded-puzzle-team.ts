import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const puzzleId = process.env.PUZZLE_ID || 'cmkvnbf0y0002m1ycamlbskiy';
  console.log('Updating puzzle', puzzleId, 'to be a team puzzle...');

  const existing = await prisma.puzzle.findUnique({ where: { id: puzzleId } });
  if (!existing) {
    console.error('Puzzle not found:', puzzleId);
    await prisma.$disconnect();
    process.exit(1);
  }

  const updated = await prisma.puzzle.update({
    where: { id: puzzleId },
    data: {
      isTeamPuzzle: true,
      minTeamSize: 4,
      puzzleType: 'escape_room',
    },
  });

  console.log('Updated puzzle:', updated.id, 'isTeamPuzzle=', updated.isTeamPuzzle, 'minTeamSize=', updated.minTeamSize);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
