-- CreateTable
CREATE TABLE "sudoku_puzzles" (
    "id" TEXT NOT NULL,
    "puzzleId" TEXT NOT NULL,
    "puzzleGrid" TEXT NOT NULL,
    "solutionGrid" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sudoku_puzzles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sudoku_puzzles_puzzleId_key" ON "sudoku_puzzles"("puzzleId");

-- CreateIndex
CREATE INDEX "sudoku_puzzles_puzzleId_idx" ON "sudoku_puzzles"("puzzleId");

-- AddForeignKey
ALTER TABLE "sudoku_puzzles" ADD CONSTRAINT "sudoku_puzzles_puzzleId_fkey" FOREIGN KEY ("puzzleId") REFERENCES "puzzles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
