/**
 * seed-bots.ts
 * Creates 1358 realistic bot/fake users to populate leaderboards, puzzle stats,
 * Warz lobby, Gridlock solves, forum posts, and activity feeds.
 *
 * Run:         npx tsx scripts/seed-bots.ts
 * Force wipe:  npx tsx scripts/seed-bots.ts --force
 */

import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import * as path from "path";

config({ path: path.resolve(process.cwd(), ".env.local") });
config({ path: path.resolve(process.cwd(), ".env") });

const prisma = new PrismaClient();

const FORCE = process.argv.includes("--force");

// --- Constants ---------------------------------------------------------------
const TOTAL_BOTS = 1358;

// ─── Username generation ─────────────────────────────────────────────────────
const WORDS_A = [
  // Gaming / tech vibe
  "Shadow","Cipher","Pixel","Neon","Glitch","Rogue","Frost","Void","Byte","Vex",
  "Hex","Echo","Blaze","Phantom","Storm","Iron","Ghost","Nova","Arc","Nebula",
  "Ember","Flux","Drift","Pulse","Prism","Static","Vector","Binary","Wraith","Raven",
  // Personality / mood
  "Lazy","Lucky","Silent","Golden","Wild","Cozy","Smooth","Sleepy","Salty","Bold",
  "Sharp","Quick","Tiny","Fuzzy","Calm","Broken","Hidden","Lost","Ancient","Empty",
  "Bright","Bitter","Hollow","Rusty","Cloudy","Crispy","Frozen","Dusty","Gloomy","Stray",
  // Colour / nature
  "Misty","Rainy","Arctic","Desert","Sunset","Starry","Amber","Cobalt","Indigo","Teal",
  "Scarlet","Violet","Ivory","Sage","Dusk","Crimson","Azure","Lunar","Solar","Mossy",
  // Punchy cool words
  "Blitz","Surge","Cryo","Arcane","Neural","Quantum","Onyx","Apex","Zenith","Omega",
];
const WORDS_B = [
  // Animals — extremely common in real usernames
  "Wolf","Fox","Hawk","Cat","Crow","Bear","Shark","Eagle","Panda","Raccoon",
  "Turtle","Bunny","Moose","Seal","Crab","Otter","Lynx","Ferret","Moth","Swan",
  "Gecko","Bison","Frog","Elk","Koi","Vole","Quail","Mink","Heron","Newt",
  // Food — very popular in real player names
  "Noodle","Taco","Muffin","Waffle","Ramen","Boba","Bagel","Pickle","Toast","Donut",
  "Dumpling","Biscuit","Nacho","Sushi","Peach","Plum","Mango","Gummy","Pretzel","Chip",
  // Everyday objects / vibes
  "Brick","Lamp","Lens","Mug","Rock","Coin","Flag","Bolt","Cog","Cloud",
  "Cactus","Pebble","Wrench","Dial","Sock","Knot","Loop","Snap","Bloom","Shard",
  // Gaming roles (diverse, not just compound-noun filler)
  "Hunter","Seeker","Knight","Scout","Ninja","Ranger","Wizard","Archer","Warden","Bard",
  "Lancer","Paladin","Monk","Assassin","Duelist","Cleric","Druid","Rogue","Sniper","Pilot",
  // Internet / player culture vibes
  "Grinder","Lurker","Tryhard","Casual","Clutch","Carry","Noob","Nerd","Geek","Smurf",
];
const FIRST_NAMES = [
  "jake","tyler","mason","logan","ethan","liam","noah","aiden","caleb","lucas",
  "ryan","dylan","cole","adam","sean","alex","jay","kai","drew","max",
  "riley","morgan","jordan","casey","avery","taylor","reese","quinn","blake","sage",
  "maya","aria","luna","zoe","mia","elena","nova","ivy","jade","ruby",
  "sam","cam","ash","nick","ben","tom","lee","dan","rob","chris",
];
const SPECIAL_PREFIXES = [
  "x","X","i","o","v","The","Itz","Its","Real","Not","Just","Dark","Ultra",
];
const SUFFIX_WORDS = ["Pro","GG","WZ","Ace","Rex","Max","OG","Jr","XD","HD","OP","IV"];
const NUM_SUFFIXES = ["2","3","7","9","11","13","21","42","47","69","77","88","99","100","404","1337","07"];

function pickByIndex<T>(arr: T[], seed: number): T {
  return arr[((seed % arr.length) + arr.length) % arr.length];
}

// Tracks names already given out so we can avoid exact duplicates.
const _usedUsernames = new Set<string>();

function generateUsername(index: number): string {
  const r = <T>(seed: number, arr: T[]): T => pickByIndex(arr, seed);

  const A    = r(index * 7,  WORDS_A);
  const B    = r(index * 13, WORDS_B);
  const A2   = r(index * 37, WORDS_A);
  const B2   = r(index * 41, WORDS_B);
  const name = r(index * 53, FIRST_NAMES);
  const pre  = r(index * 23, SPECIAL_PREFIXES);
  const suf  = r(index * 43, SUFFIX_WORDS);
  const num  = r(index * 3,  NUM_SUFFIXES);
  const yr   = r(index * 59, ["04","05","06","07","08","09","10","11","12","2004","2005","2006","2007","2008","2009","2010"]);

  let base: string;
  switch (index % 18) {
    case 0:  base = A + B;                                              break; // ShadowWolf / LazyFox
    case 1:  base = A.toLowerCase() + "_" + B.toLowerCase();           break; // shadow_wolf / lazy_fox
    case 2:  base = A + B + num;                                        break; // ShadowWolf42
    case 3:  base = pre + A + B;                                        break; // xShadowWolf
    case 4:  base = A.toLowerCase() + num;                              break; // shadow42
    case 5:  base = A2.toLowerCase() + B.toLowerCase() + suf.toLowerCase(); break; // phantomwolfgg
    case 6:  base = (A + B).toLowerCase();                              break; // shadowwolf
    case 7:  base = A + suf;                                            break; // ShadowPro
    case 8:  base = name + num;                                         break; // jake42
    case 9:  base = A2.toLowerCase() + B.toLowerCase() +
                    r(index * 67, ["","","7","42","99","404"]);         break; // echocat / echocat7
    case 10: base = name + yr;                                          break; // jake2007
    case 11: base = A2 + B2;                                            break; // PhantomFox
    case 12: base = (A2 + B2).toLowerCase() + num;                     break; // phantomfox42
    case 13: base = "its" + name;                                       break; // itsryan
    case 14: base = A.toLowerCase() + B2.toLowerCase() + "_" +
                    r(index * 71, ["gg","og","v2","xd","hd","99","404"]); break; // shadowfox_gg
    case 15: base = name + "_" +
                    r(index * 79, ["x","z","k","w","gg","pw","real","og"]); break; // jake_x
    case 16: base = B.toLowerCase() + num;                              break; // wolf42 / taco99
    case 17: base = A.toLowerCase() + B2.toLowerCase();                 break; // lazywolf
    default: base = A + B;
  }

  // Resolve duplicates by appending a short number
  if (!_usedUsernames.has(base)) {
    _usedUsernames.add(base);
    return base;
  }
  for (let n = 2; n <= 9999; n++) {
    const candidate = base + n;
    if (!_usedUsernames.has(candidate)) {
      _usedUsernames.add(candidate);
      return candidate;
    }
  }
  return base + index; // absolute last resort
}


// ─── Shared helpers ───────────────────────────────────────────────────────────
function pickRand<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

// ─── Avatar URLs (DiceBear — free, public, no auth) ──────────────────────────
// ~25% of bots get a custom avatar, others use null (default avatar on site)
// ─── Avatar URLs ─────────────────────────────────────────────────────────────
// randomuser.me hosts 100 male + 100 female portrait photos at predictable
// static URLs — 200 unique real human faces, no API key required.
// Sequential counter ensures each portrait is used exactly once, with no modulo
// collisions. After 200 are assigned, remaining bots get null (site default).
const PORTRAIT_URLS: string[] = [];
for (let i = 0; i < 100; i++) PORTRAIT_URLS.push(`https://randomuser.me/api/portraits/men/${i}.jpg`);
for (let i = 0; i < 100; i++) PORTRAIT_URLS.push(`https://randomuser.me/api/portraits/women/${i}.jpg`);

let _avatarCounter = 0;

function maybeAvatar(_username: string, _index: number): string | null {
  // 40% of bots get no avatar (realistic: many users never upload one)
  if (Math.random() < 0.4) return null;
  // All 200 unique portraits exhausted — rest get site default
  if (_avatarCounter >= PORTRAIT_URLS.length) return null;
  return PORTRAIT_URLS[_avatarCounter++];
}

// ─── Cosmetics ────────────────────────────────────────────────────────────────
const THEMES   = ["default","default","default","default","gold","neon","crimson"]; // mostly default
const FRAMES   = ["none","none","none","gold","neon","flame","ignition_bronze","ignition_silver"];
const FLAIRS   = ["none","none","none","none","🔥","⚡","👑","⚔️🏆"];
const SKINS    = ["default","default","default","retro","neon","minimal","lava","galaxy","ice"];

// ─── XP Titles (from levels.ts) ──────────────────────────────────────────────
function calcLevel(xp: number): { level: number; title: string } {
  const LEVELS = [
    { level: 1,  xp: 0,     title: "Newcomer"       },
    { level: 2,  xp: 100,   title: "Apprentice"     },
    { level: 3,  xp: 250,   title: "Puzzle Scout"   },
    { level: 4,  xp: 500,   title: "Code Breaker"   },
    { level: 5,  xp: 900,   title: "Cipher Seeker"  },
    { level: 6,  xp: 1400,  title: "Riddle Hunter"  },
    { level: 7,  xp: 2100,  title: "Lock Prober"    },
    { level: 8,  xp: 3000,  title: "Vault Prober"   },
    { level: 9,  xp: 4200,  title: "Mind Bender"    },
    { level: 10, xp: 5800,  title: "Enigma Solver"  },
    { level: 11, xp: 7800,  title: "Shadow Cracker" },
    { level: 12, xp: 10000, title: "Cipher Adept"   },
    { level: 13, xp: 13000, title: "Puzzle Warden"  },
    { level: 14, xp: 17000, title: "Vault Breaker"  },
    { level: 15, xp: 22000, title: "Code Phantom"   },
    { level: 16, xp: 28000, title: "Riddle Sage"    },
    { level: 17, xp: 35000, title: "Enigma Master"  },
    { level: 18, xp: 44000, title: "Cipher Legend"  },
    { level: 19, xp: 55000, title: "Puzzle Warlord" },
    { level: 20, xp: 70000, title: "Grand Cipher"   },
  ];
  let cur = LEVELS[0];
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].xp) { cur = LEVELS[i]; break; }
  }
  return { level: cur.level, title: cur.title };
}

// ─── Tier helpers ─────────────────────────────────────────────────────────────
// Tier 0=lurker, 1=casual, 2=regular, 3=dedicated, 4=hardcore, 5=legend
//
// ppS is GONE. Every puzzle solve is flat 100 pts (matching all submit routes).
// totalPoints = solveCount * 100 + randInt(0, 99)  ← the +noise keeps every bot
// unique while guaranteeing Math.floor(totalPoints / 100) === solveCount exactly.
//
// xpS = xp per solve. Real default is 50 (xpReward), gridlock is 100.
// Ranges are wide and overlapping so bot levels spread naturally across the curve.
// Power-law distribution skewed toward lower values within a range.
// exp > 1 means most results land near `min`; use 1.0 for uniform (=randInt).
function randPow(min: number, max: number, exp: number = 1.8): number {
  return Math.floor(min + Math.pow(Math.random(), exp) * (max - min + 1));
}

function tierProfile(tier: number) {
  switch (tier) {
    case 0: return { solveCount: 0,                         xpS: 0,              streak: 0 };
    case 1: return { solveCount: randPow(1,   8,   2.0),    xpS: randInt(40, 70),  streak: randInt(0, 4) };
    case 2: return { solveCount: randPow(5,   20,  1.8),    xpS: randInt(45, 80),  streak: randInt(0, 14) };
    case 3: return { solveCount: randPow(12,  35,  1.6),    xpS: randInt(50, 90),  streak: randInt(1, 28) };
    case 4: return { solveCount: randPow(22,  48,  1.5),    xpS: randInt(55, 100), streak: randInt(3, 60) };
    case 5: return { solveCount: randPow(35,  54,  1.3),    xpS: randInt(60, 110), streak: randInt(8, 140) };
    default: return { solveCount: 1, xpS: 50, streak: 0 };
  }
}

// Tier distribution: 0=lurker(5%), 1=casual(30%), 2=regular(35%), 3=dedicated(18%), 4=hardcore(8%), 5=legend(4%)
function assignTier(index: number): number {
  const r = Math.random();
  if (r < 0.05) return 0;
  if (r < 0.35) return 1;
  if (r < 0.70) return 2;
  if (r < 0.88) return 3;
  if (r < 0.96) return 4;
  return 5;
}

// ─── Achievement assignment ───────────────────────────────────────────────────
// Returns achievement names earned based on solve count
function achievementsForSolves(solves: number): string[] {
  const earned: string[] = [];
  if (solves >= 1)   earned.push("first_blood");
  if (solves >= 10)  earned.push("decade_club");
  if (solves >= 100) earned.push("century_club");
  if (solves >= 500) earned.push("legend_status");
  // Probabilistic ones
  if (solves >= 5  && Math.random() < 0.4) earned.push("speed_runner");
  if (solves >= 8  && Math.random() < 0.3) earned.push("early_bird");
  if (solves >= 15 && Math.random() < 0.25) earned.push("hint_minimalist");
  if (solves >= 10 && Math.random() < 0.3) earned.push("hint_hoarder");
  if (solves >= 1  && Math.random() < 0.5) earned.push("bullseye");   // first try
  if (solves >= 10 && Math.random() < 0.2) earned.push("sharpshooter");
  if (solves >= 3  && Math.random() < 0.2) earned.push("streak_starter");
  if (solves >= 10 && Math.random() < 0.15) earned.push("streak_warrior");
  if (solves >= 25 && Math.random() < 0.1) earned.push("streak_legend");
  if (solves >= 20 && Math.random() < 0.15) earned.push("comeback_king");
  if (solves >= 5  && Math.random() < 0.15) earned.push("social_butterfly");
  return earned;
}

// ─── Forum post content ───────────────────────────────────────────────────────
const FORUM_TITLES = [
  "Finally cracked the safe! Here's how...",
  "Tips for the harder riddles?",
  "Anyone else stuck on the ARG puzzle?",
  "This game is actually making me smarter lmao",
  "Hidden Word tips for beginners",
  "My strategy for expert difficulty puzzles",
  "New to Puzzle Warz - where do I start?",
  "The Detective case was absolutely insane",
  "Warz challenge anyone? I need competition",
  "Best puzzles for grinding XP fast",
  "How long did the escape room take you?",
  "I've been solving puzzles for 2 weeks straight now",
  "Season pass worth it?",
  "Anybody else get the Cipher Legend title?",
  "The gridlock puzzles are surprisingly satisfying",
  "Hot take: Math puzzles are the hardest",
  "Looking for teammates for the escape room",
  "Just hit level 10 🎉",
  "Daily puzzle streak - what's yours?",
  "Parasite Code made my head explode",
  "Code Master puzzle hints without spoilers",
  "Is there a way to search puzzles by difficulty?",
  "Favorite puzzle type?",
  "Leaderboard grind is real, tips?",
  "Blackout puzzle strategies",
];
const FORUM_CONTENTS = [
  "Really loving this platform. The puzzles are challenging but fair. Been playing for about a month now and my logical thinking has definitely improved.",
  "Pro tip: for Hidden Word, always start with the most common letters. E, A, R, I, O, T. Work outward from there.",
  "The escape room was WAY harder than I expected. Took my team nearly 3 hours but we finally made it through stage 5.",
  "Anyone know if there's a time limit on the ARG puzzles? I keep running out of ideas and having to step away.",
  "Just unlocked the Gold Frame cosmetic and honestly my profile looks fire now 👑",
  "For anyone struggling with the cipher puzzles - try writing out all 26 letter frequencies first, then matching to common English patterns.",
  "I think the safe crack puzzles are actually the most satisfying when you get them right. That click sound effect hits different.",
  "Hot take: difficulty ratings on some puzzles are way off. The 'easy' crimes case took me longer than a 'hard' riddle.",
  "Looking to form a team for competitive Warz. Need at least 2 more dedicated players. DM me.",
  "The math puzzles caught me completely off guard. Thought it would be simple arithmetic but nope, full algebra.",
  "Streak is at 23 days now. Protecting it with everything I have. Sleep before puzzles? Never.",
  "Anyone else notice that the gridlock puzzles have a satisfying arc each week? Like the difficulty ramps up deliberately.",
  "My strategy: do all easy puzzles first for quick XP, then tackle the hard ones when I'm warmed up mentally.",
  "For the code master puzzles, learn basic regex. It helps way more than you'd think.",
  "The word search puzzles are deceptively hard once you get to the harder difficulty levels.",
  "Just placed top 10 on the weekly leaderboard for the first time. Feels incredible.",
  "Does anyone actually use hints? I feel like using them is cheating myself.",
  "The riddle puzzles are my absolute favorite. Simple premise, but the answers are always clever.",
  "Been grinding for 2 months and just hit level 15. The titles are getting better lol. 'Code Phantom' bangs.",
  "Pro tip for new players: the daily puzzle is worth doing every single day for the streak bonus XP.",
];

const FORUM_COMMENTS = [
  "This is exactly what I needed, thanks!",
  "Same here, been stuck on that one for days.",
  "Great tip! Going to try this tonight.",
  "Agreed, the difficulty scaling is a bit inconsistent sometimes.",
  "The cipher puzzles definitely need some prior knowledge to crack efficiently.",
  "Honestly the hint system is fair, no shame in using it.",
  "My team cleared it in under 2 hours with good coordination.",
  "The weekly leaderboard grind is intense, good luck to everyone competing!",
  "Level 15 is a huge milestone, congrats! 🎉",
  "I've been playing since day 1 and the platform keeps getting better.",
  "For Hidden Word, also try thinking about less common letters that could unlock entire sections.",
  "Legend status confirmed, the escape room is genuinely difficult.",
  "The Warz challenges are addictive, fair warning lol",
  "Daily streak at 45 here. The Streak Shield item has saved me twice already!",
  "Parasite Code is literally cryptography. Wild puzzle.",
  "Just do the daily puzzle every day, the XP adds up fast.",
  "Once you get into the rhythm of it, the puzzles feel way more intuitive.",
  "Hot take: the leaderboard is more motivating than any achievement badge.",
  "Season pass is definitely worth it for the exclusive frames alone.",
  "The gridlock arc format is genius. Week 1 you're confused, week 7 you're a god.",
];

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  if (FORCE) {
    console.log("🗑️  --force: wiping all existing bot data...");
    const botIds = await prisma.user.findMany({ where: { isBot: true }, select: { id: true } }).then(r => r.map(u => u.id));
    if (botIds.length > 0) {
      // Delete in dependency order
      await prisma.activity.deleteMany({ where: { userId: { in: botIds } } });
      await prisma.dailyWordRecord.deleteMany({ where: { userId: { in: botIds } } });
      await prisma.follow.deleteMany({ where: { OR: [{ followerId: { in: botIds } }, { followingId: { in: botIds } }] } });
      await prisma.forumComment.deleteMany({ where: { authorId: { in: botIds } } });
      await prisma.forumPost.deleteMany({ where: { authorId: { in: botIds } } });
      await prisma.userAchievement.deleteMany({ where: { userId: { in: botIds } } });
      await prisma.userStreak.deleteMany({ where: { userId: { in: botIds } } });
      await prisma.puzzleRating.deleteMany({ where: { userId: { in: botIds } } });
      await prisma.userPuzzleProgress.deleteMany({ where: { userId: { in: botIds } } });
      await prisma.gridlockSolve.deleteMany({ where: { userId: { in: botIds } } });
      await prisma.puzzleWarzChallenge.deleteMany({ where: { OR: [{ challengerId: { in: botIds } }, { opponentId: { in: botIds } }] } });
      // Teams created by bots (cascade deletes members)
      await prisma.team.deleteMany({ where: { createdBy: { in: botIds } } });
      await prisma.teamMember.deleteMany({ where: { userId: { in: botIds } } });
      await prisma.globalLeaderboard.deleteMany({ where: { userId: { in: botIds } } });
      await prisma.user.deleteMany({ where: { isBot: true } });
      console.log(`  ✓ Wiped ${botIds.length} bots and all related data`);
    } else {
      console.log("  ℹ  No existing bots to wipe");
    }
  }

  console.log("🤖 Starting bot seed — fetching existing data...");

  // 1. Fetch real puzzles
  const puzzles = await prisma.puzzle.findMany({
    where: { isActive: true },
    select: { id: true, puzzleType: true, difficulty: true, xpReward: true },
  });
  if (puzzles.length === 0) {
    console.error("❌ No active puzzles found — run the puzzle seed first.");
    return;
  }
  console.log(`  ✓ Found ${puzzles.length} active puzzles`);

  // Gridlock puzzles specifically (for GridlockSolve records)
  const gridlockPuzzles = puzzles.filter(p => p.puzzleType === "gridlock_file");
  console.log(`  ✓ Found ${gridlockPuzzles.length} gridlock puzzles`);

  // Non-warz-exclusive puzzles for progress records
  const eligibleForProgress = puzzles;

  // 2. Fetch real achievements (only names that exist in DB)
  const dbAchievements = await prisma.achievement.findMany({ select: { id: true, name: true } });
  const achievementMap = new Map<string, string>(dbAchievements.map(a => [a.name, a.id]));
  console.log(`  ✓ Found ${dbAchievements.length} achievements`);

  // 3. Check how many bots already exist to avoid re-running
  const existingBotCount = await prisma.user.count({ where: { isBot: true } });
  if (existingBotCount >= TOTAL_BOTS) {
    console.log(`⚠️  ${existingBotCount} bots already exist. Skipping user creation. Re-run with --force to wipe and redo.`);
    // Still run the later steps that might be missing
  } else {
    console.log(`  ✓ ${existingBotCount} bots exist, will create ${TOTAL_BOTS - existingBotCount} new bots`);
  }

  // ── STEP 1: Create bot users ────────────────────────────────────────────────
  const botsToCreate = TOTAL_BOTS - existingBotCount;
  const newBotIds: string[] = [];

  if (botsToCreate > 0) {
    console.log(`\n👤 Creating ${botsToCreate} bot users...`);
    const BATCH = 100;
    let created = 0;

    for (let batch = 0; batch < Math.ceil(botsToCreate / BATCH); batch++) {
      const start = batch * BATCH;
      const end = Math.min(start + BATCH, botsToCreate);
      const usersData = [];

      for (let i = start; i < end; i++) {
        const globalIndex = existingBotCount + i;
        const username = generateUsername(globalIndex);
        const tier = assignTier(globalIndex);
        const { solveCount, xpS, streak } = tierProfile(tier);
        // Base: 100 pts/solve (flat, matching all submit routes)
        // + 0-99 noise so no two bots land on the same total, and
        //   Math.floor(totalPts / 100) === solveCount is always exact.
        const totalPts = solveCount > 0 ? solveCount * 100 + randInt(0, 99) : 0;
        const totalXp  = solveCount * xpS;
        const { level, title } = calcLevel(totalXp);

        // Join date: spread over past 18 months
        const daysAgo = randInt(1, 540);
        const createdAt = new Date(Date.now() - daysAgo * 86400000);

        usersData.push({
          // Store tier and solve count in name prefix we'll read later
          name: username,
          email: null as string | null,
          isBot: true,
          image: maybeAvatar(username, globalIndex),
          xp: totalXp,
          level,
          xpTitle: title,
          totalPoints: totalPts,
          activeTheme: pickRand(THEMES),
          activeFrame: pickRand(FRAMES),
          activeFlair: pickRand(FLAIRS),
          activeSkin: pickRand(SKINS),
          createdAt,
          updatedAt: createdAt,
        });
      }

      // Bulk insert
      await prisma.user.createMany({ data: usersData, skipDuplicates: true });
      created += usersData.length;
      process.stdout.write(`\r  Creating users... ${created}/${botsToCreate}`);
    }
    console.log(`\n  ✓ Created ${created} bot users`);
  }

  // ── Fetch ALL bot user IDs and their stats ──────────────────────────────────
  console.log("\n🔍 Fetching all bot user records...");
  const allBots = await prisma.user.findMany({
    where: { isBot: true },
    select: { id: true, name: true, totalPoints: true, xp: true, createdAt: true },
  });
  console.log(`  ✓ ${allBots.length} bots total`);

  // ── STEP 2: Create UserPuzzleProgress for bots ─────────────────────────────
  console.log("\n🧩 Seeding puzzle progress for bots...");

  const existingProgressCount = await prisma.userPuzzleProgress.count({
    where: { userId: { in: allBots.map(b => b.id) } },
  });
  const alreadyHasProgress = existingProgressCount > 0;

  if (!alreadyHasProgress) {
    let progressRows: any[] = [];
    const FLUSH = 2000;

    for (const bot of allBots) {
      // Derive solve count from totalPoints — base is 100 pts/solve, matching actual submit routes
      const avgPtsPerSolve = 100;
      const solveCount = Math.min(
        Math.floor(bot.totalPoints / avgPtsPerSolve),
        eligibleForProgress.length
      );
      if (solveCount === 0) continue;

      // Pick a random subset of puzzles
      const shuffled = [...eligibleForProgress].sort(() => Math.random() - 0.5);
      const toSolve = shuffled.slice(0, solveCount);

      const joinedAt = bot.createdAt;
      const daysActive = Math.max(1, Math.floor((Date.now() - joinedAt.getTime()) / 86400000));

      for (const puzzle of toSolve) {
        // Weight solve dates toward the recent past so bots appear on weekly/monthly leaderboards.
        // ~35% of solves land in last 30 days, ~25% in last 31-90 days, rest spread over history.
        let solveOffset: number;
        const r = Math.random();
        if (r < 0.35) {
          solveOffset = daysActive - randInt(0, Math.min(29, daysActive - 1));
        } else if (r < 0.60) {
          solveOffset = daysActive - randInt(30, Math.min(90, daysActive - 1));
        } else {
          solveOffset = randInt(0, Math.min(daysActive - 1, 540));
        }
        const solvedAt = new Date(joinedAt.getTime() + Math.max(0, solveOffset) * 86400000);

        progressRows.push({
          userId: bot.id,
          puzzleId: puzzle.id,
          solved: true,
          solvedAt,
          attempts: randInt(1, 4),
          successfulAttempts: 1,
          failedAttempts: 0,
          pointsEarned: 100,
          completionPercentage: 100,
          viewedAt: new Date(solvedAt.getTime() - randInt(60, 600) * 1000),
          updatedAt: solvedAt,
        });

        if (progressRows.length >= FLUSH) {
          await prisma.userPuzzleProgress.createMany({ data: progressRows, skipDuplicates: true });
          progressRows = [];
          process.stdout.write(".");
        }
      }
    }

    if (progressRows.length > 0) {
      await prisma.userPuzzleProgress.createMany({ data: progressRows, skipDuplicates: true });
    }
    console.log(`\n  ✓ Puzzle progress seeded`);
  } else {
    console.log("  ⏭  Progress already exists, skipping.");
  }

  // ── STEP 3: UserStreak ───────────────────────────────────────────────────────
  console.log("\n🔥 Seeding streaks...");
  const existingStreakCount = await prisma.userStreak.count({
    where: { userId: { in: allBots.map(b => b.id) } },
  });

  if (existingStreakCount === 0) {
    const streakRows: any[] = [];
    for (const bot of allBots) {
      if (bot.totalPoints < 100) continue; // lurkers have no streak
      const solves = Math.floor(bot.totalPoints / 100);
      const currentStreak = randInt(0, Math.min(solves, 60));
      const longestStreak = currentStreak + randInt(0, 30);
      const lastSolveDate = currentStreak > 0
        ? new Date(Date.now() - randInt(0, 1) * 86400000)
        : new Date(Date.now() - randInt(3, 60) * 86400000);

      streakRows.push({
        userId: bot.id,
        currentStreak,
        longestStreak,
        lastSolveDate,
        streakStartDate: currentStreak > 0
          ? new Date(lastSolveDate.getTime() - currentStreak * 86400000)
          : null,
        updatedAt: lastSolveDate,
      });
    }
    await prisma.userStreak.createMany({ data: streakRows, skipDuplicates: true });
    console.log(`  ✓ Created ${streakRows.length} streak records`);
  } else {
    console.log("  ⏭  Streaks already exist, skipping.");
  }

  // ── STEP 4: UserAchievements ─────────────────────────────────────────────────
  console.log("\n🏆 Seeding achievements...");
  const existingAchievementCount = await prisma.userAchievement.count({
    where: { userId: { in: allBots.map(b => b.id) } },
  });

  if (existingAchievementCount === 0) {
    let achievementRows: any[] = [];
    const FLUSH = 3000;

    for (const bot of allBots) {
      const solves = Math.floor(bot.totalPoints / 100);
      const earnedNames = achievementsForSolves(solves);
      for (const name of earnedNames) {
        const id = achievementMap.get(name);
        if (!id) continue;
        const unlockedAt = new Date(bot.createdAt.getTime() + randInt(1, 30) * 86400000);
        achievementRows.push({ userId: bot.id, achievementId: id, unlockedAt });
        if (achievementRows.length >= FLUSH) {
          await prisma.userAchievement.createMany({ data: achievementRows, skipDuplicates: true });
          achievementRows = [];
          process.stdout.write("🏅");
        }
      }
    }
    if (achievementRows.length > 0) {
      await prisma.userAchievement.createMany({ data: achievementRows, skipDuplicates: true });
    }
    console.log(`\n  ✓ Achievement records seeded`);
  } else {
    console.log("  ⏭  Achievements already exist, skipping.");
  }

  // ── STEP 5: Puzzle Ratings ───────────────────────────────────────────────────
  console.log("\n⭐ Seeding puzzle ratings...");
  const existingRatingCount = await prisma.puzzleRating.count({
    where: { userId: { in: allBots.slice(0, 200).map(b => b.id) } },
  });

  if (existingRatingCount === 0) {
    let ratingRows: any[] = [];
    // Only 200 bots rate puzzles (realistic — most players don't bother)
    const raterBots = allBots.filter(b => b.totalPoints > 500).slice(0, 350);

    for (const bot of raterBots) {
      const solves = Math.floor(bot.totalPoints / 100);
      const numToRate = Math.min(randInt(1, Math.max(1, Math.floor(solves * 0.3))), 20);
      const puzzleSubset = [...eligibleForProgress]
        .sort(() => Math.random() - 0.5)
        .slice(0, numToRate);

      for (const puzzle of puzzleSubset) {
        // Rating skewed toward positive (3-5 stars) with occasional 2
        const rating = pickRand([3, 3, 4, 4, 4, 5, 5, 5, 2, 3]);
        ratingRows.push({
          puzzleId: puzzle.id,
          userId: bot.id,
          rating,
          createdAt: new Date(bot.createdAt.getTime() + randInt(1, 90) * 86400000),
          updatedAt: new Date(),
        });
      }
    }

    if (ratingRows.length > 0) {
      await prisma.puzzleRating.createMany({ data: ratingRows, skipDuplicates: true });
      console.log(`  ✓ Created ${ratingRows.length} puzzle ratings`);
    }
  } else {
    console.log("  ⏭  Ratings already exist, skipping.");
  }

  // ── STEP 6: Gridlock Solves ───────────────────────────────────────────────────
  if (gridlockPuzzles.length > 0) {
    console.log("\n🔒 Seeding Gridlock solves...");
    const existingGridlockCount = await prisma.gridlockSolve.count({
      where: { userId: { in: allBots.map(b => b.id) } },
    });

    if (existingGridlockCount === 0) {
      const RANKS = ["S","S","A","A","A","B","B","B","C","C","D"];
      let gridlockRows: any[] = [];

      for (const puzzle of gridlockPuzzles) {
        // Each gridlock puzzle gets 40-120 fake solves
        const solveCount = randInt(40, 120);
        const solvers = [...allBots]
          .filter(b => b.totalPoints > 200)
          .sort(() => Math.random() - 0.5)
          .slice(0, solveCount);

        for (const bot of solvers) {
          const rank = pickRand(RANKS);
          const elapsed = rank === "S" ? randInt(90, 300)
                        : rank === "A" ? randInt(300, 600)
                        : rank === "B" ? randInt(600, 900)
                        : rank === "C" ? randInt(900, 1500)
                        : randInt(1500, 2400);

          gridlockRows.push({
            puzzleId: puzzle.id,
            userId: bot.id,
            rank,
            elapsedSeconds: elapsed,
            submissionCount: randInt(1, rank === "S" ? 2 : rank === "A" ? 3 : 5),
            // Weight toward recent: ~35% within last 2 days so they appear in today's standings
            solvedAt: new Date(Date.now() - (Math.random() < 0.35 ? randInt(0, 1) : randInt(2, 90)) * 86400000),
          });
        }
      }

      if (gridlockRows.length > 0) {
        await prisma.gridlockSolve.createMany({ data: gridlockRows, skipDuplicates: true });
        console.log(`  ✓ Created ${gridlockRows.length} Gridlock solve records`);
      }
    } else {
      console.log("  ⏭  Gridlock solves already exist, skipping.");
    }
  }

  // ── STEP 7: Warz Challenges ───────────────────────────────────────────────────
  console.log("\n⚔️  Seeding Warz challenges...");
  const existingWarzCount = await prisma.puzzleWarzChallenge.count({
    where: { challengerId: { in: allBots.map(b => b.id) } },
  });

  if (existingWarzCount === 0) {
    // Only bots with some solves can create warz challenges
    const warzBots = allBots.filter(b => b.totalPoints > 500);
    const warzPuzzles = eligibleForProgress.filter(p =>
      !["escape_room","team_puzzle"].includes(p.puzzleType)
    );

    if (warzPuzzles.length > 0 && warzBots.length > 1) {
      const warzRows: any[] = [];

      // ~300 COMPLETED challenges (historical social proof)
      for (let i = 0; i < Math.min(300, warzBots.length - 1); i++) {
        const challenger = warzBots[i];
        const opponent   = warzBots[(i + randInt(1, 10)) % warzBots.length];
        if (challenger.id === opponent.id) continue;
        const puzzle = pickRand(warzPuzzles);
        const challengerTime = randInt(120, 1800);
        const opponentTime   = randInt(120, 1800);
        const winnerId = challengerTime <= opponentTime ? challenger.id : opponent.id;
        const completedAt = new Date(Date.now() - randInt(1, 60) * 86400000);

        warzRows.push({
          puzzleId: puzzle.id,
          challengerId: challenger.id,
          challengerTime,
          challengerWager: randInt(10, 300),
          opponentId: opponent.id,
          opponentTime,
          status: "COMPLETED",
          winnerId,
          potPaid: true,
          expiresAt: new Date(completedAt.getTime() + 86400000),
          createdAt: new Date(completedAt.getTime() - randInt(1, 3) * 3600000),
          completedAt,
        });
      }

      // ~60 OPEN challenges (visible in lobby right now)
      const openCount = Math.min(60, warzBots.length);
      for (let i = 0; i < openCount; i++) {
        const challenger = warzBots[i + 300 < warzBots.length ? i + 300 : i];
        const puzzle = pickRand(warzPuzzles);
        const expiresAt = new Date(Date.now() + randInt(1, 23) * 3600000); // expires in 1-23h
        warzRows.push({
          puzzleId: puzzle.id,
          challengerId: challenger.id,
          challengerTime: randInt(120, 1800),
          challengerWager: randInt(10, 200),
          status: "OPEN",
          expiresAt,
          createdAt: new Date(Date.now() - randInt(1, 20) * 3600000),
        });
      }

      if (warzRows.length > 0) {
        try {
          for (let i = 0; i < warzRows.length; i += 50) {
            await prisma.puzzleWarzChallenge.createMany({
              data: warzRows.slice(i, i + 50),
              skipDuplicates: true,
            });
          }
          console.log(`  ✓ Created ${warzRows.length} Warz challenge records`);
        } catch (err) {
          console.error("  ⚠  Warz creation partial error (some skipped):", (err as Error).message?.slice(0, 100));
        }
      }
    }
  } else {
    console.log("  ⏭  Warz challenges already exist, skipping.");
  }

  // ── STEP 8: Forum Posts ───────────────────────────────────────────────────────
  console.log("\n💬 Seeding forum posts...");
  const existingForumCount = await prisma.forumPost.count({
    where: { authorId: { in: allBots.map(b => b.id) } },
  });

  if (existingForumCount === 0) {
    const forumBots = allBots.filter(b => b.totalPoints > 300).slice(0, 80);
    const postRecords: any[] = [];

    for (let i = 0; i < Math.min(40, forumBots.length); i++) {
      const bot = forumBots[i];
      const title = FORUM_TITLES[i % FORUM_TITLES.length];
      const content = FORUM_CONTENTS[i % FORUM_CONTENTS.length];
      const createdAt = new Date(Date.now() - randInt(1, 180) * 86400000);
      postRecords.push({
        title,
        content,
        authorId: bot.id,
        viewCount: randInt(5, 500),
        replyCount: randInt(0, 25),
        upvotes: randInt(0, 80),
        downvotes: randInt(0, 5),
        createdAt,
        updatedAt: createdAt,
      });
    }

    if (postRecords.length > 0) {
      const createdPosts = await prisma.$transaction(
        postRecords.map(p => prisma.forumPost.create({ data: p }))
      );

      // Add comments to posts
      let commentRows: any[] = [];
      for (const post of createdPosts) {
        const numComments = randInt(1, 12);
        for (let c = 0; c < numComments; c++) {
          const commenter = forumBots[(c + 5) % forumBots.length];
          const createdAt = new Date((post.createdAt as Date).getTime() + randInt(1, 48) * 3600000);
          commentRows.push({
            content: FORUM_COMMENTS[c % FORUM_COMMENTS.length],
            authorId: commenter.id,
            postId: post.id,
            upvotes: randInt(0, 20),
            downvotes: 0,
            createdAt,
            updatedAt: createdAt,
          });
        }
      }
      await prisma.forumComment.createMany({ data: commentRows, skipDuplicates: true });
      console.log(`  ✓ Created ${postRecords.length} forum posts, ${commentRows.length} comments`);
    }
  } else {
    console.log("  ⏭  Forum posts already exist, skipping.");
  }

  // ── STEP 9: Follow relationships ──────────────────────────────────────────────
  console.log("\n👥 Seeding follow relationships...");
  const existingFollowCount = await prisma.follow.count({
    where: { followerId: { in: allBots.map(b => b.id) } },
  });

  if (existingFollowCount === 0) {
    // All bots that have any points participate in the social graph.
    // Following counts scale with tier/activity so more active bots follow & get followed more.
    // Tier approximation from totalPoints:
    //   <100  → lurker  (0 following)
    //   100–899 → casual  (5–15 following)
    //   900–2499 → regular  (12–30 following)
    //   2500–7499 → dedicated (25–60 following)
    //   7500–17999 → hardcore (50–100 following)
    //   18000+  → legend  (80–200 following)
    const followingRange = (pts: number): [number, number] => {
      if (pts < 100)   return [0, 0];
      if (pts < 900)   return [5, 15];
      if (pts < 2500)  return [12, 30];
      if (pts < 7500)  return [25, 60];
      if (pts < 18000) return [50, 100];
      return [80, 200];
    };

    const socialBots = allBots.filter(b => b.totalPoints >= 100);
    const followRows: any[] = [];
    const seen = new Set<string>();

    for (const bot of socialBots) {
      const [minF, maxF] = followingRange(bot.totalPoints);
      if (maxF === 0) continue;
      const numFollowing = randInt(minF, maxF);
      // Pull candidates from the full socialBots pool so even smaller bots get followers
      const others = socialBots
        .filter(b => b.id !== bot.id)
        .sort(() => Math.random() - 0.5)
        .slice(0, numFollowing);

      for (const other of others) {
        const key = `${bot.id}:${other.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        followRows.push({
          followerId: bot.id,
          followingId: other.id,
          createdAt: new Date(Date.now() - randInt(1, 365) * 86400000),
        });
      }
    }

    if (followRows.length > 0) {
      for (let i = 0; i < followRows.length; i += 1000) {
        await prisma.follow.createMany({ data: followRows.slice(i, i + 1000), skipDuplicates: true });
      }
      console.log(`  ✓ Created ${followRows.length} follow relationships`);
    }
  } else {
    console.log("  ⏭  Follow relationships already exist, skipping.");
  }

  // ── STEP 10: Activity feed entries ────────────────────────────────────────────
  console.log("\n📰 Seeding activity feed...");
  const existingActivityCount = await prisma.activity.count({
    where: { userId: { in: allBots.slice(0, 50).map(b => b.id) } },
  });

  if (existingActivityCount === 0) {
    const activityBots = allBots.filter(b => b.totalPoints > 200).slice(0, 200);
    let activityRows: any[] = [];

    for (const bot of activityBots) {
      const solves = Math.floor(bot.totalPoints / 100);
      const numActivities = Math.min(solves, randInt(2, 8));

      for (let a = 0; a < numActivities; a++) {
        const puzzleForAct = pickRand(eligibleForProgress);
        const createdAt = new Date(bot.createdAt.getTime() + randInt(1, 90) * 86400000);
        activityRows.push({
          userId: bot.id,
          type: "puzzle_solved",
          title: "Solved a puzzle",
          description: `Solved a ${puzzleForAct.difficulty.toLowerCase()} puzzle and earned points`,
          icon: "🧩",
          relatedId: puzzleForAct.id,
          relatedType: "puzzle",
          createdAt,
        });
      }

      // Achievement unlocks for high-tier
      if (bot.totalPoints > 2000 && Math.random() < 0.3) {
        activityRows.push({
          userId: bot.id,
          type: "achievement_unlocked",
          title: "Achievement Unlocked",
          description: "Unlocked a new achievement badge",
          icon: "🏆",
          createdAt: new Date(bot.createdAt.getTime() + randInt(10, 60) * 86400000),
        });
      }
    }

    if (activityRows.length > 0) {
      for (let i = 0; i < activityRows.length; i += 1000) {
        await prisma.activity.createMany({ data: activityRows.slice(i, i + 1000), skipDuplicates: true });
      }
      console.log(`  ✓ Created ${activityRows.length} activity entries`);
    }
  } else {
    console.log("  ⏭  Activity entries already exist, skipping.");
  }

  // ── STEP 11: Daily Word Records ────────────────────────────────────────────────
  console.log("\n📅 Seeding daily word records...");
  const existingDailyCount = await prisma.dailyWordRecord.count({
    where: { userId: { in: allBots.slice(0, 20).map(b => b.id) } },
  });

  if (existingDailyCount === 0) {
    const dailyBots = allBots.filter(b => b.totalPoints > 300).slice(0, 300);
    let dailyRows: any[] = [];

    for (const bot of dailyBots) {
      const daysPlayed = randInt(1, 60);
      const startDay = randInt(1, 10);
      for (let d = 0; d < daysPlayed; d++) {
        const dayNumber = startDay + d;
        const won = Math.random() < 0.72; // 72% win rate
        const guesses = won ? randInt(2, 6) : 7;
        dailyRows.push({
          userId: bot.id,
          dayNumber,
          won,
          guesses,
          skipped: false,
          shieldUsed: false,
          createdAt: new Date(Date.now() - (daysPlayed - d) * 86400000),
        });
      }
    }

    if (dailyRows.length > 0) {
      for (let i = 0; i < dailyRows.length; i += 2000) {
        await prisma.dailyWordRecord.createMany({ data: dailyRows.slice(i, i + 2000), skipDuplicates: true });
      }
      console.log(`  ✓ Created ${dailyRows.length} daily word records`);
    }
  } else {
    console.log("  ⏭  Daily word records already exist, skipping.");
  }

  // ── STEP 12: Teams ─────────────────────────────────────────────────────────────
  console.log("\n🛡️  Seeding bot teams...");

  const existingBotTeamCount = await prisma.team.count({
    where: { createdBy: { in: allBots.map(b => b.id) } },
  });

  if (existingBotTeamCount === 0) {
    // Team name pools
    // Team names: mix of formats so they feel organic, not templated
    const TEAM_NAMES_POOL = [
      // Self-deprecating / relatable
      "We Tried", "Skill Issue", "Send Help", "Barely Functional", "Just Vibes",
      "Currently Spiraling", "Low Expectations", "Don't Ask", "Absolutely Not",
      "Still Loading", "Almost There", "Kind Of Trying", "Good Enough",
      "Needs Improvement", "Average At Best", "Getting There", "Probably Fine",
      "Room For Growth", "Not Our Best", "It Happens",
      // Puzzle-specific humor
      "One More Puzzle", "No Hints Needed", "Wrong Again", "Last Attempt",
      "Blind Solve", "Going With Gut", "Overthought It", "The Overthinkers",
      "Mind Palace", "Wrong Answer Gang", "Red Herring Hunters",
      "Actually Read The Instructions", "The Decoders", "Pattern Spotters",
      "The Backspacers", "Wild Guess", "Pure Instinct", "Slow Burn",
      // Group / friend group vibe
      "The Usual Suspects", "The Regulars", "Night Owls", "The Committee",
      "Off The Clock", "Chaos Crew", "The Wanderers", "Plot Twist",
      "Main Characters", "Side Quests", "The Newcomers", "Weekend Warriors",
      "Midnight Crew", "The Skeptics", "Puzzle Club", "The Late Shift",
      "Early Birds", "Making It Up", "The Think Tank", "Brain Trust",
      "Certified Nerds", "The Analysts", "Running On Fumes", "Coffee Required",
      "No Drama", "The Round Table", "The Stragglers",
      // Competitive but grounded
      "Not Last Place", "Solidly Mid", "The Point Chasers", "Streak Defenders",
      "The Grind", "We've Been Practicing", "Genuinely Competitive",
      "Clutch (Sometimes)", "Podium Or Bust", "The Real Finals",
      "Top 10 Or Bust", "Extremely Normal About Points",
      // Casual / fun
      "Touch Grass", "Chronically Online", "Big Brain Energy",
      "Technically Correct", "Professional Guessers", "We Don't Sleep",
      "Needs More Coffee", "The Doomscrollers", "Rabbit Hole",
      "Ctrl Alt Delete", "Mind The Gap", "Dead Drop", "Carry Me",
      "First Blood", "Cold Start", "Null Island", "Silent Keys", "No Hints",
    ];

    const TEAM_THEMES = ["default","default","default","gold","neon","crimson"];

    const TEAM_DESCRIPTIONS = [
      // Casual / how we started
      "started as 3 friends who couldn't stop playing. now there's like 9 of us and none of us talk about anything else anymore",
      "we made this team after losing a warz challenge and refusing to accept it. the grudge match is still ongoing",
      "honestly we just wanted a team name. stayed for the gridlock grind",
      "met in the forum complaining about the same puzzle. decided to just start solving together instead",
      "my friend bet me I couldn't crack the daily streak record. I made a team to prove a point. he joined later",
      "we don't have a strategy. we just send it and hope for the best. so far so good",
      "came for the puzzles, stayed because we accidentally got into the top 20 and now we can't leave",
      "none of us are that good individually but together we're somehow unstoppable. usually",
      "we call ourselves casual but we're literally on here every day so make of that what you will",
      "team chat is mostly memes and the occasional 'oh wait I got it'",
      "formed because we kept running into each other on the leaderboard and figured we should just team up",
      "we grind the daily puzzle together and compare streaks every morning like completely normal people",
      "someone made the team as a joke and then six people joined in 24 hours. here we are",
      "originally just two of us. then we started winning and people started asking to join",
      "we bonded over both guessing the same wrong answer on frequency. it felt like fate",
      "found each other through the leaderboard. turns out we were all working from the same coffee shop",
      "this team started as a bet. the bet was whether we could stay in top 50. we are extremely invested now",
      "we take the puzzles seriously and the team name not seriously at all",
      // Mid-competitive
      "daily puzzle streak is non-negotiable. if you skip, you explain yourself in the group chat",
      "we rotate who does the gridlock each day so no one person carries the streak",
      "our rule: no hints before you've tried for at least 20 minutes. yes we enforce this",
      "lost the weekly leaderboard by 4 points once. it haunts us. we do not talk about it",
      "three of us are ex-competitive gamers who redirected the energy here. results have been mixed",
      "we keep a running doc of every puzzle we've failed. it's a very long doc",
      "warz challenges are our main thing. we rarely turn one down",
      "we share hints in the group chat but only after everyone has genuinely tried first",
      "monthly leaderboard is the only one that matters to us. weekly is just warmup",
      "we have a whole spreadsheet tracking which puzzle types we're weakest at. yes really",
      "we assign puzzles based on who's best at what. it works better than it sounds",
      "we each have a specialty. one of us is suspiciously good at the witness puzzles. no one asks why",
      "if you go three days without solving something you get a strongly worded message. it's a feature",
      // Competitive / edge
      "leaderboard or nothing. if we're not climbing we're regrouping",
      "we time everything. every solve, every hint, every attempt. data doesn't lie",
      "some teams treat this like a hobby. we treat it like a sport",
      "our team founder has completed every puzzle on this site. we have not. they carry us with grace",
      "we are extremely normal about points and definitely don't check the leaderboard at 2am",
      "top of the weekly leaderboard three times running. we do not accept fourth place",
      "we've been on a winning streak long enough that losing now would genuinely hurt",
      "quietly competitive. we don't trash talk. we just win and say nothing",
      // Open / welcoming
      "all skill levels welcome. the only requirement is you actually show up",
      "we celebrate every solve no matter how long it took or how many hints were used",
      "new to the platform? this is a good first team. we'll walk you through it",
      "no pressure, no drama, just puzzles and decent vibes",
      "we don't care how good you are. we care that you're having fun",
      "everyone contributes differently. some of us solve fast, some of us just bring snacks to the call",
      // Low-key funny
      "our team has solved the hardest puzzle on the site and also spent 40 minutes on a beginner one. we contain multitudes",
      "we have a rule against complaining about puzzle difficulty. we break it every single day",
      "the team name was the hardest puzzle we've ever solved",
      "at some point this stopped being casual. we don't know when that happened",
      "one of us does not sleep. we don't know who it is. the streak data is suspicious",
    ];

    // Shuffle descriptions once so sequential assignment never repeats
    const shuffledDescs = [...TEAM_DESCRIPTIONS].sort(() => Math.random() - 0.5);
    let descIndex = 0;

    // ~45% of bots with enough activity join a team (tiers 2–5)
    // Eligible = bots with 900+ points (regular tier and above)
    const eligibleForTeams = allBots
      .filter(b => b.totalPoints >= 900)
      .sort(() => Math.random() - 0.5);

    // How many teams to create: aim for avg 4–8 members per team
    // 45% of eligible bots → pool size / avg team size
    const teamPoolSize = Math.floor(eligibleForTeams.length * 0.45);
    const avgTeamSize = 6;
    const numTeams = Math.max(10, Math.floor(teamPoolSize / avgTeamSize));

    console.log(`  ℹ  Creating ${numTeams} teams from ${teamPoolSize} eligible bots...`);

    // Assign bots to teams — each bot max 1 team
    const usedBotIds = new Set<string>();
    const teamDefs: Array<{ name: string; description: string; theme: string; createdBy: string; members: Array<{ userId: string; role: string; joinedAt: Date }> }> = [];

    // Shuffle eligible bots and carve out slices
    const teamPool = eligibleForTeams.slice(0, teamPoolSize);
    let poolIndex = 0;

    for (let t = 0; t < numTeams && poolIndex < teamPool.length; t++) {
      // Team size: weighted toward 4–8, occasionally up to 15
      const sizeRoll = Math.random();
      const teamSize = sizeRoll < 0.15 ? randInt(2, 3)    // small (15%)
                     : sizeRoll < 0.70 ? randInt(4, 8)    // standard (55%)
                     : sizeRoll < 0.92 ? randInt(9, 12)   // large (22%)
                     : randInt(13, 20);                    // max (8%)

      const members: Array<{ userId: string; role: string; joinedAt: Date }> = [];

      // Pick members sequentially from shuffled pool (no duplicates guaranteed)
      for (let m = 0; m < teamSize && poolIndex < teamPool.length; m++) {
        const bot = teamPool[poolIndex++];
        if (usedBotIds.has(bot.id)) continue;
        usedBotIds.add(bot.id);
        const role = m === 0 ? "admin" : m <= 1 && Math.random() < 0.3 ? "moderator" : "member";
        const joinedAt = new Date(Date.now() - randInt(1, 365) * 86400000);
        members.push({ userId: bot.id, role, joinedAt });
      }

      if (members.length === 0) continue;

      // Pull a name from the pool; if exhausted, fall back to a numbered variant
      const name = t < TEAM_NAMES_POOL.length
        ? TEAM_NAMES_POOL[t]
        : `${TEAM_NAMES_POOL[t % TEAM_NAMES_POOL.length]} ${Math.floor(t / TEAM_NAMES_POOL.length) + 1}`;
      const description = shuffledDescs[descIndex++ % shuffledDescs.length];
      const theme = pickRand(TEAM_THEMES);
      const createdBy = members[0].userId;

      teamDefs.push({ name, description, theme, createdBy, members });
    }

    // Insert teams and members in batches
    let teamCount = 0;
    let memberCount = 0;
    for (const td of teamDefs) {
      try {
        const team = await prisma.team.create({
          data: {
            name: td.name,
            description: td.description,
            createdBy: td.createdBy,
            isPublic: Math.random() < 0.80, // 80% public
            activeTheme: td.theme,
            createdAt: td.members[0].joinedAt,
            updatedAt: td.members[0].joinedAt,
          },
        });
        const memberRows = td.members.map(m => ({
          teamId: team.id,
          userId: m.userId,
          role: m.role,
          joinedAt: m.joinedAt,
        }));
        await prisma.teamMember.createMany({ data: memberRows, skipDuplicates: true });
        teamCount++;
        memberCount += memberRows.length;
      } catch {
        // skip on rare name collision
      }
    }
    console.log(`  ✓ Created ${teamCount} teams with ${memberCount} total members`);
  } else {
    console.log(`  ⏭  Bot teams already exist (${existingBotTeamCount}), skipping.`);
  }

  console.log("\n🎉 Bot seed complete!");
  console.log("   Breakdown:");
  const finalCount = await prisma.user.count({ where: { isBot: true } });
  const finalProgress = await prisma.userPuzzleProgress.count({ where: { userId: { in: allBots.map(b => b.id) } } });
  const finalWarz = await prisma.puzzleWarzChallenge.count({ where: { challengerId: { in: allBots.map(b => b.id) } } });
  const finalGridlock = await prisma.gridlockSolve.count({ where: { userId: { in: allBots.map(b => b.id) } } });
  const finalTeams = await prisma.team.count({ where: { createdBy: { in: allBots.map(b => b.id) } } });
  console.log(`   👤 ${finalCount} bot users`);
  console.log(`   🧩 ${finalProgress} puzzle progress records`);
  console.log(`   ⚔️  ${finalWarz} warz challenges`);
  console.log(`   🔒 ${finalGridlock} gridlock solves`);
  console.log(`   🛡️  ${finalTeams} bot teams`);
}

main()
  .catch(e => {
    console.error("❌ Bot seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
