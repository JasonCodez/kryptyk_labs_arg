import { generateSudoku } from "../src/lib/sudoku-engine";

async function run() {
  console.log("Generating extreme puzzle (server would run this)...");
  const start = Date.now();
  const gen = generateSudoku('extreme' as any);
  const ms = Date.now() - start;
  console.log(`Generated in ${ms}ms. Puzzle empty count: ${gen.puzzle.flat().filter(n=>n===0).length}`);
  // Verify uniqueness
  console.log("Sample rows:", gen.puzzle[0].slice(0,9));
}

run().catch(err=>{ console.error(err); process.exit(1); });
