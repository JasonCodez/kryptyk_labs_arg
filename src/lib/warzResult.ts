import { getPuzzleTypeLabel } from "@/lib/puzzleTypeLabels";

export const WARZ_DNF_SENTINEL = 999999;

export type WarzViewerRole = "challenger" | "opponent" | "neutral";
export type WarzFinishKind = "time" | "forfeit" | "missing";
export type WarzBattleOutcome = "challenger-win" | "opponent-win" | "draw" | "unavailable";
export type WarzViewerOutcome = "victory" | "defeat" | "draw" | "neutral" | "unavailable";

export interface WarzResultParticipant {
  id: string;
  username?: string | null;
  name?: string | null;
  image?: string | null;
  level?: number | null;
}

export interface WarzResultChallenge {
  id: string;
  status: string;
  challengerWager: number;
  challengerTime?: number | null;
  opponentTime?: number | null;
  winnerId?: string | null;
  potPaid?: boolean;
  puzzle: {
    title: string;
    puzzleType: string;
  };
  challenger: WarzResultParticipant;
  opponent?: WarzResultParticipant | null;
  winner?: Pick<WarzResultParticipant, "id" | "username" | "name"> | null;
}

export interface WarzResultPlayer {
  id: string | null;
  displayName: string;
  image: string | null;
  roleLabel: "Challenger" | "Opponent";
  isCurrentUser: boolean;
  isWinner: boolean;
  finishKind: WarzFinishKind;
  rawTime: number | null;
  displayTime: string;
}

export interface WarzResultViewModel {
  battleOutcome: WarzBattleOutcome;
  viewerOutcome: WarzViewerOutcome;
  viewerRole: WarzViewerRole;
  headline: string;
  supportingCopy: string;
  challenger: WarzResultPlayer;
  opponent: WarzResultPlayer;
  wager: number;
  pot: number;
  potPaid: boolean;
  economyLabel: string;
  economyValue: string;
  economySupport: string;
  puzzleTitle: string;
  puzzleTypeLabel: string;
  shareTitle: string;
  shareText: string;
}

function isValidTime(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export function classifyWarzFinish(value: unknown): WarzFinishKind {
  if (!isValidTime(value)) return "missing";
  return value >= WARZ_DNF_SENTINEL ? "forfeit" : "time";
}

export function formatWarzClock(seconds: number): string {
  const kind = classifyWarzFinish(seconds);
  if (kind === "missing") return "—";
  if (kind === "forfeit") return "Forfeit";
  const whole = Math.floor(seconds);
  const minutes = Math.floor(whole / 60).toString().padStart(2, "0");
  const remainder = (whole % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
}

export function formatWarzShareTime(seconds: number): string {
  const kind = classifyWarzFinish(seconds);
  if (kind === "missing") return "unavailable";
  if (kind === "forfeit") return "Forfeit";
  const whole = Math.floor(seconds);
  const minutes = Math.floor(whole / 60);
  const remainder = whole % 60;
  if (minutes === 0) return `${remainder}s`;
  if (remainder === 0) return `${minutes}m`;
  return `${minutes}m ${remainder}s`;
}

export function getWarzDisplayName(
  participant?: Pick<WarzResultParticipant, "name" | "username"> | null
): string {
  const name = participant?.name?.trim();
  if (name) return name;
  const username = participant?.username?.trim();
  return username || "Player";
}

function classifyViewerRole(challenge: WarzResultChallenge, currentUserId: string): WarzViewerRole {
  if (challenge.challenger?.id === currentUserId) return "challenger";
  if (challenge.opponent?.id === currentUserId) return "opponent";
  return "neutral";
}

function classifyBattleOutcome(challenge: WarzResultChallenge): WarzBattleOutcome {
  if (challenge.status !== "COMPLETED" || !challenge.challenger?.id || !challenge.opponent?.id) {
    return "unavailable";
  }

  const winnerId = challenge.winnerId ?? challenge.winner?.id ?? null;
  if (winnerId) {
    if (winnerId === challenge.challenger.id) return "challenger-win";
    if (winnerId === challenge.opponent.id) return "opponent-win";
    return "unavailable";
  }

  const challengerFinish = classifyWarzFinish(challenge.challengerTime);
  const opponentFinish = classifyWarzFinish(challenge.opponentTime);
  return challengerFinish !== "missing" && opponentFinish !== "missing" ? "draw" : "unavailable";
}

function playerModel(
  participant: WarzResultParticipant | null | undefined,
  roleLabel: "Challenger" | "Opponent",
  rawTime: number | null | undefined,
  currentUserId: string,
  winnerId: string | null
): WarzResultPlayer {
  const finishKind = classifyWarzFinish(rawTime);
  return {
    id: participant?.id ?? null,
    displayName: getWarzDisplayName(participant),
    image: participant?.image ?? null,
    roleLabel,
    isCurrentUser: participant?.id === currentUserId,
    isWinner: participant?.id === winnerId,
    finishKind,
    rawTime: isValidTime(rawTime) ? rawTime : null,
    displayTime: isValidTime(rawTime) ? formatWarzClock(rawTime) : "—",
  };
}

function viewerOutcomeFor(battleOutcome: WarzBattleOutcome, viewerRole: WarzViewerRole): WarzViewerOutcome {
  if (battleOutcome === "unavailable") return "unavailable";
  if (viewerRole === "neutral") return "neutral";
  if (battleOutcome === "draw") return "draw";
  const viewerWon =
    (viewerRole === "challenger" && battleOutcome === "challenger-win") ||
    (viewerRole === "opponent" && battleOutcome === "opponent-win");
  return viewerWon ? "victory" : "defeat";
}

function buildPresentation(
  viewerOutcome: WarzViewerOutcome,
  viewerRole: WarzViewerRole,
  challenger: WarzResultPlayer,
  opponent: WarzResultPlayer,
  battleOutcome: WarzBattleOutcome
): { headline: string; supportingCopy: string } {
  if (viewerOutcome === "unavailable") {
    return {
      headline: "Result Unavailable",
      supportingCopy: "This battle is complete, but its result data is incomplete.",
    };
  }
  if (viewerOutcome === "draw") {
    return {
      headline: "Draw",
      supportingCopy: "The battle ended without a winner. Both wagers were returned.",
    };
  }
  if (viewerOutcome === "neutral") {
    if (battleOutcome === "draw") {
      return { headline: "Battle Complete", supportingCopy: "This Warz battle ended in a draw." };
    }
    const winner = battleOutcome === "challenger-win" ? challenger : opponent;
    const loser = battleOutcome === "challenger-win" ? opponent : challenger;
    return {
      headline: "Battle Complete",
      supportingCopy: `${winner.displayName} won this Warz battle${loser.finishKind === "forfeit" ? " by forfeit" : ""}.`,
    };
  }

  const viewer = viewerRole === "challenger" ? challenger : opponent;
  const rival = viewerRole === "challenger" ? opponent : challenger;
  if (viewerOutcome === "victory") {
    return rival.finishKind === "forfeit"
      ? {
          headline: "Victory by Forfeit",
          supportingCopy: "Your opponent did not finish. You claimed the battle.",
        }
      : {
          headline: "Victory",
          supportingCopy: "You solved the puzzle faster and claimed the battle.",
        };
  }

  return viewer.finishKind === "forfeit"
    ? {
        headline: "Defeat by Forfeit",
        supportingCopy: "Your run was submitted as a forfeit.",
      }
    : {
        headline: "Defeat",
        supportingCopy: "Your opponent finished faster this time.",
      };
}

function buildEconomy(
  viewerOutcome: WarzViewerOutcome,
  battleOutcome: WarzBattleOutcome,
  wager: number,
  pot: number,
  potPaid: boolean
): Pick<WarzResultViewModel, "economyLabel" | "economyValue" | "economySupport"> {
  if (viewerOutcome === "victory") {
    return {
      economyLabel: "POT CLAIMED",
      economyValue: `${pot} Points`,
      economySupport: potPaid ? "The full battle pot was paid to you." : "Battle pot recorded for the winner.",
    };
  }
  if (viewerOutcome === "defeat") {
    return {
      economyLabel: "WAGER LOST",
      economyValue: `${wager} Points`,
      economySupport: potPaid
        ? `The winner received the full ${pot}-Point pot.`
        : `The winner was recorded for the ${pot}-Point pot.`,
    };
  }
  if (viewerOutcome === "draw") {
    return {
      economyLabel: "WAGER RETURNED",
      economyValue: `${wager} Points`,
      economySupport: potPaid ? "Each player received their wager back." : "The battle was recorded as a draw.",
    };
  }
  if (viewerOutcome === "neutral") {
    return {
      economyLabel: "TOTAL POT",
      economyValue: `${pot} Points`,
      economySupport: battleOutcome === "draw" ? "Both wagers were returned." : "The winner claimed the battle pot.",
    };
  }
  return {
    economyLabel: "BATTLE WAGER",
    economyValue: Number.isFinite(wager) && wager >= 0 ? `${wager} Points` : "Unavailable",
    economySupport: "Payout details are unavailable.",
  };
}

export function buildWarzShareCopy(model: WarzResultViewModel): string {
  if (model.viewerOutcome === "unavailable") return "";
  const challengerTime =
    model.challenger.rawTime == null ? "unavailable" : formatWarzShareTime(model.challenger.rawTime);
  const opponentTime =
    model.opponent.rawTime == null ? "unavailable" : formatWarzShareTime(model.opponent.rawTime);
  const viewerTime = model.viewerRole === "opponent" ? opponentTime : challengerTime;
  const rivalTime = model.viewerRole === "opponent" ? challengerTime : opponentTime;

  if (model.viewerOutcome === "victory") {
    const byForfeit = model.headline === "Victory by Forfeit";
    return byForfeit
      ? `I won a Puzzle Warz battle by forfeit on PuzzleWarz!\n${model.puzzleTitle} · ${model.pot} Point pot`
      : `I won a Puzzle Warz battle on PuzzleWarz!\n${viewerTime} vs ${rivalTime} · ${model.pot} Point pot`;
  }
  if (model.viewerOutcome === "defeat") {
    return model.headline === "Defeat by Forfeit"
      ? `My Puzzle Warz battle ended by forfeit.\n${model.puzzleTitle} · ${model.pot} Point pot`
      : `I battled on PuzzleWarz: ${viewerTime} vs ${rivalTime}.\n${model.puzzleTitle} · ${model.pot} Point pot`;
  }
  if (model.viewerOutcome === "draw") {
    const same = challengerTime === opponentTime ? `${challengerTime} each` : `${challengerTime} vs ${opponentTime}`;
    return `My Puzzle Warz battle ended in a draw.\n${same} · wagers returned`;
  }

  if (model.battleOutcome === "draw") {
    return `Puzzle Warz result: ${model.challenger.displayName} and ${model.opponent.displayName} drew.\n${challengerTime} vs ${opponentTime} · wagers returned`;
  }
  const winner = model.battleOutcome === "challenger-win" ? model.challenger : model.opponent;
  const loser = model.battleOutcome === "challenger-win" ? model.opponent : model.challenger;
  return `Puzzle Warz result: ${winner.displayName} defeated ${loser.displayName}.\n${challengerTime} vs ${opponentTime} · ${model.pot} Point pot`;
}

export function createWarzResultViewModel(
  challenge: WarzResultChallenge,
  currentUserId: string
): WarzResultViewModel {
  const viewerRole = classifyViewerRole(challenge, currentUserId);
  const battleOutcome = classifyBattleOutcome(challenge);
  const winnerId =
    battleOutcome === "challenger-win"
      ? challenge.challenger.id
      : battleOutcome === "opponent-win"
        ? challenge.opponent?.id ?? null
        : null;
  const challenger = playerModel(
    challenge.challenger,
    "Challenger",
    challenge.challengerTime,
    currentUserId,
    winnerId
  );
  const opponent = playerModel(
    challenge.opponent,
    "Opponent",
    challenge.opponentTime,
    currentUserId,
    winnerId
  );
  const viewerOutcome = viewerOutcomeFor(battleOutcome, viewerRole);
  const { headline, supportingCopy } = buildPresentation(
    viewerOutcome,
    viewerRole,
    challenger,
    opponent,
    battleOutcome
  );
  const wager =
    typeof challenge.challengerWager === "number" && Number.isFinite(challenge.challengerWager)
      ? Math.max(0, challenge.challengerWager)
      : 0;
  const pot = wager * 2;
  const economy = buildEconomy(viewerOutcome, battleOutcome, wager, pot, Boolean(challenge.potPaid));
  const base: WarzResultViewModel = {
    battleOutcome,
    viewerOutcome,
    viewerRole,
    headline,
    supportingCopy,
    challenger,
    opponent,
    wager,
    pot,
    potPaid: Boolean(challenge.potPaid),
    ...economy,
    puzzleTitle: challenge.puzzle?.title?.trim() || "Puzzle Warz",
    puzzleTypeLabel: getPuzzleTypeLabel(challenge.puzzle?.puzzleType || "general"),
    shareTitle: "Puzzle Warz Battle Result",
    shareText: "",
  };
  return { ...base, shareText: buildWarzShareCopy(base) };
}
