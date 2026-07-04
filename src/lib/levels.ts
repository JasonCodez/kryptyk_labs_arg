export interface LevelDef {
  level: number;
  xpRequired: number; // total XP needed to REACH this level
  title: string;
}

// 20 levels. xpRequired = total cumulative XP needed to reach that level.
// Rewards used to be fixed per-level here; every level-up now grants an independent
// slot machine spin instead (see src/lib/slotMachine/).
export const LEVELS: LevelDef[] = [
  { level: 1,  xpRequired: 0,      title: "Newcomer"       },
  { level: 2,  xpRequired: 100,    title: "Apprentice"     },
  { level: 3,  xpRequired: 250,    title: "Puzzle Scout"   },
  { level: 4,  xpRequired: 500,    title: "Code Breaker"   },
  { level: 5,  xpRequired: 900,    title: "Cipher Seeker"  },
  { level: 6,  xpRequired: 1400,   title: "Riddle Hunter"  },
  { level: 7,  xpRequired: 2100,   title: "Lock Prober"    },
  { level: 8,  xpRequired: 3000,   title: "Vault Prober"   },
  { level: 9,  xpRequired: 4200,   title: "Mind Bender"    },
  { level: 10, xpRequired: 5800,   title: "Enigma Solver"  },
  { level: 11, xpRequired: 7800,   title: "Shadow Cracker" },
  { level: 12, xpRequired: 10000,  title: "Cipher Adept"   },
  { level: 13, xpRequired: 13000,  title: "Puzzle Warden"  },
  { level: 14, xpRequired: 17000,  title: "Vault Breaker"  },
  { level: 15, xpRequired: 22000,  title: "Code Phantom"   },
  { level: 16, xpRequired: 28000,  title: "Riddle Sage"    },
  { level: 17, xpRequired: 35000,  title: "Enigma Master"  },
  { level: 18, xpRequired: 44000,  title: "Cipher Legend"  },
  { level: 19, xpRequired: 55000,  title: "Puzzle Warlord" },
  { level: 20, xpRequired: 70000,  title: "Grand Cipher"   },
];

/** Calculate level and title from total XP. */
export function calcLevel(totalXp: number): { level: number; title: string; currentXp: number; nextLevelXp: number; progress: number } {
  let current = LEVELS[0];
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (totalXp >= LEVELS[i].xpRequired) {
      current = LEVELS[i];
      break;
    }
  }

  const isMaxLevel = current.level === LEVELS[LEVELS.length - 1].level;
  const next = isMaxLevel ? null : LEVELS[current.level]; // LEVELS is 0-indexed, level 1 = index 0

  const currentXp = totalXp - current.xpRequired;
  const nextLevelXp = next ? next.xpRequired - current.xpRequired : 1;
  const progress = isMaxLevel ? 100 : Math.min(100, Math.floor((currentXp / nextLevelXp) * 100));

  return {
    level: current.level,
    title: current.title,
    currentXp,
    nextLevelXp,
    progress,
  };
}

/** XP defaults by difficulty — used as hints in the admin form. */
export const XP_DEFAULTS: Record<string, number> = {
  easy:    25,
  medium:  50,
  hard:    100,
  extreme: 175,
};
