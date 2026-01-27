
import dotenv from 'dotenv';
import axios, { AxiosError } from 'axios';
import { PrismaClient } from '@prisma/client';
import ensureDevServer from './devServer';
const prisma = new PrismaClient();
dotenv.config();


describe('Escape Room API Endpoints', () => {
  let puzzleId: string;
  let categoryId: string;
  let escapeRoomId: string;

  beforeAll(async () => {
    // ensure dev server is running for HTTP e2e
    const server = await ensureDevServer();
    // attach to global so afterAll can stop it if needed
    (global as any).__e2e_dev_server = server;

    // Create a test category
    const category = await prisma.puzzleCategory.create({
      data: {
        name: 'API Test Category',
        description: 'Category for API tests',
        color: '#123456',
        icon: 'api-icon',
      },
    });
    categoryId = category.id;
    // Create a test puzzle
    const puzzle = await prisma.puzzle.create({
      data: {
        title: 'API Test Puzzle',
        description: 'Puzzle for API tests',
        content: '{}',
        categoryId,
        difficulty: 'medium',
        puzzleType: 'escape',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    puzzleId = puzzle.id;
    // Create a test escape room
    const escapeRoom = await prisma.escapeRoomPuzzle.create({
      data: {
        puzzleId,
        roomTitle: 'API Test Room',
        roomDescription: 'Room for API tests',
        minTeamSize: 2,
        maxTeamSize: 5,
        timeLimitSeconds: 1200,
      },
    });
    escapeRoomId = escapeRoom.id;
  });

  afterAll(async () => {
    if (puzzleId) {
      await prisma.escapeRoomPuzzle.deleteMany({ where: { puzzleId } });
      await prisma.puzzle.delete({ where: { id: puzzleId } });
    }
    if (categoryId) {
      await prisma.puzzleCategory.delete({ where: { id: categoryId } });
    }
    await prisma.$disconnect();
    // stop spawned dev server if we started it
    const server: any = (global as any).__e2e_dev_server;
    if (server && typeof server.stop === 'function') {
      await server.stop();
    }
  });

  it('should list all escape rooms', async () => {
    const response = await axios.get('http://localhost:3000/api/escape-rooms');
    expect(response.status).toBe(200);
    expect(Array.isArray(response.data.escapeRooms)).toBe(true);
    expect(response.data.escapeRooms.some((r: { id: string }) => r.id === escapeRoomId)).toBe(true);
  });

  it('should get details for a specific escape room', async () => {
    try {
      const response = await axios.get(`http://localhost:3000/api/escape-rooms/${escapeRoomId}`);
      expect(response.status).toBe(200);
      expect(response.data.escapeRoom).toBeDefined();
      expect(response.data.escapeRoom.id).toBe(escapeRoomId);
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response) {
        console.error('GET Error Response:', error.response.data);
      } else {
        console.error('Unexpected Error:', error);
      }
      throw error;
    }
  });

  it('should update an escape room', async () => {
    try {
      const response = await axios.put(`http://localhost:3000/api/escape-rooms/${escapeRoomId}`, {
        roomTitle: 'Updated API Test Room',
        minTeamSize: 3,
      });
      expect(response.status).toBe(200);
      expect(response.data.escapeRoom.roomTitle).toBe('Updated API Test Room');
      expect(response.data.escapeRoom.minTeamSize).toBe(3);
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response) {
        console.error('PUT Error Response:', error.response.data);
      } else {
        console.error('Unexpected Error:', error);
      }
      throw error;
    }
  });

  it('should delete an escape room', async () => {
    try {
      const response = await axios.delete(`http://localhost:3000/api/escape-rooms/${escapeRoomId}`);
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      // Confirm deletion
      const getResponse = await axios.get(`http://localhost:3000/api/escape-rooms/${escapeRoomId}`).catch((e: unknown) => {
        if (axios.isAxiosError(e) && e.response) {
          return e.response;
        }
        throw e;
      });
      expect(getResponse.status).toBe(404);
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response) {
        console.error('DELETE Error Response:', error.response.data);
      } else {
        console.error('Unexpected Error:', error);
      }
      throw error;
    }
  });
});
