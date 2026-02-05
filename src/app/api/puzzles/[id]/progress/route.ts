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
  action: z.enum(["start_session", "end_session", "log_attempt", "attempt_success", "lock_puzzle", "clear_state"]),
  // Some callers send null; accept it and normalize later.
  durationSeconds: z.number().nullable().optional(),
  hintUsed: z.boolean().nullable().optional(),
  successful: z.boolean().nullable().optional(),
  // optional grid payload for puzzles like Sudoku
  grid: z.array(z.array(z.number())).optional(),
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

    // Ensure the puzzle exists up front so we don't hit foreign key errors later.
    const puzzleRecord = await prisma.puzzle.findUnique({
      where: { id },
      include: { sudoku: true, solutions: true, parts: true },
    });

    if (!puzzleRecord) {
      return NextResponse.json({ error: "Puzzle not found" }, { status: 404 });
    }

    const debug = process.env.DEBUG_PROGRESS === '1';

    // Debug logging (opt-in): set DEBUG_PROGRESS=1
    let rawBody: any = null;
    try {
      // Parse as text first to sidestep body stream issues on some clients (e.g., curl on Windows)
      const bodyText = await request.text();
      rawBody = bodyText ? JSON.parse(bodyText) : null;
    } catch (e) {
      console.warn('[PROGRESS] failed to parse JSON body', e);
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    if (debug) {
      try {
        const ua = request.headers.get('user-agent') || '<none>';
        const cookiePresent = request.headers.get('cookie') ? 'yes' : 'no';
        console.log(`[PROGRESS] puzzle=${id} user=${user.id} ua="${ua}" cookie=${cookiePresent}`);
        console.log('[PROGRESS] rawBody:', rawBody);
      } catch (e) {
        console.warn('[PROGRESS] failed reading request headers/body', e);
      }
    }

    if (!rawBody || typeof rawBody.action === 'undefined') {
      console.warn('[PROGRESS] Missing request body or action');
      return NextResponse.json({ error: 'Missing action in request body' }, { status: 400 });
    }

    const parsed = UpdateProgressSchema.parse(rawBody || {});
    const action = parsed.action;
    const durationSeconds = typeof parsed.durationSeconds === 'number' ? parsed.durationSeconds : undefined;
    const hintUsed = typeof parsed.hintUsed === 'boolean' ? parsed.hintUsed : undefined;
    const successful = typeof parsed.successful === 'boolean' ? parsed.successful : undefined;

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
        if (progress.currentSessionStart) {
          const now = new Date();
          const computedSeconds = Math.max(
            0,
            Math.floor((now.getTime() - progress.currentSessionStart.getTime()) / 1000)
          );
          const finalDuration = typeof durationSeconds === 'number' ? durationSeconds : computedSeconds;

          await prisma.userPuzzleProgress.update({
            where: { id: progress.id },
            data: {
              totalTimeSpent: progress.totalTimeSpent + finalDuration,
              currentSessionStart: null,
            },
          });

          // Update latest session log (best effort)
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
                sessionEnd: now,
                durationSeconds: finalDuration,
                hintUsed: hintUsed ?? false,
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
        // If this is a Sudoku puzzle, validate the submitted grid against the stored solution
        try {
          const submittedGrid = rawBody.grid;
          if (puzzleRecord?.puzzleType === 'sudoku') {
            if (!Array.isArray(submittedGrid)) {
              console.warn('[PROGRESS] attempt_success missing grid for sudoku');
              return NextResponse.json({ error: 'Missing submitted grid for Sudoku validation' }, { status: 400 });
            }

            let storedSolution: any = null;
            try {
              storedSolution = puzzleRecord.sudoku?.solutionGrid ? JSON.parse(puzzleRecord.sudoku.solutionGrid) : null;
            } catch (e) {
              storedSolution = null;
            }

            if (!Array.isArray(storedSolution)) {
              console.error('[PROGRESS] server missing sudoku solution for puzzle', id);
              return NextResponse.json({ error: 'Server missing Sudoku solution' }, { status: 500 });
            }

            const gridsMatch = (() => {
              for (let r = 0; r < 9; r++) {
                for (let c = 0; c < 9; c++) {
                  const s = Number(storedSolution[r]?.[c] ?? -1);
                  const g = Number(submittedGrid[r]?.[c] ?? -1);
                  if (Number.isNaN(s) || Number.isNaN(g) || s !== g) return false;
                }
              }
              return true;
            })();

            if (!gridsMatch) {
              console.warn('[PROGRESS] submitted sudoku grid does not match solution');
              return NextResponse.json({ error: 'Submitted Sudoku solution does not match' }, { status: 400 });
            }
          }
        } catch (e) {
          console.error('[PROGRESS] error validating sudoku grid', e);
          return NextResponse.json({ error: 'Failed to validate submitted solution' }, { status: 500 });
        }

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

          // Award points for solving the puzzle
          try {
            let awardPoints = 100;
            if (puzzleRecord) {
              if (puzzleRecord.solutions && puzzleRecord.solutions.length > 0) {
                awardPoints = puzzleRecord.solutions[0].points ?? awardPoints;
              } else if (puzzleRecord.parts && puzzleRecord.parts.length > 0) {
                // Sum part point values as a fallback for multi-part puzzles
                awardPoints = puzzleRecord.parts.reduce(
                  (sum: number, part: { pointsValue?: number | null }) => sum + (part.pointsValue ?? 0),
                  0
                ) || awardPoints;
              }
            }

            // Update user's progress points
            await prisma.userPuzzleProgress.update({
              where: { id: progress.id },
              data: { pointsEarned: { increment: awardPoints } },
            });

            // Update or create global leaderboard entry
            const existingLeaderboard = await prisma.globalLeaderboard.findFirst({ where: { userId: user.id } });
            if (existingLeaderboard) {
              await prisma.globalLeaderboard.update({
                where: { id: existingLeaderboard.id },
                data: { totalPoints: { increment: awardPoints } },
              });
            } else {
              await prisma.globalLeaderboard.create({ data: { userId: user.id, totalPoints: awardPoints } });
            }
          } catch (err) {
            console.error('Failed to award points on puzzle success:', err);
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
