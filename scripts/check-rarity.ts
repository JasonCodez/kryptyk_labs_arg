import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function checkRarity() {
  try {
    const puzzles = await prisma.puzzle.findMany({
      select: {
        id: true,
        title: true,
        rarity: true,
      },
      take: 5,
    });

    console.log("Puzzles with rarity:");
    console.log(JSON.stringify(puzzles, null, 2));
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkRarity();
