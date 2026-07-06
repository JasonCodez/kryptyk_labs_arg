export const MAX_CLUE_LENGTH = 100;

const MIN_TRUNCATED_LENGTH = 20;
const CLAUSE_BOUNDARIES = [",", ";", ":", " ("];
// A clause boundary only wins over a plain word-boundary cut if it falls within
// this many characters of the limit — otherwise an early comma (e.g. "The loud
// rumbling, cracking, or crashing sound...") would discard most of the clue for
// no good reason.
const CLAUSE_CUT_WINDOW = 50;
const TRAILING_STOPWORDS =
  /\s+(and|or|but|which|with|of|to|for|by|in|on|at|as|a|an|the|when|that|from|around|near|about|into|onto|over|under|through|during|after|before|between|among|without|within|upon|off|out|down|up)$/i;

/** Keeps only the first sentence of a dictionary/encyclopedia-style definition. */
export function toFirstSentence(text: string): string {
  const match = text.match(/^(.*?[.!?])(\s|$)/);
  return match ? match[1].trim() : text.trim();
}

/**
 * Reduces a clue to one sentence and, if it's still long, cuts it at the last
 * clause boundary (comma/semicolon/colon/parenthesis) before maxLength rather
 * than mid-word — dictionary glosses tend to run on with clause after clause.
 */
export function shortenClueText(rawText: string, maxLength: number = MAX_CLUE_LENGTH): string {
  const singleSentence = toFirstSentence(rawText);
  if (singleSentence.length <= maxLength) return singleSentence;

  const hasTrailingPunctuation = /[.!?]$/.test(singleSentence);
  let body = hasTrailingPunctuation ? singleSentence.slice(0, -1) : singleSentence;
  const limit = maxLength - 1;
  const windowStart = Math.max(MIN_TRUNCATED_LENGTH, limit - CLAUSE_CUT_WINDOW);

  let cut = -1;
  for (const boundary of CLAUSE_BOUNDARIES) {
    const idx = body.lastIndexOf(boundary, limit);
    if (idx > cut && idx >= windowStart) cut = idx;
  }

  if (cut >= MIN_TRUNCATED_LENGTH) {
    body = body.slice(0, cut);
  } else {
    body = body.slice(0, limit);
    const lastSpace = body.lastIndexOf(" ");
    if (lastSpace >= MIN_TRUNCATED_LENGTH) body = body.slice(0, lastSpace);
  }

  body = body.trim().replace(/[,;:]+$/, "");
  let stripped = body;
  do {
    body = stripped;
    stripped = body.replace(TRAILING_STOPWORDS, "");
  } while (stripped !== body && stripped.length >= MIN_TRUNCATED_LENGTH);

  return `${body}.`;
}
