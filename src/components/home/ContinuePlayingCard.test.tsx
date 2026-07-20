/** @jest-environment jsdom */

import { act, cleanup, render, screen } from "@testing-library/react";
import ContinuePlayingCard from "./ContinuePlayingCard";

const mockUseSession = jest.fn();
jest.mock("next-auth/react", () => ({
  useSession: () => mockUseSession(),
}));

function mockFetchOnce(body: unknown, ok = true) {
  global.fetch = jest.fn(() => Promise.resolve({ ok, json: () => Promise.resolve(body) } as Response)) as jest.Mock;
}

const ACTIVE_PUZZLE = {
  id: "puzzle-123",
  title: "The Vanishing Vault",
  category: { id: "cat-1", name: "Detective" },
  difficulty: "Hard",
  completionPercentage: 40,
  attempts: 2,
};

async function renderCard() {
  const result = render(<ContinuePlayingCard />);
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  return result;
}

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
});

describe("ContinuePlayingCard", () => {
  it("guest: renders nothing and never calls the continue-playing endpoint", async () => {
    mockUseSession.mockReturnValue({ status: "unauthenticated" });
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy as jest.Mock;
    const { container } = await renderCard();

    expect(container.firstChild).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("authenticated with an active puzzle: shows title, category, difficulty, resume action, and progress", async () => {
    mockUseSession.mockReturnValue({ status: "authenticated" });
    mockFetchOnce({ puzzle: ACTIVE_PUZZLE });
    await renderCard();

    const link = document.querySelector(`a[href="/puzzles/${ACTIVE_PUZZLE.id}"]`);
    expect(link).not.toBeNull();
    expect(screen.getByText("The Vanishing Vault")).toBeTruthy();
    expect(screen.getByText(/Detective/)).toBeTruthy();
    expect(screen.getByText(/Hard/)).toBeTruthy();
    expect(screen.getByText("Resume puzzle")).toBeTruthy();
    expect(screen.getByText("40%")).toBeTruthy();

    const bar = screen.getByRole("progressbar", { name: "Puzzle progress" });
    expect(bar.getAttribute("aria-valuemin")).toBe("0");
    expect(bar.getAttribute("aria-valuemax")).toBe("100");
    expect(bar.getAttribute("aria-valuenow")).toBe("40");
  });

  it("clamps out-of-range progress in the visible percentage, aria-valuenow, and bar width", async () => {
    mockUseSession.mockReturnValue({ status: "authenticated" });
    mockFetchOnce({ puzzle: { ...ACTIVE_PUZZLE, completionPercentage: -15 } });
    await renderCard();

    expect(screen.getByText("0%")).toBeTruthy();
    const bar = screen.getByRole("progressbar", { name: "Puzzle progress" });
    expect(bar.getAttribute("aria-valuenow")).toBe("0");
    const fill = bar.firstElementChild as HTMLElement;
    expect(fill.style.width).toBe("0%");
  });

  it("clamps progress above 100", async () => {
    mockUseSession.mockReturnValue({ status: "authenticated" });
    mockFetchOnce({ puzzle: { ...ACTIVE_PUZZLE, completionPercentage: 140 } });
    await renderCard();

    expect(screen.getByText("100%")).toBeTruthy();
    const bar = screen.getByRole("progressbar", { name: "Puzzle progress" });
    expect(bar.getAttribute("aria-valuenow")).toBe("100");
    const fill = bar.firstElementChild as HTMLElement;
    expect(fill.style.width).toBe("100%");
  });

  it("no active puzzle: renders nothing once loading resolves", async () => {
    mockUseSession.mockReturnValue({ status: "authenticated" });
    mockFetchOnce({ puzzle: null });
    const { container } = await renderCard();

    expect(container.firstChild).toBeNull();
  });

  it("loading: shows an accessible skeleton with the required test id while the fetch is pending", async () => {
    mockUseSession.mockReturnValue({ status: "authenticated" });
    global.fetch = jest.fn(() => new Promise(() => {})) as jest.Mock;

    render(<ContinuePlayingCard />);

    const skeleton = screen.getByTestId("home-continue-skeleton");
    expect(skeleton).toBeTruthy();
    expect(skeleton.getAttribute("role")).toBe("status");
    expect(skeleton.getAttribute("aria-label")).toBeTruthy();
  });

  it("failed request: the card disappears cleanly after loading, with no error thrown", async () => {
    mockUseSession.mockReturnValue({ status: "authenticated" });
    global.fetch = jest.fn(() => Promise.reject(new Error("network down"))) as jest.Mock;

    const { container } = await renderCard();
    expect(container.firstChild).toBeNull();
  });
});
