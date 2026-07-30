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

type DatabaseTargetClassification =
  | { kind: "missing" }
  | { kind: "malformed" }
  | { kind: "local" }
  | { kind: "remote" };

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const SUPPORTED_NETWORK_PROTOCOLS = new Set(["postgres:", "postgresql:"]);

/**
 * Classifies `DATABASE_URL` as missing, malformed, local, or remote, without ever printing the
 * URL itself (which may contain credentials). `--allow-remote` is only ever permitted to
 * override a syntactically valid remote classification — never a missing or malformed one.
 */
function classifyDatabaseTarget(databaseUrl: string | undefined): DatabaseTargetClassification {
  if (databaseUrl === undefined || databaseUrl.trim().length === 0) {
    return { kind: "missing" };
  }
  const url = databaseUrl.trim();
  if (url.startsWith("file:")) return { kind: "local" };

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { kind: "malformed" };
  }

  if (!SUPPORTED_NETWORK_PROTOCOLS.has(parsed.protocol)) return { kind: "malformed" };
  const host = parsed.hostname.toLowerCase();
  if (!host) return { kind: "malformed" };

  return LOCAL_HOSTNAMES.has(host) ? { kind: "local" } : { kind: "remote" };
}

function assertPermittedDatabase(allowRemote: boolean): void {
  const classification = classifyDatabaseTarget(process.env.DATABASE_URL);

  switch (classification.kind) {
    case "missing":
      printUsageAndExit("DATABASE_URL is missing.");
      break;
    case "malformed":
      printUsageAndExit("DATABASE_URL is malformed or unsupported.");
      break;
    case "local":
      return;
    case "remote":
      if (allowRemote) {
        console.log("--allow-remote supplied: proceeding against a remote database target.");
        return;
      }
      printUsageAndExit(
        "DATABASE_URL targets a remote database. Re-run with --allow-remote only if that write is intentional."
      );
      break;
  }
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

    let puzzleId: string;
    try {
      puzzleId = await prisma.$transaction(async (tx) => {
      let category = await tx.puzzleCategory.findFirst({ where: { name: PUBLICATION_CATEGORY_NAME } });
      if (!category) {
        category = await tx.puzzleCategory.create({ data: { name: PUBLICATION_CATEGORY_NAME } });
      }

      // Re-check daily-slot state inside the transaction (not just in the earlier preflight
      // check above) — the publisher must never delete scheduling data, so if a slot appeared
      // between the preflight check and now, abort and roll back rather than overwrite it.
      if (existing) {
        const recheckSlots = await tx.dailyPuzzleSlot.count({ where: { puzzleId: existing.id } });
        if (recheckSlots > 0) {
          throw new Error("STAGE_ABORTED_DAILY_SLOT_PRESENT");
        }
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

      // This is an intentionally controlled publisher for one known, identified puzzle record —
      // unconditionally clearing and recreating its own solution rows (never another puzzle's)
      // is the simplest way to guarantee the final state is exactly one correct placeholder,
      // with no stale text-answer row or leftover duplicate left behind.
      await tx.puzzleSolution.deleteMany({ where: { puzzleId: puzzle.id } });
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

      const finalSolutions = await tx.puzzleSolution.findMany({ where: { puzzleId: puzzle.id } });
      const finalDailySlots = await tx.dailyPuzzleSlot.count({ where: { puzzleId: puzzle.id } });
      const finalPlaceholderCount = finalSolutions.filter(
        (s) => s.answer === LOGIC_GRID_PLACEHOLDER_ANSWER
      ).length;

      if (finalSolutions.length !== 1 || finalPlaceholderCount !== 1 || finalDailySlots !== 0) {
        throw new Error(
          `STAGE_ABORTED_INVARIANT_VIOLATION solutions=${finalSolutions.length} placeholders=${finalPlaceholderCount} dailySlots=${finalDailySlots}`
        );
      }

      return puzzle.id;
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.startsWith("STAGE_ABORTED_DAILY_SLOT_PRESENT")) {
        console.error(
          "A daily-slot assignment appeared on the matching record during staging — refusing to overwrite scheduling data."
        );
      } else if (message.startsWith("STAGE_ABORTED_INVARIANT_VIOLATION")) {
        console.error("Staged record failed its post-write invariant check (solution/daily-slot count). Rolled back.");
      } else {
        console.error(`Staging transaction failed: ${message}`);
      }
      process.exitCode = 1;
      return;
    }

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

    if (record.isActive) {
      console.error(
        "Matching record is already active. Run --stage and complete staged verification before activating."
      );
      process.exitCode = 1;
      return;
    }

    const storedValidation = validateLogicGridForPublication(record.data);
    if (!storedValidation.valid) {
      console.error(`Stored data failed publication validation: ${storedValidation.error}`);
      process.exitCode = 1;
      return;
    }

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

    const fixedFieldChecks: Array<[string, unknown, unknown]> = [
      ["title", record.title, MIDNIGHT_EXHIBITION_TITLE],
      ["description", record.description, PUBLICATION_DESCRIPTION],
      ["content", record.content, PUBLICATION_CONTENT],
      ["puzzleType", record.puzzleType, PUBLICATION_PUZZLE_TYPE],
      ["difficulty", record.difficulty, PUBLICATION_DIFFICULTY],
      ["xpReward", record.xpReward, PUBLICATION_XP_REWARD],
      ["isWarzExclusive", record.isWarzExclusive, false],
      ["order", record.order, 0],
      ["isBossPuzzle", record.isBossPuzzle, false],
      ["riddleAnswer", record.riddleAnswer, null],
    ];
    for (const [field, actual, expected] of fixedFieldChecks) {
      if (actual !== expected) {
        console.error(
          `Expected ${field} ${JSON.stringify(expected)}, found ${JSON.stringify(actual)}. Refusing to activate.`
        );
        process.exitCode = 1;
        return;
      }
    }

    const category = await prisma.puzzleCategory.findUnique({ where: { id: record.categoryId } });
    if (!category || category.name !== PUBLICATION_CATEGORY_NAME) {
      console.error(`Expected category "${PUBLICATION_CATEGORY_NAME}", found "${category?.name}". Refusing to activate.`);
      process.exitCode = 1;
      return;
    }

    if (record.solutions.length !== 1) {
      console.error(
        `Expected exactly one solution row, found ${record.solutions.length}. Refusing to activate.`
      );
      process.exitCode = 1;
      return;
    }
    const [solution] = record.solutions;
    const solutionChecks: Array<[string, unknown, unknown]> = [
      ["answer", solution.answer, LOGIC_GRID_PLACEHOLDER_ANSWER],
      ["points", solution.points, PUBLICATION_POINTS],
      ["isCorrect", solution.isCorrect, true],
      ["ignoreCase", solution.ignoreCase, true],
      ["ignoreWhitespace", solution.ignoreWhitespace, false],
    ];
    for (const [field, actual, expected] of solutionChecks) {
      if (actual !== expected) {
        console.error(
          `Expected placeholder solution ${field} ${JSON.stringify(expected)}, found ${JSON.stringify(actual)}. Refusing to activate.`
        );
        process.exitCode = 1;
        return;
      }
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
