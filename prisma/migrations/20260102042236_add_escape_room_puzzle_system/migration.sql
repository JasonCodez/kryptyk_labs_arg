-- CreateTable
CREATE TABLE "escape_room_puzzles" (
    "id" TEXT NOT NULL,
    "puzzleId" TEXT NOT NULL,
    "roomTitle" TEXT NOT NULL,
    "roomDescription" TEXT NOT NULL,
    "timeLimitSeconds" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "escape_room_puzzles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escape_stages" (
    "id" TEXT NOT NULL,
    "escapeRoomId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "puzzleType" TEXT NOT NULL,
    "puzzleData" TEXT NOT NULL,
    "correctAnswer" TEXT NOT NULL,
    "hints" TEXT NOT NULL DEFAULT '[]',
    "rewardItem" TEXT,
    "rewardDescription" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "escape_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_escape_progress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "escapeRoomId" TEXT NOT NULL,
    "currentStageIndex" INTEGER NOT NULL DEFAULT 0,
    "solvedStages" TEXT NOT NULL DEFAULT '[]',
    "inventory" TEXT NOT NULL DEFAULT '[]',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "totalTimeSpent" INTEGER NOT NULL DEFAULT 0,
    "hintsUsed" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "user_escape_progress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "escape_room_puzzles_puzzleId_key" ON "escape_room_puzzles"("puzzleId");

-- CreateIndex
CREATE INDEX "escape_room_puzzles_puzzleId_idx" ON "escape_room_puzzles"("puzzleId");

-- CreateIndex
CREATE INDEX "escape_stages_escapeRoomId_idx" ON "escape_stages"("escapeRoomId");

-- CreateIndex
CREATE UNIQUE INDEX "escape_stages_escapeRoomId_order_key" ON "escape_stages"("escapeRoomId", "order");

-- CreateIndex
CREATE INDEX "user_escape_progress_userId_idx" ON "user_escape_progress"("userId");

-- CreateIndex
CREATE INDEX "user_escape_progress_escapeRoomId_idx" ON "user_escape_progress"("escapeRoomId");

-- CreateIndex
CREATE UNIQUE INDEX "user_escape_progress_userId_escapeRoomId_key" ON "user_escape_progress"("userId", "escapeRoomId");

-- AddForeignKey
ALTER TABLE "escape_room_puzzles" ADD CONSTRAINT "escape_room_puzzles_puzzleId_fkey" FOREIGN KEY ("puzzleId") REFERENCES "puzzles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escape_stages" ADD CONSTRAINT "escape_stages_escapeRoomId_fkey" FOREIGN KEY ("escapeRoomId") REFERENCES "escape_room_puzzles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_escape_progress" ADD CONSTRAINT "user_escape_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_escape_progress" ADD CONSTRAINT "user_escape_progress_escapeRoomId_fkey" FOREIGN KEY ("escapeRoomId") REFERENCES "escape_room_puzzles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
