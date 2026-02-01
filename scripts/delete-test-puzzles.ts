import prisma from "../src/lib/prisma";

// Usage examples:
//  npx tsx scripts/delete-test-puzzles.ts            # dry-run, lists candidates
//  npx tsx scripts/delete-test-puzzles.ts --match test --days 30   # list puzzles with "test" in title or created in last 30 days
//  npx tsx scripts/delete-test-puzzles.ts --match test --confirm  # actually delete

const argv = process.argv.slice(2);
const params: Record<string, string | boolean> = {};
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith("--")) {
    const key = a.replace(/^--/, "");
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      params[key] = true;
    } else {
      params[key] = next;
      i++;
    }
  }
}

(async () => {
  try {
    const match = (params.match as string) || "test";
    const days = params.days ? Number(params.days) : undefined;
    const limit = params.limit ? Number(params.limit) : undefined;
    const confirm = Boolean(params.confirm);

    const where: any = {
      OR: [
        { title: { contains: match, mode: "insensitive" } },
      ],
    };

    if (typeof days === "number" && !Number.isNaN(days)) {
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      where.OR.push({ createdAt: { gte: since } });
    }

    const candidates = await prisma.puzzle.findMany({
      where,
      include: { sudoku: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    if (candidates.length === 0) {
      console.log("No matching puzzles found.");
      process.exit(0);
    }

    console.log(`Found ${candidates.length} matching puzzle(s):\n`);
    candidates.forEach((p) => {
      console.log(`${p.id} | ${p.title} | type=${p.puzzleType} | created=${p.createdAt.toISOString()}${p.sudoku ? ' | sudoku' : ''}`);
    });

    if (!confirm) {
      console.log('\nDry run: no deletions performed.');
      console.log('To delete these puzzles, re-run with --confirm');
      process.exit(0);
    }

    // Perform deletion using the same where clause
    const deleteRes = await prisma.puzzle.deleteMany({ where });
    console.log(`\nDeleted ${deleteRes.count} puzzle(s).`);
    process.exit(0);
  } catch (err) {
    console.error('Failed to list/delete puzzles:', err);
    process.exit(2);
  } finally {
    try { await prisma.$disconnect(); } catch (e) {}
  }
})();
