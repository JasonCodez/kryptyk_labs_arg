-- CreateTable
CREATE TABLE "puzzle_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "puzzleType" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "tags" TEXT[],
    "difficulty" TEXT NOT NULL,
    "category" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "puzzle_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "puzzle_versions" (
    "id" TEXT NOT NULL,
    "puzzleId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "content" JSONB NOT NULL,
    "solutions" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "puzzle_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "puzzle_schedules" (
    "id" TEXT NOT NULL,
    "puzzleId" TEXT NOT NULL,
    "releaseAt" TIMESTAMP(3),
    "unlocksAt" TIMESTAMP(3),
    "timedDuration" INTEGER,
    "countdownStartsAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "timezone" TEXT,
    "schedulingType" TEXT NOT NULL DEFAULT 'immediate',
    "isLive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "puzzle_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hint_tiers" (
    "id" TEXT NOT NULL,
    "puzzleId" TEXT NOT NULL,
    "tierNumber" INTEGER NOT NULL,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "costPoints" INTEGER NOT NULL DEFAULT 0,
    "progressRequired" INTEGER,
    "delaySeconds" INTEGER,
    "maxUsesPerPlayer" INTEGER NOT NULL DEFAULT 1,
    "revealType" TEXT NOT NULL DEFAULT 'full',
    "isProgressive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hint_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hint_usage_logs" (
    "id" TEXT NOT NULL,
    "puzzleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "hintTierId" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "costPaid" INTEGER NOT NULL,
    "leadToSolve" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "hint_usage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "puzzle_analytics" (
    "id" TEXT NOT NULL,
    "puzzleId" TEXT NOT NULL,
    "totalAttempts" INTEGER NOT NULL DEFAULT 0,
    "totalCompletions" INTEGER NOT NULL DEFAULT 0,
    "totalPlayers" INTEGER NOT NULL DEFAULT 0,
    "averageSolveTime" DOUBLE PRECISION,
    "medianSolveTime" DOUBLE PRECISION,
    "tooEasy" INTEGER NOT NULL DEFAULT 0,
    "perfectDifficulty" INTEGER NOT NULL DEFAULT 0,
    "tooDifficult" INTEGER NOT NULL DEFAULT 0,
    "averageHintsUsed" DOUBLE PRECISION,
    "abandonmentRate" DOUBLE PRECISION,
    "playersWhoUsedHints" INTEGER NOT NULL DEFAULT 0,
    "dailyAttempts" JSONB,
    "hourlyEngagement" JSONB,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "puzzle_analytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_validators" (
    "id" TEXT NOT NULL,
    "puzzleId" TEXT NOT NULL,
    "validationType" TEXT NOT NULL,
    "name" TEXT,
    "pattern" TEXT,
    "flags" TEXT,
    "scriptCode" TEXT,
    "apiEndpoint" TEXT,
    "apiMethod" TEXT DEFAULT 'POST',
    "apiHeaders" JSONB,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_validators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "puzzle_relationships" (
    "id" TEXT NOT NULL,
    "puzzleIdA" TEXT NOT NULL,
    "puzzleIdB" TEXT NOT NULL,
    "relationshipType" TEXT NOT NULL,
    "description" TEXT,
    "campaignId" TEXT,
    "sequenceOrder" INTEGER,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "unlocksOn" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "puzzle_relationships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "puzzle_campaigns" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "theme" TEXT,
    "targetDifficulty" TEXT,
    "estimatedPlaytime" INTEGER,
    "isLinear" BOOLEAN NOT NULL DEFAULT true,
    "maxConcurrent" INTEGER,
    "totalReward" INTEGER NOT NULL DEFAULT 0,
    "badge" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "puzzle_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bulk_operations" (
    "id" TEXT NOT NULL,
    "operationType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "sourceData" JSONB NOT NULL,
    "results" JSONB,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "itemsProcessed" INTEGER NOT NULL DEFAULT 0,
    "itemsTotal" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "bulk_operations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "puzzle_templates_puzzleType_idx" ON "puzzle_templates"("puzzleType");

-- CreateIndex
CREATE INDEX "puzzle_templates_isPublic_idx" ON "puzzle_templates"("isPublic");

-- CreateIndex
CREATE INDEX "puzzle_versions_puzzleId_idx" ON "puzzle_versions"("puzzleId");

-- CreateIndex
CREATE INDEX "puzzle_versions_status_idx" ON "puzzle_versions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "puzzle_versions_puzzleId_versionNumber_key" ON "puzzle_versions"("puzzleId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "puzzle_schedules_puzzleId_key" ON "puzzle_schedules"("puzzleId");

-- CreateIndex
CREATE INDEX "puzzle_schedules_puzzleId_idx" ON "puzzle_schedules"("puzzleId");

-- CreateIndex
CREATE INDEX "puzzle_schedules_releaseAt_idx" ON "puzzle_schedules"("releaseAt");

-- CreateIndex
CREATE INDEX "hint_tiers_puzzleId_idx" ON "hint_tiers"("puzzleId");

-- CreateIndex
CREATE UNIQUE INDEX "hint_tiers_puzzleId_tierNumber_key" ON "hint_tiers"("puzzleId", "tierNumber");

-- CreateIndex
CREATE INDEX "hint_usage_logs_puzzleId_idx" ON "hint_usage_logs"("puzzleId");

-- CreateIndex
CREATE INDEX "hint_usage_logs_userId_idx" ON "hint_usage_logs"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "puzzle_analytics_puzzleId_key" ON "puzzle_analytics"("puzzleId");

-- CreateIndex
CREATE INDEX "puzzle_analytics_puzzleId_idx" ON "puzzle_analytics"("puzzleId");

-- CreateIndex
CREATE INDEX "custom_validators_puzzleId_idx" ON "custom_validators"("puzzleId");

-- CreateIndex
CREATE INDEX "puzzle_relationships_puzzleIdA_idx" ON "puzzle_relationships"("puzzleIdA");

-- CreateIndex
CREATE INDEX "puzzle_relationships_puzzleIdB_idx" ON "puzzle_relationships"("puzzleIdB");

-- CreateIndex
CREATE INDEX "puzzle_relationships_relationshipType_idx" ON "puzzle_relationships"("relationshipType");

-- CreateIndex
CREATE UNIQUE INDEX "puzzle_relationships_puzzleIdA_puzzleIdB_key" ON "puzzle_relationships"("puzzleIdA", "puzzleIdB");

-- CreateIndex
CREATE INDEX "puzzle_campaigns_isLinear_idx" ON "puzzle_campaigns"("isLinear");

-- CreateIndex
CREATE INDEX "bulk_operations_status_idx" ON "bulk_operations"("status");

-- CreateIndex
CREATE INDEX "bulk_operations_operationType_idx" ON "bulk_operations"("operationType");

-- AddForeignKey
ALTER TABLE "puzzle_versions" ADD CONSTRAINT "puzzle_versions_puzzleId_fkey" FOREIGN KEY ("puzzleId") REFERENCES "puzzles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "puzzle_schedules" ADD CONSTRAINT "puzzle_schedules_puzzleId_fkey" FOREIGN KEY ("puzzleId") REFERENCES "puzzles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hint_tiers" ADD CONSTRAINT "hint_tiers_puzzleId_fkey" FOREIGN KEY ("puzzleId") REFERENCES "puzzles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hint_usage_logs" ADD CONSTRAINT "hint_usage_logs_puzzleId_fkey" FOREIGN KEY ("puzzleId") REFERENCES "puzzles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "puzzle_analytics" ADD CONSTRAINT "puzzle_analytics_puzzleId_fkey" FOREIGN KEY ("puzzleId") REFERENCES "puzzles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_validators" ADD CONSTRAINT "custom_validators_puzzleId_fkey" FOREIGN KEY ("puzzleId") REFERENCES "puzzles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "puzzle_relationships" ADD CONSTRAINT "puzzle_relationships_puzzleIdA_fkey" FOREIGN KEY ("puzzleIdA") REFERENCES "puzzles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "puzzle_relationships" ADD CONSTRAINT "puzzle_relationships_puzzleIdB_fkey" FOREIGN KEY ("puzzleIdB") REFERENCES "puzzles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
