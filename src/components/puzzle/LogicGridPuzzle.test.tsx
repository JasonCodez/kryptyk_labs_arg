/** @jest-environment jsdom */

import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { validateLogicGridPuzzleData } from "@/lib/logicGridCore";
import { getLogicGridCellKey } from "@/lib/logicGridGame";

jest.mock("./LogicGridPuzzle.module.css", () => new Proxy({}, { get: (_target, prop) => String(prop) }));

const juiceMock = {
  tap: jest.fn(),
  tick: jest.fn(),
  pop: jest.fn(),
  whoosh: jest.fn(),
  success: jest.fn(),
  error: jest.fn(),
  unlock: jest.fn(),
  reward: jest.fn(),
};
jest.mock("@/lib/juice", () => ({ juice: juiceMock }));

const confettiBurstAtMock = jest.fn();
jest.mock("@/components/juice/particles", () => ({
  confettiBurstAt: (...args: unknown[]) => confettiBurstAtMock(...args),
  SparkleBurst: () => null,
  AnimatedCheck: () => null,
}));

import LogicGridPuzzle from "./LogicGridPuzzle";

const LOGIC_CASE_DATA = {
  intro: "Four guests entered the Midnight Exhibition. Determine who went where, when they arrived, and what they carried.",
  categories: [
    { id: "person", name: "Guests", entries: ["Maya", "Jordan", "Lena", "Theo"] },
    { id: "room", name: "Rooms", entries: ["Observatory", "Library", "Vault", "Gallery"] },
    { id: "time", name: "Arrival Times", entries: ["8:00", "8:30", "9:00", "9:30"] },
    { id: "object", name: "Objects", entries: ["Brass Compass", "Silver Key", "Red Journal", "Glass Eye"] },
  ],
  clues: [
    "Maya did not enter the Vault.",
    "The Library visitor arrived at 8:00.",
    "Jordan arrived immediately before the guest carrying the Red Journal.",
    "Theo did not carry the Silver Key.",
    "The Observatory visitor arrived later than Lena.",
    "The Glass Eye was not taken into the Gallery.",
    "The 9:30 guest carried the Brass Compass.",
    "Jordan did not enter the Library.",
  ],
};

const INVALID_DATA = { categories: [], clues: [] };

const FIXTURE_CATEGORIES = validateLogicGridPuzzleData(LOGIC_CASE_DATA, { requireSolution: false }).normalized!
  .categories;

function keyFor(catIdA: string, entryA: string, catIdB: string, entryB: string): string {
  return getLogicGridCellKey(FIXTURE_CATEGORIES, catIdA, entryA, catIdB, entryB)!;
}

function buildCompleteMarks(): Record<string, "check"> {
  const { normalized } = validateLogicGridPuzzleData(LOGIC_CASE_DATA, { requireSolution: false });
  const categories = normalized!.categories;
  const primary = categories[0];
  const others = categories.slice(1);
  const marks: Record<string, "check"> = {};
  primary.entries.forEach((personEntry, i) => {
    others.forEach((other) => {
      const value = other.entries[i];
      const key = getLogicGridCellKey(categories, primary.id, personEntry, other.id, value)!;
      marks[key] = "check";
    });
  });
  return marks;
}

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 500) {
  return Promise.resolve({
    ok,
    status,
    json: () => Promise.resolve(body),
  } as Response);
}

interface FetchCall {
  url: string;
  method: string;
  body?: unknown;
  credentials?: string;
}

function buildFetchMock(options: {
  getBody?: unknown;
  getOk?: boolean;
  getReject?: boolean;
  postImpl?: (call: FetchCall) => Promise<Response>;
  patchImpl?: (call: FetchCall) => Promise<Response>;
} = {}) {
  const calls: FetchCall[] = [];
  const fn = jest.fn((url: RequestInfo | URL, init?: RequestInit) => {
    const method = (init?.method ?? "GET").toUpperCase();
    const call: FetchCall = {
      url: String(url),
      method,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
      credentials: init?.credentials as string | undefined,
    };
    calls.push(call);

    if (method === "GET") {
      if (options.getReject) return Promise.reject(new Error("network down"));
      return jsonResponse(options.getBody ?? { cellMarks: {} }, options.getOk ?? true);
    }
    if (method === "PATCH") {
      return options.patchImpl ? options.patchImpl(call) : jsonResponse({ saved: true });
    }
    if (method === "POST") {
      return options.postImpl ? options.postImpl(call) : jsonResponse({ correct: false, mismatchedCategories: [] });
    }
    return jsonResponse({});
  });
  global.fetch = fn as unknown as typeof fetch;
  return { fn, calls };
}

/**
 * A fetch mock whose GET responses are resolved on demand (keyed by the puzzleId embedded in
 * the URL), for tests that need to observe pre-hydration state or control exactly when each
 * puzzle's hydration settles. PATCH/POST resolve immediately unless overridden.
 */
function buildDeferredFetchMock() {
  const calls: FetchCall[] = [];
  const resolvers = new Map<string, (body: unknown) => void>();
  const fn = jest.fn((url: RequestInfo | URL, init?: RequestInit) => {
    const method = (init?.method ?? "GET").toUpperCase();
    const urlStr = String(url);
    const call: FetchCall = {
      url: urlStr,
      method,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
      credentials: init?.credentials as string | undefined,
    };
    calls.push(call);

    if (method === "GET") {
      return new Promise<Response>((resolve) => {
        resolvers.set(urlStr, (body: unknown) => resolve(jsonResponseSync(body)));
      });
    }
    if (method === "PATCH") return jsonResponse({ saved: true });
    if (method === "POST") return jsonResponse({ correct: false, mismatchedCategories: [] });
    return jsonResponse({});
  });
  global.fetch = fn as unknown as typeof fetch;

  function jsonResponseSync(body: unknown): Response {
    return { ok: true, status: 200, json: () => Promise.resolve(body) } as Response;
  }

  return {
    fn,
    calls,
    /** Resolves the GET whose URL contains `urlFragment` (e.g. a puzzleId) with `body`. */
    resolveGet(urlFragment: string, body: unknown) {
      const match = [...resolvers.keys()].find((u) => u.includes(urlFragment));
      if (!match) throw new Error(`No pending GET found for fragment "${urlFragment}"`);
      resolvers.get(match)!(body);
      resolvers.delete(match);
    },
  };
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

function cellButton(entryA: string, entryB: string, hidden = false) {
  return screen.getByRole("button", { name: new RegExp(`^${entryA} and ${entryB}:`), hidden });
}

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  cleanup();
  jest.useRealTimers();
});

describe("LogicGridPuzzle — validation", () => {
  it("renders a safe load error for invalid data", () => {
    buildFetchMock();
    render(
      <LogicGridPuzzle puzzleId="p1" logicGridData={INVALID_DATA} alreadySolved={false} onSolved={jest.fn()} />
    );
    expect(screen.getByText("This logic case could not be loaded.")).toBeTruthy();
  });

  it("does not render raw validation details", () => {
    buildFetchMock();
    render(
      <LogicGridPuzzle puzzleId="p1" logicGridData={INVALID_DATA} alreadySolved={false} onSolved={jest.fn()} />
    );
    expect(screen.queryByText(/categories/i)).toBeNull();
  });
});

describe("LogicGridPuzzle — hydration", () => {
  it("GET uses the exact endpoint and credentials", async () => {
    const { calls } = buildFetchMock();
    render(
      <LogicGridPuzzle puzzleId="p1" logicGridData={LOGIC_CASE_DATA} alreadySolved={false} onSolved={jest.fn()} />
    );
    await flush();
    expect(calls[0].url).toBe("/api/puzzles/p1/logic-grid");
    expect(calls[0].credentials).toBe("same-origin");
  });

  it("hydrates valid saved marks", async () => {
    const key = getLogicGridCellKey(
      validateLogicGridPuzzleData(LOGIC_CASE_DATA, { requireSolution: false }).normalized!.categories,
      "person",
      "Maya",
      "room",
      "Observatory"
    )!;
    buildFetchMock({ getBody: { cellMarks: { [key]: "check" } } });
    render(
      <LogicGridPuzzle puzzleId="p1" logicGridData={LOGIC_CASE_DATA} alreadySolved={false} onSolved={jest.fn()} />
    );
    await flush();
    expect(cellButton("Maya", "Observatory").getAttribute("aria-label")).toMatch(/confirmed/);
  });

  it("drops malformed saved marks", async () => {
    buildFetchMock({ getBody: { cellMarks: { "not-a-real-key": "check", "person::Maya::room::Observatory": "maybe" } } });
    render(
      <LogicGridPuzzle puzzleId="p1" logicGridData={LOGIC_CASE_DATA} alreadySolved={false} onSolved={jest.fn()} />
    );
    await flush();
    expect(cellButton("Maya", "Observatory").getAttribute("aria-label")).toMatch(/unknown/);
  });

  it("a failed GET safely starts empty", async () => {
    buildFetchMock({ getReject: true });
    render(
      <LogicGridPuzzle puzzleId="p1" logicGridData={LOGIC_CASE_DATA} alreadySolved={false} onSolved={jest.fn()} />
    );
    await flush();
    expect(cellButton("Maya", "Observatory").getAttribute("aria-label")).toMatch(/unknown/);
  });

  it("hydration does not fire juice effects or milestone messaging", async () => {
    const key = getLogicGridCellKey(
      validateLogicGridPuzzleData(LOGIC_CASE_DATA, { requireSolution: false }).normalized!.categories,
      "person",
      "Maya",
      "room",
      "Observatory"
    )!;
    buildFetchMock({ getBody: { cellMarks: { [key]: "check" } } });
    render(
      <LogicGridPuzzle puzzleId="p1" logicGridData={LOGIC_CASE_DATA} alreadySolved={false} onSolved={jest.fn()} />
    );
    await flush();
    expect(juiceMock.pop).not.toHaveBeenCalled();
    expect(juiceMock.tick).not.toHaveBeenCalled();
    expect(juiceMock.unlock).not.toHaveBeenCalled();
    expect(screen.queryByText(/Case progress/)).toBeNull();
  });
});

describe("LogicGridPuzzle — tabs", () => {
  it("shows the mobile tab control with Grid selected by default", async () => {
    buildFetchMock();
    render(
      <LogicGridPuzzle puzzleId="p1" logicGridData={LOGIC_CASE_DATA} alreadySolved={false} onSolved={jest.fn()} />
    );
    await flush();
    expect(screen.getByRole("tablist")).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Grid" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tab", { name: "Clues" }).getAttribute("aria-selected")).toBe("false");
  });

  it("Clues tab can become selected", async () => {
    buildFetchMock();
    render(
      <LogicGridPuzzle puzzleId="p1" logicGridData={LOGIC_CASE_DATA} alreadySolved={false} onSolved={jest.fn()} />
    );
    await flush();
    fireEvent.click(screen.getByRole("tab", { name: "Clues" }));
    expect(screen.getByRole("tab", { name: "Clues" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tabpanel").id).toMatch(/-panel-clues$/);
  });

  it("Case Board tab can become selected", async () => {
    buildFetchMock();
    render(
      <LogicGridPuzzle puzzleId="p1" logicGridData={LOGIC_CASE_DATA} alreadySolved={false} onSolved={jest.fn()} />
    );
    await flush();
    fireEvent.click(screen.getByRole("tab", { name: "Case Board" }));
    expect(screen.getByRole("tab", { name: "Case Board" }).getAttribute("aria-selected")).toBe("true");
  });

  it("panel state changes without losing marks", async () => {
    buildFetchMock();
    render(
      <LogicGridPuzzle puzzleId="p1" logicGridData={LOGIC_CASE_DATA} alreadySolved={false} onSolved={jest.fn()} />
    );
    await flush();
    fireEvent.click(cellButton("Maya", "Observatory"));
    fireEvent.click(screen.getByRole("tab", { name: "Clues" }));
    fireEvent.click(screen.getByRole("tab", { name: "Grid" }));
    expect(cellButton("Maya", "Observatory").getAttribute("aria-label")).toMatch(/impossible/);
  });
});

describe("LogicGridPuzzle — accessible grid cells", () => {
  it("cells are native buttons with an unknown initial state", async () => {
    buildFetchMock();
    render(
      <LogicGridPuzzle puzzleId="p1" logicGridData={LOGIC_CASE_DATA} alreadySolved={false} onSolved={jest.fn()} />
    );
    await flush();
    const cell = cellButton("Maya", "Observatory");
    expect(cell.tagName).toBe("BUTTON");
    expect(cell.getAttribute("aria-label")).toBe("Maya and Observatory: unknown");
  });

  it("cycles unknown -> impossible -> confirmed -> unknown", async () => {
    buildFetchMock();
    render(
      <LogicGridPuzzle puzzleId="p1" logicGridData={LOGIC_CASE_DATA} alreadySolved={false} onSolved={jest.fn()} />
    );
    await flush();
    const cell = cellButton("Maya", "Observatory");
    fireEvent.click(cell);
    expect(cellButton("Maya", "Observatory").getAttribute("aria-label")).toBe("Maya and Observatory: impossible");
    fireEvent.click(cellButton("Maya", "Observatory"));
    expect(cellButton("Maya", "Observatory").getAttribute("aria-label")).toBe("Maya and Observatory: confirmed");
    fireEvent.click(cellButton("Maya", "Observatory"));
    expect(cellButton("Maya", "Observatory").getAttribute("aria-label")).toBe("Maya and Observatory: unknown");
  });
});

describe("LogicGridPuzzle — propagation and chain feedback", () => {
  it("confirming a relationship crosses the rest of its row and column, and shows a chain message", async () => {
    buildFetchMock();
    render(
      <LogicGridPuzzle puzzleId="p1" logicGridData={LOGIC_CASE_DATA} alreadySolved={false} onSolved={jest.fn()} />
    );
    await flush();
    fireEvent.click(cellButton("Maya", "Observatory"));
    fireEvent.click(cellButton("Maya", "Observatory"));

    expect(cellButton("Maya", "Library").getAttribute("aria-label")).toMatch(/impossible/);
    expect(cellButton("Jordan", "Observatory").getAttribute("aria-label")).toMatch(/impossible/);
    expect(screen.getByText(/6 possibilities eliminated/)).toBeTruthy();
  });

  it("chain message uses a polite live region", async () => {
    buildFetchMock();
    render(
      <LogicGridPuzzle puzzleId="p1" logicGridData={LOGIC_CASE_DATA} alreadySolved={false} onSolved={jest.fn()} />
    );
    await flush();
    fireEvent.click(cellButton("Maya", "Observatory"));
    fireEvent.click(cellButton("Maya", "Observatory"));
    const liveRegion = screen.getByText(/possibilities eliminated/).closest('[aria-live="polite"]');
    expect(liveRegion).toBeTruthy();
  });

  it("no chain message appears for a plain cross", async () => {
    buildFetchMock();
    render(
      <LogicGridPuzzle puzzleId="p1" logicGridData={LOGIC_CASE_DATA} alreadySolved={false} onSolved={jest.fn()} />
    );
    await flush();
    fireEvent.click(cellButton("Maya", "Observatory"));
    expect(screen.queryByText(/possibilities eliminated/)).toBeNull();
  });

  it("exactly one new elimination does not show a chain message", async () => {
    // Pre-cross 5 of the 6 row/column cells for the Maya/Observatory pairing via hydration,
    // leaving exactly one (Theo/Observatory) to be newly eliminated by the check.
    const preset: Record<string, "cross"> = {
      [keyFor("person", "Maya", "room", "Library")]: "cross",
      [keyFor("person", "Maya", "room", "Vault")]: "cross",
      [keyFor("person", "Maya", "room", "Gallery")]: "cross",
      [keyFor("person", "Jordan", "room", "Observatory")]: "cross",
      [keyFor("person", "Lena", "room", "Observatory")]: "cross",
    };
    buildFetchMock({ getBody: { cellMarks: preset } });
    render(
      <LogicGridPuzzle puzzleId="p1" logicGridData={LOGIC_CASE_DATA} alreadySolved={false} onSolved={jest.fn()} />
    );
    await flush();

    expect(cellButton("Theo", "Observatory").getAttribute("aria-label")).toMatch(/unknown/);
    fireEvent.click(cellButton("Maya", "Observatory")); // -> cross
    fireEvent.click(cellButton("Maya", "Observatory")); // -> check (1 new elimination)

    expect(cellButton("Theo", "Observatory").getAttribute("aria-label")).toMatch(/impossible/);
    expect(screen.queryByText(/possibilities eliminated/)).toBeNull();
  });

  it("exactly two new eliminations show the chain message with the correct count", async () => {
    // Pre-cross 4 of the 6 row/column cells, leaving Maya/Gallery and Theo/Observatory to be
    // newly eliminated by the check.
    const preset: Record<string, "cross"> = {
      [keyFor("person", "Maya", "room", "Library")]: "cross",
      [keyFor("person", "Maya", "room", "Vault")]: "cross",
      [keyFor("person", "Jordan", "room", "Observatory")]: "cross",
      [keyFor("person", "Lena", "room", "Observatory")]: "cross",
    };
    buildFetchMock({ getBody: { cellMarks: preset } });
    render(
      <LogicGridPuzzle puzzleId="p1" logicGridData={LOGIC_CASE_DATA} alreadySolved={false} onSolved={jest.fn()} />
    );
    await flush();

    fireEvent.click(cellButton("Maya", "Observatory")); // -> cross
    fireEvent.click(cellButton("Maya", "Observatory")); // -> check (2 new eliminations)

    expect(cellButton("Maya", "Gallery").getAttribute("aria-label")).toMatch(/impossible/);
    expect(cellButton("Theo", "Observatory").getAttribute("aria-label")).toMatch(/impossible/);
    expect(screen.getByText(/2 possibilities eliminated/)).toBeTruthy();
  });

  it("uses juice.pop() for a check action and juice.tick() for cross/clear", async () => {
    buildFetchMock();
    render(
      <LogicGridPuzzle puzzleId="p1" logicGridData={LOGIC_CASE_DATA} alreadySolved={false} onSolved={jest.fn()} />
    );
    await flush();
    fireEvent.click(cellButton("Maya", "Observatory")); // cross
    expect(juiceMock.tick).toHaveBeenCalledTimes(1);
    fireEvent.click(cellButton("Maya", "Observatory")); // check
    expect(juiceMock.pop).toHaveBeenCalled();
    fireEvent.click(cellButton("Maya", "Observatory")); // clear
    expect(juiceMock.tick).toHaveBeenCalledTimes(2);
  });
});

describe("LogicGridPuzzle — undo and redo", () => {
  it("undo restores the exact prior snapshot, reversing a check and its auto-crosses together", async () => {
    buildFetchMock();
    render(
      <LogicGridPuzzle puzzleId="p1" logicGridData={LOGIC_CASE_DATA} alreadySolved={false} onSolved={jest.fn()} />
    );
    await flush();
    fireEvent.click(cellButton("Maya", "Observatory")); // -> cross
    fireEvent.click(cellButton("Maya", "Observatory")); // -> check + propagation

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(cellButton("Maya", "Observatory").getAttribute("aria-label")).toMatch(/impossible/);
    expect(cellButton("Maya", "Library").getAttribute("aria-label")).toMatch(/unknown/);
    expect(cellButton("Jordan", "Observatory").getAttribute("aria-label")).toMatch(/unknown/);
  });

  it("redo reapplies the same snapshot", async () => {
    buildFetchMock();
    render(
      <LogicGridPuzzle puzzleId="p1" logicGridData={LOGIC_CASE_DATA} alreadySolved={false} onSolved={jest.fn()} />
    );
    await flush();
    fireEvent.click(cellButton("Maya", "Observatory"));
    fireEvent.click(cellButton("Maya", "Observatory"));
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    fireEvent.click(screen.getByRole("button", { name: "Redo" }));
    expect(cellButton("Maya", "Observatory").getAttribute("aria-label")).toMatch(/confirmed/);
    expect(cellButton("Maya", "Library").getAttribute("aria-label")).toMatch(/impossible/);
  });

  it("a new action after undo clears redo", async () => {
    buildFetchMock();
    render(
      <LogicGridPuzzle puzzleId="p1" logicGridData={LOGIC_CASE_DATA} alreadySolved={false} onSolved={jest.fn()} />
    );
    await flush();
    fireEvent.click(cellButton("Maya", "Observatory"));
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect((screen.getByRole("button", { name: "Redo" }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(cellButton("Jordan", "Library"));
    expect((screen.getByRole("button", { name: "Redo" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("disabled states are correct", async () => {
    buildFetchMock();
    render(
      <LogicGridPuzzle puzzleId="p1" logicGridData={LOGIC_CASE_DATA} alreadySolved={false} onSolved={jest.fn()} />
    );
    await flush();
    expect((screen.getByRole("button", { name: "Undo" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Redo" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(cellButton("Maya", "Observatory"));
    expect((screen.getByRole("button", { name: "Undo" }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByRole("button", { name: "Redo" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("keyboard Undo and Redo work", async () => {
    buildFetchMock();
    const { container } = render(
      <LogicGridPuzzle puzzleId="p1" logicGridData={LOGIC_CASE_DATA} alreadySolved={false} onSolved={jest.fn()} />
    );
    await flush();
    fireEvent.click(cellButton("Maya", "Observatory"));
    expect(cellButton("Maya", "Observatory").getAttribute("aria-label")).toMatch(/impossible/);

    fireEvent.keyDown(container.firstChild as Element, { key: "z", ctrlKey: true });
    expect(cellButton("Maya", "Observatory").getAttribute("aria-label")).toMatch(/unknown/);

    fireEvent.keyDown(container.firstChild as Element, { key: "z", ctrlKey: true, shiftKey: true });
    expect(cellButton("Maya", "Observatory").getAttribute("aria-label")).toMatch(/impossible/);
  });

  it("editable controls do not have their normal browser undo intercepted", async () => {
    buildFetchMock();
    render(
      <LogicGridPuzzle puzzleId="p1" logicGridData={LOGIC_CASE_DATA} alreadySolved={false} onSolved={jest.fn()} />
    );
    await flush();
    fireEvent.click(cellButton("Maya", "Observatory"));
    fireEvent.click(screen.getByRole("tab", { name: "Clues" }));
    const checkbox = screen.getAllByRole("checkbox")[0];
    const preventDefault = jest.fn();
    fireEvent.keyDown(checkbox, { key: "z", ctrlKey: true, preventDefault });
    // The grid state must be unaffected — still impossible, not cleared by an intercepted undo.
    fireEvent.click(screen.getByRole("tab", { name: "Grid" }));
    expect(cellButton("Maya", "Observatory").getAttribute("aria-label")).toMatch(/impossible/);
  });
});

describe("LogicGridPuzzle — progress", () => {
  it("initial fact count is zero", async () => {
    buildFetchMock();
    render(
      <LogicGridPuzzle puzzleId="p1" logicGridData={LOGIC_CASE_DATA} alreadySolved={false} onSolved={jest.fn()} />
    );
    await flush();
    expect(screen.getByText("0 of 12 facts confirmed")).toBeTruthy();
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("0");
  });

  it("a primary confirmation increases fact count and percentage", async () => {
    buildFetchMock();
    render(
      <LogicGridPuzzle puzzleId="p1" logicGridData={LOGIC_CASE_DATA} alreadySolved={false} onSolved={jest.fn()} />
    );
    await flush();
    fireEvent.click(cellButton("Maya", "Observatory"));
    fireEvent.click(cellButton("Maya", "Observatory"));
    expect(screen.getByText("1 of 12 facts confirmed")).toBeTruthy();
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("8");
  });

  it("a non-primary confirmation does not increase fact count", async () => {
    buildFetchMock();
    render(
      <LogicGridPuzzle puzzleId="p1" logicGridData={LOGIC_CASE_DATA} alreadySolved={false} onSolved={jest.fn()} />
    );
    await flush();
    fireEvent.click(screen.getByRole("tab", { name: "Grid" }));
    // Room-vs-time is a non-primary pairing.
    const cell = cellButton("Observatory", "8:00");
    fireEvent.click(cell);
    fireEvent.click(cellButton("Observatory", "8:00"));
    expect(screen.getByText("0 of 12 facts confirmed")).toBeTruthy();
  });
});

describe("LogicGridPuzzle — case board", () => {
  it("shows the empty message initially", async () => {
    buildFetchMock();
    render(
      <LogicGridPuzzle puzzleId="p1" logicGridData={LOGIC_CASE_DATA} alreadySolved={false} onSolved={jest.fn()} />
    );
    await flush();
    fireEvent.click(screen.getByRole("tab", { name: "Case Board" }));
    expect(screen.getByText(/No confirmed facts yet\./)).toBeTruthy();
  });

  it("a confirmed primary fact appears after a check, and disappears when the check is removed", async () => {
    buildFetchMock();
    render(
      <LogicGridPuzzle puzzleId="p1" logicGridData={LOGIC_CASE_DATA} alreadySolved={false} onSolved={jest.fn()} />
    );
    await flush();
    fireEvent.click(cellButton("Maya", "Observatory"));
    fireEvent.click(cellButton("Maya", "Observatory"));
    fireEvent.click(screen.getByRole("tab", { name: "Case Board" }));
    const caseBoardPanel = within(screen.getByRole("tabpanel"));
    expect(caseBoardPanel.getByText("Maya")).toBeTruthy();
    expect(caseBoardPanel.getByText(/Rooms:/)).toBeTruthy();
    expect(caseBoardPanel.getByText("Observatory")).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: "Grid" }));
    fireEvent.click(cellButton("Maya", "Observatory")); // -> unknown, clears the check
    fireEvent.click(screen.getByRole("tab", { name: "Case Board" }));
    expect(within(screen.getByRole("tabpanel")).getByText(/No confirmed facts yet\./)).toBeTruthy();
  });
});

describe("LogicGridPuzzle — clue cards", () => {
  it("renders all clue text and toggles resolved state without affecting progress", async () => {
    buildFetchMock();
    render(
      <LogicGridPuzzle puzzleId="p1" logicGridData={LOGIC_CASE_DATA} alreadySolved={false} onSolved={jest.fn()} />
    );
    await flush();
    fireEvent.click(screen.getByRole("tab", { name: "Clues" }));
    for (const clue of LOGIC_CASE_DATA.clues) {
      expect(screen.getByText(clue)).toBeTruthy();
    }
    expect(screen.getByText("0 of 8 clues reviewed")).toBeTruthy();

    const firstCheckbox = screen.getAllByRole("checkbox")[0];
    fireEvent.click(firstCheckbox);
    expect(screen.getByText("1 of 8 clues reviewed")).toBeTruthy();
    expect(juiceMock.tick).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("tab", { name: "Grid" }));
    expect(screen.getByText("0 of 12 facts confirmed")).toBeTruthy();
  });
});

const STRUCTURED_LOGIC_CASE_DATA = {
  intro: LOGIC_CASE_DATA.intro,
  categories: LOGIC_CASE_DATA.categories,
  clues: [
    "Maya did not enter the Vault.",
    {
      id: "same-clue",
      text: "The Library visitor arrived at 8:00.",
      type: "same",
      operands: [
        { categoryId: "room", entry: "Library" },
        { categoryId: "time", entry: "8:00" },
      ],
    },
    {
      text: "Jordan arrived immediately before the guest carrying the Red Journal.",
      type: "immediatelyBefore",
      orderedCategoryId: "time",
      operands: [
        { categoryId: "person", entry: "Jordan" },
        { categoryId: "object", entry: "Red Journal" },
      ],
    },
  ],
};

describe("LogicGridPuzzle — structured clues", () => {
  it("renders structured clue text via clue.text, alongside legacy string clues", async () => {
    buildFetchMock();
    render(
      <LogicGridPuzzle
        puzzleId="p1"
        logicGridData={STRUCTURED_LOGIC_CASE_DATA}
        alreadySolved={false}
        onSolved={jest.fn()}
      />
    );
    await flush();
    fireEvent.click(screen.getByRole("tab", { name: "Clues" }));
    expect(screen.getByText("Maya did not enter the Vault.")).toBeTruthy();
    expect(screen.getByText("The Library visitor arrived at 8:00.")).toBeTruthy();
    expect(
      screen.getByText("Jordan arrived immediately before the guest carrying the Red Journal.")
    ).toBeTruthy();
    expect(screen.getByText("0 of 3 clues reviewed")).toBeTruthy();
  });

  it("never displays clue type, operand, category, ordered-category, or id metadata", async () => {
    buildFetchMock();
    render(
      <LogicGridPuzzle
        puzzleId="p1"
        logicGridData={STRUCTURED_LOGIC_CASE_DATA}
        alreadySolved={false}
        onSolved={jest.fn()}
      />
    );
    await flush();
    fireEvent.click(screen.getByRole("tab", { name: "Clues" }));
    const panel = screen.getByRole("tabpanel");
    for (const forbidden of ["same-clue", "immediatelyBefore", "orderedCategoryId", "categoryId", "operands"]) {
      expect(within(panel).queryByText(new RegExp(forbidden))).toBeNull();
    }
  });

  it("tracks reviewed state by clue id rather than index, surviving reorderable rendering", async () => {
    buildFetchMock();
    render(
      <LogicGridPuzzle
        puzzleId="p1"
        logicGridData={STRUCTURED_LOGIC_CASE_DATA}
        alreadySolved={false}
        onSolved={jest.fn()}
      />
    );
    await flush();
    fireEvent.click(screen.getByRole("tab", { name: "Clues" }));

    const checkboxes = screen.getAllByRole("checkbox") as HTMLInputElement[];
    // Mark the second (structured "same") clue reviewed.
    fireEvent.click(checkboxes[1]);
    expect(screen.getByText("1 of 3 clues reviewed")).toBeTruthy();
    expect(checkboxes[0].checked).toBe(false);
    expect(checkboxes[1].checked).toBe(true);
    expect(checkboxes[2].checked).toBe(false);

    // Toggling it back off restores the count without disturbing the others.
    fireEvent.click(checkboxes[1]);
    expect(screen.getByText("0 of 3 clues reviewed")).toBeTruthy();
  });

  it("preserves visible 1-based clue numbering and accessible labels for structured clues", async () => {
    buildFetchMock();
    render(
      <LogicGridPuzzle
        puzzleId="p1"
        logicGridData={STRUCTURED_LOGIC_CASE_DATA}
        alreadySolved={false}
        onSolved={jest.fn()}
      />
    );
    await flush();
    fireEvent.click(screen.getByRole("tab", { name: "Clues" }));
    expect(screen.getAllByLabelText(/Mark clue \d as reviewed/)).toHaveLength(3);
    expect(screen.getByLabelText("Mark clue 1 as reviewed")).toBeTruthy();
    expect(screen.getByLabelText("Mark clue 2 as reviewed")).toBeTruthy();
    expect(screen.getByLabelText("Mark clue 3 as reviewed")).toBeTruthy();
  });

  it("clue review state remains local-only and does not affect progress or grid interaction", async () => {
    buildFetchMock();
    render(
      <LogicGridPuzzle
        puzzleId="p1"
        logicGridData={STRUCTURED_LOGIC_CASE_DATA}
        alreadySolved={false}
        onSolved={jest.fn()}
      />
    );
    await flush();
    fireEvent.click(screen.getByRole("tab", { name: "Clues" }));
    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    fireEvent.click(screen.getByRole("tab", { name: "Grid" }));
    expect(screen.getByText("0 of 12 facts confirmed")).toBeTruthy();
    fireEvent.click(cellButton("Maya", "Observatory"));
    expect(cellButton("Maya", "Observatory").getAttribute("aria-label")).toMatch(/impossible/);
  });

  it("renders a safe load error for a puzzle with a malformed structured clue rather than crashing", () => {
    buildFetchMock();
    const malformed = {
      intro: LOGIC_CASE_DATA.intro,
      categories: LOGIC_CASE_DATA.categories,
      clues: [{ text: "Broken.", type: "same", operands: [{ categoryId: "person", entry: "Maya" }] }],
    };
    render(<LogicGridPuzzle puzzleId="p1" logicGridData={malformed} alreadySolved={false} onSolved={jest.fn()} />);
    expect(screen.getByText("This logic case could not be loaded.")).toBeTruthy();
  });
});

describe("LogicGridPuzzle — autosave", () => {
  it("does not PATCH before hydration, then debounces exactly one PATCH per move with the exact contract", async () => {
    jest.useFakeTimers();
    const { calls } = buildFetchMock();
    render(
      <LogicGridPuzzle puzzleId="p1" logicGridData={LOGIC_CASE_DATA} alreadySolved={false} onSolved={jest.fn()} />
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(calls.filter((c) => c.method === "PATCH")).toHaveLength(0);

    fireEvent.click(cellButton("Maya", "Observatory"));

    await act(async () => {
      jest.advanceTimersByTime(900);
    });

    const patchCalls = calls.filter((c) => c.method === "PATCH");
    expect(patchCalls).toHaveLength(1);
    expect(patchCalls[0].url).toBe("/api/puzzles/p1/logic-grid");
    expect(patchCalls[0].credentials).toBe("same-origin");
    expect(Object.keys(patchCalls[0].body as object)).toEqual(["cellMarks"]);
  });

  it("Undo triggers its own autosave of the restored state", async () => {
    jest.useFakeTimers();
    const { calls } = buildFetchMock();
    render(
      <LogicGridPuzzle puzzleId="p1" logicGridData={LOGIC_CASE_DATA} alreadySolved={false} onSolved={jest.fn()} />
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    fireEvent.click(cellButton("Maya", "Observatory"));
    await act(async () => {
      jest.advanceTimersByTime(900);
    });
    expect(calls.filter((c) => c.method === "PATCH")).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    await act(async () => {
      jest.advanceTimersByTime(900);
    });

    const patchCalls = calls.filter((c) => c.method === "PATCH");
    expect(patchCalls).toHaveLength(2);
    expect(patchCalls[1].body).toEqual({ cellMarks: {} });
  });

  it("Redo triggers its own autosave of the reapplied state", async () => {
    jest.useFakeTimers();
    const { calls } = buildFetchMock();
    render(
      <LogicGridPuzzle puzzleId="p1" logicGridData={LOGIC_CASE_DATA} alreadySolved={false} onSolved={jest.fn()} />
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    fireEvent.click(cellButton("Maya", "Observatory"));
    await act(async () => {
      jest.advanceTimersByTime(900);
    });
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    await act(async () => {
      jest.advanceTimersByTime(900);
    });
    fireEvent.click(screen.getByRole("button", { name: "Redo" }));
    await act(async () => {
      jest.advanceTimersByTime(900);
    });

    const patchCalls = calls.filter((c) => c.method === "PATCH");
    expect(patchCalls).toHaveLength(3);
    expect(patchCalls[2].body).toEqual({
      cellMarks: { [keyFor("person", "Maya", "room", "Observatory")]: "cross" },
    });
  });
});

describe("LogicGridPuzzle — hydration never autosaves by itself (regression for Pass 26A correction)", () => {
  it("successful hydration with existing marks does not autosave", async () => {
    jest.useFakeTimers();
    const preset = { [keyFor("person", "Maya", "room", "Observatory")]: "check" as const };
    const { calls } = buildFetchMock({ getBody: { cellMarks: preset } });
    render(
      <LogicGridPuzzle puzzleId="p1" logicGridData={LOGIC_CASE_DATA} alreadySolved={false} onSolved={jest.fn()} />
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    expect(calls.filter((c) => c.method === "PATCH")).toHaveLength(0);
    expect(cellButton("Maya", "Observatory").getAttribute("aria-label")).toMatch(/confirmed/);
    expect((screen.getByRole("button", { name: "Undo" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("empty successful hydration does not autosave", async () => {
    jest.useFakeTimers();
    const { calls } = buildFetchMock({ getBody: { cellMarks: {} } });
    render(
      <LogicGridPuzzle puzzleId="p1" logicGridData={LOGIC_CASE_DATA} alreadySolved={false} onSolved={jest.fn()} />
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(calls.filter((c) => c.method === "PATCH")).toHaveLength(0);
  });

  it("malformed hydration does not autosave and the grid safely starts empty", async () => {
    jest.useFakeTimers();
    const { calls } = buildFetchMock({
      getBody: { cellMarks: { "not-a-real-key": "check", "person::Maya::room::Observatory": "maybe" } },
    });
    render(
      <LogicGridPuzzle puzzleId="p1" logicGridData={LOGIC_CASE_DATA} alreadySolved={false} onSolved={jest.fn()} />
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    expect(cellButton("Maya", "Observatory").getAttribute("aria-label")).toMatch(/unknown/);
    expect(calls.filter((c) => c.method === "PATCH")).toHaveLength(0);
  });

  it("rejected hydration does not autosave and the grid safely starts empty (mandatory: protects saved progress)", async () => {
    jest.useFakeTimers();
    const { calls } = buildFetchMock({ getReject: true });
    render(
      <LogicGridPuzzle puzzleId="p1" logicGridData={LOGIC_CASE_DATA} alreadySolved={false} onSolved={jest.fn()} />
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    expect(cellButton("Maya", "Observatory").getAttribute("aria-label")).toMatch(/unknown/);
    expect(calls.filter((c) => c.method === "PATCH")).toHaveLength(0);
  });
});

describe("LogicGridPuzzle — interaction is disabled before hydration completes", () => {
  it("disables cells, Undo, Redo, and Submit until the GET resolves, then enables them", async () => {
    const { resolveGet } = buildDeferredFetchMock();
    render(
      <LogicGridPuzzle puzzleId="p1" logicGridData={LOGIC_CASE_DATA} alreadySolved={false} onSolved={jest.fn()} />
    );
    await act(async () => {
      await Promise.resolve();
    });

    expect(cellButton("Maya", "Observatory").hasAttribute("disabled")).toBe(true);
    expect((screen.getByRole("button", { name: "Undo" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Redo" }) as HTMLButtonElement).disabled).toBe(true);
    expect(
      (screen.getByRole("button", { name: /Confirm every relationship|Submit Solution/ }) as HTMLButtonElement)
        .disabled
    ).toBe(true);

    // A click before hydration must not mutate marks.
    fireEvent.click(cellButton("Maya", "Observatory"));
    expect(cellButton("Maya", "Observatory").getAttribute("aria-label")).toMatch(/unknown/);

    await act(async () => {
      resolveGet("p1", { cellMarks: {} });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(cellButton("Maya", "Observatory").hasAttribute("disabled")).toBe(false);
    fireEvent.click(cellButton("Maya", "Observatory"));
    expect(cellButton("Maya", "Observatory").getAttribute("aria-label")).toMatch(/impossible/);
  });
});

describe("LogicGridPuzzle — puzzleId transition does not cross-save (regression for Pass 26A correction)", () => {
  it("cancels a pending p1 autosave, never sends p1 marks to the p2 endpoint, and requires a fresh p2 move before autosaving", async () => {
    jest.useFakeTimers();
    const { calls, resolveGet } = buildDeferredFetchMock();

    const { rerender } = render(
      <LogicGridPuzzle puzzleId="p1" logicGridData={LOGIC_CASE_DATA} alreadySolved={false} onSolved={jest.fn()} />
    );
    await act(async () => {
      await Promise.resolve();
    });
    resolveGet("p1", { cellMarks: {} });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    // Start a p1 move; its 800ms debounce has not fired yet.
    fireEvent.click(cellButton("Maya", "Observatory"));

    rerender(
      <LogicGridPuzzle puzzleId="p2" logicGridData={LOGIC_CASE_DATA} alreadySolved={false} onSolved={jest.fn()} />
    );
    await act(async () => {
      await Promise.resolve();
    });

    // p2 is not hydrated yet — the grid must stay disabled.
    expect(cellButton("Maya", "Observatory").hasAttribute("disabled")).toBe(true);

    // Even after well past the old debounce window, no PATCH for p1 may occur.
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(calls.filter((c) => c.method === "PATCH" && c.url.includes("/p1/"))).toHaveLength(0);

    resolveGet("p2", { cellMarks: {} });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    // p2 hydrated with its own (empty) marks — no leftover p1 mark, no Undo history.
    expect(cellButton("Maya", "Observatory").getAttribute("aria-label")).toBe("Maya and Observatory: unknown");
    expect((screen.getByRole("button", { name: "Undo" }) as HTMLButtonElement).disabled).toBe(true);

    // Still no PATCH for p2 — hydration alone must not trigger one.
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(calls.filter((c) => c.method === "PATCH" && c.url.includes("/p2/"))).toHaveLength(0);

    // Only a fresh p2 move schedules a p2 PATCH.
    fireEvent.click(cellButton("Maya", "Observatory"));
    await act(async () => {
      jest.advanceTimersByTime(900);
    });
    const p2Patches = calls.filter((c) => c.method === "PATCH" && c.url.includes("/p2/"));
    expect(p2Patches).toHaveLength(1);
    expect(p2Patches[0].body).toEqual({
      cellMarks: { [keyFor("person", "Maya", "room", "Observatory")]: "cross" },
    });
  });
});

describe("LogicGridPuzzle — submission readiness", () => {
  it("disables submit when incomplete and enables it when complete", async () => {
    const marks = buildCompleteMarks();
    buildFetchMock({ getBody: { cellMarks: {} } });
    render(
      <LogicGridPuzzle puzzleId="p1" logicGridData={LOGIC_CASE_DATA} alreadySolved={false} onSolved={jest.fn()} />
    );
    await flush();
    expect(screen.getByText("Confirm every relationship to submit")).toBeTruthy();

    cleanup();
    buildFetchMock({ getBody: { cellMarks: marks } });
    render(
      <LogicGridPuzzle puzzleId="p2" logicGridData={LOGIC_CASE_DATA} alreadySolved={false} onSolved={jest.fn()} />
    );
    await flush();
    expect(screen.getByText("Submit Solution")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Submit Solution" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("POST uses the exact endpoint, credentials, and body shape", async () => {
    const marks = buildCompleteMarks();
    const { calls } = buildFetchMock({
      getBody: { cellMarks: marks },
      postImpl: () => jsonResponse({ correct: false, mismatchedCategories: [] }),
    });
    render(
      <LogicGridPuzzle puzzleId="p1" logicGridData={LOGIC_CASE_DATA} alreadySolved={false} onSolved={jest.fn()} />
    );
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Submit Solution" }));
    await flush();

    const postCall = calls.find((c) => c.method === "POST")!;
    expect(postCall.url).toBe("/api/puzzles/p1/logic-grid");
    expect(postCall.credentials).toBe("same-origin");
    expect(Object.keys(postCall.body as object)).toEqual(["answer"]);
    const answer = (postCall.body as { answer: Record<string, Record<string, string>> }).answer;
    expect(answer.Maya).toBeTruthy();
    expect(Object.keys(answer.Maya).sort()).toEqual(["object", "room", "time"]);
  });
});

describe("LogicGridPuzzle — incorrect submission", () => {
  it("renders a friendly error naming public categories without exposing the answer, and preserves grid state", async () => {
    const marks = buildCompleteMarks();
    buildFetchMock({
      getBody: { cellMarks: marks },
      postImpl: () => jsonResponse({ correct: false, mismatchedCategories: ["room", "time"] }),
    });
    render(
      <LogicGridPuzzle puzzleId="p1" logicGridData={LOGIC_CASE_DATA} alreadySolved={false} onSolved={jest.fn()} />
    );
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Submit Solution" }));
    await flush();

    expect(screen.getByText("Not quite yet.")).toBeTruthy();
    expect(screen.getByText("Rooms, Arrival Times")).toBeTruthy();
    expect(juiceMock.error).toHaveBeenCalledTimes(1);
    expect(cellButton("Maya", "Observatory").getAttribute("aria-label")).toMatch(/confirmed/);
  });

  it("repeated failures can retrigger feedback", async () => {
    const marks = buildCompleteMarks();
    buildFetchMock({
      getBody: { cellMarks: marks },
      postImpl: () => jsonResponse({ correct: false, mismatchedCategories: ["room"] }),
    });
    render(
      <LogicGridPuzzle puzzleId="p1" logicGridData={LOGIC_CASE_DATA} alreadySolved={false} onSolved={jest.fn()} />
    );
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Submit Solution" }));
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Submit Solution" }));
    await flush();
    expect(juiceMock.error).toHaveBeenCalledTimes(2);
  });
});

describe("LogicGridPuzzle — failed submission", () => {
  it("shows the safe retry message on a non-OK response without leaking server details", async () => {
    const marks = buildCompleteMarks();
    buildFetchMock({
      getBody: { cellMarks: marks },
      postImpl: () => jsonResponse({ error: "db exploded for leak@example.test" }, false, 500),
    });
    render(
      <LogicGridPuzzle puzzleId="p1" logicGridData={LOGIC_CASE_DATA} alreadySolved={false} onSolved={jest.fn()} />
    );
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Submit Solution" }));
    await flush();

    expect(screen.getByText("The solution could not be checked.")).toBeTruthy();
    expect(screen.getByText("Your grid is safe—try again.")).toBeTruthy();
    expect(screen.queryByText(/leak@example\.test/)).toBeNull();
    expect(cellButton("Maya", "Observatory").getAttribute("aria-label")).toMatch(/confirmed/);
  });

  it("shows the safe retry message on a rejected fetch", async () => {
    const marks = buildCompleteMarks();
    buildFetchMock({
      getBody: { cellMarks: marks },
      postImpl: () => Promise.reject(new Error("network down")),
    });
    render(
      <LogicGridPuzzle puzzleId="p1" logicGridData={LOGIC_CASE_DATA} alreadySolved={false} onSolved={jest.fn()} />
    );
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Submit Solution" }));
    await flush();

    expect(screen.getByText("The solution could not be checked.")).toBeTruthy();
  });
});

describe("LogicGridPuzzle — correct submission", () => {
  it("solves the board, stops the timer, fires reward/confetti once, shows the overlay, and calls onSolved exactly once", async () => {
    jest.useFakeTimers();
    const marks = buildCompleteMarks();
    const onSolved = jest.fn();
    buildFetchMock({
      getBody: { cellMarks: marks },
      postImpl: () => jsonResponse({ correct: true }),
    });
    const { rerender } = render(
      <LogicGridPuzzle puzzleId="p1" logicGridData={LOGIC_CASE_DATA} alreadySolved={false} onSolved={onSolved} />
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    fireEvent.click(screen.getByRole("button", { name: "Submit Solution" }));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText("CASE SOLVED")).toBeTruthy();
    expect(juiceMock.reward).toHaveBeenCalledTimes(1);
    expect(confettiBurstAtMock).toHaveBeenCalledTimes(1);
    expect(cellButton("Maya", "Observatory").hasAttribute("disabled")).toBe(true);

    await act(async () => {
      jest.advanceTimersByTime(1900);
    });

    expect(onSolved).toHaveBeenCalledTimes(1);
    expect(onSolved.mock.calls[0][0]).toEqual(expect.any(Number));

    rerender(
      <LogicGridPuzzle puzzleId="p1" logicGridData={LOGIC_CASE_DATA} alreadySolved={false} onSolved={onSolved} />
    );
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    expect(onSolved).toHaveBeenCalledTimes(1);
  });
});

describe("LogicGridPuzzle — already solved", () => {
  it("disables cells, hides submit, shows the solved banner, and never calls onSolved", async () => {
    buildFetchMock();
    const onSolved = jest.fn();
    render(
      <LogicGridPuzzle puzzleId="p1" logicGridData={LOGIC_CASE_DATA} alreadySolved onSolved={onSolved} />
    );
    await flush();

    expect(screen.getByText(/You already solved this case!/)).toBeTruthy();
    expect(cellButton("Maya", "Observatory").hasAttribute("disabled")).toBe(true);
    expect(screen.queryByRole("button", { name: "Submit Solution" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Confirm every relationship to submit" })).toBeNull();
    expect(screen.queryByText("CASE SOLVED")).toBeNull();
    expect(onSolved).not.toHaveBeenCalled();
  });

  it("timer does not run while already solved", async () => {
    jest.useFakeTimers();
    buildFetchMock();
    render(
      <LogicGridPuzzle puzzleId="p1" logicGridData={LOGIC_CASE_DATA} alreadySolved onSolved={jest.fn()} />
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    const before = screen.getByText(/^Time /).textContent;
    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    const after = screen.getByText(/^Time /).textContent;
    expect(after).toBe(before);
  });
});

// ── Pass 26B2 — clue focus and teaching guide foundation ──────────────────

const INSTRUCTIONAL_LOGIC_CASE_DATA = {
  intro: LOGIC_CASE_DATA.intro,
  categories: LOGIC_CASE_DATA.categories,
  clues: [
    "Maya did not enter the Vault.",
    {
      id: "same-clue",
      text: "The Library visitor arrived at 8:00.",
      type: "same",
      operands: [
        { categoryId: "room", entry: "Library" },
        { categoryId: "time", entry: "8:00" },
      ],
    },
    {
      id: "notsame-clue",
      text: "Maya cannot have entered the Vault.",
      type: "notSame",
      operands: [
        { categoryId: "person", entry: "Maya" },
        { categoryId: "room", entry: "Vault" },
      ],
    },
    {
      id: "before-clue",
      text: "Jordan arrived immediately before the guest carrying the Red Journal.",
      type: "immediatelyBefore",
      orderedCategoryId: "time",
      operands: [
        { categoryId: "person", entry: "Jordan" },
        { categoryId: "object", entry: "Red Journal" },
      ],
    },
    {
      id: "either-clue",
      text: "Maya carried the Silver Key or the Red Journal.",
      type: "eitherOr",
      operands: [
        { categoryId: "person", entry: "Maya" },
        { categoryId: "object", entry: "Silver Key" },
        { categoryId: "object", entry: "Red Journal" },
      ],
    },
  ],
};

// `hidden: true` because these buttons live in the Clues panel, which the Grid tab hides on
// mobile — tests still need to read/click them (e.g. to check `aria-pressed` right after a
// Focus click switched the active tab) regardless of which panel is currently visible.
function focusButtonFor(clueNumber: number) {
  return screen.queryByRole("button", {
    name: new RegExp(`^(Focus clue ${clueNumber} in the grid|Clear grid focus for clue ${clueNumber})$`),
    hidden: true,
  });
}

function explainButtonFor(clueNumber: number) {
  return screen.queryByRole("button", {
    name: new RegExp(`^(Explain clue ${clueNumber}|Hide explanation for clue ${clueNumber})$`),
    hidden: true,
  });
}

function focusDataAttr(entryA: string, entryB: string): string | null {
  return cellButton(entryA, entryB).getAttribute("data-clue-focus");
}

// The focus-banner id is namespaced per component instance (`${domIdPrefix}-focus-banner`)
// rather than a fixed static id, so tests locate it by suffix instead of an exact id.
function getFocusBanner(scope: ParentNode = document): HTMLElement | null {
  return scope.querySelector('[id$="-focus-banner"]');
}
function getFocusBanners(scope: ParentNode = document): HTMLElement[] {
  return Array.from(scope.querySelectorAll('[id$="-focus-banner"]'));
}

describe("LogicGridPuzzle — instructional clue guidance (Pass 26B2)", () => {
  it("legacy textOnly clue has no Focus or Explain button, and the reviewed checkbox still works", async () => {
    buildFetchMock();
    render(
      <LogicGridPuzzle
        puzzleId="p1"
        logicGridData={INSTRUCTIONAL_LOGIC_CASE_DATA}
        alreadySolved={false}
        onSolved={jest.fn()}
      />
    );
    await flush();
    fireEvent.click(screen.getByRole("tab", { name: "Clues" }));

    expect(focusButtonFor(1)).toBeNull();
    expect(explainButtonFor(1)).toBeNull();

    const checkbox = screen.getAllByRole("checkbox")[0] as HTMLInputElement;
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(true);
    expect(screen.getByText("1 of 5 clues reviewed")).toBeTruthy();
  });

  it("clue cards are not labels; the checkbox has an explicit label; Focus/Explain do not toggle reviewed state", async () => {
    buildFetchMock();
    const { container } = render(
      <LogicGridPuzzle
        puzzleId="p1"
        logicGridData={INSTRUCTIONAL_LOGIC_CASE_DATA}
        alreadySolved={false}
        onSolved={jest.fn()}
      />
    );
    await flush();
    fireEvent.click(screen.getByRole("tab", { name: "Clues" }));

    expect(container.querySelectorAll("label input[type=checkbox]").length).toBe(0);
    const checkbox = screen.getAllByRole("checkbox")[1] as HTMLInputElement;
    expect(checkbox.labels?.length).toBeGreaterThan(0);

    fireEvent.click(explainButtonFor(2)!);
    expect(checkbox.checked).toBe(false);
    fireEvent.click(focusButtonFor(2)!);
    expect(checkbox.checked).toBe(false);
    expect(screen.getByText("0 of 5 clues reviewed")).toBeTruthy();
  });

  it("visible one-based clue numbering remains correct alongside instructional buttons", async () => {
    buildFetchMock();
    render(
      <LogicGridPuzzle
        puzzleId="p1"
        logicGridData={INSTRUCTIONAL_LOGIC_CASE_DATA}
        alreadySolved={false}
        onSolved={jest.fn()}
      />
    );
    await flush();
    fireEvent.click(screen.getByRole("tab", { name: "Clues" }));
    for (const n of [2, 3, 4, 5]) {
      expect(focusButtonFor(n)).toBeTruthy();
      expect(explainButtonFor(n)).toBeTruthy();
    }
  });
});

describe("LogicGridPuzzle — Focus grid behavior", () => {
  it("toggles aria-pressed, switches the mobile tab to Grid, renders the banner, and marks the target cell as primary", async () => {
    const { calls } = buildFetchMock();
    render(
      <LogicGridPuzzle
        puzzleId="p1"
        logicGridData={INSTRUCTIONAL_LOGIC_CASE_DATA}
        alreadySolved={false}
        onSolved={jest.fn()}
      />
    );
    await flush();
    fireEvent.click(screen.getByRole("tab", { name: "Clues" }));

    const focusBtn = focusButtonFor(2)!;
    expect(focusBtn.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(focusBtn);

    expect(screen.getByRole("tab", { name: "Grid" }).getAttribute("aria-selected")).toBe("true");
    const banner = getFocusBanner();
    expect(banner).toBeTruthy();
    expect(within(banner as HTMLElement).getByText("Focused clue 2")).toBeTruthy();
    expect(
      within(banner as HTMLElement).getByText((INSTRUCTIONAL_LOGIC_CASE_DATA.clues[1] as { text: string }).text)
    ).toBeTruthy();

    expect(focusDataAttr("Library", "8:00")).toBe("primary");
    expect(cellButton("Library", "8:00").getAttribute("aria-label")).toContain("highlighted for clue 2");
    expect(focusDataAttr("Maya", "Observatory")).toBeNull();

    expect(focusButtonFor(2)!.getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "Clear focus" }));
    expect(getFocusBanner()).toBeNull();
    expect(focusDataAttr("Library", "8:00")).toBeNull();

    expect(calls.filter((c) => c.method === "PATCH")).toHaveLength(0);
    expect(calls.every((c) => !c.url.includes("consume-hint-token"))).toBe(true);
  });

  it("does not change grid marks, progress, or Undo availability", async () => {
    buildFetchMock();
    render(
      <LogicGridPuzzle
        puzzleId="p1"
        logicGridData={INSTRUCTIONAL_LOGIC_CASE_DATA}
        alreadySolved={false}
        onSolved={jest.fn()}
      />
    );
    await flush();
    fireEvent.click(screen.getByRole("tab", { name: "Clues" }));
    fireEvent.click(focusButtonFor(2)!);

    expect(screen.getByText("0 of 12 facts confirmed")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Undo" }) as HTMLButtonElement).disabled).toBe(true);
    expect(cellButton("Library", "8:00").getAttribute("aria-label")).toContain("unknown");
  });

  it("focusing a different clue replaces the previous focus", async () => {
    buildFetchMock();
    render(
      <LogicGridPuzzle
        puzzleId="p1"
        logicGridData={INSTRUCTIONAL_LOGIC_CASE_DATA}
        alreadySolved={false}
        onSolved={jest.fn()}
      />
    );
    await flush();
    fireEvent.click(screen.getByRole("tab", { name: "Clues" }));

    fireEvent.click(focusButtonFor(2)!); // same-clue
    expect(focusDataAttr("Library", "8:00")).toBe("primary");

    fireEvent.click(focusButtonFor(3)!); // notSame-clue
    expect(focusDataAttr("Library", "8:00")).toBeNull();
    expect(focusDataAttr("Maya", "Vault")).toBe("primary");

    expect(focusButtonFor(2)!.getAttribute("aria-pressed")).toBe("false");
    expect(focusButtonFor(3)!.getAttribute("aria-pressed")).toBe("true");
    expect(getFocusBanners()).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Clear focus" }));
    expect(focusDataAttr("Maya", "Vault")).toBeNull();
  });

  it("same clue: exactly one primary cell and no context cells", async () => {
    buildFetchMock();
    render(
      <LogicGridPuzzle
        puzzleId="p1"
        logicGridData={INSTRUCTIONAL_LOGIC_CASE_DATA}
        alreadySolved={false}
        onSolved={jest.fn()}
      />
    );
    await flush();
    fireEvent.click(screen.getByRole("tab", { name: "Clues" }));
    fireEvent.click(focusButtonFor(2)!);

    const primary = screen.getAllByRole("button").filter((el) => el.getAttribute("data-clue-focus") === "primary");
    const context = screen.getAllByRole("button").filter((el) => el.getAttribute("data-clue-focus") === "context");
    expect(primary).toHaveLength(1);
    expect(context).toHaveLength(0);
    expect(focusDataAttr("Library", "8:00")).toBe("primary");
  });

  it("notSame clue: exactly one primary cell, and no automatic cross is applied", async () => {
    buildFetchMock();
    render(
      <LogicGridPuzzle
        puzzleId="p1"
        logicGridData={INSTRUCTIONAL_LOGIC_CASE_DATA}
        alreadySolved={false}
        onSolved={jest.fn()}
      />
    );
    await flush();
    fireEvent.click(screen.getByRole("tab", { name: "Clues" }));
    fireEvent.click(focusButtonFor(3)!);

    const primary = screen.getAllByRole("button").filter((el) => el.getAttribute("data-clue-focus") === "primary");
    expect(primary).toHaveLength(1);
    expect(focusDataAttr("Maya", "Vault")).toBe("primary");
    expect(cellButton("Maya", "Vault").getAttribute("aria-label")).toContain("unknown");
  });

  it("eitherOr clue: exactly two primary cells and the remaining alternative-category cells are context", async () => {
    buildFetchMock();
    render(
      <LogicGridPuzzle
        puzzleId="p1"
        logicGridData={INSTRUCTIONAL_LOGIC_CASE_DATA}
        alreadySolved={false}
        onSolved={jest.fn()}
      />
    );
    await flush();
    fireEvent.click(screen.getByRole("tab", { name: "Clues" }));
    fireEvent.click(focusButtonFor(5)!);

    expect(focusDataAttr("Maya", "Silver Key")).toBe("primary");
    expect(focusDataAttr("Maya", "Red Journal")).toBe("primary");
    expect(focusDataAttr("Maya", "Brass Compass")).toBe("context");
    expect(focusDataAttr("Maya", "Glass Eye")).toBe("context");

    const primary = screen.getAllByRole("button").filter((el) => el.getAttribute("data-clue-focus") === "primary");
    const context = screen.getAllByRole("button").filter((el) => el.getAttribute("data-clue-focus") === "context");
    expect(primary).toHaveLength(2);
    expect(context).toHaveLength(2);

    expect(screen.getByText("0 of 12 facts confirmed")).toBeTruthy();
  });

  it("cross-category ordered clue: every time cell for both operands is primary, and the direct operand pair is not focused", async () => {
    buildFetchMock();
    render(
      <LogicGridPuzzle
        puzzleId="p1"
        logicGridData={INSTRUCTIONAL_LOGIC_CASE_DATA}
        alreadySolved={false}
        onSolved={jest.fn()}
      />
    );
    await flush();
    fireEvent.click(screen.getByRole("tab", { name: "Clues" }));
    fireEvent.click(focusButtonFor(4)!);

    for (const time of ["8:00", "8:30", "9:00", "9:30"]) {
      expect(focusDataAttr("Jordan", time)).toBe("primary");
      expect(focusDataAttr(time, "Red Journal")).toBe("primary");
    }
    expect(focusDataAttr("Jordan", "Red Journal")).toBeNull();

    // The unrelated Rooms×ArrivalTimes pair headers must not be marked focused.
    for (const el of screen.getAllByText("Rooms")) {
      expect(el.className).not.toMatch(/categoryHeaderFocused/);
    }
  });
});

describe("LogicGridPuzzle — Explain clue behavior", () => {
  it("toggles aria-expanded, renders the guide inside a role=note region referenced by aria-controls, and fires the right juice calls", async () => {
    buildFetchMock();
    render(
      <LogicGridPuzzle
        puzzleId="p1"
        logicGridData={INSTRUCTIONAL_LOGIC_CASE_DATA}
        alreadySolved={false}
        onSolved={jest.fn()}
      />
    );
    await flush();
    fireEvent.click(screen.getByRole("tab", { name: "Clues" }));

    const explainBtn = explainButtonFor(2)!;
    expect(explainBtn.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(explainBtn);
    expect(juiceMock.unlock).toHaveBeenCalledTimes(1);

    const controlsId = explainButtonFor(2)!.getAttribute("aria-controls")!;
    expect(explainButtonFor(2)!.getAttribute("aria-expanded")).toBe("true");
    const panel = document.getElementById(controlsId)!;
    expect(panel.getAttribute("role")).toBe("note");
    expect(within(panel).getByText("Connect these entries")).toBeTruthy();
    expect(within(panel).getByText("Library belongs with 8:00.")).toBeTruthy();
    expect(within(panel).getAllByRole("listitem")).toHaveLength(3);

    fireEvent.click(screen.getByRole("button", { name: "Hide explanation for clue 2" }));
    expect(juiceMock.tick).toHaveBeenCalled();
    expect(document.getElementById(controlsId)).toBeNull();
  });

  it("opening a different clue's guide closes the previously open guide", async () => {
    buildFetchMock();
    render(
      <LogicGridPuzzle
        puzzleId="p1"
        logicGridData={INSTRUCTIONAL_LOGIC_CASE_DATA}
        alreadySolved={false}
        onSolved={jest.fn()}
      />
    );
    await flush();
    fireEvent.click(screen.getByRole("tab", { name: "Clues" }));

    fireEvent.click(explainButtonFor(2)!);
    expect(explainButtonFor(2)!.getAttribute("aria-expanded")).toBe("true");

    fireEvent.click(explainButtonFor(3)!);
    expect(explainButtonFor(2)!.getAttribute("aria-expanded")).toBe("false");
    expect(explainButtonFor(3)!.getAttribute("aria-expanded")).toBe("true");

    expect(document.querySelectorAll('[role="note"]').length).toBe(1);
  });

  it("notSame guide explains ✕, eitherOr guide explains keeping two choices open, ordered guide shows entry sequence and adjacency", async () => {
    buildFetchMock();
    render(
      <LogicGridPuzzle
        puzzleId="p1"
        logicGridData={INSTRUCTIONAL_LOGIC_CASE_DATA}
        alreadySolved={false}
        onSolved={jest.fn()}
      />
    );
    await flush();
    fireEvent.click(screen.getByRole("tab", { name: "Clues" }));

    fireEvent.click(explainButtonFor(3)!);
    expect(screen.getByText(/Mark it ✕ to eliminate the relationship\./)).toBeTruthy();

    fireEvent.click(explainButtonFor(3)!); // close before opening the next, since only one may be open
    fireEvent.click(explainButtonFor(5)!);
    expect(screen.getByText(/two strongly highlighted cells/)).toBeTruthy();

    fireEvent.click(explainButtonFor(5)!);
    fireEvent.click(explainButtonFor(4)!);
    expect(screen.getByText(/8:00 → 8:30 → 9:00 → 9:30/)).toBeTruthy();
    expect(screen.getByText(/positions must be adjacent/)).toBeTruthy();
  });

  it("does not display raw type names, category ids, cell keys, pair keys, or solution text as debug copy", async () => {
    buildFetchMock();
    render(
      <LogicGridPuzzle
        puzzleId="p1"
        logicGridData={INSTRUCTIONAL_LOGIC_CASE_DATA}
        alreadySolved={false}
        onSolved={jest.fn()}
      />
    );
    await flush();
    fireEvent.click(screen.getByRole("tab", { name: "Clues" }));
    fireEvent.click(explainButtonFor(4)!);

    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/\bimmediatelyBefore\b/);
    expect(text).not.toContain("categoryId");
    expect(text).not.toContain("orderedCategoryId");
    expect(text).not.toContain("person::time");
    expect(text).not.toContain("person::Jordan");
  });
});

describe("LogicGridPuzzle — instructional actions never touch the network", () => {
  it("Focus, Clear focus, Explain, and Hide guide never issue any request beyond the initial hydration GET", async () => {
    const { calls } = buildFetchMock();
    render(
      <LogicGridPuzzle
        puzzleId="p1"
        logicGridData={INSTRUCTIONAL_LOGIC_CASE_DATA}
        alreadySolved={false}
        onSolved={jest.fn()}
      />
    );
    await flush();
    fireEvent.click(screen.getByRole("tab", { name: "Clues" }));
    expect(calls).toHaveLength(1);

    fireEvent.click(focusButtonFor(2)!);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Clear focus" }));
    // Focusing switched the mobile tab to Grid — return to Clues to reach the Explain button.
    fireEvent.click(screen.getByRole("tab", { name: "Clues" }));
    fireEvent.click(explainButtonFor(2)!);
    await flush();
    fireEvent.click(explainButtonFor(2)!);

    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe("GET");
    expect(calls.some((c) => c.url.includes("consume-hint-token"))).toBe(false);
  });
});

describe("LogicGridPuzzle — instructional state resets on puzzleId transition", () => {
  it("clears focus and closes the guide when the puzzle changes", async () => {
    buildFetchMock();
    const { rerender } = render(
      <LogicGridPuzzle
        puzzleId="p1"
        logicGridData={INSTRUCTIONAL_LOGIC_CASE_DATA}
        alreadySolved={false}
        onSolved={jest.fn()}
      />
    );
    await flush();
    fireEvent.click(screen.getByRole("tab", { name: "Clues" }));
    fireEvent.click(focusButtonFor(2)!);
    // Focusing switched the mobile tab to Grid — return to Clues to reach the Explain button.
    fireEvent.click(screen.getByRole("tab", { name: "Clues" }));
    fireEvent.click(explainButtonFor(2)!);
    expect(getFocusBanner()).toBeTruthy();

    rerender(
      <LogicGridPuzzle
        puzzleId="p2"
        logicGridData={INSTRUCTIONAL_LOGIC_CASE_DATA}
        alreadySolved={false}
        onSolved={jest.fn()}
      />
    );
    await flush();

    expect(getFocusBanner()).toBeNull();
    expect(document.querySelectorAll('[role="note"]').length).toBe(0);
    fireEvent.click(screen.getByRole("tab", { name: "Clues" }));
    expect(focusButtonFor(2)!.getAttribute("aria-pressed")).toBe("false");
  });
});

describe("LogicGridPuzzle — focus scrolling", () => {
  const originalScrollIntoView = (window.HTMLElement.prototype as unknown as { scrollIntoView?: unknown })
    .scrollIntoView;

  afterEach(() => {
    if (originalScrollIntoView) {
      window.HTMLElement.prototype.scrollIntoView = originalScrollIntoView as () => void;
    } else {
      delete (window.HTMLElement.prototype as unknown as { scrollIntoView?: unknown }).scrollIntoView;
    }
  });

  it("calls scrollIntoView with block:nearest, inline:center, behavior:auto after focusing a supported clue", async () => {
    const scrollMock = jest.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollMock;
    buildFetchMock();
    render(
      <LogicGridPuzzle
        puzzleId="p1"
        logicGridData={INSTRUCTIONAL_LOGIC_CASE_DATA}
        alreadySolved={false}
        onSolved={jest.fn()}
      />
    );
    await flush();
    fireEvent.click(screen.getByRole("tab", { name: "Clues" }));

    expect(scrollMock).not.toHaveBeenCalled();
    fireEvent.click(focusButtonFor(2)!);
    await flush();

    expect(scrollMock).toHaveBeenCalledWith({ block: "nearest", inline: "center", behavior: "auto" });
  });

  it("does not call scrollIntoView again when clearing focus", async () => {
    const scrollMock = jest.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollMock;
    buildFetchMock();
    render(
      <LogicGridPuzzle
        puzzleId="p1"
        logicGridData={INSTRUCTIONAL_LOGIC_CASE_DATA}
        alreadySolved={false}
        onSolved={jest.fn()}
      />
    );
    await flush();
    fireEvent.click(screen.getByRole("tab", { name: "Clues" }));
    fireEvent.click(focusButtonFor(2)!);
    await flush();
    const callsAfterFocus = scrollMock.mock.calls.length;

    fireEvent.click(screen.getByRole("button", { name: "Clear focus" }));
    await flush();
    expect(scrollMock.mock.calls.length).toBe(callsAfterFocus);
  });

  it("does not throw when scrollIntoView is unavailable", async () => {
    delete (window.HTMLElement.prototype as unknown as { scrollIntoView?: unknown }).scrollIntoView;
    buildFetchMock();
    render(
      <LogicGridPuzzle
        puzzleId="p1"
        logicGridData={INSTRUCTIONAL_LOGIC_CASE_DATA}
        alreadySolved={false}
        onSolved={jest.fn()}
      />
    );
    await flush();
    fireEvent.click(screen.getByRole("tab", { name: "Clues" }));
    expect(() => fireEvent.click(focusButtonFor(2)!)).not.toThrow();
  });
});

// ── Pass 26B2 correction — safe DOM ids and desktop scroll suppression ────

const SPECIAL_ID_LOGIC_CASE_DATA = {
  intro: LOGIC_CASE_DATA.intro,
  categories: LOGIC_CASE_DATA.categories,
  clues: [
    "Maya did not enter the Vault.",
    {
      id: "arrival clue: one",
      text: "The Library visitor arrived at 8:00.",
      type: "same",
      operands: [
        { categoryId: "room", entry: "Library" },
        { categoryId: "time", entry: "8:00" },
      ],
    },
    {
      id: "object/clue two",
      text: "Maya cannot have entered the Vault.",
      type: "notSame",
      operands: [
        { categoryId: "person", entry: "Maya" },
        { categoryId: "room", entry: "Vault" },
      ],
    },
  ],
};

function mockDesktopMatchMedia() {
  window.matchMedia = jest.fn().mockImplementation((query: string) => ({
    matches: true,
    media: query,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  })) as unknown as typeof window.matchMedia;
}

describe("LogicGridPuzzle — safe DOM ids for authored clue ids containing unsafe characters", () => {
  afterEach(() => {
    // @ts-expect-error -- jsdom does not define matchMedia by default; restore that absence.
    delete window.matchMedia;
  });

  it("generates whitespace-free checkbox and guide ids, with htmlFor/aria-controls matching exactly", async () => {
    buildFetchMock();
    const { container } = render(
      <LogicGridPuzzle
        puzzleId="p1"
        logicGridData={SPECIAL_ID_LOGIC_CASE_DATA}
        alreadySolved={false}
        onSolved={jest.fn()}
      />
    );
    await flush();
    fireEvent.click(screen.getByRole("tab", { name: "Clues" }));

    const checkboxes = screen.getAllByRole("checkbox") as HTMLInputElement[];
    for (const checkbox of checkboxes) {
      expect(checkbox.id).not.toMatch(/\s/);
      expect(checkbox.id).not.toContain("arrival clue");
      expect(checkbox.id).not.toContain("object/clue");
      const label = container.querySelector(`label[for="${checkbox.id}"]`);
      expect(label).toBeTruthy();
    }

    fireEvent.click(explainButtonFor(2)!);
    const explainBtn2 = explainButtonFor(2)!;
    const controlsId2 = explainBtn2.getAttribute("aria-controls")!;
    expect(controlsId2).not.toMatch(/\s/);
    expect(controlsId2).not.toContain("arrival clue");
    expect(document.getElementById(controlsId2)).toBeTruthy();

    fireEvent.click(explainButtonFor(2)!);
    fireEvent.click(explainButtonFor(3)!);
    const explainBtn3 = explainButtonFor(3)!;
    const controlsId3 = explainBtn3.getAttribute("aria-controls")!;
    expect(controlsId3).not.toMatch(/\s/);
    expect(controlsId3).not.toContain("object/clue");
    expect(document.getElementById(controlsId3)).toBeTruthy();

    // No duplicate DOM ids anywhere in the rendered tree.
    const allIds = Array.from(container.querySelectorAll("[id]")).map((el) => el.id);
    expect(new Set(allIds).size).toBe(allIds.length);
  });

  it("focus and review state still track the correct clue despite unsafe authored ids", async () => {
    buildFetchMock();
    render(
      <LogicGridPuzzle
        puzzleId="p1"
        logicGridData={SPECIAL_ID_LOGIC_CASE_DATA}
        alreadySolved={false}
        onSolved={jest.fn()}
      />
    );
    await flush();
    fireEvent.click(screen.getByRole("tab", { name: "Clues" }));

    const checkboxes = screen.getAllByRole("checkbox") as HTMLInputElement[];
    fireEvent.click(checkboxes[1]);
    expect(checkboxes[1].checked).toBe(true);
    expect(checkboxes[0].checked).toBe(false);
    expect(checkboxes[2].checked).toBe(false);
    expect(screen.getByText("1 of 3 clues reviewed")).toBeTruthy();

    fireEvent.click(focusButtonFor(3)!);
    expect(focusDataAttr("Maya", "Vault")).toBe("primary");
  });
});

describe("LogicGridPuzzle — multiple mounted instances never collide on DOM ids", () => {
  afterEach(() => {
    // @ts-expect-error -- restore jsdom's default (undefined) matchMedia.
    delete window.matchMedia;
  });

  function renderTwoInstances() {
    buildFetchMock();
    return render(
      <>
        <div data-testid="wrapper-a">
          <LogicGridPuzzle
            puzzleId="instance-a"
            logicGridData={INSTRUCTIONAL_LOGIC_CASE_DATA}
            alreadySolved={false}
            onSolved={jest.fn()}
          />
        </div>
        <div data-testid="wrapper-b">
          <LogicGridPuzzle
            puzzleId="instance-b"
            logicGridData={INSTRUCTIONAL_LOGIC_CASE_DATA}
            alreadySolved={false}
            onSolved={jest.fn()}
          />
        </div>
      </>
    );
  }

  it("every id in the rendered document is unique — no exclusions, including tabs/panels/focus banner", async () => {
    const { container } = renderTwoInstances();
    await flush();

    const cluesTabs = screen.getAllByRole("tab", { name: "Clues" });
    fireEvent.click(cluesTabs[0]);
    fireEvent.click(cluesTabs[1]);

    const checkboxes = screen.getAllByRole("checkbox") as HTMLInputElement[];
    // 5 clues per instance, x2 instances.
    expect(checkboxes).toHaveLength(10);
    const checkboxIds = checkboxes.map((c) => c.id);
    expect(new Set(checkboxIds).size).toBe(checkboxIds.length);

    for (const checkbox of checkboxes) {
      const label = container.querySelector(`label[for="${checkbox.id}"]`);
      expect(label).toBeTruthy();
    }

    const explainButtons = screen.getAllByRole("button", { name: /^Explain clue 2$/, hidden: true });
    expect(explainButtons).toHaveLength(2);
    fireEvent.click(explainButtons[0]);
    fireEvent.click(explainButtons[1]);
    const controlsIds = explainButtons.map((b) => b.getAttribute("aria-controls"));
    expect(controlsIds[0]).not.toBe(controlsIds[1]);
    expect(document.getElementById(controlsIds[0]!)).toBeTruthy();
    expect(document.getElementById(controlsIds[1]!)).toBeTruthy();

    const focusButtonsClue2 = screen.getAllByRole("button", { name: "Focus clue 2 in the grid", hidden: true });
    expect(focusButtonsClue2).toHaveLength(2);
    fireEvent.click(focusButtonsClue2[1]); // focuses within instance B's now-active Clues panel

    // Every id anywhere in the rendered tree — tabs, panels, focus banner, checkboxes, guides —
    // must be unique across both simultaneously mounted instances. No exclusions.
    const allIds = Array.from(container.querySelectorAll("[id]")).map((el) => el.id);
    expect(allIds.length).toBeGreaterThan(0);
    expect(new Set(allIds).size).toBe(allIds.length);
  });

  it("each instance's tabs control and are labelled by only its own panels", async () => {
    renderTwoInstances();
    await flush();

    const wrapperA = screen.getByTestId("wrapper-a");
    const wrapperB = screen.getByTestId("wrapper-b");

    for (const wrapper of [wrapperA, wrapperB]) {
      const scoped = within(wrapper);
      for (const tabName of ["Clues", "Grid", "Case Board"] as const) {
        const tab = scoped.getByRole("tab", { name: tabName });
        const panelId = tab.getAttribute("aria-controls")!;
        const panel = Array.from(wrapper.querySelectorAll<HTMLElement>('[role="tabpanel"]')).find(
          (el) => el.id === panelId
        );
        expect(panel).toBeTruthy();
        expect(panel!.id).toBe(panelId);
        expect(panel!.getAttribute("aria-labelledby")).toBe(tab.id);
        // The referenced panel must live inside this same wrapper, not the other instance's.
        expect(wrapper.contains(panel ?? null)).toBe(true);
      }
    }

    // Instance A's tab ids must never equal instance B's tab ids (and likewise for panels).
    const tabIdsA = within(wrapperA)
      .getAllByRole("tab", { hidden: true })
      .map((t) => t.id);
    const tabIdsB = within(wrapperB)
      .getAllByRole("tab", { hidden: true })
      .map((t) => t.id);
    expect(tabIdsA.some((id) => tabIdsB.includes(id))).toBe(false);
  });

  it("each instance's focused cells reference only its own focus banner, and focus/clear are independent", async () => {
    renderTwoInstances();
    await flush();

    const wrapperA = screen.getByTestId("wrapper-a");
    const wrapperB = screen.getByTestId("wrapper-b");

    fireEvent.click(within(wrapperA).getByRole("tab", { name: "Clues" }));
    fireEvent.click(within(wrapperB).getByRole("tab", { name: "Clues" }));

    const focusBtnA = within(wrapperA).getByRole("button", { name: "Focus clue 2 in the grid", hidden: true });
    const focusBtnB = within(wrapperB).getByRole("button", { name: "Focus clue 2 in the grid", hidden: true });
    fireEvent.click(focusBtnA);
    fireEvent.click(focusBtnB);

    const bannerA = getFocusBanner(wrapperA)!;
    const bannerB = getFocusBanner(wrapperB)!;
    expect(bannerA).toBeTruthy();
    expect(bannerB).toBeTruthy();
    expect(bannerA.id).not.toBe(bannerB.id);

    const focusedCellsA = wrapperA.querySelectorAll('[data-clue-focus="primary"]');
    const focusedCellsB = wrapperB.querySelectorAll('[data-clue-focus="primary"]');
    expect(focusedCellsA.length).toBeGreaterThan(0);
    expect(focusedCellsB.length).toBeGreaterThan(0);
    for (const cell of Array.from(focusedCellsA)) {
      expect(cell.getAttribute("aria-describedby")).toBe(bannerA.id);
    }
    for (const cell of Array.from(focusedCellsB)) {
      expect(cell.getAttribute("aria-describedby")).toBe(bannerB.id);
    }

    // Clearing focus in instance A must not affect instance B.
    fireEvent.click(within(wrapperA).getByRole("button", { name: "Clear focus" }));
    expect(getFocusBanner(wrapperA)).toBeNull();
    expect(getFocusBanner(wrapperB)).toBeTruthy();
  });
});

describe("LogicGridPuzzle — focus scrolling is mobile/tablet-only", () => {
  afterEach(() => {
    // @ts-expect-error -- restore jsdom's default (undefined) matchMedia.
    delete window.matchMedia;
  });

  it("calls scrollIntoView exactly once at mobile widths (no matchMedia => defaults to mobile layout)", async () => {
    const scrollMock = jest.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollMock;
    buildFetchMock();
    render(
      <LogicGridPuzzle
        puzzleId="p1"
        logicGridData={INSTRUCTIONAL_LOGIC_CASE_DATA}
        alreadySolved={false}
        onSolved={jest.fn()}
      />
    );
    await flush();
    fireEvent.click(screen.getByRole("tab", { name: "Clues" }));
    fireEvent.click(focusButtonFor(2)!);
    await flush();

    expect(scrollMock).toHaveBeenCalledTimes(1);
    expect(scrollMock).toHaveBeenCalledWith({ block: "nearest", inline: "center", behavior: "auto" });
    delete (window.HTMLElement.prototype as unknown as { scrollIntoView?: unknown }).scrollIntoView;
  });

  it("does not call scrollIntoView at desktop widths, while focus banner and grid attributes still apply", async () => {
    mockDesktopMatchMedia();
    const scrollMock = jest.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollMock;
    buildFetchMock();
    render(
      <LogicGridPuzzle
        puzzleId="p1"
        logicGridData={INSTRUCTIONAL_LOGIC_CASE_DATA}
        alreadySolved={false}
        onSolved={jest.fn()}
      />
    );
    await flush();
    fireEvent.click(focusButtonFor(2)!);
    await flush();

    expect(scrollMock).not.toHaveBeenCalled();
    expect(getFocusBanner()).toBeTruthy();
    expect(focusDataAttr("Library", "8:00")).toBe("primary");

    // All three panels remain rendered (no `hidden`) at desktop widths.
    expect(screen.getByRole("tabpanel", { name: "Clues" }).hasAttribute("hidden")).toBe(false);
    expect(screen.getByRole("tabpanel", { name: "Grid" }).hasAttribute("hidden")).toBe(false);
    expect(screen.getByRole("tabpanel", { name: "Case Board" }).hasAttribute("hidden")).toBe(false);

    delete (window.HTMLElement.prototype as unknown as { scrollIntoView?: unknown }).scrollIntoView;
  });
});

// ── Pass 26D1 — synchronize late-arriving solved progress ──────────────────

describe("LogicGridPuzzle — late solved-progress synchronization (Pass 26D1)", () => {
  it("Test A: a late false-to-true alreadySolved transition immediately locks the puzzle without firing a fresh completion", async () => {
    const marks = buildCompleteMarks();
    const onSolved = jest.fn();
    const { calls } = buildFetchMock({ getBody: { cellMarks: marks } });
    const { rerender } = render(
      <LogicGridPuzzle puzzleId="p1" logicGridData={LOGIC_CASE_DATA} alreadySolved={false} onSolved={onSolved} />
    );
    await flush();

    expect(screen.getByRole("button", { name: "Submit Solution" })).toBeTruthy();
    expect(cellButton("Maya", "Observatory").hasAttribute("disabled")).toBe(false);

    const callsBefore = calls.length;

    rerender(
      <LogicGridPuzzle puzzleId="p1" logicGridData={LOGIC_CASE_DATA} alreadySolved={true} onSolved={onSolved} />
    );
    await flush();

    expect(screen.getByText(/You already solved this case!/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Submit Solution" })).toBeNull();
    expect(cellButton("Maya", "Observatory").hasAttribute("disabled")).toBe(true);
    expect((screen.getByRole("button", { name: "Undo" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Redo" }) as HTMLButtonElement).disabled).toBe(true);
    expect(cellButton("Maya", "Observatory").getAttribute("aria-label")).toMatch(/confirmed/);

    expect(onSolved).not.toHaveBeenCalled();
    expect(juiceMock.reward).not.toHaveBeenCalled();
    expect(confettiBurstAtMock).not.toHaveBeenCalled();
    expect(screen.queryByText("CASE SOLVED")).toBeNull();
    expect(calls.slice(callsBefore).some((c) => c.method === "POST")).toBe(false);
    expect(calls.slice(callsBefore).some((c) => c.method === "PATCH")).toBe(false);
  });

  it("Test B: a solved confirmation that arrives before hydration finishes still locks the puzzle, and later-hydrated marks display without autosaving", async () => {
    const { calls, resolveGet } = buildDeferredFetchMock();
    const { rerender } = render(
      <LogicGridPuzzle puzzleId="p1" logicGridData={LOGIC_CASE_DATA} alreadySolved={false} onSolved={jest.fn()} />
    );
    await act(async () => {
      await Promise.resolve();
    });

    rerender(
      <LogicGridPuzzle puzzleId="p1" logicGridData={LOGIC_CASE_DATA} alreadySolved={true} onSolved={jest.fn()} />
    );
    await flush();

    expect(screen.getByText(/You already solved this case!/)).toBeTruthy();
    expect(cellButton("Maya", "Observatory").hasAttribute("disabled")).toBe(true);

    const key = keyFor("person", "Maya", "room", "Observatory");
    await act(async () => {
      resolveGet("p1", { cellMarks: { [key]: "check" } });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(cellButton("Maya", "Observatory").getAttribute("aria-label")).toMatch(/confirmed/);
    expect(screen.getByText(/You already solved this case!/)).toBeTruthy();
    expect(calls.filter((c) => c.method === "PATCH")).toHaveLength(0);
  });

  it("Test C: the timer stops immediately on a late solved confirmation and no longer advances", async () => {
    jest.useFakeTimers();
    buildFetchMock();
    const { rerender } = render(
      <LogicGridPuzzle puzzleId="p1" logicGridData={LOGIC_CASE_DATA} alreadySolved={false} onSolved={jest.fn()} />
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const initial = screen.getByText(/^Time /).textContent;
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    const afterRunning = screen.getByText(/^Time /).textContent;
    expect(afterRunning).not.toBe(initial);

    rerender(
      <LogicGridPuzzle puzzleId="p1" logicGridData={LOGIC_CASE_DATA} alreadySolved={true} onSolved={jest.fn()} />
    );
    await act(async () => {
      await Promise.resolve();
    });
    const atConfirmation = screen.getByText(/^Time /).textContent;

    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    const afterStopped = screen.getByText(/^Time /).textContent;
    expect(afterStopped).toBe(atConfirmation);
  });

  it("Test D (mandatory): a stale false alreadySolved prop cannot reopen a puzzle solved by a real local submission", async () => {
    jest.useFakeTimers();
    const marks = buildCompleteMarks();
    const onSolved = jest.fn();
    const { calls } = buildFetchMock({
      getBody: { cellMarks: marks },
      postImpl: () => jsonResponse({ correct: true }),
    });
    const { rerender } = render(
      <LogicGridPuzzle puzzleId="p1" logicGridData={LOGIC_CASE_DATA} alreadySolved={false} onSolved={onSolved} />
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    fireEvent.click(screen.getByRole("button", { name: "Submit Solution" }));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText(/You already solved this case!/)).toBeTruthy();
    expect(cellButton("Maya", "Observatory").hasAttribute("disabled")).toBe(true);
    const postCallsAfterSubmit = calls.filter((c) => c.method === "POST").length;
    expect(postCallsAfterSubmit).toBe(1);

    rerender(
      <LogicGridPuzzle puzzleId="p1" logicGridData={LOGIC_CASE_DATA} alreadySolved={false} onSolved={onSolved} />
    );
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText(/You already solved this case!/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Submit Solution" })).toBeNull();

    const labelBefore = cellButton("Maya", "Observatory").getAttribute("aria-label");
    fireEvent.click(cellButton("Maya", "Observatory"));
    expect(cellButton("Maya", "Observatory").getAttribute("aria-label")).toBe(labelBefore);

    expect(calls.filter((c) => c.method === "POST")).toHaveLength(1);

    await act(async () => {
      jest.advanceTimersByTime(1900);
    });

    expect(onSolved).toHaveBeenCalledTimes(1);
  });

  it("Test E: parent confirmation true then a stale false rerender remains solved and locked", async () => {
    buildFetchMock();
    const { rerender } = render(
      <LogicGridPuzzle puzzleId="p1" logicGridData={LOGIC_CASE_DATA} alreadySolved={false} onSolved={jest.fn()} />
    );
    await flush();

    rerender(
      <LogicGridPuzzle puzzleId="p1" logicGridData={LOGIC_CASE_DATA} alreadySolved={true} onSolved={jest.fn()} />
    );
    await flush();
    expect(screen.getByText(/You already solved this case!/)).toBeTruthy();

    rerender(
      <LogicGridPuzzle puzzleId="p1" logicGridData={LOGIC_CASE_DATA} alreadySolved={false} onSolved={jest.fn()} />
    );
    await flush();

    expect(screen.getByText(/You already solved this case!/)).toBeTruthy();
    expect(cellButton("Maya", "Observatory").hasAttribute("disabled")).toBe(true);
  });

  it("Test F: solved state does not cross puzzle IDs — p1 solved does not leak into a freshly transitioned p2", async () => {
    jest.useFakeTimers();
    const { calls, resolveGet } = buildDeferredFetchMock();
    const { rerender } = render(
      <LogicGridPuzzle puzzleId="p1" logicGridData={LOGIC_CASE_DATA} alreadySolved={true} onSolved={jest.fn()} />
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText(/You already solved this case!/)).toBeTruthy();

    rerender(
      <LogicGridPuzzle puzzleId="p2" logicGridData={LOGIC_CASE_DATA} alreadySolved={false} onSolved={jest.fn()} />
    );
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.queryByText(/You already solved this case!/)).toBeNull();
    expect(cellButton("Maya", "Observatory").hasAttribute("disabled")).toBe(true);

    await act(async () => {
      resolveGet("p2", { cellMarks: {} });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(cellButton("Maya", "Observatory").hasAttribute("disabled")).toBe(false);
    expect(cellButton("Maya", "Observatory").getAttribute("aria-label")).toBe("Maya and Observatory: unknown");
    expect((screen.getByRole("button", { name: "Undo" }) as HTMLButtonElement).disabled).toBe(true);
    expect(calls.filter((c) => c.method === "PATCH" && c.url.includes("/p2/"))).toHaveLength(0);

    const p2TimeBefore = screen.getByText(/^Time /).textContent;
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    const p2TimeAfter = screen.getByText(/^Time /).textContent;
    expect(p2TimeAfter).not.toBe(p2TimeBefore);
  });

  it("Test G: transitioning to another already-solved puzzle immediately shows its own solved banner", async () => {
    const { resolveGet } = buildDeferredFetchMock();
    const { rerender } = render(
      <LogicGridPuzzle puzzleId="p1" logicGridData={LOGIC_CASE_DATA} alreadySolved={false} onSolved={jest.fn()} />
    );
    await act(async () => {
      await Promise.resolve();
    });

    rerender(
      <LogicGridPuzzle puzzleId="p2" logicGridData={LOGIC_CASE_DATA} alreadySolved={true} onSolved={jest.fn()} />
    );
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText(/You already solved this case!/)).toBeTruthy();

    await act(async () => {
      resolveGet("p2", { cellMarks: {} });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(cellButton("Maya", "Observatory").hasAttribute("disabled")).toBe(true);
    expect(screen.queryByRole("button", { name: "Submit Solution" })).toBeNull();
  });

  it("Test H: instructional controls (Focus, Explain, reviewed checkbox) remain usable on an already-solved puzzle without any network write", async () => {
    const { calls } = buildFetchMock();
    render(
      <LogicGridPuzzle
        puzzleId="p1"
        logicGridData={INSTRUCTIONAL_LOGIC_CASE_DATA}
        alreadySolved
        onSolved={jest.fn()}
      />
    );
    await flush();
    fireEvent.click(screen.getByRole("tab", { name: "Clues" }));

    fireEvent.click(focusButtonFor(2)!);
    expect(getFocusBanner()).toBeTruthy();
    expect(focusDataAttr("Library", "8:00")).toBe("primary");

    // Focusing a clue switches the mobile tab back to Grid — return to Clues before
    // interacting with clue-panel controls.
    fireEvent.click(screen.getByRole("tab", { name: "Clues" }));

    fireEvent.click(explainButtonFor(2)!);
    expect(explainButtonFor(2)!.getAttribute("aria-expanded")).toBe("true");

    const checkbox = screen.getAllByRole("checkbox")[0] as HTMLInputElement;
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(true);

    expect(cellButton("Library", "8:00", true).getAttribute("aria-label")).toContain("unknown");
    expect(calls.some((c) => c.method === "POST")).toBe(false);
    expect(calls.some((c) => c.method === "PATCH")).toBe(false);
  });
});
