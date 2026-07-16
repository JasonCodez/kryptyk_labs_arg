/** @jest-environment jsdom */

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRef } from "react";
import WordSearchPuzzle, { type WordSearchPresentationState, type WordSearchPuzzleHandle } from "./WordSearchPuzzle";

jest.mock("next/dynamic", () => () => () => null);
jest.mock("framer-motion", () => ({
  motion: { div: ({ children, animate, initial, exit, transition, drag, dragConstraints, dragElastic, onDragEnd, ...props }: React.HTMLAttributes<HTMLDivElement> & Record<string, unknown>) => {
    void animate; void initial; void exit; void transition; void drag; void dragConstraints; void dragElastic; void onDragEnd; return <div {...props}>{children}</div>;
  } },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  useAnimationControls: () => ({ start: jest.fn() }),
  useReducedMotion: () => false,
}));
jest.mock("@/components/puzzle/WordDefinitionModal", () => ({ __esModule: true, default: ({ word, onDismiss }: { word: string; onDismiss: () => void }) => <div role="dialog" aria-label={`${word} definition`}><button onClick={onDismiss}>Close definition</button></div> }));
jest.mock("@/components/juice/Pressable", () => function Pressable({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) { return <button {...props}>{children}</button>; });
jest.mock("@/hooks/usePuzzleSkin", () => ({ usePuzzleSkin: () => ({ _key: "default", backdropScrim: "transparent", boardBorder: "#818cf8" }) }));
jest.mock("@/lib/juice", () => ({ isHapticsEnabled: () => false, prefersReducedMotion: () => false }));

const DATA = {
  grid: [
    ["C", "A", "T", "X", "X"],
    ["X", "X", "O", "X", "X"],
    ["D", "O", "G", "X", "X"],
    ["X", "X", "X", "X", "X"],
    ["X", "X", "X", "X", "X"],
  ],
  words: ["CAT", "DOG", "MISSING"],
};

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", { writable: true, value: () => ({ matches: false, addEventListener: jest.fn(), removeEventListener: jest.fn() }) });
  Object.defineProperty(window, "ResizeObserver", { writable: true, value: class { observe() {} disconnect() {} } });
  Object.defineProperty(global, "ResizeObserver", { writable: true, value: window.ResizeObserver });
  Object.defineProperty(window, "requestAnimationFrame", { writable: true, value: (callback: FrameRequestCallback) => window.setTimeout(() => callback(0), 0) });
  Object.defineProperty(window, "cancelAnimationFrame", { writable: true, value: clearTimeout });
  Object.defineProperty(window, "scrollTo", { writable: true, value: jest.fn() });
});

afterEach(() => { cleanup(); localStorage.clear(); jest.clearAllMocks(); });

function installFetch({ failCompletion = false } = {}) {
  let found: string[] = [];
  const fetchMock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/dictionary/")) return { ok: true, json: async () => ({ found: false }) } as Response;
    if (!init?.method) return { ok: true, json: async () => ({ foundWords: found, allFound: false }) } as Response;
    const body = JSON.parse(String(init.body)) as { word: string };
    found = [...new Set([...found, body.word])];
    return { ok: !failCompletion, json: async () => failCompletion ? ({ error: "Offline" }) : ({ valid: true, allFound: found.length === 2, foundCount: found.length, total: 2 }) } as Response;
  });
  global.fetch = fetchMock;
  return fetchMock;
}

function renderGame(overrides: Partial<React.ComponentProps<typeof WordSearchPuzzle>> = {}) {
  installFetch();
  localStorage.setItem("wordTroveIntroSeen", "1");
  return render(<WordSearchPuzzle puzzleId="word-search-test" wordSearchData={DATA} displayMode="app-shell" dailyMode {...overrides} />);
}

async function keyboardFindCat() {
  const board = screen.getByRole("grid");
  await waitFor(() => expect(screen.getByTestId("word-search-root").getAttribute("data-status")).toBe("playing"));
  fireEvent.keyDown(board, { key: " " });
  fireEvent.keyDown(board, { key: "ArrowRight" });
  fireEvent.keyDown(board, { key: "ArrowRight" });
  fireEvent.keyDown(board, { key: "Enter" });
  await waitFor(() => expect(screen.getByText("1 / 2 found")).toBeTruthy());
}

test("normalizes out unplaceable words and emits guarded presentation state", async () => {
  const callback = jest.fn<void, [WordSearchPresentationState]>();
  const view = renderGame({ onPresentationChange: callback });
  await waitFor(() => expect(callback.mock.calls.at(-1)?.[0].status).toBe("playing"));
  expect(callback.mock.calls.at(-1)?.[0].totalWords).toBe(2);
  const count = callback.mock.calls.length;
  view.rerender(<WordSearchPuzzle puzzleId="word-search-test" wordSearchData={DATA} displayMode="app-shell" dailyMode onPresentationChange={callback} />);
  await act(async () => {});
  expect(callback.mock.calls.length).toBe(count);
});

test("one keyboard submission records one letter-selection action", async () => {
  const fetchMock = installFetch();
  render(<WordSearchPuzzle puzzleId="word-search-test" wordSearchData={DATA} displayMode="app-shell" dailyMode />);
  await keyboardFindCat();
  expect(fetchMock.mock.calls.filter((call) => (call[1] as RequestInit | undefined)?.method === "POST")).toHaveLength(1);
});

test("keyboard arrows extend, Escape cancels, and Tab remains native", () => {
  renderGame();
  const board = screen.getByRole("grid");
  fireEvent.keyDown(board, { key: " " }); fireEvent.keyDown(board, { key: "ArrowRight" });
  expect(screen.getAllByRole("gridcell").filter((cell) => cell.getAttribute("data-selected"))).toHaveLength(2);
  const tab = new KeyboardEvent("keydown", { key: "Tab", cancelable: true }); board.dispatchEvent(tab); expect(tab.defaultPrevented).toBe(false);
  fireEvent.keyDown(board, { key: "Escape" }); expect(screen.getAllByRole("gridcell").filter((cell) => cell.getAttribute("data-selected"))).toHaveLength(0);
});

test("imperative controls open help and the word sheet and restore focus", async () => {
  const ref = createRef<WordSearchPuzzleHandle>(); renderGame({ ref });
  act(() => ref.current?.openInstructions()); expect(screen.getByRole("dialog", { name: "How to play Word Trove" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  act(() => ref.current?.openWordList()); expect(screen.getByRole("dialog", { name: "Words to find" })).toBeTruthy();
  fireEvent.keyDown(window, { key: "Escape" }); await waitFor(() => expect(screen.queryByRole("dialog", { name: "Words to find" })).toBeNull());
});

test("hint is guarded in flight and only consumes a placeable unfound word", async () => {
  let resolveToken!: (value: boolean) => void;
  const onHintUsed = jest.fn(() => new Promise<boolean>((resolve) => { resolveToken = resolve; }));
  renderGame({ hintTokens: 2, onHintUsed });
  const button = screen.getByRole("button", { name: /Hint/ }); fireEvent.click(button); fireEvent.click(button);
  expect(onHintUsed).toHaveBeenCalledTimes(1);
  resolveToken(true);
  await waitFor(() => expect(screen.getByText("1 / 2 found")).toBeTruthy());
});

test("daily completion waits for success and exposes retry without losing the board", async () => {
  const onComplete = jest.fn().mockResolvedValueOnce({ success: false, error: "Offline" }).mockResolvedValueOnce({ success: true });
  renderGame({ dailyMode: true, onComplete, hintTokens: 2, onHintUsed: async () => true });
  fireEvent.click(screen.getByRole("button", { name: /Hint/ })); await waitFor(() => expect(screen.getByText("1 / 2 found")).toBeTruthy());
  fireEvent.click(screen.getByRole("button", { name: /Hint/ }));
  expect(await screen.findByRole("button", { name: "Retry Completion" })).toBeTruthy();
  expect(screen.getByRole("grid")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Retry Completion" }));
  await waitFor(() => expect(screen.getByTestId("word-search-root").getAttribute("data-status")).toBe("won"));
  expect(onComplete).toHaveBeenCalledTimes(2);
});

test("a successful daily completion callback is guarded exactly once", async () => {
  const onComplete = jest.fn(async () => ({ success: true }));
  renderGame({ onComplete, hintTokens: 2, onHintUsed: async () => true });
  fireEvent.click(screen.getByRole("button", { name: /Hint/ })); await waitFor(() => expect(screen.getByText("1 / 2 found")).toBeTruthy());
  fireEvent.click(screen.getByRole("button", { name: /Hint/ })); fireEvent.click(screen.getByRole("button", { name: /Finding|Hint/ }));
  await waitFor(() => expect(screen.getByTestId("word-search-root").getAttribute("data-status")).toBe("won"));
  expect(onComplete).toHaveBeenCalledTimes(1);
});

test("first-run intro is an accessible dismissible dialog", async () => {
  installFetch(); localStorage.removeItem("wordTroveIntroSeen");
  render(<WordSearchPuzzle puzzleId="intro-test" wordSearchData={DATA} dailyMode />);
  expect(await screen.findByRole("dialog", { name: "More than a word search" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Start searching" }));
  expect(screen.queryByRole("dialog", { name: "More than a word search" })).toBeNull();
  expect(localStorage.getItem("wordTroveIntroSeen")).toBe("1");
});

test("app-shell removes duplicate title while standalone keeps compact controls", () => {
  const first = renderGame(); expect(screen.queryByRole("heading", { name: "WORD TROVE" })).toBeNull(); first.unmount();
  renderGame({ displayMode: "standalone" }); expect(screen.getByRole("heading", { name: "WORD TROVE" })).toBeTruthy(); expect(screen.getByRole("button", { name: "Help" })).toBeTruthy();
});

test("stale or malformed restore payload is rejected", async () => {
  localStorage.setItem("word-search:v2:word-search-test", JSON.stringify({ version: 2, signature: "old", foundWords: ["CAT"] }));
  const callback = jest.fn(); renderGame({ onPresentationChange: callback });
  await waitFor(() => expect(callback.mock.calls.at(-1)?.[0].status).toBe("playing"));
  expect(callback.mock.calls.at(-1)?.[0].foundCount).toBe(0);
});
