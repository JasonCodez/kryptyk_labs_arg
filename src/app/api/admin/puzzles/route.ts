import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { notifyPuzzleRelease } from "@/lib/notification-service";

type MultiPartInput = {
  title?: string;
  content?: string;
  answer?: string;
  points?: number;
};

export async function POST(request: NextRequest) {
  try {
    console.log("[PUZZLE CREATE] Request received");
    
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      console.log("[PUZZLE CREATE] Unauthorized - no session");
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
      console.log("[PUZZLE CREATE] Forbidden - not admin");
      return NextResponse.json(
        { error: "Forbidden: Admin access required" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      title,
      description,
      content,
      category,
      difficulty,
      correctAnswer,
      pointsReward,
      hints,
      isMultiPart,
      parts,
      puzzleType,
      sudokuGrid,
      sudokuSolution,
      sudokuDifficulty,
      timeLimitSeconds,
      puzzleData,
    } = body;

    // Validate input - title is required for most puzzle types but optional for Sudoku
    if (!title && puzzleType !== 'sudoku') {
      return NextResponse.json(
        { error: "Missing required field: title" },
        { status: 400 }
      );
    }

    // Description and content are now optional for all puzzle types
    // Use title as fallback if neither is provided
    const puzzleContent = content || description || title || '';
    const puzzleDescription = description || content || title || '';
    // Validate Sudoku puzzle
    if (puzzleType === 'sudoku') {
      if (!sudokuGrid || !sudokuSolution) {
        return NextResponse.json(
          { error: "Sudoku puzzles must have both puzzle and solution grids" },
          { status: 400 }
        );
      }
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
      if ((parts as MultiPartInput[]).some((p: MultiPartInput) => !p?.answer)) {
        return NextResponse.json(
          { error: "All puzzle steps must have answers" },
          { status: 400 }
        );
      }
    } else if (puzzleType !== 'sudoku' && puzzleType !== 'jigsaw') {
      if (!correctAnswer) {
        return NextResponse.json(
          { error: "Single-part puzzles must have a correct answer" },
          { status: 400 }
        );
      }
    }

    // Validate jigsaw puzzle
    if (puzzleType === 'jigsaw') {
      const rows = puzzleData?.gridRows ? Number(puzzleData.gridRows) : 3;
      const cols = puzzleData?.gridCols ? Number(puzzleData.gridCols) : 4;
      const snap = puzzleData?.snapTolerance ? Number(puzzleData.snapTolerance) : 12;

      if (!Number.isFinite(rows) || rows < 2 || rows > 50) {
        return NextResponse.json(
          { error: "Jigsaw puzzles require gridRows between 2 and 50" },
          { status: 400 }
        );
      }

      if (!Number.isFinite(cols) || cols < 2 || cols > 50) {
        return NextResponse.json(
          { error: "Jigsaw puzzles require gridCols between 2 and 50" },
          { status: 400 }
        );
      }

      if (!Number.isFinite(snap) || snap < 1 || snap > 100) {
        return NextResponse.json(
          { error: "snapTolerance must be between 1 and 100" },
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

    // Provide a fallback title for Sudoku puzzles when none is supplied
    const finalTitle = title || (puzzleType === 'sudoku' ? `Sudoku (${(sudokuDifficulty || 'medium').toString().toUpperCase()})` : 'Untitled Puzzle');

    // Create puzzle
    const puzzle = await prisma.puzzle.create({
      data: {
        title: finalTitle,
        description: puzzleDescription,
        content: puzzleContent,
        category: {
          connect: { id: categoryRecord.id }
        },
        difficulty: puzzleDifficulty,
        puzzleType: puzzleType || 'general',
        riddleAnswer: !isMultiPart && puzzleType !== 'sudoku' && puzzleType !== 'jigsaw' ? correctAnswer : undefined,
        jigsaw:
          puzzleType === 'jigsaw'
            ? {
                create: {
                  gridRows: Number(puzzleData?.gridRows) || 3,
                  gridCols: Number(puzzleData?.gridCols) || 4,
                  snapTolerance: Number(puzzleData?.snapTolerance) || 12,
                  rotationEnabled: Boolean(puzzleData?.rotationEnabled),
                  // imageUrl is set automatically when an image is uploaded via /api/admin/media
                },
              }
            : undefined,
        solutions: isMultiPart || puzzleType === 'sudoku' ? undefined : {
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
        parts: isMultiPart
          ? {
              create: (parts as MultiPartInput[]).map((part: MultiPartInput, index: number) => ({
                title: part.title || `Part ${index + 1}`,
                description: part.content || '',
                content: part.content || '',
                order: index,
                pointsValue: part.points || 50,
                solutions: {
                  create: [
                    {
                      answer: part.answer || '',
                      isCorrect: true,
                      points: part.points || 50,
                      ignoreCase: true,
                      ignoreWhitespace: false,
                    },
                  ],
                },
              })),
            }
          : undefined,
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
        jigsaw: true,
      },
    });

    // Create Sudoku puzzle if applicable
    if (puzzleType === 'sudoku' && sudokuGrid && sudokuSolution) {
      // Basic validation for grid shape and values to avoid DB errors
      const validateGrid = (g: any) => {
        if (!Array.isArray(g) || g.length !== 9) return false;
        for (const row of g) {
          if (!Array.isArray(row) || row.length !== 9) return false;
          for (const v of row) {
            if (v === null || typeof v === 'undefined') return false;
            const n = Number(v);
            if (!Number.isFinite(n) || n < 0 || n > 9) return false;
          }
        }
        return true;
      };

      if (!validateGrid(sudokuGrid) || !validateGrid(sudokuSolution)) {
        console.error('[PUZZLE CREATE] Invalid Sudoku grid/solution shape or values');
        return NextResponse.json({ error: 'Invalid Sudoku grid or solution (must be 9x9 numbers 0-9)' }, { status: 400 });
      }
      try {
        // Create without `timeLimitSeconds` to avoid type mismatches in generated Prisma types.
        const baseSudokuData = {
          puzzleId: puzzle.id,
          puzzleGrid: typeof sudokuGrid === 'string' ? sudokuGrid : JSON.stringify(sudokuGrid),
          solutionGrid: typeof sudokuSolution === 'string' ? sudokuSolution : JSON.stringify(sudokuSolution),
          difficulty: sudokuDifficulty || 'medium',
        };

        const created = await prisma.sudokuPuzzle.create({
          data: baseSudokuData,
        });

        // If a time limit was provided, apply it in a separate update (best-effort, type-safe).
        if (typeof timeLimitSeconds !== 'undefined' && timeLimitSeconds !== null) {
          try {
            await prisma.sudokuPuzzle.update({
              where: { id: created.id },
              data: { timeLimitSeconds: Number(timeLimitSeconds) } as Prisma.SudokuPuzzleUpdateInput,
            });
          } catch (updErr) {
            console.warn('[PUZZLE CREATE] Failed to set timeLimitSeconds on sudoku record:', updErr);
          }
        }
      } catch (sudokuError) {
        console.error("Error creating Sudoku puzzle record:", sudokuError);
        return NextResponse.json({ error: "Failed to store Sudoku puzzle data", details: String(sudokuError) }, { status: 500 });
      }
    }

    console.log(`[PUZZLE CREATE] Puzzle created: ${puzzle.id}, type: ${puzzle.puzzleType}`);
    if (puzzle.puzzleType === 'jigsaw') {
      console.log(`[PUZZLE CREATE] Jigsaw puzzle created, checking jigsaw record...`);
      const jigsawRecord = await prisma.jigsawPuzzle.findUnique({
        where: { puzzleId: puzzle.id },
      });
      console.log(`[PUZZLE CREATE] Jigsaw record:`, jigsawRecord);
    }

    // Send puzzle release notification if active
    if (puzzle.isActive) {
      const allUsers = await prisma.user.findMany({
        select: { id: true },
      });

      const totalPoints =
        isMultiPart && Array.isArray(parts)
          ? (parts as MultiPartInput[]).reduce((sum: number, p: MultiPartInput) => sum + (p.points || 50), 0)
          : (pointsReward || 100);

      await notifyPuzzleRelease(allUsers.map((u: { id: string }) => u.id), {
        puzzleId: puzzle.id,
        puzzleTitle: puzzle.title,
        difficulty: puzzle.difficulty || "MEDIUM",
        points: totalPoints,
      });
    }

    return NextResponse.json(puzzle, { status: 201 });
  } catch (error) {
    console.error("Error creating puzzle:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to create puzzle";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
