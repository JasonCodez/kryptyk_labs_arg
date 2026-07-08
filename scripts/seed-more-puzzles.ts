/**
 * seed-more-puzzles.ts
 * Adds 25 new puzzles each for: word_search, word_crack, anagram_blitz, blackout
 *
 * Reward scaling:
 *   word_search  — easy 50/30, medium 100/60, hard 200/120 (pts/xp)
 *   word_crack   — 4-letter 50/30 → 5-letter 100/60 → 6-letter 150/90 → 7-letter 200/120 → 8-letter 275/165
 *   anagram_blitz— easy 50/30 (90s, 3-4 words), medium 120/72 (60s, 5 words), hard 200/120 (45s, 6-8 words)
 *   blackout     — easy 75/45 (2-3 redactions), medium 150/90 (4-5), hard 300/180 (6-9)
 *
 * Run: npx tsx scripts/seed-more-puzzles.ts
 * Safe to re-run — title-based deduplication.
 */

import { PrismaClient } from "@prisma/client";
import path from "path";
import { config } from "dotenv";

config({ path: path.resolve(process.cwd(), ".env.local") });
config({ path: path.resolve(process.cwd(), ".env") });

const prisma = new PrismaClient();

// ── Helpers ───────────────────────────────────────────────────────────────────
type Difficulty = "easy" | "medium" | "hard";

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function titleExists(title: string): Promise<boolean> {
  const c = await prisma.puzzle.count({ where: { title } });
  return c > 0;
}

async function getOrCreateCategory(name: string, color: string) {
  return prisma.puzzleCategory.upsert({
    where: { name },
    update: {},
    create: { name, description: `${name} puzzles`, color },
  });
}

// ── Word Search Grid Generator (copy from seed-puzzles.ts) ───────────────────
function generateWordSearchGrid(words: string[], gridSize: number): string[][] {
  const grid: string[][] = Array.from({ length: gridSize }, () =>
    Array.from({ length: gridSize }, () => "")
  );
  const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const dirs = [
    [0, 1], [0, -1], [1, 0], [-1, 0],
    [1, 1], [1, -1], [-1, 1], [-1, -1],
  ];

  for (const word of words) {
    let placed = false;
    for (let attempt = 0; attempt < 200 && !placed; attempt++) {
      const [dr, dc] = pick(dirs);
      const maxR = gridSize - dr * (word.length - 1);
      const maxC = gridSize - dc * (word.length - 1);
      const minR = dr < 0 ? (word.length - 1) * Math.abs(dr) : 0;
      const minC = dc < 0 ? (word.length - 1) * Math.abs(dc) : 0;
      if (maxR <= minR || maxC <= minC) continue;
      const startR = minR + Math.floor(Math.random() * (maxR - minR));
      const startC = minC + Math.floor(Math.random() * (maxC - minC));
      let ok = true;
      for (let i = 0; i < word.length; i++) {
        const r = startR + dr * i;
        const c = startC + dc * i;
        if (r < 0 || r >= gridSize || c < 0 || c >= gridSize) { ok = false; break; }
        if (grid[r][c] !== "" && grid[r][c] !== word[i]) { ok = false; break; }
      }
      if (ok) {
        for (let i = 0; i < word.length; i++) {
          grid[startR + dr * i][startC + dc * i] = word[i];
        }
        placed = true;
      }
    }
  }

  for (let r = 0; r < gridSize; r++)
    for (let c = 0; c < gridSize; c++)
      if (grid[r][c] === "")
        grid[r][c] = LETTERS[Math.floor(Math.random() * LETTERS.length)];

  return grid;
}

// ═══════════════════════════════════════════════════════════════════════════════
// WORD SEARCH DATA — 25 unique themes
// ═══════════════════════════════════════════════════════════════════════════════
interface WsSet { theme: string; words: string[]; difficulty: Difficulty; }

const WS_SETS: WsSet[] = [
  // Easy (9) — 10×10 grid ─────────────────────────────────────────────────────
  { difficulty: "easy",   theme: "Chemistry",          words: ["ATOM", "BOND", "CARBON", "OXIDE", "METAL", "FLASK"] },
  { difficulty: "easy",   theme: "Superheroes",         words: ["CAPE", "SHIELD", "MASK", "POWER", "LASER", "HERO"] },
  { difficulty: "easy",   theme: "Insects",             words: ["BEE", "MOTH", "WASP", "BEETLE", "CRICKET", "FLEA"] },
  { difficulty: "easy",   theme: "Tools",               words: ["DRILL", "HAMMER", "WRENCH", "LEVER", "PLIERS", "CLAMP"] },
  { difficulty: "easy",   theme: "Flowers",             words: ["TULIP", "ORCHID", "DAISY", "POPPY", "LILAC", "VIOLET"] },
  { difficulty: "easy",   theme: "Birds",               words: ["ROBIN", "CRANE", "WREN", "SWIFT", "DOVE", "ROOK", "FINCH"] },
  { difficulty: "easy",   theme: "Furniture",           words: ["CHAIR", "TABLE", "BENCH", "SHELF", "STOOL", "CHEST"] },
  { difficulty: "easy",   theme: "Cooking Verbs",       words: ["ROAST", "SAUTE", "BROIL", "POACH", "MINCE", "GRILL"] },
  { difficulty: "easy",   theme: "Fashion",             words: ["SKIRT", "LAPEL", "PLEAT", "GOWN", "SEAM", "TRIM", "LACE"] },
  // Medium (9) — 12×12 grid ────────────────────────────────────────────────────
  { difficulty: "medium", theme: "Constellations",      words: ["ORION", "LYRA", "DRACO", "HYDRA", "AQUILA", "CYGNUS"] },
  { difficulty: "medium", theme: "Martial Arts",        words: ["JUDO", "KARATE", "KENDO", "AIKIDO", "BOXING", "SUMO"] },
  { difficulty: "medium", theme: "Psychology",          words: ["MEMORY", "REFLEX", "TRAUMA", "PHOBIA", "MOTIVE", "RECALL"] },
  { difficulty: "medium", theme: "Card Games",          words: ["RUMMY", "POKER", "BRIDGE", "CANASTA", "HEARTS", "SPADES"] },
  { difficulty: "medium", theme: "Volcanoes",           words: ["MAGMA", "TEPHRA", "CALDERA", "PUMICE", "CRATER", "LAHAR"] },
  { difficulty: "medium", theme: "Ancient Wonders",     words: ["BABYLON", "OLYMPIA", "EPHESUS", "PHAROS", "COLOSSUS", "MAUSOLUS"] },
  { difficulty: "medium", theme: "Crime",               words: ["WARRANT", "SUSPECT", "ALIBI", "MOTIVE", "PAROLE", "VERDICT"] },
  { difficulty: "medium", theme: "Philosophy",          words: ["LOGOS", "ETHICS", "VIRTUE", "REASON", "AXIOM", "DOGMA"] },
  { difficulty: "medium", theme: "Currencies",          words: ["YUAN", "RUPEE", "FRANC", "PESO", "ZLOTY", "RAND"] },
  // Hard (7) — 15×15 grid ──────────────────────────────────────────────────────
  { difficulty: "hard",   theme: "Espionage",           words: ["CIPHER", "ASSET", "HANDLER", "CUTOUT", "LEGEND", "TRADECRAFT"] },
  { difficulty: "hard",   theme: "Quantum Physics",     words: ["QUARK", "LEPTON", "PHOTON", "FERMION", "BOSON", "HADRON", "GLUON"] },
  { difficulty: "hard",   theme: "Linguistics II",      words: ["SYNTAX", "MORPHEME", "LEXEME", "PHONEME", "GRAPHEME", "DIPHTHONG"] },
  { difficulty: "hard",   theme: "World Cuisines",      words: ["KIMCHI", "TAGINE", "RENDANG", "HARISSA", "PIEROGI", "SCHNITZEL"] },
  { difficulty: "hard",   theme: "Astronomy II",        words: ["PULSAR", "PARSEC", "ZENITH", "APOGEE", "PERIHELION", "QUASAR"] },
  { difficulty: "hard",   theme: "Medieval Warfare",    words: ["TREBUCHET", "BALLISTA", "WARHORSE", "PHALANX", "SIEGE", "DESTRIER"] },
  { difficulty: "hard",   theme: "Architecture Styles", words: ["BAROQUE", "GOTHIC", "ROCOCO", "BRUTALIST", "MODERNIST", "DORIC", "IONIC"] },
];

const WS_POINTS: Record<Difficulty, number>   = { easy: 50,  medium: 100, hard: 200 };
const WS_XP:     Record<Difficulty, number>   = { easy: 30,  medium: 60,  hard: 120 };
const WS_GRID:   Record<Difficulty, number>   = { easy: 10,  medium: 12,  hard: 15  };

// ═══════════════════════════════════════════════════════════════════════════════
// WORDSCRY DATA — 25 words of varying length
// ═══════════════════════════════════════════════════════════════════════════════
interface WcWord { word: string; hint: string; }

const WC_WORDS: WcWord[] = [
  // 4-letter (5) — easy, 50 pts / 30 xp
  { word: "MYTH",  hint: "A traditional story involving supernatural beings" },
  { word: "AXIS",  hint: "An imaginary line around which something rotates" },
  { word: "GLOW",  hint: "A steady warm light or warmth" },
  { word: "APEX",  hint: "The highest or topmost point" },
  { word: "RAZE",  hint: "To completely destroy a building to the ground" },
  // 5-letter (8) — medium, 100 pts / 60 xp
  { word: "BLAZE", hint: "A large fierce fire" },
  { word: "SCOUT", hint: "To explore or reconnoiter an area ahead" },
  { word: "QUIRK", hint: "A peculiar behavioral habit or characteristic" },
  { word: "PLUME", hint: "A long cloud of smoke, or an ornamental feather" },
  { word: "VENOM", hint: "Poisonous liquid produced by snakes and spiders" },
  { word: "CRYPT", hint: "A stone chamber beneath a church" },
  { word: "THANE", hint: "A medieval Scottish lord or landholder" },
  { word: "EMBER", hint: "A glowing piece of coal left in a dying fire" },
  // 6-letter (6) — hard, 150 pts / 90 xp
  { word: "MENACE",  hint: "A person or thing that poses a threat" },
  { word: "FATHOM",  hint: "To understand fully, or a unit of sea depth" },
  { word: "JUNGLE",  hint: "Wild land covered with dense tropical vegetation" },
  { word: "HAGGLE",  hint: "To argue persistently about the price of something" },
  { word: "WALRUS",  hint: "A large marine mammal with long ivory tusks" },
  { word: "MYRTLE",  hint: "A fragrant flowering evergreen shrub" },
  // 7-letter (4) — hard, 200 pts / 120 xp
  { word: "PHANTOM",  hint: "A ghost or something insubstantial and illusive" },
  { word: "COURAGE",  hint: "The ability to do something despite fear" },
  { word: "BLAZING",  hint: "Burning very fiercely and brightly" },
  { word: "TRIUMPH",  hint: "A great victory or achievement" },
  // 8-letter (2) — hard, 275 pts / 165 xp
  { word: "CLOISTER", hint: "A covered walkway in a monastery or convent" },
  { word: "FRACTURE", hint: "A crack or break in a bone or hard material" },
];

function wcPoints(length: number): number {
  if (length <= 4) return 50;
  if (length === 5) return 100;
  if (length === 6) return 150;
  if (length === 7) return 200;
  return 275;
}
function wcXp(length: number): number {
  if (length <= 4) return 30;
  if (length === 5) return 60;
  if (length === 6) return 90;
  if (length === 7) return 120;
  return 165;
}
function wcDiff(length: number): Difficulty {
  if (length <= 4) return "easy";
  if (length === 5) return "medium";
  return "hard";
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANAGRAM BLITZ DATA — 25 sets
// ═══════════════════════════════════════════════════════════════════════════════
interface AbSet { words: string[]; hint: string; difficulty: Difficulty; timeLimit: number; }

const AB_SETS: AbSet[] = [
  // Easy (9) — 3-4 words, 90 s ─────────────────────────────────────────────────
  { difficulty: "easy",   timeLimit: 90, words: ["KITTEN", "PUPPY", "BUNNY", "FOAL"],     hint: "Baby animals" },
  { difficulty: "easy",   timeLimit: 90, words: ["BREAD", "TOAST", "BAGEL", "CRUST"],     hint: "Baked goods" },
  { difficulty: "easy",   timeLimit: 90, words: ["NORTH", "SOUTH", "EAST", "WEST"],       hint: "Cardinal directions" },
  { difficulty: "easy",   timeLimit: 90, words: ["FLAME", "SMOKE", "EMBER", "SPARK"],     hint: "Fire words" },
  { difficulty: "easy",   timeLimit: 90, words: ["WALTZ", "TANGO", "POLKA", "SALSA"],     hint: "Dance styles" },
  { difficulty: "easy",   timeLimit: 90, words: ["SHARK", "WHALE", "SQUID", "CLAM"],      hint: "Ocean creatures" },
  { difficulty: "easy",   timeLimit: 90, words: ["VENUS", "EARTH", "PLUTO", "MARS"],      hint: "Planets" },
  { difficulty: "easy",   timeLimit: 90, words: ["CRANE", "STORK", "HERON", "SNIPE"],     hint: "Wading birds" },
  { difficulty: "easy",   timeLimit: 90, words: ["LEMON", "LIME", "ORANGE", "MANGO"],     hint: "Tropical fruits" },
  // Medium (9) — 5 words, 60 s ─────────────────────────────────────────────────
  { difficulty: "medium", timeLimit: 60, words: ["FALCON", "CONDOR", "OSPREY", "KESTREL", "MERLIN"],   hint: "Birds of prey" },
  { difficulty: "medium", timeLimit: 60, words: ["MARBLE", "GRANITE", "BASALT", "PUMICE", "SCHIST"],   hint: "Types of rock" },
  { difficulty: "medium", timeLimit: 60, words: ["TUNDRA", "STEPPE", "DESERT", "JUNGLE", "BOREAL"],    hint: "World biomes" },
  { difficulty: "medium", timeLimit: 60, words: ["HAIKU", "SONNET", "BALLAD", "ELEGY", "SATIRE"],      hint: "Poetry forms" },
  { difficulty: "medium", timeLimit: 60, words: ["CHROME", "NICKEL", "COBALT", "COPPER", "BRONZE"],    hint: "Metals and alloys" },
  { difficulty: "medium", timeLimit: 60, words: ["TYPHOON", "CYCLONE", "TORNADO", "SQUALL", "DELUGE"], hint: "Storm types" },
  { difficulty: "medium", timeLimit: 60, words: ["CIPHER", "ENCODE", "DECODE", "SIGNAL", "COVERT"],    hint: "Espionage vocabulary" },
  { difficulty: "medium", timeLimit: 60, words: ["RIDDLE", "ENIGMA", "PUZZLE", "CODE", "MYSTERY"],     hint: "Brain teasers" },
  { difficulty: "medium", timeLimit: 60, words: ["AURORA", "NEBULA", "CORONA", "ZENITH", "NADIR"],     hint: "Astronomy terms" },
  // Hard (7) — 6-8 words, 45 s ─────────────────────────────────────────────────
  { difficulty: "hard",   timeLimit: 45, words: ["PHANTOM", "SPECTER", "WRAITH", "SHADOW", "GHOUL", "BANSHEE"],            hint: "Supernatural entities" },
  { difficulty: "hard",   timeLimit: 45, words: ["ALCHEMY", "SORCERY", "DRUIDRY", "SHAMAN", "VOODOO", "ORACLE"],          hint: "Mystic arts" },
  { difficulty: "hard",   timeLimit: 45, words: ["FRACTURE", "RUPTURE", "SHATTER", "SPLINTER", "CLEAVE", "SEVER"],        hint: "Ways to break things" },
  { difficulty: "hard",   timeLimit: 45, words: ["PROPHECY", "PORTENT", "AUGURY", "HERALD", "VISION", "OMEN"],            hint: "Signs and prophecy" },
  { difficulty: "hard",   timeLimit: 45, words: ["LABYRINTH", "CORRIDOR", "CHAMBER", "PASSAGE", "DUNGEON", "VAULT"],      hint: "Underground spaces" },
  { difficulty: "hard",   timeLimit: 45, words: ["AMBITION", "COURAGE", "RESOLVE", "VALOUR", "TRIUMPH", "GLORY"],         hint: "Virtuous qualities" },
  { difficulty: "hard",   timeLimit: 45, words: ["PROTOCOL", "FIREWALL", "ENCRYPT", "DECRYPT", "MALWARE", "EXPLOIT"],     hint: "Cybersecurity terms" },
];

const AB_POINTS: Record<Difficulty, number> = { easy: 50,  medium: 120, hard: 200 };
const AB_XP:     Record<Difficulty, number> = { easy: 30,  medium: 72,  hard: 120 };

// ═══════════════════════════════════════════════════════════════════════════════
// BLACKOUT DATA — 25 documents
// ═══════════════════════════════════════════════════════════════════════════════
interface BlackoutRedaction {
  placeholder: string;
  hint:        string;
  options:     string[];
  cipherType:  string;
  cipherShift: number;
  cipherKey:   string;
}
interface BlackoutDoc {
  difficulty:     Difficulty;
  documentTitle:  string;
  classification: string;
  flavorText:     string;
  rawDocument:    string;
  answerMode:     "free_text";
  successMessage: string;
  redactions:     BlackoutRedaction[];
}

/** Shorthand redaction builder */
function rd(placeholder: string, hint: string, cipherType: string, cipherShift = 13, cipherKey = "KEY"): BlackoutRedaction {
  return { placeholder, hint, options: [], cipherType, cipherShift, cipherKey };
}

const BO_DOCS: BlackoutDoc[] = [

  // ── Easy (9): UNCLASSIFIED, 2-3 redactions, simple ciphers (none/reverse/anagram) ──────

  {
    difficulty: "easy", classification: "UNCLASSIFIED",
    documentTitle: "Field Contact Report 001",
    flavorText: "Routine field contact summary. Low priority.",
    rawDocument: "The [[ASSET]] was observed leaving the [[DINER]] at 2200 hours. No suspicious activity noted.",
    answerMode: "free_text",
    successMessage: "Field report successfully declassified.",
    redactions: [
      rd("ASSET",   "An intelligence source",          "reverse"),
      rd("DINER",   "A roadside restaurant",            "anagram"),
    ],
  },

  {
    difficulty: "easy", classification: "UNCLASSIFIED",
    documentTitle: "Surveillance Log: Hotel Bravo",
    flavorText: "Three-night hotel surveillance summary.",
    rawDocument: "Subject checked in under the name [[PORTER]] and occupied room [[TWELVE]] for three nights.",
    answerMode: "free_text",
    successMessage: "Surveillance log cleared.",
    redactions: [
      rd("PORTER", "A doorman or carrier of luggage",  "reverse"),
      rd("TWELVE", "The number 12",                    "anagram"),
    ],
  },

  {
    difficulty: "easy", classification: "UNCLASSIFIED",
    documentTitle: "Border Crossing Report",
    flavorText: "Entry log for the eastern checkpoint.",
    rawDocument: "Agent [[LYNX]] entered the eastern [[SECTOR]] using documentation confirmed as authentic.",
    answerMode: "free_text",
    successMessage: "Border report declassified.",
    redactions: [
      rd("LYNX",   "A wild cat native to cold forests",  "none"),
      rd("SECTOR", "A defined geographic zone",           "reverse"),
    ],
  },

  {
    difficulty: "easy", classification: "UNCLASSIFIED",
    documentTitle: "Routine Check-In: Station Fox",
    flavorText: "Standard status update from the perimeter team.",
    rawDocument: "All operatives in the [[NORTH]] perimeter confirmed [[SECURE]]. Next check-in scheduled for [[DAWN]].",
    answerMode: "free_text",
    successMessage: "Check-in report cleared.",
    redactions: [
      rd("NORTH",  "The direction of the magnetic pole",  "reverse"),
      rd("SECURE", "Free from risk or danger",            "anagram"),
      rd("DAWN",   "The first light of morning",          "none"),
    ],
  },

  {
    difficulty: "easy", classification: "UNCLASSIFIED",
    documentTitle: "Extraction Memo",
    flavorText: "Materials movement order.",
    rawDocument: "The [[COURIER]] will collect materials from the [[VAULT]] and deliver them to the forward base.",
    answerMode: "free_text",
    successMessage: "Extraction memo declassified.",
    redactions: [
      rd("COURIER", "One who carries messages or packages",  "anagram"),
      rd("VAULT",   "A secure locked room or strongroom",    "reverse"),
    ],
  },

  {
    difficulty: "easy", classification: "UNCLASSIFIED",
    documentTitle: "Signal Intercept Note",
    flavorText: "Summary of intercepted radio traffic.",
    rawDocument: "Intercepted [[RADIO]] traffic indicates [[MOVEMENT]] toward the southern [[BRIDGE]].",
    answerMode: "free_text",
    successMessage: "Signal note cleared.",
    redactions: [
      rd("RADIO",    "A wireless communication device",  "reverse"),
      rd("MOVEMENT", "The act of relocating",            "anagram"),
      rd("BRIDGE",   "A structure spanning water",       "none"),
    ],
  },

  {
    difficulty: "easy", classification: "UNCLASSIFIED",
    documentTitle: "Safe House Log",
    flavorText: "Operational facility status update.",
    rawDocument: "Location designated [[AMBER]] has been vacated. New safe house is at the old [[MILL]] road.",
    answerMode: "free_text",
    successMessage: "Safe house log declassified.",
    redactions: [
      rd("AMBER", "A yellow-orange gemstone or color",  "anagram"),
      rd("MILL",  "A building that grinds grain",        "reverse"),
    ],
  },

  {
    difficulty: "easy", classification: "UNCLASSIFIED",
    documentTitle: "Operative Status Report",
    flavorText: "Contact confirmation from field team.",
    rawDocument: "[[FALCON]] has made contact. Meeting point confirmed as the [[PLAZA]] in the old quarter.",
    answerMode: "free_text",
    successMessage: "Status report cleared.",
    redactions: [
      rd("FALCON", "A fast bird of prey",   "anagram"),
      rd("PLAZA",  "An open public square", "reverse"),
    ],
  },

  {
    difficulty: "easy", classification: "UNCLASSIFIED",
    documentTitle: "Drop Site Confirmation",
    flavorText: "Dead drop location update.",
    rawDocument: "Dead drop confirmed at the [[BENCH]] near the [[FOUNTAIN]]. Material is [[SEALED]].",
    answerMode: "free_text",
    successMessage: "Drop site log cleared.",
    redactions: [
      rd("BENCH",    "A long seat in a public space",      "none"),
      rd("FOUNTAIN", "An ornamental water feature",        "reverse"),
      rd("SEALED",   "Closed and secured",                 "anagram"),
    ],
  },

  // ── Medium (9): CONFIDENTIAL, 4-5 redactions, ciphers: caesar / numbers / atbash ──────

  {
    difficulty: "medium", classification: "CONFIDENTIAL",
    documentTitle: "Operation NIGHTFALL — Field Update",
    flavorText: "Phase 2 status report. Handle with discretion.",
    rawDocument: "The [[TARGET]] departed [[CENTRAL]] station at [[EVENING]] carrying a [[BRIEFCASE]] bound for an unknown location.",
    answerMode: "free_text",
    successMessage: "NIGHTFALL field update declassified.",
    redactions: [
      rd("TARGET",    "The subject of the operation",            "caesar",  3),
      rd("CENTRAL",   "Located in the middle",                   "numbers", 3),
      rd("EVENING",   "Late afternoon or night-time",             "atbash",  3),
      rd("BRIEFCASE", "A flat bag typically used for documents",  "caesar",  3),
    ],
  },

  {
    difficulty: "medium", classification: "CONFIDENTIAL",
    documentTitle: "Agent Network Compromise Alert",
    flavorText: "Priority alert. Distribute to handlers only.",
    rawDocument: "The [[NETWORK]] in sector [[SEVEN]] has been penetrated. [[OPERATIVE]] RAVEN has gone [[SILENT]]. [[ABORT]] all scheduled contacts immediately.",
    answerMode: "free_text",
    successMessage: "Network alert declassified.",
    redactions: [
      rd("NETWORK",   "A system of interconnected nodes",  "atbash",  3),
      rd("SEVEN",     "The number 7",                       "numbers", 3),
      rd("OPERATIVE", "A covert field agent",               "caesar",  3),
      rd("SILENT",    "Making no sound or signal",          "numbers", 3),
      rd("ABORT",     "To cancel an operation urgently",    "atbash",  3),
    ],
  },

  {
    difficulty: "medium", classification: "CONFIDENTIAL",
    documentTitle: "Diplomatic Intercept: Embassy Traffic",
    flavorText: "Intercepted diplomatic channel — confidential.",
    rawDocument: "The [[MINISTER]] communicated sensitive [[COORDINATES]] to a foreign [[HANDLER]] through an [[ENCRYPTED]] channel.",
    answerMode: "free_text",
    successMessage: "Embassy intercept declassified.",
    redactions: [
      rd("MINISTER",    "A senior government official",      "atbash",  3),
      rd("COORDINATES", "A set of values that define a location", "caesar",  3),
      rd("HANDLER",     "One who manages and directs an agent",  "numbers", 3),
      rd("ENCRYPTED",   "Encoded so only intended parties can read it", "atbash", 3),
    ],
  },

  {
    difficulty: "medium", classification: "CONFIDENTIAL",
    documentTitle: "Counter-Intelligence Summary",
    flavorText: "Internal security investigation — restricted.",
    rawDocument: "Evidence confirms a [[MOLE]] inside [[DIVISION]] nine has been leaking [[CIPHER]] keys to a [[RIVAL]] service.",
    answerMode: "free_text",
    successMessage: "Counter-intelligence summary cleared.",
    redactions: [
      rd("MOLE",     "An embedded double agent",             "caesar",  3),
      rd("DIVISION", "A unit or section of an organization", "numbers", 3),
      rd("CIPHER",   "A coded communication system",         "atbash",  3),
      rd("RIVAL",    "A competing intelligence service",     "caesar",  3),
    ],
  },

  {
    difficulty: "medium", classification: "CONFIDENTIAL",
    documentTitle: "Street Surveillance: Baker Grid",
    flavorText: "Overwatch report from the Baker sector.",
    rawDocument: "Subjects entered the [[THEATRE]] on [[BAKER]] street. A [[PACKAGE]] changed hands. Third subject departed by [[TAXI]].",
    answerMode: "free_text",
    successMessage: "Surveillance report declassified.",
    redactions: [
      rd("THEATRE", "A building for performances",              "numbers", 3),
      rd("BAKER",   "One who makes bread; also a famous street","caesar",  3),
      rd("PACKAGE", "A wrapped or sealed container",            "atbash",  3),
      rd("TAXI",    "A hired vehicle",                          "numbers", 3),
    ],
  },

  {
    difficulty: "medium", classification: "CONFIDENTIAL",
    documentTitle: "Asset Evaluation: RAVEN",
    flavorText: "Annual asset review — restricted distribution.",
    rawDocument: "RAVEN has maintained [[RELIABLE]] contact over [[EIGHTEEN]] months. Risk of [[EXPOSURE]] assessed as [[MODERATE]]. Recommend [[CONTINUE]].",
    answerMode: "free_text",
    successMessage: "Asset evaluation declassified.",
    redactions: [
      rd("RELIABLE", "Trustworthy and consistent",          "atbash",  3),
      rd("EIGHTEEN", "The number 18",                        "caesar",  5),
      rd("EXPOSURE", "Being revealed or accidentally uncovered", "numbers", 3),
      rd("MODERATE", "Neither low nor high in degree",      "atbash",  3),
      rd("CONTINUE", "To carry on without interruption",    "caesar",  3),
    ],
  },

  {
    difficulty: "medium", classification: "CONFIDENTIAL",
    documentTitle: "Dead Drop Protocol Update",
    flavorText: "Updated dead drop procedure for active operatives.",
    rawDocument: "New drop point at the [[BENCH]] near [[VICTORIA]] park. Access via the [[EASTERN]] gate. [[SIGNAL]] is three taps.",
    answerMode: "free_text",
    successMessage: "Protocol update cleared.",
    redactions: [
      rd("BENCH",    "A long seat found in parks or squares",      "caesar",  3),
      rd("VICTORIA", "A name meaning victory; a famous royal name","atbash",  3),
      rd("EASTERN",  "In the direction of the rising sun",         "numbers", 3),
      rd("SIGNAL",   "A pre-arranged gesture or communication",    "caesar",  3),
    ],
  },

  {
    difficulty: "medium", classification: "CONFIDENTIAL",
    documentTitle: "Signal Station: Romeo Compromised",
    flavorText: "Emergency comms rerouting order. Act immediately.",
    rawDocument: "Station [[ROMEO]] has been [[COMPROMISED]]. All [[TRAFFIC]] must reroute through [[ALPHA]].",
    answerMode: "free_text",
    successMessage: "Station alert declassified.",
    redactions: [
      rd("ROMEO",       "NATO phonetic letter R; Shakespeare's romantic hero", "numbers", 3),
      rd("COMPROMISED", "Exposed or made vulnerable to the enemy",             "caesar",  3),
      rd("TRAFFIC",     "Communications or message flow through a channel",    "atbash",  3),
      rd("ALPHA",       "First in a sequence; NATO phonetic letter A",         "numbers", 3),
    ],
  },

  {
    difficulty: "medium", classification: "CONFIDENTIAL",
    documentTitle: "Network Infiltration Summary",
    flavorText: "Post-operation debrief — classified distribution.",
    rawDocument: "Operative entered the [[BUILDING]] through the [[BASEMENT]] access point. The [[TERMINAL]] on [[SUBLEVEL]] [[THREE]] was accessed for ninety seconds.",
    answerMode: "free_text",
    successMessage: "Infiltration summary cleared.",
    redactions: [
      rd("BUILDING",  "A constructed structure with walls and a roof", "atbash",  3),
      rd("BASEMENT",  "The lowest level of a building, below ground",  "caesar",  5),
      rd("TERMINAL",  "A computer workstation or access point",        "numbers", 3),
      rd("SUBLEVEL",  "A floor below the ground level",                "atbash",  3),
      rd("THREE",     "The number 3",                                  "caesar",  3),
    ],
  },

  // ── Hard (7): SECRET, 6-9 redactions, ciphers: morse / polybius / nato ───────────────

  {
    difficulty: "hard", classification: "SECRET",
    documentTitle: "EYES ONLY — Project BLACKTHORN",
    flavorText: "Most sensitive classification. Authorised eyes only.",
    rawDocument: "Project [[BLACKTHORN]] involves the [[EXTRACTION]] of a [[DEFECTOR]] known only as [[GHOST]]. The operation is [[SANCTIONED]] at the [[HIGHEST]] level. Failure will result in [[TERMINATION]] of the asset.",
    answerMode: "free_text",
    successMessage: "Project BLACKTHORN fully declassified.",
    redactions: [
      rd("BLACKTHORN",  "A dark thorny shrub with white blossoms",       "morse"),
      rd("EXTRACTION",  "Removal of a person from a dangerous situation", "polybius"),
      rd("DEFECTOR",    "One who abandons their country for another",     "morse"),
      rd("GHOST",       "A spirit; also a spy who vanishes without trace","nato"),
      rd("SANCTIONED",  "Officially approved at the highest level",       "polybius"),
      rd("HIGHEST",     "At the top level of authority",                  "morse"),
      rd("TERMINATION", "A final and decisive ending",                    "nato"),
    ],
  },

  {
    difficulty: "hard", classification: "SECRET",
    documentTitle: "Classified Dossier: Operation WRAITH",
    flavorText: "Counter-espionage file. Restricted to senior analysts.",
    rawDocument: "Codename [[WRAITH]] has penetrated a [[NUCLEAR]] facility. [[SURVEILLANCE]] confirms [[CONTACT]] with [[FOREIGN]] [[AGENTS]] on multiple occasions.",
    answerMode: "free_text",
    successMessage: "Operation WRAITH dossier declassified.",
    redactions: [
      rd("WRAITH",       "A ghost or spectral apparition",                "polybius"),
      rd("NUCLEAR",      "Relating to atomic energy or weapons",          "nato"),
      rd("SURVEILLANCE", "Close covert observation of a person or place", "morse"),
      rd("CONTACT",      "Communication established with another party",  "polybius"),
      rd("FOREIGN",      "From or relating to another country",           "nato"),
      rd("AGENTS",       "People working covertly for an intelligence service", "morse"),
    ],
  },

  {
    difficulty: "hard", classification: "SECRET",
    documentTitle: "Top Secret Briefing: Asset PHOENIX",
    flavorText: "Exfiltration window briefing — immediate action required.",
    rawDocument: "Asset [[PHOENIX]] acquired [[INTELLIGENCE]] on the [[WEAPONS]] program. The [[EXFILTRATION]] window opens at [[MIDNIGHT]] on the [[FIFTEENTH]].",
    answerMode: "free_text",
    successMessage: "PHOENIX briefing declassified.",
    redactions: [
      rd("PHOENIX",      "A mythical bird reborn from its own ashes",     "nato"),
      rd("INTELLIGENCE", "Secret information gathered by an agency",      "morse"),
      rd("WEAPONS",      "Instruments or devices used in combat",         "polybius"),
      rd("EXFILTRATION", "The covert extraction of an operative",         "nato"),
      rd("MIDNIGHT",     "12 o'clock at night",                           "morse"),
      rd("FIFTEENTH",    "Position number 15 in a sequence",              "polybius"),
    ],
  },

  {
    difficulty: "hard", classification: "SECRET",
    documentTitle: "Strategic Assessment: ORACLE Protocol",
    flavorText: "Emergency protocol documentation. Director-level clearance.",
    rawDocument: "[[ORACLE]] protocol activates under [[EMERGENCY]] conditions only. The [[CIPHER]] sequence requires [[BIOMETRIC]] [[VERIFICATION]] before [[SATELLITE]] uplink is [[ESTABLISHED]].",
    answerMode: "free_text",
    successMessage: "ORACLE protocol assessment cleared.",
    redactions: [
      rd("ORACLE",       "A source of divine wisdom or prophecy",          "morse"),
      rd("EMERGENCY",    "A sudden serious situation requiring action",     "polybius"),
      rd("CIPHER",       "A secret coded system for communication",         "nato"),
      rd("BIOMETRIC",    "Based on measurable physical characteristics",    "morse"),
      rd("VERIFICATION", "The process of confirming authenticity",          "polybius"),
      rd("SATELLITE",    "An object orbiting Earth used for communications","nato"),
      rd("ESTABLISHED",  "Successfully set up or brought into operation",   "morse"),
    ],
  },

  {
    difficulty: "hard", classification: "SECRET",
    documentTitle: "Double Agent Report: SPARROW",
    flavorText: "Internal affairs investigation. Above top secret.",
    rawDocument: "[[SPARROW]] has been a [[DOUBLE]] agent for [[FOURTEEN]] months. [[EVIDENCE]] gathered by [[SIGNALS]] division confirms [[BETRAYAL]]. [[IMMEDIATE]] action required.",
    answerMode: "free_text",
    successMessage: "SPARROW investigation report cleared.",
    redactions: [
      rd("SPARROW",   "A small common songbird",                              "polybius"),
      rd("DOUBLE",    "Working secretly for two opposing sides",              "nato"),
      rd("FOURTEEN",  "The number 14",                                        "morse"),
      rd("EVIDENCE",  "Facts or information confirming something is true",    "polybius"),
      rd("SIGNALS",   "Intelligence gathered from intercepted communications","nato"),
      rd("BETRAYAL",  "An act of disloyalty or deceit",                       "morse"),
      rd("IMMEDIATE", "Occurring without any delay",                          "polybius"),
    ],
  },

  {
    difficulty: "hard", classification: "SECRET",
    documentTitle: "Black Site Assessment: OBSIDIAN",
    flavorText: "Facility assessment — above secret clearance required.",
    rawDocument: "The [[FACILITY]] designated [[OBSIDIAN]] processes [[SENSITIVE]] [[MATERIAL]] obtained through [[ENHANCED]] [[METHODS]]. [[LOCATION]] remains undisclosed.",
    answerMode: "free_text",
    successMessage: "OBSIDIAN assessment declassified.",
    redactions: [
      rd("FACILITY",  "An establishment built for a specific purpose",           "nato"),
      rd("OBSIDIAN",  "A naturally occurring dark volcanic glass",               "morse"),
      rd("SENSITIVE", "Requiring careful handling due to secrecy",               "polybius"),
      rd("MATERIAL",  "Evidence or gathered intelligence content",               "nato"),
      rd("ENHANCED",  "Intensified or taken beyond normal limits",               "morse"),
      rd("METHODS",   "Established procedures or techniques used",               "polybius"),
      rd("LOCATION",  "The specific place where something is situated",          "nato"),
    ],
  },

  {
    difficulty: "hard", classification: "SECRET",
    documentTitle: "Final Warning: Operation ENDGAME",
    flavorText: "Highest level directive. Eyes only. Destroy after reading.",
    rawDocument: "[[ENDGAME]] is now [[ACTIVE]]. All [[SLEEPER]] agents must [[ACTIVATE]] within [[SEVENTYTWO]] hours. [[MISSION]] parameters: [[NEUTRALISE]] the [[PRIMARY]] [[TARGET]].",
    answerMode: "free_text",
    successMessage: "Operation ENDGAME directive declassified.",
    redactions: [
      rd("ENDGAME",    "A final stage or decisive confrontation",             "morse"),
      rd("ACTIVE",     "Currently in operation",                              "nato"),
      rd("SLEEPER",    "A dormant agent waiting to be activated",             "polybius"),
      rd("ACTIVATE",   "To set into immediate action",                        "morse"),
      rd("SEVENTYTWO", "The number 72",                                       "nato"),
      rd("MISSION",    "An assigned operational task",                        "polybius"),
      rd("NEUTRALISE", "To render an enemy ineffective",                      "nato"),
      rd("PRIMARY",    "Most important; first in priority",                   "morse"),
      rd("TARGET",     "The subject or focus of the operation",               "polybius"),
    ],
  },
];

const BO_POINTS: Record<Difficulty, number> = { easy: 75,  medium: 150, hard: 300 };
const BO_XP:     Record<Difficulty, number> = { easy: 45,  medium: 90,  hard: 180 };

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════
async function main() {
  console.log("🌱 Seeding 100 new puzzles (25 each for word_search, word_crack, anagram_blitz, blackout)...\n");

  const [wordCat, cryptoCat] = await Promise.all([
    getOrCreateCategory("Word",         "#FDE74C"),
    getOrCreateCategory("Cryptography", "#8B5CF6"),
  ]);

  let total = 0;
  let skipped = 0;

  // ── Word Search (25) ────────────────────────────────────────────────────────
  console.log("🔍 Seeding Word Search (25)...");
  for (let i = 0; i < WS_SETS.length; i++) {
    const set   = WS_SETS[i];
    const title = `Word Search Plus #${i + 1}: ${set.theme}`;
    if (await titleExists(title)) { skipped++; continue; }

    const gridSize = WS_GRID[set.difficulty];
    const grid     = generateWordSearchGrid(set.words, gridSize);

    await prisma.puzzle.create({
      data: {
        title,
        description: `Find all hidden words in the ${set.theme.toLowerCase()} themed grid.`,
        content:     `Find: ${set.words.join(", ")}`,
        categoryId:  wordCat.id,
        difficulty:  set.difficulty,
        isActive:    true,
        puzzleType:  "word_search",
        xpReward:    WS_XP[set.difficulty],
        data: { gridSize, words: set.words, grid, wordsRaw: set.words.join("\n") },
        solutions: {
          create: [{ answer: "word_search_complete", isCorrect: true, points: WS_POINTS[set.difficulty], ignoreCase: true, ignoreWhitespace: false }],
        },
      },
    });
    total++;
  }
  console.log(`  ✓ Word Search done (${WS_SETS.length} puzzles)\n`);

  // ── WordScry (25) ───────────────────────────────────────────────────────────
  console.log("🟩 Seeding WordScry (25)...");
  for (let i = 0; i < WC_WORDS.length; i++) {
    const { word, hint } = WC_WORDS[i];
    const pts   = wcPoints(word.length);
    const xp    = wcXp(word.length);
    const diff  = wcDiff(word.length);
    const title = `WordScry Plus #${i + 1}: ${word.length} Letters`;
    if (await titleExists(title)) { skipped++; continue; }

    await prisma.puzzle.create({
      data: {
        title,
        description: `Guess the ${word.length}-letter word. You have 6 attempts.`,
        content:     `WordScry: guess the hidden word. Hint: ${hint}`,
        categoryId:  wordCat.id,
        difficulty:  diff,
        isActive:    true,
        puzzleType:  "word_crack",
        xpReward:    xp,
        data: { word, wordLength: word.length, maxGuesses: 6, hint },
        solutions: {
          create: [{ answer: word, isCorrect: true, points: pts, ignoreCase: true, ignoreWhitespace: false }],
        },
      },
    });
    total++;
  }
  console.log(`  ✓ WordScry done (${WC_WORDS.length} puzzles — 5× 4-letter, 8× 5-letter, 6× 6-letter, 4× 7-letter, 2× 8-letter)\n`);

  // ── Anagram Blitz (25) ──────────────────────────────────────────────────────
  console.log("🔀 Seeding Anagram Blitz (25)...");
  for (let i = 0; i < AB_SETS.length; i++) {
    const set   = AB_SETS[i];
    const title = `Anagram Blitz Plus #${i + 1}: ${set.words.length} Words`;
    if (await titleExists(title)) { skipped++; continue; }

    await prisma.puzzle.create({
      data: {
        title,
        description: `Unscramble ${set.words.length} words as fast as you can.`,
        content:     `${set.hint}. You have ${set.timeLimit} seconds.`,
        categoryId:  wordCat.id,
        difficulty:  set.difficulty,
        isActive:    true,
        puzzleType:  "anagram_blitz",
        xpReward:    AB_XP[set.difficulty],
        data: { words: set.words, timeLimit: set.timeLimit, hint: set.hint },
        solutions: {
          create: [{ answer: "anagram_complete", isCorrect: true, points: AB_POINTS[set.difficulty], ignoreCase: true, ignoreWhitespace: false }],
        },
      },
    });
    total++;
  }
  console.log(`  ✓ Anagram Blitz done (${AB_SETS.length} puzzles — 9 easy/90s, 9 medium/60s, 7 hard/45s)\n`);

  // ── Blackout (25) ───────────────────────────────────────────────────────────
  console.log("⬛ Seeding Blackout (25)...");
  for (let i = 0; i < BO_DOCS.length; i++) {
    const doc   = BO_DOCS[i];
    const title = `Blackout #${i + 1}: ${doc.documentTitle}`;
    if (await titleExists(title)) { skipped++; continue; }

    const { difficulty, ...docData } = doc;

    await prisma.puzzle.create({
      data: {
        title,
        description: `Declassify the redacted document: "${doc.documentTitle}"`,
        content:     doc.flavorText,
        categoryId:  cryptoCat.id,
        difficulty,
        isActive:    true,
        puzzleType:  "blackout",
        xpReward:    BO_XP[difficulty],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data:        docData as any,
        solutions: {
          create: [{ answer: "blackout_complete", isCorrect: true, points: BO_POINTS[difficulty], ignoreCase: true, ignoreWhitespace: false }],
        },
      },
    });
    total++;
  }
  console.log(`  ✓ Blackout done (${BO_DOCS.length} puzzles — 9 easy/UNCLASSIFIED, 9 medium/CONFIDENTIAL, 7 hard/SECRET)\n`);

  console.log(`✅ Seed complete — inserted ${total} puzzles, skipped ${skipped} (already existed).`);
  console.log("\nReward summary:");
  console.log("  Word Search:   easy 50pts/30xp → medium 100pts/60xp → hard 200pts/120xp");
  console.log("  WordScry:      4L 50/30 → 5L 100/60 → 6L 150/90 → 7L 200/120 → 8L 275/165");
  console.log("  Anagram Blitz: easy 50/30 → medium 120/72 → hard 200/120");
  console.log("  Blackout:      easy 75/45 → medium 150/90 → hard 300/180");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
