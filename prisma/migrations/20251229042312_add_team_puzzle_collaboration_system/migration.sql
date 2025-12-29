-- AlterTable
ALTER TABLE "puzzles" ADD COLUMN     "isTeamPuzzle" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "minTeamSize" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "team_puzzle_part_assignments" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "puzzleId" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "assignedToUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_puzzle_part_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_puzzle_part_submissions" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "puzzleId" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "submittedByUserId" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "solvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_puzzle_part_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_puzzle_completions" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "puzzleId" TEXT NOT NULL,
    "totalPointsEarned" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_puzzle_completions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "team_puzzle_part_assignments_teamId_idx" ON "team_puzzle_part_assignments"("teamId");

-- CreateIndex
CREATE INDEX "team_puzzle_part_assignments_puzzleId_idx" ON "team_puzzle_part_assignments"("puzzleId");

-- CreateIndex
CREATE INDEX "team_puzzle_part_assignments_partId_idx" ON "team_puzzle_part_assignments"("partId");

-- CreateIndex
CREATE INDEX "team_puzzle_part_assignments_assignedToUserId_idx" ON "team_puzzle_part_assignments"("assignedToUserId");

-- CreateIndex
CREATE UNIQUE INDEX "team_puzzle_part_assignments_teamId_puzzleId_partId_key" ON "team_puzzle_part_assignments"("teamId", "puzzleId", "partId");

-- CreateIndex
CREATE INDEX "team_puzzle_part_submissions_teamId_idx" ON "team_puzzle_part_submissions"("teamId");

-- CreateIndex
CREATE INDEX "team_puzzle_part_submissions_puzzleId_idx" ON "team_puzzle_part_submissions"("puzzleId");

-- CreateIndex
CREATE INDEX "team_puzzle_part_submissions_partId_idx" ON "team_puzzle_part_submissions"("partId");

-- CreateIndex
CREATE INDEX "team_puzzle_part_submissions_submittedByUserId_idx" ON "team_puzzle_part_submissions"("submittedByUserId");

-- CreateIndex
CREATE INDEX "team_puzzle_completions_teamId_idx" ON "team_puzzle_completions"("teamId");

-- CreateIndex
CREATE INDEX "team_puzzle_completions_puzzleId_idx" ON "team_puzzle_completions"("puzzleId");

-- CreateIndex
CREATE UNIQUE INDEX "team_puzzle_completions_teamId_puzzleId_key" ON "team_puzzle_completions"("teamId", "puzzleId");

-- AddForeignKey
ALTER TABLE "team_puzzle_part_assignments" ADD CONSTRAINT "team_puzzle_part_assignments_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_puzzle_part_assignments" ADD CONSTRAINT "team_puzzle_part_assignments_puzzleId_fkey" FOREIGN KEY ("puzzleId") REFERENCES "puzzles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_puzzle_part_assignments" ADD CONSTRAINT "team_puzzle_part_assignments_partId_fkey" FOREIGN KEY ("partId") REFERENCES "puzzle_parts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_puzzle_part_assignments" ADD CONSTRAINT "team_puzzle_part_assignments_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_puzzle_part_submissions" ADD CONSTRAINT "team_puzzle_part_submissions_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_puzzle_part_submissions" ADD CONSTRAINT "team_puzzle_part_submissions_puzzleId_fkey" FOREIGN KEY ("puzzleId") REFERENCES "puzzles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_puzzle_part_submissions" ADD CONSTRAINT "team_puzzle_part_submissions_partId_fkey" FOREIGN KEY ("partId") REFERENCES "puzzle_parts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_puzzle_part_submissions" ADD CONSTRAINT "team_puzzle_part_submissions_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_puzzle_completions" ADD CONSTRAINT "team_puzzle_completions_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_puzzle_completions" ADD CONSTRAINT "team_puzzle_completions_puzzleId_fkey" FOREIGN KEY ("puzzleId") REFERENCES "puzzles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
