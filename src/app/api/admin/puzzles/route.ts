import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { notifyPuzzleRelease } from "@/lib/notification-service";
import { getDetectiveCaseData } from "@/lib/detectiveCase";
import { getGridlockFileData } from "@/lib/gridlockFile";
import { getParasiteCodeData } from "@/lib/parasiteCode";
import { getVaultPuzzleData } from "@/lib/vault";
import { validateWordSearchPuzzleData } from "@/lib/wordSearchCore";
import { validateCrosswordPuzzleData } from "@/lib/crosswordCore";

type MultiPartInput = {
  title?: string;
  content?: string;
  answer?: string;
  points?: number;
};

export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { role: true },
    });
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const puzzles = await prisma.puzzle.findMany({
      select: {
        id: true,
        title: true,
        puzzleType: true,
        difficulty: true,
        isActive: true,
        isWarzExclusive: true,
        createdAt: true,
        category: { select: { name: true } },
        escapeRoom: { select: { roomTitle: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(puzzles);
  } catch (error) {
    console.error("[PUZZLE LIST] Error:", error);
    return NextResponse.json({ error: "Failed to fetch puzzles" }, { status: 500 });
  }
}

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
    let {
      title,
      description,
      content,
      category,
      difficulty,
      correctAnswer,
      pointsReward,
      xpReward,
      hints,
      isMultiPart,
      parts,
      puzzleType,
      sudokuGrid,
      sudokuSolution,
      sudokuDifficulty,
      timeLimitSeconds,
      puzzleData,
      isWarzExclusive,
      isActive,
      gridlockReleaseAt,
      debriefReleaseAt,
    } = body;

    // Validate input - title is required for most puzzle types but optional for Sudoku, Escape Room, and WordScry
    if (!title && puzzleType !== 'sudoku' && puzzleType !== 'escape_room' && puzzleType !== 'jim_wyze_case' && puzzleType !== 'word_crack' && puzzleType !== 'word_search' && puzzleType !== 'anagram_blitz' && puzzleType !== 'arg' && puzzleType !== 'vault' && puzzleType !== 'cipher_clash') {
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
    }

    // Validate detective case configuration (stage-based validation, fail-once lockout)
    if (puzzleType === 'detective_case') {
      const dc = getDetectiveCaseData(puzzleData);
      if (!dc) {
        return NextResponse.json(
          { error: "Detective Case puzzles require puzzleData.detectiveCase with at least 1 stage" },
          { status: 400 }
        );
      }
    }

    if (puzzleType === 'word_search') {
      const ws = validateWordSearchPuzzleData(puzzleData);
      if (!ws.valid || !ws.normalized) {
        return NextResponse.json(
          { error: ws.error ?? 'Word Search puzzleData is invalid.' },
          { status: 400 }
        );
      }

      puzzleData = {
        ...(puzzleData as Record<string, unknown>),
        grid: ws.normalized.grid,
        words: ws.normalized.words,
        unplacedWords: [],
      };
    }

    if (puzzleType === 'crossword') {
      const cw = validateCrosswordPuzzleData(puzzleData, {
        requireAnswers: true,
        enforceStyle: false,
      });

      if (!cw.valid || !cw.normalized) {
        return NextResponse.json(
          { error: cw.error ?? 'Crossword puzzleData is invalid.' },
          { status: 400 }
        );
      }

      puzzleData = {
        ...(puzzleData as Record<string, unknown>),
        clues: {
          across: cw.normalized.clues.across.map((clue) => ({
            number: clue.number,
            text: clue.text,
            answer: clue.answer ?? '',
            length: clue.length,
            row: clue.row,
            col: clue.col,
          })),
          down: cw.normalized.clues.down.map((clue) => ({
            number: clue.number,
            text: clue.text,
            answer: clue.answer ?? '',
            length: clue.length,
            row: clue.row,
            col: clue.col,
          })),
        },
        rows: cw.normalized.rows,
        cols: cw.normalized.cols,
        blackSquareRatio: Number(cw.normalized.blackSquareRatio.toFixed(4)),
      };
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

    if (puzzleType === 'gridlock_file') {
      const parsed = getGridlockFileData(puzzleData);
      if (!parsed) {
        return NextResponse.json(
          { error: 'Gridlock File puzzles require puzzleData.gridlockFile with valid grid, correctAnswers, ruleExplanation, and rule metadata' },
          { status: 400 }
        );
      }
    }

    if (puzzleType === 'parasite_code') {
      const parsed = getParasiteCodeData(puzzleData);
      if (!parsed) {
        return NextResponse.json(
          { error: 'Parasite Code puzzles require puzzleData.parasiteCode with case metadata, program, parasiteLineIds, and testInputs' },
          { status: 400 }
        );
      }
    }

    const vaultData = puzzleType === 'vault' ? getVaultPuzzleData(puzzleData) : null;
    if (puzzleType === 'vault' && !vaultData) {
      return NextResponse.json(
        { error: 'Vault puzzles require puzzleData.vault with a valid 3x3 configuration.' },
        { status: 400 }
      );
    }

    // Validate difficulty value
    // For sudoku puzzles, the canonical difficulty comes from sudokuDifficulty (set in the
    // generator), not the generic difficulty field which defaults to 'medium' in the form.
    const validDifficulties = ["easy", "medium", "hard", "expert", "extreme"];
    const puzzleDifficulty =
      puzzleType === 'sudoku' && sudokuDifficulty && validDifficulties.includes(sudokuDifficulty.toLowerCase())
        ? sudokuDifficulty.toLowerCase()
        : (difficulty && validDifficulties.includes(difficulty.toLowerCase())
          ? difficulty.toLowerCase()
          : "medium");

    // Normalise snake_case category values coming from the admin dropdown to display names
    const CATEGORY_DISPLAY_NAMES: Record<string, string> = {
      word_crack:    'Hidden Word',
      word_search:   'Word Search',
      anagram_blitz: 'Anagram Blitz',
      crack_safe:    'Crack Safe',
      detective_case:'Detective Case',
      escape_room:   'Escape Room',
      jim_wyze_case: 'Jim Wyze Case',
      gridlock_file: 'Gridlock File',
      parasite_code: 'Parasite Code',
      crime_rpg:     'Crime RPG',
      code_master:   'Code Master',
      debrief:       'The Debrief',
      cipher_clash:  'Cipher Clash',
      anagram_blitz_blitz: 'Anagram Blitz',
    };
    const resolvedCategory = CATEGORY_DISPLAY_NAMES[category] ?? category;

    // Get or create category
    let categoryRecord = await prisma.puzzleCategory.findFirst({
      where: { name: resolvedCategory },
    });

    if (!categoryRecord) {
      categoryRecord = await prisma.puzzleCategory.create({
        data: { name: resolvedCategory },
      });
    }

    // Provide a fallback title when none is supplied
    const finalTitle = title ||
      (puzzleType === 'sudoku' ? `Sudoku (${(sudokuDifficulty || 'medium').toString().toUpperCase()})` :
      puzzleType === 'word_crack' ? 'Hidden Word' :
      puzzleType === 'word_search' ? 'Word Search' :
      puzzleType === 'anagram_blitz' ? 'Anagram Blitz' :
      puzzleType === 'arg' ? 'ARG' :
      puzzleType === 'jim_wyze_case' ? 'Jim Wyze Case' :
      puzzleType === 'vault' ? 'The Vault' :
      puzzleType === 'cipher_clash' ? 'Cipher Clash' :
      'Untitled Puzzle');

    // Create puzzle
    const createData: any = {
      title: finalTitle,
      description: puzzleDescription,
      content: puzzleContent,
      category: {
        connect: { id: categoryRecord.id }
      },
      difficulty: puzzleDifficulty,
      puzzleType: puzzleType || 'general',
      xpReward: typeof xpReward === 'number' && xpReward > 0 ? xpReward : 50,
      isWarzExclusive: isWarzExclusive === true,
      ...(puzzleType === 'escape_room'
        ? {
            isTeamPuzzle: true,
            // Escape rooms created from the admin maker should be immediately playable.
            // Allow explicit override via payload when needed.
            isActive: typeof isActive === 'boolean' ? isActive : true,
            minTeamSize: (() => { const v = puzzleData?.minTeamSize ?? (puzzleData as any)?.escapeRoomData?.minTeamSize; return (typeof v === 'number' && v > 0) ? v : 1; })(),
          }
        : puzzleType === 'jim_wyze_case'
          ? {
              isTeamPuzzle: false,
              isActive: typeof isActive === 'boolean' ? isActive : true,
              minTeamSize: 1,
            }
        : {}),
      riddleAnswer: !isMultiPart && puzzleType !== 'sudoku' && puzzleType !== 'jigsaw' && puzzleType !== 'escape_room' && puzzleType !== 'jim_wyze_case' && puzzleType !== 'code_master' && puzzleType !== 'detective_case' && puzzleType !== 'crime_rpg' && puzzleType !== 'blackout' && puzzleType !== 'gridlock_file' && puzzleType !== 'debrief' && puzzleType !== 'parasite_code' && puzzleType !== 'crossword' && puzzleType !== 'vault' && puzzleType !== 'cipher_clash' ? correctAnswer : undefined,
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
      solutions: isMultiPart || puzzleType === 'sudoku' || puzzleType === 'jigsaw' || puzzleType === 'escape_room' || puzzleType === 'jim_wyze_case' || puzzleType === 'code_master' || puzzleType === 'detective_case' || puzzleType === 'crime_rpg' || puzzleType === 'crack_safe' || puzzleType === 'gridlock_file' || puzzleType === 'debrief' || puzzleType === 'parasite_code' || puzzleType === 'crossword' || puzzleType === 'cipher_clash' ? undefined : {
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
            create: hints.map((hint: string | { text: string; costPoints?: number }, index: number) => {
              const text = typeof hint === 'string' ? hint : hint.text;
              const costPoints = typeof hint === 'string' ? 10 : (hint.costPoints ?? 10);
              return { text, order: index, costPoints };
            }),
          }
        : undefined,
    };

    if ((puzzleType === 'escape_room' || puzzleType === 'jim_wyze_case' || puzzleType === 'code_master' || puzzleType === 'detective_case' || puzzleType === 'crime_rpg' || puzzleType === 'crack_safe' || puzzleType === 'word_crack' || puzzleType === 'word_search' || puzzleType === 'anagram_blitz' || puzzleType === 'arg' || puzzleType === 'blackout' || puzzleType === 'gridlock_file' || puzzleType === 'debrief' || puzzleType === 'crossword' || puzzleType === 'vault' || puzzleType === 'parasite_code' || puzzleType === 'cipher_clash') && typeof puzzleData !== 'undefined') {
      createData.data = puzzleData;
    }
    // Persist jigsaw shape params (piece designer) into puzzle.data JSON
    if (puzzleType === 'jigsaw' && puzzleData) {
      const shapeData: Record<string, unknown> = {};
      if (typeof puzzleData.pieceExtFrac       === 'number') shapeData.pieceExtFrac       = puzzleData.pieceExtFrac;
      if (typeof puzzleData.pieceRFrac         === 'number') shapeData.pieceRFrac         = puzzleData.pieceRFrac;
      if (typeof puzzleData.pieceNHalfFrac     === 'number') shapeData.pieceNHalfFrac     = puzzleData.pieceNHalfFrac;
      if (typeof puzzleData.pieceShoulderStart === 'number') shapeData.pieceShoulderStart = puzzleData.pieceShoulderStart;
      if (Object.keys(shapeData).length > 0) createData.data = shapeData;
    }

    // Detective cases are validated stage-by-stage; we still create a solution row to carry points.
    if (puzzleType === 'detective_case') {
      createData.solutions = {
        create: [
          {
            answer: '__DETECTIVE_CASE__',
            isCorrect: true,
            points: pointsReward || 100,
            ignoreCase: true,
            ignoreWhitespace: false,
          },
        ],
      };
    }

    if (puzzleType === 'jim_wyze_case') {
      createData.solutions = {
        create: [
          {
            answer: '__JIM_WYZE_CASE__',
            isCorrect: true,
            points: pointsReward || 100,
            ignoreCase: true,
            ignoreWhitespace: false,
          },
        ],
      };
    }

    // Crack the safe: code is stored in data.safecode; create a placeholder solution row for points.
    if (puzzleType === 'crack_safe') {
      createData.solutions = {
        create: [
          {
            answer: '__CRACK_SAFE__',
            isCorrect: true,
            points: pointsReward || 100,
            ignoreCase: true,
            ignoreWhitespace: false,
          },
        ],
      };
    }

    if (puzzleType === 'vault' && vaultData) {
      createData.data = { vault: vaultData };
      createData.riddleAnswer = vaultData.finalCode;
      createData.solutions = {
        create: [
          {
            answer: '__VAULT__',
            isCorrect: true,
            points: pointsReward || 100,
            ignoreCase: true,
            ignoreWhitespace: false,
          },
        ],
      };
    }

    const puzzle = await prisma.puzzle.create({
      data: createData,
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

    // If this is an escape-canvas puzzle, persist rooms/stages/layouts/hotspots (+ item definitions)
    // Note: the designer payload stores items/zones under puzzleData.escapeRoomData.scenes.
    if ((puzzle.puzzleType === 'escape_room' || puzzle.puzzleType === 'jim_wyze_case') && puzzleData && Array.isArray(puzzleData.rooms)) {
      try {
        // Create escape room and related records in a transaction
        const rooms = puzzleData.rooms as any[];
        await prisma.$transaction(async (tx) => {
          const isJimWyze = puzzle.puzzleType === 'jim_wyze_case';
          const escapeRoom = await tx.escapeRoomPuzzle.create({
            data: {
              puzzleId: puzzle.id,
              roomTitle: puzzleData.roomTitle || (puzzle.title || 'Escape Room'),
              roomDescription: puzzleData.roomDescription || (puzzle.description || ''),
              timeLimitSeconds: typeof puzzleData.timeLimitSeconds !== 'undefined' && puzzleData.timeLimitSeconds !== null ? Number(puzzleData.timeLimitSeconds) : undefined,
              minTeamSize: isJimWyze ? 1 : (() => { const v = puzzleData?.minTeamSize ?? (puzzleData as any)?.escapeRoomData?.minTeamSize; return (typeof v === 'number' && v > 0) ? v : 1; })(),
              maxTeamSize: isJimWyze ? 1 : ((typeof puzzleData.maxTeamSize === 'number' && puzzleData.maxTeamSize > 0) ? puzzleData.maxTeamSize : 8),
            },
          });

          // Persist ItemDefinitions from designer scenes so collectible hotspots can resolve to real DB items.
          // Hotspots use targetId = ItemDefinition.id.
          const itemIdToDefinitionId = new Map<string, string>();
          try {
            const d: any = (puzzleData as any).escapeRoomData;
            const scenes: any[] = Array.isArray(d?.scenes) ? d.scenes : [];
            const seenItemIds = new Set<string>();
            for (const scene of scenes) {
              const items: any[] = Array.isArray(scene?.items) ? scene.items : [];
              for (const it of items) {
                const itemId = typeof it?.id === 'string' ? it.id : null;
                if (!itemId || seenItemIds.has(itemId)) continue;
                seenItemIds.add(itemId);

                const created = await tx.itemDefinition.create({
                  data: {
                    escapeRoomId: escapeRoom.id,
                    // ItemDefinition.key is globally unique; prefix with escapeRoom id.
                    key: `item_${escapeRoom.id}_${itemId}`,
                    name: (typeof it?.name === 'string' && it.name.trim()) ? it.name.trim() : 'Item',
                    description: typeof it?.description === 'string' ? it.description : null,
                    imageUrl: typeof it?.imageUrl === 'string' ? it.imageUrl : null,
                    consumable: true,
                  },
                });
                itemIdToDefinitionId.set(itemId, created.id);
              }
            }
          } catch (itemErr) {
            // Non-fatal: escape room can still function without collectible items.
            console.warn('[PUZZLE CREATE] Failed to persist escape-room item definitions:', itemErr);
          }

          let stageOrder = 1;
          for (const r of rooms) {
            // Persist layout if present
            if (r.layout) {
              const layout = r.layout;
              const createdLayout = await tx.roomLayout.create({
                data: {
                  escapeRoomId: escapeRoom.id,
                  title: layout.title || null,
                  backgroundUrl: layout.backgroundUrl || null,
                  width: layout.width ? Number(layout.width) : null,
                  height: layout.height ? Number(layout.height) : null,
                },
              });

              // Persist hotspots if provided
              if (Array.isArray(layout.hotspots)) {
                for (const hs of layout.hotspots) {
                  // If the client provided a designer item id (collectItemId), map it to ItemDefinition.id.
                  let targetId: string | null = hs.targetId || null;
                  if (targetId && itemIdToDefinitionId.has(targetId)) {
                    targetId = itemIdToDefinitionId.get(targetId) || null;
                  }

                  await tx.hotspot.create({
                    data: {
                      layoutId: createdLayout.id,
                      x: Number(hs.x) || 0,
                      y: Number(hs.y) || 0,
                      w: Number(hs.w) || 32,
                      h: Number(hs.h) || 32,
                      type: hs.type || 'interactive',
                      targetId,
                      meta: hs.meta ? (typeof hs.meta === 'string' ? hs.meta : JSON.stringify(hs.meta)) : null,
                    },
                  });
                }
              }
            }

            // Persist stages for this room
            if (Array.isArray(r.stages)) {
              for (const s of r.stages) {
                await tx.escapeStage.create({
                  data: {
                    escapeRoomId: escapeRoom.id,
                    order: stageOrder++,
                    title: s.title || `Stage ${stageOrder}`,
                    description: s.description || '',
                    puzzleType: s.puzzleType || 'text',
                    puzzleData: s.puzzleData && typeof s.puzzleData !== 'string' ? JSON.stringify(s.puzzleData) : (s.puzzleData || '{}'),
                    correctAnswer: s.correctAnswer || '',
                    hints: s.hints && Array.isArray(s.hints) ? JSON.stringify(s.hints) : (s.hints || '[]'),
                    rewardItem: s.rewardItem || null,
                    rewardDescription: s.rewardDescription || null,
                  },
                });
              }
            }
          }
        });
      } catch (roomErr) {
        console.error('[PUZZLE CREATE] Failed to persist escape-room rooms/stages:', roomErr);
      }
    }

    // Gridlock files only join the daily rotation when explicitly scheduled.
    if (puzzle.puzzleType === 'gridlock_file' && gridlockReleaseAt) {
      const releaseAt = new Date(gridlockReleaseAt);
      await prisma.puzzleSchedule.upsert({
        where: { puzzleId: puzzle.id },
        create: { puzzleId: puzzle.id, releaseAt, schedulingType: 'scheduled' },
        update: { releaseAt, schedulingType: 'scheduled' },
      });
    }
    // Upsert PuzzleSchedule.releaseAt for debrief puzzles
    if (puzzle.puzzleType === 'debrief') {
      const releaseAt = debriefReleaseAt ? new Date(debriefReleaseAt) : new Date();
      await prisma.puzzleSchedule.upsert({
        where: { puzzleId: puzzle.id },
        create: { puzzleId: puzzle.id, releaseAt, schedulingType: 'scheduled' },
        update: { releaseAt },
      });
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

    // Return puzzle; re-fetch to include any nested records (e.g., sudoku, jigsaw)
    try {
      const fullPuzzle = await prisma.puzzle.findUnique({
        where: { id: puzzle.id },
        include: {
          hints: true,
          media: true,
          sudoku: true,
          jigsaw: true,
          parts: true,
          category: true,
        },
      });
      return NextResponse.json(fullPuzzle || puzzle, { status: 201 });
    } catch (e) {
      console.warn('[PUZZLE CREATE] Failed to re-fetch full puzzle payload:', e);
      return NextResponse.json(puzzle, { status: 201 });
    }
  } catch (error) {
    console.error("Error creating puzzle:", error);
    return NextResponse.json(
      {
        error: "Failed to create puzzle",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
