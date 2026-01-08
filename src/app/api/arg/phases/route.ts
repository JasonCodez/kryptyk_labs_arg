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

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (user?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { name, description, orderIndex } = body;

    if (!name || orderIndex === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Create the phase
    const phase = await prisma.aRGPhase.create({
      data: {
        name,
        description,
        orderIndex,
        isActive: false,
      },
    });

    return NextResponse.json(phase, { status: 201 });
  } catch (error) {
    console.error('Failed to create ARG phase:', error);
    return NextResponse.json(
      { error: 'Failed to create phase' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const phases = await prisma.aRGPhase.findMany({
      orderBy: { orderIndex: 'asc' },
      include: {
        puzzles: {
          where: { isPublished: true },
          orderBy: { orderIndex: 'asc' },
        },
      },
    });

    return NextResponse.json(phases);
  } catch (error) {
    console.error('Failed to fetch ARG phases:', error);
    return NextResponse.json(
      { error: 'Failed to fetch phases' },
      { status: 500 }
    );
  }
}
