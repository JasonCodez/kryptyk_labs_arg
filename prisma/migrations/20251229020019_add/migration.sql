-- CreateTable
CREATE TABLE "forum_posts" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "puzzleId" TEXT,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "replyCount" INTEGER NOT NULL DEFAULT 0,
    "upvotes" INTEGER NOT NULL DEFAULT 0,
    "downvotes" INTEGER NOT NULL DEFAULT 0,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "forum_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forum_comments" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "replyToId" TEXT,
    "upvotes" INTEGER NOT NULL DEFAULT 0,
    "downvotes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "forum_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forum_post_votes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "voteType" TEXT NOT NULL DEFAULT 'up',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "forum_post_votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forum_comment_votes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "voteType" TEXT NOT NULL DEFAULT 'up',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "forum_comment_votes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "forum_posts_authorId_idx" ON "forum_posts"("authorId");

-- CreateIndex
CREATE INDEX "forum_posts_puzzleId_idx" ON "forum_posts"("puzzleId");

-- CreateIndex
CREATE INDEX "forum_posts_createdAt_idx" ON "forum_posts"("createdAt");

-- CreateIndex
CREATE INDEX "forum_posts_isPinned_idx" ON "forum_posts"("isPinned");

-- CreateIndex
CREATE INDEX "forum_comments_authorId_idx" ON "forum_comments"("authorId");

-- CreateIndex
CREATE INDEX "forum_comments_postId_idx" ON "forum_comments"("postId");

-- CreateIndex
CREATE INDEX "forum_comments_replyToId_idx" ON "forum_comments"("replyToId");

-- CreateIndex
CREATE INDEX "forum_comments_createdAt_idx" ON "forum_comments"("createdAt");

-- CreateIndex
CREATE INDEX "forum_post_votes_userId_idx" ON "forum_post_votes"("userId");

-- CreateIndex
CREATE INDEX "forum_post_votes_postId_idx" ON "forum_post_votes"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "forum_post_votes_userId_postId_key" ON "forum_post_votes"("userId", "postId");

-- CreateIndex
CREATE INDEX "forum_comment_votes_userId_idx" ON "forum_comment_votes"("userId");

-- CreateIndex
CREATE INDEX "forum_comment_votes_commentId_idx" ON "forum_comment_votes"("commentId");

-- CreateIndex
CREATE UNIQUE INDEX "forum_comment_votes_userId_commentId_key" ON "forum_comment_votes"("userId", "commentId");

-- AddForeignKey
ALTER TABLE "forum_posts" ADD CONSTRAINT "forum_posts_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_posts" ADD CONSTRAINT "forum_posts_puzzleId_fkey" FOREIGN KEY ("puzzleId") REFERENCES "puzzles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_comments" ADD CONSTRAINT "forum_comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_comments" ADD CONSTRAINT "forum_comments_postId_fkey" FOREIGN KEY ("postId") REFERENCES "forum_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_comments" ADD CONSTRAINT "forum_comments_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "forum_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_post_votes" ADD CONSTRAINT "forum_post_votes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_post_votes" ADD CONSTRAINT "forum_post_votes_postId_fkey" FOREIGN KEY ("postId") REFERENCES "forum_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_comment_votes" ADD CONSTRAINT "forum_comment_votes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_comment_votes" ADD CONSTRAINT "forum_comment_votes_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "forum_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
