-- CreateTable
CREATE TABLE "jigsaw_puzzles" (
    "id" TEXT NOT NULL,
    "puzzleId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "imageWidth" INTEGER NOT NULL,
    "imageHeight" INTEGER NOT NULL,
    "pieceCount" INTEGER NOT NULL,
    "difficulty" TEXT NOT NULL DEFAULT 'medium',
    "allowRotation" BOOLEAN NOT NULL DEFAULT true,
    "showPreview" BOOLEAN NOT NULL DEFAULT true,
    "previewTime" INTEGER NOT NULL DEFAULT 5000,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jigsaw_puzzles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jigsaw_puzzle_pieces" (
    "id" TEXT NOT NULL,
    "jigsawId" TEXT NOT NULL,
    "gridX" INTEGER NOT NULL,
    "gridY" INTEGER NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "width" DOUBLE PRECISION NOT NULL,
    "height" DOUBLE PRECISION NOT NULL,
    "rotation" INTEGER NOT NULL DEFAULT 0,
    "connectsTop" BOOLEAN NOT NULL DEFAULT false,
    "connectsRight" BOOLEAN NOT NULL DEFAULT false,
    "connectsBottom" BOOLEAN NOT NULL DEFAULT false,
    "connectsLeft" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "jigsaw_puzzle_pieces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_jigsaw_progress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jigsawId" TEXT NOT NULL,
    "solved" BOOLEAN NOT NULL DEFAULT false,
    "solvedAt" TIMESTAMP(3),
    "timeSpent" INTEGER NOT NULL DEFAULT 0,
    "score" INTEGER NOT NULL DEFAULT 0,
    "streak" INTEGER NOT NULL DEFAULT 0,
    "hintsUsed" INTEGER NOT NULL DEFAULT 0,
    "placedPieces" TEXT NOT NULL DEFAULT '[]',
    "placedCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastPlacedAt" TIMESTAMP(3),

    CONSTRAINT "user_jigsaw_progress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "jigsaw_puzzles_puzzleId_key" ON "jigsaw_puzzles"("puzzleId");

-- CreateIndex
CREATE INDEX "jigsaw_puzzles_puzzleId_idx" ON "jigsaw_puzzles"("puzzleId");

-- CreateIndex
CREATE INDEX "jigsaw_puzzle_pieces_jigsawId_idx" ON "jigsaw_puzzle_pieces"("jigsawId");

-- CreateIndex
CREATE UNIQUE INDEX "jigsaw_puzzle_pieces_jigsawId_gridX_gridY_key" ON "jigsaw_puzzle_pieces"("jigsawId", "gridX", "gridY");

-- CreateIndex
CREATE INDEX "user_jigsaw_progress_userId_idx" ON "user_jigsaw_progress"("userId");

-- CreateIndex
CREATE INDEX "user_jigsaw_progress_jigsawId_idx" ON "user_jigsaw_progress"("jigsawId");

-- CreateIndex
CREATE INDEX "user_jigsaw_progress_solved_idx" ON "user_jigsaw_progress"("solved");

-- CreateIndex
CREATE UNIQUE INDEX "user_jigsaw_progress_userId_jigsawId_key" ON "user_jigsaw_progress"("userId", "jigsawId");

-- AddForeignKey
ALTER TABLE "jigsaw_puzzles" ADD CONSTRAINT "jigsaw_puzzles_puzzleId_fkey" FOREIGN KEY ("puzzleId") REFERENCES "puzzles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jigsaw_puzzle_pieces" ADD CONSTRAINT "jigsaw_puzzle_pieces_jigsawId_fkey" FOREIGN KEY ("jigsawId") REFERENCES "jigsaw_puzzles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_jigsaw_progress" ADD CONSTRAINT "user_jigsaw_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_jigsaw_progress" ADD CONSTRAINT "user_jigsaw_progress_jigsawId_fkey" FOREIGN KEY ("jigsawId") REFERENCES "jigsaw_puzzles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
