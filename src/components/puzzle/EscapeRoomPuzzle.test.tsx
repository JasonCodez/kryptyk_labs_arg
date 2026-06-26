/** @jest-environment jsdom */

import { act, render, screen, waitFor } from "@testing-library/react";
import { EscapeRoomPuzzle } from "./EscapeRoomPuzzle";

type SocketHandler = (payload?: any) => void;
const socketHandlers: Record<string, SocketHandler | undefined> = {};

const mockSocket: { on: jest.Mock; emit: jest.Mock; disconnect: jest.Mock } = {
  on: jest.fn((event: string, handler: SocketHandler) => {
    socketHandlers[event] = handler;
    return mockSocket;
  }),
  emit: jest.fn(),
  disconnect: jest.fn(),
};

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("socket.io-client", () => ({
  io: jest.fn(() => mockSocket),
}));

jest.mock("@/components/ActionModal", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("@/components/puzzle/PuzzleModal", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("@/components/puzzle/StageCelebration", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("@/components/puzzle/mini/MiniPuzzleModal", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("@/components/puzzle/RoomIntroPlayer", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("./PixiRoom", () => ({
  __esModule: true,
  default: () => null,
}));

function okJson(body: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: async () => body,
  } as any);
}

describe("EscapeRoomPuzzle pre-run fallback sync", () => {
  const originalConsoleError = console.error;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    for (const key of Object.keys(socketHandlers)) {
      delete socketHandlers[key];
    }
    mockSocket.on.mockImplementation((event: string, handler: SocketHandler) => {
      socketHandlers[event] = handler;
      return mockSocket;
    });
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation((firstArg?: unknown, ...rest: unknown[]) => {
      const text = [firstArg, ...rest].map((v) => String(v ?? "")).join(" ");
      const isKnownNonBooleanAttrNoise =
        text.includes("non-boolean attribute") && (text.includes("jsx") || text.includes("global"));
      if (
        text.includes("Could not parse CSS stylesheet") ||
        text.includes("css parsing") ||
        isKnownNonBooleanAttrNoise
      ) {
        return;
      }
      originalConsoleError(firstArg as any, ...(rest as any[]));
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    consoleErrorSpy.mockRestore();
  });

  test("unblocks non-leaders when polling detects a started run after a missed realtime event", async () => {
    let stateReads = 0;

    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("/api/puzzles/escape-room/p1?teamId=team-1")) {
        return okJson({
          id: "er-1",
          minTeamSize: 2,
          puzzle: {
            title: "Test Escape Room",
            description: "Read the briefing carefully, then acknowledge when ready.",
            intro: null,
            outro: null,
          },
          stages: [
            {
              id: "stage-1",
              order: 1,
              title: "Stage One",
              description: null,
              puzzleType: "interaction",
              puzzleData: {},
              hints: [],
              rewardItem: null,
              rewardDescription: null,
            },
          ],
          layouts: [],
        });
      }

      if (url === "/api/user/info") {
        return okJson({ id: "u-1", name: "Player One" });
      }

      if (url === "/api/user/settings") {
        return okJson({ soundEnabled: true });
      }

      if (url.includes("/api/puzzles/escape-room/p1/state?teamId=team-1")) {
        stateReads += 1;
        const started = stateReads >= 3;

        return okJson({
          inventory: [],
          inventoryItems: {},
          sceneState: {},
          currentStageIndex: 1,
          solvedStages: "[]",
          briefingAcks: {
            "u-1": "2026-04-28T00:00:00.000Z",
            "u-2": "2026-04-28T00:00:00.000Z",
          },
          inventoryLocks: {},
          runStartedAt: started ? "2026-04-28T00:01:00.000Z" : null,
          runExpiresAt: started ? "2026-04-28T00:31:00.000Z" : null,
          failedAt: null,
          failedReason: null,
          completedAt: null,
          isLeader: false,
          pausedAt: null,
          pausedRemainingMs: null,
        });
      }

      if (url.includes("/api/team/lobby/chat")) {
        return okJson({ messages: [] });
      }

      return okJson({});
    }) as any;

    render(<EscapeRoomPuzzle puzzleId="p1" teamId="team-1" />);

    await waitFor(() => {
      expect(screen.getByText(/Mission Briefing/i)).toBeTruthy();
    });

    expect(screen.getByText(/Waiting for leader to begin/i)).toBeTruthy();

    await act(async () => {
      jest.advanceTimersByTime(2600);
    });

    await waitFor(() => {
      expect(screen.queryByText(/Waiting for leader to begin/i)).toBeNull();
    });

    expect(screen.getByText(/Timer/i)).toBeTruthy();
  });

  test("updates briefing acknowledgment count from realtime escapeSessionUpdated payload", async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("/api/puzzles/escape-room/p2?teamId=team-2")) {
        return okJson({
          id: "er-2",
          minTeamSize: 2,
          puzzle: {
            title: "Ack Sync Room",
            description: "Briefing text",
            intro: null,
            outro: null,
          },
          stages: [
            {
              id: "stage-1",
              order: 1,
              title: "Stage One",
              description: null,
              puzzleType: "interaction",
              puzzleData: {},
              hints: [],
              rewardItem: null,
              rewardDescription: null,
            },
          ],
          layouts: [],
        });
      }

      if (url === "/api/user/info") {
        return okJson({ id: "u-1", name: "Player One" });
      }

      if (url === "/api/user/settings") {
        return okJson({ soundEnabled: true });
      }

      if (url.includes("/api/puzzles/escape-room/p2/state?teamId=team-2")) {
        return okJson({
          inventory: [],
          inventoryItems: {},
          sceneState: {},
          currentStageIndex: 1,
          solvedStages: "[]",
          briefingAcks: {
            "u-1": "2026-04-28T00:00:00.000Z",
          },
          inventoryLocks: {},
          runStartedAt: null,
          runExpiresAt: null,
          failedAt: null,
          failedReason: null,
          completedAt: null,
          isLeader: false,
          pausedAt: null,
          pausedRemainingMs: null,
        });
      }

      if (url.includes("/api/team/lobby/chat")) {
        return okJson({ messages: [] });
      }

      return okJson({});
    }) as any;

    render(<EscapeRoomPuzzle puzzleId="p2" teamId="team-2" />);

    await waitFor(() => {
      expect(screen.getByText(/Mission Briefing/i)).toBeTruthy();
    });

    expect(screen.getByText(/Acknowledged:\s*1\/2/i)).toBeTruthy();

    await waitFor(() => {
      expect(socketHandlers.escapeSessionUpdated).toBeDefined();
    });

    await act(async () => {
      socketHandlers.escapeSessionUpdated?.({
        teamId: "team-2",
        puzzleId: "p2",
        briefingAcks: {
          "u-1": "2026-04-28T00:00:00.000Z",
          "u-2": "2026-04-28T00:00:05.000Z",
        },
      });
    });

    await waitFor(() => {
      expect(screen.getByText(/Acknowledged:\s*2\/2/i)).toBeTruthy();
    });
  });
});
