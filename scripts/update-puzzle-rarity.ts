import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function updatePuzzleRarity() {
  try {
    const puzzles = await prisma.puzzle.findMany({
      select: { id: true },
    });

    const rarities = ["common", "uncommon", "rare", "epic", "legendary"];
    
    for (let i = 0; i < puzzles.length; i++) {
      const rarity = rarities[i % rarities.length];
      await prisma.puzzle.update({
        where: { id: puzzles[i].id },
        data: { rarity },
      });
      console.log(`Updated puzzle ${puzzles[i].id} to ${rarity}`);
    }

    console.log("✓ All puzzles updated with rarity values");
  } catch (error) {
    console.error("Failed to update puzzle rarity:", error);
  } finally {
    await prisma.$disconnect();
  }
}

updatePuzzleRarity();
