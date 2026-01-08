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
    const { phaseId, title, description, puzzleType, difficulty, orderIndex, solution, hints, puzzleData } = body;

    if (!phaseId || !title || !puzzleType || !difficulty || !solution) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Create the puzzle
    const puzzle = await prisma.aRGPuzzle.create({
      data: {
        phaseId,
        title,
        description,
        puzzleType,
        difficulty,
        orderIndex,
        solution,
        hints: hints || [],
        puzzleData: puzzleData || {},
        isPublished: false,
        createdBy: user.id,
      },
    });

    return NextResponse.json(puzzle, { status: 201 });
  } catch (error) {
    console.error('Failed to create ARG puzzle:', error);
    return NextResponse.json(
      { error: 'Failed to create puzzle' },
      { status: 500 }
    );
  }
}
