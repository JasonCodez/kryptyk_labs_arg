import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { notifyPuzzleRelease } from "@/lib/notification-service";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { role: true },
    });

    if (!user || user.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden: Admin access required" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { title, description, content, category, difficulty, correctAnswer, pointsReward, hints, isMultiPart, parts } = body;

    // Validate input
    if (!title || !description) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate multi-part puzzle
    if (isMultiPart) {
      if (!parts || !Array.isArray(parts) || parts.length < 2) {
        return NextResponse.json(
          { error: "Multi-part puzzles must have at least 2 steps" },
          { status: 400 }
        );
      }
      // Validate all parts have answers
      if (parts.some((p: any) => !p.answer)) {
        return NextResponse.json(
          { error: "All puzzle steps must have answers" },
          { status: 400 }
        );
      }
    } else {
      if (!correctAnswer) {
        return NextResponse.json(
          { error: "Single-part puzzles must have a correct answer" },
          { status: 400 }
        );
      }
    }

    // Validate difficulty value
    const validDifficulties = ["easy", "medium", "hard", "extreme"];
    const puzzleDifficulty = difficulty && validDifficulties.includes(difficulty.toLowerCase()) 
      ? difficulty.toLowerCase() 
      : "medium";

    // Get or create category
    let categoryRecord = await prisma.puzzleCategory.findFirst({
      where: { name: category },
    });

    if (!categoryRecord) {
      categoryRecord = await prisma.puzzleCategory.create({
        data: { name: category },
      });
    }

    // Create puzzle
    const puzzle = await prisma.puzzle.create({
      data: {
        title,
        description,
        content: content || description,
        categoryId: categoryRecord.id,
        difficulty: puzzleDifficulty,
        solutions: isMultiPart ? undefined : {
          create: [
            {
              answer: correctAnswer,
              isCorrect: true,
              points: pointsReward || 100,
              ignoreCase: true,
              ignoreWhitespace: false,
            },
          ],
        },
        parts: isMultiPart ? {
          create: parts.map((part: any, index: number) => ({
            title: part.title,
            description: part.content,
            content: part.content,
            order: index,
            pointsValue: part.points || 50,
            solutions: {
              create: [
                {
                  answer: part.answer,
                  isCorrect: true,
                  points: part.points || 50,
                  ignoreCase: true,
                  ignoreWhitespace: false,
                },
              ],
            },
          }))
        } : undefined,
        hints: hints && hints.length > 0
          ? {
              create: hints.map((hint: string, index: number) => ({
                text: hint,
                order: index,
              })),
            }
          : undefined,
      },
      include: {
        hints: true,
        solutions: true,
        parts: {
          include: {
            solutions: true,
          },
        },
      },
    });

    // Send puzzle release notification if active
    if (puzzle.isActive) {
      const allUsers = await prisma.user.findMany({
        select: { id: true },
      });
      await notifyPuzzleRelease(allUsers.map(u => u.id), {
        puzzleId: puzzle.id,
        puzzleTitle: puzzle.title,
        difficulty: puzzle.difficulty || "MEDIUM",
        points: isMultiPart ? parts.reduce((sum: number, p: any) => sum + (p.points || 50), 0) : (pointsReward || 100),
      });
    }

    return NextResponse.json(puzzle, { status: 201 });
  } catch (error) {
    console.error("Error creating puzzle:", error);
    return NextResponse.json(
      { error: "Failed to create puzzle" },
      { status: 500 }
    );
  }
}
