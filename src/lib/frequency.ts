export const MAX_FREQUENCY_ANSWERS = 3;
export const MAX_FREQUENCY_ANSWER_WORDS = 2;

export function countAnswerWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function isWithinFrequencyWordLimit(text: string): boolean {
  return countAnswerWords(text) <= MAX_FREQUENCY_ANSWER_WORDS;
}

export interface FrequencyCanonicalGroup {
  canonical: string;
  aliases: string[];
}

export interface FrequencyCanonicalConfig {
  groups: FrequencyCanonicalGroup[];
  aliasLookup: Map<string, string>;
  displayLookup: Map<string, string>;
}

export function normalizeFrequencyAnswer(text: string): string {
  return text.toLowerCase().trim().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ");
}

export function parseFrequencyCanonicalGroupsInput(text: string): FrequencyCanonicalGroup[] {
  const groups: FrequencyCanonicalGroup[] = [];

  for (const [index, rawLine] of text.split(/\r?\n/).entries()) {
    const line = rawLine.trim();
    if (!line) continue;

    const colonIndex = line.indexOf(":");
    const canonical = (colonIndex >= 0 ? line.slice(0, colonIndex) : line).trim();
    const aliasesText = colonIndex >= 0 ? line.slice(colonIndex + 1) : "";

    if (!canonical) {
      throw new Error(`Line ${index + 1}: canonical answer is required.`);
    }

    const aliases = aliasesText
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    groups.push({ canonical, aliases });
  }

  return buildFrequencyCanonicalConfig(groups, { strict: true }).groups;
}

export function formatFrequencyCanonicalGroupsInput(raw: unknown): string {
  return buildFrequencyCanonicalConfig(raw).groups
    .map((group) => {
      if (group.aliases.length === 0) {
        return group.canonical;
      }

      return `${group.canonical}: ${group.aliases.join(", ")}`;
    })
    .join("\n");
}

export function buildFrequencyCanonicalConfig(
  raw: unknown,
  options: { strict?: boolean } = {}
): FrequencyCanonicalConfig {
  const strict = options.strict ?? false;
  const aliasLookup = new Map<string, string>();
  const displayLookup = new Map<string, string>();
  const groups: FrequencyCanonicalGroup[] = [];

  if (!Array.isArray(raw)) {
    return { groups, aliasLookup, displayLookup };
  }

  for (const item of raw) {
    if (!item || typeof item !== "object") continue;

    const canonicalRaw = (item as { canonical?: unknown }).canonical;
    const aliasesRaw = (item as { aliases?: unknown }).aliases;

    if (typeof canonicalRaw !== "string") continue;

    const canonical = canonicalRaw.trim();
    const canonicalKey = normalizeFrequencyAnswer(canonical);
    if (!canonicalKey) continue;

    const aliases = Array.isArray(aliasesRaw)
      ? aliasesRaw.filter((value): value is string => typeof value === "string").map((value) => value.trim()).filter(Boolean)
      : [];

    displayLookup.set(canonicalKey, canonical);

    const cleanedAliases: string[] = [];
    const seenInGroup = new Set<string>([canonicalKey]);
    const values = [canonical, ...aliases];

    for (const value of values) {
      const normalized = normalizeFrequencyAnswer(value);
      if (!normalized) continue;

      if (seenInGroup.has(normalized) && normalized !== canonicalKey) {
        continue;
      }

      const existing = aliasLookup.get(normalized);
      if (existing && existing !== canonicalKey) {
        if (strict) {
          throw new Error(`Alias \"${value}\" is assigned to multiple canonical answers.`);
        }
        continue;
      }

      aliasLookup.set(normalized, canonicalKey);
      seenInGroup.add(normalized);

      if (normalized !== canonicalKey) {
        cleanedAliases.push(value.trim());
      }
    }

    groups.push({ canonical, aliases: cleanedAliases });
  }

  return { groups, aliasLookup, displayLookup };
}

export function canonicalizeFrequencyAnswer(text: string, config: FrequencyCanonicalConfig): string {
  const normalized = normalizeFrequencyAnswer(text);
  if (!normalized) return "";
  return config.aliasLookup.get(normalized) ?? normalized;
}

export function calculateFrequencyScore(
  rawAnswers: string[],
  answerBuckets: Array<{ text: string; count: number }>,
  totalSubmissions: number,
  config: FrequencyCanonicalConfig
): number {
  if (totalSubmissions <= 0) {
    return 0;
  }

  let score = 0;
  for (const raw of rawAnswers) {
    const canonical = canonicalizeFrequencyAnswer(raw, config);
    if (!canonical) continue;

    const match = answerBuckets.find((answer) => answer.text === canonical);
    if (match) {
      score += Math.round((match.count / totalSubmissions) * 100);
    }
  }

  return score;
}

export function getFrequencyCanonicalDisplayText(
  canonicalText: string,
  fallbackRaw: string,
  config: FrequencyCanonicalConfig
): string {
  return config.displayLookup.get(canonicalText) ?? fallbackRaw.trim();
}