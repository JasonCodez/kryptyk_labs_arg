import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const roomId = request.nextUrl.searchParams.get('roomId');

    if (!roomId) {
      return NextResponse.json(
        { error: 'Missing roomId' },
        { status: 400 }
      );
    }

    // Find relay room
    const relay = await prisma.relayRiddle.findUnique({
      where: { roomId },
      include: {
        solver: { select: { id: true, name: true, email: true } },
        decoder: { select: { id: true, name: true, email: true } },
      },
    });

    if (!relay) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    return NextResponse.json({
      roomId: relay.roomId,
      status: relay.status,
      solver: relay.solver,
      decoder: relay.decoder,
      solverReady: !!relay.solverSubmittedAt,
      solvedAt: relay.solvedAt,
      expiresAt: relay.expiresAt,
    });
  } catch (error) {
    console.error('Failed to fetch room state:', error);
    return NextResponse.json(
      { error: 'Failed to fetch room state' },
      { status: 500 }
    );
  }
}
