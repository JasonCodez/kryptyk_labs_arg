import { computeStreak, getDayNumberForDate, streakReward } from "../dailyPuzzle";

describe("computeStreak", () => {
  test("today completed, 3-day run ending today (row included in list)", () => {
    // dayNumber=10 today; rows exist for 10,9,8 (descending)
    expect(computeStreak([10, 9, 8], 10, true)).toBe(3);
  });

  test("today completed, row NOT yet in the list (guest-complete style)", () => {
    // dayNumber=10 today; only prior rows 9,8 passed (today excluded from query)
    expect(computeStreak([9, 8], 10, true)).toBe(3);
  });

  test("today not completed yet, streak alive through yesterday", () => {
    expect(computeStreak([9, 8, 7], 10, false)).toBe(3);
  });

  test("today not completed, gap yesterday breaks the streak", () => {
    // yesterday (9) missing; most recent is day 7
    expect(computeStreak([7, 6], 10, false)).toBe(0);
  });

  test("no history at all, today completed", () => {
    expect(computeStreak([], 10, true)).toBe(1);
  });

  test("no history at all, today not completed", () => {
    expect(computeStreak([], 10, false)).toBe(0);
  });

  test("gap breaks the streak after a couple consecutive days", () => {
    // today completed; yesterday(9) present, day-before(8) missing, day 7 present but irrelevant
    expect(computeStreak([9, 7], 10, true)).toBe(2);
  });

  test("skipped/lost rows still count toward the streak (existing app behavior)", () => {
    // the real routes insert rows for losses/skips too — presence alone should count
    expect(computeStreak([9, 8], 10, true)).toBe(3);
  });
});

describe("streakReward", () => {
  test("day 1 through 7 pay out the documented curve", () => {
    expect(streakReward(1)).toEqual({ points: 50, xp: 25, streakDay: 1 });
    expect(streakReward(7)).toEqual({ points: 200, xp: 175, streakDay: 7 });
  });

  test("clamps below 1 and above 7", () => {
    expect(streakReward(0)).toEqual({ points: 50, xp: 25, streakDay: 1 });
    expect(streakReward(8)).toEqual({ points: 200, xp: 175, streakDay: 7 });
  });
});

describe("getDayNumberForDate", () => {
  test("launch day (2026-07-04) is day 1", () => {
    expect(getDayNumberForDate(new Date(Date.UTC(2026, 6, 4)))).toBe(1);
  });

  test("day after launch is day 2", () => {
    expect(getDayNumberForDate(new Date(Date.UTC(2026, 6, 5)))).toBe(2);
  });
});
