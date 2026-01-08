-- CreateTable
CREATE TABLE "jigsaw_puzzles" (
    "id" TEXT NOT NULL,
    "puzzleId" TEXT NOT NULL,
    "imageUrl" TEXT,
    "gridRows" INTEGER NOT NULL DEFAULT 3,
    "gridCols" INTEGER NOT NULL DEFAULT 4,
    "snapTolerance" INTEGER NOT NULL DEFAULT 12,
    "rotationEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jigsaw_puzzles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "jigsaw_puzzles_puzzleId_key" ON "jigsaw_puzzles"("puzzleId");

-- CreateIndex
CREATE INDEX "jigsaw_puzzles_puzzleId_idx" ON "jigsaw_puzzles"("puzzleId");

-- AddForeignKey
ALTER TABLE "jigsaw_puzzles" ADD CONSTRAINT "jigsaw_puzzles_puzzleId_fkey" FOREIGN KEY ("puzzleId") REFERENCES "puzzles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
