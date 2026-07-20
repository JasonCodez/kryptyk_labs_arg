/** @jest-environment jsdom */

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
    return { ok: !failCompletion, json: async () => failCompletion ? ({ error: "Offline" }) : ({ valid: true, persisted: true, completionCommitted: found.length === 2, allFound: found.length === 2, foundCount: found.length, total: 2 }) } as Response;
  });
  global.fetch = fetchMock;
  return fetchMock;
}

/** Tracks the latest presentation state via onPresentationChange, chaining any caller-supplied callback. */
function trackPresentation(onChange?: (state: WordSearchPresentationState) => void) {
  let latest: WordSearchPresentationState | undefined;
  const callback = (state: WordSearchPresentationState) => { latest = state; onChange?.(state); };
  return { callback, latest: () => latest };
}

function renderPuzzle(props: React.ComponentProps<typeof WordSearchPuzzle>) {
  const tracker = trackPresentation(props.onPresentationChange);
  const view = render(<WordSearchPuzzle {...props} onPresentationChange={tracker.callback} />);
  return Object.assign(view, { latestPresentation: tracker.latest });
}

function renderGame(overrides: Partial<React.ComponentProps<typeof WordSearchPuzzle>> = {}) {
  installFetch();
  localStorage.setItem("wordTroveIntroSeen", "1");
  return renderPuzzle({ puzzleId: "word-search-test", wordSearchData: DATA, displayMode: "app-shell", dailyMode: true, persistenceScope: "daily", dailyDayNumber: 142, ...overrides });
}

async function waitForFoundCount(view: { latestPresentation: () => WordSearchPresentationState | undefined }, foundCount: number) {
  await waitFor(() => expect(view.latestPresentation()?.foundCount).toBe(foundCount));
}

async function keyboardFindCat(view: { latestPresentation: () => WordSearchPresentationState | undefined }) {
  const board = screen.getByRole("grid");
  await waitFor(() => expect(screen.getByTestId("word-search-root").getAttribute("data-status")).toBe("playing"));
  fireEvent.keyDown(board, { key: " " });
  fireEvent.keyDown(board, { key: "ArrowRight" });
  fireEvent.keyDown(board, { key: "ArrowRight" });
  fireEvent.keyDown(board, { key: "Enter" });
  await waitForFoundCount(view, 1);
}

test("normalizes out unplaceable words and emits guarded presentation state", async () => {
  const callback = jest.fn<void, [WordSearchPresentationState]>();
  const view = renderGame({ onPresentationChange: callback });
  await waitFor(() => expect(callback.mock.calls.at(-1)?.[0].status).toBe("playing"));
  expect(callback.mock.calls.at(-1)?.[0].totalWords).toBe(2);
  const count = callback.mock.calls.length;
  view.rerender(<WordSearchPuzzle puzzleId="word-search-test" wordSearchData={DATA} displayMode="app-shell" dailyMode persistenceScope="daily" dailyDayNumber={142} onPresentationChange={callback} />);
  await act(async () => {});
  expect(callback.mock.calls.length).toBe(count);
});

test("one keyboard submission records one letter-selection action", async () => {
  const fetchMock = installFetch();
  const view = renderPuzzle({ puzzleId: "word-search-test", wordSearchData: DATA, displayMode: "app-shell", dailyMode: true });
  await keyboardFindCat(view);
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
  act(() => ref.current?.openInstructions());
  const helpDialog = screen.getByRole("dialog", { name: "How to play Word Trove" });
  expect(helpDialog).toBeTruthy();
  // Documents both selection methods and same-cell cancellation (Pass 4).
  expect(helpDialog.textContent).toContain("Drag from the first letter to the last");
  expect(helpDialog.textContent).toContain("tap a start letter and then tap the end letter");
  expect(helpDialog.textContent).toContain("tap it again to cancel");
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  act(() => ref.current?.openWordList()); expect(screen.getByRole("dialog", { name: "Words to find" })).toBeTruthy();
  fireEvent.keyDown(window, { key: "Escape" }); await waitFor(() => expect(screen.queryByRole("dialog", { name: "Words to find" })).toBeNull());
});

test("hint is guarded in flight and only consumes a placeable unfound word", async () => {
  let resolveToken!: (value: boolean) => void;
  const onHintUsed = jest.fn(() => new Promise<boolean>((resolve) => { resolveToken = resolve; }));
  const view = renderGame({ hintTokens: 2, onHintUsed });
  const button = screen.getByRole("button", { name: /Hint/ }); fireEvent.click(button); fireEvent.click(button);
  expect(onHintUsed).toHaveBeenCalledTimes(1);
  resolveToken(true);
  await waitForFoundCount(view, 1);
});

test("daily completion waits for success and exposes retry without losing the board", async () => {
  const onComplete = jest.fn().mockResolvedValueOnce({ success: false, error: "Offline" }).mockResolvedValueOnce({ success: true });
  const view = renderGame({ dailyMode: true, onComplete, hintTokens: 2, onHintUsed: async () => true });
  fireEvent.click(screen.getByRole("button", { name: /Hint/ })); await waitForFoundCount(view, 1);
  fireEvent.click(screen.getByRole("button", { name: /Hint/ }));
  expect(await screen.findByRole("button", { name: "Retry Completion" })).toBeTruthy();
  expect(screen.getByRole("grid")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Retry Completion" }));
  fireEvent.click(await screen.findByRole("button", { name: "Close definition" }));
  await waitFor(() => expect(screen.getByTestId("word-search-root").getAttribute("data-status")).toBe("won"));
  expect(onComplete).toHaveBeenCalledTimes(2);
});

test("a successful daily completion callback is guarded exactly once", async () => {
  const onComplete = jest.fn(async () => ({ success: true }));
  const view = renderGame({ onComplete, hintTokens: 2, onHintUsed: async () => true });
  fireEvent.click(screen.getByRole("button", { name: /Hint/ })); await waitForFoundCount(view, 1);
  fireEvent.click(screen.getByRole("button", { name: /Hint/ })); fireEvent.click(screen.getByRole("button", { name: /Finding|Hint/ }));
  fireEvent.click(await screen.findByRole("button", { name: "Close definition" }));
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

test("catalog stays loading and replaces stale local completion with authoritative partial progress", async () => {
  const seed = renderPuzzle({ puzzleId: "word-search-test", wordSearchData: DATA, displayMode: "app-shell", persistenceScope: "catalog" });
  await waitFor(() => expect(localStorage.getItem("word-search:v3:catalog:word-search-test")).toBeTruthy());
  const restored = JSON.parse(localStorage.getItem("word-search:v3:catalog:word-search-test")!);
  seed.unmount();
  localStorage.setItem("word-search:v3:catalog:word-search-test", JSON.stringify({ ...restored, foundWords: ["CAT", "DOG"] }));

  let resolveGet!: (response: Response) => void;
  global.fetch = jest.fn((input: RequestInfo | URL) => {
    if (String(input).includes("/dictionary/")) return Promise.resolve({ ok: true, json: async () => ({ found: false }) } as Response);
    return new Promise<Response>((resolve) => { resolveGet = resolve; });
  }) as jest.Mock;
  const callback = jest.fn<void, [WordSearchPresentationState]>();
  render(<WordSearchPuzzle puzzleId="word-search-test" wordSearchData={DATA} displayMode="app-shell" onPresentationChange={callback} />);
  expect(screen.getByTestId("word-search-root").getAttribute("data-status")).toBe("loading");

  resolveGet({ ok: true, json: async () => ({ foundWords: ["CAT"], allFound: false, completionCommitted: false }) } as Response);
  await waitFor(() => expect(screen.getByTestId("word-search-root").getAttribute("data-status")).toBe("playing"));
  expect(callback.mock.calls.at(-1)?.[0].foundCount).toBe(1);
});

test("restored daily all-found state exposes retry and records completion once", async () => {
  const onComplete = jest.fn().mockResolvedValueOnce({ success: false, error: "Offline" }).mockResolvedValueOnce({ success: true });
  const first = renderGame({ onComplete, hintTokens: 2, onHintUsed: async () => true });
  fireEvent.click(screen.getByRole("button", { name: /Hint/ }));
  await waitForFoundCount(first, 1);
  fireEvent.click(screen.getByRole("button", { name: /Hint/ }));
  expect(await screen.findByRole("button", { name: "Retry Completion" })).toBeTruthy();
  await waitFor(() => expect(localStorage.getItem("word-search:v3:daily:142:word-search-test")).toContain("DOG"));
  first.unmount();

  renderGame({ onComplete });
  const retry = await screen.findByRole("button", { name: "Retry Completion" });
  expect(onComplete).toHaveBeenCalledTimes(1);
  fireEvent.click(retry);
  await waitFor(() => expect(screen.getByTestId("word-search-root").getAttribute("data-status")).toBe("won"));
  expect(onComplete).toHaveBeenCalledTimes(2);
});

test("catalog completion handoff waits for final definition dismissal and can retry without resubmitting", async () => {
  let found: string[] = [];
  const onComplete = jest.fn().mockResolvedValueOnce({ success: false, error: "Refresh failed" }).mockResolvedValueOnce({ success: true });
  const fetchMock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).includes("/dictionary/")) return { ok: true, json: async () => ({ found: false }) } as Response;
    if (!init?.method) return { ok: true, json: async () => ({ foundWords: found, allFound: false }) } as Response;
    const body = JSON.parse(String(init.body)) as { word: string };
    found = [...new Set([...found, body.word])];
    return { ok: true, json: async () => ({ valid: true, persisted: true, completionCommitted: found.length === 2, allFound: found.length === 2, foundCount: found.length, total: 2 }) } as Response;
  });
  global.fetch = fetchMock;
  const view = renderPuzzle({ puzzleId: "word-search-test", wordSearchData: DATA, displayMode: "app-shell", hintTokens: 2, onHintUsed: async () => true, onComplete });
  await waitFor(() => expect(screen.getByTestId("word-search-root").getAttribute("data-status")).toBe("playing"));
  fireEvent.click(screen.getByRole("button", { name: /Hint/ }));
  await waitForFoundCount(view, 1);
  expect(screen.queryByRole("dialog", { name: /definition/ })).toBeNull(); // non-final hint stays opt-in
  fireEvent.click(screen.getByRole("button", { name: /Hint/ }));
  expect(await screen.findByRole("dialog", { name: /definition/ })).toBeTruthy();
  expect(onComplete).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Close definition" }));
  expect(await screen.findByRole("button", { name: "Retry Completion" })).toBeTruthy();
  expect(fetchMock.mock.calls.filter((call) => (call[1] as RequestInit | undefined)?.method === "POST")).toHaveLength(2);
  fireEvent.click(screen.getByRole("button", { name: "Retry Completion" }));
  await waitFor(() => expect(screen.getByTestId("word-search-root").getAttribute("data-status")).toBe("won"));
  expect(fetchMock.mock.calls.filter((call) => (call[1] as RequestInit | undefined)?.method === "POST")).toHaveLength(2);
  expect(onComplete).toHaveBeenCalledTimes(2);
});

test("catalog persistence failure does not celebrate or store the word and remains retryable", async () => {
  let postCount = 0;
  global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).includes("/dictionary/")) return { ok: true, json: async () => ({ found: false }) } as Response;
    if (!init?.method) return { ok: true, json: async () => ({ foundWords: [], allFound: false, completionCommitted: false }) } as Response;
    postCount += 1;
    if (postCount === 1) return { ok: false, json: async () => ({ valid: false, persisted: false, recoverable: true, error: "Save failed" }) } as Response;
    return { ok: true, json: async () => ({ valid: true, persisted: true, completionCommitted: false, allFound: false, foundCount: 1, total: 2 }) } as Response;
  }) as jest.Mock;
  const view = renderPuzzle({ puzzleId: "word-search-test", wordSearchData: DATA, displayMode: "app-shell" });
  const board = screen.getByRole("grid");
  await waitFor(() => expect(screen.getByTestId("word-search-root").getAttribute("data-status")).toBe("playing"));
  fireEvent.keyDown(board, { key: " " }); fireEvent.keyDown(board, { key: "ArrowRight" }); fireEvent.keyDown(board, { key: "ArrowRight" }); fireEvent.keyDown(board, { key: "Enter" });
  await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Save failed"));
  expect(view.latestPresentation()?.foundCount).toBe(0);
  expect(JSON.parse(localStorage.getItem("word-search:v3:catalog:word-search-test")!).foundWords).not.toContain("CAT");

  fireEvent.keyDown(board, { key: "ArrowLeft" }); fireEvent.keyDown(board, { key: "ArrowLeft" }); fireEvent.keyDown(board, { key: " " }); fireEvent.keyDown(board, { key: "ArrowRight" }); fireEvent.keyDown(board, { key: "ArrowRight" }); fireEvent.keyDown(board, { key: "Enter" });
  await waitForFoundCount(view, 1);
  expect(postCount).toBe(2);
});

test("catalog progress cannot seed Warz and a second Warz instance starts empty", async () => {
  installFetch();
  localStorage.setItem("wordTroveIntroSeen", "1");
  const catalog = renderPuzzle({ puzzleId: "shared-id", wordSearchData: DATA, displayMode: "app-shell", persistenceScope: "catalog" });
  await keyboardFindCat(catalog);
  await waitFor(() => expect(localStorage.getItem("word-search:v3:catalog:shared-id")).toContain("CAT"));
  catalog.unmount();

  const warz = renderPuzzle({ puzzleId: "shared-id", wordSearchData: DATA, displayMode: "app-shell", warzMode: true, persistenceScope: "none", puzzleInstanceId: "round-1" });
  await waitFor(() => expect(screen.getByTestId("word-search-root").getAttribute("data-status")).toBe("playing"));
  expect(warz.latestPresentation()?.foundCount).toBe(0);
  await keyboardFindCat(warz);
  expect(warz.latestPresentation()?.foundCount).toBe(1);

  warz.rerender(<WordSearchPuzzle puzzleId="shared-id" wordSearchData={DATA} displayMode="app-shell" warzMode persistenceScope="none" puzzleInstanceId="round-2" />);
  await waitFor(() => expect(screen.getByTestId("word-search-root").getAttribute("data-status")).toBe("playing"));
  expect(localStorage.getItem("word-search:v3:catalog:shared-id")).toContain("CAT");
});

test("the same daily puzzle id starts fresh on a different day", async () => {
  installFetch();
  localStorage.setItem("wordTroveIntroSeen", "1");
  const view = renderPuzzle({ puzzleId: "daily-shared", wordSearchData: DATA, displayMode: "app-shell", dailyMode: true, persistenceScope: "daily", dailyDayNumber: 142 });
  await keyboardFindCat(view);
  expect(localStorage.getItem("word-search:v3:daily:142:daily-shared")).toContain("CAT");
  view.rerender(<WordSearchPuzzle puzzleId="daily-shared" wordSearchData={DATA} displayMode="app-shell" dailyMode persistenceScope="daily" dailyDayNumber={143} />);
  await waitFor(() => expect(JSON.parse(localStorage.getItem("word-search:v3:daily:143:daily-shared") ?? "null")?.foundWords).toEqual([]));
});

test("legacy server mismatch enters repair pending and reconciles without a word submission", async () => {
  localStorage.setItem("wordTroveIntroSeen", "1");
  const onComplete = jest.fn(async () => ({ success: true }));
  const fetchMock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/dictionary/")) return { ok: true, json: async () => ({ found: false }) } as Response;
    if (!init?.method) return { ok: true, json: async () => ({ foundWords: ["CAT", "DOG"], submissionsComplete: true, completionCommitted: false, repairRequired: true, allFound: false }) } as Response;
    const body = JSON.parse(String(init.body));
    expect(body).toEqual({ action: "reconcile_completion" });
    return { ok: true, json: async () => ({ valid: true, submissionsComplete: true, completionCommitted: true, allFound: true }) } as Response;
  });
  global.fetch = fetchMock;
  const view = renderPuzzle({ puzzleId: "repair-id", wordSearchData: DATA, displayMode: "app-shell", persistenceScope: "catalog", onComplete });
  const retry = await screen.findByRole("button", { name: "Retry Completion" });
  expect(view.latestPresentation()?.foundCount).toBe(2);
  expect(screen.getByRole("grid")).toBeTruthy();
  fireEvent.click(retry);
  await waitFor(() => expect(screen.getByTestId("word-search-root").getAttribute("data-status")).toBe("won"));
  expect(onComplete).toHaveBeenCalledTimes(1);
  const posts = fetchMock.mock.calls.filter((call) => (call[1] as RequestInit | undefined)?.method === "POST");
  expect(posts).toHaveLength(1);
});

// A competitive Warz round must never be interrupted by the word-definition modal — it fully
// covers the board and blocks the next selection, which would cost real time in a timed match.
// These tests wait past the normal (320ms) AND final-word (520ms) reveal delay used by
// queueDefinition/showNextDefinition, so a regression that merely delays the modal (rather than
// never queueing it) would still be caught.
const DEFINITION_REVEAL_SETTLE_MS = 700;

async function settlePastDefinitionReveal() {
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, DEFINITION_REVEAL_SETTLE_MS)); });
}

function installNoOpFetch() {
  const fetchMock = jest.fn(async () => ({ ok: true, json: async () => ({ found: false }) } as Response));
  global.fetch = fetchMock;
  return fetchMock;
}

test("Warz: a normally selected word does not open a definition dialog, even after the usual delay", async () => {
  const fetchMock = installNoOpFetch();
  const view = renderPuzzle({ puzzleId: "warz-def-normal", wordSearchData: DATA, displayMode: "app-shell", warzMode: true, persistenceScope: "none" });
  await keyboardFindCat(view);
  await settlePastDefinitionReveal();
  expect(screen.queryByRole("dialog", { name: /definition/ })).toBeNull();
  expect(view.latestPresentation()?.foundCount).toBe(1);
  expect(view.container.querySelector('[data-ws-row="0"][data-ws-col="0"]')?.getAttribute("data-found")).toBe("true");
  expect(view.container.querySelector('[data-ws-row="0"][data-ws-col="2"]')?.getAttribute("data-found")).toBe("true");
  expect(fetchMock).not.toHaveBeenCalled();
});

test("Warz: a hinted word does not open a definition dialog, even after the usual delay", async () => {
  const fetchMock = installNoOpFetch();
  const onHintUsed = jest.fn(async () => true);
  const view = renderPuzzle({ puzzleId: "warz-def-hint", wordSearchData: DATA, displayMode: "app-shell", warzMode: true, persistenceScope: "none", hintTokens: 2, onHintUsed });
  await waitFor(() => expect(screen.getByTestId("word-search-root").getAttribute("data-status")).toBe("playing"));
  fireEvent.click(screen.getByRole("button", { name: /Hint/ }));
  await waitForFoundCount(view, 1);
  await settlePastDefinitionReveal();
  expect(screen.queryByRole("dialog", { name: /definition/ })).toBeNull();
  expect(onHintUsed).toHaveBeenCalledTimes(1);
  expect(fetchMock).not.toHaveBeenCalled();
});

test("Warz: the final word calls onSolved exactly once, synchronously, without a definition dialog ever appearing", async () => {
  const fetchMock = installNoOpFetch();
  const onSolved = jest.fn();
  const view = renderPuzzle({ puzzleId: "warz-def-final", wordSearchData: DATA, displayMode: "app-shell", warzMode: true, persistenceScope: "none", onSolved });
  const board = screen.getByRole("grid");
  await waitFor(() => expect(screen.getByTestId("word-search-root").getAttribute("data-status")).toBe("playing"));

  // Find CAT (row 0, cols 0-2) — the non-final word.
  fireEvent.keyDown(board, { key: " " }); fireEvent.keyDown(board, { key: "ArrowRight" }); fireEvent.keyDown(board, { key: "ArrowRight" }); fireEvent.keyDown(board, { key: "Enter" });
  await waitForFoundCount(view, 1);
  expect(onSolved).not.toHaveBeenCalled();
  await settlePastDefinitionReveal();
  expect(screen.queryByRole("dialog", { name: /definition/ })).toBeNull();

  // Find DOG (row 2, cols 0-2) — the final word. The active cell is at (0,2) after the moves
  // above, so navigate to (2,0) before starting the second selection.
  fireEvent.keyDown(board, { key: "ArrowDown" }); fireEvent.keyDown(board, { key: "ArrowDown" }); fireEvent.keyDown(board, { key: "ArrowLeft" }); fireEvent.keyDown(board, { key: "ArrowLeft" });
  fireEvent.keyDown(board, { key: " " }); fireEvent.keyDown(board, { key: "ArrowRight" }); fireEvent.keyDown(board, { key: "ArrowRight" }); fireEvent.keyDown(board, { key: "Enter" });

  // onSolved must fire synchronously with the final word being accepted — not after a timeout,
  // an animation, or a definition fetch/modal — since the Warz timer depends on this handoff.
  await waitFor(() => expect(screen.getByTestId("word-search-root").getAttribute("data-status")).toBe("won"));
  expect(onSolved).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("dialog", { name: /definition/ })).toBeNull();
  await settlePastDefinitionReveal();
  expect(screen.queryByRole("dialog", { name: /definition/ })).toBeNull();
  expect(fetchMock).not.toHaveBeenCalled();
});

// ── Pass 3: Daily/Catalog definition pacing — non-final finds are opt-in, only the final find
// opens automatically. Warz's own definition-suppression tests above are unaffected. ──────────

function installFetchWithDictionaryTracking({ failCompletion = false, total = 2 } = {}) {
  let found: string[] = [];
  const dictionaryRequests: string[] = [];
  const fetchMock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/dictionary/")) {
      dictionaryRequests.push(new URL(url, "http://localhost").searchParams.get("word") ?? "");
      return { ok: true, json: async () => ({ found: false }) } as Response;
    }
    if (!init?.method) return { ok: true, json: async () => ({ foundWords: found, allFound: false }) } as Response;
    const body = JSON.parse(String(init.body)) as { word: string };
    found = [...new Set([...found, body.word])];
    return { ok: !failCompletion, json: async () => failCompletion ? ({ error: "Offline" }) : ({ valid: true, persisted: true, completionCommitted: found.length === total, allFound: found.length === total, foundCount: found.length, total }) } as Response;
  });
  global.fetch = fetchMock;
  return { fetchMock, dictionaryRequests, found: () => found };
}

/** Opens the mobile word-list sheet and clicks the given found word's button. The always-mounted
 * desktop word list (hidden only via a CSS media query jsdom doesn't apply) exposes an
 * identically-labeled button, so the click is scoped to the open sheet dialog specifically. */
async function openFoundWordFromList(word: string) {
  fireEvent.click(screen.getByRole("button", { name: "Words" }));
  const sheet = await screen.findByRole("dialog", { name: "Words to find" });
  fireEvent.click(within(sheet).getByRole("button", { name: new RegExp(`^${word}, found`) }));
}

test("Daily: a non-final find stays opt-in, and opens on demand from the word list", async () => {
  const { dictionaryRequests } = installFetchWithDictionaryTracking();
  localStorage.setItem("wordTroveIntroSeen", "1");
  const view = renderPuzzle({ puzzleId: "word-search-test", wordSearchData: DATA, displayMode: "app-shell", dailyMode: true, persistenceScope: "daily", dailyDayNumber: 142 });

  await keyboardFindCat(view); // CAT — 1 of 2, non-final
  expect(view.container.querySelector('[data-ws-row="0"][data-ws-col="0"]')?.getAttribute("data-found")).toBe("true");
  expect(view.container.querySelector('[data-ws-row="0"][data-ws-col="2"]')?.getAttribute("data-found")).toBe("true");
  await settlePastDefinitionReveal();
  expect(screen.queryByRole("dialog", { name: /definition/ })).toBeNull();
  expect(dictionaryRequests).toHaveLength(0);
  expect(screen.getByRole("grid")).toBeTruthy(); // board remains playable, no interruption

  await openFoundWordFromList("CAT");
  expect(await screen.findByRole("dialog", { name: "CAT definition" })).toBeTruthy();
  expect(dictionaryRequests).toEqual(["CAT"]); // fetched only once the player asked
  fireEvent.click(screen.getByRole("button", { name: "Close definition" }));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "CAT definition" })).toBeNull());
  expect(screen.getByRole("grid")).toBeTruthy();
});

test("Catalog: a non-final find stays opt-in, and opens on demand while server persistence is unaffected", async () => {
  const { fetchMock, dictionaryRequests } = installFetchWithDictionaryTracking();
  localStorage.setItem("wordTroveIntroSeen", "1");
  const view = renderPuzzle({ puzzleId: "catalog-def-test", wordSearchData: DATA, displayMode: "app-shell", persistenceScope: "catalog" });

  await keyboardFindCat(view);
  await settlePastDefinitionReveal();
  expect(screen.queryByRole("dialog", { name: /definition/ })).toBeNull();
  expect(dictionaryRequests).toHaveLength(0);
  expect(fetchMock.mock.calls.filter((call) => (call[1] as RequestInit | undefined)?.method === "POST")).toHaveLength(1); // catalog submission flow unchanged

  await openFoundWordFromList("CAT");
  expect(await screen.findByRole("dialog", { name: "CAT definition" })).toBeTruthy();
  expect(dictionaryRequests).toEqual(["CAT"]);
});

test("a non-final hinted word does not auto-open, and remains available on demand", async () => {
  const { dictionaryRequests } = installFetchWithDictionaryTracking();
  localStorage.setItem("wordTroveIntroSeen", "1");
  const randomSpy = jest.spyOn(Math, "random").mockReturnValue(0); // deterministically hints CAT first
  try {
    const onHintUsed = jest.fn(async () => true);
    // renderGame() installs its own (non-tracking) fetch mock, which would clobber the
    // dictionary-request tracking set up above — build the same render config directly instead.
    const view = renderPuzzle({ puzzleId: "word-search-test", wordSearchData: DATA, displayMode: "app-shell", dailyMode: true, persistenceScope: "daily", dailyDayNumber: 142, hintTokens: 2, onHintUsed });
    fireEvent.click(screen.getByRole("button", { name: /Hint/ }));
    expect(onHintUsed).toHaveBeenCalledTimes(1);
    await waitForFoundCount(view, 1);
    expect(view.container.querySelector('[data-ws-row="0"][data-ws-col="0"]')?.getAttribute("data-hinted")).toBe("true");
    await settlePastDefinitionReveal();
    expect(screen.queryByRole("dialog", { name: /definition/ })).toBeNull();
    expect(dictionaryRequests).toHaveLength(0);

    await openFoundWordFromList("CAT");
    expect(await screen.findByRole("dialog", { name: "CAT definition" })).toBeTruthy();
    expect(dictionaryRequests).toEqual(["CAT"]);
  } finally {
    randomSpy.mockRestore();
  }
});

test("Daily: only the final word opens automatically, and completion stays gated on its dismissal", async () => {
  const onComplete = jest.fn(async () => ({ success: true }));
  const onSolved = jest.fn();
  const { dictionaryRequests } = installFetchWithDictionaryTracking();
  localStorage.setItem("wordTroveIntroSeen", "1");
  const view = renderPuzzle({ puzzleId: "word-search-test", wordSearchData: DATA, displayMode: "app-shell", dailyMode: true, persistenceScope: "daily", dailyDayNumber: 142, onComplete, onSolved });

  await keyboardFindCat(view); // CAT — non-final
  await settlePastDefinitionReveal();
  expect(screen.queryByRole("dialog", { name: /definition/ })).toBeNull();
  expect(onComplete).not.toHaveBeenCalled();

  // Find DOG (row 2, cols 0-2) — the final word. Active cell is (0,2) after keyboardFindCat.
  const board = screen.getByRole("grid");
  fireEvent.keyDown(board, { key: "ArrowDown" }); fireEvent.keyDown(board, { key: "ArrowDown" });
  fireEvent.keyDown(board, { key: "ArrowLeft" }); fireEvent.keyDown(board, { key: "ArrowLeft" });
  fireEvent.keyDown(board, { key: " " }); fireEvent.keyDown(board, { key: "ArrowRight" }); fireEvent.keyDown(board, { key: "ArrowRight" }); fireEvent.keyDown(board, { key: "Enter" });

  expect(await screen.findByRole("dialog", { name: "DOG definition" })).toBeTruthy(); // final word auto-opens
  expect(dictionaryRequests).toEqual(["DOG"]); // CAT was never fetched automatically
  await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1)); // daily records completion immediately
  expect(onSolved).not.toHaveBeenCalled(); // the visual "won" handoff still waits on dismissal

  fireEvent.click(screen.getByRole("button", { name: "Close definition" }));
  await waitFor(() => expect(screen.getByTestId("word-search-root").getAttribute("data-status")).toBe("won"));
  expect(onSolved).toHaveBeenCalledTimes(1);
  expect(onComplete).toHaveBeenCalledTimes(1);

  // Pass 5: Daily's brief internal success presentation is unaffected by the Catalog-only
  // suppression rule — it still bridges Daily's ~700ms delay to the parent solved card.
  expect(document.querySelector(".word-search-success")).toBeTruthy();
  expect(screen.getByText(/All 2 words found/)).toBeTruthy();

  // No queued CAT modal surfaces after the final one is dismissed.
  await settlePastDefinitionReveal();
  expect(screen.queryByRole("dialog", { name: /definition/ })).toBeNull();
  expect(dictionaryRequests).toEqual(["DOG"]);
});

test("Catalog: only the final word opens automatically, and completion stays gated on its dismissal", async () => {
  const onComplete = jest.fn(async () => ({ success: true }));
  const { dictionaryRequests } = installFetchWithDictionaryTracking();
  localStorage.setItem("wordTroveIntroSeen", "1");
  const view = renderPuzzle({ puzzleId: "catalog-final-test", wordSearchData: DATA, displayMode: "app-shell", persistenceScope: "catalog", onComplete });
  await waitFor(() => expect(screen.getByTestId("word-search-root").getAttribute("data-status")).toBe("playing"));

  await keyboardFindCat(view);
  await settlePastDefinitionReveal();
  expect(screen.queryByRole("dialog", { name: /definition/ })).toBeNull();
  expect(onComplete).not.toHaveBeenCalled();

  const board = screen.getByRole("grid");
  fireEvent.keyDown(board, { key: "ArrowDown" }); fireEvent.keyDown(board, { key: "ArrowDown" });
  fireEvent.keyDown(board, { key: "ArrowLeft" }); fireEvent.keyDown(board, { key: "ArrowLeft" });
  fireEvent.keyDown(board, { key: " " }); fireEvent.keyDown(board, { key: "ArrowRight" }); fireEvent.keyDown(board, { key: "ArrowRight" }); fireEvent.keyDown(board, { key: "Enter" });

  expect(await screen.findByRole("dialog", { name: "DOG definition" })).toBeTruthy();
  expect(dictionaryRequests).toEqual(["DOG"]);
  expect(onComplete).not.toHaveBeenCalled(); // catalog's handoff waits on dismissal, unlike daily's immediate call

  fireEvent.click(screen.getByRole("button", { name: "Close definition" }));
  await waitFor(() => expect(screen.getByTestId("word-search-root").getAttribute("data-status")).toBe("won"));
  expect(onComplete).toHaveBeenCalledTimes(1);

  // Pass 5: a fresh app-shell Catalog completion has no internal success banner — the parent
  // XP/comparison/rating flow (driven by onComplete/onSolved) is the only fresh presentation.
  expect(document.querySelector(".word-search-success")).toBeNull();
  expect(screen.queryByText(/All 2 words found/)).toBeNull();
  expect(screen.queryByText("Word Trove completed")).toBeNull();

  await settlePastDefinitionReveal();
  expect(screen.queryByRole("dialog", { name: /definition/ })).toBeNull(); // no queued CAT modal
});

test("Pass 5: a restored, already-completed app-shell Catalog puzzle shows a clean completed state, not a fresh reward flow", async () => {
  localStorage.setItem("wordTroveIntroSeen", "1");
  const onComplete = jest.fn(async () => ({ success: true }));
  const fetchMock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/dictionary/")) return { ok: true, json: async () => ({ found: false }) } as Response;
    if (!init?.method) return { ok: true, json: async () => ({ foundWords: ["CAT", "DOG"], allFound: true, completionCommitted: true }) } as Response;
    throw new Error("no submission expected for a puzzle restored as already complete");
  });
  global.fetch = fetchMock;
  render(<WordSearchPuzzle puzzleId="already-complete-test" wordSearchData={DATA} displayMode="app-shell" persistenceScope="catalog" onComplete={onComplete} />);

  await waitFor(() => expect(screen.getByTestId("word-search-root").getAttribute("data-status")).toBe("won"));

  // A clean, non-emoji completed state remains visible — the app-shell is not left blank —
  // but no fresh reward flow is triggered merely by reopening an already-solved puzzle.
  const success = document.querySelector(".word-search-success");
  expect(success).toBeTruthy();
  expect(success?.textContent).toContain("Word Trove completed");
  expect(success?.textContent).not.toMatch(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u);
  expect(screen.queryByText(/All 2 words found/)).toBeNull();
  expect(onComplete).not.toHaveBeenCalled();
  expect(screen.getByRole("grid")).toBeTruthy(); // still a real board, not a blank shell
});

test("Pass 5: a standalone completion still shows an internal result, unaffected by the Catalog app-shell suppression rule", async () => {
  const onComplete = jest.fn(async () => ({ success: true }));
  const { dictionaryRequests } = installFetchWithDictionaryTracking();
  localStorage.setItem("wordTroveIntroSeen", "1");
  const view = renderPuzzle({ puzzleId: "standalone-catalog-test", wordSearchData: DATA, displayMode: "standalone", persistenceScope: "catalog", onComplete });
  await waitFor(() => expect(screen.getByTestId("word-search-root").getAttribute("data-status")).toBe("playing"));

  await keyboardFindCat(view); // CAT — non-final
  await settlePastDefinitionReveal();

  const board = screen.getByRole("grid");
  fireEvent.keyDown(board, { key: "ArrowDown" }); fireEvent.keyDown(board, { key: "ArrowDown" });
  fireEvent.keyDown(board, { key: "ArrowLeft" }); fireEvent.keyDown(board, { key: "ArrowLeft" });
  fireEvent.keyDown(board, { key: " " }); fireEvent.keyDown(board, { key: "ArrowRight" }); fireEvent.keyDown(board, { key: "ArrowRight" }); fireEvent.keyDown(board, { key: "Enter" });

  expect(await screen.findByRole("dialog", { name: "DOG definition" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Close definition" }));
  await waitFor(() => expect(screen.getByTestId("word-search-root").getAttribute("data-status")).toBe("won"));
  expect(onComplete).toHaveBeenCalledTimes(1);

  // Standalone has no parent app-shell reward presentation, so its own internal result must
  // remain — the same displayMode==="app-shell" && catalog rule must not leak into standalone.
  expect(document.querySelector(".word-search-success")).toBeTruthy();
  expect(screen.getByText(/All 2 words found/)).toBeTruthy();
  expect(dictionaryRequests).toContain("DOG");
});

test("rapid finds do not create a non-final definition queue", async () => {
  const threeWordData = {
    grid: [
      ["C", "A", "T", "X", "X"],
      ["X", "X", "O", "X", "X"],
      ["D", "O", "G", "X", "X"],
      ["S", "U", "N", "X", "X"],
      ["X", "X", "X", "X", "X"],
    ],
    words: ["CAT", "DOG", "SUN"],
  };
  const { dictionaryRequests } = installFetchWithDictionaryTracking({ total: 3 });
  localStorage.setItem("wordTroveIntroSeen", "1");
  const view = renderPuzzle({ puzzleId: "rapid-def-test", wordSearchData: threeWordData, displayMode: "app-shell", dailyMode: true, persistenceScope: "daily", dailyDayNumber: 142 });
  const board = screen.getByRole("grid");
  await waitFor(() => expect(screen.getByTestId("word-search-root").getAttribute("data-status")).toBe("playing"));

  // Find CAT then DOG back-to-back — each submission still has to clear the component's own
  // in-flight `submitting` guard before the next one is accepted, so CAT is awaited first, but
  // both land in a small fraction of the old 320ms non-final reveal delay (the mocked fetch
  // resolves near-instantly), which is the actual invariant this test is protecting.
  fireEvent.keyDown(board, { key: " " }); fireEvent.keyDown(board, { key: "ArrowRight" }); fireEvent.keyDown(board, { key: "ArrowRight" }); fireEvent.keyDown(board, { key: "Enter" });
  await waitForFoundCount(view, 1);
  fireEvent.keyDown(board, { key: "ArrowDown" }); fireEvent.keyDown(board, { key: "ArrowDown" });
  fireEvent.keyDown(board, { key: "ArrowLeft" }); fireEvent.keyDown(board, { key: "ArrowLeft" });
  fireEvent.keyDown(board, { key: " " }); fireEvent.keyDown(board, { key: "ArrowRight" }); fireEvent.keyDown(board, { key: "ArrowRight" }); fireEvent.keyDown(board, { key: "Enter" });
  await waitForFoundCount(view, 2);

  await settlePastDefinitionReveal();
  expect(screen.queryByRole("dialog", { name: /definition/ })).toBeNull();
  expect(dictionaryRequests).toHaveLength(0);

  // Find the final word, SUN.
  fireEvent.keyDown(board, { key: "ArrowDown" }); fireEvent.keyDown(board, { key: "ArrowLeft" }); fireEvent.keyDown(board, { key: "ArrowLeft" });
  fireEvent.keyDown(board, { key: " " }); fireEvent.keyDown(board, { key: "ArrowRight" }); fireEvent.keyDown(board, { key: "ArrowRight" }); fireEvent.keyDown(board, { key: "Enter" });
  expect(await screen.findByRole("dialog", { name: "SUN definition" })).toBeTruthy();
  expect(dictionaryRequests).toEqual(["SUN"]); // only the automatic final fetch has happened

  fireEvent.click(screen.getByRole("button", { name: "Close definition" }));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "SUN definition" })).toBeNull());

  // No hidden CAT/DOG backlog surfaces once the final modal is dismissed.
  await settlePastDefinitionReveal();
  expect(screen.queryByRole("dialog", { name: /definition/ })).toBeNull();
  expect(dictionaryRequests).toEqual(["SUN"]);
});
