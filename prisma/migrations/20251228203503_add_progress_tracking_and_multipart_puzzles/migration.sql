-- AlterTable
ALTER TABLE "user_puzzle_progress" ADD COLUMN     "averageTimePerAttempt" DOUBLE PRECISION,
ADD COLUMN     "completionPercentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "currentSessionStart" TIMESTAMP(3),
ADD COLUMN     "lastAttemptAt" TIMESTAMP(3),
ADD COLUMN     "successfulAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalTimeSpent" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "puzzle_session_logs" (
    "id" TEXT NOT NULL,
    "progressId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "puzzleId" TEXT NOT NULL,
    "sessionStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sessionEnd" TIMESTAMP(3),
    "durationSeconds" INTEGER,
    "hintUsed" BOOLEAN NOT NULL DEFAULT false,
    "attemptMade" BOOLEAN NOT NULL DEFAULT false,
    "wasSuccessful" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "puzzle_session_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "puzzle_parts" (
    "id" TEXT NOT NULL,
    "puzzleId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "content" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "pointsValue" INTEGER NOT NULL DEFAULT 50,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "puzzle_parts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "puzzle_part_solutions" (
    "id" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL DEFAULT true,
    "points" INTEGER NOT NULL DEFAULT 50,
    "isRegex" BOOLEAN NOT NULL DEFAULT false,
    "ignoreCase" BOOLEAN NOT NULL DEFAULT true,
    "ignoreWhitespace" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "puzzle_part_solutions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "puzzle_part_progress" (
    "id" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "progressId" TEXT NOT NULL,
    "solved" BOOLEAN NOT NULL DEFAULT false,
    "solvedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "pointsEarned" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "puzzle_part_progress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "puzzle_session_logs_progressId_idx" ON "puzzle_session_logs"("progressId");

-- CreateIndex
CREATE INDEX "puzzle_session_logs_userId_idx" ON "puzzle_session_logs"("userId");

-- CreateIndex
CREATE INDEX "puzzle_session_logs_sessionStart_idx" ON "puzzle_session_logs"("sessionStart");

-- CreateIndex
CREATE INDEX "puzzle_parts_puzzleId_idx" ON "puzzle_parts"("puzzleId");

-- CreateIndex
CREATE INDEX "puzzle_parts_order_idx" ON "puzzle_parts"("order");

-- CreateIndex
CREATE INDEX "puzzle_part_solutions_partId_idx" ON "puzzle_part_solutions"("partId");

-- CreateIndex
CREATE INDEX "puzzle_part_progress_partId_idx" ON "puzzle_part_progress"("partId");

-- CreateIndex
CREATE INDEX "puzzle_part_progress_progressId_idx" ON "puzzle_part_progress"("progressId");

-- CreateIndex
CREATE UNIQUE INDEX "puzzle_part_progress_partId_progressId_key" ON "puzzle_part_progress"("partId", "progressId");

-- AddForeignKey
ALTER TABLE "puzzle_session_logs" ADD CONSTRAINT "puzzle_session_logs_progressId_fkey" FOREIGN KEY ("progressId") REFERENCES "user_puzzle_progress"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "puzzle_session_logs" ADD CONSTRAINT "puzzle_session_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "puzzle_parts" ADD CONSTRAINT "puzzle_parts_puzzleId_fkey" FOREIGN KEY ("puzzleId") REFERENCES "puzzles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "puzzle_part_solutions" ADD CONSTRAINT "puzzle_part_solutions_partId_fkey" FOREIGN KEY ("partId") REFERENCES "puzzle_parts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "puzzle_part_progress" ADD CONSTRAINT "puzzle_part_progress_partId_fkey" FOREIGN KEY ("partId") REFERENCES "puzzle_parts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "puzzle_part_progress" ADD CONSTRAINT "puzzle_part_progress_progressId_fkey" FOREIGN KEY ("progressId") REFERENCES "user_puzzle_progress"("id") ON DELETE CASCADE ON UPDATE CASCADE;
