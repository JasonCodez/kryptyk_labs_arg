import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const title = process.env.PROD_TEST_PUZZLE_TITLE || 'PROD Test Escape Room (Team)';
  const description = 'Production test escape-room for team flows (4 players). Auto-created.';

  console.log('Seeding production test team escape-room puzzle...');

  // avoid creating duplicates - select only minimal fields to avoid schema mismatch on older DBs
  const existing = await prisma.puzzle.findFirst({ where: { title }, select: { id: true, title: true } }).catch(() => null);
  if (existing) {
    console.log('Puzzle already exists:', existing.id);
    await prisma.$disconnect();
    return;
  }

  // Ensure a category exists
  const category = await prisma.puzzleCategory.upsert({
    where: { name: 'Test' },
    update: {},
    create: { name: 'Test', description: 'Auto-created category for tests' },
  });

  // Create puzzle (use minimal fields so script works against older schemas)
  const puzzle = await prisma.puzzle.create({
    data: {
      title,
      description,
      categoryId: category.id,
      puzzleType: 'escape_room',
    },
  });

  console.log('Created puzzle id=', puzzle.id);

  // Create 4 parts (one per player)
  for (let i = 1; i <= 4; i++) {
    await prisma.puzzlePart.create({
      data: {
        puzzleId: puzzle.id,
        title: `Player ${i}`,
        content: '',
        order: i - 1,
      },
    });
  }

  console.log('Created 4 puzzle parts for players');

  // Create escape room record and a single layout (guard in case model/columns missing in DB)
  let escapeRoom: any = null;
  try {
    escapeRoom = await prisma.escapeRoomPuzzle.create({
      data: {
        puzzleId: puzzle.id,
        roomTitle: title,
        roomDescription: 'Auto-seeded room for production testing',
        timeLimitSeconds: 1800,
      },
    });
    console.log('Created escapeRoom id=', escapeRoom.id);
  } catch (err) {
    const message = (err && typeof err === 'object' && 'message' in err) ? (err as any).message : String(err);
    console.warn('Could not create escapeRoom record (possibly older schema):', message);
  }

  if (escapeRoom) {
    try {
      const layout = await prisma.roomLayout.create({
        data: {
          escapeRoomId: escapeRoom.id,
          title: 'Main Room',
          backgroundUrl: '',
          width: 1200,
          height: 720,
        },
      });
      console.log('Created layout id=', layout.id);

      // Add a simple item definition
      const item = await prisma.itemDefinition.create({
        data: {
          escapeRoomId: escapeRoom.id,
          key: 'gold-key',
          name: 'Gold Key',
          description: 'A key used in tests',
          imageUrl: '',
          consumable: false,
        },
      });
      console.log('Created itemDefinition id=', item.id);

      // Add a hotspot that can collect the item
      const hotspot = await prisma.hotspot.create({
        data: {
          layoutId: layout.id,
          x: 100,
          y: 120,
          w: 48,
          h: 48,
          type: 'interactive',
          targetId: item.key,
          meta: JSON.stringify({ label: 'Find the key' }),
        },
      });
      console.log('Created hotspot id=', hotspot.id);
    } catch (err) {
      const message = (err && typeof err === 'object' && 'message' in err) ? (err as any).message : String(err);
      console.warn('Could not create layout/item/hotspot (possibly older schema):', message);
    }
  } else {
    console.log('Skipping layout/item/hotspot creation because escapeRoom record was not created');
  }

  console.log('Production test team escape-room seeded successfully. Puzzle ID:', puzzle.id);
  console.log('Invite 4 users to your team and open the lobby to validate production flows.');

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('Seeding failed:', err);
  await prisma.$disconnect();
  process.exit(1);
});
