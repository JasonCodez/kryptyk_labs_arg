import {
  WARZ_DNF_SENTINEL,
  buildWarzShareCopy,
  classifyWarzFinish,
  createWarzResultViewModel,
  formatWarzClock,
  formatWarzShareTime,
  getWarzDisplayName,
  type WarzResultChallenge,
} from "./warzResult";

function challenge(overrides: Partial<WarzResultChallenge> = {}): WarzResultChallenge {
  return {
    id: "challenge-secret-id",
    status: "COMPLETED",
    challengerWager: 50,
    challengerTime: 42,
    opponentTime: 66,
    winnerId: "challenger-id",
    potPaid: true,
    puzzle: { title: "Midnight Sudoku", puzzleType: "sudoku" },
    challenger: { id: "challenger-id", name: "Jason", image: null },
    opponent: { id: "opponent-id", name: "Rival", image: null },
    winner: { id: "challenger-id", name: "Jason" },
    ...overrides,
  };
}

describe("warzResult", () => {
  test("exports the authoritative DNF sentinel", () => {
    expect(WARZ_DNF_SENTINEL).toBe(999999);
  });

  test.each([
    [0, "00:00"],
    [9, "00:09"],
    [65, "01:05"],
    [3605, "60:05"],
    [999999, "Forfeit"],
    [-1, "—"],
    [Number.NaN, "—"],
  ])("formats clock %p as %p", (input, expected) => {
    expect(formatWarzClock(input)).toBe(expected);
  });

  test.each([
    [42, "42s"],
    [66, "1m 6s"],
    [120, "2m"],
    [999999, "Forfeit"],
    [Number.NaN, "unavailable"],
  ])("formats share time %p as %p", (input, expected) => {
    expect(formatWarzShareTime(input)).toBe(expected);
  });

  test.each([
    [42, "time"],
    [999999, "forfeit"],
    [null, "missing"],
    [undefined, "missing"],
    [-1, "missing"],
  ])("classifies finish %p as %p", (input, expected) => {
    expect(classifyWarzFinish(input)).toBe(expected);
  });

  test("uses name, username, then Player for display names", () => {
    expect(getWarzDisplayName({ name: "Name", username: "handle" })).toBe("Name");
    expect(getWarzDisplayName({ name: " ", username: "handle" })).toBe("handle");
    expect(getWarzDisplayName({ name: null, username: null })).toBe("Player");
  });

  test.each([
    ["challenger-id", "challenger"],
    ["opponent-id", "opponent"],
    ["viewer-id", "neutral"],
  ])("classifies viewer %p as %p", (viewer, expected) => {
    expect(createWarzResultViewModel(challenge(), viewer).viewerRole).toBe(expected);
  });

  test("classifies authoritative challenger and opponent wins", () => {
    const challengerWin = createWarzResultViewModel(challenge(), "challenger-id");
    expect(challengerWin.battleOutcome).toBe("challenger-win");
    expect(challengerWin.viewerOutcome).toBe("victory");
    expect(challengerWin.challenger.isWinner).toBe(true);
    expect(challengerWin.challenger.isCurrentUser).toBe(true);

    const opponentWin = createWarzResultViewModel(
      challenge({
        winnerId: "opponent-id",
        winner: { id: "opponent-id", name: "Rival" },
        challengerTime: 66,
        opponentTime: 42,
      }),
      "opponent-id"
    );
    expect(opponentWin.battleOutcome).toBe("opponent-win");
    expect(opponentWin.viewerOutcome).toBe("victory");
    expect(opponentWin.opponent.isWinner).toBe(true);
  });

  test("classifies winner and loser relative to either participant", () => {
    expect(createWarzResultViewModel(challenge(), "opponent-id").viewerOutcome).toBe("defeat");
    const opponentWinner = challenge({
      winnerId: "opponent-id",
      winner: { id: "opponent-id" },
    });
    expect(createWarzResultViewModel(opponentWinner, "challenger-id").viewerOutcome).toBe("defeat");
    expect(createWarzResultViewModel(opponentWinner, "opponent-id").viewerOutcome).toBe("victory");
  });

  test("neutral viewers get a neutral completed view and no You marker", () => {
    const model = createWarzResultViewModel(challenge(), "viewer-id");
    expect(model.viewerOutcome).toBe("neutral");
    expect(model.headline).toBe("Battle Complete");
    expect(model.challenger.isCurrentUser).toBe(false);
    expect(model.opponent.isCurrentUser).toBe(false);
  });

  test("classifies no-winner completion values and both forfeits as draws", () => {
    const timed = createWarzResultViewModel(challenge({ winnerId: null, winner: null }), "challenger-id");
    expect(timed.battleOutcome).toBe("draw");
    expect(timed.viewerOutcome).toBe("draw");
    const forfeits = createWarzResultViewModel(
      challenge({
        winnerId: null,
        winner: null,
        challengerTime: WARZ_DNF_SENTINEL,
        opponentTime: WARZ_DNF_SENTINEL,
      }),
      "opponent-id"
    );
    expect(forfeits.battleOutcome).toBe("draw");
    expect(forfeits.challenger.displayTime).toBe("Forfeit");
    expect(forfeits.opponent.displayTime).toBe("Forfeit");
  });

  test.each(["challenger-id", "opponent-id"])(
    "does not infer a draw from equal times when %s is authoritative",
    (winnerId) => {
      const model = createWarzResultViewModel(
        challenge({
          challengerTime: 42,
          opponentTime: 42,
          winnerId,
          winner: { id: winnerId },
        }),
        "viewer-id"
      );
      expect(model.battleOutcome).toBe(winnerId === "challenger-id" ? "challenger-win" : "opponent-win");
    }
  );

  test.each([
    [challenge({ winnerId: "unknown-id" }), "unknown winner"],
    [challenge({ challenger: undefined as unknown as WarzResultChallenge["challenger"] }), "missing challenger"],
    [challenge({ opponent: null }), "missing opponent"],
    [challenge({ winnerId: null, winner: null, opponentTime: null }), "missing completion"],
    [challenge({ status: "IN_PROGRESS" }), "not completed"],
  ])("classifies %s as unavailable", (fixture) => {
    const model = createWarzResultViewModel(fixture, "viewer-id");
    expect(model.battleOutcome).toBe("unavailable");
    expect(model.viewerOutcome).toBe("unavailable");
    expect(model.headline).toBe("Result Unavailable");
    expect(model.shareText).toBe("");
  });

  test.each([
    ["challenger-id", 42, 66, "challenger-id", "Victory"],
    ["challenger-id", 42, 999999, "challenger-id", "Victory by Forfeit"],
    ["opponent-id", 42, 66, "challenger-id", "Defeat"],
    ["opponent-id", 42, 999999, "challenger-id", "Defeat by Forfeit"],
  ])("produces viewer-relative headline %p", (viewer, challengerTime, opponentTime, winnerId, headline) => {
    const model = createWarzResultViewModel(
      challenge({ challengerTime, opponentTime, winnerId, winner: { id: winnerId } }),
      viewer
    );
    expect(model.headline).toBe(headline);
  });

  test("produces draw presentation and refund economy", () => {
    const model = createWarzResultViewModel(
      challenge({ winnerId: null, winner: null, challengerTime: 42, opponentTime: 42 }),
      "challenger-id"
    );
    expect(model.headline).toBe("Draw");
    expect(model.economyLabel).toBe("WAGER RETURNED");
    expect(model.economyValue).toBe("50 Points");
    expect(model.economySupport).toBe("Each player received their wager back.");
  });

  test("calculates and describes victory, defeat, and neutral economy without fake bonuses", () => {
    const victory = createWarzResultViewModel(challenge(), "challenger-id");
    expect(victory.wager).toBe(50);
    expect(victory.pot).toBe(100);
    expect(victory.economyLabel).toBe("POT CLAIMED");
    expect(victory.economyValue).toBe("100 Points");
    expect(victory.economyValue).not.toContain("+");

    const defeat = createWarzResultViewModel(challenge(), "opponent-id");
    expect(defeat.economyLabel).toBe("WAGER LOST");
    expect(defeat.economyValue).toBe("50 Points");

    const neutral = createWarzResultViewModel(challenge(), "viewer-id");
    expect(neutral.economyLabel).toBe("TOTAL POT");
    expect(neutral.economyValue).toBe("100 Points");
  });

  test("does not claim payment when potPaid is false", () => {
    const model = createWarzResultViewModel(challenge({ potPaid: false }), "challenger-id");
    expect(model.economySupport).toBe("Battle pot recorded for the winner.");
    expect(model.economySupport).not.toMatch(/paid to you/i);
  });

  test("builds truthful safe share copy for all valid viewer outcomes", () => {
    const victory = createWarzResultViewModel(challenge(), "challenger-id");
    const defeat = createWarzResultViewModel(challenge(), "opponent-id");
    const draw = createWarzResultViewModel(
      challenge({ winnerId: null, winner: null, challengerTime: 42, opponentTime: 42 }),
      "challenger-id"
    );
    const neutral = createWarzResultViewModel(challenge(), "viewer-id");
    const forfeit = createWarzResultViewModel(
      challenge({ opponentTime: WARZ_DNF_SENTINEL }),
      "challenger-id"
    );

    expect(victory.shareText).toContain("I won a Puzzle Warz battle");
    expect(defeat.shareText).toContain("I battled on PuzzleWarz");
    expect(draw.shareText).toContain("ended in a draw");
    expect(neutral.shareText).toContain("Jason defeated Rival");
    expect(forfeit.shareText).toContain("by forfeit");
    for (const text of [victory.shareText, defeat.shareText, draw.shareText, neutral.shareText, forfeit.shareText]) {
      expect(text).not.toMatch(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u);
      expect(text).not.toContain("challenge-secret-id");
      expect(text).not.toContain("challenger-id");
      expect(text).not.toContain("opponent-id");
      expect(text).not.toContain("@example.com");
      expect(text).not.toMatch(/solution|puzzleGrid|imageUrl/);
    }
    expect(buildWarzShareCopy(victory)).toBe(victory.shareText);
  });
});
