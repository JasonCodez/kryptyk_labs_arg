-- CreateTable
CREATE TABLE "puzzle_ratings" (
    "id" TEXT NOT NULL,
    "puzzleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" SMALLINT NOT NULL,
    "review" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "puzzle_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "puzzle_ratings_puzzleId_idx" ON "puzzle_ratings"("puzzleId");

-- CreateIndex
CREATE INDEX "puzzle_ratings_userId_idx" ON "puzzle_ratings"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "puzzle_ratings_puzzleId_userId_key" ON "puzzle_ratings"("puzzleId", "userId");

-- AddForeignKey
ALTER TABLE "puzzle_ratings" ADD CONSTRAINT "puzzle_ratings_puzzleId_fkey" FOREIGN KEY ("puzzleId") REFERENCES "puzzles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "puzzle_ratings" ADD CONSTRAINT "puzzle_ratings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
