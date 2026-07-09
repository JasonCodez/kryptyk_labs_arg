-- CreateTable
CREATE TABLE "bug_reports" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "puzzleId" TEXT,
    "puzzleTitle" TEXT,
    "otherLocation" TEXT,
    "description" TEXT NOT NULL,
    "contactEmail" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bug_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bug_reports_userId_idx" ON "bug_reports"("userId");

-- CreateIndex
CREATE INDEX "bug_reports_puzzleId_idx" ON "bug_reports"("puzzleId");

-- CreateIndex
CREATE INDEX "bug_reports_status_idx" ON "bug_reports"("status");

-- AddForeignKey
ALTER TABLE "bug_reports" ADD CONSTRAINT "bug_reports_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bug_reports" ADD CONSTRAINT "bug_reports_puzzleId_fkey" FOREIGN KEY ("puzzleId") REFERENCES "puzzles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

