-- CreateTable
CREATE TABLE "user_referrals" (
    "id" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "refereeId" TEXT,
    "inviteCode" TEXT NOT NULL,
    "inviteEmail" TEXT,
    "refereeJoinedAt" TIMESTAMP(3),
    "refereeFirstPuzzleSolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_referrals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_referrals_inviteCode_key" ON "user_referrals"("inviteCode");

-- CreateIndex
CREATE INDEX "user_referrals_referrerId_idx" ON "user_referrals"("referrerId");

-- CreateIndex
CREATE INDEX "user_referrals_refereeId_idx" ON "user_referrals"("refereeId");

-- CreateIndex
CREATE INDEX "user_referrals_inviteCode_idx" ON "user_referrals"("inviteCode");

-- AddForeignKey
ALTER TABLE "user_referrals" ADD CONSTRAINT "user_referrals_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_referrals" ADD CONSTRAINT "user_referrals_refereeId_fkey" FOREIGN KEY ("refereeId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
