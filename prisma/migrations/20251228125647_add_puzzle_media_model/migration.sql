-- CreateTable
CREATE TABLE "puzzle_media" (
    "id" TEXT NOT NULL,
    "puzzleId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "duration" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "thumbnail" TEXT,
    "uploadedBy" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "puzzle_media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "puzzle_media_puzzleId_idx" ON "puzzle_media"("puzzleId");

-- CreateIndex
CREATE INDEX "puzzle_media_type_idx" ON "puzzle_media"("type");

-- AddForeignKey
ALTER TABLE "puzzle_media" ADD CONSTRAINT "puzzle_media_puzzleId_fkey" FOREIGN KEY ("puzzleId") REFERENCES "puzzles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
