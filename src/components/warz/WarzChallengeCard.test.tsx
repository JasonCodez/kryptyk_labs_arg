/** @jest-environment jsdom */

import fs from "fs";
import path from "path";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import WarzChallengeCard, { type WarzChallenge } from "./WarzChallengeCard";

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
  document.documentElement.removeAttribute("data-reduce-animations");
});

function challengeFixture(overrides: Partial<WarzChallenge> = {}): WarzChallenge {
  return {
    id: "chal-1",
    status: "OPEN",
    challengerWager: 50,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 2 * 3600_000 + 14 * 60_000).toISOString(),
    spotlightUntil: null,
    puzzle: { id: "p1", title: "Midnight Sudoku", difficulty: "medium", puzzleType: "sudoku" },
    challenger: { id: "challenger-1", name: "Ada", image: null, level: 5 },
    opponent: null,
    invitedUser: null,
    winner: null,
    ...overrides,
  };
}

function mockFetchOnce(body: unknown, ok = true) {
  global.fetch = jest.fn(() => Promise.resolve({ ok, json: () => Promise.resolve(body) } as Response)) as jest.Mock;
}

describe("WarzChallengeCard", () => {
  it("shows puzzle title", () => {
    render(<WarzChallengeCard challenge={challengeFixture()} currentUserId="someone" />);
    expect(screen.getByText("Midnight Sudoku")).toBeTruthy();
  });

  it("shows puzzle type", () => {
    render(<WarzChallengeCard challenge={challengeFixture()} currentUserId="someone" />);
    expect(screen.getByText("Sudoku")).toBeTruthy();
  });

  it("shows challenger", () => {
    render(<WarzChallengeCard challenge={challengeFixture()} currentUserId="someone" />);
    expect(screen.getByText(/Ada/)).toBeTruthy();
  });

  it("shows wager", () => {
    render(<WarzChallengeCard challenge={challengeFixture({ challengerWager: 50 })} currentUserId="someone" />);
    expect(screen.getByText("50")).toBeTruthy();
  });

  it("shows total pot as wager x 2", () => {
    render(<WarzChallengeCard challenge={challengeFixture({ challengerWager: 50 })} currentUserId="someone" />);
    expect(screen.getByText("100")).toBeTruthy();
  });

  it("shows status as visible text", () => {
    render(<WarzChallengeCard challenge={challengeFixture({ status: "OPEN" })} currentUserId="someone" />);
    expect(screen.getByText("Open")).toBeTruthy();
  });

  it("shows expiration for open challenges", () => {
    render(<WarzChallengeCard challenge={challengeFixture({ status: "OPEN" })} currentUserId="someone" />);
    // Allow a 1-minute tolerance for the small elapsed time between the
    // fixture's Date.now() capture and the component's own computation.
    expect(screen.getByText(/2h 1[34]m/)).toBeTruthy();
  });

  it("handles invalid expiration safely", () => {
    expect(() =>
      render(<WarzChallengeCard challenge={challengeFixture({ status: "OPEN", expiresAt: "not-a-date" })} currentUserId="someone" />)
    ).not.toThrow();
    expect(screen.getByText("Expired")).toBeTruthy();
  });

  it("shows invited-player identity", () => {
    render(
      <WarzChallengeCard
        challenge={challengeFixture({ invitedUser: { id: "inv-1", name: "Rival" } })}
        currentUserId="someone"
      />
    );
    expect(screen.getByText(/Rival/)).toBeTruthy();
  });

  it("featured variant shows Spotlighted", () => {
    render(
      <WarzChallengeCard
        challenge={challengeFixture({ spotlightUntil: new Date(Date.now() + 600_000).toISOString() })}
        currentUserId="someone"
        featured
      />
    );
    expect(screen.getByText(/Spotlighted/)).toBeTruthy();
  });

  it("featured variant shows remaining spotlight time", () => {
    render(
      <WarzChallengeCard
        challenge={challengeFixture({ spotlightUntil: new Date(Date.now() + 10 * 60_000).toISOString() })}
        currentUserId="someone"
        featured
      />
    );
    expect(screen.getByText(/spotlight left/)).toBeTruthy();
  });

  it("open challenge created by current user shows Cancel", () => {
    render(
      <WarzChallengeCard
        challenge={challengeFixture({ challenger: { id: "me", name: "Me", image: null, level: 1 } })}
        currentUserId="me"
      />
    );
    expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();
  });

  it("cancel posts once to /api/warz/cancel", async () => {
    mockFetchOnce({ ok: true });
    render(
      <WarzChallengeCard
        challenge={challengeFixture({ id: "chal-9", challenger: { id: "me", name: "Me", image: null, level: 1 } })}
        currentUserId="me"
      />
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      await Promise.resolve();
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe("/api/warz/cancel");
  });

  it("cancel request body contains the exact challenge ID", async () => {
    mockFetchOnce({ ok: true });
    render(
      <WarzChallengeCard
        challenge={challengeFixture({ id: "chal-exact-id", challenger: { id: "me", name: "Me", image: null, level: 1 } })}
        currentUserId="me"
      />
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      await Promise.resolve();
    });
    const init = (global.fetch as jest.Mock).mock.calls[0][1];
    expect(JSON.parse(init.body)).toEqual({ challengeId: "chal-exact-id" });
  });

  it("cancel disables while pending", async () => {
    let resolveFetch!: (value: { ok: boolean; json: () => Promise<unknown> }) => void;
    global.fetch = jest.fn(() => new Promise((resolve) => { resolveFetch = resolve; })) as jest.Mock;
    render(
      <WarzChallengeCard
        challenge={challengeFixture({ challenger: { id: "me", name: "Me", image: null, level: 1 } })}
        currentUserId="me"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("button", { name: /Cancelling/ })).toHaveProperty("disabled", true);
    await act(async () => {
      resolveFetch({ ok: true, json: () => Promise.resolve({}) });
      await Promise.resolve();
    });
  });

  it("cancel success displays Cancelled", async () => {
    mockFetchOnce({});
    render(
      <WarzChallengeCard
        challenge={challengeFixture({ challenger: { id: "me", name: "Me", image: null, level: 1 } })}
        currentUserId="me"
      />
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      await Promise.resolve();
    });
    expect(screen.getByText("Cancelled")).toBeTruthy();
  });

  it("cancel failure does not falsely display Cancelled", async () => {
    mockFetchOnce({ error: "nope" }, false);
    render(
      <WarzChallengeCard
        challenge={challengeFixture({ challenger: { id: "me", name: "Me", image: null, level: 1 } })}
        currentUserId="me"
      />
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      await Promise.resolve();
    });
    expect(screen.queryByText("Cancelled")).toBeNull();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();
  });

  it("open challenge from another user shows Accept", () => {
    render(
      <WarzChallengeCard
        challenge={challengeFixture({ challenger: { id: "other", name: "Other", image: null, level: 1 } })}
        currentUserId="me"
      />
    );
    expect(screen.getByRole("link", { name: /accept/i })).toBeTruthy();
  });

  it("accept links to the existing challenge route", () => {
    render(
      <WarzChallengeCard
        challenge={challengeFixture({ id: "chal-77", challenger: { id: "other", name: "Other", image: null, level: 1 } })}
        currentUserId="me"
      />
    );
    expect(screen.getByRole("link", { name: /accept/i }).getAttribute("href")).toBe("/warz/challenge/chal-77");
  });

  it("challenge invited to another player does not show Accept", () => {
    render(
      <WarzChallengeCard
        challenge={challengeFixture({
          challenger: { id: "other", name: "Other", image: null, level: 1 },
          invitedUser: { id: "third-party", name: "ThirdParty" },
        })}
        currentUserId="me"
      />
    );
    expect(screen.queryByRole("link", { name: /accept/i })).toBeNull();
  });

  it("in-progress opponent challenge shows Play", () => {
    render(
      <WarzChallengeCard
        challenge={challengeFixture({
          status: "IN_PROGRESS",
          challenger: { id: "other", name: "Other", image: null, level: 1 },
          opponent: { id: "me", name: "Me" },
        })}
        currentUserId="me"
      />
    );
    expect(screen.getByRole("link", { name: "Play" })).toBeTruthy();
  });

  it("play links to the existing challenge route", () => {
    render(
      <WarzChallengeCard
        challenge={challengeFixture({
          id: "chal-88",
          status: "IN_PROGRESS",
          challenger: { id: "other", name: "Other", image: null, level: 1 },
          opponent: { id: "me", name: "Me" },
        })}
        currentUserId="me"
      />
    );
    expect(screen.getByRole("link", { name: "Play" }).getAttribute("href")).toBe("/warz/challenge/chal-88");
  });

  it("completed challenge shows View Result", () => {
    render(<WarzChallengeCard challenge={challengeFixture({ status: "COMPLETED" })} currentUserId="me" />);
    expect(screen.getByRole("link", { name: "View Result" })).toBeTruthy();
  });

  it("challenger non-open challenge shows View", () => {
    render(
      <WarzChallengeCard
        challenge={challengeFixture({ status: "EXPIRED", challenger: { id: "me", name: "Me", image: null, level: 1 } })}
        currentUserId="me"
      />
    );
    expect(screen.getByRole("link", { name: "View" })).toBeTruthy();
  });

  it("expired challenge does not show an invalid action", () => {
    render(
      <WarzChallengeCard
        challenge={challengeFixture({ status: "EXPIRED", challenger: { id: "other", name: "Other", image: null, level: 1 } })}
        currentUserId="me"
      />
    );
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("cancel is a button", () => {
    render(
      <WarzChallengeCard
        challenge={challengeFixture({ challenger: { id: "me", name: "Me", image: null, level: 1 } })}
        currentUserId="me"
      />
    );
    expect(screen.getByRole("button", { name: "Cancel" }).tagName).toBe("BUTTON");
  });

  it("navigation actions are semantic links", () => {
    render(<WarzChallengeCard challenge={challengeFixture({ status: "COMPLETED" })} currentUserId="me" />);
    expect(screen.getByRole("link", { name: "View Result" }).tagName).toBe("A");
  });

  it("no nested interactive elements", () => {
    const { container } = render(
      <WarzChallengeCard
        challenge={challengeFixture({ challenger: { id: "me", name: "Me", image: null, level: 1 } })}
        currentUserId="me"
      />
    );
    const buttons = Array.from(container.querySelectorAll("button"));
    for (const button of buttons) {
      expect(button.querySelector("a,button")).toBeNull();
    }
    const links = Array.from(container.querySelectorAll("a"));
    for (const link of links) {
      expect(link.querySelector("a,button")).toBeNull();
    }
  });

  it("action controls meet the 44px minimum", () => {
    render(
      <WarzChallengeCard
        challenge={challengeFixture({ challenger: { id: "me", name: "Me", image: null, level: 1 } })}
        currentUserId="me"
      />
    );
    const button = screen.getByRole("button", { name: "Cancel" });
    expect(button.className).toContain("min-h-11");
  });

  it("uses Lucide icons", () => {
    const { container } = render(
      <WarzChallengeCard
        challenge={challengeFixture({ spotlightUntil: new Date(Date.now() + 600_000).toISOString() })}
        currentUserId="someone"
        featured
      />
    );
    expect(container.querySelectorAll("svg").length).toBeGreaterThan(0);
  });

  it("decorative icons are hidden", () => {
    const { container } = render(
      <WarzChallengeCard
        challenge={challengeFixture({ spotlightUntil: new Date(Date.now() + 600_000).toISOString() })}
        currentUserId="someone"
        featured
      />
    );
    const icons = Array.from(container.querySelectorAll("svg"));
    expect(icons.length).toBeGreaterThan(0);
    for (const icon of icons) expect(icon.getAttribute("aria-hidden")).toBe("true");
  });

  it("contains no raw emoji", () => {
    const { container } = render(
      <WarzChallengeCard
        challenge={challengeFixture({ invitedUser: { id: "x", name: "X" } })}
        currentUserId="someone"
      />
    );
    const emojiPattern = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
    expect(emojiPattern.test(container.textContent || "")).toBe(false);
  });

  it("contains no raw hex or RGBA colors", () => {
    const source = fs.readFileSync(path.join(__dirname, "WarzChallengeCard.tsx"), "utf8");
    expect(/#[0-9a-fA-F]{3,8}\b/.test(source)).toBe(false);
    expect(/rgba?\(\s*\d/.test(source)).toBe(false);
  });

  it("reduced motion removes entrance movement", () => {
    document.documentElement.setAttribute("data-reduce-animations", "true");
    const { container } = render(<WarzChallengeCard challenge={challengeFixture()} currentUserId="someone" />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.opacity).not.toBe("0");
  });

  it("no reward, eligibility, or winner calculations are introduced", () => {
    const source = fs.readFileSync(path.join(__dirname, "WarzChallengeCard.tsx"), "utf8");
    expect(source).not.toMatch(/eligib/i);
    expect(source).not.toMatch(/reward/i);
    // The `winner` field is part of the preserved WarzChallenge contract (typed
    // pass-through only) — this asserts no *calculation* of a winner exists.
    expect(source).not.toMatch(/determineWinner|computeWinner|winnerId\s*=/i);
  });
});
