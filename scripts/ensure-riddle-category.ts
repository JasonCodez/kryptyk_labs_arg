import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function ensureRiddleCategory() {
  const name = 'Riddle';
  const existing = await prisma.puzzleCategory.findFirst({ where: { name } });
  if (!existing) {
    await prisma.puzzleCategory.create({
      data: { name, description: 'Riddle/answer puzzles', color: '#FDE74C', icon: '🧩' },
    });
    console.log('Riddle category created.');
  } else {
    console.log('Riddle category already exists.');
  }
}

ensureRiddleCategory().finally(() => prisma.$disconnect());
