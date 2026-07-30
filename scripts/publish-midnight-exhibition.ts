/**
 * Controlled, idempotent publisher for The Midnight Exhibition Logic Grid case.
 *
 * This is the only script authorized to publish this specific case. It never trusts the
 * authored answer key on its own — every mode re-runs `validateLogicGridForPublication`
 * (which itself proves uniqueness purely from the puzzle's own structured clues) before
 * touching the database.
 *
 * Modes (exactly one required):
 *   --dry-run    Validate the frozen draft only. No database connection, no writes.
 *   --stage      Create or update the puzzle record as an inactive, unlisted staged record.
 *   --activate   Flip an already-staged, already-validated record to isActive: true.
 *
 * Optional safety flag:
 *   --allow-remote   Required before --stage/--activate will touch a non-local database.
 *
 * Run: npx tsx scripts/publish-midnight-exhibition.ts --dry-run
 */

import path from "path";
import { config } from "dotenv";

config({ path: path.resolve(process.cwd(), ".env.local") });
config({ path: path.resolve(process.cwd(), ".env") });

import { PrismaClient, Prisma } from "@prisma/client";
import {
  MIDNIGHT_EXHIBITION_TITLE,
  MIDNIGHT_EXHIBITION_MYSTERY_QUESTION,
  MIDNIGHT_EXHIBITION_DRAFT_DATA,
  MIDNIGHT_EXHIBITION_EXPECTED_SOLUTION,
} from "../src/lib/logicGridDrafts/midnightExhibition";
import {
  LOGIC_GRID_PLACEHOLDER_ANSWER,
  validateLogicGridForPublication,
} from "../src/lib/logicGridPublishing";

const PUBLICATION_CATEGORY_NAME = "Logic Grid";
const PUBLICATION_PUZZLE_TYPE = "logic_grid";
const PUBLICATION_DIFFICULTY = "hard";
const PUBLICATION_POINTS = 200;
const PUBLICATION_XP_REWARD = 120;
const PUBLICATION_DESCRIPTION = MIDNIGHT_EXHIBITION_MYSTERY_QUESTION;
const PUBLICATION_CONTENT =
  "At 9:35 p.m., the curator of the Midnight Exhibition discovered that the Silver Key had vanished from its display. Four guests had entered four different rooms at different times, each carrying one unusual object. Determine who entered the Vault carrying the stolen Silver Key.";

type Mode = "dry-run" | "stage" | "activate";

function printUsageAndExit(message?: string): never {
  if (message) console.error(`Error: ${message}`);
  console.error(
    [
      "",
      "Usage: npx tsx scripts/publish-midnight-exhibition.ts <mode> [--allow-remote]",
      "",
      "Modes (exactly one required):",
      "  --dry-run    Validate the frozen draft only. No database connection, no writes.",
      "  --stage      Create or update the inactive, unlisted staged record.",
      "  --activate   Flip an already-staged record to isActive: true.",
      "",
      "Optional:",
      "  --allow-remote   Required before --stage/--activate may write to a non-local database.",
      "",
    ].join("\n")
  );
  process.exit(1);
}

function parseArgs(argv: string[]): { mode: Mode; allowRemote: boolean } {
  const knownFlags = new Set(["--dry-run", "--stage", "--activate", "--allow-remote"]);
  const unknown = argv.filter((a) => !knownFlags.has(a));
  if (unknown.length > 0) {
    printUsageAndExit(`Unknown flag(s): ${unknown.join(", ")}`);
  }

  const modes = argv.filter((a) => a === "--dry-run" || a === "--stage" || a === "--activate");
  if (modes.length === 0) printUsageAndExit("No mode supplied.");
  if (modes.length > 1) printUsageAndExit(`Multiple modes supplied: ${modes.join(", ")}`);

  const mode = modes[0].replace(/^--/, "") as Mode;
  const allowRemote = argv.includes("--allow-remote");
  return { mode, allowRemote };
}

/**
 * Determines whether `DATABASE_URL` clearly targets local development infrastructure, without
 * ever printing the URL itself (which may contain credentials).
 */
function isLocalDatabaseUrl(databaseUrl: string | undefined): boolean {
  if (!databaseUrl || databaseUrl.trim().length === 0) return false;
  const url = databaseUrl.trim();
  if (url.startsWith("file:")) return true;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    // Malformed URLs are treated as unsafe/non-local rather than silently allowed.
    return false;
  }
}

function assertPermittedDatabase(allowRemote: boolean): void {
  const databaseUrl = process.env.DATABASE_URL;
  const local = isLocalDatabaseUrl(databaseUrl);
  if (local) return;
  if (allowRemote) {
    console.log("--allow-remote supplied: proceeding against a non-local database target.");
    return;
  }
  printUsageAndExit(
    "DATABASE_URL does not clearly target local development infrastructure (localhost/127.0.0.1/file:). " +
      "Re-run with --allow-remote only if you intend to write to that database."
  );
}

function runOfflineValidation(): ReturnType<typeof validateLogicGridForPublication> & {
  witnessMatchesExpected?: boolean;
} {
  const result = validateLogicGridForPublication(MIDNIGHT_EXHIBITION_DRAFT_DATA);
  if (!result.valid) return result;
  const witnessMatchesExpected =
    JSON.stringify(result.witness) === JSON.stringify(MIDNIGHT_EXHIBITION_EXPECTED_SOLUTION);
  return { ...result, witnessMatchesExpected };
}

function clueCount(): number {
  const clues = (MIDNIGHT_EXHIBITION_DRAFT_DATA as { clues: unknown[] }).clues;
  return Array.isArray(clues) ? clues.length : 0;
}

async function runDryRun(): Promise<void> {
  console.log(`Validating draft: ${MIDNIGHT_EXHIBITION_TITLE}`);
  const result = runOfflineValidation();

  if (!result.valid) {
    console.error(`Validation FAILED: ${result.error}`);
    if ("uniquenessStatus" in result && result.uniquenessStatus) {
      console.error(`Uniqueness status: ${result.uniquenessStatus}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`Title: ${MIDNIGHT_EXHIBITION_TITLE}`);
  console.log(`Clue count: ${clueCount()}`);
  console.log("Status: unique");
  console.log(`Witness matches expected solution: ${result.witnessMatchesExpected}`);
  console.log("Expected route format once staged: /puzzles/<id>");
  console.log("(dry-run: no database connection was made, no writes were performed)");

  if (!result.witnessMatchesExpected) {
    console.error("The unique witness does not match the frozen expected solution.");
    process.exitCode = 1;
  }
}

async function findMatchingPuzzles(prisma: PrismaClient) {
  return prisma.puzzle.findMany({
    where: { title: MIDNIGHT_EXHIBITION_TITLE, puzzleType: PUBLICATION_PUZZLE_TYPE },
    include: { solutions: true, dailySlots: true },
  });
}

async function runStage(allowRemote: boolean): Promise<void> {
  const validation = runOfflineValidation();
  if (!validation.valid) {
    console.error(`Validation FAILED: ${validation.error}`);
    process.exitCode = 1;
    return;
  }
  if (!validation.witnessMatchesExpected) {
    console.error("The unique witness does not match the frozen expected solution. Refusing to stage.");
    process.exitCode = 1;
    return;
  }

  assertPermittedDatabase(allowRemote);

  const prisma = new PrismaClient();
  try {
    const matches = await findMatchingPuzzles(prisma);
    if (matches.length > 1) {
      console.error(
        `Found ${matches.length} existing records matching title/puzzleType — refusing to guess which one to update. ` +
          "Resolve the duplicate manually before staging."
      );
      process.exitCode = 1;
      return;
    }

    const existing = matches[0];
    if (existing && existing.dailySlots.length > 0) {
      console.error(
        "The matching record already has a daily-slot assignment — refusing to stage over existing scheduling data."
      );
      process.exitCode = 1;
      return;
    }

    const normalizedData = {
      intro: validation.normalized.intro,
      categories: validation.normalized.categories,
      clues: validation.normalized.clues,
      solution: validation.normalized.solution,
    };

    const puzzleId = await prisma.$transaction(async (tx) => {
      let category = await tx.puzzleCategory.findFirst({ where: { name: PUBLICATION_CATEGORY_NAME } });
      if (!category) {
        category = await tx.puzzleCategory.create({ data: { name: PUBLICATION_CATEGORY_NAME } });
      }

      const puzzle = existing
        ? await tx.puzzle.update({
            where: { id: existing.id },
            data: {
              title: MIDNIGHT_EXHIBITION_TITLE,
              description: PUBLICATION_DESCRIPTION,
              content: PUBLICATION_CONTENT,
              categoryId: category.id,
              difficulty: PUBLICATION_DIFFICULTY,
              puzzleType: PUBLICATION_PUZZLE_TYPE,
              xpReward: PUBLICATION_XP_REWARD,
              isWarzExclusive: false,
              order: 0,
              isBossPuzzle: false,
              isActive: false,
              riddleAnswer: null,
              data: normalizedData as unknown as Prisma.InputJsonValue,
            },
          })
        : await tx.puzzle.create({
            data: {
              title: MIDNIGHT_EXHIBITION_TITLE,
              description: PUBLICATION_DESCRIPTION,
              content: PUBLICATION_CONTENT,
              categoryId: category.id,
              difficulty: PUBLICATION_DIFFICULTY,
              puzzleType: PUBLICATION_PUZZLE_TYPE,
              xpReward: PUBLICATION_XP_REWARD,
              isWarzExclusive: false,
              order: 0,
              isBossPuzzle: false,
              isActive: false,
              riddleAnswer: null,
              data: normalizedData as unknown as Prisma.InputJsonValue,
            },
          });

      const existingSolutions = await tx.puzzleSolution.findMany({ where: { puzzleId: puzzle.id } });
      const placeholder = existingSolutions.find((s) => s.answer === LOGIC_GRID_PLACEHOLDER_ANSWER);
      const stray = existingSolutions.filter((s) => s.answer !== LOGIC_GRID_PLACEHOLDER_ANSWER);
      for (const s of stray) {
        await tx.puzzleSolution.delete({ where: { id: s.id } });
      }
      if (placeholder) {
        await tx.puzzleSolution.update({
          where: { id: placeholder.id },
          data: { points: PUBLICATION_POINTS, isCorrect: true, ignoreCase: true, ignoreWhitespace: false },
        });
      } else {
        await tx.puzzleSolution.create({
          data: {
            puzzleId: puzzle.id,
            answer: LOGIC_GRID_PLACEHOLDER_ANSWER,
            isCorrect: true,
            points: PUBLICATION_POINTS,
            ignoreCase: true,
            ignoreWhitespace: false,
          },
        });
      }

      await tx.dailyPuzzleSlot.deleteMany({ where: { puzzleId: puzzle.id } });

      return puzzle.id;
    });

    console.log(`Puzzle ID: ${puzzleId}`);
    console.log("Active: false");
    console.log(`Route: /puzzles/${puzzleId}`);
    console.log("This record is staged and unlisted (inactive) — it will not appear in the public catalog.");
  } finally {
    await prisma.$disconnect();
  }
}

async function runActivate(allowRemote: boolean): Promise<void> {
  const validation = runOfflineValidation();
  if (!validation.valid) {
    console.error(`Source draft validation FAILED: ${validation.error}`);
    process.exitCode = 1;
    return;
  }
  if (!validation.witnessMatchesExpected) {
    console.error("The unique witness does not match the frozen expected solution. Refusing to activate.");
    process.exitCode = 1;
    return;
  }

  assertPermittedDatabase(allowRemote);

  const prisma = new PrismaClient();
  try {
    const matches = await findMatchingPuzzles(prisma);
    if (matches.length === 0) {
      console.error("No staged record found. Run --stage first.");
      process.exitCode = 1;
      return;
    }
    if (matches.length > 1) {
      console.error(
        `Found ${matches.length} existing records matching title/puzzleType — refusing to guess which one to activate.`
      );
      process.exitCode = 1;
      return;
    }

    const record = matches[0];

    const storedValidation = validateLogicGridForPublication(record.data);
    if (!storedValidation.valid) {
      console.error(`Stored data failed publication validation: ${storedValidation.error}`);
      process.exitCode = 1;
      return;
    }

    const storedData = record.data as {
      intro?: unknown;
      categories?: unknown;
      clues?: unknown;
      solution?: unknown;
    } | null;

    const draftJson = JSON.stringify({
      intro: (MIDNIGHT_EXHIBITION_DRAFT_DATA as { intro: unknown }).intro,
      categories: (MIDNIGHT_EXHIBITION_DRAFT_DATA as { categories: unknown }).categories,
      clues: (MIDNIGHT_EXHIBITION_DRAFT_DATA as { clues: unknown }).clues,
    });
    const storedJson = JSON.stringify({
      intro: storedValidation.normalized.intro,
      categories: storedValidation.normalized.categories,
      clues: storedValidation.normalized.clues,
    });

    if (draftJson !== storedJson) {
      console.error("Stored intro/categories/clues no longer match the frozen source draft. Refusing to activate.");
      process.exitCode = 1;
      return;
    }

    if (JSON.stringify(storedValidation.normalized.solution) !== JSON.stringify(MIDNIGHT_EXHIBITION_EXPECTED_SOLUTION)) {
      console.error("Stored solution no longer matches the frozen expected solution. Refusing to activate.");
      process.exitCode = 1;
      return;
    }

    if (JSON.stringify(storedValidation.witness) !== JSON.stringify(MIDNIGHT_EXHIBITION_EXPECTED_SOLUTION)) {
      console.error("Stored data's clue-derived witness no longer matches the expected solution. Refusing to activate.");
      process.exitCode = 1;
      return;
    }

    if (record.difficulty !== PUBLICATION_DIFFICULTY) {
      console.error(`Expected difficulty "${PUBLICATION_DIFFICULTY}", found "${record.difficulty}". Refusing to activate.`);
      process.exitCode = 1;
      return;
    }
    if (record.xpReward !== PUBLICATION_XP_REWARD) {
      console.error(`Expected xpReward ${PUBLICATION_XP_REWARD}, found ${record.xpReward}. Refusing to activate.`);
      process.exitCode = 1;
      return;
    }

    const category = await prisma.puzzleCategory.findUnique({ where: { id: record.categoryId } });
    if (!category || category.name !== PUBLICATION_CATEGORY_NAME) {
      console.error(`Expected category "${PUBLICATION_CATEGORY_NAME}", found "${category?.name}". Refusing to activate.`);
      process.exitCode = 1;
      return;
    }

    const placeholder = record.solutions.find((s) => s.answer === LOGIC_GRID_PLACEHOLDER_ANSWER);
    if (!placeholder) {
      console.error(`No "${LOGIC_GRID_PLACEHOLDER_ANSWER}" placeholder solution row found. Refusing to activate.`);
      process.exitCode = 1;
      return;
    }
    if (placeholder.points !== PUBLICATION_POINTS) {
      console.error(`Expected placeholder points ${PUBLICATION_POINTS}, found ${placeholder.points}. Refusing to activate.`);
      process.exitCode = 1;
      return;
    }

    if (record.dailySlots.length > 0) {
      console.error("Record has a daily-slot assignment. Refusing to activate.");
      process.exitCode = 1;
      return;
    }

    const activated = await prisma.puzzle.update({
      where: { id: record.id },
      data: { isActive: true },
      select: { id: true, isActive: true },
    });

    console.log(`Puzzle ID: ${activated.id}`);
    console.log(`Active: ${activated.isActive}`);
    console.log(`Route: /puzzles/${activated.id}`);
  } finally {
    await prisma.$disconnect();
  }
}

async function main(): Promise<void> {
  const { mode, allowRemote } = parseArgs(process.argv.slice(2));

  if (mode === "dry-run") {
    await runDryRun();
    return;
  }
  if (mode === "stage") {
    await runStage(allowRemote);
    return;
  }
  await runActivate(allowRemote);
}

main()
  .then(() => {
    if (process.exitCode && process.exitCode !== 0) {
      process.exit(process.exitCode);
    }
  })
  .catch((error) => {
    console.error("Publishing script failed:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
