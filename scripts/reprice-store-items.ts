import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// One-off: apply the 5x store price increase (see scripts/seed-store.ts) to
// StoreItem rows that were already seeded before the price change landed.
// Exclusive (isExclusive: true) items are untouched -- they're earned, not
// bought with points, and are seeded at price 0.
const MULTIPLIER = 5;

async function main() {
  const items = await prisma.storeItem.findMany({
    where: { isExclusive: false, price: { gt: 0 } },
    select: { id: true, key: true, name: true, price: true },
  });

  console.log(`Found ${items.length} purchasable store item(s) to reprice.\n`);

  for (const item of items) {
    const newPrice = item.price * MULTIPLIER;
    await prisma.storeItem.update({
      where: { id: item.id },
      data: { price: newPrice },
    });
    console.log(`  ${item.key.padEnd(24)} ${item.price} -> ${newPrice}`);
  }

  console.log(`\nDone. Repriced ${items.length} item(s).`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
