/*
  Warnings:

  - Added the required column `updatedAt` to the `puzzle_hints` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "puzzle_hints" ADD COLUMN     "averageTimeToSolve" DOUBLE PRECISION,
ADD COLUMN     "maxUsesPerUser" INTEGER,
ADD COLUMN     "timesLeadToSolve" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalUsages" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "hint_history" (
    "id" TEXT NOT NULL,
    "hintId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pointsCost" INTEGER NOT NULL,
    "revealedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "solvedAt" TIMESTAMP(3),
    "timeToSolve" INTEGER,
    "leadToSolve" BOOLEAN NOT NULL DEFAULT false,
    "wasHelpful" BOOLEAN,

    CONSTRAINT "hint_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "hint_history_hintId_idx" ON "hint_history"("hintId");

-- CreateIndex
CREATE INDEX "hint_history_userId_idx" ON "hint_history"("userId");

-- CreateIndex
CREATE INDEX "hint_history_revealedAt_idx" ON "hint_history"("revealedAt");

-- AddForeignKey
ALTER TABLE "hint_history" ADD CONSTRAINT "hint_history_hintId_fkey" FOREIGN KEY ("hintId") REFERENCES "puzzle_hints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hint_history" ADD CONSTRAINT "hint_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
