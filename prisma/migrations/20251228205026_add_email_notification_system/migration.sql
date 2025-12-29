-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "emailRead" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "emailReadAt" TIMESTAMP(3),
ADD COLUMN     "emailSent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "emailSentAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emailOnPuzzleRelease" BOOLEAN NOT NULL DEFAULT true,
    "emailOnAchievement" BOOLEAN NOT NULL DEFAULT true,
    "emailOnTeamUpdate" BOOLEAN NOT NULL DEFAULT true,
    "emailOnLeaderboard" BOOLEAN NOT NULL DEFAULT true,
    "emailOnSystem" BOOLEAN NOT NULL DEFAULT false,
    "enableDigest" BOOLEAN NOT NULL DEFAULT false,
    "digestFrequency" TEXT NOT NULL DEFAULT 'weekly',
    "emailNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_userId_key" ON "notification_preferences"("userId");

-- CreateIndex
CREATE INDEX "notifications_emailSent_idx" ON "notifications"("emailSent");

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
