import type {
  HiddenWordGameStatus,
  HiddenWordGuessResult,
  HiddenWordLetterStatus,
} from "@/lib/hiddenWord";

export const DAILY_HIDDENWORD_SNAPSHOT_WIDTH = 1080;
export const DAILY_HIDDENWORD_SNAPSHOT_HEIGHT = 1350;

export interface DailyHiddenWordComparisonStats {
  rank: number;
  totalSolvers: number;
  lowerGuessCount: number;
  sameGuessCount: number;
  higherGuessCount: number;
  beatPercent: number;
  averageGuesses: number;
}

const EMOJI_BY_STATUS = {
  correct: "🟩",
  present: "🟨",
  absent: "⬛",
} as const;

const TILE_FILL = {
  correct: "#38D399",
  present: "#FDE74C",
  absent: "#10242B",
  empty: "rgba(255,255,255,0.03)",
} as const;

const TILE_STROKE = {
  correct: "#0F9B6F",
  present: "#D4A912",
  absent: "rgba(56,145,166,0.38)",
  empty: "rgba(255,255,255,0.08)",
} as const;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

interface SharePayload {
  puzzleNumber: number;
  guessResults: HiddenWordGuessResult[][];
  gameStatus: HiddenWordGameStatus;
  maxGuesses: number;
  wordLength: number;
  dailyStreak?: number;
  comparison?: DailyHiddenWordComparisonStats | null;
  shareUrl?: string;
}

function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//, "");
}

function formatGuessAverage(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function buildDailyHiddenWordShareText({
  puzzleNumber,
  guessResults,
  gameStatus,
  maxGuesses,
  dailyStreak = 0,
  comparison = null,
}: Omit<SharePayload, "wordLength">): string {
  const rows = guessResults.map((guess) => guess.map((letter) => EMOJI_BY_STATUS[letter.status]).join(""));
  const score = gameStatus === "won" ? `${guessResults.length}/${maxGuesses}` : `X/${maxGuesses}`;
  const streakLine = dailyStreak > 0 ? `\n🔥 ${dailyStreak}-day daily streak` : "";
  const comparisonLine = comparison
    ? `\n📊 Rank #${comparison.rank}/${comparison.totalSolvers} today · beat ${comparison.beatPercent}% of solvers`
    : "";
  const close = gameStatus === "won"
    ? "\nThink you can crack it?"
    : "\nReset hits at midnight UTC.";

  return `⚔️ PuzzleWarz Daily Hidden Word #${puzzleNumber} — ${score}\n\n${rows.join("\n")}${streakLine}${comparisonLine}${close}`;
}

export function buildDailyHiddenWordSnapshotSvg({
  puzzleNumber,
  guessResults,
  gameStatus,
  maxGuesses,
  wordLength,
  dailyStreak = 0,
  comparison = null,
  shareUrl,
}: SharePayload): string {
  const footerUrl = shareUrl ? displayUrl(shareUrl) : "puzzlewarz.com/daily";
  const score = gameStatus === "won" ? `${guessResults.length}/${maxGuesses}` : `X/${maxGuesses}`;
  const title = `Daily Hidden Word #${puzzleNumber}`;
  const subtitle = gameStatus === "won" ? "Locked in." : "Result logged.";
  const caption = dailyStreak > 0 ? `${dailyStreak}-day streak active` : "New streak starts here";
  const label = `PuzzleWarz ${title} ${score}`;

  const tileGap = wordLength >= 8 ? 12 : 16;
  const tileSize = Math.min(
    104,
    Math.max(64, Math.floor((DAILY_HIDDENWORD_SNAPSHOT_WIDTH - 240 - (wordLength - 1) * tileGap) / wordLength))
  );
  const rowGap = 16;
  const boardWidth = wordLength * tileSize + (wordLength - 1) * tileGap;
  const boardHeight = maxGuesses * tileSize + (maxGuesses - 1) * rowGap;
  const boardX = Math.round((DAILY_HIDDENWORD_SNAPSHOT_WIDTH - boardWidth) / 2);
  const boardY = 410;
  const boardBottom = boardY + boardHeight;
  const comparisonPanelGap = 36;
  const comparisonPanelY = boardBottom + comparisonPanelGap;
  const comparisonPanelHeight = comparison ? 182 : 136;
  const footerTextY = comparisonPanelY + comparisonPanelHeight + (comparison ? 36 : 30);
  const svgHeight = Math.max(DAILY_HIDDENWORD_SNAPSHOT_HEIGHT, footerTextY + 40);
  const topPercent = comparison
    ? Math.max(1, Math.round((comparison.rank / comparison.totalSolvers) * 100))
    : null;

  const rowsMarkup = Array.from({ length: maxGuesses }, (_, rowIndex) => {
    const guess = guessResults[rowIndex];
    return Array.from({ length: wordLength }, (_, colIndex) => {
      const result = guess?.[colIndex];
      const kind: HiddenWordLetterStatus | "empty" = result ? result.status : "empty";
      const x = boardX + colIndex * (tileSize + tileGap);
      const y = boardY + rowIndex * (tileSize + rowGap);
      const shadowOpacity = kind === "empty" ? "0" : "0.45";
      return `
        <g>
          <rect x="${x}" y="${y}" width="${tileSize}" height="${tileSize}" rx="24" fill="${TILE_FILL[kind]}" stroke="${TILE_STROKE[kind]}" stroke-width="4" />
          <rect x="${x + 4}" y="${y + 4}" width="${tileSize - 8}" height="${tileSize - 8}" rx="20" fill="url(#tileGloss)" opacity="${shadowOpacity}" />
        </g>`;
    }).join("");
  }).join("");

  const scoreBoxWidth = 230;
  const scoreBoxX = Math.round((DAILY_HIDDENWORD_SNAPSHOT_WIDTH - scoreBoxWidth) / 2);
  const comparisonMarkup = comparison
    ? `
  <rect x="96" y="${comparisonPanelY}" width="888" height="${comparisonPanelHeight}" rx="36" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.08)" stroke-width="3" />
  <text x="144" y="${comparisonPanelY + 38}" fill="#38D399" font-size="22" font-family="Arial, Helvetica, sans-serif" font-weight="800">🔥 ${escapeXml(caption)}</text>
  <text x="144" y="${comparisonPanelY + 82}" fill="#FFFFFF" font-size="34" font-family="Arial, Helvetica, sans-serif" font-weight="900">Rank #${comparison.rank} of ${comparison.totalSolvers}</text>
  <text x="936" y="${comparisonPanelY + 82}" fill="#FDE74C" font-size="30" font-family="Arial, Helvetica, sans-serif" font-weight="900" text-anchor="end">${comparison.totalSolvers === 1 ? "First clear" : `Top ${topPercent}%`}</text>

  <rect x="144" y="${comparisonPanelY + 102}" width="212" height="70" rx="22" fill="rgba(56,211,153,0.08)" stroke="rgba(56,211,153,0.25)" stroke-width="2" />
  <text x="250" y="${comparisonPanelY + 129}" fill="#9BD6E4" font-size="17" font-family="Arial, Helvetica, sans-serif" font-weight="700" text-anchor="middle">USED MORE GUESSES</text>
  <text x="250" y="${comparisonPanelY + 160}" fill="#38D399" font-size="30" font-family="Arial, Helvetica, sans-serif" font-weight="900" text-anchor="middle">${comparison.higherGuessCount}</text>

  <rect x="434" y="${comparisonPanelY + 102}" width="212" height="70" rx="22" fill="rgba(253,231,76,0.08)" stroke="rgba(253,231,76,0.25)" stroke-width="2" />
  <text x="540" y="${comparisonPanelY + 129}" fill="#F5E39B" font-size="17" font-family="Arial, Helvetica, sans-serif" font-weight="700" text-anchor="middle">SAME GUESS BAND</text>
  <text x="540" y="${comparisonPanelY + 160}" fill="#FDE74C" font-size="30" font-family="Arial, Helvetica, sans-serif" font-weight="900" text-anchor="middle">${comparison.sameGuessCount}</text>

  <rect x="724" y="${comparisonPanelY + 102}" width="212" height="70" rx="22" fill="rgba(56,145,166,0.12)" stroke="rgba(56,145,166,0.28)" stroke-width="2" />
  <text x="830" y="${comparisonPanelY + 129}" fill="#9BD6E4" font-size="17" font-family="Arial, Helvetica, sans-serif" font-weight="700" text-anchor="middle">USED FEWER GUESSES</text>
  <text x="830" y="${comparisonPanelY + 160}" fill="#9BD6E4" font-size="30" font-family="Arial, Helvetica, sans-serif" font-weight="900" text-anchor="middle">${comparison.lowerGuessCount}</text>

  <text x="540" y="${comparisonPanelY + 198}" fill="#D1D5DB" font-size="22" font-family="Arial, Helvetica, sans-serif" text-anchor="middle">${comparison.totalSolvers === 1 ? "You are the first recorded solve today." : `Beat ${comparison.beatPercent}% of today's solvers · Avg clear ${formatGuessAverage(comparison.averageGuesses)} guesses`}</text>`
    : `
  <rect x="96" y="${comparisonPanelY}" width="888" height="136" rx="36" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.08)" stroke-width="3" />
  <text x="144" y="${comparisonPanelY + 58}" fill="#38D399" font-size="28" font-family="Arial, Helvetica, sans-serif" font-weight="800">🔥 ${escapeXml(caption)}</text>
  <text x="144" y="${comparisonPanelY + 102}" fill="#D1D5DB" font-size="26" font-family="Arial, Helvetica, sans-serif">Share the result. Keep the word hidden.</text>`;

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${DAILY_HIDDENWORD_SNAPSHOT_WIDTH}" height="${svgHeight}" viewBox="0 0 ${DAILY_HIDDENWORD_SNAPSHOT_WIDTH} ${svgHeight}" role="img" aria-label="${escapeXml(label)}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#041013" />
      <stop offset="55%" stop-color="#081A22" />
      <stop offset="100%" stop-color="#020202" />
    </linearGradient>
    <linearGradient id="hero" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#38D399" />
      <stop offset="100%" stop-color="#FDE74C" />
    </linearGradient>
    <linearGradient id="tileGloss" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.18" />
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0" />
    </linearGradient>
    <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="28" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>

  <rect width="${DAILY_HIDDENWORD_SNAPSHOT_WIDTH}" height="${svgHeight}" rx="72" fill="url(#bg)" />
  <circle cx="170" cy="160" r="180" fill="#38D399" opacity="0.08" filter="url(#glow)" />
  <circle cx="930" cy="220" r="150" fill="#FDE74C" opacity="0.08" filter="url(#glow)" />
  <circle cx="920" cy="1110" r="210" fill="#3891A6" opacity="0.1" filter="url(#glow)" />

  <text x="96" y="118" fill="#9BD6E4" font-size="28" font-family="Arial, Helvetica, sans-serif" font-weight="700" letter-spacing="8">PUZZLEWARZ DAILY</text>
  <text x="96" y="200" fill="#FFFFFF" font-size="76" font-family="Arial, Helvetica, sans-serif" font-weight="900">${escapeXml(title)}</text>
  <text x="96" y="258" fill="#D1D5DB" font-size="34" font-family="Arial, Helvetica, sans-serif">${escapeXml(subtitle)}</text>

  <rect x="${scoreBoxX}" y="300" width="${scoreBoxWidth}" height="84" rx="42" fill="#0E2430" stroke="rgba(255,255,255,0.12)" stroke-width="3" />
  <text x="${DAILY_HIDDENWORD_SNAPSHOT_WIDTH / 2}" y="354" fill="url(#hero)" font-size="44" font-family="Arial, Helvetica, sans-serif" font-weight="900" text-anchor="middle">${escapeXml(score)}</text>

  ${rowsMarkup}
  ${comparisonMarkup}

  <text x="${DAILY_HIDDENWORD_SNAPSHOT_WIDTH / 2}" y="${footerTextY}" fill="#8FA9B2" font-size="24" font-family="Arial, Helvetica, sans-serif" text-anchor="middle">${escapeXml(footerUrl)}</text>
</svg>`.trim();
}