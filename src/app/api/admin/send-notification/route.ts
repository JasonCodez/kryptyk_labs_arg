import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  notifyPuzzleRelease,
  notifyAchievementUnlock,
  notifyTeamUpdate,
  notifyLeaderboardChange,
} from "@/lib/notification-service";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { role: true, id: true },
    });

    // Only admins can trigger test notifications
    if (user?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { type, data } = body;

    switch (type) {
      case "puzzle_release": {
        // Get all users (in production, you'd filter by preferences)
        const allUsers = await prisma.user.findMany({
          select: { id: true },
        });
        const userIds = allUsers.map((u: { id: string }) => u.id);

        await notifyPuzzleRelease(userIds, {
          puzzleId: data.puzzleId,
          puzzleTitle: data.puzzleTitle || "Test Puzzle",
          difficulty: data.difficulty || "MEDIUM",
          points: data.points || 100,
        });

        return NextResponse.json({
          success: true,
          message: `Puzzle release notification sent to ${userIds.length} users`,
        });
      }

      case "achievement": {
        await notifyAchievementUnlock(user.id, {
          achievementId: data.achievementId || "test-achievement",
          achievementName: data.achievementName || "Test Achievement",
          achievementDescription:
            data.achievementDescription || "You unlocked a test achievement!",
          badgeUrl: data.badgeUrl,
        });

        return NextResponse.json({
          success: true,
          message: "Achievement notification sent",
        });
      }

      case "team_update": {
        const teamId = data.teamId;
        const team = await prisma.team.findUnique({
          where: { id: teamId },
          include: { members: { select: { userId: true } } },
        });

        if (!team) {
          return NextResponse.json({ error: "Team not found" }, { status: 404 });
        }

        const userIds = team.members.map((m: { userId: string }) => m.userId);

        await notifyTeamUpdate(userIds, {
          teamId,
          teamName: team.name,
          updateTitle: data.updateTitle || "Team Update",
          updateMessage: data.updateMessage || "There's a new update from your team",
        });

        return NextResponse.json({
          success: true,
          message: `Team update notification sent to ${userIds.length} members`,
        });
      }

      case "leaderboard": {
        await notifyLeaderboardChange(user.id, {
          leaderboardType: data.leaderboardType || "global",
          currentRank: data.currentRank || 1,
          previousRank: data.previousRank || null,
          points: data.points || 0,
        });

        return NextResponse.json({
          success: true,
          message: "Leaderboard notification sent",
        });
      }

      default:
        return NextResponse.json(
          { error: "Invalid notification type" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Failed to send test notification:", error);
    return NextResponse.json(
      { error: "Failed to send notification" },
      { status: 500 }
    );
  }
}
