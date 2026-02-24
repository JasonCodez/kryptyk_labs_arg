const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.puzzle.updateMany({
    where: { puzzleType: 'escape_room', minTeamSize: 4 },
    data: { minTeamSize: 1 },
  });
  console.log('Updated', result.count, 'escape room puzzle(s) from minTeamSize=4 to 1');
  await prisma.escapeRoomPuzzle.updateMany({
    where: { minTeamSize: 4 },
    data: { minTeamSize: 1, maxTeamSize: 8 },
  });
  console.log('Also patched EscapeRoomPuzzle records');
}

main().catch(console.error).finally(() => prisma.$disconnect());
