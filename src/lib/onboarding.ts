/**
 * Browser-safe onboarding state model, persisted per user in localStorage.
 *
 * This is intentionally independent of the legacy `pw_welcomed_<userId>` flag
 * used by WelcomeModal — future onboarding UI reads/writes this state instead,
 * and the two can coexist during migration.
 */

export type OnboardingStatus =
  | "not_started"
  | "active"
  | "paused"
  | "completed"
  | "skipped";

export type OnboardingStep =
  | "welcome"
  | "first_puzzle_started"
  | "first_puzzle_completed"
  | "daily_introduced"
  | "library_puzzle_completed"
  | "leaderboard_introduced";

export interface OnboardingState {
  version: 1;
  status: OnboardingStatus;
  currentStep: OnboardingStep;
  completedSteps: OnboardingStep[];
  dismissedTips: string[];
  startedAt: string | null;
  updatedAt: string;
  completedAt: string | null;
}

export const ONBOARDING_VERSION = 1 as const;

/** Canonical step progression, in order. */
export const ONBOARDING_STEP_ORDER: readonly OnboardingStep[] = [
  "welcome",
  "first_puzzle_started",
  "first_puzzle_completed",
  "daily_introduced",
  "library_puzzle_completed",
  "leaderboard_introduced",
];

const STATUSES: readonly OnboardingStatus[] = [
  "not_started",
  "active",
  "paused",
  "completed",
  "skipped",
];

export function getOnboardingStorageKey(userId: string): string {
  return `pw_onboarding_v${ONBOARDING_VERSION}_${userId}`;
}

export function createInitialOnboardingState(): OnboardingState {
  return {
    version: ONBOARDING_VERSION,
    status: "not_started",
    currentStep: "welcome",
    completedSteps: [],
    dismissedTips: [],
    startedAt: null,
    updatedAt: new Date().toISOString(),
    completedAt: null,
  };
}

/** localStorage is unavailable during SSR and can throw in some browsers
 *  (private mode, blocked third-party storage) — treat all of those as absent. */
function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

function isOnboardingStep(value: unknown): value is OnboardingStep {
  return typeof value === "string" && (ONBOARDING_STEP_ORDER as readonly string[]).includes(value);
}

function isNullableIsoString(value: unknown): value is string | null {
  return value === null || (typeof value === "string" && !Number.isNaN(Date.parse(value)));
}

function parseStoredState(raw: string): OnboardingState | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== "object" || data === null) return null;
  const s = data as Record<string, unknown>;

  if (s.version !== ONBOARDING_VERSION) return null;
  if (!STATUSES.includes(s.status as OnboardingStatus)) return null;
  if (!isOnboardingStep(s.currentStep)) return null;
  if (!Array.isArray(s.completedSteps) || !s.completedSteps.every(isOnboardingStep)) return null;
  if (!Array.isArray(s.dismissedTips) || !s.dismissedTips.every((t) => typeof t === "string")) return null;
  if (!isNullableIsoString(s.startedAt)) return null;
  if (typeof s.updatedAt !== "string" || Number.isNaN(Date.parse(s.updatedAt))) return null;
  if (!isNullableIsoString(s.completedAt)) return null;

  return {
    version: ONBOARDING_VERSION,
    status: s.status as OnboardingStatus,
    currentStep: s.currentStep,
    // Defensive de-dupe: stored data may have been hand-edited
    completedSteps: [...new Set(s.completedSteps)],
    dismissedTips: s.dismissedTips as string[],
    startedAt: s.startedAt,
    updatedAt: s.updatedAt,
    completedAt: s.completedAt,
  };
}

export function loadOnboardingState(userId: string): OnboardingState {
  const storage = getStorage();
  if (!storage) return createInitialOnboardingState();
  let raw: string | null;
  try {
    raw = storage.getItem(getOnboardingStorageKey(userId));
  } catch {
    return createInitialOnboardingState();
  }
  if (raw === null) return createInitialOnboardingState();
  return parseStoredState(raw) ?? createInitialOnboardingState();
}

export function saveOnboardingState(userId: string, state: OnboardingState): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(getOnboardingStorageKey(userId), JSON.stringify(state));
  } catch {
    // Quota exceeded or storage blocked — onboarding state is best-effort
  }
}

function update(
  userId: string,
  mutate: (state: OnboardingState) => OnboardingState,
): OnboardingState {
  const next = mutate(loadOnboardingState(userId));
  next.updatedAt = new Date().toISOString();
  saveOnboardingState(userId, next);
  return next;
}

export function startOnboarding(userId: string): OnboardingState {
  return update(userId, (state) => ({
    ...state,
    status: "active",
    startedAt: state.startedAt ?? new Date().toISOString(),
  }));
}

export function completeOnboardingStep(userId: string, step: OnboardingStep): OnboardingState {
  return update(userId, (state) => {
    const completedSteps = state.completedSteps.includes(step)
      ? state.completedSteps
      : [...state.completedSteps, step];
    const nextIncomplete = ONBOARDING_STEP_ORDER.find((s) => !completedSteps.includes(s));
    const allDone = nextIncomplete === undefined;

    // Recording progress implies the flow is running again, but never
    // resurrects a completed/skipped onboarding.
    const status: OnboardingStatus = allDone
      ? "completed"
      : state.status === "completed" || state.status === "skipped"
        ? state.status
        : "active";

    return {
      ...state,
      status,
      completedSteps,
      currentStep: nextIncomplete ?? ONBOARDING_STEP_ORDER[ONBOARDING_STEP_ORDER.length - 1],
      startedAt: state.startedAt ?? new Date().toISOString(),
      completedAt: allDone ? state.completedAt ?? new Date().toISOString() : state.completedAt,
    };
  });
}

export function pauseOnboarding(userId: string): OnboardingState {
  return update(userId, (state) =>
    state.status === "completed" || state.status === "skipped"
      ? state
      : { ...state, status: "paused" },
  );
}

export function skipOnboarding(userId: string): OnboardingState {
  return update(userId, (state) =>
    state.status === "completed" ? state : { ...state, status: "skipped" },
  );
}

export function completeOnboarding(userId: string): OnboardingState {
  return update(userId, (state) => ({
    ...state,
    status: "completed",
    completedAt: state.completedAt ?? new Date().toISOString(),
  }));
}

export function resetOnboarding(userId: string): OnboardingState {
  const storage = getStorage();
  if (storage) {
    try {
      storage.removeItem(getOnboardingStorageKey(userId));
    } catch {
      // Ignore — a fresh state is returned either way
    }
  }
  return createInitialOnboardingState();
}

export function isOnboardingStepComplete(state: OnboardingState, step: OnboardingStep): boolean {
  return state.completedSteps.includes(step);
}
