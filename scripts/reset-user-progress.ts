import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function resetUserProgress() {
  try {
    // Get all users
    const users = await prisma.user.findMany();
    console.log(`Found ${users.length} users`);

    for (const user of users) {
      console.log(`\nResetting progress for ${user.email}...`);

      // Delete all puzzle progress for this user
      const progressResult = await prisma.userPuzzleProgress.deleteMany({
        where: { userId: user.id },
      });
      console.log(`  ✓ Deleted ${progressResult.count} puzzle progress records`);

      // Delete all puzzle submissions for this user
      const submissionResult = await prisma.puzzleSubmission.deleteMany({
        where: { userId: user.id },
      });
      console.log(`  ✓ Deleted ${submissionResult.count} puzzle submissions`);

      // Delete all user achievements for this user
      const achievementResult = await prisma.userAchievement.deleteMany({
        where: { userId: user.id },
      });
      console.log(`  ✓ Deleted ${achievementResult.count} achievements`);
    }

    console.log("\n✓ All user progress has been reset!");
    console.log("You can now test achievements from scratch.");
  } catch (error) {
    console.error("Error resetting progress:", error);
  } finally {
    await prisma.$disconnect();
  }
}

resetUserProgress();
