/*
  Warnings:

  - You are about to drop the `jigsaw_puzzle_pieces` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `jigsaw_puzzles` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `user_jigsaw_progress` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "jigsaw_puzzle_pieces" DROP CONSTRAINT "jigsaw_puzzle_pieces_jigsawId_fkey";

-- DropForeignKey
ALTER TABLE "jigsaw_puzzles" DROP CONSTRAINT "jigsaw_puzzles_puzzleId_fkey";

-- DropForeignKey
ALTER TABLE "user_jigsaw_progress" DROP CONSTRAINT "user_jigsaw_progress_jigsawId_fkey";

-- DropForeignKey
ALTER TABLE "user_jigsaw_progress" DROP CONSTRAINT "user_jigsaw_progress_userId_fkey";

-- DropTable
DROP TABLE "jigsaw_puzzle_pieces";

-- DropTable
DROP TABLE "jigsaw_puzzles";

-- DropTable
DROP TABLE "user_jigsaw_progress";
