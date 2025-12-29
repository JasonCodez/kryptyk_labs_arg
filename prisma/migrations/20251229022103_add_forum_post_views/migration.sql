-- CreateTable
CREATE TABLE "forum_post_views" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "postId" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "forum_post_views_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "forum_post_views_userId_idx" ON "forum_post_views"("userId");

-- CreateIndex
CREATE INDEX "forum_post_views_postId_idx" ON "forum_post_views"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "forum_post_views_userId_postId_key" ON "forum_post_views"("userId", "postId");

-- AddForeignKey
ALTER TABLE "forum_post_views" ADD CONSTRAINT "forum_post_views_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_post_views" ADD CONSTRAINT "forum_post_views_postId_fkey" FOREIGN KEY ("postId") REFERENCES "forum_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
