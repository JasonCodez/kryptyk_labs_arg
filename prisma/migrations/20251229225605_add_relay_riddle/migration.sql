-- CreateTable
CREATE TABLE "relay_riddles" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "puzzleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'waiting',
    "solverClues" TEXT NOT NULL,
    "solverAnswer" TEXT NOT NULL,
    "encryptedMsg" TEXT NOT NULL,
    "cipherType" TEXT NOT NULL DEFAULT 'shift',
    "solverUserId" TEXT,
    "decoderUserId" TEXT,
    "solverSubmittedAt" TIMESTAMP(3),
    "solvedAt" TIMESTAMP(3),

    CONSTRAINT "relay_riddles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "relay_messages" (
    "id" TEXT NOT NULL,
    "relayId" TEXT NOT NULL,
    "userId" TEXT,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "relay_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "relay_riddles_roomId_key" ON "relay_riddles"("roomId");

-- CreateIndex
CREATE INDEX "relay_riddles_roomId_idx" ON "relay_riddles"("roomId");

-- CreateIndex
CREATE INDEX "relay_riddles_status_idx" ON "relay_riddles"("status");

-- CreateIndex
CREATE INDEX "relay_messages_relayId_idx" ON "relay_messages"("relayId");

-- CreateIndex
CREATE INDEX "relay_messages_userId_idx" ON "relay_messages"("userId");

-- AddForeignKey
ALTER TABLE "relay_riddles" ADD CONSTRAINT "relay_riddles_solverUserId_fkey" FOREIGN KEY ("solverUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relay_riddles" ADD CONSTRAINT "relay_riddles_decoderUserId_fkey" FOREIGN KEY ("decoderUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relay_messages" ADD CONSTRAINT "relay_messages_relayId_fkey" FOREIGN KEY ("relayId") REFERENCES "relay_riddles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relay_messages" ADD CONSTRAINT "relay_messages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
