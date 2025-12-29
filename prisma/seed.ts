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
];

async function seedAchievements() {
  console.log("🌱 Seeding achievements...");

  for (const achievement of achievements) {
    await prisma.achievement.upsert({
      where: { name: achievement.name },
      update: {},
      create: achievement,
    });
  }

  console.log(`✅ Seeded ${achievements.length} achievements!`);
}

seedAchievements()
  .catch((e) => {
    console.error("❌ Error seeding achievements:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
