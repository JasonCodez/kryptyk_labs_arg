/** @jest-environment jsdom */

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import AnagramBlitz, {
  type AnagramBlitzHandle,
  type AnagramPresentationState,
} from "./AnagramBlitz";
import { normalizeAnagramConfig } from "@/lib/anagramConfig";

jest.mock("next/dynamic", () => () => () => null);
jest.mock("framer-motion", () => ({ useReducedMotion: () => false }));
jest.mock("@/components/juice/Pressable", () => function PressableMock({
  children,
  cue,
  noLift,
  ripple,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { cue?: unknown; noLift?: boolean; ripple?: unknown }) {
  void cue;
  void noLift;
  void ripple;
  return <button {...props}>{children}</button>;
});
jest.mock("@/components/juice/particles", () => ({ confettiBurstAt: jest.fn() }));
jest.mock("@/lib/juice", () => ({
  juice: {
    tap: jest.fn(),
    tick: jest.fn(),
    pop: jest.fn(),
    whoosh: jest.fn(),
    success: jest.fn(),
    error: jest.fn(),
    unlock: jest.fn(),
    reward: jest.fn(),
  },
  prefersReducedMotion: () => false,
}));
jest.mock("@/hooks/usePuzzleSkin", () => ({
  usePuzzleSkin: () => ({
    _key: "default",
    boardBg: "#0f1219",
    boardBorder: "#334155",
    boardRadius: "16px",
    tileBg: "#1e293b",
    tileBorder: "#6366f1",
    tileText: "#fff",
    inputBg: "#0f172a",
    inputBorder: "#64748b",
    btnBg: "#fde74c",
    btnText: "#020202",
    backdropScrim: "transparent",
  }),
}));

const DEFAULT_DATA = { words: ["CAT", "DOG"], timeLimit: 60, hint: "Animals" };

function renderGame({
  words = DEFAULT_DATA.words,
  timeLimit = 60,
  displayMode = "app-shell" as const,
  onSolved,
  onFailed,
  onPresentationChange,
  ref,
}: {
  words?: string[];
  timeLimit?: number;
  displayMode?: "app-shell" | "standalone";
  onSolved?: (elapsed: number) => void;
  onFailed?: React.ComponentProps<typeof AnagramBlitz>["onFailed"];
  onPresentationChange?: (state: AnagramPresentationState) => void;
  ref?: React.Ref<AnagramBlitzHandle>;
} = {}) {
  return render(
    <AnagramBlitz
      ref={ref}
      puzzleId="anagram-test"
      anagramData={{ words, timeLimit, hint: "Animals" }}
      displayMode={displayMode}
      onSolved={onSolved}
      onFailed={onFailed}
      onPresentationChange={onPresentationChange}
    />
  );
}

function startGame() {
  fireEvent.click(screen.getByRole("button", { name: "Start" }));
}

function surface() {
  return screen.getByTestId("anagram-game-surface");
}

function typeAnswer(answer: string) {
  for (const letter of answer) fireEvent.keyDown(surface(), { key: letter });
}

function submitWithKeyboard() {
  fireEvent.keyDown(surface(), { key: "Enter" });
}

function filledSlots() {
  return Array.from(screen.getByTestId("anagram-answer-slots").querySelectorAll<HTMLElement>('[data-filled="true"]'));
}

describe("AnagramBlitz tile game", () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: new Date("2026-01-01T00:00:00.000Z") });
    Object.defineProperty(window, "requestAnimationFrame", {
      configurable: true,
      value: (callback: FrameRequestCallback) => { callback(0); return 1; },
    });
    Object.defineProperty(window, "cancelAnimationFrame", { configurable: true, value: jest.fn() });
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: jest.fn((query: string) => ({
        matches: query.includes("pointer: coarse") || query.includes("max-width"),
        media: query,
        onchange: null,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        addListener: jest.fn(),
        removeListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });
    global.fetch = jest.fn();
  });

  afterEach(() => {
    cleanup();
    jest.useRealTimers();
  });

  test("normalizes invalid time limits and non-playable words", () => {
    expect(normalizeAnagramConfig({
      timeLimit: Number.POSITIVE_INFINITY,
      words: ["  co-op  ", "123", "", null, "résumé", "A-B"],
    })).toEqual({
      timeLimitSeconds: 60,
      words: ["COOP", "RSUM", "AB"],
    });
    expect(normalizeAnagramConfig({ timeLimit: "45", words: ["cat"] }).timeLimitSeconds).toBe(45);
  });

  test("repeated letters receive distinct stable tile IDs", () => {
    renderGame({ words: ["LETTER"] });
    startGame();
    const repeated = Array.from(screen.getByTestId("anagram-letter-tray").querySelectorAll<HTMLElement>('[data-letter="T"]'));
    expect(repeated).toHaveLength(2);
    expect(repeated[0].dataset.tileId).not.toBe(repeated[1].dataset.tileId);
  });

  test("repeated words track as independent entries", () => {
    const changes: AnagramPresentationState[] = [];
    renderGame({ words: ["CAT", "CAT"], onPresentationChange: (state) => changes.push(state) });
    startGame();
    typeAnswer("CAT");
    submitWithKeyboard();
    act(() => jest.advanceTimersByTime(500));
    expect(screen.getByTestId("anagram-current-entry").dataset.entryId).toBe("anagram-test-word-1");
    expect(changes.at(-1)?.solvedCount).toBe(1);
  });

  test("presentation timer updates are limited to visible header-second changes", () => {
    const onPresentationChange = jest.fn();
    renderGame({ timeLimit: 30, onPresentationChange });
    startGame();
    onPresentationChange.mockClear();

    for (let tick = 0; tick < 100; tick += 1) {
      act(() => jest.advanceTimersByTime(100));
    }

    expect(onPresentationChange.mock.calls.length).toBeGreaterThanOrEqual(9);
    expect(onPresentationChange.mock.calls.length).toBeLessThanOrEqual(11);
  });

  test("tapping a tray tile fills the next answer slot", () => {
    renderGame();
    startGame();
    const tile = screen.getByTestId("anagram-letter-tray").querySelector<HTMLElement>("[data-tile-id]")!;
    fireEvent.click(tile);
    expect(filledSlots()).toHaveLength(1);
    expect(filledSlots()[0].dataset.tileId).toBe(tile.dataset.tileId);
  });

  test("exposes grouped tile collections and formatted timer text", () => {
    renderGame();
    startGame();
    expect(screen.getByRole("group", { name: "Scrambled letter tray" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Anagram answer" })).toBeTruthy();
    expect(screen.getByRole("progressbar", { name: "Blitz time remaining" }).getAttribute("aria-valuetext")).toBe("1:00 remaining");
  });

  test("tapping an answer tile returns it to the tray", () => {
    renderGame();
    startGame();
    const tile = screen.getByTestId("anagram-letter-tray").querySelector<HTMLElement>("[data-tile-id]")!;
    fireEvent.click(tile);
    fireEvent.click(filledSlots()[0]);
    expect(filledSlots()).toHaveLength(0);
    expect(tile.dataset.used).toBeUndefined();
  });

  test("a hardware letter selects one unused matching tile", () => {
    renderGame({ words: ["LETTER"] });
    startGame();
    fireEvent.keyDown(surface(), { key: "T" });
    fireEvent.keyDown(surface(), { key: "T" });
    expect(filledSlots()).toHaveLength(2);
    expect(filledSlots()[0].dataset.tileId).not.toBe(filledSlots()[1].dataset.tileId);
  });

  test("Backspace removes exactly one placed tile", () => {
    renderGame();
    startGame();
    typeAnswer("CA");
    fireEvent.keyDown(surface(), { key: "Backspace" });
    expect(filledSlots()).toHaveLength(1);
    expect(filledSlots()[0].dataset.letter).toBe("C");
  });

  test("one hardware key press performs one action", () => {
    renderGame();
    startGame();
    fireEvent.keyDown(surface(), { key: "C" });
    expect(filledSlots()).toHaveLength(1);
    expect(filledSlots()[0].dataset.letter).toBe("C");
  });

  test("Pass rotates the current entry to the back of the queue", () => {
    renderGame();
    startGame();
    expect(screen.getByTestId("anagram-current-entry").dataset.entryId).toBe("anagram-test-word-0");
    fireEvent.click(screen.getByRole("button", { name: "Pass" }));
    expect(screen.getByTestId("anagram-current-entry").dataset.entryId).toBe("anagram-test-word-1");
  });

  test("Shuffle changes order while preserving tile membership", () => {
    renderGame({ words: ["PLANET"] });
    startGame();
    const tray = screen.getByTestId("anagram-letter-tray");
    const ids = () => Array.from(tray.querySelectorAll<HTMLElement>("[data-tile-id]")).map((tile) => tile.dataset.tileId!);
    const before = ids();
    fireEvent.click(screen.getByRole("button", { name: "Shuffle" }));
    const after = ids();
    expect(new Set(after)).toEqual(new Set(before));
    expect(after).not.toEqual(before);
  });

  test("a correct answer advances to the next entry", () => {
    renderGame();
    startGame();
    typeAnswer("CAT");
    submitWithKeyboard();
    act(() => jest.advanceTimersByTime(500));
    expect(screen.getByTestId("anagram-current-entry").dataset.entryId).toBe("anagram-test-word-1");
  });

  test("a wrong answer stays on the current entry and preserves tiles", () => {
    renderGame();
    startGame();
    typeAnswer("ACT");
    submitWithKeyboard();
    act(() => jest.advanceTimersByTime(400));
    expect(screen.getByTestId("anagram-current-entry").dataset.entryId).toBe("anagram-test-word-0");
    expect(filledSlots().map((slot) => slot.dataset.letter).join("")).toBe("ACT");
  });

  test("completion callback fires immediately, survives cleanup, and remains exactly once", () => {
    const onSolved = jest.fn();
    const game = renderGame({ words: ["CAT"], onSolved });
    startGame();
    typeAnswer("CAT");
    submitWithKeyboard();
    expect(onSolved).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(surface(), { key: "Enter" });
    expect(onSolved).toHaveBeenCalledTimes(1);
    game.unmount();
    act(() => jest.advanceTimersByTime(2000));
    expect(onSolved).toHaveBeenCalledTimes(1);
    expect(onSolved).toHaveBeenCalledWith(expect.any(Number));
  });

  test("component never posts general attempt_success completion", () => {
    renderGame({ words: ["CAT"] });
    startGame();
    typeAnswer("CAT");
    submitWithKeyboard();
    act(() => jest.advanceTimersByTime(1000));
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("wall-clock deadline expires after simulated background time", () => {
    const onFailed = jest.fn();
    renderGame({ words: ["CAT"], timeLimit: 10, onFailed });
    startGame();
    jest.setSystemTime(new Date("2026-01-01T00:00:15.000Z"));
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(screen.getByRole("heading", { name: "0 / 1 solved" })).toBeTruthy();
    expect(onFailed).toHaveBeenCalledTimes(1);
    expect(onFailed.mock.calls[0][0].missedAnswers).toEqual(["CAT"]);
  });

  test("reset clears queue, tiles, timer, status, and callback guards", () => {
    const ref = createRef<AnagramBlitzHandle>();
    const changes: AnagramPresentationState[] = [];
    renderGame({ ref, onPresentationChange: (state) => changes.push(state) });
    startGame();
    typeAnswer("CA");
    act(() => ref.current?.resetGame());
    expect(screen.getByRole("button", { name: "Start" })).toBeTruthy();
    expect(changes.at(-1)).toMatchObject({ status: "ready", solvedCount: 0, totalWords: 2, timeLeftMs: 60_000 });
  });

  test("app-shell removes the internal header while standalone keeps compact controls", () => {
    const appShell = renderGame({ displayMode: "app-shell" });
    expect(screen.queryByRole("heading", { name: "Anagram Blitz" })).toBeNull();
    appShell.unmount();
    renderGame({ displayMode: "standalone" });
    expect(screen.getByRole("heading", { name: "Anagram Blitz" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Help" })).toBeTruthy();
  });
});
