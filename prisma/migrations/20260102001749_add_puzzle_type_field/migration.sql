-- AlterTable
ALTER TABLE "puzzles" ADD COLUMN     "puzzleType" TEXT NOT NULL DEFAULT 'general';

-- AlterTable
ALTER TABLE "sudoku_puzzles" ALTER COLUMN "difficulty" SET DEFAULT 'medium';
