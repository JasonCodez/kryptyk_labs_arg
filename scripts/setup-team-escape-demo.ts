import path from 'path';
import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

// Load env files (same pattern as prisma/seed.ts)
config({ path: path.resolve(process.cwd(), '.env.local') });
config({ path: path.resolve(process.cwd(), '.env') });

const prisma = new PrismaClient();

type DemoUserSpec = {
  email: string;
  password: string;
  name: string;
};

async function upsertDemoUser(spec: DemoUserSpec) {
  const hash = await bcrypt.hash(spec.password, 10);
  return prisma.user.upsert({
    where: { email: spec.email },
    update: { password: hash, name: spec.name },
    create: {
      email: spec.email,
      name: spec.name,
      password: hash,
      role: 'PLAYER',
    },
    select: { id: true, email: true, name: true },
  });
}

async function ensureCategory(name: string) {
  return prisma.puzzleCategory.upsert({
    where: { name },
    update: {},
    create: { name, description: 'Auto-created category for demo' },
    select: { id: true, name: true },
  });
}

async function main() {
  const demoTitle = process.env.DEMO_ESCAPE_PUZZLE_TITLE || 'Seed: Team Escape Demo (4 players)';
  const teamName = process.env.DEMO_ESCAPE_TEAM_NAME || 'Demo Team Escape (4)';
  const password = process.env.DEMO_ESCAPE_PASSWORD || 'password123';

  const users: DemoUserSpec[] = [
    { email: 'leader1@local.test', password, name: 'Leader One' },
    { email: 'player2@local.test', password, name: 'Player Two' },
    { email: 'player3@local.test', password, name: 'Player Three' },
    { email: 'player4@local.test', password, name: 'Player Four' },
  ];

  console.log('Setting up demo users...');
  const [leader, p2, p3, p4] = await Promise.all(users.map(upsertDemoUser));

  console.log('Ensuring team exists...');
  const existingTeam = await prisma.team.findFirst({
    where: { name: teamName, createdBy: leader.id },
    select: { id: true },
  });

  const team = existingTeam
    ? await prisma.team.findUniqueOrThrow({ where: { id: existingTeam.id }, select: { id: true, name: true, createdBy: true } })
    : await prisma.team.create({
        data: {
          name: teamName,
          description: 'Auto-created 4-player team for escape-room manual validation',
          createdBy: leader.id,
          isPublic: false,
        },
        select: { id: true, name: true, createdBy: true },
      });

  // Ensure all four members are present
  await prisma.teamMember.upsert({
    where: { teamId_userId: { teamId: team.id, userId: leader.id } },
    update: { role: 'leader' },
    create: { teamId: team.id, userId: leader.id, role: 'leader' },
  });

  for (const u of [p2, p3, p4]) {
    await prisma.teamMember.upsert({
      where: { teamId_userId: { teamId: team.id, userId: u.id } },
      update: {},
      create: { teamId: team.id, userId: u.id, role: 'member' },
    });
  }

  console.log('Ensuring team-only escape-room puzzle exists...');
  const existingPuzzle = await prisma.puzzle.findFirst({
    where: { title: demoTitle },
    select: { id: true },
  });

  let puzzleId: string;
  let escapeRoomId: string;

  if (existingPuzzle) {
    puzzleId = existingPuzzle.id;
    const er = await prisma.escapeRoomPuzzle.findUnique({ where: { puzzleId }, select: { id: true } });
    if (!er) throw new Error('Found puzzle but missing escapeRoomPuzzle record');
    escapeRoomId = er.id;
  } else {
    const category = await ensureCategory('Escape');

    const puzzle = await prisma.puzzle.create({
      data: {
        title: demoTitle,
        description: 'Team escape-room demo (4 players): find the key, unlock the drawer. Auto-seeded for manual validation.',
        content: '<p>Demo team escape room.</p>',
        categoryId: category.id,
        difficulty: 'easy',
        isActive: true,
        isTeamPuzzle: true,
        minTeamSize: 4,
        puzzleType: 'escape_room',
      },
      select: { id: true },
    });

    puzzleId = puzzle.id;

    // Create 4 parts (one per player)
    await prisma.puzzlePart.createMany({
      data: [
        { puzzleId, title: 'Player 1', content: '', order: 0 },
        { puzzleId, title: 'Player 2', content: '', order: 1 },
        { puzzleId, title: 'Player 3', content: '', order: 2 },
        { puzzleId, title: 'Player 4', content: '', order: 3 },
      ],
      skipDuplicates: true,
    });

    const escapeRoom = await prisma.escapeRoomPuzzle.create({
      data: {
        puzzleId,
        roomTitle: 'Demo Room (Team)',
        roomDescription: 'Find the hidden key and unlock the drawer.',
        // Keep this short-ish so fail/no-retry is quick to validate
        timeLimitSeconds: 300,
        minTeamSize: 4,
        maxTeamSize: 4,
      },
      select: { id: true },
    });

    escapeRoomId = escapeRoom.id;

    const layout = await prisma.roomLayout.create({
      data: {
        escapeRoomId,
        title: 'Main Room',
        backgroundUrl: '',
        width: 1200,
        height: 720,
      },
      select: { id: true },
    });

    const keyItem = await prisma.itemDefinition.upsert({
      where: { key: 'team_demo_golden_key' },
      update: {
        name: 'Golden Key',
        description: 'A small brass key used for the demo.',
        imageUrl: '',
        consumable: true,
        escapeRoomId,
      },
      create: {
        escapeRoomId,
        key: 'team_demo_golden_key',
        name: 'Golden Key',
        description: 'A small brass key used for the demo.',
        imageUrl: '',
        consumable: true,
      },
      select: { id: true, key: true },
    });

    // Pickup hotspot for the key
    await prisma.hotspot.create({
      data: {
        layoutId: layout.id,
        x: 320,
        y: 420,
        w: 48,
        h: 24,
        type: 'pickup',
        targetId: keyItem.id,
        meta: JSON.stringify({ label: 'Golden Key on desk' }),
      },
    });

    // Lock that requires the key
    await prisma.escapeLock.create({
      data: {
        layoutId: layout.id,
        lockType: 'item',
        requirement: JSON.stringify({ type: 'item', key: keyItem.key }),
        secret: null,
        isLocked: true,
        requiredItemKey: keyItem.key,
      },
    });

    // Interactive hotspot representing the drawer
    await prisma.hotspot.create({
      data: {
        layoutId: layout.id,
        x: 520,
        y: 500,
        w: 180,
        h: 80,
        type: 'interactive',
        targetId: null,
        meta: JSON.stringify({ label: 'Locked Drawer', lockKey: keyItem.key }),
      },
    });
  }

  console.log('\n✅ Demo setup complete');
  console.log('Team:', team.id, team.name);
  console.log('Puzzle:', puzzleId, demoTitle);
  console.log('EscapeRoom:', escapeRoomId);

  console.log('\nLogin credentials (all use same password):');
  console.log('- leader1@local.test');
  console.log('- player2@local.test');
  console.log('- player3@local.test');
  console.log('- player4@local.test');
  console.log('Password:', password);

  console.log('\nURLs:');
  console.log('Team Lobby:', `http://localhost:3000/teams/${team.id}/lobby`);
  console.log('Puzzle Page:', `http://localhost:3000/puzzles/${puzzleId}?teamId=${team.id}`);
}

main()
  .catch(async (err) => {
    console.error('❌ Demo setup failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
