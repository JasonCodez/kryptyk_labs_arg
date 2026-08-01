/** @jest-environment jsdom */

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import StorefrontHero, { StoreCategoryRail, type StoreWalletUser, type StoreCategory } from "./StorefrontHero";

const BASE_USER: StoreWalletUser = {
  streakShields: 2,
  hintTokens: 5,
  skipTokens: 0,
  warzChallengeSlots: 4,
  warzRematchTokens: 1,
  tripleOrNothingTokens: 0,
  tripleOrNothingActive: false,
  xpBoostExpiresAt: null,
};

const CATEGORIES: StoreCategory[] = [
  { key: "all", label: "All Items" },
  { key: "streak", label: "Streak" },
  { key: "puzzle", label: "Puzzle" },
  { key: "warz", label: "Warz" },
  { key: "cosmetic", label: "Cosmetics" },
  { key: "social", label: "Team" },
];

function noop() {}

function renderHero(overrides: Partial<Parameters<typeof StorefrontHero>[0]> = {}) {
  return render(
    <StorefrontHero
      balance={1234}
      user={BASE_USER}
      loading={false}
      showGlow={false}
      onGiftPoints={noop}
      {...overrides}
    />
  );
}

afterEach(() => {
  cleanup();
});

describe("StorefrontHero — store identity and balance (Test A)", () => {
  it("renders THE VAULT heading, eyebrow, supporting text, and balance", () => {
    renderHero();

    expect(screen.getByRole("heading", { name: "THE VAULT" })).toBeTruthy();
    expect(screen.getByText(/PuzzleWarz Point Store/i)).toBeTruthy();
    expect(screen.getByText(/Power up your play/)).toBeTruthy();
    expect(screen.getByText("Available Balance")).toBeTruthy();
    expect(screen.getByText("1,234")).toBeTruthy();
    expect(screen.getByText("pts")).toBeTruthy();
  });
});

describe("StorefrontHero — wallet inventory (Test B)", () => {
  it("renders all six inventory categories with values, including zero", () => {
    renderHero();

    expect(screen.getByText("Hint Tokens")).toBeTruthy();
    expect(screen.getByText("Streak Shields")).toBeTruthy();
    expect(screen.getByText("Skip Tokens")).toBeTruthy();
    expect(screen.getByText("Warz Slots")).toBeTruthy();
    expect(screen.getByText("Rematch Tokens")).toBeTruthy();
    expect(screen.getByText("Triple Tokens")).toBeTruthy();

    expect(screen.getByText("5")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.getAllByText("0").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("4")).toBeTruthy();
    expect(screen.getByText("1")).toBeTruthy();
  });
});

describe("StorefrontHero — large values remain rendered (Test C)", () => {
  it("keeps stress-level balance and wallet values, and active statuses, present", () => {
    renderHero({
      balance: 12_345_678,
      user: {
        streakShields: 999_999,
        hintTokens: 999_999,
        skipTokens: 999_999,
        warzChallengeSlots: 999_999,
        warzRematchTokens: 999_999,
        tripleOrNothingTokens: 999_999,
        tripleOrNothingActive: true,
        xpBoostExpiresAt: "2099-01-01T00:00:00.000Z",
      },
    });

    expect(screen.getByText("12,345,678")).toBeTruthy();
    expect(screen.getAllByText("999,999").length).toBe(6);
    expect(screen.getByText(/Triple-or-Nothing Active/)).toBeTruthy();
    expect(screen.getByText(/2× XP Boost Active/)).toBeTruthy();
  });
});

describe("StorefrontHero — Gift Points action (Test D)", () => {
  it("calls onGiftPoints exactly once when Gift Points is clicked", () => {
    const onGiftPoints = jest.fn();
    renderHero({ onGiftPoints });
    fireEvent.click(screen.getByRole("button", { name: "Gift Points" }));
    expect(onGiftPoints).toHaveBeenCalledTimes(1);
  });
});

describe("StoreCategoryRail — category semantics (Test E)", () => {
  it("renders a tablist with an accessible name and all six tabs with correct selected state", () => {
    render(
      <StoreCategoryRail categories={CATEGORIES} activeCategory="streak" onCategoryChange={noop} />
    );

    const tablist = screen.getByRole("tablist", { name: "Store categories" });
    const tabs = within(tablist).getAllByRole("tab");
    expect(tabs.length).toBe(6);

    const streakTab = within(tablist).getByRole("tab", { name: "Streak" });
    expect(streakTab.getAttribute("aria-selected")).toBe("true");

    const allTab = within(tablist).getByRole("tab", { name: "All Items" });
    expect(allTab.getAttribute("aria-selected")).toBe("false");
    const puzzleTab = within(tablist).getByRole("tab", { name: "Puzzle" });
    expect(puzzleTab.getAttribute("aria-selected")).toBe("false");
    const warzTab = within(tablist).getByRole("tab", { name: "Warz" });
    expect(warzTab.getAttribute("aria-selected")).toBe("false");
    const cosmeticsTab = within(tablist).getByRole("tab", { name: "Cosmetics" });
    expect(cosmeticsTab.getAttribute("aria-selected")).toBe("false");
    const teamTab = within(tablist).getByRole("tab", { name: "Team" });
    expect(teamTab.getAttribute("aria-selected")).toBe("false");
  });
});

describe("StoreCategoryRail — category callback (Test F)", () => {
  it("calls onCategoryChange exactly once with the clicked category's key", () => {
    const onCategoryChange = jest.fn();
    render(
      <StoreCategoryRail categories={CATEGORIES} activeCategory="all" onCategoryChange={onCategoryChange} />
    );

    fireEvent.click(screen.getByRole("tab", { name: "Warz" }));
    expect(onCategoryChange).toHaveBeenCalledTimes(1);
    expect(onCategoryChange).toHaveBeenCalledWith("warz");
  });
});

describe("StorefrontHero — loading state (Test G)", () => {
  it("exposes aria-busy, shows a neutral loading presentation, and never presents a confirmed 0 pts balance", () => {
    renderHero({ loading: true, balance: 0 });

    const busyRegion = document.querySelector('[aria-busy="true"]');
    expect(busyRegion).toBeTruthy();
    expect(screen.queryByText("0")).toBeNull();
    expect(screen.queryByText("pts")).toBeNull();
  });
});

describe("StorefrontHero — empty optional statuses (Test H)", () => {
  it("hides active-status labels while inventory values remain present when inactive", () => {
    renderHero({
      user: { ...BASE_USER, tripleOrNothingActive: false, xpBoostExpiresAt: null },
    });

    expect(screen.queryByText(/Triple-or-Nothing Active/)).toBeNull();
    expect(screen.queryByText(/XP Boost Active/)).toBeNull();
    expect(screen.getByText("Hint Tokens")).toBeTruthy();
    expect(screen.getByText("5")).toBeTruthy();
  });
});

describe("StorefrontHero — expired XP boost is inactive (Test I)", () => {
  it("hides the active label when xpBoostExpiresAt is in the past, while the wallet remains present", () => {
    renderHero({
      user: { ...BASE_USER, xpBoostExpiresAt: "2000-01-01T00:00:00.000Z" },
    });

    expect(screen.queryByText(/2× XP Boost Active/)).toBeNull();
    expect(screen.getByText("Hint Tokens")).toBeTruthy();
  });

  it("hides the active label when xpBoostExpiresAt is an invalid date string", () => {
    renderHero({
      user: { ...BASE_USER, xpBoostExpiresAt: "not-a-date" },
    });

    expect(screen.queryByText(/2× XP Boost Active/)).toBeNull();
  });
});
