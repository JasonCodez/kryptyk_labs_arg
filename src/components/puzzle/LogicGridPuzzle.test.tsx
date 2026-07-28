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
    expect(screen.getByRole("tabpanel").id).toBe("logic-grid-panel-clues");
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
