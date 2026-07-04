// Day 1 = 2026-03-31 UTC — shared epoch for all daily puzzle types.
export const DAILY_EPOCH_UTC = Date.UTC(2026, 2, 31);

export function getDayNumberForDate(date: Date): number {
  const dateUtc = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.floor((dateUtc - DAILY_EPOCH_UTC) / 86_400_000) + 1;
}

export function getTodayDayNumber(): number {
  return getDayNumberForDate(new Date());
}

/**
 * Counts the consecutive-day streak ending at (or the day before) today.
 * `pastDayNumbers` may be any set of a user's daily-record day numbers — including or
 * excluding today's row, in any state (won/lost/skipped) — sorted descending; entries
 * on or after today are ignored automatically. `completedToday` reflects whether today
 * itself counts toward the streak, independent of whether its row has been persisted yet.
 */
export function computeStreak(pastDayNumbers: number[], todayDayNumber: number, completedToday: boolean): number {
  let streak = completedToday ? 1 : 0;
  let expected = todayDayNumber - 1;
  for (const day of pastDayNumbers) {
    if (day === expected) {
      streak++;
      expected--;
    } else if (day < expected) {
      break;
    }
  }
  return streak;
}

/** Streak-based rewards: day 1 = 50pts/25xp, +25 each day, max 7 then reset. */
export function streakReward(streakDay: number): { points: number; xp: number; streakDay: number } {
  const day = Math.max(1, Math.min(streakDay, 7));
  return {
    points: 50 + (day - 1) * 25,
    xp: 25 + (day - 1) * 25,
    streakDay: day,
  };
}
