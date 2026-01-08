#!/usr/bin/env node

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function resetAllUsers() {
  try {
    console.log("🔄 Starting user and puzzle completion reset...\n");

    // Reset user achievements
    const achievementsDeleted = await prisma.userAchievement.deleteMany({});
    console.log(`✅ Deleted ${achievementsDeleted.count} user achievements`);

    // Reset user puzzle progress
    const progressDeleted = await prisma.userPuzzleProgress.deleteMany({});
    console.log(`✅ Deleted ${progressDeleted.count} user puzzle progress records`);

    // Reset team progress
    const teamProgressDeleted = await prisma.teamProgress.deleteMany({});
    console.log(`✅ Deleted ${teamProgressDeleted.count} team progress records`);

    // Reset team puzzle part submissions
    const teamPartSubmissionsDeleted = await prisma.teamPuzzlePartSubmission.deleteMany({});
    console.log(`✅ Deleted ${teamPartSubmissionsDeleted.count} team puzzle part submissions`);

    // Reset team puzzle completions
    const teamCompletionsDeleted = await prisma.teamPuzzleCompletion.deleteMany({});
    console.log(`✅ Deleted ${teamCompletionsDeleted.count} team puzzle completions`);

    // Reset puzzle submissions
    const submissionsDeleted = await prisma.puzzleSubmission.deleteMany({});
    console.log(`✅ Deleted ${submissionsDeleted.count} puzzle submissions`);

    console.log("\n✨ All users' points and puzzle completions have been reset!");
  } catch (error) {
    console.error("❌ Error resetting data:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

resetAllUsers();
