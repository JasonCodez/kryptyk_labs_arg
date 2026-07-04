-- AlterTable
ALTER TABLE "users" ADD COLUMN     "slotPityCounter" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "slot_spin_records" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "tier" TEXT NOT NULL,
    "prizeType" TEXT NOT NULL,
    "prizeKey" TEXT,
    "prizeAmount" INTEGER,
    "pityTriggered" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "slot_spin_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "slot_spin_records_userId_idx" ON "slot_spin_records"("userId");

-- CreateIndex
CREATE INDEX "slot_spin_records_createdAt_idx" ON "slot_spin_records"("createdAt");

-- AddForeignKey
ALTER TABLE "slot_spin_records" ADD CONSTRAINT "slot_spin_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

