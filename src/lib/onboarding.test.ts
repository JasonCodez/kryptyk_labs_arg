/**
 * Runs in Jest's default node environment: `window` does not exist unless a
 * test installs the mock below, which doubles as the server-safety harness.
 */
import {
  ONBOARDING_STEP_ORDER,
  completeOnboarding,
  completeOnboardingStep,
  createInitialOnboardingState,
  getOnboardingStorageKey,
  isOnboardingStepComplete,
  loadOnboardingState,
  pauseOnboarding,
  resetOnboarding,
  saveOnboardingState,
  skipOnboarding,
  startOnboarding,
} from "./onboarding";

type GlobalWithWindow = { window?: { localStorage: Storage } };
const g = globalThis as unknown as GlobalWithWindow;

function createMockStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
    key: (index: number) => [...store.keys()][index] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
}

const USER = "user-123";
const KEY = getOnboardingStorageKey(USER);

beforeEach(() => {
  g.window = { localStorage: createMockStorage() };
});

afterEach(() => {
  delete g.window;
});

describe("createInitialOnboardingState", () => {
  it("returns a clean not-started state", () => {
    const state = createInitialOnboardingState();
    expect(state).toMatchObject({
      version: 1,
      status: "not_started",
      currentStep: "welcome",
      completedSteps: [],
      dismissedTips: [],
      startedAt: null,
      completedAt: null,
    });
    expect(Date.parse(state.updatedAt)).not.toBeNaN();
  });
});

describe("getOnboardingStorageKey", () => {
  it("is user-specific and versioned", () => {
    expect(getOnboardingStorageKey("abc")).toBe("pw_onboarding_v1_abc");
    expect(getOnboardingStorageKey("a")).not.toBe(getOnboardingStorageKey("b"));
  });

  it("keeps two users' states independent", () => {
    startOnboarding("user-a");
    expect(loadOnboardingState("user-a").status).toBe("active");
    expect(loadOnboardingState("user-b").status).toBe("not_started");
  });
});

describe("loadOnboardingState", () => {
  it("returns initial state when nothing is stored", () => {
    expect(loadOnboardingState(USER).status).toBe("not_started");
  });

  it("round-trips a saved state", () => {
    const state = { ...createInitialOnboardingState(), status: "paused" as const };
    saveOnboardingState(USER, state);
    expect(loadOnboardingState(USER)).toEqual(state);
  });

  it("falls back to initial state on malformed JSON", () => {
    g.window!.localStorage.setItem(KEY, "{not json!");
    expect(loadOnboardingState(USER).status).toBe("not_started");
  });

  it("falls back to initial state on valid JSON with a bad shape", () => {
    g.window!.localStorage.setItem(KEY, JSON.stringify({ status: "active" }));
    expect(loadOnboardingState(USER).status).toBe("not_started");

    const badStep = { ...createInitialOnboardingState(), currentStep: "hacked" };
    g.window!.localStorage.setItem(KEY, JSON.stringify(badStep));
    expect(loadOnboardingState(USER).currentStep).toBe("welcome");
  });

  it("falls back to initial state on a different version", () => {
    const future = { ...createInitialOnboardingState(), version: 2, status: "completed" };
    g.window!.localStorage.setItem(KEY, JSON.stringify(future));
    expect(loadOnboardingState(USER).status).toBe("not_started");
  });
});

describe("startOnboarding", () => {
  it("activates and stamps startedAt", () => {
    const state = startOnboarding(USER);
    expect(state.status).toBe("active");
    expect(state.startedAt).not.toBeNull();
    expect(loadOnboardingState(USER).status).toBe("active");
  });

  it("does not overwrite an existing startedAt", () => {
    const first = startOnboarding(USER);
    pauseOnboarding(USER);
    const again = startOnboarding(USER);
    expect(again.startedAt).toBe(first.startedAt);
    expect(again.status).toBe("active");
  });
});

describe("completeOnboardingStep", () => {
  it("records the step and advances currentStep to the next incomplete step", () => {
    startOnboarding(USER);
    const state = completeOnboardingStep(USER, "welcome");
    expect(state.completedSteps).toEqual(["welcome"]);
    expect(state.currentStep).toBe("first_puzzle_started");
  });

  it("updates updatedAt", () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-07-18T10:00:00.000Z"));
    startOnboarding(USER);
    jest.setSystemTime(new Date("2026-07-18T10:05:00.000Z"));
    const state = completeOnboardingStep(USER, "welcome");
    expect(state.updatedAt).toBe("2026-07-18T10:05:00.000Z");
    jest.useRealTimers();
  });

  it("never adds the same completed step twice", () => {
    startOnboarding(USER);
    completeOnboardingStep(USER, "welcome");
    const state = completeOnboardingStep(USER, "welcome");
    expect(state.completedSteps).toEqual(["welcome"]);
  });

  it("skips already-completed steps when advancing", () => {
    startOnboarding(USER);
    completeOnboardingStep(USER, "first_puzzle_started");
    const state = completeOnboardingStep(USER, "welcome");
    expect(state.currentStep).toBe("first_puzzle_completed");
  });

  it("marks onboarding completed after the final step", () => {
    startOnboarding(USER);
    let state = createInitialOnboardingState();
    for (const step of ONBOARDING_STEP_ORDER) {
      state = completeOnboardingStep(USER, step);
    }
    expect(state.status).toBe("completed");
    expect(state.completedAt).not.toBeNull();
    expect(state.completedSteps).toEqual([...ONBOARDING_STEP_ORDER]);
    expect(state.currentStep).toBe("leaderboard_introduced");
  });
});

describe("pauseOnboarding", () => {
  it("pauses an active onboarding", () => {
    startOnboarding(USER);
    expect(pauseOnboarding(USER).status).toBe("paused");
  });

  it("does not pause a completed or skipped onboarding", () => {
    completeOnboarding(USER);
    expect(pauseOnboarding(USER).status).toBe("completed");
  });
});

describe("skipOnboarding", () => {
  it("marks onboarding skipped and persists it", () => {
    startOnboarding(USER);
    expect(skipOnboarding(USER).status).toBe("skipped");
    expect(loadOnboardingState(USER).status).toBe("skipped");
  });
});

describe("completeOnboarding", () => {
  it("marks onboarding completed with a completion timestamp", () => {
    startOnboarding(USER);
    const state = completeOnboarding(USER);
    expect(state.status).toBe("completed");
    expect(state.completedAt).not.toBeNull();
  });
});

describe("resetOnboarding", () => {
  it("clears stored state and returns a fresh one", () => {
    startOnboarding(USER);
    completeOnboardingStep(USER, "welcome");
    const state = resetOnboarding(USER);
    expect(state.status).toBe("not_started");
    expect(state.completedSteps).toEqual([]);
    expect(g.window!.localStorage.getItem(KEY)).toBeNull();
    expect(loadOnboardingState(USER).status).toBe("not_started");
  });
});

describe("isOnboardingStepComplete", () => {
  it("reflects completedSteps membership", () => {
    startOnboarding(USER);
    const state = completeOnboardingStep(USER, "welcome");
    expect(isOnboardingStepComplete(state, "welcome")).toBe(true);
    expect(isOnboardingStepComplete(state, "daily_introduced")).toBe(false);
  });
});

describe("server-side safety (no window)", () => {
  beforeEach(() => {
    delete g.window;
  });

  it("loads an initial state without touching storage", () => {
    expect(loadOnboardingState(USER).status).toBe("not_started");
  });

  it("save, mutations, and reset do not throw and return coherent state", () => {
    expect(() => saveOnboardingState(USER, createInitialOnboardingState())).not.toThrow();
    expect(startOnboarding(USER).status).toBe("active");
    expect(completeOnboardingStep(USER, "welcome").completedSteps).toEqual(["welcome"]);
    expect(pauseOnboarding(USER).status).toBe("paused");
    expect(skipOnboarding(USER).status).toBe("skipped");
    expect(completeOnboarding(USER).status).toBe("completed");
    expect(resetOnboarding(USER).status).toBe("not_started");
  });

  it("treats a throwing localStorage getter as unavailable", () => {
    g.window = {
      get localStorage(): Storage {
        throw new Error("blocked");
      },
    } as unknown as { localStorage: Storage };
    expect(loadOnboardingState(USER).status).toBe("not_started");
    expect(() => saveOnboardingState(USER, createInitialOnboardingState())).not.toThrow();
  });
});
