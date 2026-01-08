import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

// Sample clues - in production, these would be pulled from the puzzle config
const SAMPLE_CLUES = [
  {
    id: 'clue-1',
    clue: 'I speak without a mouth and hear without ears. I have no body, but I come alive with wind. What am I?',
    hint: 'Think about sounds bouncing off walls in a canyon.',
    difficulty: 'easy',
  },
  {
    id: 'clue-2',
    clue: 'The more you take, the more you leave behind. What am I?',
    hint: 'Think about walking in the snow.',
    difficulty: 'medium',
  },
  {
    id: 'clue-3',
    clue: 'I have keys but no locks. I have space but no room. You can enter but you can\'t go outside. What am I?',
    hint: 'Found on your desk or in your pocket.',
    difficulty: 'hard',
  },
];

function generateRoomId(): string {
  return 'RELAY-' + Math.random().toString(36).substr(2, 9).toUpperCase();
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { puzzleId } = body;

    // Create relay room
    const roomId = generateRoomId();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    const relay = await prisma.relayRiddle.create({
      data: {
        roomId,
        puzzleId: puzzleId || null,
        solverClues: JSON.stringify(SAMPLE_CLUES),
        solverAnswer: '3', // Caesar shift key
        encryptedMsg: 'KHOOR ZRUOG', // "HELLO WORLD" with shift 3
        cipherType: 'shift',
        expiresAt,
        status: 'waiting',
      },
    });

    return NextResponse.json({
      roomId: relay.roomId,
      solverClues: SAMPLE_CLUES,
      encryptedMsg: relay.encryptedMsg,
      cipherType: relay.cipherType,
    });
  } catch (error) {
    console.error('Failed to create relay room:', error);
    return NextResponse.json(
      { error: 'Failed to create relay room' },
      { status: 500 }
    );
  }
}
