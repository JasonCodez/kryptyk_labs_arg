import { PrismaClient } from "@prisma/client";
import path from "path";
import { config } from "dotenv";

// Load environment variables
config({ path: path.resolve(process.cwd(), ".env.local") });
config({ path: path.resolve(process.cwd(), ".env") });

const prisma = new PrismaClient();

const achievements = [
  // === MILESTONE BADGES ===
  {
    name: "first_blood",
    title: "First Blood",
    description: "Solve your first puzzle",
    icon: "🩸",
    category: "milestone",
    rarity: "common",
    requirement: "Solve 1 puzzle",
    conditionType: "puzzles_solved",
    conditionValue: 1,
  },
  {
    name: "decade_club",
    title: "Decade Club",
    description: "Solve 10 puzzles",
    icon: "🔟",
    category: "milestone",
    rarity: "common",
    requirement: "Solve 10 puzzles",
    conditionType: "puzzles_solved",
    conditionValue: 10,
  },
  {
    name: "century_club",
    title: "Century Club",
    description: "Solve 100 puzzles",
    icon: "💯",
    category: "milestone",
    rarity: "rare",
    requirement: "Solve 100 puzzles",
    conditionType: "puzzles_solved",
    conditionValue: 100,
  },
  {
    name: "legend_status",
    title: "Legend Status",
    description: "Solve 500 puzzles",
    icon: "👑",
    category: "milestone",
    rarity: "epic",
    requirement: "Solve 500 puzzles",
    conditionType: "puzzles_solved",
    conditionValue: 500,
  },
  {
    name: "cryptic_god",
    title: "Cryptic God",
    description: "Solve 1000 puzzles",
    icon: "🌟",
    category: "milestone",
    rarity: "legendary",
    requirement: "Solve 1000 puzzles",
    conditionType: "puzzles_solved",
    conditionValue: 1000,
  },

  // === SPEED BADGES ===
  {
    name: "speed_runner",
    title: "Speed Runner",
    description: "Solve a puzzle in under 5 minutes",
    icon: "⚡",
    category: "speed",
    rarity: "uncommon",
    requirement: "Complete a puzzle very quickly",
    conditionType: "time_based",
    conditionValue: null,
  },
  {
    name: "lightning_fast",
    title: "Lightning Fast",
    description: "Solve a puzzle in under 1 minute",
    icon: "🔥",
    category: "speed",
    rarity: "rare",
    requirement: "Complete a puzzle extremely quickly",
    conditionType: "time_based",
    conditionValue: null,
  },
  {
    name: "instant_solver",
    title: "Instant Solver",
    description: "Solve 3 puzzles without errors on first try",
    icon: "⏱️",
    category: "speed",
    rarity: "rare",
    requirement: "Perfect accuracy on multiple puzzles",
    conditionType: "submission_accuracy",
    conditionValue: 3,
  },

  // === POINTS BADGES ===
  {
    name: "point_collector",
    title: "Point Collector",
    description: "Earn 1,000 points",
    icon: "💰",
    category: "mastery",
    rarity: "common",
    requirement: "Earn 1,000 points total",
    conditionType: "points_earned",
    conditionValue: 1000,
  },
  {
    name: "point_magnate",
    title: "Point Magnate",
    description: "Earn 10,000 points",
    icon: "💎",
    category: "mastery",
    rarity: "uncommon",
    requirement: "Earn 10,000 points total",
    conditionType: "points_earned",
    conditionValue: 10000,
  },
  {
    name: "millionaire_status",
    title: "Millionaire",
    description: "Earn 1,000,000 points",
    icon: "🤑",
    category: "mastery",
    rarity: "legendary",
    requirement: "Earn 1,000,000 points total",
    conditionType: "points_earned",
    conditionValue: 1000000,
  },

  // === CONSISTENCY BADGES ===
  {
    name: "streak_beginner",
    title: "On Fire",
    description: "Maintain a 7-day solving streak",
    icon: "🔥",
    category: "exploration",
    rarity: "uncommon",
    requirement: "Solve puzzles for 7 consecutive days",
    conditionType: "streak",
    conditionValue: 7,
  },
  {
    name: "streak_master",
    title: "Streak Master",
    description: "Maintain a 30-day solving streak",
    icon: "🏔️",
    category: "exploration",
    rarity: "epic",
    requirement: "Solve puzzles for 30 consecutive days",
    conditionType: "streak",
    conditionValue: 30,
  },
  {
    name: "unstoppable",
    title: "Unstoppable",
    description: "Maintain a 100-day solving streak",
    icon: "💪",
    category: "exploration",
    rarity: "legendary",
    requirement: "Solve puzzles for 100 consecutive days",
    conditionType: "streak",
    conditionValue: 100,
  },

  // === COLLABORATION BADGES ===
  {
    name: "team_player",
    title: "Team Player",
    description: "Join your first team",
    icon: "👥",
    category: "collaboration",
    rarity: "common",
    requirement: "Join a team",
    conditionType: "team_size",
    conditionValue: 1,
  },
  {
    name: "connector",
    title: "Connector",
    description: "Create a team with 5+ members",
    icon: "🌐",
    category: "collaboration",
    rarity: "rare",
    requirement: "Lead a team of 5 or more players",
    conditionType: "team_size",
    conditionValue: 5,
  },
  {
    name: "alliance_leader",
    title: "Alliance Leader",
    description: "Create a team with 10+ members",
    icon: "👑",
    category: "collaboration",
    rarity: "epic",
    requirement: "Lead a team of 10 or more players",
    conditionType: "team_size",
    conditionValue: 10,
  },
  {
    name: "mentor",
    title: "Mentor",
    description: "Help 3 different team members solve their first puzzle",
    icon: "📚",
    category: "collaboration",
    rarity: "uncommon",
    requirement: "Be part of team success",
    conditionType: "custom",
    conditionValue: 3,
  },

  // === CATEGORY MASTERY ===
  {
    name: "crypto_master",
    title: "Crypto Master",
    description: "Solve 50 cryptography puzzles",
    icon: "🔐",
    category: "mastery",
    rarity: "rare",
    requirement: "Solve 50 cryptography puzzles",
    conditionType: "puzzle_category",
    conditionValue: 50,
  },
  {
    name: "logic_guru",
    title: "Logic Guru",
    description: "Solve 50 logic puzzles",
    icon: "🧠",
    category: "mastery",
    rarity: "rare",
    requirement: "Solve 50 logic puzzles",
    conditionType: "puzzle_category",
    conditionValue: 50,
  },
  {
    name: "wordsmith",
    title: "Wordsmith",
    description: "Solve 50 word puzzles",
    icon: "📝",
    category: "mastery",
    rarity: "rare",
    requirement: "Solve 50 word puzzles",
    conditionType: "puzzle_category",
    conditionValue: 50,
  },

  // === EXPLORATION BADGES ===
  {
    name: "early_bird",
    title: "Early Bird",
    description: "Solve a puzzle before 6 AM",
    icon: "🌅",
    category: "exploration",
    rarity: "uncommon",
    requirement: "Solve a puzzle early in the morning",
    conditionType: "custom",
    conditionValue: null,
  },
  {
    name: "night_owl",
    title: "Night Owl",
    description: "Solve a puzzle after midnight",
    icon: "🌙",
    category: "exploration",
    rarity: "uncommon",
    requirement: "Solve a puzzle late at night",
    conditionType: "custom",
    conditionValue: null,
  },
  {
    name: "explorer",
    title: "Explorer",
    description: "Solve puzzles from 10 different categories",
    icon: "🧭",
    category: "exploration",
    rarity: "uncommon",
    requirement: "Solve puzzles across diverse categories",
    conditionType: "puzzle_category",
    conditionValue: 10,
  },

  // === ACCURACY & PRECISION ===
  {
    name: "perfect_shot",
    title: "Perfect Shot",
    description: "Solve a puzzle on first try",
    icon: "🎯",
    category: "speed",
    rarity: "uncommon",
    requirement: "Get a puzzle right on the first submission",
    conditionType: "submission_accuracy",
    conditionValue: 1,
  },
  {
    name: "bullseye",
    title: "Bullseye",
    description: "Solve 10 puzzles on first try",
    icon: "🏹",
    category: "speed",
    rarity: "rare",
    requirement: "Get 10 puzzles right on first submission",
    conditionType: "submission_accuracy",
    conditionValue: 10,
  },
  {
    name: "sharpshooter",
    title: "Sharpshooter",
    description: "Solve 50 puzzles on first try",
    icon: "🎪",
    category: "speed",
    rarity: "epic",
    requirement: "Get 50 puzzles right on first submission",
    conditionType: "submission_accuracy",
    conditionValue: 50,
  },

  // === SPECIAL & HIDDEN ===
  {
    name: "hint_minimalist",
    title: "Hint Minimalist",
    description: "Solve 20 puzzles without using hints",
    icon: "🚫💡",
    category: "special",
    rarity: "rare",
    requirement: "Solve puzzles without assistance",
    conditionType: "custom",
    conditionValue: 20,
  },
  {
    name: "hint_hoarder",
    title: "Hint Hoarder",
    description: "Collect all available hints for 10 puzzles",
    icon: "💡💡",
    category: "special",
    rarity: "uncommon",
    requirement: "Use all hints available on 10 puzzles",
    conditionType: "custom",
    conditionValue: 10,
  },
  {
    name: "comeback_king",
    title: "Comeback King",
    description: "Solve a puzzle after 50+ attempts",
    icon: "💪",
    category: "special",
    rarity: "epic",
    requirement: "Never give up on the hardest puzzles",
    conditionType: "custom",
    conditionValue: 50,
  },
  {
    name: "social_butterfly",
    title: "Social Butterfly",
    description: "Invite 5 friends to join Kryptyk Labs",
    icon: "🦋",
    category: "collaboration",
    rarity: "rare",
    requirement: "Grow the community with invites",
    conditionType: "custom",
    conditionValue: 5,
  },

  // === GRIDLOCK BADGES ===
  {
    name: "gridlock_arc_complete",
    title: "Arc Complete",
    description: "Solved all 7 days of a Gridlock arc",
    icon: "🗂️",
    category: "special",
    rarity: "exclusive",
    requirement: "Complete a full 7-day Gridlock arc",
    conditionType: "custom",
    conditionValue: null,
  },
];

async function seedAchievements() {
  console.log("🌱 Seeding achievements...");

  let seededCount = 0;
  for (const achievement of achievements) {
    console.log(`- Seeding achievement: ${achievement.name}`);
    try {
      await prisma.achievement.upsert({
        where: { name: achievement.name },
        update: {
          title: achievement.title,
          description: achievement.description,
          icon: achievement.icon,
          category: achievement.category,
          rarity: achievement.rarity,
          requirement: achievement.requirement,
          conditionType: achievement.conditionType,
          conditionValue: achievement.conditionValue === null ? undefined : achievement.conditionValue,
        },
        create: {
          name: achievement.name,
          title: achievement.title,
          description: achievement.description,
          icon: achievement.icon,
          category: achievement.category,
          rarity: achievement.rarity,
          requirement: achievement.requirement,
          conditionType: achievement.conditionType,
          conditionValue: achievement.conditionValue === null ? undefined : achievement.conditionValue,
        },
      });
      seededCount += 1;
    } catch (e) {
      console.error(`❌ Error seeding achievement ${achievement.name}:`, e);
    }
  }

  console.log(`✅ Seeded ${seededCount}/${achievements.length} achievements!`);
}

const STORE_ITEMS = [
  // ── Streak / Puzzle tokens ─────────────────────────────────────────────
  { key: "streak_shield", name: "Streak Shield", description: "Protects your daily puzzle streak for one day if you miss. Consumed automatically when needed.", category: "streak", subcategory: "token", price: 100, isConsumable: true, iconEmoji: "🛡️", metadata: {} },
  { key: "skip_token", name: "Skip Token", description: "Skip a daily puzzle without breaking your streak. One-time use.", category: "streak", subcategory: "token", price: 75, isConsumable: true, iconEmoji: "⏭️", metadata: {} },
  { key: "hint_token", name: "Hint Token", description: "Unlock one hint on any puzzle that normally has no hints (daily, competitive). One-time use.", category: "puzzle", subcategory: "token", price: 50, isConsumable: true, iconEmoji: "💡", metadata: { count: 1 } },
  { key: "hint_pack_3", name: "Hint Pack ×3", description: "3 hint tokens in one purchase. Save 20% vs buying individually.", category: "puzzle", subcategory: "token", price: 120, isConsumable: true, iconEmoji: "💡", metadata: { count: 3 } },
  { key: "hint_pack_5", name: "Hint Pack ×5", description: "5 hint tokens in one purchase. Save 30% vs buying individually.", category: "puzzle", subcategory: "token", price: 175, isConsumable: true, iconEmoji: "💡", metadata: { count: 5 } },
  { key: "hint_pack_10", name: "Hint Pack ×10", description: "10 hint tokens in one purchase. Save 40% vs buying individually.", category: "puzzle", subcategory: "token", price: 300, isConsumable: true, iconEmoji: "💡", metadata: { count: 10 } },
  // ── Warz enhancements ──────────────────────────────────────────────────
  { key: "warz_slot", name: "Extra Warz Slot", description: "Permanently adds one more open Warz challenge slot (default: 3). Stack up to 10 total.", category: "warz", subcategory: "slot", price: 300, isConsumable: false, iconEmoji: "⚔️", metadata: { maxTotal: 10 } },
  { key: "warz_extend_expiry", name: "Challenge Extension", description: "Extend one open Warz challenge expiry from 24h to 72h. One-time use per challenge.", category: "warz", subcategory: "token", price: 150, isConsumable: true, iconEmoji: "⏳", metadata: { extraHours: 48 } },
  { key: "warz_spotlight", name: "Spotlight Boost", description: "Pin your open Warz challenge to the top of the lobby for 1 hour.", category: "warz", subcategory: "token", price: 200, isConsumable: true, iconEmoji: "🔦", metadata: { durationMinutes: 60 } },
  { key: "warz_challenge", name: "Challenge Token", description: "Challenge a specific opponent to a head-to-head puzzle battle. They still have to accept.", category: "warz", subcategory: "token", price: 100, isConsumable: true, iconEmoji: "⚔️", metadata: {} },
  // ── Profile cosmetics ──────────────────────────────────────────────────
  { key: "theme_gold", name: "Gold Theme", description: "A rich gold & black profile theme.", category: "cosmetic", subcategory: "theme", price: 500, isConsumable: false, iconEmoji: "🌟", metadata: { value: "gold", primaryColor: "#FDE74C", accentColor: "#FFB86B" } },
  { key: "theme_neon", name: "Neon Theme", description: "Electric cyan & purple neon profile theme.", category: "cosmetic", subcategory: "theme", price: 500, isConsumable: false, iconEmoji: "⚡", metadata: { value: "neon", primaryColor: "#00FFFF", accentColor: "#CC00FF" } },
  { key: "theme_crimson", name: "Crimson Theme", description: "Deep red & dark profile theme for the bold.", category: "cosmetic", subcategory: "theme", price: 500, isConsumable: false, iconEmoji: "🔥", metadata: { value: "crimson", primaryColor: "#DC2626", accentColor: "#F97316" } },
  // ── Team page themes ──────────────────────────────────────────────────
  { key: "team_theme_gold", name: "Team Gold Theme", description: "A rich gold & black theme for your team page.", category: "social", subcategory: "team_theme", price: 750, isConsumable: false, iconEmoji: "🌟", metadata: { value: "gold", primaryColor: "#FDE74C", accentColor: "#FFB86B" } },
  { key: "team_theme_neon", name: "Team Neon Theme", description: "Electric cyan & purple neon theme for your team page.", category: "social", subcategory: "team_theme", price: 750, isConsumable: false, iconEmoji: "⚡", metadata: { value: "neon", primaryColor: "#00FFFF", accentColor: "#CC00FF" } },
  { key: "team_theme_crimson", name: "Team Crimson Theme", description: "Deep red & dark theme for your team page.", category: "social", subcategory: "team_theme", price: 750, isConsumable: false, iconEmoji: "🔥", metadata: { value: "crimson", primaryColor: "#DC2626", accentColor: "#F97316" } },
  // ── Avatar frames ──────────────────────────────────────────────────────
  { key: "frame_gold", name: "Gold Frame", description: "Animated golden border around your avatar.", category: "cosmetic", subcategory: "frame", price: 400, isConsumable: false, iconEmoji: "🏅", metadata: { value: "gold" } },
  { key: "frame_neon", name: "Neon Frame", description: "Pulsing neon glow frame around your avatar.", category: "cosmetic", subcategory: "frame", price: 400, isConsumable: false, iconEmoji: "💫", metadata: { value: "neon" } },
  { key: "frame_flame", name: "Flame Frame", description: "Animated fire border blazing around your avatar.", category: "cosmetic", subcategory: "frame", price: 600, isConsumable: false, iconEmoji: "🔥", metadata: { value: "flame" } },
  // ── Username flair ────────────────────────────────────────────────────
  { key: "flair_crown", name: "Crown Flair", description: "Display a 👑 crown next to your name on leaderboards and profiles.", category: "cosmetic", subcategory: "flair", price: 350, isConsumable: false, iconEmoji: "👑", metadata: { value: "crown", emoji: "👑" } },
  { key: "flair_fire", name: "Fire Flair", description: "Display a 🔥 next to your name.", category: "cosmetic", subcategory: "flair", price: 200, isConsumable: false, iconEmoji: "🔥", metadata: { value: "fire", emoji: "🔥" } },
  { key: "flair_lightning", name: "Lightning Flair", description: "Display a ⚡ next to your name — for the speedrunners.", category: "cosmetic", subcategory: "flair", price: 200, isConsumable: false, iconEmoji: "⚡", metadata: { value: "lightning", emoji: "⚡" } },
  { key: "flair_warz_legend", name: "Warz Legend Flair", description: "Display the ⚔️ Warz Legend badge next to your name.", category: "cosmetic", subcategory: "flair", price: 750, isConsumable: false, iconEmoji: "⚔️", metadata: { value: "warz_legend", emoji: "⚔️🏆" } },
  // ── Puzzle skins ──────────────────────────────────────────────────────
  { key: "skin_retro", name: "Retro Skin", description: "CRT arcade terminal aesthetic — amber glow, pixel font, sharp corners. Old school meets intense.", category: "cosmetic", subcategory: "skin", price: 450, isConsumable: false, iconEmoji: "🕹️", metadata: { value: "retro" } },
  { key: "skin_minimal", name: "Minimal Skin", description: "Polished obsidian. Pure black, white accents, zero distractions — for players who let their brain do the talking.", category: "cosmetic", subcategory: "skin", price: 350, isConsumable: false, iconEmoji: "⬜", metadata: { value: "minimal" } },
  { key: "skin_neon", name: "Neon Skin", description: "Electric cyberpunk — blazing cyan board glow, hot-pink accents, Courier font. Stay in the grid.", category: "cosmetic", subcategory: "skin", price: 450, isConsumable: false, iconEmoji: "⚡", metadata: { value: "neon" } },
  { key: "skin_lava", name: "Lava Skin", description: "Volcanic molten rock — deep black board, glowing orange-red tiles, heat shimmer shadows. Feel the pressure.", category: "cosmetic", subcategory: "skin", price: 550, isConsumable: false, iconEmoji: "🌋", metadata: { value: "lava" } },
  { key: "skin_galaxy", name: "Galaxy Skin", description: "Deep-space nebula — midnight void background, violet-purple glow, lavender tile text. Solve puzzles among the stars.", category: "cosmetic", subcategory: "skin", price: 600, isConsumable: false, iconEmoji: "🌌", metadata: { value: "galaxy" } },
  { key: "skin_ice", name: "Ice Skin", description: "Crystal frost — midnight navy board, cyan prismatic tile glow, crisp white text. Cool under pressure.", category: "cosmetic", subcategory: "skin", price: 500, isConsumable: false, iconEmoji: "❄️", metadata: { value: "ice" } },
  // ── Team banners ──────────────────────────────────────────────────────
  { key: "team_banner_gold", name: "Gold Team Banner", description: "Unlock a gold banner color for your team on the leaderboard.", category: "social", subcategory: "banner", price: 600, isConsumable: false, iconEmoji: "🏆", metadata: { value: "gold", color: "#FDE74C" } },
  { key: "team_banner_crimson", name: "Crimson Team Banner", description: "Unlock a deep crimson banner for your team.", category: "social", subcategory: "banner", price: 400, isConsumable: false, iconEmoji: "🚩", metadata: { value: "crimson", color: "#DC2626" } },
  { key: "team_banner_neon", name: "Neon Team Banner", description: "Unlock a glowing neon cyan banner for your team.", category: "social", subcategory: "banner", price: 400, isConsumable: false, iconEmoji: "💠", metadata: { value: "neon", color: "#00FFFF" } },
  // ── XP Boost ─────────────────────────────────────────────────────────
  { key: "xp_boost_24h", name: "2× XP Boost", description: "Double all XP earned for the next 24 hours. Stacks — buying again adds another 24 hours.", category: "puzzle", subcategory: "boost", price: 250, isConsumable: true, iconEmoji: "⚡", metadata: { durationHours: 24 } },
  // ── Streak Recovery ───────────────────────────────────────────────────
  { key: "streak_recovery", name: "Streak Recovery", description: "Restore a broken streak — usable up to 3 days after it broke. Brings back your streak as if you never missed.", category: "streak", subcategory: "token", price: 400, isConsumable: true, iconEmoji: "💔", metadata: { graceDays: 3 } },
  // ── Triple-or-Nothing ─────────────────────────────────────────────────
  { key: "triple_or_nothing", name: "Triple-or-Nothing", description: "Activate before a puzzle. Solve on your very first attempt → earn 3× points and XP. Use a hint or fail → token is lost with no bonus.", category: "puzzle", subcategory: "token", price: 150, isConsumable: true, iconEmoji: "🎲", metadata: { multiplier: 3 } },
  // ── Custom Name Colors ────────────────────────────────────────────────
  { key: "name_color_scarlet", name: "Scarlet Name", description: "Display your username in bold scarlet red.", category: "cosmetic", subcategory: "name_color", price: 300, isConsumable: false, iconEmoji: "🔴", metadata: { value: "#ef4444" } },
  { key: "name_color_violet", name: "Violet Name", description: "Display your username in deep violet.", category: "cosmetic", subcategory: "name_color", price: 300, isConsumable: false, iconEmoji: "🟣", metadata: { value: "#8b5cf6" } },
  { key: "name_color_emerald", name: "Emerald Name", description: "Display your username in emerald green.", category: "cosmetic", subcategory: "name_color", price: 300, isConsumable: false, iconEmoji: "🟢", metadata: { value: "#10b981" } },
  { key: "name_color_gold", name: "Gold Name", description: "Display your username in shining gold.", category: "cosmetic", subcategory: "name_color", price: 500, isConsumable: false, iconEmoji: "🌟", metadata: { value: "#FDE74C" } },
  { key: "name_color_cyan", name: "Cyan Name", description: "Display your username in electric cyan.", category: "cosmetic", subcategory: "name_color", price: 300, isConsumable: false, iconEmoji: "🔵", metadata: { value: "#22d3ee" } },
  { key: "name_color_rainbow", name: "Rainbow Name", description: "Animated rainbow gradient across your username — the rarest flex.", category: "cosmetic", subcategory: "name_color", price: 1200, isConsumable: false, iconEmoji: "🌈", metadata: { value: "rainbow" } },
  // ── Completion Animations ─────────────────────────────────────────────
  { key: "anim_confetti", name: "Confetti Burst", description: "Colourful confetti explosion when you solve a puzzle.", category: "cosmetic", subcategory: "anim", price: 400, isConsumable: false, iconEmoji: "🎊", metadata: { value: "confetti" } },
  { key: "anim_lightning", name: "Lightning Strike", description: "An electric lightning bolt crackles across your screen on puzzle completion.", category: "cosmetic", subcategory: "anim", price: 400, isConsumable: false, iconEmoji: "⚡", metadata: { value: "lightning" } },
  { key: "anim_fireworks", name: "Fireworks Show", description: "A full fireworks display launches when you crack a puzzle.", category: "cosmetic", subcategory: "anim", price: 600, isConsumable: false, iconEmoji: "🎆", metadata: { value: "fireworks" } },
  // ── Season 1 — Ignition exclusives (hidden from store, granted via season pass) ──
  { key: "frame_ignition_bronze", name: "Ignition Common Avatar Frame", description: "Season 1 exclusive. The first avatar frame earned on the Ignition Pass.", category: "cosmetic", subcategory: "frame", price: 0, isConsumable: false, isExclusive: true, iconEmoji: "🟫", metadata: { value: "ignition_bronze", season: 1 } },
  { key: "frame_ignition_silver", name: "Ignition Rare Avatar Frame", description: "Season 1 exclusive. A shimmering avatar frame earned deeper into the Ignition Pass.", category: "cosmetic", subcategory: "frame", price: 0, isConsumable: false, isExclusive: true, iconEmoji: "⬜", metadata: { value: "ignition_silver", season: 1 } },
  { key: "frame_ignition_gold", name: "Ignition Epic Avatar Frame", description: "Season 1 exclusive. A blazing avatar frame for dedicated Ignition Pass climbers.", category: "cosmetic", subcategory: "frame", price: 0, isConsumable: false, isExclusive: true, iconEmoji: "🟡", metadata: { value: "ignition_gold", season: 1 } },
  { key: "frame_ignition_legendary", name: "Ignition Legendary Avatar Frame", description: "Season 1 exclusive. The rarest avatar frame — forged in flame for those who conquered the Ignition Pass.", category: "cosmetic", subcategory: "frame", price: 0, isConsumable: false, isExclusive: true, iconEmoji: "🔶", metadata: { value: "ignition_legendary", season: 1 } },
  { key: "theme_ignition_ember", name: "Ember Theme", description: "Season 1 exclusive. A smouldering ember profile theme — deep charcoal with glowing orange accents.", category: "cosmetic", subcategory: "theme", price: 0, isConsumable: false, isExclusive: true, iconEmoji: "🔥", metadata: { value: "ignition_ember", primaryColor: "#f97316", accentColor: "#dc2626", season: 1 } },
  { key: "theme_ignition_inferno", name: "Inferno Theme", description: "Season 1 exclusive. The ultimate Ignition theme — volcanic black with molten lava veins.", category: "cosmetic", subcategory: "theme", price: 0, isConsumable: false, isExclusive: true, iconEmoji: "🌋", metadata: { value: "ignition_inferno", primaryColor: "#ef4444", accentColor: "#fbbf24", season: 1 } },
  // ── Slot machine — level-up spin exclusives (hidden from store, granted via a spin only) ──
  { key: "frame_jackpot_platinum", name: "Jackpot Platinum Frame", description: "Slot machine exclusive. A gleaming platinum avatar frame — you hit an epic spin.", category: "cosmetic", subcategory: "frame", price: 0, isConsumable: false, isExclusive: true, iconEmoji: "🎰", metadata: { value: "jackpot_platinum" } },
  { key: "flair_jackpot", name: "Jackpot Flair", description: "Slot machine exclusive. Display a 🎰 next to your name — proof you beat the odds.", category: "cosmetic", subcategory: "flair", price: 0, isConsumable: false, isExclusive: true, iconEmoji: "🎰", metadata: { value: "jackpot", emoji: "🎰" } },
  { key: "name_color_jackpot_gold", name: "Jackpot Gold Name", description: "Slot machine exclusive. Display your username in blazing jackpot gold.", category: "cosmetic", subcategory: "name_color", price: 0, isConsumable: false, isExclusive: true, iconEmoji: "🌟", metadata: { value: "#FFD700" } },
  { key: "theme_jackpot_neon", name: "Jackpot Neon Theme", description: "Slot machine exclusive — legendary spin only. A blazing casino-neon profile theme, magenta and gold.", category: "cosmetic", subcategory: "theme", price: 0, isConsumable: false, isExclusive: true, iconEmoji: "🎆", metadata: { value: "jackpot_neon", primaryColor: "#d946ef", accentColor: "#FDE74C" } },
  { key: "frame_jackpot_diamond", name: "Jackpot Diamond Frame", description: "Slot machine exclusive — legendary spin only. The rarest frame in the game.", category: "cosmetic", subcategory: "frame", price: 0, isConsumable: false, isExclusive: true, iconEmoji: "💎", metadata: { value: "jackpot_diamond" } },
];

async function seedStoreItems() {
  console.log("🌱 Seeding store items...");
  let created = 0;
  let skipped = 0;
  for (const item of STORE_ITEMS) {
    const existing = await prisma.storeItem.findUnique({ where: { key: item.key } });
    if (existing) { skipped++; continue; }
    await prisma.storeItem.create({ data: item });
    created++;
    console.log(`  ✓ ${item.iconEmoji} ${item.name}`);
  }
  console.log(`✅ Store items: ${created} created, ${skipped} already existed.`);
}

// Refreshes display copy (name/description only — never key/metadata/price/isExclusive)
// on StoreItem rows that may already exist in a database seeded before a rename.
// seedStoreItems() only creates missing rows, so renames need this separate,
// unconditional, idempotent backfill to reach databases seeded before the rename.
const STORE_ITEM_COPY_BACKFILL: { key: string; name: string; description: string }[] = [
  { key: "frame_ignition_bronze", name: "Ignition Common Avatar Frame", description: "Season 1 exclusive. The first avatar frame earned on the Ignition Pass." },
  { key: "frame_ignition_silver", name: "Ignition Rare Avatar Frame", description: "Season 1 exclusive. A shimmering avatar frame earned deeper into the Ignition Pass." },
  { key: "frame_ignition_gold", name: "Ignition Epic Avatar Frame", description: "Season 1 exclusive. A blazing avatar frame for dedicated Ignition Pass climbers." },
  { key: "frame_ignition_legendary", name: "Ignition Legendary Avatar Frame", description: "Season 1 exclusive. The rarest avatar frame — forged in flame for those who conquered the Ignition Pass." },
];

async function backfillStoreItemCopy() {
  console.log("🌱 Backfilling renamed store item copy...");
  let updated = 0;
  for (const { key, name, description } of STORE_ITEM_COPY_BACKFILL) {
    const existing = await prisma.storeItem.findUnique({ where: { key } });
    if (!existing) continue;
    if (existing.name === name && existing.description === description) continue;
    await prisma.storeItem.update({ where: { key }, data: { name, description } });
    updated++;
    console.log(`  ✓ ${key} → ${name}`);
  }
  console.log(`✅ Store item copy: ${updated} row(s) updated.`);
}

// Run seeding in a single flow so we only disconnect once
async function main() {
  try {
    await seedAchievements();
    await seedStoreItems();
    await backfillStoreItemCopy();
    await seedSeason1();
    console.log('🎉 All seeds completed successfully.');
  } catch (e) {
    console.error('❌ Seed run failed:', e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();

async function seedSeason1() {
  console.log("🌱 Seeding Season 1 — Ignition...");

  const existing = await prisma.season.findFirst({ where: { name: "Season 1 — Ignition" } });
  if (existing) {
    console.log("↪ Season 1 already seeded.");
    return;
  }

  // Season dates: April 7 2026 → June 6 2026 (2 months)
  const season = await prisma.season.create({
    data: {
      name: "Season 1 — Ignition",
      description: "The first PuzzleWarz season. Prove your worth and forge your legacy.",
      startDate: new Date(Date.UTC(2026, 3, 7)),   // 2026-04-07
      endDate:   new Date(Date.UTC(2026, 5, 6)),   // 2026-06-06
      isActive: true,
      premiumPrice: 500,
    },
  });

  // 30 tiers — XP values are cumulative totals
  // Milestones at 5, 10, 15, 20, 25, 30
  // Free track: tokens + points; Premium track: cosmetics at milestones + better tokens
  const tiers: {
    tierNumber: number;
    xpRequired: number;
    freeRewardType: string | null;
    freeRewardKey: string | null;
    freeRewardQty: number;
    premRewardType: string | null;
    premRewardKey: string | null;
    premRewardQty: number;
  }[] = [
    { tierNumber:  1, xpRequired:   300, freeRewardType: "hint_tokens",    freeRewardKey: null,                      freeRewardQty: 2, premRewardType: "hint_tokens",    premRewardKey: null,                      premRewardQty: 3 },
    { tierNumber:  2, xpRequired:   650, freeRewardType: "points",         freeRewardKey: null,                      freeRewardQty: 100, premRewardType: "points",         premRewardKey: null,                      premRewardQty: 200 },
    { tierNumber:  3, xpRequired:  1050, freeRewardType: "skip_tokens",    freeRewardKey: null,                      freeRewardQty: 1, premRewardType: "skip_tokens",    premRewardKey: null,                      premRewardQty: 2 },
    { tierNumber:  4, xpRequired:  1500, freeRewardType: "points",         freeRewardKey: null,                      freeRewardQty: 100, premRewardType: "streak_shields", premRewardKey: null,                      premRewardQty: 1 },
    { tierNumber:  5, xpRequired:  2000, freeRewardType: "streak_shields", freeRewardKey: null,                      freeRewardQty: 2, premRewardType: "cosmetic",       premRewardKey: "frame_ignition_bronze",   premRewardQty: 1 },
    { tierNumber:  6, xpRequired:  2650, freeRewardType: "hint_tokens",    freeRewardKey: null,                      freeRewardQty: 2, premRewardType: "points",         premRewardKey: null,                      premRewardQty: 200 },
    { tierNumber:  7, xpRequired:  3400, freeRewardType: "points",         freeRewardKey: null,                      freeRewardQty: 150, premRewardType: "hint_tokens",    premRewardKey: null,                      premRewardQty: 3 },
    { tierNumber:  8, xpRequired:  4250, freeRewardType: "skip_tokens",    freeRewardKey: null,                      freeRewardQty: 1, premRewardType: "points",         premRewardKey: null,                      premRewardQty: 250 },
    { tierNumber:  9, xpRequired:  5200, freeRewardType: "points",         freeRewardKey: null,                      freeRewardQty: 150, premRewardType: "skip_tokens",    premRewardKey: null,                      premRewardQty: 2 },
    { tierNumber: 10, xpRequired:  6250, freeRewardType: "hint_tokens",    freeRewardKey: null,                      freeRewardQty: 3, premRewardType: "cosmetic",       premRewardKey: "theme_ignition_ember",    premRewardQty: 1 },
    { tierNumber: 11, xpRequired:  7500, freeRewardType: "points",         freeRewardKey: null,                      freeRewardQty: 200, premRewardType: "points",         premRewardKey: null,                      premRewardQty: 400 },
    { tierNumber: 12, xpRequired:  8850, freeRewardType: "streak_shields", freeRewardKey: null,                      freeRewardQty: 2, premRewardType: "hint_tokens",    premRewardKey: null,                      premRewardQty: 4 },
    { tierNumber: 13, xpRequired: 10300, freeRewardType: "points",         freeRewardKey: null,                      freeRewardQty: 200, premRewardType: "skip_tokens",    premRewardKey: null,                      premRewardQty: 3 },
    { tierNumber: 14, xpRequired: 11850, freeRewardType: "hint_tokens",    freeRewardKey: null,                      freeRewardQty: 3, premRewardType: "points",         premRewardKey: null,                      premRewardQty: 500 },
    { tierNumber: 15, xpRequired: 13500, freeRewardType: "skip_tokens",    freeRewardKey: null,                      freeRewardQty: 2, premRewardType: "cosmetic",       premRewardKey: "frame_ignition_silver",   premRewardQty: 1 },
    { tierNumber: 16, xpRequired: 15350, freeRewardType: "points",         freeRewardKey: null,                      freeRewardQty: 250, premRewardType: "points",         premRewardKey: null,                      premRewardQty: 600 },
    { tierNumber: 17, xpRequired: 17300, freeRewardType: "hint_tokens",    freeRewardKey: null,                      freeRewardQty: 4, premRewardType: "streak_shields", premRewardKey: null,                      premRewardQty: 3 },
    { tierNumber: 18, xpRequired: 19350, freeRewardType: "points",         freeRewardKey: null,                      freeRewardQty: 250, premRewardType: "points",         premRewardKey: null,                      premRewardQty: 700 },
    { tierNumber: 19, xpRequired: 21500, freeRewardType: "streak_shields", freeRewardKey: null,                      freeRewardQty: 3, premRewardType: "skip_tokens",    premRewardKey: null,                      premRewardQty: 4 },
    { tierNumber: 20, xpRequired: 23750, freeRewardType: "points",         freeRewardKey: null,                      freeRewardQty: 300, premRewardType: "cosmetic",       premRewardKey: "frame_ignition_gold",     premRewardQty: 1 },
    { tierNumber: 21, xpRequired: 26250, freeRewardType: "hint_tokens",    freeRewardKey: null,                      freeRewardQty: 5, premRewardType: "points",         premRewardKey: null,                      premRewardQty: 800 },
    { tierNumber: 22, xpRequired: 28950, freeRewardType: "points",         freeRewardKey: null,                      freeRewardQty: 300, premRewardType: "hint_tokens",    premRewardKey: null,                      premRewardQty: 5 },
    { tierNumber: 23, xpRequired: 31850, freeRewardType: "skip_tokens",    freeRewardKey: null,                      freeRewardQty: 3, premRewardType: "points",         premRewardKey: null,                      premRewardQty: 900 },
    { tierNumber: 24, xpRequired: 34950, freeRewardType: "points",         freeRewardKey: null,                      freeRewardQty: 300, premRewardType: "streak_shields", premRewardKey: null,                      premRewardQty: 4 },
    { tierNumber: 25, xpRequired: 38250, freeRewardType: "hint_tokens",    freeRewardKey: null,                      freeRewardQty: 4, premRewardType: "cosmetic",       premRewardKey: "theme_ignition_inferno",  premRewardQty: 1 },
    { tierNumber: 26, xpRequired: 41950, freeRewardType: "points",         freeRewardKey: null,                      freeRewardQty: 400, premRewardType: "points",         premRewardKey: null,                      premRewardQty: 1000 },
    { tierNumber: 27, xpRequired: 46050, freeRewardType: "skip_tokens",    freeRewardKey: null,                      freeRewardQty: 4, premRewardType: "hint_tokens",    premRewardKey: null,                      premRewardQty: 6 },
    { tierNumber: 28, xpRequired: 50550, freeRewardType: "points",         freeRewardKey: null,                      freeRewardQty: 400, premRewardType: "points",         premRewardKey: null,                      premRewardQty: 1200 },
    { tierNumber: 29, xpRequired: 55450, freeRewardType: "streak_shields", freeRewardKey: null,                      freeRewardQty: 5, premRewardType: "skip_tokens",    premRewardKey: null,                      premRewardQty: 5 },
    { tierNumber: 30, xpRequired: 60750, freeRewardType: "points",         freeRewardKey: null,                      freeRewardQty: 500, premRewardType: "cosmetic",       premRewardKey: "frame_ignition_legendary", premRewardQty: 1 },
  ];

  for (const tier of tiers) {
    await prisma.seasonTier.create({ data: { seasonId: season.id, ...tier } });
    console.log(`  ✓ Tier ${tier.tierNumber} (${tier.xpRequired.toLocaleString()} XP)`);
  }

  console.log(`✅ Season 1 seeded with ${tiers.length} tiers.`);
}
