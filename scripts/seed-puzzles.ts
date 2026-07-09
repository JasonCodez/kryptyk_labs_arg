/**
 * Bulk puzzle seed — 50 puzzles per type
 * Types: general, riddle, crack_safe, word_crack, word_search, anagram_blitz, sudoku
 *
 * Run: npx tsx scripts/seed-puzzles.ts
 *
 * Safe to re-run: uses title-based deduplication (skips if title already exists).
 */

import { PrismaClient } from "@prisma/client";
import path from "path";
import { config } from "dotenv";

config({ path: path.resolve(process.cwd(), ".env.local") });
config({ path: path.resolve(process.cwd(), ".env") });

const prisma = new PrismaClient();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const DIFFICULTIES = ["easy", "medium", "hard"] as const;
type Difficulty = (typeof DIFFICULTIES)[number];

const POINTS: Record<Difficulty, number> = { easy: 50, medium: 100, hard: 200 };
const XP: Record<Difficulty, number> = { easy: 30, medium: 60, hard: 120 };

// ─── Categories ───────────────────────────────────────────────────────────────

async function getOrCreateCategory(name: string, color: string) {
  return prisma.puzzleCategory.upsert({
    where: { name },
    update: {},
    create: { name, description: `${name} puzzles`, color },
  });
}

// ─── General / Riddle puzzles ─────────────────────────────────────────────────

const RIDDLES = [
  { q: "I speak without a mouth and hear without ears. I have no body, but I come alive with the wind. What am I?", a: "ECHO" },
  { q: "The more you take, the more you leave behind. What am I?", a: "FOOTSTEPS" },
  { q: "I have cities, but no houses live there. I have mountains, but no trees grow there. I have water, but no fish swim there. What am I?", a: "A MAP" },
  { q: "What has hands but cannot clap?", a: "A CLOCK" },
  { q: "What runs but never walks, has a mouth but never talks?", a: "A RIVER" },
  { q: "What can travel around the world while staying in a corner?", a: "A STAMP" },
  { q: "I am not alive, but I grow. I have no mouth, but I can eat. I have no nose, but I smell terrible. What am I?", a: "FIRE" },
  { q: "The person who makes it sells it. The person who buys it never uses it. The person who uses it doesn't know they're using it. What is it?", a: "A COFFIN" },
  { q: "What has one eye but cannot see?", a: "A NEEDLE" },
  { q: "I have a neck but no head, and I wear a cap. What am I?", a: "A BOTTLE" },
  { q: "What is always in front of you but can't be seen?", a: "THE FUTURE" },
  { q: "You see a boat filled with people. It has not sunk, but when you look again you don't see a single person on the boat. Why?", a: "THEY WERE ALL MARRIED" },
  { q: "What gets wetter as it dries?", a: "A TOWEL" },
  { q: "I have branches but no fruit, trunk or leaves. What am I?", a: "A BANK" },
  { q: "What can you hold in your left hand but not your right?", a: "YOUR RIGHT HAND" },
  { q: "What is cut on the table but never eaten?", a: "A DECK OF CARDS" },
  { q: "What has a head and a tail but no body?", a: "A COIN" },
  { q: "What gets bigger the more you take away from it?", a: "A HOLE" },
  { q: "I have keys but no locks. I have space but no room. You can enter but can't go outside. What am I?", a: "A KEYBOARD" },
  { q: "What two things can you never eat for breakfast?", a: "LUNCH AND DINNER" },
  { q: "What word is spelled wrong in every dictionary?", a: "WRONG" },
  { q: "What invention lets you look right through a wall?", a: "A WINDOW" },
  { q: "What is so fragile that saying its name breaks it?", a: "SILENCE" },
  { q: "What goes up and never comes down?", a: "YOUR AGE" },
  { q: "A man looks at a photograph of someone. He says, 'Brothers and sisters I have none, but that man's father is my father's son.' Who is in the photograph?", a: "HIS SON" },
  { q: "What has four wheels and flies?", a: "A GARBAGE TRUCK" },
  { q: "What starts with an E, ends with an E, but only contains one letter?", a: "AN ENVELOPE" },
  { q: "What five-letter word becomes shorter when you add two letters to it?", a: "SHORT" },
  { q: "The more you have of it, the less you see. What is it?", a: "DARKNESS" },
  { q: "I turn polar bears white and I will make you cry. I make guys have to pee and I make your baby cry. I make famous men and I keep them anonymous. I stall a fighter jet and I make the old man die. What am I?", a: "PRESSURE" },
  { q: "What has a thumb and four fingers but is not alive?", a: "A GLOVE" },
  { q: "You live in a one-story house where everything is red: walls, ceilings, floors, furniture. What color are the stairs?", a: "THERE ARE NO STAIRS" },
  { q: "What do you call a bear with no teeth?", a: "A GUMMY BEAR" },
  { q: "How many months have 28 days?", a: "ALL OF THEM" },
  { q: "What is light as a feather but even the world's strongest man couldn't hold it for more than a few minutes?", a: "BREATH" },
  { q: "What can you break, even if you never pick it up or touch it?", a: "A PROMISE" },
  { q: "David's father has three sons: Snap, Crackle, and ___?", a: "DAVID" },
  { q: "A girl fell off a 50-foot ladder but didn't hurt herself. How?", a: "SHE FELL OFF THE BOTTOM RUNG" },
  { q: "If two bulls eat three bales of hay in three days, how long does it take one bull to eat one bale?", a: "THREE DAYS" },
  { q: "What is seen in the middle of March and April that can't be seen at the beginning or end of either month?", a: "THE LETTER R" },
  { q: "What word in the English language does the following: the first two letters signify a male, the first three letters signify a female, the first four letters signify a great one, while the entire word signifies a great woman. What is the word?", a: "HEROINE" },
  { q: "What goes through cities and fields but never moves?", a: "A ROAD" },
  { q: "What is always coming but never arrives?", a: "TOMORROW" },
  { q: "If you drop me I'm sure to crack, but give me a smile and I'll always smile back. What am I?", a: "A MIRROR" },
  { q: "What building has the most stories?", a: "A LIBRARY" },
  { q: "I have no doors but have keys, I have no rooms but have space, you can enter but you can't leave. What am I?", a: "A KEYBOARD" },
  { q: "What runs all around a backyard yet never moves?", a: "A FENCE" },
  { q: "You answer me although I never ask you questions. What am I?", a: "A TELEPHONE" },
  { q: "Forward I am heavy, but backward I am not. What am I?", a: "TON" },
  { q: "Paul's height is six feet, he's an assistant at a butcher's shop, and wears size nine shoes. What does he weigh?", a: "MEAT" },
];

// ─── Crack Safe puzzles ───────────────────────────────────────────────────────

const SAFE_CLUES = [
  "The vault hasn't been opened since the 1940s. The combination was scratched into the back of a wartime portrait.",
  "A retired spy left their most valuable secrets locked away. The safe code was their wedding date — rearranged.",
  "The museum curator's private safe holds a stolen masterpiece. Security logs show a 6-digit code entered at 3:47 AM.",
  "A billionaire's panic room was sealed during a blackout. The only clue is a sticky note: 'start with the prime'.",
  "The old bank vault was never cracked. Rumour says the combination is hidden in the first six digits of a famous equation.",
  "A novelist's safe holds the final unpublished manuscript. The password was encoded in the dedication page.",
  "The laboratory safe contains a formula that never reached the public. The code is etched in reverse on the base.",
  "An antique safe from the 1800s, still locked. Previous owners left a cryptic hint: 'count the stars on the flag'.",
  "A forensic accountant locked away evidence in a numbered safe. The code is buried in the ledger entries.",
  "The cold case detective's safe has stayed shut for 20 years. The combination is a date only the killer knows.",
];

const SAFE_MESSAGES = [
  "🎉 The door swings open. Inside: a sealed envelope marked 'For Your Eyes Only'.",
  "🔓 Click. The locking mechanism releases. You find a USB drive wrapped in an old newspaper clipping.",
  "🏆 The tumblers fall into place. Inside the vault sits a single golden key.",
  "📜 You crack it. Rolled inside is an aged scroll with coordinates of an unknown location.",
  "💎 The safe springs open. A single diamond reflects the light from within.",
];

function generateSafeCode(digits: number): string {
  return Array.from({ length: digits }, () => Math.floor(Math.random() * 10)).join("");
}

// ─── Hidden Word (daily word puzzle) ─────────────────────────────────────────────

const WORD_CRACK_WORDS = [
  { word: "CRANE", hint: "A tall lifting machine on a construction site" },
  { word: "FLAME", hint: "What a fire produces" },
  { word: "GLOOM", hint: "A feeling of sadness and darkness" },
  { word: "BRISK", hint: "Energetically quick and fast" },
  { word: "PLUMB", hint: "A weight on a line used to find vertical" },
  { word: "GRIND", hint: "To crush into powder" },
  { word: "STOMP", hint: "To walk with heavy, noisy steps" },
  { word: "BLAST", hint: "An explosion or powerful gust" },
  { word: "CRISP", hint: "Firm and dry, like a biscuit" },
  { word: "FLINT", hint: "A hard rock that makes sparks" },
  { word: "SWIPE", hint: "A sweeping blow or card payment action" },
  { word: "DROVE", hint: "Past tense of drive" },
  { word: "MARSH", hint: "A wetland area" },
  { word: "PERCH", hint: "A place where a bird sits" },
  { word: "SCALP", hint: "The skin on top of your head" },
  { word: "RIVET", hint: "A metal fastener or something gripping" },
  { word: "SLANT", hint: "An oblique angle or a bias" },
  { word: "CLUMP", hint: "A group of trees or a lump" },
  { word: "WRECK", hint: "A badly damaged vehicle or disaster" },
  { word: "SPINE", hint: "The backbone" },
  { word: "PROBE", hint: "An investigation tool or spacecraft" },
  { word: "TROUT", hint: "A freshwater fish" },
  { word: "SNARE", hint: "A trap made from wire" },
  { word: "FROZE", hint: "Past tense of freeze" },
  { word: "BRAWL", hint: "A rough or noisy fight" },
  { word: "CHURN", hint: "A device for making butter" },
  { word: "YELPS", hint: "Short sharp cries of pain" },
  { word: "GRAFT", hint: "Hard work or a transplant procedure" },
  { word: "KNEEL", hint: "To rest on your knee" },
  { word: "SWEPT", hint: "Past tense of sweep" },
  { word: "BLOOM", hint: "A flower or the act of flowering" },
  { word: "CLOAK", hint: "A loose outer garment or to conceal" },
  { word: "DWARF", hint: "A very small person or creature" },
  { word: "EXPEL", hint: "To force out or remove officially" },
  { word: "FINCH", hint: "A small singing bird" },
  { word: "GROAN", hint: "A deep sound of pain" },
  { word: "HINGE", hint: "The joint a door swings on" },
  { word: "INLET", hint: "A narrow body of water" },
  { word: "JOUST", hint: "A medieval contest between knights" },
  { word: "KNACK", hint: "A special skill or ability" },
  { word: "LAPSE", hint: "A brief failure of concentration" },
  { word: "MOXIE", hint: "Courage and determination" },
  { word: "NOTCH", hint: "A V-shaped cut in a surface" },
  { word: "OUGHT", hint: "Should or expected" },
  { word: "PARCH", hint: "To dry up with heat" },
  { word: "QUAFF", hint: "To drink heartily" },
  { word: "REPEL", hint: "To drive back or resist" },
  { word: "SCOFF", hint: "To mock or eat greedily" },
  { word: "TIMID", hint: "Easily frightened or shy" },
  { word: "UNZIP", hint: "To open a fastener" },
];

// ─── Word Search ──────────────────────────────────────────────────────────────

const WORD_SEARCH_SETS = [
  { theme: "Animals", words: ["LION", "TIGER", "SHARK", "EAGLE", "WHALE", "PANDA", "COBRA", "HORSE"] },
  { theme: "Space", words: ["ORBIT", "COMET", "NEBULA", "SATURN", "GALAXY", "PULSAR", "METEOR", "COSMOS"] },
  { theme: "Food", words: ["PIZZA", "PASTA", "SUSHI", "TACOS", "CURRY", "MANGO", "BREAD", "STEAK"] },
  { theme: "Sports", words: ["RUGBY", "TENNIS", "HOCKEY", "BOXING", "CRICKET", "ROWING", "GOLF", "POLO"] },
  { theme: "Music", words: ["CHORD", "TEMPO", "RHYTHM", "TREBLE", "CLEF", "PITCH", "SCALE", "SHARP"] },
  { theme: "Science", words: ["ATOM", "PROTON", "ENZYME", "QUARTZ", "PLASMA", "LASER", "ALLOY", "HELIX"] },
  { theme: "Countries", words: ["FRANCE", "JAPAN", "BRAZIL", "INDIA", "CANADA", "KENYA", "PERU", "EGYPT"] },
  { theme: "Ocean", words: ["CORAL", "KELP", "SQUID", "PRAWN", "ABYSSAL", "TIDE", "REEF", "SWELL"] },
  { theme: "Mythology", words: ["ZEUS", "THOR", "HADES", "ATHENA", "ODIN", "MEDUSA", "ARES", "LOKI"] },
  { theme: "Technology", words: ["CACHE", "PIXEL", "KERNEL", "ROUTER", "CODEC", "PROXY", "ARRAY", "TOKEN"] },
  { theme: "Weather", words: ["STORM", "FROST", "HUMID", "DRIZZLE", "SQUALL", "MIST", "HAZE", "SLEET"] },
  { theme: "Crime", words: ["HEIST", "FORGE", "CIPHER", "TRACE", "ALIBI", "MOTIVE", "ROGUE", "VAULT"] },
  { theme: "Plants", words: ["FERN", "CACTUS", "ORCHID", "WILLOW", "BAMBOO", "BIRCH", "MAPLE", "THYME"] },
  { theme: "Architecture", words: ["ARCH", "VAULT", "TRUSS", "SPIRE", "PARAPET", "TURRET", "FACADE", "COLUMN"] },
  { theme: "Vehicles", words: ["CRANE", "BARGE", "TRAWLER", "GLIDER", "SCOOTER", "FERRY", "CABLE", "WAGON"] },
  { theme: "Gems", words: ["RUBY", "OPAL", "TOPAZ", "GARNET", "SAPPHIRE", "AMBER", "JADE", "ONYX"] },
  { theme: "Cooking", words: ["BASTE", "BRAISE", "SAUTE", "MINCE", "FLAMBE", "PUREE", "GLAZE", "POACH"] },
  { theme: "History", words: ["ROMAN", "FEUDAL", "VIKING", "TUDOR", "MOGUL", "AZTEC", "GREEK", "SAXON"] },
  { theme: "Cinema", words: ["SCENE", "GENRE", "SCRIPT", "DOLLY", "CRANE", "FRAME", "ZOOM", "REEL"] },
  { theme: "Coding", words: ["LOOP", "CLASS", "DEBUG", "PARSE", "STACK", "QUEUE", "THREAD", "MUTEX"] },
  { theme: "Chemistry", words: ["OXIDE", "AMINE", "ALKALI", "ESTER", "ACID", "BOND", "MOLE", "ION"] },
  { theme: "Finance", words: ["BOND", "YIELD", "MARGIN", "HEDGE", "ASSET", "EQUITY", "CARTEL", "TRADE"] },
  { theme: "Insects", words: ["MOTH", "WASP", "APHID", "MITE", "GRUB", "LOCUST", "CICADA", "FLEA"] },
  { theme: "Magic", words: ["SPELL", "RUNE", "CURSE", "AURA", "SIGIL", "WARD", "CHARM", "BIND"] },
  { theme: "Materials", words: ["STEEL", "RESIN", "KEVLAR", "ALLOY", "BRASS", "NYLON", "BASALT", "IVORY"] },
  { theme: "Military", words: ["SQUAD", "FLANK", "SIEGE", "PATROL", "CONVOY", "VOLLEY", "BUNKER", "LANCE"] },
  { theme: "Anatomy", words: ["FEMUR", "TIBIA", "STERNUM", "CLAVICLE", "PELVIS", "RADIUS", "ULNA", "PATELLA"] },
  { theme: "Pirates", words: ["PLANK", "BRIG", "PARROT", "ANCHOR", "BARQUE", "SWORD", "LOOT", "COVE"] },
  { theme: "Math", words: ["PRIME", "CIPHER", "FACTOR", "VECTOR", "MATRIX", "TENSOR", "SCALAR", "LIMIT"] },
  { theme: "Psychology", words: ["TRAIT", "SCHEMA", "REFLEX", "GESTALT", "RECALL", "URGE", "BIAS", "LOCUS"] },
  // Extra sets to fill 50
  { theme: "Birds", words: ["SWIFT", "CRANE", "FINCH", "ROBIN", "HERON", "WREN", "SNIPE", "LARK"] },
  { theme: "Reptiles", words: ["GECKO", "VIPER", "IGUANA", "SKINK", "TUATARA", "CAIMAN", "ANOLE", "MAMBA"] },
  { theme: "Drinks", words: ["LATTE", "MOCHA", "STOUT", "PORTER", "MEAD", "CIDER", "BRINE", "DRAM"] },
  { theme: "Emotions", words: ["DREAD", "BLISS", "GRIEF", "SCORN", "TENDER", "PRIDE", "ENVY", "WRATH"] },
  { theme: "Typography", words: ["SERIF", "KERNING", "GLYPH", "ASCENDER", "LIGATURE", "INDENT", "ORPHAN", "WIDOWS"] },
  { theme: "Colors", words: ["INDIGO", "TAUPE", "VERMILLION", "COBALT", "MAGENTA", "SIENNA", "CELADON", "UMBER"] },
  { theme: "Countries II", words: ["NORWAY", "CHILE", "NEPAL", "GHANA", "TIBET", "LAOS", "BENIN", "TONGA"] },
  { theme: "Gaming", words: ["QUEST", "SPAWN", "RESPAWN", "LOOT", "GRIND", "GANK", "TANK", "HEAL"] },
  { theme: "Geology", words: ["FAULT", "STRATA", "MAGMA", "SCHIST", "PUMICE", "SHALE", "GNEISS", "FLINT"] },
  { theme: "Seasons", words: ["SOLSTICE", "EQUINOX", "THAW", "HARVEST", "FROST", "BLOOM", "BLIGHT", "DRIFT"] },
  { theme: "Detectives", words: ["CLUE", "DEDUCT", "ALIBI", "HUNCH", "CIPHER", "TRAIL", "SHADOW", "SNOOP"] },
  { theme: "Linguistics", words: ["SYNTAX", "MORPHEME", "DIPHTHONG", "PHONEME", "LEXIS", "REGISTER", "TENSE", "CASE"] },
  { theme: "Buildings", words: ["ABBEY", "CASTLE", "CITADEL", "MANOR", "PAGODA", "MOSQUE", "LODGE", "CHALET"] },
  { theme: "Numbers", words: ["PRIME", "ORDINAL", "CARDINAL", "BINARY", "DECIMAL", "FRACTION", "QUOTIENT", "RADICAL"] },
  { theme: "Philosophy", words: ["LOGOS", "ETHOS", "PATHOS", "AXIOM", "TELOS", "PRAXIS", "LOGOS", "PRAGMA"] },
  { theme: "Poisons", words: ["VENOM", "TOXIN", "ARSENIC", "RICIN", "CYANIDE", "BELLADONNA", "CURARE", "HEMLOCK"] },
  { theme: "Constellations", words: ["ORION", "DRACO", "LYRA", "CORVUS", "VELA", "CETUS", "HYDRA", "LEPUS"] },
  { theme: "Bones", words: ["FEMUR", "HUMERUS", "FIBULA", "MANDIBLE", "COCCYX", "PHALANGES", "MAXILLA", "CALCANEUS"] },
  { theme: "Dance", words: ["WALTZ", "TANGO", "FOXTROT", "SAMBA", "POLKA", "JIVE", "RHUMBA", "BOLERO"] },
  { theme: "Cryptography", words: ["CIPHER", "HASH", "NONCE", "SALT", "BLOCK", "STREAM", "ROTATE", "XORKEY"] },
];

/**
 * Generate a word search grid. Places words randomly (horizontal/vertical/diagonal,
 * forward/backward) then fills the rest with random capital letters.
 */
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
      const dir = pick(dirs);
      const [dr, dc] = dir;
      const maxR = gridSize - dr * (word.length - 1);
      const maxC = gridSize - dc * (word.length - 1);
      const minR = dr < 0 ? (word.length - 1) * Math.abs(dr) : 0;
      const minC = dc < 0 ? (word.length - 1) * Math.abs(dc) : 0;
      if (maxR <= minR || maxC <= minC) continue;
      const startR = minR + Math.floor(Math.random() * (maxR - minR));
      const startC = minC + Math.floor(Math.random() * (maxC - minC));
      // Check cells
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

  // Fill blanks
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      if (grid[r][c] === "") {
        grid[r][c] = LETTERS[Math.floor(Math.random() * LETTERS.length)];
      }
    }
  }

  return grid;
}

// ─── Anagram Blitz ────────────────────────────────────────────────────────────

const ANAGRAM_SETS = [
  { words: ["PLANET", "GUITAR", "MONKEY", "LEMON", "BRIDGE"], hint: "Mixed bag of everyday words" },
  { words: ["CASTLE", "DRAGON", "KNIGHT", "SHIELD", "MOAT"], hint: "Medieval fantasy words" },
  { words: ["CAMERA", "FILTER", "EXPOSE", "SHUTTER", "FRAME"], hint: "Photography terms" },
  { words: ["OXYGEN", "CARBON", "HELIUM", "PROTON", "PLASMA"], hint: "Science words" },
  { words: ["VIOLIN", "CYMBAL", "GUITAR", "FLUTE", "CELLO"], hint: "Musical instruments" },
  { words: ["JUNGLE", "DESERT", "TUNDRA", "SWAMP", "SAVANNA"], hint: "Biomes of the world" },
  { words: ["SPRINT", "HURDLE", "DISCUS", "RELAY", "VAULT"], hint: "Athletics events" },
  { words: ["PEPPER", "GINGER", "CLOVES", "CUMIN", "THYME"], hint: "Kitchen spices" },
  { words: ["PIRATE", "ANCHOR", "GALLEON", "TREASURE", "COMPASS"], hint: "Pirate adventure words" },
  { words: ["CRYPTO", "WALLET", "LEDGER", "MINING", "BLOCK"], hint: "Blockchain terms" },
  { words: ["BALLET", "WALTZ", "FOXTROT", "TANGO", "SAMBA"], hint: "Styles of dance" },
  { words: ["CANOPY", "SHRUB", "POLLEN", "NECTAR", "SPORE"], hint: "Plant biology words" },
  { words: ["MARBLE", "BRONZE", "CANVAS", "FRESCO", "MOSAIC"], hint: "Art mediums" },
  { words: ["COWARD", "GALLANT", "BRAVE", "TIMID", "STOIC"], hint: "Words describing courage" },
  { words: ["CRATER", "CANYON", "GORGE", "TRENCH", "ABYSS"], hint: "Deep geographical features" },
  { words: ["SATURN", "URANUS", "VENUS", "MARS", "PLUTO"], hint: "Solar system bodies" },
  { words: ["FALCON", "CONDOR", "OSPREY", "KESTREL", "HARPY"], hint: "Birds of prey" },
  { words: ["RIDDLE", "CIPHER", "PUZZLE", "ENIGMA", "CLUE"], hint: "Mystery and puzzle words" },
  { words: ["BUDGET", "REVENUE", "PROFIT", "MARKUP", "ASSETS"], hint: "Business finance terms" },
  { words: ["SILVER", "COPPER", "NICKEL", "TITANIUM", "COBALT"], hint: "Metals and elements" },
  { words: ["GRAVEL", "BOULDER", "PUMICE", "GRANITE", "OBSIDIAN"], hint: "Types of rock" },
  { words: ["MAGNET", "CIRCUIT", "CURRENT", "VOLTAGE", "OHMIC"], hint: "Electricity terms" },
  { words: ["AUTHOR", "EDITOR", "SCRIPT", "GENRE", "PROSE"], hint: "Writing and literature words" },
  { words: ["CASTLE", "BISHOP", "ROOK", "KNIGHT", "PAWN"], hint: "Chess pieces" },
  { words: ["COBRA", "MAMBA", "PYTHON", "VIPER", "TAIPAN"], hint: "Venomous snakes" },
  { words: ["LANTERN", "BONFIRE", "STROBE", "TORCH", "EMBER"], hint: "Sources of light" },
  { words: ["SPRINT", "ENDURE", "HUSTLE", "GRIND", "PERSIST"], hint: "Effort and determination words" },
  { words: ["ROUTER", "SERVER", "DAEMON", "PACKET", "HEADER"], hint: "Networking terms" },
  { words: ["FOREST", "THICKET", "GLADE", "COPSE", "GROVE"], hint: "Wooded area words" },
  { words: ["FEUDAL", "EMPIRE", "SENATE", "DYNASTY", "REIGN"], hint: "Historical power structures" },
  { words: ["HUNTER", "GATHER", "FORAGE", "STALK", "AMBUSH"], hint: "Ancient survival words" },
  { words: ["TORQUE", "INERTIA", "FORCE", "VECTOR", "MASS"], hint: "Physics terms" },
  { words: ["ALLURE", "GLAMOUR", "FACADE", "BEGUILE", "CHARM"], hint: "Words about attraction" },
  { words: ["COBALT", "INDIGO", "VIOLET", "CRIMSON", "AUBURN"], hint: "Shades of color" },
  { words: ["TUNDRA", "BOREAL", "ALPINE", "STEPPE", "TAIGA"], hint: "Cold climate environments" },
  { words: ["DEBATE", "BALLOT", "CAUCUS", "FILIBUSTER", "VETO"], hint: "Political terms" },
  { words: ["MANTLE", "BASALT", "SCHIST", "GNEISS", "TECTONIC"], hint: "Geology words" },
  { words: ["LARYNX", "PHARYNX", "PALATE", "UVULA", "TONSIL"], hint: "Parts of the throat" },
  { words: ["NOVICE", "ADEPT", "MASTER", "EXPERT", "PRODIGY"], hint: "Skill levels" },
  { words: ["BLIGHT", "FAMINE", "PLAGUE", "DROUGHT", "FLOOD"], hint: "Catastrophe words" },
  { words: ["TURBAN", "KAFTAN", "KIMONO", "SARONG", "PONCHO"], hint: "Traditional clothing" },
  { words: ["DECODE", "ENCRYPT", "ROTATE", "HASH", "SALT"], hint: "Cryptography actions" },
  { words: ["GALLOP", "CANTER", "TROT", "PRANCE", "STRIDE"], hint: "Horse movement words" },
  { words: ["HARBOR", "ESTUARY", "LAGOON", "DELTA", "FJORD"], hint: "Coastal geography terms" },
  { words: ["RITUAL", "TOTEM", "SHRINE", "RELIC", "ORACLE"], hint: "Ancient culture words" },
  { words: ["MARBLE", "QUARTZ", "OBSIDIAN", "PYRITE", "FELDSPAR"], hint: "Minerals and stones" },
  { words: ["FRENZY", "FERVOR", "TUMULT", "UPROAR", "CHAOS"], hint: "Words meaning chaos" },
  { words: ["PONDER", "MUSE", "REFLECT", "RUMINATE", "CONTEMPLATE"], hint: "Deep thinking words" },
  { words: ["CAVERN", "GROTTO", "BURROW", "LAIR", "HOLLOW"], hint: "Underground spaces" },
  { words: ["GAMBIT", "FEINT", "BLUFF", "STRATAGEM", "RUSE"], hint: "Strategic deception words" },
];

// ─── Sudoku grids ─────────────────────────────────────────────────────────────
// 10 complete puzzle/solution pairs (varying difficulty)
const SUDOKU_DATA: Array<{ difficulty: Difficulty; puzzle: number[][]; solution: number[][] }> = [
  {
    difficulty: "easy",
    puzzle: [
      [5,3,0,0,7,0,0,0,0],[6,0,0,1,9,5,0,0,0],[0,9,8,0,0,0,0,6,0],
      [8,0,0,0,6,0,0,0,3],[4,0,0,8,0,3,0,0,1],[7,0,0,0,2,0,0,0,6],
      [0,6,0,0,0,0,2,8,0],[0,0,0,4,1,9,0,0,5],[0,0,0,0,8,0,0,7,9],
    ],
    solution: [
      [5,3,4,6,7,8,9,1,2],[6,7,2,1,9,5,3,4,8],[1,9,8,3,4,2,5,6,7],
      [8,5,9,7,6,1,4,2,3],[4,2,6,8,5,3,7,9,1],[7,1,3,9,2,4,8,5,6],
      [9,6,1,5,3,7,2,8,4],[2,8,7,4,1,9,6,3,5],[3,4,5,2,8,6,1,7,9],
    ],
  },
  {
    difficulty: "easy",
    puzzle: [
      [0,0,3,0,2,0,6,0,0],[9,0,0,3,0,5,0,0,1],[0,0,1,8,0,6,4,0,0],
      [0,0,8,1,0,2,9,0,0],[7,0,0,0,0,0,0,0,8],[0,0,6,7,0,8,2,0,0],
      [0,0,2,6,0,9,5,0,0],[8,0,0,2,0,3,0,0,9],[0,0,5,0,1,0,3,0,0],
    ],
    solution: [
      [4,8,3,9,2,1,6,5,7],[9,6,7,3,4,5,8,2,1],[2,5,1,8,7,6,4,9,3],
      [5,4,8,1,3,2,9,7,6],[7,2,9,5,6,4,1,3,8],[1,3,6,7,9,8,2,4,5],
      [3,7,2,6,8,9,5,1,4],[8,1,4,2,5,3,7,6,9],[6,9,5,4,1,7,3,8,2],
    ],
  },
  {
    difficulty: "medium",
    puzzle: [
      [0,0,0,2,6,0,7,0,1],[6,8,0,0,7,0,0,9,0],[1,9,0,0,0,4,5,0,0],
      [8,2,0,1,0,0,0,4,0],[0,0,4,6,0,2,9,0,0],[0,5,0,0,0,3,0,2,8],
      [0,0,9,3,0,0,0,7,4],[0,4,0,0,5,0,0,3,6],[7,0,3,0,1,8,0,0,0],
    ],
    solution: [
      [4,3,5,2,6,9,7,8,1],[6,8,2,5,7,1,4,9,3],[1,9,7,8,3,4,5,6,2],
      [8,2,6,1,9,5,3,4,7],[3,7,4,6,8,2,9,1,5],[9,5,1,7,4,3,6,2,8],
      [5,1,9,3,2,6,8,7,4],[2,4,8,9,5,7,1,3,6],[7,6,3,4,1,8,2,5,9],
    ],
  },
  {
    difficulty: "medium",
    puzzle: [
      [0,0,0,0,0,0,0,0,0],[0,0,0,0,0,3,0,8,5],[0,0,1,0,2,0,0,0,0],
      [0,0,0,5,0,7,0,0,0],[0,0,4,0,0,0,1,0,0],[0,9,0,0,0,0,0,0,0],
      [5,0,0,0,0,0,0,7,3],[0,0,2,0,1,0,0,0,0],[0,0,0,0,4,0,0,0,9],
    ],
    solution: [
      [9,8,7,6,5,4,3,2,1],[2,4,6,1,7,3,9,8,5],[3,5,1,9,2,8,7,4,6],
      [1,2,8,5,3,7,6,9,4],[6,3,4,8,9,2,1,5,7],[7,9,5,4,6,1,8,3,2],
      [5,1,9,2,8,6,4,7,3],[4,7,2,3,1,9,5,6,8],[8,6,3,7,4,5,2,1,9],
    ],
  },
  {
    difficulty: "hard",
    puzzle: [
      [8,0,0,0,0,0,0,0,0],[0,0,3,6,0,0,0,0,0],[0,7,0,0,9,0,2,0,0],
      [0,5,0,0,0,7,0,0,0],[0,0,0,0,4,5,7,0,0],[0,0,0,1,0,0,0,3,0],
      [0,0,1,0,0,0,0,6,8],[0,0,8,5,0,0,0,1,0],[0,9,0,0,0,0,4,0,0],
    ],
    solution: [
      [8,1,2,7,5,3,6,4,9],[9,4,3,6,8,2,1,7,5],[6,7,5,4,9,1,2,8,3],
      [1,5,4,2,3,7,8,9,6],[3,6,9,8,4,5,7,2,1],[2,8,7,1,6,9,5,3,4],
      [5,2,1,9,7,4,3,6,8],[4,3,8,5,2,6,9,1,7],[7,9,6,3,1,8,4,5,2],
    ],
  },
  {
    difficulty: "easy",
    puzzle: [
      [0,0,4,0,5,0,0,0,0],[9,0,0,7,3,4,6,0,0],[0,0,3,0,2,1,0,4,9],
      [0,3,5,0,9,0,4,8,0],[0,9,0,0,0,0,0,3,0],[0,7,6,0,1,0,5,2,0],
      [3,1,0,9,7,0,2,0,0],[0,0,9,1,8,2,0,0,3],[0,0,0,0,6,0,1,0,0],
    ],
    solution: [
      [1,2,4,6,5,9,3,7,8],[9,8,1,7,3,4,6,5,2],[6,5,3,8,2,1,7,4,9],
      [2,3,5,6,9,7,4,8,1],[8,9,2,5,4,6,9,3,7],[4,7,6,3,1,8,5,2,6],
      [3,1,8,9,7,5,2,6,4],[5,6,9,1,8,2,8,7,3],[7,4,7,4,6,3,1,9,5],
    ],
  },
  {
    difficulty: "medium",
    puzzle: [
      [0,0,0,6,0,0,4,0,0],[7,0,0,0,0,3,6,0,0],[0,0,0,0,9,1,0,8,0],
      [0,0,0,0,0,0,0,0,0],[0,5,0,1,8,0,0,0,3],[0,0,0,3,0,6,0,4,5],
      [0,4,0,2,0,0,0,6,0],[9,0,3,0,0,0,0,0,0],[0,2,0,0,0,0,1,0,0],
    ],
    solution: [
      [5,8,1,6,7,2,4,3,9],[7,9,2,8,4,3,6,5,1],[3,6,4,5,9,1,7,8,2],
      [4,3,6,9,2,7,8,1,0],[2,5,9,1,8,4,6,7,3],[1,7,8,3,5,6,2,4,5],
      [8,4,5,2,1,9,3,6,7],[9,1,3,7,6,5,5,2,4],[6,2,7,4,3,8,1,9,8],
    ],
  },
  {
    difficulty: "hard",
    puzzle: [
      [0,2,0,0,0,0,0,0,0],[0,0,0,6,0,0,0,0,3],[0,7,4,0,8,0,0,0,0],
      [0,0,0,0,0,3,0,0,2],[0,8,0,0,4,0,0,1,0],[6,0,0,5,0,0,0,0,0],
      [0,0,0,0,1,0,7,8,0],[5,0,0,0,0,9,0,0,0],[0,0,0,0,0,0,0,4,0],
    ],
    solution: [
      [1,2,6,4,3,7,9,5,8],[8,9,5,6,2,1,4,7,3],[3,7,4,9,8,5,1,2,6],
      [4,5,7,1,9,3,8,6,2],[9,8,3,2,4,6,5,1,7],[6,1,2,5,7,8,3,9,4],
      [2,6,9,3,1,4,7,8,5],[5,4,8,7,6,9,2,3,1],[7,3,1,8,5,2,6,4,9],
    ],
  },
  {
    difficulty: "easy",
    puzzle: [
      [1,0,0,4,8,9,0,0,6],[7,3,0,0,0,0,0,4,0],[0,0,0,0,0,1,2,9,5],
      [0,0,7,1,2,0,6,0,0],[5,0,0,7,0,3,0,0,8],[0,0,6,0,9,5,7,0,0],
      [9,1,4,6,0,0,0,0,0],[0,2,0,0,0,0,0,3,7],[8,0,0,5,1,2,0,0,4],
    ],
    solution: [
      [1,5,2,4,8,9,3,7,6],[7,3,9,2,5,6,8,4,1],[4,8,6,3,7,1,2,9,5],
      [3,9,7,1,2,8,6,5,4],[5,6,1,7,4,3,9,2,8],[2,4,6,9,5,7,1,6,3],
      [9,1,4,6,3,7,5,8,2],[6,2,5,8,9,4,1,3,7],[8,7,3,5,1,2,4,6,9],
    ],
  },
  {
    difficulty: "hard",
    puzzle: [
      [0,0,0,0,0,0,0,0,0],[0,0,0,0,0,3,0,8,5],[0,0,1,0,2,0,0,0,0],
      [0,0,0,5,0,7,0,0,0],[0,0,4,0,0,0,1,0,0],[0,9,0,0,0,0,0,0,0],
      [5,0,0,0,0,0,0,7,3],[0,0,2,0,1,0,0,0,0],[0,0,0,0,4,0,0,0,9],
    ],
    solution: [
      [9,8,7,6,5,4,3,2,1],[2,4,6,1,7,3,9,8,5],[3,5,1,9,2,8,7,4,6],
      [1,2,8,5,3,7,6,9,4],[6,3,4,8,9,2,1,5,7],[7,9,5,4,6,1,8,3,2],
      [5,1,9,2,8,6,4,7,3],[4,7,2,3,1,9,5,6,8],[8,6,3,7,4,5,2,1,9],
    ],
  },
];

// ─── Main seed ────────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱 Bulk puzzle seed starting...\n");

  // Upsert categories
  const [logic, wordCat, crypto, mystery, math] = await Promise.all([
    getOrCreateCategory("Logic", "#3891A6"),
    getOrCreateCategory("Word", "#FDE74C"),
    getOrCreateCategory("Cryptography", "#8B5CF6"),
    getOrCreateCategory("Mystery", "#3891A6"),
    getOrCreateCategory("Math", "#10B981"),
  ]);

  let total = 0;
  let skipped = 0;

  // Helper: skip if title exists
  async function titleExists(title: string) {
    const existing = await prisma.puzzle.findFirst({
      where: { title },
      select: { id: true },
    });
    return !!existing;
  }

  // ── 1. Riddle / General (50) ────────────────────────────────────────────
  console.log("📚 Seeding riddles (50)...");
  for (let i = 0; i < 50; i++) {
    const riddle = RIDDLES[i % RIDDLES.length];
    const difficulty: Difficulty = i < 20 ? "easy" : i < 35 ? "medium" : "hard";
    const title = `Riddle #${i + 1}: ${riddle.a}`;
    if (await titleExists(title)) { skipped++; continue; }
    await prisma.puzzle.create({
      data: {
        title,
        description: riddle.q,
        content: riddle.q,
        categoryId: mystery.id,
        difficulty,
        isActive: true,
        puzzleType: "general",
        riddleAnswer: riddle.a,
        xpReward: XP[difficulty],
        solutions: {
          create: [{ answer: riddle.a, isCorrect: true, points: POINTS[difficulty], ignoreCase: true, ignoreWhitespace: true }],
        },
      },
    });
    total++;
  }
  console.log(`  ✓ Riddles done\n`);

  // ── 2. Crack the Safe (50) ─────────────────────────────────────────────
  console.log("🔐 Seeding Crack the Safe (50)...");
  for (let i = 0; i < 50; i++) {
    const difficulty: Difficulty = i < 20 ? "easy" : i < 35 ? "medium" : "hard";
    const digits = difficulty === "easy" ? 4 : difficulty === "medium" ? 5 : 6;
    const code = generateSafeCode(digits);
    const clue = SAFE_CLUES[i % SAFE_CLUES.length];
    const msg = SAFE_MESSAGES[i % SAFE_MESSAGES.length];
    const title = `Crack the Safe #${i + 1}`;
    if (await titleExists(title)) { skipped++; continue; }
    await prisma.puzzle.create({
      data: {
        title,
        description: `Break the ${digits}-digit combination lock.`,
        content: clue,
        categoryId: logic.id,
        difficulty,
        isActive: true,
        puzzleType: "crack_safe",
        xpReward: XP[difficulty],
        data: { safecode: code, digits, maxAttempts: 10, clue, surpriseMessage: msg },
        solutions: {
          create: [{ answer: "__CRACK_SAFE__", isCorrect: true, points: POINTS[difficulty], ignoreCase: false, ignoreWhitespace: false }],
        },
      },
    });
    total++;
  }
  console.log(`  ✓ Crack the Safe done\n`);

  // ── 3. Hidden Word (50) ───────────────────────────────────────────────────
  console.log("🟩 Seeding Hidden Word (50)...");
  for (let i = 0; i < 50; i++) {
    const { word, hint } = WORD_CRACK_WORDS[i % WORD_CRACK_WORDS.length];
    const difficulty: Difficulty = word.length <= 4 ? "easy" : word.length === 5 ? "medium" : "hard";
    const title = `Hidden Word #${i + 1}: ${word.length} Letters`;
    if (await titleExists(title)) { skipped++; continue; }
    await prisma.puzzle.create({
      data: {
        title,
        description: `Guess the ${word.length}-letter word. You have 6 attempts.`,
        content: `Hidden Word: guess the hidden word. Hint: ${hint}`,
        categoryId: wordCat.id,
        difficulty,
        isActive: true,
        puzzleType: "word_crack",
        xpReward: XP[difficulty],
        data: { word, wordLength: word.length, maxGuesses: 6, hint },
        solutions: {
          create: [{ answer: word, isCorrect: true, points: POINTS[difficulty], ignoreCase: true, ignoreWhitespace: false }],
        },
      },
    });
    total++;
  }
  console.log(`  ✓ Hidden Word done\n`);

  // ── 4. Word Search (50) ────────────────────────────────────────────────
  console.log("🔍 Seeding Word Search (50)...");
  for (let i = 0; i < 50; i++) {
    const set = WORD_SEARCH_SETS[i % WORD_SEARCH_SETS.length];
    const difficulty: Difficulty = i < 20 ? "easy" : i < 35 ? "medium" : "hard";
    const gridSize = difficulty === "easy" ? 10 : difficulty === "medium" ? 12 : 15;
    const title = `Word Search #${i + 1}: ${set.theme}`;
    if (await titleExists(title)) { skipped++; continue; }
    const grid = generateWordSearchGrid(set.words, gridSize);
    await prisma.puzzle.create({
      data: {
        title,
        description: `Find all hidden words in the ${set.theme.toLowerCase()} grid.`,
        content: `Find: ${set.words.join(", ")}`,
        categoryId: wordCat.id,
        difficulty,
        isActive: true,
        puzzleType: "word_search",
        xpReward: XP[difficulty],
        data: {
          gridSize,
          words: set.words,
          grid,
          wordsRaw: set.words.join("\n"),
        },
        solutions: {
          create: [{ answer: "word_search_complete", isCorrect: true, points: POINTS[difficulty], ignoreCase: true, ignoreWhitespace: false }],
        },
      },
    });
    total++;
  }
  console.log(`  ✓ Word Search done\n`);

  // ── 5. Anagram Blitz (50) ──────────────────────────────────────────────
  console.log("🔀 Seeding Anagram Blitz (50)...");
  for (let i = 0; i < 50; i++) {
    const set = ANAGRAM_SETS[i % ANAGRAM_SETS.length];
    const difficulty: Difficulty = i < 20 ? "easy" : i < 35 ? "medium" : "hard";
    const timeLimit = difficulty === "easy" ? 90 : difficulty === "medium" ? 60 : 45;
    const title = `Anagram Blitz #${i + 1}: ${set.words.length} Words`;
    if (await titleExists(title)) { skipped++; continue; }
    await prisma.puzzle.create({
      data: {
        title,
        description: `Unscramble ${set.words.length} words as fast as you can.`,
        content: `${set.hint}. You have ${timeLimit} seconds per word.`,
        categoryId: wordCat.id,
        difficulty,
        isActive: true,
        puzzleType: "anagram_blitz",
        xpReward: XP[difficulty],
        data: { words: set.words, timeLimit, hint: set.hint },
        solutions: {
          create: [{ answer: "anagram_complete", isCorrect: true, points: POINTS[difficulty], ignoreCase: true, ignoreWhitespace: false }],
        },
      },
    });
    total++;
  }
  console.log(`  ✓ Anagram Blitz done\n`);

  // ── 6. Sudoku (50) ────────────────────────────────────────────────────
  console.log("🔢 Seeding Sudoku (50)...");
  const sudokuRotations = [0, 1, 2, 3, 4]; // just cycle the 10 grids
  for (let i = 0; i < 50; i++) {
    const src = SUDOKU_DATA[i % SUDOKU_DATA.length];
    const difficulty = src.difficulty;
    const title = `Sudoku #${i + 1} (${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)})`;
    if (await titleExists(title)) { skipped++; continue; }
    const timeLimit = difficulty === "easy" ? 600 : difficulty === "medium" ? 900 : 1200;
    const puzzle = await prisma.puzzle.create({
      data: {
        title,
        description: `A ${difficulty} sudoku puzzle. Fill the grid so every row, column, and 3×3 box contains the digits 1–9.`,
        content: "Classic 9×9 sudoku.",
        categoryId: math.id,
        difficulty,
        isActive: true,
        puzzleType: "sudoku",
        xpReward: XP[difficulty],
      },
    });
    await prisma.sudokuPuzzle.create({
      data: {
        puzzleId: puzzle.id,
        puzzleGrid: JSON.stringify(src.puzzle),
        solutionGrid: JSON.stringify(src.solution),
        difficulty,
        timeLimitSeconds: timeLimit,
      },
    });
    total++;
  }
  console.log(`  ✓ Sudoku done\n`);

  console.log(`\n🎉 Bulk seed complete!`);
  console.log(`   Created : ${total} puzzles`);
  console.log(`   Skipped : ${skipped} (already existed)`);
  console.log(`   Total   : 300 puzzles intended across 6 types`);
}

main()
  .catch((e) => { console.error("❌ Seed failed:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
