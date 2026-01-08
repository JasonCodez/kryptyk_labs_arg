import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function deleteAllPuzzles() {
  try {
    console.log("Deleting all puzzles...");

    // Delete related records first
    await prisma.userPuzzleProgress.deleteMany({});
    console.log("✓ Deleted all user puzzle progress");

    await prisma.puzzleHint.deleteMany({});
    console.log("✓ Deleted all puzzle hints");

    await prisma.puzzleRating.deleteMany({});
    console.log("✓ Deleted all puzzle ratings");

    // Delete puzzles
    await prisma.puzzle.deleteMany({});
    console.log("✓ Deleted all puzzles");

    console.log("✅ All puzzles deleted successfully!");
  } catch (error) {
    console.error("❌ Error deleting puzzles:", error);
  } finally {
    await prisma.$disconnect();
  }
}

deleteAllPuzzles();
