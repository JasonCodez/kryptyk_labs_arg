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
    const { roomId, answer } = body;

    if (!roomId || !answer) {
      return NextResponse.json(
        { error: 'Missing roomId or answer' },
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

    // Validate answer (case-insensitive)
    const isCorrect =
      answer.toString().toLowerCase() === relay.solverAnswer.toLowerCase();

    if (isCorrect) {
      // Update room to mark solver as submitted
      await prisma.relayRiddle.update({
        where: { roomId },
        data: { solverSubmittedAt: new Date() },
      });
    }

    return NextResponse.json({
      correct: isCorrect,
      feedback: isCorrect
        ? 'Correct! Share this key with your Decoder.'
        : 'Not quite right. Try again or ask for a hint.',
    });
  } catch (error) {
    console.error('Failed to submit answer:', error);
    return NextResponse.json(
      { error: 'Failed to submit answer' },
      { status: 500 }
    );
  }
}
