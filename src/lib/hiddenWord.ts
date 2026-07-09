export type HiddenWordLetterStatus = "correct" | "present" | "absent";

export interface HiddenWordGuessResult {
  letter: string;
  status: HiddenWordLetterStatus;
}

export type HiddenWordGameStatus = "playing" | "won" | "lost";

interface StoredHiddenWordState {
  status?: unknown;
  guessResults?: unknown;
  guesses?: unknown;
}

function normalizeWord(value: string): string {
  return value.toUpperCase().trim();
}

function isGameStatus(value: unknown): value is HiddenWordGameStatus {
  return value === "playing" || value === "won" || value === "lost";
}

function isGuessResult(value: unknown): value is HiddenWordGuessResult {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { letter?: unknown; status?: unknown };
  return typeof candidate.letter === "string"
    && (candidate.status === "correct" || candidate.status === "present" || candidate.status === "absent");
}

export function scoreHiddenWordGuess(guess: string, answer: string): HiddenWordGuessResult[] {
  const normalizedGuess = normalizeWord(guess);
  const normalizedAnswer = normalizeWord(answer);

  const answerChars = normalizedAnswer.split("");
  const guessChars = normalizedGuess.split("");
  const result: HiddenWordGuessResult[] = guessChars.map((letter) => ({
    letter,
    status: "absent",
  }));

  const usedAnswer = Array(normalizedAnswer.length).fill(false);
  const usedGuess = Array(normalizedGuess.length).fill(false);

  for (let index = 0; index < normalizedAnswer.length; index++) {
    if (guessChars[index] === answerChars[index]) {
      result[index].status = "correct";
      usedAnswer[index] = true;
      usedGuess[index] = true;
    }
  }

  for (let guessIndex = 0; guessIndex < normalizedGuess.length; guessIndex++) {
    if (usedGuess[guessIndex]) continue;

    for (let answerIndex = 0; answerIndex < normalizedAnswer.length; answerIndex++) {
      if (usedAnswer[answerIndex]) continue;
      if (guessChars[guessIndex] !== answerChars[answerIndex]) continue;

      result[guessIndex].status = "present";
      usedAnswer[answerIndex] = true;
      break;
    }
  }

  return result;
}

export function isSolvedHiddenWordResult(result: HiddenWordGuessResult[]): boolean {
  return result.length > 0 && result.every((letter) => letter.status === "correct");
}

export function serializeHiddenWordState(guessResults: HiddenWordGuessResult[][], status: HiddenWordGameStatus): string {
  return JSON.stringify({ guessResults, status });
}

export function parseStoredHiddenWordState(raw: string | null, answer: string): {
  guessResults: HiddenWordGuessResult[][];
  status: HiddenWordGameStatus;
} | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as StoredHiddenWordState;
    const status = isGameStatus(parsed.status) ? parsed.status : "playing";

    if (Array.isArray(parsed.guessResults)) {
      const guessResults = parsed.guessResults
        .map((row) => Array.isArray(row) ? row.filter(isGuessResult) : [])
        .filter((row) => row.length > 0);

      if (guessResults.length > 0) {
        return { guessResults, status };
      }
    }

    if (Array.isArray(parsed.guesses)) {
      const guessResults = parsed.guesses
        .filter((guess): guess is string => typeof guess === "string")
        .map((guess) => scoreHiddenWordGuess(guess, answer));

      if (guessResults.length > 0) {
        return { guessResults, status };
      }
    }
  } catch {
    return null;
  }

  return null;
}
