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
    const { roomId, message } = body;

    if (!roomId || !message) {
      return NextResponse.json(
        { error: 'Missing roomId or message' },
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

    // Create message
    const msg = await prisma.relayMessage.create({
      data: {
        relayId: relay.id,
        userId: user.id,
        message,
      },
      include: { user: true },
    });

    return NextResponse.json({
      id: msg.id,
      userId: msg.userId,
      userName: msg.user?.name || msg.user?.email || 'Unknown',
      message: msg.message,
      createdAt: msg.createdAt,
    });
  } catch (error) {
    console.error('Failed to send message:', error);
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    );
  }
}
