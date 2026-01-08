import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = parseInt(searchParams.get("skip") || "0");
    const sortBy = searchParams.get("sortBy") || "name"; // "name", "puzzles", "points", "followers"

    const where: any = {
      NOT: {
        email: null, // Exclude users without email (like system accounts)
      },
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    const orderBy: any = {};
    
    if (sortBy === "puzzles") {
      // This requires a more complex query, so we'll sort in memory for now
    } else if (sortBy === "points") {
      // Same as above
    } else if (sortBy === "followers") {
      // Same as above
    } else {
      orderBy.name = "asc";
    }

    // Get users with their stats
    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        createdAt: true,
        achievements: { select: { id: true } },
        teams: { select: { id: true } },
        followers: { select: { id: true } },
        solvedPuzzles: {
          where: { solved: true },
          select: { id: true, pointsEarned: true },
        },
      },
      orderBy,
      take: limit,
      skip,
    });

    // Format the response
    const formattedUsers = users.map((user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      createdAt: Date;
      achievements: { id: string }[];
      teams: { id: string }[];
      followers: { id: string }[];
      solvedPuzzles: { id: string; pointsEarned?: number }[];
    }) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      createdAt: user.createdAt,
      stats: {
        puzzlesSolved: user.solvedPuzzles.filter((p) => p.pointsEarned).length,
        totalPoints: user.solvedPuzzles.reduce(
          (sum, p) => sum + (p.pointsEarned || 0),
          0
        ),
        achievementsCount: user.achievements.length,
        teamsCount: user.teams.length,
        followers: user.followers.length,
      },
    }));

    // Sort if needed
    if (sortBy === "puzzles") {
      formattedUsers.sort((a, b) => b.stats.puzzlesSolved - a.stats.puzzlesSolved);
    } else if (sortBy === "points") {
      formattedUsers.sort((a, b) => b.stats.totalPoints - a.stats.totalPoints);
    } else if (sortBy === "followers") {
      formattedUsers.sort((a, b) => b.stats.followers - a.stats.followers);
    }

    const total = await prisma.user.count({ where });

    return NextResponse.json({
      users: formattedUsers,
      total,
      limit,
      skip,
    });
  } catch (error) {
    console.error("Failed to fetch players:", error);
    return NextResponse.json(
      { error: "Failed to fetch players" },
      { status: 500 }
    );
  }
}
