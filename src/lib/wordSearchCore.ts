export type WordSearchCell = { row: number; col: number };

type Direction = { dr: number; dc: number };

type Placement = {
  startRow: number;
  startCol: number;
  dr: number;
  dc: number;
  shared: number;
  score: number;
  dirKey: string;
};

export type WordSearchGenerationDifficulty = "easy" | "medium" | "hard";

export type WordSearchGenerationOptions = {
  difficulty?: WordSearchGenerationDifficulty;
  themedDecoys?: boolean;
};

export type WordSearchGenerationStats = {
  difficulty: WordSearchGenerationDifficulty;
  targetSharedPerWord: number;
  averageSharedPerPlacedWord: number;
  decoysPlaced: number;
  directionUsage: Record<string, number>;
  placements: Record<string, { dr: number; dc: number; shared: number }>;
};

export type WordSearchGenerationResult = {
  grid: string[][];
  placedWords: string[];
  unplacedWords: string[];
  stats: WordSearchGenerationStats;
};

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

const ENGLISH_LETTER_FREQUENCY: Record<string, number> = {
  A: 8.167,
  B: 1.492,
  C: 2.782,
  D: 4.253,
  E: 12.702,
  F: 2.228,
  G: 2.015,
  H: 6.094,
  I: 6.966,
  J: 0.153,
  K: 0.772,
  L: 4.025,
  M: 2.406,
  N: 6.749,
  O: 7.507,
  P: 1.929,
  Q: 0.095,
  R: 5.987,
  S: 6.327,
  T: 9.056,
  U: 2.758,
  V: 0.978,
  W: 2.360,
  X: 0.150,
  Y: 1.974,
  Z: 0.074,
};

export const WORD_SEARCH_DIRECTIONS: readonly Direction[] = [
  { dr: 0, dc: 1 },
  { dr: 1, dc: 0 },
  { dr: 0, dc: -1 },
  { dr: -1, dc: 0 },
  { dr: 1, dc: 1 },
  { dr: 1, dc: -1 },
  { dr: -1, dc: 1 },
  { dr: -1, dc: -1 },
] as const;

const EASY_DIRECTIONS: readonly Direction[] = [
  { dr: 0, dc: 1 },
  { dr: 1, dc: 0 },
  { dr: 1, dc: 1 },
] as const;

const MEDIUM_DIRECTIONS: readonly Direction[] = [
  { dr: 0, dc: 1 },
  { dr: 1, dc: 0 },
  { dr: 0, dc: -1 },
  { dr: -1, dc: 0 },
  { dr: 1, dc: 1 },
  { dr: -1, dc: -1 },
] as const;

type GenerationProfile = {
  difficulty: WordSearchGenerationDifficulty;
  directions: readonly Direction[];
  targetSharedPerWord: number;
  overlapWeight: number;
  directionBalanceWeight: number;
  fillerBlendFromWordBank: number;
  decoyDensity: number;
  decoyFragmentLengths: readonly number[];
};

const PROFILE_BY_DIFFICULTY: Record<WordSearchGenerationDifficulty, GenerationProfile> = {
  easy: {
    difficulty: "easy",
    directions: EASY_DIRECTIONS,
    targetSharedPerWord: 0,
    overlapWeight: 1.3,
    directionBalanceWeight: 0.2,
    fillerBlendFromWordBank: 0.2,
    decoyDensity: 0.01,
    decoyFragmentLengths: [2],
  },
  medium: {
    difficulty: "medium",
    directions: MEDIUM_DIRECTIONS,
    targetSharedPerWord: 1,
    overlapWeight: 1.0,
    directionBalanceWeight: 0.35,
    fillerBlendFromWordBank: 0.45,
    decoyDensity: 0.03,
    decoyFragmentLengths: [2, 3],
  },
  hard: {
    difficulty: "hard",
    directions: WORD_SEARCH_DIRECTIONS,
    targetSharedPerWord: 2,
    overlapWeight: 0.85,
    directionBalanceWeight: 0.5,
    fillerBlendFromWordBank: 0.7,
    decoyDensity: 0.06,
    decoyFragmentLengths: [3, 4],
  },
};

function directionKey(direction: Direction): string {
  return `${direction.dr},${direction.dc}`;
}

function getGenerationProfile(options?: WordSearchGenerationOptions): GenerationProfile {
  const difficulty = options?.difficulty ?? "medium";
  return PROFILE_BY_DIFFICULTY[difficulty] ?? PROFILE_BY_DIFFICULTY.medium;
}

function computeWordLetterWeights(words: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const letter of ALPHABET) counts[letter] = 0;

  let total = 0;
  for (const word of words) {
    for (const letter of word) {
      if (counts[letter] !== undefined) {
        counts[letter] += 1;
        total += 1;
      }
    }
  }

  if (total === 0) return counts;

  for (const letter of ALPHABET) {
    counts[letter] = counts[letter] / total;
  }
  return counts;
}

function buildFillerWeights(words: string[], blend: number): Array<{ letter: string; weight: number }> {
  const clampedBlend = Math.max(0, Math.min(1, blend));
  const wordWeights = computeWordLetterWeights(words);

  const weights: Array<{ letter: string; weight: number }> = [];
  for (const letter of ALPHABET) {
    const english = (ENGLISH_LETTER_FREQUENCY[letter] ?? 0) / 100;
    const fromWords = wordWeights[letter] ?? 0;
    const mixed = english * (1 - clampedBlend) + fromWords * clampedBlend;
    weights.push({ letter, weight: Math.max(0.0001, mixed) });
  }

  return weights;
}

function pickWeightedLetter(weights: Array<{ letter: string; weight: number }>): string {
  const total = weights.reduce((sum, item) => sum + item.weight, 0);
  if (total <= 0) {
    return ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }

  let cursor = Math.random() * total;
  for (const item of weights) {
    cursor -= item.weight;
    if (cursor <= 0) return item.letter;
  }

  return weights[weights.length - 1]?.letter ?? "E";
}

function buildDecoyFragments(words: string[], fragmentLengths: readonly number[]): string[] {
  const out = new Set<string>();

  for (const word of words) {
    for (const len of fragmentLengths) {
      if (word.length <= len) continue;
      for (let start = 0; start + len <= word.length; start++) {
        const fragment = word.slice(start, start + len);
        out.add(fragment);
        out.add(fragment.split("").reverse().join(""));
      }
    }
  }

  return Array.from(out).filter((f) => f.length >= 2);
}

function tryPlaceDecoys(
  grid: string[][],
  fragments: string[],
  directions: readonly Direction[],
  targetCount: number
): number {
  if (fragments.length === 0 || targetCount <= 0) return 0;

  const size = grid.length;
  let placed = 0;
  const maxAttempts = Math.max(targetCount * 24, 120);

  for (let attempt = 0; attempt < maxAttempts && placed < targetCount; attempt++) {
    const fragment = fragments[Math.floor(Math.random() * fragments.length)];
    const direction = directions[Math.floor(Math.random() * directions.length)];
    const startRow = Math.floor(Math.random() * size);
    const startCol = Math.floor(Math.random() * size);

    const endRow = startRow + direction.dr * (fragment.length - 1);
    const endCol = startCol + direction.dc * (fragment.length - 1);
    if (endRow < 0 || endRow >= size || endCol < 0 || endCol >= size) continue;

    let canPlace = true;
    for (let i = 0; i < fragment.length; i++) {
      const row = startRow + direction.dr * i;
      const col = startCol + direction.dc * i;
      if (grid[row][col] !== "") {
        canPlace = false;
        break;
      }
    }

    if (!canPlace) continue;

    for (let i = 0; i < fragment.length; i++) {
      const row = startRow + direction.dr * i;
      const col = startCol + direction.dc * i;
      grid[row][col] = fragment[i];
    }
    placed++;
  }

  return placed;
}

export function normalizeWord(input: unknown): string {
  return String(input ?? "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .trim();
}

export function normalizeWordList(input: unknown): string[] {
  const source = Array.isArray(input) ? input : [];
  const out: string[] = [];
  const seen = new Set<string>();

  for (const raw of source) {
    const word = normalizeWord(raw);
    if (word.length < 2 || seen.has(word)) continue;
    seen.add(word);
    out.push(word);
  }

  return out;
}

export function normalizeWordSearchGrid(input: unknown): string[][] {
  if (!Array.isArray(input)) return [];

  return input.map((row) => {
    if (!Array.isArray(row)) return [] as string[];

    return row.map((cell) => {
      const normalized = normalizeWord(cell);
      return normalized.charAt(0) || "";
    });
  });
}

export function isSquareLetterGrid(grid: string[][]): boolean {
  if (!Array.isArray(grid) || grid.length === 0) return false;
  const size = grid.length;

  for (const row of grid) {
    if (!Array.isArray(row) || row.length !== size) return false;
    for (const cell of row) {
      if (!/^[A-Z]$/.test(cell)) return false;
    }
  }

  return true;
}

export function isCellInBounds(cell: WordSearchCell, grid: string[][]): boolean {
  return (
    Number.isInteger(cell.row) &&
    Number.isInteger(cell.col) &&
    cell.row >= 0 &&
    cell.col >= 0 &&
    cell.row < grid.length &&
    cell.col < (grid[cell.row]?.length ?? 0)
  );
}

export function findWordInGrid(wordInput: unknown, grid: string[][]): WordSearchCell[] | null {
  const word = normalizeWord(wordInput);
  if (!word || !isSquareLetterGrid(grid)) return null;

  const size = grid.length;

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      for (const { dr, dc } of WORD_SEARCH_DIRECTIONS) {
        const cells: WordSearchCell[] = [];
        let ok = true;

        for (let i = 0; i < word.length; i++) {
          const r = row + dr * i;
          const c = col + dc * i;
          if (r < 0 || r >= size || c < 0 || c >= size || grid[r]?.[c] !== word[i]) {
            ok = false;
            break;
          }
          cells.push({ row: r, col: c });
        }

        if (ok) return cells;
      }
    }
  }

  return null;
}

export function cellsAreStraightContiguous(cells: WordSearchCell[]): boolean {
  if (!Array.isArray(cells) || cells.length === 0) return false;
  if (cells.length === 1) return true;

  const seen = new Set<string>();
  for (const cell of cells) {
    if (!Number.isInteger(cell.row) || !Number.isInteger(cell.col)) return false;
    const key = `${cell.row},${cell.col}`;
    if (seen.has(key)) return false;
    seen.add(key);
  }

  const dr = cells[1].row - cells[0].row;
  const dc = cells[1].col - cells[0].col;
  const stepR = Math.sign(dr);
  const stepC = Math.sign(dc);

  if (stepR === 0 && stepC === 0) return false;
  if (stepR !== 0 && stepC !== 0 && Math.abs(dr) !== Math.abs(dc)) return false;

  for (let i = 1; i < cells.length; i++) {
    const expectedRow = cells[0].row + stepR * i;
    const expectedCol = cells[0].col + stepC * i;
    if (cells[i].row !== expectedRow || cells[i].col !== expectedCol) return false;
  }

  return true;
}

export function spelledWordFromCells(cells: WordSearchCell[], grid: string[][]): string | null {
  if (!cellsAreStraightContiguous(cells)) return null;

  const letters: string[] = [];
  for (const cell of cells) {
    if (!isCellInBounds(cell, grid)) return null;
    const letter = grid[cell.row]?.[cell.col];
    if (!/^[A-Z]$/.test(letter ?? "")) return null;
    letters.push(letter);
  }

  return letters.join("");
}

export function validateWordSelection(
  wordInput: unknown,
  grid: string[][],
  cellsInput: unknown
): { valid: boolean; error?: string } {
  const word = normalizeWord(wordInput);
  if (!word) return { valid: false, error: "No word provided" };
  if (!isSquareLetterGrid(grid)) return { valid: false, error: "Invalid grid" };
  if (!Array.isArray(cellsInput)) return { valid: false, error: "Selection is missing" };

  const cells = cellsInput as WordSearchCell[];

  if (cells.length !== word.length) {
    return { valid: false, error: "Selection length does not match word length" };
  }

  const spelled = spelledWordFromCells(cells, grid);
  if (!spelled) return { valid: false, error: "Selection must be a straight contiguous line" };

  const reversed = spelled.split("").reverse().join("");
  if (spelled !== word && reversed !== word) {
    return { valid: false, error: "Selected letters do not match word" };
  }

  return { valid: true };
}

export function generateWordSearchGrid(
  wordsInput: unknown,
  gridSizeInput: unknown,
  options?: WordSearchGenerationOptions
): WordSearchGenerationResult {
  const profile = getGenerationProfile(options);
  const gridSizeRaw = typeof gridSizeInput === "number" ? gridSizeInput : Number(gridSizeInput);
  const gridSize = Number.isFinite(gridSizeRaw) ? Math.floor(gridSizeRaw) : 12;
  if (gridSize < 2) {
    return {
      grid: [],
      placedWords: [],
      unplacedWords: normalizeWordList(wordsInput),
      stats: {
        difficulty: profile.difficulty,
        targetSharedPerWord: profile.targetSharedPerWord,
        averageSharedPerPlacedWord: 0,
        decoysPlaced: 0,
        directionUsage: {},
        placements: {},
      },
    };
  }

  const normalizedWords = normalizeWordList(wordsInput);
  const tooLong = normalizedWords.filter((word) => word.length > gridSize);
  const candidateWords = normalizedWords.filter((word) => word.length <= gridSize);

  if (candidateWords.length === 0) {
    return {
      grid: [],
      placedWords: [],
      unplacedWords: [...tooLong],
      stats: {
        difficulty: profile.difficulty,
        targetSharedPerWord: profile.targetSharedPerWord,
        averageSharedPerPlacedWord: 0,
        decoysPlaced: 0,
        directionUsage: {},
        placements: {},
      },
    };
  }

  const grid: string[][] = Array.from({ length: gridSize }, () => Array(gridSize).fill(""));
  const directionUsage = new Map<string, number>();
  const placementStats: Record<string, { dr: number; dc: number; shared: number }> = {};
  let totalShared = 0;

  const countShared = (word: string, startRow: number, startCol: number, dr: number, dc: number): number => {
    let shared = 0;
    for (let i = 0; i < word.length; i++) {
      if (grid[startRow + dr * i]?.[startCol + dc * i] === word[i]) shared++;
    }
    return shared;
  };

  const wordsByPlacementOrder = [...candidateWords].sort((a, b) => b.length - a.length);
  const placedSet = new Set<string>();

  for (const word of wordsByPlacementOrder) {
    const validPlacements: Placement[] = [];

    for (const direction of profile.directions) {
      const { dr, dc } = direction;
      const dirKey = directionKey(direction);
      for (let startRow = 0; startRow < gridSize; startRow++) {
        for (let startCol = 0; startCol < gridSize; startCol++) {
          const endRow = startRow + dr * (word.length - 1);
          const endCol = startCol + dc * (word.length - 1);
          if (endRow < 0 || endRow >= gridSize || endCol < 0 || endCol >= gridSize) continue;

          let ok = true;
          for (let i = 0; i < word.length; i++) {
            const row = startRow + dr * i;
            const col = startCol + dc * i;
            const cell = grid[row][col];
            if (cell !== "" && cell !== word[i]) {
              ok = false;
              break;
            }
          }

          if (!ok) continue;

          const shared = countShared(word, startRow, startCol, dr, dc);
          const overlapPenalty = Math.abs(shared - profile.targetSharedPerWord) * profile.overlapWeight;
          const usedInDirection = directionUsage.get(dirKey) ?? 0;
          const directionPenalty = usedInDirection * profile.directionBalanceWeight;
          const score = -overlapPenalty - directionPenalty + Math.random() * 0.35;

          validPlacements.push({
            startRow,
            startCol,
            dr,
            dc,
            shared,
            score,
            dirKey,
          });
        }
      }
    }

    if (validPlacements.length === 0) continue;

    validPlacements.sort((a, b) => b.score - a.score);
    const topN = Math.min(6, validPlacements.length);
    const choice = validPlacements[Math.floor(Math.random() * topN)];

    for (let i = 0; i < word.length; i++) {
      const row = choice.startRow + choice.dr * i;
      const col = choice.startCol + choice.dc * i;
      grid[row][col] = word[i];
    }

    placedSet.add(word);
    totalShared += choice.shared;
    placementStats[word] = { dr: choice.dr, dc: choice.dc, shared: choice.shared };
    directionUsage.set(choice.dirKey, (directionUsage.get(choice.dirKey) ?? 0) + 1);
  }

  const placedWords = candidateWords.filter((word) => placedSet.has(word));

  let decoysPlaced = 0;
  if ((options?.themedDecoys ?? true) && placedWords.length > 0) {
    const fragments = buildDecoyFragments(placedWords, profile.decoyFragmentLengths);
    const targetDecoys = Math.max(0, Math.floor(gridSize * gridSize * profile.decoyDensity));
    decoysPlaced = tryPlaceDecoys(grid, fragments, profile.directions, targetDecoys);
  }

  const fillerWeights = buildFillerWeights(placedWords, profile.fillerBlendFromWordBank);

  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      if (grid[row][col] === "") {
        grid[row][col] = pickWeightedLetter(fillerWeights);
      }
    }
  }

  const unplacedWords = [
    ...tooLong,
    ...candidateWords.filter((word) => !placedSet.has(word)),
  ];

  const averageSharedPerPlacedWord = placedWords.length > 0 ? totalShared / placedWords.length : 0;
  const directionUsageObject = Object.fromEntries(directionUsage.entries());

  return {
    grid,
    placedWords,
    unplacedWords,
    stats: {
      difficulty: profile.difficulty,
      targetSharedPerWord: profile.targetSharedPerWord,
      averageSharedPerPlacedWord,
      decoysPlaced,
      directionUsage: directionUsageObject,
      placements: placementStats,
    },
  };
}

export function validateWordSearchPuzzleData(data: unknown): {
  valid: boolean;
  error?: string;
  normalized?: { grid: string[][]; words: string[] };
} {
  if (!data || typeof data !== "object") {
    return { valid: false, error: "Word Trove puzzleData is missing." };
  }

  const payload = data as Record<string, unknown>;
  const grid = normalizeWordSearchGrid(payload.grid);
  if (!isSquareLetterGrid(grid)) {
    return { valid: false, error: "Word Trove requires a square letter grid (A-Z only)." };
  }

  const words = normalizeWordList(payload.words);
  if (words.length < 2) {
    return { valid: false, error: "Word Trove requires at least 2 unique words." };
  }

  const gridSize = grid.length;
  const tooLong = words.filter((word) => word.length > gridSize);
  if (tooLong.length > 0) {
    return {
      valid: false,
      error: `Word(s) longer than grid size ${gridSize}: ${tooLong.slice(0, 5).join(", ")}`,
    };
  }

  const unplaceable = words.filter((word) => !findWordInGrid(word, grid));
  if (unplaceable.length > 0) {
    return {
      valid: false,
      error: `Word(s) not present in grid: ${unplaceable.slice(0, 5).join(", ")}`,
    };
  }

  return {
    valid: true,
    normalized: {
      grid,
      words,
    },
  };
}
