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
    });

    if (!relay) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    // Fetch messages
    const messages = await prisma.relayMessage.findMany({
      where: { relayId: relay.id },
      include: { user: true },
      orderBy: { createdAt: 'asc' },
    });

    const formattedMessages = messages.map((msg) => ({
      id: msg.id,
      userId: msg.userId,
      userName: msg.user?.name || msg.user?.email || 'Unknown',
      message: msg.message,
      createdAt: msg.createdAt,
    }));

    return NextResponse.json({
      messages: formattedMessages,
    });
  } catch (error) {
    console.error('Failed to fetch messages:', error);
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    );
  }
}
