export const DEFAULT_ANAGRAM_TIME_LIMIT_SECONDS = 60;

export interface NormalizedAnagramConfig {
  words: string[];
  timeLimitSeconds: number;
}

export function normalizeAnagramTimeLimit(value: unknown): number {
  const parsed = typeof value === "number" || typeof value === "string"
    ? Number(value)
    : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : DEFAULT_ANAGRAM_TIME_LIMIT_SECONDS;
}

export function normalizeAnagramWords(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate) => {
    if (typeof candidate !== "string") return [];
    const answer = candidate.toUpperCase().replace(/[^A-Z]/g, "");
    return answer ? [answer] : [];
  });
}

export function normalizeAnagramConfig(value: unknown): NormalizedAnagramConfig {
  const data = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    words: normalizeAnagramWords(data.words),
    timeLimitSeconds: normalizeAnagramTimeLimit(data.timeLimit),
  };
}
