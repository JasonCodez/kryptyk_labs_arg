/** @jest-environment jsdom */

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRef } from "react";
import CrosswordPuzzle, {
  type CrosswordPresentationState,
  type CrosswordPuzzleHandle,
} from "./CrosswordPuzzle";
import CrosswordKeyboard from "./crossword/CrosswordKeyboard";

jest.mock("next/dynamic", () => () => () => null);
jest.mock("tegaki", () => ({
  TegakiRenderer: ({ children, className, style }: React.PropsWithChildren<{ className?: string; style?: React.CSSProperties }>) => (
    <span className={className} style={style}>{children}</span>
  ),
}), { virtual: true });
jest.mock("../../../node_modules/tegaki/dist/fonts/caveat/bundle.mjs", () => ({
  __esModule: true,
  default: {},
}));
jest.mock("@/hooks/usePuzzleSkin", () => ({
  usePuzzleSkin: () => ({
    _key: "default",
    tileBg: "#111",
    boardBorder: "#333",
    backdropScrim: "transparent",
  }),
}));

const crosswordData = {
  clues: {
    across: [
      { number: 1, text: "Feline companion", answer: "", length: 3, row: 0, col: 0 },
      { number: 2, text: "Opposite of off", answer: "", length: 3, row: 2, col: 0 },
    ],
    down: [
      { number: 1, text: "Automobile", answer: "", length: 3, row: 0, col: 0 },
    ],
  },
};

class ResizeObserverMock {
  observe() {}
  disconnect() {}
}

function jsonResponse(body: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: async () => body,
  } as Response);
}

function installMatchMedia(reducedMotion = false) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: jest.fn((query: string) => ({
      matches: query.includes("prefers-reduced-motion") ? reducedMotion : query.includes("pointer: coarse") || query.includes("max-width"),
      media: query,
      onchange: null,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
}

function renderPuzzle(props: Partial<React.ComponentProps<typeof CrosswordPuzzle>> = {}) {
  const result = render(
    <CrosswordPuzzle
      puzzleId="crossword-test"
      crosswordData={crosswordData}
      displayMode="app-shell"
      {...props}
    />
  );
  const start = screen.queryByRole("button", { name: /start/i });
  if (start) fireEvent.click(start);
  return result;
}

function firstCell() {
  return screen.getByRole("gridcell", { name: /Row 1, column 1/i });
}

describe("CrosswordPuzzle mobile presentation", () => {
  const originalConsoleError = console.error;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    installMatchMedia();
    Object.defineProperty(global, "ResizeObserver", { configurable: true, value: ResizeObserverMock });
    Object.defineProperty(window, "requestAnimationFrame", {
      configurable: true,
      value: (callback: FrameRequestCallback) => window.setTimeout(() => callback(0), 0),
    });
    Object.defineProperty(window, "cancelAnimationFrame", { configurable: true, value: window.clearTimeout });
    window.localStorage.clear();
    Object.defineProperty(window.HTMLMediaElement.prototype, "play", {
      configurable: true,
      value: jest.fn().mockResolvedValue(undefined),
    });
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation((first?: unknown, ...rest: unknown[]) => {
      const message = [first, ...rest].map(String).join(" ");
      if (message.includes("non-boolean attribute") && (message.includes("jsx") || message.includes("global"))) return;
      originalConsoleError(first, ...rest);
    });
    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST") return jsonResponse({ correct: false, allSolved: false });
      if (init?.method === "PATCH") return jsonResponse({ saved: true });
      return jsonResponse({ solvedClues: [], letters: null, revealedCells: [], allSolved: false });
    }) as jest.Mock;
  });

  afterEach(() => {
    cleanup();
    consoleErrorSpy.mockRestore();
  });

  test("emits presentation changes without exposing answer state", async () => {
    const changes: CrosswordPresentationState[] = [];
    renderPuzzle({ onPresentationChange: (state) => changes.push(state) });

    await waitFor(() => expect(changes.length).toBeGreaterThan(0));
    expect(changes.at(-1)).toMatchObject({ solvedCount: 0, totalClues: 3, gameStatus: "playing", activeClue: null });

    fireEvent.click(firstCell());
    await waitFor(() => expect(changes.at(-1)?.activeClue).toMatchObject({
      direction: "across",
      number: 1,
      clueText: "Feline companion",
    }));
  });

  test("navigates to previous and next clues using the existing clue order", async () => {
    const changes: CrosswordPresentationState[] = [];
    renderPuzzle({ onPresentationChange: (state) => changes.push(state) });
    fireEvent.click(firstCell());

    fireEvent.click(screen.getByRole("button", { name: "Next clue" }));
    await waitFor(() => expect(changes.at(-1)?.activeClue?.direction).toBe("down"));

    fireEvent.click(screen.getByRole("button", { name: "Previous clue" }));
    await waitFor(() => expect(changes.at(-1)?.activeClue).toMatchObject({ direction: "across", number: 1 }));
  });

  test("tapping the same intersection toggles direction", async () => {
    const changes: CrosswordPresentationState[] = [];
    renderPuzzle({ onPresentationChange: (state) => changes.push(state) });
    const cell = firstCell();
    fireEvent.click(cell);
    fireEvent.click(cell);

    await waitFor(() => expect(changes.at(-1)?.activeClue).toMatchObject({ direction: "down", number: 1 }));
  });

  test("custom keyboard enters letters and backspace keeps the existing delete behavior", async () => {
    renderPuzzle();
    fireEvent.click(firstCell());
    fireEvent.click(screen.getByTestId("crossword-key-A"));
    await waitFor(() => expect(firstCell().getAttribute("aria-label")).toContain("letter A"));

    fireEvent.click(firstCell());
    fireEvent.click(screen.getByTestId("crossword-key-backspace"));
    await waitFor(() => expect(firstCell().getAttribute("aria-label")).toContain("empty"));
  });

  test("clue sheet opens through the handle, selects a clue, and closes", async () => {
    const ref = createRef<CrosswordPuzzleHandle>();
    const changes: CrosswordPresentationState[] = [];
    render(
      <CrosswordPuzzle
        ref={ref}
        puzzleId="crossword-sheet"
        crosswordData={crosswordData}
        displayMode="app-shell"
        onPresentationChange={(state) => changes.push(state)}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /start/i }));

    act(() => ref.current?.openClueSheet());
    expect(await screen.findByRole("dialog", { name: "Crossword clues" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /2 Opposite of off/i }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Crossword clues" })).toBeNull());
    expect(changes.at(-1)?.activeClue).toMatchObject({ direction: "across", number: 2 });
  });

  test("a server-confirmed solved word remains locked", async () => {
    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST") return jsonResponse({ correct: true, allSolved: false });
      if (init?.method === "PATCH") return jsonResponse({ saved: true });
      return jsonResponse({ solvedClues: [], letters: null, revealedCells: [], allSolved: false });
    }) as jest.Mock;

    renderPuzzle();
    fireEvent.click(firstCell());
    for (const letter of ["C", "A", "T"]) fireEvent.click(screen.getByTestId(`crossword-key-${letter}`));
    await waitFor(() => expect(firstCell().getAttribute("data-solved")).toBe("true"));

    fireEvent.click(firstCell());
    fireEvent.click(screen.getByTestId("crossword-key-Z"));
    expect(firstCell().getAttribute("aria-label")).toContain("letter C");
  });

  test("app-shell mode removes duplicate title while standalone retains its controls", () => {
    const appShell = renderPuzzle();
    expect(screen.queryByRole("heading", { name: "CROSSWORD" })).toBeNull();
    appShell.unmount();

    renderPuzzle({ displayMode: "standalone" });
    expect(screen.getByRole("heading", { name: "CROSSWORD" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "?" })).toBeTruthy();
  });

  test("custom keyboard exposes reduced-motion mode", () => {
    installMatchMedia(true);
    render(<CrosswordKeyboard onLetter={jest.fn()} onBackspace={jest.fn()} />);
    expect(screen.getByTestId("crossword-keyboard").getAttribute("data-reduced-motion")).toBe("true");
  });
});
