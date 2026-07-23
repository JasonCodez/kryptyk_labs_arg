/** @jest-environment jsdom */
import fs from "fs";
import path from "path";
import { render, screen } from "@testing-library/react";
import LeaderboardRewardTiers, { formatRewardRankLabel } from "./LeaderboardRewardTiers";

const RAW_HEX = /#[0-9a-fA-F]{3,8}\b/;
const RAW_RGB = /rgba?\(/i;
const SOURCE = fs.readFileSync(path.join(__dirname, "LeaderboardRewardTiers.tsx"), "utf8");

describe("formatRewardRankLabel", () => {
  it("rank 1 becomes 1st Place", () => expect(formatRewardRankLabel(1)).toBe("1st Place"));
  it("rank 2 becomes 2nd Place", () => expect(formatRewardRankLabel(2)).toBe("2nd Place"));
  it("rank 3 becomes 3rd Place", () => expect(formatRewardRankLabel(3)).toBe("3rd Place"));
  it("rank 4 becomes Rank #4", () => expect(formatRewardRankLabel(4)).toBe("Rank #4"));
  it("'2-10' becomes 2nd–10th", () => expect(formatRewardRankLabel("2-10")).toBe("2nd–10th"));
  it("'11-50' becomes 11th–50th", () => expect(formatRewardRankLabel("11-50")).toBe("11th–50th"));
  it("an unfamiliar non-empty string remains safely readable", () => {
    expect(formatRewardRankLabel("Legendary")).toBe("Legendary");
  });
  it("an empty rank becomes Rank", () => {
    expect(formatRewardRankLabel("")).toBe("Rank");
    expect(formatRewardRankLabel("   ")).toBe("Rank");
  });
  it("never throws for weird input", () => {
    expect(() => formatRewardRankLabel(-1)).not.toThrow();
    expect(() => formatRewardRankLabel(Number.NaN)).not.toThrow();
  });

  it("null becomes Rank", () => expect(formatRewardRankLabel(null)).toBe("Rank"));
  it("undefined becomes Rank", () => expect(formatRewardRankLabel(undefined)).toBe("Rank"));
  it("an object becomes Rank", () => expect(formatRewardRankLabel({})).toBe("Rank"));
  it("an array becomes Rank", () => expect(formatRewardRankLabel([])).toBe("Rank"));
  it("a boolean becomes Rank", () => expect(formatRewardRankLabel(true)).toBe("Rank"));

  it("never throws for malformed runtime values", () => {
    expect(() => formatRewardRankLabel(null)).not.toThrow();
    expect(() => formatRewardRankLabel(undefined)).not.toThrow();
    expect(() => formatRewardRankLabel({})).not.toThrow();
    expect(() => formatRewardRankLabel([])).not.toThrow();
    expect(() => formatRewardRankLabel(true)).not.toThrow();
  });
});

describe("LeaderboardRewardTiers", () => {
  it("returns nothing for empty tiers", () => {
    const { container } = render(<LeaderboardRewardTiers tiers={[]} periodLabel="Week" />);
    expect(container.firstChild).toBeNull();
  });

  it("Week renders 'Weekly rewards'", () => {
    render(<LeaderboardRewardTiers tiers={[{ rank: 1, points: 500, xp: 100 }]} periodLabel="Week" />);
    expect(screen.getByText("Weekly rewards")).toBeTruthy();
  });

  it("Month renders 'Monthly rewards'", () => {
    render(<LeaderboardRewardTiers tiers={[{ rank: 1, points: 500, xp: 100 }]} periodLabel="Month" />);
    expect(screen.getByText("Monthly rewards")).toBeTruthy();
  });

  it("renders settlement supporting copy", () => {
    render(<LeaderboardRewardTiers tiers={[{ rank: 1, points: 500, xp: 100 }]} periodLabel="Week" />);
    expect(screen.getByText("Final standings determine rewards after the period ends.")).toBeTruthy();
  });

  it("rank 1 tier shows 1st Place", () => {
    render(<LeaderboardRewardTiers tiers={[{ rank: 1, points: 500, xp: 100 }]} periodLabel="Week" />);
    expect(screen.getByText("1st Place")).toBeTruthy();
  });

  it("rank 2 tier shows 2nd Place", () => {
    render(<LeaderboardRewardTiers tiers={[{ rank: 2, points: 300, xp: 60 }]} periodLabel="Week" />);
    expect(screen.getByText("2nd Place")).toBeTruthy();
  });

  it("rank 3 tier shows 3rd Place", () => {
    render(<LeaderboardRewardTiers tiers={[{ rank: 3, points: 200, xp: 40 }]} periodLabel="Week" />);
    expect(screen.getByText("3rd Place")).toBeTruthy();
  });

  it("rank 4 tier shows Rank #4", () => {
    render(<LeaderboardRewardTiers tiers={[{ rank: 4, points: 100, xp: 20 }]} periodLabel="Week" />);
    expect(screen.getByText("Rank #4")).toBeTruthy();
  });

  it("'2-10' tier shows 2nd–10th", () => {
    render(<LeaderboardRewardTiers tiers={[{ rank: "2-10", points: 100, xp: 20 }]} periodLabel="Week" />);
    expect(screen.getByText("2nd–10th")).toBeTruthy();
  });

  it("'11-50' tier shows 11th–50th", () => {
    render(<LeaderboardRewardTiers tiers={[{ rank: "11-50", points: 50, xp: 10 }]} periodLabel="Week" />);
    expect(screen.getByText("11th–50th")).toBeTruthy();
  });

  it("exact points render", () => {
    render(<LeaderboardRewardTiers tiers={[{ rank: 1, points: 500, xp: 100 }]} periodLabel="Week" />);
    expect(screen.getByText("500 Points")).toBeTruthy();
  });

  it("exact XP renders", () => {
    render(<LeaderboardRewardTiers tiers={[{ rank: 1, points: 500, xp: 100 }]} periodLabel="Week" />);
    expect(screen.getByText("100 XP")).toBeTruthy();
  });

  it("large values use locale formatting", () => {
    render(<LeaderboardRewardTiers tiers={[{ rank: 1, points: 123456, xp: 7890 }]} periodLabel="Week" />);
    expect(screen.getByText("123,456 Points")).toBeTruthy();
    expect(screen.getByText("7,890 XP")).toBeTruthy();
  });

  it("invalid points render —", () => {
    render(<LeaderboardRewardTiers tiers={[{ rank: 1, points: Number.NaN, xp: 100 }]} periodLabel="Week" />);
    expect(screen.getByText("— Points")).toBeTruthy();
  });

  it("invalid XP renders —", () => {
    render(<LeaderboardRewardTiers tiers={[{ rank: 1, points: 500, xp: Number.NaN }]} periodLabel="Week" />);
    expect(screen.getByText("— XP")).toBeTruthy();
  });

  it("preserves server order", () => {
    const tiers = [
      { rank: 3, points: 200, xp: 40 },
      { rank: 1, points: 500, xp: 100 },
      { rank: 2, points: 300, xp: 60 },
    ];
    render(<LeaderboardRewardTiers tiers={tiers} periodLabel="Week" />);
    const labels = screen.getAllByText(/Place$/).map((el) => el.textContent);
    expect(labels).toEqual(["3rd Place", "1st Place", "2nd Place"]);
  });

  it("does not sort the input array", () => {
    const tiers = [{ rank: 3, points: 200, xp: 40 }, { rank: 1, points: 500, xp: 100 }];
    const sortSpy = jest.spyOn(tiers, "sort");
    render(<LeaderboardRewardTiers tiers={tiers} periodLabel="Week" />);
    expect(sortSpy).not.toHaveBeenCalled();
  });

  it("keeps points and XP distinct (different text nodes)", () => {
    render(<LeaderboardRewardTiers tiers={[{ rank: 1, points: 500, xp: 100 }]} periodLabel="Week" />);
    expect(screen.getByText("500 Points")).not.toBe(screen.getByText("100 XP"));
  });

  it("does not calculate user eligibility or show Claim", () => {
    render(<LeaderboardRewardTiers tiers={[{ rank: 1, points: 500, xp: 100 }]} periodLabel="Week" />);
    expect(screen.queryByText(/Claim/i)).toBeNull();
  });

  it("does not claim the reward was already earned", () => {
    render(<LeaderboardRewardTiers tiers={[{ rank: 1, points: 500, xp: 100 }]} periodLabel="Week" />);
    expect(screen.queryByText(/earned/i)).toBeNull();
  });

  it("uses list semantics", () => {
    const { container } = render(<LeaderboardRewardTiers tiers={[{ rank: 1, points: 500, xp: 100 }]} periodLabel="Week" />);
    expect(container.querySelector("ul")).toBeTruthy();
    expect(container.querySelector("li")).toBeTruthy();
  });

  it("decorative icons are hidden", () => {
    const { container } = render(<LeaderboardRewardTiers tiers={[{ rank: 1, points: 500, xp: 100 }]} periodLabel="Week" />);
    container.querySelectorAll("svg").forEach((icon) => expect(icon.getAttribute("aria-hidden")).toBe("true"));
  });

  it("contains no hard-coded trophy emoji", () => {
    const { container } = render(<LeaderboardRewardTiers tiers={[{ rank: 1, points: 500, xp: 100 }]} periodLabel="Week" />);
    expect((container.textContent ?? "").includes("🏆")).toBe(false);
  });

  it("source contains no trophy/medal emoji literal", () => {
    expect(/🏆|🥇|🥈|🥉/.test(SOURCE)).toBe(false);
  });

  it("contains no raw hex", () => {
    const { container } = render(<LeaderboardRewardTiers tiers={[{ rank: 1, points: 500, xp: 100 }]} periodLabel="Week" />);
    expect(RAW_HEX.test(container.innerHTML)).toBe(false);
  });

  it("contains no raw RGBA", () => {
    const { container } = render(<LeaderboardRewardTiers tiers={[{ rank: 1, points: 500, xp: 100 }]} periodLabel="Week" />);
    expect(RAW_RGB.test(container.innerHTML)).toBe(false);
  });

  it("mobile layout is bounded (min-w-0)", () => {
    const { container } = render(<LeaderboardRewardTiers tiers={[{ rank: 1, points: 500, xp: 100 }]} periodLabel="Week" />);
    expect(container.firstElementChild?.className).toMatch(/min-w-0/);
  });

  it("reward list uses a responsive wrapping grid", () => {
    const { container } = render(<LeaderboardRewardTiers tiers={[{ rank: 1, points: 500, xp: 100 }]} periodLabel="Week" />);
    const list = container.querySelector("ul");
    expect(list?.className).toMatch(/\bgrid\b/);
    expect(list?.className).toMatch(/grid-cols-1/);
  });

  it("reward list contains no overflow-x-auto", () => {
    const { container } = render(<LeaderboardRewardTiers tiers={[{ rank: 1, points: 500, xp: 100 }]} periodLabel="Week" />);
    expect(container.querySelector("ul")?.className).not.toMatch(/overflow-x-auto/);
  });

  it("reward list contains no shrink-0", () => {
    const { container } = render(<LeaderboardRewardTiers tiers={[{ rank: 1, points: 500, xp: 100 }]} periodLabel="Week" />);
    expect(container.querySelector("ul")?.className).not.toMatch(/shrink-0/);
    expect(container.querySelector("li")?.className).not.toMatch(/shrink-0/);
  });

  it("reward list contains no fixed minimum tier width", () => {
    const { container } = render(<LeaderboardRewardTiers tiers={[{ rank: 1, points: 500, xp: 100 }]} periodLabel="Week" />);
    expect(container.querySelector("li")?.className).not.toMatch(/min-w-\[112px\]/);
  });

  it("each tier item uses min-w-0", () => {
    const { container } = render(<LeaderboardRewardTiers tiers={[{ rank: 1, points: 500, xp: 100 }]} periodLabel="Week" />);
    expect(container.querySelector("li")?.className).toMatch(/min-w-0/);
  });

  it("each tier item uses full available width", () => {
    const { container } = render(<LeaderboardRewardTiers tiers={[{ rank: 1, points: 500, xp: 100 }]} periodLabel="Week" />);
    expect(container.querySelector("li")?.className).toMatch(/\bw-full\b/);
  });

  it("source contains no horizontal-scroll classes", () => {
    expect(SOURCE.includes("overflow-x-auto")).toBe(false);
    expect(SOURCE.includes("no-scrollbar")).toBe(false);
    expect(SOURCE.includes("shrink-0")).toBe(false);
    expect(SOURCE.includes("min-w-[112px]")).toBe(false);
  });

  it("performs no request", () => {
    const originalFetch = global.fetch;
    const fetchMock = jest.fn();
    (global as any).fetch = fetchMock;
    render(<LeaderboardRewardTiers tiers={[{ rank: 1, points: 500, xp: 100 }]} periodLabel="Week" />);
    expect(fetchMock).not.toHaveBeenCalled();
    (global as any).fetch = originalFetch;
  });
});
