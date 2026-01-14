import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { email: session.user?.email } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const progress = await prisma.userPuzzleProgress.findMany({
      where: { userId: user.id },
      include: { puzzle: { include: { category: true } } },
      orderBy: { updatedAt: 'desc' },
    });

    // archived = solved OR failed (attempts >= 5 and not solved)
    const archived = progress.filter(p => p.solved === true || ((p.attempts ?? 0) >= 5 && p.solved !== true));

    const mapped = archived.map((p) => ({
      id: p.puzzle.id,
      title: p.puzzle.title,
      category: p.puzzle.category ? { id: p.puzzle.category.id, name: p.puzzle.category.name } : null,
      difficulty: p.puzzle.difficulty,
      solved: p.solved,
      attempts: p.attempts ?? 0,
    }));

    return NextResponse.json(mapped);
  } catch (error) {
    console.error('Failed to fetch user puzzles:', error);
    return NextResponse.json({ error: 'Failed to fetch user puzzles' }, { status: 500 });
  }
}
