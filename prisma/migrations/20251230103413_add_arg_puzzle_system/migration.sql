-- CreateTable
CREATE TABLE "arg_phases" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "orderIndex" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "arg_phases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arg_puzzles" (
    "id" TEXT NOT NULL,
    "phaseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "puzzleType" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "puzzleData" JSONB NOT NULL,
    "solution" TEXT NOT NULL,
    "hints" TEXT[],
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "arg_puzzles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arg_puzzle_progress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "puzzleId" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "hintsUsed" INTEGER NOT NULL DEFAULT 0,
    "solution" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "arg_puzzle_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arg_phase_progress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "phaseId" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "arg_phase_progress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "arg_phases_isActive_idx" ON "arg_phases"("isActive");

-- CreateIndex
CREATE INDEX "arg_puzzles_phaseId_idx" ON "arg_puzzles"("phaseId");

-- CreateIndex
CREATE INDEX "arg_puzzles_puzzleType_idx" ON "arg_puzzles"("puzzleType");

-- CreateIndex
CREATE INDEX "arg_puzzles_isPublished_idx" ON "arg_puzzles"("isPublished");

-- CreateIndex
CREATE INDEX "arg_puzzle_progress_userId_idx" ON "arg_puzzle_progress"("userId");

-- CreateIndex
CREATE INDEX "arg_puzzle_progress_puzzleId_idx" ON "arg_puzzle_progress"("puzzleId");

-- CreateIndex
CREATE INDEX "arg_puzzle_progress_completed_idx" ON "arg_puzzle_progress"("completed");

-- CreateIndex
CREATE UNIQUE INDEX "arg_puzzle_progress_userId_puzzleId_key" ON "arg_puzzle_progress"("userId", "puzzleId");

-- CreateIndex
CREATE INDEX "arg_phase_progress_userId_idx" ON "arg_phase_progress"("userId");

-- CreateIndex
CREATE INDEX "arg_phase_progress_phaseId_idx" ON "arg_phase_progress"("phaseId");

-- CreateIndex
CREATE INDEX "arg_phase_progress_completed_idx" ON "arg_phase_progress"("completed");

-- CreateIndex
CREATE UNIQUE INDEX "arg_phase_progress_userId_phaseId_key" ON "arg_phase_progress"("userId", "phaseId");

-- AddForeignKey
ALTER TABLE "arg_puzzles" ADD CONSTRAINT "arg_puzzles_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "arg_phases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arg_puzzle_progress" ADD CONSTRAINT "arg_puzzle_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arg_puzzle_progress" ADD CONSTRAINT "arg_puzzle_progress_puzzleId_fkey" FOREIGN KEY ("puzzleId") REFERENCES "arg_puzzles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arg_phase_progress" ADD CONSTRAINT "arg_phase_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arg_phase_progress" ADD CONSTRAINT "arg_phase_progress_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "arg_phases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
