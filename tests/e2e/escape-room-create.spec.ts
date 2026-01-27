require('dotenv').config();
const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const ensureDevServer = require('./devServer').default || require('./devServer');
const prisma = new PrismaClient();

describe('Escape Room API', () => {
  let puzzleId: string;
  let categoryId: string;
  // allow longer for starting dev server in CI/dev machines
  jest.setTimeout(60000);
  beforeAll(async () => {
    // ensure dev server is running for HTTP e2e
    const server = await ensureDevServer();
    (global as any).__e2e_dev_server = server;
    // Create or reuse a test category. If it already exists, reuse it and avoid deleting later.
    let createdCategory = true;
    const existingCat = await prisma.puzzleCategory.findUnique({ where: { name: 'Test Category' } });
    if (existingCat) {
      categoryId = existingCat.id;
      createdCategory = false;
    } else {
      const category = await prisma.puzzleCategory.create({
        data: {
          name: 'Test Category',
          description: 'Category for escape room test',
          color: '#000000',
          icon: 'test-icon',
        },
      });
      categoryId = category.id;
    }

    // Create or reuse a test puzzle (avoid creating duplicates)
    let createdPuzzle = true;
    const existingPuzzle = await prisma.puzzle.findFirst({ where: { title: 'Test Puzzle', categoryId } });
    if (existingPuzzle) {
      puzzleId = existingPuzzle.id;
      createdPuzzle = false;
    } else {
      const puzzle = await prisma.puzzle.create({
        data: {
          title: 'Test Puzzle',
          description: 'Puzzle for escape room test',
          content: '{}',
          categoryId,
          difficulty: 'easy',
          puzzleType: 'escape',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
      puzzleId = puzzle.id;
    }

    // stash flags for cleanup
    (global as any).__e2e_created_category = createdCategory;
    (global as any).__e2e_created_puzzle = createdPuzzle;
  });

  afterAll(async () => {
    // Clean up test puzzle, category, and escape room
    const createdPuzzle = (global as any).__e2e_created_puzzle;
    const createdCategory = (global as any).__e2e_created_category;
    if (puzzleId && createdPuzzle) {
      await prisma.escapeRoomPuzzle.deleteMany({ where: { puzzleId } });
      await prisma.puzzle.delete({ where: { id: puzzleId } });
    }
    if (categoryId && createdCategory) {
      await prisma.puzzleCategory.delete({ where: { id: categoryId } });
    }
    await prisma.$disconnect();
    // stop spawned dev server if we started it
    const server = (global as any).__e2e_dev_server;
    if (server && typeof server.stop === 'function') {
      await server.stop();
    }
  });

  it('should create a new escape room', async () => {
    jest.setTimeout(15000);
    // Wait for DB transaction to commit
    await new Promise<void>(resolve => setTimeout(resolve, 500));
    try {
      const response = await axios.post('http://localhost:3000/api/escape-rooms/create', {
        puzzleId,
        roomTitle: 'Test Room',
        roomDescription: 'A room for testing',
        minTeamSize: 3,
        maxTeamSize: 6,
        timeLimitSeconds: 1800
      });
      expect(response.status).toBe(201);
      expect(response.data.escapeRoom).toBeDefined();
      expect(response.data.escapeRoom.roomTitle).toBe('Test Room');
    } catch (error: any) {
      if (error && error.response) {
        console.error('API Error Response:', error.response.data);
      } else {
        console.error('Unexpected Error:', error);
      }
      throw error;
    }
  });
});
