import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { roomId, decodedMessage } = body;

    if (!roomId || !decodedMessage) {
      return NextResponse.json(
        { error: 'Missing roomId or decodedMessage' },
        { status: 400 }
      );
    }

    // Find relay room
    const relay = await prisma.relayRiddle.findUnique({
      where: { roomId },
    });

    if (!relay) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    // Expected decoded message (e.g., "HELLO WORLD")
    const expectedDecoded = 'HELLO WORLD';
    const isSolved =
      decodedMessage.toUpperCase() === expectedDecoded.toUpperCase();

    if (isSolved) {
      // Mark relay as solved
      await prisma.relayRiddle.update({
        where: { roomId },
        data: { solvedAt: new Date(), status: 'solved' },
      });

      // TODO: Award team points and achievements
      // - Add points to both users
      // - Unlock "Tag Team" achievement if first relay puzzle
    }

    return NextResponse.json({
      solved: isSolved,
      feedback: isSolved
        ? 'Excellent! You decoded it correctly. Team reward earned!'
        : `Not correct. Expected: "${expectedDecoded}"`,
    });
  } catch (error) {
    console.error('Failed to submit solution:', error);
    return NextResponse.json(
      { error: 'Failed to submit solution' },
      { status: 500 }
    );
  }
}
