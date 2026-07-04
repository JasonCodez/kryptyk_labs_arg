-- CreateTable
CREATE TABLE "public"."daily_puzzle_records" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "puzzleType" TEXT NOT NULL,
    "dayNumber" INTEGER NOT NULL,
    "won" BOOLEAN NOT NULL DEFAULT true,
    "skipped" BOOLEAN NOT NULL DEFAULT false,
    "shieldUsed" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_puzzle_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."daily_puzzle_slots" (
    "id" TEXT NOT NULL,
    "puzzleType" TEXT NOT NULL,
    "dayNumber" INTEGER NOT NULL,
    "puzzleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_puzzle_slots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "daily_puzzle_records_userId_puzzleType_dayNumber_key" ON "public"."daily_puzzle_records"("userId" ASC, "puzzleType" ASC, "dayNumber" ASC);

-- CreateIndex
CREATE INDEX "daily_puzzle_records_userId_puzzleType_idx" ON "public"."daily_puzzle_records"("userId" ASC, "puzzleType" ASC);

-- CreateIndex
CREATE INDEX "daily_puzzle_slots_puzzleId_idx" ON "public"."daily_puzzle_slots"("puzzleId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "daily_puzzle_slots_puzzleType_dayNumber_key" ON "public"."daily_puzzle_slots"("puzzleType" ASC, "dayNumber" ASC);

-- AddForeignKey
ALTER TABLE "public"."daily_puzzle_records" ADD CONSTRAINT "daily_puzzle_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."daily_puzzle_slots" ADD CONSTRAINT "daily_puzzle_slots_puzzleId_fkey" FOREIGN KEY ("puzzleId") REFERENCES "public"."puzzles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

