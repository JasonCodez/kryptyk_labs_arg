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

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const { roomId, role } = body;

    if (!roomId || !['solver', 'decoder'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid roomId or role' },
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

    if (relay.status === 'expired') {
      return NextResponse.json({ error: 'Room has expired' }, { status: 410 });
    }

    // Update room with player
    let updatedRelay;
    if (role === 'solver') {
      updatedRelay = await prisma.relayRiddle.update({
        where: { roomId },
        data: { solverUserId: user.id, status: 'in_progress' },
      });
    } else {
      updatedRelay = await prisma.relayRiddle.update({
        where: { roomId },
        data: { decoderUserId: user.id, status: 'in_progress' },
      });
    }

    // Return player-specific view
    const clues = JSON.parse(relay.solverClues);
    const view =
      role === 'solver'
        ? { clues }
        : {
            encryptedMessage: relay.encryptedMsg,
            cipherType: relay.cipherType,
          };

    return NextResponse.json({
      joined: true,
      role,
      roomId,
      view,
    });
  } catch (error) {
    console.error('Failed to join relay room:', error);
    return NextResponse.json(
      { error: 'Failed to join relay room' },
      { status: 500 }
    );
  }
}
