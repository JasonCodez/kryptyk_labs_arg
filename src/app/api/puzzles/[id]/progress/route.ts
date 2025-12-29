import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

// GET /api/puzzles/[id]/progress - Fetch user's progress for puzzle
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const progress = await prisma.userPuzzleProgress.findUnique({
      where: {
        userId_puzzleId: {
          userId: user.id,
          puzzleId: id,
        },
      },
      include: {
        sessionLogs: {
          orderBy: { sessionStart: "desc" },
          take: 10,
        },
        partProgress: {
          include: {
            part: {
              select: {
                id: true,
                title: true,
                order: true,
                pointsValue: true,
              },
            },
          },
          orderBy: { part: { order: "asc" } },
        },
      },
    });

    if (!progress) {
      // Return default progress if not started
      return NextResponse.json(
        {
          id: null,
          solved: false,
          attempts: 0,
          successfulAttempts: 0,
          totalTimeSpent: 0,
          completionPercentage: 0,
          pointsEarned: 0,
          sessionLogs: [],
          partProgress: [],
        },
        { status: 200 }
      );
    }

    return NextResponse.json(progress);
  } catch (error) {
    console.error("Failed to fetch progress:", error);
    return NextResponse.json(
      { error: "Failed to fetch progress" },
      { status: 500 }
    );
  }
}

// POST /api/puzzles/[id]/progress - Update progress (start session, log attempt, etc)
const UpdateProgressSchema = z.object({
  action: z.enum(["start_session", "end_session", "log_attempt", "attempt_success"]),
  durationSeconds: z.number().optional(),
  hintUsed: z.boolean().optional(),
  successful: z.boolean().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await request.json();
    const { action, durationSeconds, hintUsed, successful } =
      UpdateProgressSchema.parse(body);

    // Get or create progress
    let progress = await prisma.userPuzzleProgress.findUnique({
      where: {
        userId_puzzleId: {
          userId: user.id,
          puzzleId: id,
        },
      },
    });

    if (!progress) {
      progress = await prisma.userPuzzleProgress.create({
        data: {
          userId: user.id,
          puzzleId: id,
        },
      });
    }

    switch (action) {
      case "start_session":
        // Start a new session
        await prisma.userPuzzleProgress.update({
          where: { id: progress.id },
          data: {
            currentSessionStart: new Date(),
          },
        });

        // Create session log entry
        await prisma.puzzleSessionLog.create({
          data: {
            progressId: progress.id,
            userId: user.id,
            puzzleId: id,
            sessionStart: new Date(),
          },
        });

        break;

      case "end_session":
        if (progress.currentSessionStart && durationSeconds) {
          const totalTime = progress.totalTimeSpent + durationSeconds;
          await prisma.userPuzzleProgress.update({
            where: { id: progress.id },
            data: {
              totalTimeSpent: totalTime,
              currentSessionStart: null,
            },
          });

          // Update latest session log
          const sessionLog = await prisma.puzzleSessionLog.findFirst({
            where: {
              progressId: progress.id,
              sessionEnd: null,
            },
            orderBy: { sessionStart: "desc" },
          });

          if (sessionLog) {
            await prisma.puzzleSessionLog.update({
              where: { id: sessionLog.id },
              data: {
                sessionEnd: new Date(),
                durationSeconds,
                hintUsed: hintUsed || false,
              },
            });
          }
        }
        break;

      case "log_attempt":
        const newAttempts = progress.attempts + 1;
        const newAvgTime =
          progress.averageTimePerAttempt && durationSeconds
            ? (progress.averageTimePerAttempt * progress.attempts + durationSeconds) /
              newAttempts
            : durationSeconds || 0;

        await prisma.userPuzzleProgress.update({
          where: { id: progress.id },
          data: {
            attempts: newAttempts,
            lastAttemptAt: new Date(),
            averageTimePerAttempt: newAvgTime,
          },
        });

        // Create/update session log
        const currentSessionLog = await prisma.puzzleSessionLog.findFirst({
          where: {
            progressId: progress.id,
            sessionEnd: null,
          },
          orderBy: { sessionStart: "desc" },
        });

        if (currentSessionLog) {
          await prisma.puzzleSessionLog.update({
            where: { id: currentSessionLog.id },
            data: {
              attemptMade: true,
            },
          });
        }

        break;

      case "attempt_success":
        const successfulAttempts = progress.successfulAttempts + 1;
        const newAttempts2 = progress.attempts + 1;
        const newAvgTime2 =
          progress.averageTimePerAttempt && durationSeconds
            ? (progress.averageTimePerAttempt * progress.attempts + durationSeconds) /
              newAttempts2
            : durationSeconds || 0;

        await prisma.userPuzzleProgress.update({
          where: { id: progress.id },
          data: {
            attempts: newAttempts2,
            successfulAttempts,
            lastAttemptAt: new Date(),
            averageTimePerAttempt: newAvgTime2,
            solved: true,
            solvedAt: new Date(),
          },
        });

        // Mark session log as successful
        const successSessionLog = await prisma.puzzleSessionLog.findFirst({
          where: {
            progressId: progress.id,
            sessionEnd: null,
          },
          orderBy: { sessionStart: "desc" },
        });

        if (successSessionLog) {
          await prisma.puzzleSessionLog.update({
            where: { id: successSessionLog.id },
            data: {
              wasSuccessful: true,
              attemptMade: true,
            },
          });
        }

        break;
    }

    // Return updated progress
    const updatedProgress = await prisma.userPuzzleProgress.findUnique({
      where: { id: progress.id },
      include: {
        sessionLogs: {
          orderBy: { sessionStart: "desc" },
          take: 5,
        },
        partProgress: true,
      },
    });

    return NextResponse.json(updatedProgress);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.issues },
        { status: 400 }
      );
    }

    console.error("Failed to update progress:", error);
    return NextResponse.json(
      { error: "Failed to update progress" },
      { status: 500 }
    );
  }
}
