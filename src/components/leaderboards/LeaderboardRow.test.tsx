/** @jest-environment jsdom */
import fs from "fs";
import path from "path";
import { fireEvent, render, screen } from "@testing-library/react";
import LeaderboardRow, {
  getLeaderboardDisplayName,
  getLeaderboardInitials,
  formatLeaderboardMetric,
  type LeaderboardDisplayEntry,
} from "./LeaderboardRow";

const NO_EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
const RAW_HEX = /#[0-9a-fA-F]{3,8}\b/;
const RAW_RGB = /rgba?\(/i;

const SOURCE = fs.readFileSync(path.join(__dirname, "LeaderboardRow.tsx"), "utf8");

function makeEntry(overrides: Partial<LeaderboardDisplayEntry> = {}): LeaderboardDisplayEntry {
  return {
    userId: "u1",
    userName: "Alice Example",
    userImage: null,
    activeFlair: "none",
    isPremium: false,
    points: 1234,
    puzzlesSolved: 12,
    rank: 4,
    isCurrentUser: false,
    ...overrides,
  };
}

describe("LeaderboardRow — helpers", () => {
  it("getLeaderboardDisplayName trims and falls back to Anonymous", () => {
    expect(getLeaderboardDisplayName("  Alice  ")).toBe("Alice");
    expect(getLeaderboardDisplayName(null)).toBe("Anonymous");
    expect(getLeaderboardDisplayName("   ")).toBe("Anonymous");
    expect(getLeaderboardDisplayName("")).toBe("Anonymous");
  });

  it("getLeaderboardInitials handles two-word, one-word, and empty names", () => {
    expect(getLeaderboardInitials("Alice Smith")).toBe("AS");
    expect(getLeaderboardInitials("Alice")).toBe("A");
    expect(getLeaderboardInitials("  Alice   Smith  ")).toBe("AS");
    expect(getLeaderboardInitials(null)).toBe("P");
    expect(getLeaderboardInitials("")).toBe("P");
  });

  it("formatLeaderboardMetric formats, defends invalid, and rejects negative", () => {
    expect(formatLeaderboardMetric(0)).toBe("0");
    expect(formatLeaderboardMetric(1234)).toBe("1,234");
    expect(formatLeaderboardMetric(Number.NaN)).toBe("—");
    expect(formatLeaderboardMetric(-5)).toBe("—");
    expect(formatLeaderboardMetric(Infinity)).toBe("—");
  });
});

describe("LeaderboardRow — standard variant", () => {
  it("renders rank #4", () => {
    render(<LeaderboardRow entry={makeEntry({ rank: 4 })} pointsLabel="Earned points" />);
    expect(screen.getByText("#4")).toBeTruthy();
  });

  it("renders — for an invalid rank", () => {
    render(<LeaderboardRow entry={makeEntry({ rank: 0 })} pointsLabel="Earned points" />);
    expect(screen.getByText("—")).toBeTruthy();
  });

  it("renders the player name", () => {
    render(<LeaderboardRow entry={makeEntry({ userName: "Alice Example" })} pointsLabel="Earned points" />);
    expect(screen.getByText("Alice Example")).toBeTruthy();
  });

  it("null name becomes Anonymous", () => {
    render(<LeaderboardRow entry={makeEntry({ userName: null })} pointsLabel="Earned points" />);
    expect(screen.getByText("Anonymous")).toBeTruthy();
  });

  it("whitespace name becomes Anonymous", () => {
    render(<LeaderboardRow entry={makeEntry({ userName: "   " })} pointsLabel="Earned points" />);
    expect(screen.getByText("Anonymous")).toBeTruthy();
  });

  it("profile route remains /profile/[userId]", () => {
    render(<LeaderboardRow entry={makeEntry({ userId: "abc123" })} pointsLabel="Earned points" />);
    expect(screen.getByRole("link").getAttribute("href")).toBe("/profile/abc123");
  });

  it("empty user ID creates no /profile/ link", () => {
    render(<LeaderboardRow entry={makeEntry({ userId: "" })} pointsLabel="Earned points" />);
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("identity link has at least a 44px target class", () => {
    render(<LeaderboardRow entry={makeEntry()} pointsLabel="Earned points" />);
    expect(screen.getByRole("link").className).toMatch(/min-h-11/);
  });

  it("renders an image when userImage is supplied", () => {
    const { container } = render(<LeaderboardRow entry={makeEntry({ userImage: "https://example.test/a.png" })} pointsLabel="Earned points" />);
    const img = container.querySelector("img");
    expect(img).toBeTruthy();
    expect(img?.getAttribute("src")).toBe("https://example.test/a.png");
  });

  it("image uses empty alt text", () => {
    const { container } = render(<LeaderboardRow entry={makeEntry({ userImage: "https://example.test/a.png" })} pointsLabel="Earned points" />);
    expect(container.querySelector("img")?.getAttribute("alt")).toBe("");
  });

  it("null image renders initials", () => {
    render(<LeaderboardRow entry={makeEntry({ userImage: null, userName: "Alice Example" })} pointsLabel="Earned points" />);
    expect(screen.getByText("AE")).toBeTruthy();
  });

  it("broken image switches to initials", () => {
    const { container } = render(<LeaderboardRow entry={makeEntry({ userImage: "https://example.test/broken.png", userName: "Alice Example" })} pointsLabel="Earned points" />);
    const img = container.querySelector("img")!;
    fireEvent.error(img);
    expect(screen.getByText("AE")).toBeTruthy();
    expect(container.querySelector("img")).toBeNull();
  });

  it("changing the image URL resets a previous failure", () => {
    const { container, rerender } = render(<LeaderboardRow entry={makeEntry({ userImage: "https://example.test/broken.png" })} pointsLabel="Earned points" />);
    fireEvent.error(container.querySelector("img")!);
    expect(container.querySelector("img")).toBeNull();

    rerender(<LeaderboardRow entry={makeEntry({ userImage: "https://example.test/new.png" })} pointsLabel="Earned points" />);
    expect(container.querySelector("img")).toBeTruthy();
  });

  it("current user displays You", () => {
    render(<LeaderboardRow entry={makeEntry({ isCurrentUser: true })} pointsLabel="Earned points" />);
    expect(screen.getByText("You")).toBeTruthy();
  });

  it("non-current user does not display You", () => {
    render(<LeaderboardRow entry={makeEntry({ isCurrentUser: false })} pointsLabel="Earned points" />);
    expect(screen.queryByText("You")).toBeNull();
  });

  it("premium displays visible Premium text", () => {
    render(<LeaderboardRow entry={makeEntry({ isPremium: true })} pointsLabel="Earned points" />);
    expect(screen.getByText("Premium")).toBeTruthy();
  });

  it("non-premium omits Premium", () => {
    render(<LeaderboardRow entry={makeEntry({ isPremium: false })} pointsLabel="Earned points" />);
    expect(screen.queryByText("Premium")).toBeNull();
  });

  it("active flair renders exactly", () => {
    render(<LeaderboardRow entry={makeEntry({ activeFlair: "⭐ Star" })} pointsLabel="Earned points" />);
    expect(screen.getByText("⭐ Star")).toBeTruthy();
  });

  it("flair 'none' is omitted", () => {
    render(<LeaderboardRow entry={makeEntry({ activeFlair: "none" })} pointsLabel="Earned points" />);
    expect(screen.queryByLabelText(/Active flair/)).toBeNull();
  });

  it("empty flair is omitted", () => {
    render(<LeaderboardRow entry={makeEntry({ activeFlair: "" })} pointsLabel="Earned points" />);
    expect(screen.queryByLabelText(/Active flair/)).toBeNull();
  });

  it("points render exactly", () => {
    render(<LeaderboardRow entry={makeEntry({ points: 9876 })} pointsLabel="Earned points" />);
    expect(screen.getByText("9,876")).toBeTruthy();
  });

  it("puzzles solved renders exactly", () => {
    render(<LeaderboardRow entry={makeEntry({ puzzlesSolved: 42 })} pointsLabel="Earned points" />);
    expect(screen.getAllByText(/42/).length).toBeGreaterThan(0);
  });

  it("points label renders", () => {
    render(<LeaderboardRow entry={makeEntry()} pointsLabel="Period points" />);
    expect(screen.getByText("Period points")).toBeTruthy();
  });

  it("large metrics use locale formatting", () => {
    render(<LeaderboardRow entry={makeEntry({ points: 1234567 })} pointsLabel="Earned points" />);
    expect(screen.getByText("1,234,567")).toBeTruthy();
  });

  it("invalid metric renders —", () => {
    render(<LeaderboardRow entry={makeEntry({ points: Number.NaN })} pointsLabel="Earned points" />);
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("metrics use tabular numerals", () => {
    const { container } = render(<LeaderboardRow entry={makeEntry()} pointsLabel="Earned points" />);
    expect(container.querySelectorAll(".tabular-nums").length).toBeGreaterThan(0);
  });

  it("long name uses bounded/wrapping classes", () => {
    render(<LeaderboardRow entry={makeEntry({ userName: "A".repeat(80) })} pointsLabel="Earned points" />);
    expect(screen.getByText("A".repeat(80)).className).toMatch(/break-words/);
  });

  it("standard variant remains bounded (min-w-0)", () => {
    const { container } = render(<LeaderboardRow entry={makeEntry()} pointsLabel="Earned points" />);
    expect(container.querySelector("li")?.className).toMatch(/min-w-0/);
  });

  it("performs no fetch", () => {
    const originalFetch = global.fetch;
    const fetchMock = jest.fn();
    (global as any).fetch = fetchMock;
    render(<LeaderboardRow entry={makeEntry()} pointsLabel="Earned points" />);
    expect(fetchMock).not.toHaveBeenCalled();
    (global as any).fetch = originalFetch;
  });

  it("no nested interactive controls", () => {
    render(<LeaderboardRow entry={makeEntry()} pointsLabel="Earned points" />);
    const link = screen.getByRole("link");
    expect(link.querySelectorAll("a,button").length).toBe(0);
  });
});

describe("LeaderboardRow — featured variant", () => {
  it("rank 1 renders 1st Place", () => {
    render(<LeaderboardRow entry={makeEntry({ rank: 1 })} pointsLabel="Earned points" variant="featured" />);
    expect(screen.getByText("1st Place")).toBeTruthy();
  });

  it("rank 2 renders 2nd Place", () => {
    render(<LeaderboardRow entry={makeEntry({ rank: 2 })} pointsLabel="Earned points" variant="featured" />);
    expect(screen.getByText("2nd Place")).toBeTruthy();
  });

  it("rank 3 renders 3rd Place", () => {
    render(<LeaderboardRow entry={makeEntry({ rank: 3 })} pointsLabel="Earned points" variant="featured" />);
    expect(screen.getByText("3rd Place")).toBeTruthy();
  });

  it("rank 1 uses Crown (lucide-crown)", () => {
    const { container } = render(<LeaderboardRow entry={makeEntry({ rank: 1 })} pointsLabel="Earned points" variant="featured" />);
    expect(container.querySelector("svg.lucide-crown")).toBeTruthy();
  });

  it("rank 2 uses Medal (lucide-medal)", () => {
    const { container } = render(<LeaderboardRow entry={makeEntry({ rank: 2 })} pointsLabel="Earned points" variant="featured" />);
    expect(container.querySelector("svg.lucide-medal")).toBeTruthy();
  });

  it("rank 3 uses Award (lucide-award)", () => {
    const { container } = render(<LeaderboardRow entry={makeEntry({ rank: 3 })} pointsLabel="Earned points" variant="featured" />);
    expect(container.querySelector("svg.lucide-award")).toBeTruthy();
  });

  it("placement icons are decorative", () => {
    const { container } = render(<LeaderboardRow entry={makeEntry({ rank: 1 })} pointsLabel="Earned points" variant="featured" />);
    container.querySelectorAll("svg").forEach((icon) => expect(icon.getAttribute("aria-hidden")).toBe("true"));
  });

  it("featured variant remains bounded (min-w-0)", () => {
    const { container } = render(<LeaderboardRow entry={makeEntry({ rank: 1 })} pointsLabel="Earned points" variant="featured" />);
    expect(container.querySelector("li")?.className).toMatch(/min-w-0/);
  });
});

describe("LeaderboardRow — no legacy decoration or raw colors", () => {
  it("contains no hard-coded medal emoji", () => {
    render(<LeaderboardRow entry={makeEntry({ rank: 1 })} pointsLabel="Earned points" variant="featured" />);
    const body = document.body.textContent ?? "";
    expect(/🥇|🥈|🥉/.test(body)).toBe(false);
  });

  it("contains no hard-coded diamond emoji", () => {
    render(<LeaderboardRow entry={makeEntry({ isPremium: true })} pointsLabel="Earned points" />);
    expect((document.body.textContent ?? "").includes("💎")).toBe(false);
  });

  it("does not treat fixture flair emoji as a violation (user data is exempt)", () => {
    render(<LeaderboardRow entry={makeEntry({ activeFlair: "🔥 Streak" })} pointsLabel="Earned points" />);
    expect(screen.getByText("🔥 Streak")).toBeTruthy();
  });

  it("contains no emoji outside of server-provided flair", () => {
    const { container } = render(<LeaderboardRow entry={makeEntry({ rank: 1, isPremium: true, activeFlair: "none" })} pointsLabel="Earned points" variant="featured" />);
    expect(NO_EMOJI.test(container.textContent ?? "")).toBe(false);
  });

  it("contains no raw hex colors", () => {
    const { container } = render(<LeaderboardRow entry={makeEntry({ rank: 1 })} pointsLabel="Earned points" variant="featured" />);
    expect(RAW_HEX.test(container.innerHTML)).toBe(false);
  });

  it("contains no raw RGB/RGBA colors", () => {
    const { container } = render(<LeaderboardRow entry={makeEntry({ rank: 1 })} pointsLabel="Earned points" variant="featured" />);
    expect(RAW_RGB.test(container.innerHTML)).toBe(false);
  });

  it("uses semantic CSS variables", () => {
    const { container } = render(<LeaderboardRow entry={makeEntry({ rank: 1 })} pointsLabel="Earned points" variant="featured" />);
    expect(container.innerHTML).toMatch(/var\(--pw-/);
  });

  it("source contains no hard-coded medal/diamond/trophy emoji literals", () => {
    expect(/🥇|🥈|🥉|💎|🏆/.test(SOURCE)).toBe(false);
  });

  it("performs no programmatic navigation", () => {
    const pushSpy = jest.spyOn(window.history, "pushState");
    render(<LeaderboardRow entry={makeEntry()} pointsLabel="Earned points" />);
    expect(pushSpy).not.toHaveBeenCalled();
    pushSpy.mockRestore();
  });
});
