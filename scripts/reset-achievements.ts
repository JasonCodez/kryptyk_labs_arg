import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function resetAchievements() {
  try {
    // Get all users
    const users = await prisma.user.findMany();
    console.log(`Found ${users.length} users`);

    // Delete all user achievements
    const result = await prisma.userAchievement.deleteMany({});
    console.log(`✓ Deleted ${result.count} user achievements`);

    console.log("\nUser achievements have been reset!");
    console.log("You can now test achievement collection from scratch.");
  } catch (error) {
    console.error("Error resetting achievements:", error);
  } finally {
    await prisma.$disconnect();
  }
}

resetAchievements();
