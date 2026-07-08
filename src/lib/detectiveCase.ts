export type DetectiveCaseStage = {
  id: string;
  title: string;
  prompt: string;
  /**
   * For MVP we only support text entry stages.
   * Future: hotspot, timeline, logic-grid, etc.
   */
  kind?: 'text';
  expectedAnswer: string | string[];
  ignoreCase?: boolean;
  ignoreWhitespace?: boolean;
};

export type DetectiveCasePrologue = {
  /** The detective's opening monologue — how the case landed in their lap. */
  text: string;
  /** Detective character name shown on the prologue screen, e.g. "Det. Ray Voss" */
  narratorName?: string;
  /** Voice style for future TTS / flavor, e.g. "gravel", "weary", "sharp" */
  narratorVoice?: string;
  /** Background image URL (/uploads/… or CDN). Shown dimmed behind the text. */
  backgroundImage?: string;
  /** Background video URL (/uploads/… or CDN). Plays muted/looped behind the text. Takes priority over backgroundImage. */
  backgroundVideo?: string;
  /** Narration or ambience audio URL (/uploads/… or CDN). Player controls playback. */
  audio?: string;
  /** Whether the audio track loops. Default false. */
  audioLoop?: boolean;
};

export type DetectiveCaseData = {
  noirTitle?: string;
  intro?: string;
  lockMode?: 'fail_once';
  prologue?: DetectiveCasePrologue;
  stages: DetectiveCaseStage[];
};

export function getDetectiveCaseData(puzzleData: unknown): DetectiveCaseData | null {
  if (!puzzleData || typeof puzzleData !== 'object') return null;
  const root = puzzleData as Record<string, unknown>;
  const dc = root.detectiveCase;
  if (!dc || typeof dc !== 'object') return null;

  const maybe = dc as Record<string, unknown>;
  const stages = maybe.stages;
  if (!Array.isArray(stages) || stages.length === 0) return null;

  const parsedStages: DetectiveCaseStage[] = [];
  for (const s of stages) {
    if (!s || typeof s !== 'object') return null;
    const st = s as Record<string, unknown>;
    const id = typeof st.id === 'string' ? st.id : '';
    const title = typeof st.title === 'string' ? st.title : '';
    const prompt = typeof st.prompt === 'string' ? st.prompt : '';
    const expectedAnswer = st.expectedAnswer as DetectiveCaseStage['expectedAnswer'];

    if (!id || !title || !prompt) return null;
    if (!(typeof expectedAnswer === 'string' || (Array.isArray(expectedAnswer) && expectedAnswer.every((x) => typeof x === 'string')))) {
      return null;
    }

    parsedStages.push({
      id,
      title,
      prompt,
      kind: st.kind === 'text' ? 'text' : 'text',
      expectedAnswer,
      ignoreCase: typeof st.ignoreCase === 'boolean' ? st.ignoreCase : true,
      ignoreWhitespace: typeof st.ignoreWhitespace === 'boolean' ? st.ignoreWhitespace : true,
    });
  }

  let prologue: DetectiveCasePrologue | undefined;
  if (maybe.prologue && typeof maybe.prologue === 'object') {
    const p = maybe.prologue as Record<string, unknown>;
    if (typeof p.text === 'string' && p.text.trim()) {
      prologue = {
        text: p.text,
        narratorName: typeof p.narratorName === 'string' ? p.narratorName : undefined,
        narratorVoice: typeof p.narratorVoice === 'string' ? p.narratorVoice : undefined,
        backgroundImage: typeof p.backgroundImage === 'string' ? p.backgroundImage : undefined,
        backgroundVideo: typeof p.backgroundVideo === 'string' ? p.backgroundVideo : undefined,
        audio: typeof p.audio === 'string' ? p.audio : undefined,
        audioLoop: typeof p.audioLoop === 'boolean' ? p.audioLoop : false,
      };
    }
  }

  return {
    noirTitle: typeof maybe.noirTitle === 'string' ? maybe.noirTitle : undefined,
    intro: typeof maybe.intro === 'string' ? maybe.intro : undefined,
    lockMode: maybe.lockMode === 'fail_once' ? 'fail_once' : 'fail_once',
    prologue,
    stages: parsedStages,
  };
}

export function normalizeAnswer(value: string, opts?: { ignoreCase?: boolean; ignoreWhitespace?: boolean }) {
  const ignoreCase = opts?.ignoreCase !== false;
  const ignoreWhitespace = opts?.ignoreWhitespace !== false;
  let out = (value ?? '').toString();
  out = out.trim();
  if (ignoreWhitespace) out = out.replace(/\s+/g, '');
  if (ignoreCase) out = out.toLowerCase();
  return out;
}

export function isDetectiveCaseAnswerCorrect(stage: DetectiveCaseStage, answer: string) {
  const normalized = normalizeAnswer(answer, {
    ignoreCase: stage.ignoreCase,
    ignoreWhitespace: stage.ignoreWhitespace,
  });

  const expectedList = Array.isArray(stage.expectedAnswer) ? stage.expectedAnswer : [stage.expectedAnswer];
  const normalizedExpected = expectedList.map((x) => normalizeAnswer(x, { ignoreCase: stage.ignoreCase, ignoreWhitespace: stage.ignoreWhitespace }));
  return normalizedExpected.includes(normalized);
}

export function sanitizeStageForClient(stage: DetectiveCaseStage) {
  return {
    id: stage.id,
    title: stage.title,
    prompt: stage.prompt,
    kind: stage.kind ?? 'text',
  };
}
