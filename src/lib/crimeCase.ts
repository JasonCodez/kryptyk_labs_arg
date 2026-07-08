// ─────────────────────────────────────────────────────────────────────────────
// Crime RPG Puzzle — shared types, parser, and solution validator
// Used by:
//   • API routes   src/app/api/puzzles/[id]/crime/state   (state GET)
//   •              src/app/api/puzzles/[id]/crime/submit  (accusation POST)
//   • Component    src/components/puzzle/CrimeCasePuzzle.tsx
// ─────────────────────────────────────────────────────────────────────────────

export type EvidenceType = 'document' | 'photo' | 'chat_log' | 'record' | 'audio_log';

/**
 * A hidden detail inside a piece of evidence.
 * - 'contrast'  – visible only when the player cranks the contrast slider past threshold
 * - 'zoom'      – visible only when the player clicks "Examine closely"
 * - 'combine'   – visible only when this evidence is linked with another specific item
 */
export type HiddenLayer = {
  id: string;
  trigger: 'contrast' | 'zoom' | 'combine';
  revealText: string;
  /** For 'contrast' – the CSS contrast() multiplier at which the text becomes visible (1.0–3.0) */
  filterThreshold?: number;
  /** For 'combine' – the ID of the other evidence item that must be linked */
  combineWithId?: string;
};

export type EvidenceItem = {
  id: string;
  label: string;
  type: EvidenceType;
  /** Short blurb shown on the evidence board card */
  summary: string;
  /** Full content rendered inside the evidence viewer */
  content: string;
  /**
   * Optional image URL for this piece of evidence.
   * - For 'photo' type: this IS the evidence — rendered as the primary display.
   * - For all other types: rendered as an "Attached Photo" section below the text content.
   */
  imageUrl?: string;
  hiddenLayers?: HiddenLayer[];
};

/**
 * A single Q&A revealed during suspect interrogation.
 * isFlaggedAnswer=true causes a red-flag badge on the suspect card once revealed.
 */
export type InterrogationQuestion = {
  id: string;
  question: string;
  answer: string;
  /** If true, this answer surfaces a 🚩 flag on the suspect card */
  isFlaggedAnswer?: boolean;
};

export type SuspectProfile = {
  id: string;
  name: string;
  age: number;
  role: string;
  /** Optional URL (S3 or external) for a headshot photo */
  photoUrl?: string;
  bio: string;
  /** Optional interrogation Q&A for this suspect */
  interrogation?: InterrogationQuestion[];
};

export type TimelineEvent = {
  id: string;
  time: string;
  description: string;
  /** The correct 1-based position in the final sorted timeline */
  correctPosition: number;
};

export type CrimeCaseSolution = {
  principalSuspectId: string;
  /** Must exactly match one of CrimeCaseData.mechanisms */
  mechanism: string;
  /** Exactly the IDs the player must submit as their evidence chain */
  requiredEvidenceIds: string[];
};

// ─── Progression system ───────────────────────────────────────────────────────

export type InvestigationPhase = 'intake' | 'investigation' | 'theory' | 'breakthrough' | 'accusation';

/**
 * An effect that fires when a player action is correct.
 * - 'tab'       → unlocks a tab in the UI
 * - 'evidence'  → makes a piece of evidence visible on the board
 * - 'question'  → unlocks a question in an interrogation
 * - 'timeline'  → makes a timeline event appear
 * - 'phase'     → advances the investigation to the next phase
 * - 'accusation'→ enables the File Accusation button
 */
export type UnlockEffect =
  | { type: 'tab';        id: string }
  | { type: 'evidence';   id: string }
  | { type: 'question';   id: string }
  | { type: 'timeline';   id: string }
  | { type: 'phase';      id: InvestigationPhase }
  | { type: 'accusation' };

/**
 * A contradiction: the player can challenge a flagged suspect statement
 * by presenting specific evidence that disproves it.
 */
export type Contradiction = {
  id: string;
  suspectId: string;
  /** The interrogation question ID whose answer can be challenged */
  questionId: string;
  /** The evidence ID that busts the contradiction */
  challengeEvidenceId: string;
  wrongChallengeMessage: string;
  correctChallengeMessage: string;
  unlocks: UnlockEffect[];
};

/**
 * A clickable hotspot on the crime scene image.
 * Position is given as percentage of image dimensions.
 */
export type SceneHotspot = {
  id: string;
  x: number; // 0–100 % from left
  y: number; // 0–100 % from top
  label: string;
  isRedHerring: boolean;
  revealText: string;
  unlocks?: UnlockEffect[];
};

/**
 * A named slot on the corkboard that the player must assign evidence to.
 * Correct assignment fires unlocks.
 */
export type CorkboardSlot = {
  id: string;
  label: 'motive' | 'opportunity' | 'method' | 'alibi' | 'red-herring';
  correctEvidenceId: string;
  unlocks?: UnlockEffect[];
};

/**
 * A guiding objective card shown in the Objectives panel.
 * completedBy is a list of action IDs (contradiction IDs, hotspot IDs,
 * corkboard slot IDs, or the special string "accusation_unlocked") that
 * mark this objective done.
 */
export type Objective = {
  id: string;
  /** Short description visible to the player e.g. "Examine the victim's laptop" */
  text: string;
  phase: InvestigationPhase;
  /** Action IDs whose completion marks this objective done */
  completedBy: string[];
  /** Optional one-liner shown under the objective text telling the player exactly where/how to act */
  hint?: string;
};

// ─── Evidence unlock gating ───────────────────────────────────────────────────

/**
 * When set, this evidence item is hidden from the player until one of its
 * prerequisite action IDs is triggered (contradiction solved, hotspot found, etc.)
 */
// (Added as optional field on EvidenceItem below via extension in CrimeCaseData)

export type CrimeCaseData = {
  caseTitle: string;
  premise: string;
  /** Optional fictional case-clock countdown in hours */
  caseClockHours?: number;
  evidence: EvidenceItem[];
  suspects: SuspectProfile[];
  /** Selectable mechanism options shown in the accusation panel */
  mechanisms: string[];
  /** Optional timeline reconstruction challenge */
  timeline?: TimelineEvent[];
  /** Optional URL for a crime scene overview image — enables the Scene tab */
  sceneImageUrl?: string;
  solution: CrimeCaseSolution;
  /** Text/content shown to the player after fully solving (retention hook) */
  retentionUnlock?: string;

  // ── Progression layer (all optional — falls back to legacy behavior) ──

  /**
   * Evidence IDs that are visible from the start (Phase 1).
   * If omitted, ALL evidence is shown immediately (legacy behavior).
   */
  starterEvidenceIds?: string[];

  /**
   * Question IDs that are available from the start (Phase 1).
   * If omitted, ALL interrogation questions are available immediately.
   */
  starterQuestionIds?: string[];

  /**
   * Timeline event IDs visible from the start.
   * If omitted, all timeline events are shown.
   */
  starterTimelineIds?: string[];

  /** Tabs visible in Phase 1. If omitted, all tabs are shown. */
  starterTabs?: string[];

  /** Contradiction challenges the player can trigger. */
  contradictions?: Contradiction[];

  /** Hotspots on the crime scene image. */
  hotspots?: SceneHotspot[];

  /** Named corkboard assignment slots. */
  corkboardSlots?: CorkboardSlot[];

  /** Guiding objectives shown in the Objectives panel. */
  objectives?: Objective[];

  /**
   * Minimum number of completed objectives before accusation is unlocked.
   * Ignored when objectives is empty. Defaults to all objectives completed.
   */
  accusationMinObjectives?: number;
};

// ─── Parser ──────────────────────────────────────────────────────────────────

export function getCrimeCaseData(puzzleData: unknown): CrimeCaseData | null {
  if (!puzzleData || typeof puzzleData !== 'object') return null;
  const root = puzzleData as Record<string, unknown>;
  const cc = root.crimeCase;
  if (!cc || typeof cc !== 'object') return null;

  const data = cc as Record<string, unknown>;

  if (
    typeof data.caseTitle !== 'string' ||
    typeof data.premise !== 'string' ||
    !Array.isArray(data.evidence) ||
    !Array.isArray(data.suspects) ||
    !Array.isArray(data.mechanisms) ||
    typeof data.solution !== 'object' ||
    data.solution === null
  ) return null;

  const sol = data.solution as Record<string, unknown>;
  if (
    typeof sol.principalSuspectId !== 'string' ||
    typeof sol.mechanism !== 'string' ||
    !Array.isArray(sol.requiredEvidenceIds)
  ) return null;

  return data as unknown as CrimeCaseData;
}

// ─── Client-safe sanitizer ────────────────────────────────────────────────────

/** Strip the solution before sending case data to the browser. */
export type CrimeCaseClientData = Omit<CrimeCaseData, 'solution'>;

export function sanitizeCrimeCaseForClient(data: CrimeCaseData): CrimeCaseClientData {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { solution: _sol, ...rest } = data;
  return rest;
}

// ─── Solution validator ───────────────────────────────────────────────────────

export type AccusationResult = {
  correct: boolean;
  partialScore: {
    suspect: boolean;
    mechanism: boolean;
    /** How many of the required evidence IDs the player correctly included */
    evidenceMatches: number;
    evidenceRequired: number;
  };
};

export function validateAccusation(
  data: CrimeCaseData,
  opts: {
    suspectId: string;
    mechanism: string;
    evidenceIds: string[];
  }
): AccusationResult {
  const sol = data.solution;

  const suspectCorrect = opts.suspectId === sol.principalSuspectId;
  const mechanismCorrect =
    opts.mechanism.trim().toLowerCase() === sol.mechanism.trim().toLowerCase();

  const submittedSet = new Set(opts.evidenceIds);
  const evidenceMatches = sol.requiredEvidenceIds.filter((id) => submittedSet.has(id)).length;
  const evidenceCorrect = evidenceMatches === sol.requiredEvidenceIds.length;

  return {
    correct: suspectCorrect && mechanismCorrect && evidenceCorrect,
    partialScore: {
      suspect: suspectCorrect,
      mechanism: mechanismCorrect,
      evidenceMatches,
      evidenceRequired: sol.requiredEvidenceIds.length,
    },
  };
}
