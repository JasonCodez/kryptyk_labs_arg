import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

// Returns a list of conversation threads for the current user.
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const currentUser = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!currentUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // Fetch recent messages involving the user, newest first
    const msgs = await prisma.directMessage.findMany({
      where: {
        OR: [
          { senderId: currentUser.id },
          { recipientId: currentUser.id },
        ],
      },
      include: { sender: { select: { id: true, name: true, image: true } }, recipient: { select: { id: true, name: true, image: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    // Build threads map keyed by otherUserId
    interface ThreadEntry {
      userId: string;
      userName: string | null;
      userImage: string | null;
      lastMessage: string;
      lastAt: Date;
      unreadCount: number;
    }
    const threads: Record<string, ThreadEntry> = {};
    for (const m of msgs) {
      const otherId = m.senderId === currentUser.id ? m.recipientId : m.senderId;
      if (!threads[otherId]) {
        threads[otherId] = {
          userId: otherId,
          userName: m.senderId === otherId ? m.sender.name || null : m.recipient.name || null,
          userImage: m.senderId === otherId ? m.sender.image || null : m.recipient.image || null,
          lastMessage: m.content,
          lastAt: m.createdAt,
          unreadCount: 0,
        };
      }
    }

    // Compute unread counts per thread
    const otherIds = Object.keys(threads);
    if (otherIds.length > 0) {
      const counts = await prisma.directMessage.groupBy({
        by: ['senderId'],
        where: { recipientId: currentUser.id, isRead: false, senderId: { in: otherIds } },
        _count: { _all: true },
      });
      for (const c of counts) {
        if (threads[c.senderId]) threads[c.senderId].unreadCount = c._count._all || 0;
      }
    }

    // Return threads sorted by lastAt desc
    const sorted = Object.values(threads).sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime());
    return NextResponse.json({ threads: sorted });
  } catch (error) {
    console.error('Failed to fetch inbox:', error);
    return NextResponse.json({ error: 'Failed to fetch inbox' }, { status: 500 });
  }
}
