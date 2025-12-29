-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "name" TEXT,
    "image" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "teams" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "joinCode" TEXT,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_members" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_invites" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "invitedBy" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "puzzle_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "icon" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "puzzle_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "puzzles" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "difficulty" TEXT NOT NULL DEFAULT 'medium',
    "requiredPreviousPuzzleId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "unlocksAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "puzzles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "puzzle_solutions" (
    "id" TEXT NOT NULL,
    "puzzleId" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL DEFAULT true,
    "points" INTEGER NOT NULL DEFAULT 100,
    "isRegex" BOOLEAN NOT NULL DEFAULT false,
    "ignoreCase" BOOLEAN NOT NULL DEFAULT true,
    "ignoreWhitespace" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "puzzle_solutions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "puzzle_hints" (
    "id" TEXT NOT NULL,
    "puzzleId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "costPoints" INTEGER NOT NULL DEFAULT 10,
    "maxUsesPerTeam" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "puzzle_hints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hint_usages" (
    "id" TEXT NOT NULL,
    "hintId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hint_usages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_puzzle_progress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "puzzleId" TEXT NOT NULL,
    "solved" BOOLEAN NOT NULL DEFAULT false,
    "solvedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "pointsEarned" INTEGER NOT NULL DEFAULT 0,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_puzzle_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_progress" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "puzzleId" TEXT NOT NULL,
    "solved" BOOLEAN NOT NULL DEFAULT false,
    "solvedAt" TIMESTAMP(3),
    "solvedBy" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "pointsEarned" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "puzzle_submissions" (
    "id" TEXT NOT NULL,
    "puzzleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "feedback" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "puzzle_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leaderboard_entries" (
    "id" TEXT NOT NULL,
    "puzzleId" TEXT NOT NULL,
    "userId" TEXT,
    "teamId" TEXT,
    "rank" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    "solvedAt" TIMESTAMP(3) NOT NULL,
    "timeTaken" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leaderboard_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "global_leaderboard" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "teamId" TEXT,
    "totalPoints" INTEGER NOT NULL DEFAULT 0,
    "puzzlesSolved" INTEGER NOT NULL DEFAULT 0,
    "rank" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "global_leaderboard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcements" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'info',
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key" ON "accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "teams_joinCode_key" ON "teams"("joinCode");

-- CreateIndex
CREATE INDEX "teams_createdBy_idx" ON "teams"("createdBy");

-- CreateIndex
CREATE INDEX "team_members_teamId_idx" ON "team_members"("teamId");

-- CreateIndex
CREATE INDEX "team_members_userId_idx" ON "team_members"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "team_members_teamId_userId_key" ON "team_members"("teamId", "userId");

-- CreateIndex
CREATE INDEX "team_invites_teamId_idx" ON "team_invites"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "team_invites_teamId_userId_key" ON "team_invites"("teamId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "puzzle_categories_name_key" ON "puzzle_categories"("name");

-- CreateIndex
CREATE INDEX "puzzles_categoryId_idx" ON "puzzles"("categoryId");

-- CreateIndex
CREATE INDEX "puzzles_order_idx" ON "puzzles"("order");

-- CreateIndex
CREATE INDEX "puzzle_solutions_puzzleId_idx" ON "puzzle_solutions"("puzzleId");

-- CreateIndex
CREATE INDEX "puzzle_hints_puzzleId_idx" ON "puzzle_hints"("puzzleId");

-- CreateIndex
CREATE INDEX "puzzle_hints_order_idx" ON "puzzle_hints"("order");

-- CreateIndex
CREATE INDEX "hint_usages_hintId_idx" ON "hint_usages"("hintId");

-- CreateIndex
CREATE INDEX "hint_usages_userId_idx" ON "hint_usages"("userId");

-- CreateIndex
CREATE INDEX "user_puzzle_progress_userId_idx" ON "user_puzzle_progress"("userId");

-- CreateIndex
CREATE INDEX "user_puzzle_progress_puzzleId_idx" ON "user_puzzle_progress"("puzzleId");

-- CreateIndex
CREATE UNIQUE INDEX "user_puzzle_progress_userId_puzzleId_key" ON "user_puzzle_progress"("userId", "puzzleId");

-- CreateIndex
CREATE INDEX "team_progress_teamId_idx" ON "team_progress"("teamId");

-- CreateIndex
CREATE INDEX "team_progress_puzzleId_idx" ON "team_progress"("puzzleId");

-- CreateIndex
CREATE UNIQUE INDEX "team_progress_teamId_puzzleId_key" ON "team_progress"("teamId", "puzzleId");

-- CreateIndex
CREATE INDEX "puzzle_submissions_puzzleId_idx" ON "puzzle_submissions"("puzzleId");

-- CreateIndex
CREATE INDEX "puzzle_submissions_userId_idx" ON "puzzle_submissions"("userId");

-- CreateIndex
CREATE INDEX "puzzle_submissions_isCorrect_idx" ON "puzzle_submissions"("isCorrect");

-- CreateIndex
CREATE INDEX "leaderboard_entries_puzzleId_idx" ON "leaderboard_entries"("puzzleId");

-- CreateIndex
CREATE INDEX "leaderboard_entries_points_idx" ON "leaderboard_entries"("points");

-- CreateIndex
CREATE UNIQUE INDEX "leaderboard_entries_puzzleId_userId_teamId_key" ON "leaderboard_entries"("puzzleId", "userId", "teamId");

-- CreateIndex
CREATE INDEX "announcements_publishedAt_idx" ON "announcements"("publishedAt");

-- CreateIndex
CREATE INDEX "events_startDate_endDate_idx" ON "events"("startDate", "endDate");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_invites" ADD CONSTRAINT "team_invites_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_invites" ADD CONSTRAINT "team_invites_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "puzzles" ADD CONSTRAINT "puzzles_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "puzzle_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "puzzles" ADD CONSTRAINT "puzzles_requiredPreviousPuzzleId_fkey" FOREIGN KEY ("requiredPreviousPuzzleId") REFERENCES "puzzles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "puzzle_solutions" ADD CONSTRAINT "puzzle_solutions_puzzleId_fkey" FOREIGN KEY ("puzzleId") REFERENCES "puzzles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "puzzle_hints" ADD CONSTRAINT "puzzle_hints_puzzleId_fkey" FOREIGN KEY ("puzzleId") REFERENCES "puzzles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hint_usages" ADD CONSTRAINT "hint_usages_hintId_fkey" FOREIGN KEY ("hintId") REFERENCES "puzzle_hints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hint_usages" ADD CONSTRAINT "hint_usages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_puzzle_progress" ADD CONSTRAINT "user_puzzle_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_puzzle_progress" ADD CONSTRAINT "user_puzzle_progress_puzzleId_fkey" FOREIGN KEY ("puzzleId") REFERENCES "puzzles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_progress" ADD CONSTRAINT "team_progress_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_progress" ADD CONSTRAINT "team_progress_puzzleId_fkey" FOREIGN KEY ("puzzleId") REFERENCES "puzzles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "puzzle_submissions" ADD CONSTRAINT "puzzle_submissions_puzzleId_fkey" FOREIGN KEY ("puzzleId") REFERENCES "puzzles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "puzzle_submissions" ADD CONSTRAINT "puzzle_submissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaderboard_entries" ADD CONSTRAINT "leaderboard_entries_puzzleId_fkey" FOREIGN KEY ("puzzleId") REFERENCES "puzzles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
