import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get all users
    const users = await prisma.user.findMany();

    // Calculate rankings with progress data
    const entries = await Promise.all(
      users.map(async (user: { id: string; name?: string | null; email?: string | null }) => {
        const progress = await prisma.userPuzzleProgress.findMany({
          where: { userId: user.id, solved: true },
          select: { pointsEarned: true },
        });
        return {
          userId: user.id,
          userName: user.name,
          email: user.email || "",
          puzzlesSolved: progress.length,
          totalPoints: progress.reduce((sum: number, p: { pointsEarned?: number | null }) => sum + (p.pointsEarned || 0), 0),
          rank: 0,
        };
      })
    );

    // Sort by points descending
    entries.sort((a, b) => b.totalPoints - a.totalPoints);

    // Re-rank after sorting
    entries.forEach((entry: any, index: any) => {
      entry.rank = index + 1;
    });

    // Find user's rank
    const userRank = entries.find((e: { email?: string }) => e.email === session.user?.email) || null;

    return NextResponse.json({
      entries: entries.slice(0, 100), // Top 100
      userRank: userRank || null,
    });
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    return NextResponse.json(
      { error: "Failed to fetch leaderboard" },
      { status: 500 }
    );
  }
}
