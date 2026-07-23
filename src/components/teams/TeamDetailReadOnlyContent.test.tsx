/** @jest-environment jsdom */
import fs from "fs";
import path from "path";
import { fireEvent, render, screen } from "@testing-library/react";
import { getThemeConfig } from "@/lib/profileThemes";
import TeamDetailReadOnlyContent, {
  normalizeTeamDetailStats,
  getTeamPersonDisplayName,
  getTeamPersonInitials,
  formatTeamDetailMetric,
  formatTeamDetailDate,
  formatTeamActivityTime,
  getTeamRoleLabel,
  getDifficultyTone,
  type TeamDetailMember,
  type TeamDetailStatsData,
} from "./TeamDetailReadOnlyContent";

const RAW_HEX = /#[0-9a-fA-F]{3,8}\b/;
const RAW_RGB = /rgba?\(/i;
const NO_EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
const SOURCE = fs.readFileSync(path.join(__dirname, "TeamDetailReadOnlyContent.tsx"), "utf8");

const theme = getThemeConfig("default");
const NOW = new Date("2026-01-20T12:00:00.000Z").getTime();

function makeMember(overrides: Partial<TeamDetailMember> = {}): TeamDetailMember {
  return {
    user: { id: "u1", name: "Jason Garrett", email: "jason@example.test", image: null },
    role: "member",
    ...overrides,
  };
}

function makeStats(overrides: Partial<TeamDetailStatsData> = {}): TeamDetailStatsData {
  return {
    rank: 4,
    totalTeams: 28,
    totalEarnedPoints: 5200,
    totalPuzzlesSolved: 180,
    avgPointsPerMember: 650,
    memberCount: 8,
    topContributors: [
      { userId: "u1", name: "Jason Garrett", image: null, role: "admin", joinedAt: "2026-01-01T00:00:00.000Z", earnedPoints: 2000, puzzlesSolved: 60 },
      { userId: "u2", name: "Alice", image: null, role: "member", joinedAt: "2026-01-02T00:00:00.000Z", earnedPoints: 1200, puzzlesSolved: 40 },
    ],
    recentActivity: [
      { userName: "Alice", userImage: null, puzzleTitle: "Daily Sudoku", puzzleType: "sudoku", difficulty: "easy", pointsEarned: 25, solvedAt: "2026-01-20T11:45:00.000Z" },
    ],
    ...overrides,
  };
}

describe("TeamDetailReadOnlyContent — helpers", () => {
  it("trims a valid display name", () => {
    expect(getTeamPersonDisplayName("  Jason  ")).toBe("Jason");
  });

  it("null name falls back to Member", () => {
    expect(getTeamPersonDisplayName(null)).toBe("Member");
  });

  it("two-word initials", () => {
    expect(getTeamPersonInitials("Jason Garrett")).toBe("JG");
  });

  it("one-word initials", () => {
    expect(getTeamPersonInitials("Jason")).toBe("J");
  });

  it("null initials fallback to M", () => {
    expect(getTeamPersonInitials(null)).toBe("M");
  });

  it("valid metric formatting", () => {
    expect(formatTeamDetailMetric(0)).toBe("0");
    expect(formatTeamDetailMetric(1250)).toBe("1,250");
  });

  it("negative metric fallback", () => {
    expect(formatTeamDetailMetric(-5)).toBe("—");
  });

  it("NaN metric fallback", () => {
    expect(formatTeamDetailMetric(Number.NaN)).toBe("—");
  });

  it("Infinity metric fallback", () => {
    expect(formatTeamDetailMetric(Infinity)).toBe("—");
  });

  it("valid absolute date", () => {
    expect(formatTeamDetailDate("2026-01-14T12:00:00.000Z")).toBe("Jan 14, 2026");
  });

  it("invalid absolute date", () => {
    expect(formatTeamDetailDate("not-a-date")).toBe("Date unavailable");
    expect(formatTeamDetailDate(null)).toBe("Date unavailable");
  });

  it("relative minutes", () => {
    const eighteenMinAgo = new Date(NOW - 18 * 60_000).toISOString();
    expect(formatTeamActivityTime(eighteenMinAgo, NOW)).toBe("18m ago");
  });

  it("relative hours", () => {
    const threeHoursAgo = new Date(NOW - 3 * 3_600_000).toISOString();
    expect(formatTeamActivityTime(threeHoursAgo, NOW)).toBe("3h ago");
  });

  it("relative days", () => {
    const eightDaysAgo = new Date(NOW - 8 * 86_400_000).toISOString();
    expect(formatTeamActivityTime(eightDaysAgo, NOW)).toBe("8d ago");
  });

  it("old-date formatting beyond 30 days", () => {
    const overThirtyDaysAgo = new Date(NOW - 40 * 86_400_000).toISOString();
    expect(formatTeamActivityTime(overThirtyDaysAgo, NOW)).not.toMatch(/ago/);
  });

  it("invalid relative time", () => {
    expect(formatTeamActivityTime("not-a-date", NOW)).toBe("Time unavailable");
    expect(formatTeamActivityTime(null, NOW)).toBe("Time unavailable");
  });

  it("role labels", () => {
    expect(getTeamRoleLabel("admin").label).toBe("Admin");
    expect(getTeamRoleLabel("moderator").label).toBe("Moderator");
    expect(getTeamRoleLabel("member").label).toBe("Member");
  });

  it("difficulty mappings", () => {
    expect(getDifficultyTone("easy").label).toBe("Easy");
    expect(getDifficultyTone("medium").label).toBe("Medium");
    expect(getDifficultyTone("hard").label).toBe("Hard");
    expect(getDifficultyTone("EASY").label).toBe("Easy");
  });

  it("unknown difficulty fallback remains readable", () => {
    expect(getDifficultyTone("bizarre").label).toBe("bizarre");
    expect(getDifficultyTone(null).label).toBe("Unknown");
  });
});

describe("TeamDetailReadOnlyContent — stats normalization", () => {
  it("valid response normalizes", () => {
    const result = normalizeTeamDetailStats(makeStats());
    expect(result).not.toBeNull();
    expect(result?.rank).toBe(4);
  });

  it("null rejected", () => {
    expect(normalizeTeamDetailStats(null)).toBeNull();
  });

  it("array rejected", () => {
    expect(normalizeTeamDetailStats([])).toBeNull();
  });

  it("primitive rejected", () => {
    expect(normalizeTeamDetailStats("invalid")).toBeNull();
    expect(normalizeTeamDetailStats(5)).toBeNull();
  });

  it("partial object rejected", () => {
    expect(normalizeTeamDetailStats({ rank: 4 })).toBeNull();
  });

  it("NaN summary rejected", () => {
    expect(normalizeTeamDetailStats(makeStats({ rank: Number.NaN }))).toBeNull();
  });

  it("Infinity summary rejected", () => {
    expect(normalizeTeamDetailStats(makeStats({ totalEarnedPoints: Infinity }))).toBeNull();
  });

  it("malformed contributors are filtered", () => {
    const raw = { ...makeStats(), topContributors: [makeStats().topContributors[0], null, "invalid", {}] };
    const result = normalizeTeamDetailStats(raw);
    expect(result?.topContributors.length).toBe(1);
  });

  it("malformed activity is filtered", () => {
    const raw = { ...makeStats(), recentActivity: [makeStats().recentActivity[0], null, "invalid", {}] };
    const result = normalizeTeamDetailStats(raw);
    expect(result?.recentActivity.length).toBe(1);
  });

  it("preserves contributor order", () => {
    const stats = makeStats();
    const result = normalizeTeamDetailStats(stats);
    expect(result?.topContributors.map((c) => c.userId)).toEqual(["u1", "u2"]);
  });

  it("preserves activity order", () => {
    const stats = makeStats({
      recentActivity: [
        { userName: "A", userImage: null, puzzleTitle: "P1", puzzleType: null, difficulty: null, pointsEarned: 10, solvedAt: null },
        { userName: "B", userImage: null, puzzleTitle: "P2", puzzleType: null, difficulty: null, pointsEarned: 20, solvedAt: null },
      ],
    });
    const result = normalizeTeamDetailStats(stats);
    expect(result?.recentActivity.map((a) => a.userName)).toEqual(["A", "B"]);
  });

  it("does not mutate the input", () => {
    const stats = makeStats();
    const snapshot = JSON.parse(JSON.stringify(stats));
    normalizeTeamDetailStats(stats);
    expect(stats).toEqual(snapshot);
  });

  it("source does not call .sort()", () => {
    expect(SOURCE.includes(".sort(")).toBe(false);
  });
});

describe("TeamDetailReadOnlyContent — statistics cards", () => {
  it("renders five labels", () => {
    render(<TeamDetailReadOnlyContent members={[makeMember()]} stats={makeStats()} statsLoading={false} theme={theme} />);
    const statsText = screen.getByTestId("team-detail-stats").textContent ?? "";
    expect(statsText).toMatch(/Rank/);
    expect(statsText).toMatch(/Team Points/);
    expect(statsText).toMatch(/Puzzles Solved/);
    expect(statsText).toMatch(/Members/);
    expect(statsText).toMatch(/Average Points/);
  });

  it("exact rank", () => {
    render(<TeamDetailReadOnlyContent members={[makeMember()]} stats={makeStats({ rank: 4 })} statsLoading={false} theme={theme} />);
    expect(screen.getByText("#4")).toBeTruthy();
  });

  it("exact points", () => {
    render(<TeamDetailReadOnlyContent members={[makeMember()]} stats={makeStats({ totalEarnedPoints: 5200 })} statsLoading={false} theme={theme} />);
    expect(screen.getByText("5,200")).toBeTruthy();
  });

  it("exact solved total", () => {
    render(<TeamDetailReadOnlyContent members={[makeMember()]} stats={makeStats({ totalPuzzlesSolved: 180 })} statsLoading={false} theme={theme} />);
    expect(screen.getByText("180")).toBeTruthy();
  });

  it("member count comes from members, not stats", () => {
    const members = [makeMember({ user: { id: "a", name: "A", email: null, image: null } }), makeMember({ user: { id: "b", name: "B", email: null, image: null } })];
    render(<TeamDetailReadOnlyContent members={members} stats={makeStats({ memberCount: 999 })} statsLoading={false} theme={theme} />);
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.queryByText("999")).toBeNull();
  });

  it("exact average", () => {
    render(<TeamDetailReadOnlyContent members={[makeMember()]} stats={makeStats({ avgPointsPerMember: 650 })} statsLoading={false} theme={theme} />);
    expect(screen.getByText("650")).toBeTruthy();
  });

  it("invalid values show —", () => {
    render(<TeamDetailReadOnlyContent members={[makeMember()]} stats={makeStats({ rank: -1 })} statsLoading={false} theme={theme} />);
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("stats unavailable does not fabricate zero", () => {
    render(<TeamDetailReadOnlyContent members={[makeMember()]} stats={null} statsLoading={false} theme={theme} />);
    expect(screen.queryByText("0")).toBeNull();
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("stats loading uses Skeleton", () => {
    const { container } = render(<TeamDetailReadOnlyContent members={[makeMember()]} stats={null} statsLoading={true} theme={theme} />);
    expect(container.querySelectorAll("[data-skeleton='true']").length).toBeGreaterThan(0);
  });

  it("real member count remains visible while stats load", () => {
    render(<TeamDetailReadOnlyContent members={[makeMember(), makeMember({ user: { id: "b", name: "B", email: null, image: null } })]} stats={null} statsLoading={true} theme={theme} />);
    expect(screen.getByText("2")).toBeTruthy();
  });

  it("tabular numerals present", () => {
    const { container } = render(<TeamDetailReadOnlyContent members={[makeMember()]} stats={makeStats()} statsLoading={false} theme={theme} />);
    expect(container.querySelectorAll(".tabular-nums").length).toBeGreaterThan(0);
  });

  it("no count-up animation classes", () => {
    const { container } = render(<TeamDetailReadOnlyContent members={[makeMember()]} stats={makeStats()} statsLoading={false} theme={theme} />);
    expect(container.innerHTML).not.toMatch(/count-up/);
  });
});

describe("TeamDetailReadOnlyContent — contributors", () => {
  it("preserves API order", () => {
    render(<TeamDetailReadOnlyContent members={[makeMember()]} stats={makeStats()} statsLoading={false} theme={theme} />);
    const names = screen.getAllByText(/Jason Garrett|Alice/).map((el) => el.textContent);
    expect(names[0]).toBe("Jason Garrett");
  });

  it("renders at most five entries", () => {
    const many = Array.from({ length: 8 }, (_, i) => ({ userId: `u${i}`, name: `User ${i}`, image: null, role: "member", joinedAt: null, earnedPoints: 100 - i, puzzlesSolved: 10 }));
    render(<TeamDetailReadOnlyContent members={[makeMember()]} stats={makeStats({ topContributors: many })} statsLoading={false} theme={theme} />);
    expect(screen.getAllByText(/User \d/).length).toBe(5);
  });

  it("top-three icons render", () => {
    const three = [
      { userId: "u1", name: "A", image: null, role: "member", joinedAt: null, earnedPoints: 300, puzzlesSolved: 10 },
      { userId: "u2", name: "B", image: null, role: "member", joinedAt: null, earnedPoints: 200, puzzlesSolved: 8 },
      { userId: "u3", name: "C", image: null, role: "member", joinedAt: null, earnedPoints: 100, puzzlesSolved: 6 },
    ];
    const { container } = render(<TeamDetailReadOnlyContent members={[makeMember()]} stats={makeStats({ topContributors: three })} statsLoading={false} theme={theme} />);
    expect(container.querySelector("svg.lucide-crown")).toBeTruthy();
    expect(container.querySelector("svg.lucide-medal")).toBeTruthy();
    expect(container.querySelector("svg.lucide-award")).toBeTruthy();
  });

  it("no medal emoji", () => {
    const { container } = render(<TeamDetailReadOnlyContent members={[makeMember()]} stats={makeStats()} statsLoading={false} theme={theme} />);
    expect(/🥇|🥈|🥉/.test(container.textContent ?? "")).toBe(false);
  });

  it("exact points and solved count", () => {
    render(<TeamDetailReadOnlyContent members={[makeMember()]} stats={makeStats()} statsLoading={false} theme={theme} />);
    expect(screen.getByText("2,000")).toBeTruthy();
    expect(screen.getByText("60 solved")).toBeTruthy();
  });

  it("valid profile route", () => {
    render(<TeamDetailReadOnlyContent members={[]} stats={makeStats()} statsLoading={false} theme={theme} />);
    expect(screen.getByRole("link", { name: /Jason Garrett/ }).getAttribute("href")).toBe("/profile/u1");
  });

  it("empty ID has no profile link", () => {
    const withEmptyId = makeStats({ topContributors: [{ userId: "", name: "NoLink", image: null, role: "member", joinedAt: null, earnedPoints: 10, puzzlesSolved: 1 }] });
    render(<TeamDetailReadOnlyContent members={[]} stats={withEmptyId} statsLoading={false} theme={theme} />);
    expect(screen.queryByRole("link", { name: /NoLink/ })).toBeNull();
    expect(screen.getByText("NoLink")).toBeTruthy();
  });

  it("broken image falls back to initials", () => {
    const withImage = makeStats({ topContributors: [{ userId: "u1", name: "Jason Garrett", image: "https://example.test/broken.png", role: "member", joinedAt: null, earnedPoints: 10, puzzlesSolved: 1 }] });
    const { container } = render(<TeamDetailReadOnlyContent members={[]} stats={withImage} statsLoading={false} theme={theme} />);
    const img = container.querySelector("img")!;
    fireEvent.error(img);
    expect(screen.getByText("JG")).toBeTruthy();
  });

  it("missing image falls back to initials", () => {
    render(<TeamDetailReadOnlyContent members={[]} stats={makeStats()} statsLoading={false} theme={theme} />);
    expect(screen.getByText("JG")).toBeTruthy();
  });

  it("contribution width clamps between 0 and 100", () => {
    const { container } = render(<TeamDetailReadOnlyContent members={[makeMember()]} stats={makeStats()} statsLoading={false} theme={theme} />);
    const bars = Array.from(container.querySelectorAll("[style*='width']")) as HTMLElement[];
    bars.forEach((bar) => {
      const width = parseInt(bar.style.width, 10);
      if (!Number.isNaN(width)) {
        expect(width).toBeGreaterThanOrEqual(0);
        expect(width).toBeLessThanOrEqual(100);
      }
    });
  });

  it("does not sort contributors", () => {
    const outOfOrder = makeStats({
      topContributors: [
        { userId: "low", name: "Low", image: null, role: "member", joinedAt: null, earnedPoints: 10, puzzlesSolved: 1 },
        { userId: "high", name: "High", image: null, role: "member", joinedAt: null, earnedPoints: 999, puzzlesSolved: 50 },
      ],
    });
    render(<TeamDetailReadOnlyContent members={[makeMember()]} stats={outOfOrder} statsLoading={false} theme={theme} />);
    const names = screen.getAllByText(/^(Low|High)$/).map((el) => el.textContent);
    expect(names).toEqual(["Low", "High"]);
  });

  it("empty state renders", () => {
    render(<TeamDetailReadOnlyContent members={[makeMember()]} stats={makeStats({ topContributors: [] })} statsLoading={false} theme={theme} />);
    expect(screen.getByText("No contributor activity yet.")).toBeTruthy();
  });
});

describe("TeamDetailReadOnlyContent — activity", () => {
  it("preserves API order", () => {
    const stats = makeStats({
      recentActivity: [
        { userName: "First", userImage: null, puzzleTitle: "P1", puzzleType: null, difficulty: null, pointsEarned: 10, solvedAt: null },
        { userName: "Second", userImage: null, puzzleTitle: "P2", puzzleType: null, difficulty: null, pointsEarned: 20, solvedAt: null },
      ],
    });
    render(<TeamDetailReadOnlyContent members={[makeMember()]} stats={stats} statsLoading={false} theme={theme} />);
    const names = screen.getAllByText(/First|Second/).map((el) => el.textContent);
    expect(names).toEqual(["First", "Second"]);
  });

  it("uses no internal vertical-scroll class", () => {
    const { container } = render(<TeamDetailReadOnlyContent members={[makeMember()]} stats={makeStats()} statsLoading={false} theme={theme} />);
    expect(container.innerHTML).not.toMatch(/max-h-80|overflow-y-auto/);
  });

  it("user fallback to Member", () => {
    const stats = makeStats({ recentActivity: [{ userName: null, userImage: null, puzzleTitle: "P1", puzzleType: null, difficulty: null, pointsEarned: 10, solvedAt: null }] });
    render(<TeamDetailReadOnlyContent members={[]} stats={stats} statsLoading={false} theme={theme} />);
    const activity = screen.getByTestId("team-detail-activity");
    expect(activity.textContent).toMatch(/Member/);
  });

  it("puzzle title fallback to 'a puzzle'", () => {
    const stats = makeStats({ recentActivity: [{ userName: "A", userImage: null, puzzleTitle: null, puzzleType: null, difficulty: null, pointsEarned: 10, solvedAt: null }] });
    render(<TeamDetailReadOnlyContent members={[makeMember()]} stats={stats} statsLoading={false} theme={theme} />);
    expect(screen.getByText(/a puzzle/)).toBeTruthy();
  });

  it("difficulty badge renders", () => {
    render(<TeamDetailReadOnlyContent members={[makeMember()]} stats={makeStats()} statsLoading={false} theme={theme} />);
    expect(screen.getByText("Easy")).toBeTruthy();
  });

  it("exact points", () => {
    render(<TeamDetailReadOnlyContent members={[makeMember()]} stats={makeStats()} statsLoading={false} theme={theme} />);
    expect(screen.getByText(/\+25 points/)).toBeTruthy();
  });

  it("invalid points fallback", () => {
    const stats = makeStats({ recentActivity: [{ userName: "A", userImage: null, puzzleTitle: "P1", puzzleType: null, difficulty: null, pointsEarned: Number.NaN, solvedAt: null }] });
    render(<TeamDetailReadOnlyContent members={[makeMember()]} stats={stats} statsLoading={false} theme={theme} />);
    expect(screen.getByText("Points unavailable")).toBeTruthy();
  });

  it("valid relative time renders", () => {
    render(<TeamDetailReadOnlyContent members={[makeMember()]} stats={makeStats()} statsLoading={false} theme={theme} />);
    expect(screen.queryByText("Time unavailable")).toBeNull();
  });

  it("invalid time fallback", () => {
    const stats = makeStats({ recentActivity: [{ userName: "A", userImage: null, puzzleTitle: "P1", puzzleType: null, difficulty: null, pointsEarned: 10, solvedAt: "bad-date" }] });
    render(<TeamDetailReadOnlyContent members={[makeMember()]} stats={stats} statsLoading={false} theme={theme} />);
    expect(screen.getByText("Time unavailable")).toBeTruthy();
  });

  it("empty state renders", () => {
    render(<TeamDetailReadOnlyContent members={[makeMember()]} stats={makeStats({ recentActivity: [] })} statsLoading={false} theme={theme} />);
    expect(screen.getByText("No recent puzzle activity.")).toBeTruthy();
  });

  it("does not sort", () => {
    expect(SOURCE.includes(".sort(")).toBe(false);
  });
});

describe("TeamDetailReadOnlyContent — roster", () => {
  it("preserves primary member order", () => {
    const members = [
      makeMember({ user: { id: "b", name: "Bravo", email: null, image: null } }),
      makeMember({ user: { id: "a", name: "Alpha", email: null, image: null } }),
    ];
    render(<TeamDetailReadOnlyContent members={members} stats={null} statsLoading={false} theme={theme} />);
    const names = screen.getAllByText(/Bravo|Alpha/).map((el) => el.textContent);
    expect(names).toEqual(["Bravo", "Alpha"]);
  });

  it("every member renders exactly once", () => {
    const members = [makeMember({ user: { id: "a", name: "A", email: null, image: null } }), makeMember({ user: { id: "b", name: "B", email: null, image: null } })];
    const { container } = render(<TeamDetailReadOnlyContent members={members} stats={null} statsLoading={false} theme={theme} />);
    const rosterSection = container.querySelector("#team-detail-members-heading")!.closest("section")!;
    expect(rosterSection.querySelectorAll("li").length).toBe(2);
  });

  it("enriches from contributor data by matching ID", () => {
    render(<TeamDetailReadOnlyContent members={[makeMember({ user: { id: "u1", name: "Jason Garrett", email: null, image: null } })]} stats={makeStats()} statsLoading={false} theme={theme} />);
    const roster = screen.getByTestId("team-detail-members");
    expect(roster.textContent).toMatch(/60 solved/);
  });

  it("enrichment does not reorder members", () => {
    const members = [
      makeMember({ user: { id: "u2", name: "Alice", email: null, image: null } }),
      makeMember({ user: { id: "u1", name: "Jason Garrett", email: null, image: null } }),
    ];
    render(<TeamDetailReadOnlyContent members={members} stats={makeStats()} statsLoading={false} theme={theme} />);
    const roster = screen.getByTestId("team-detail-members");
    const names = Array.from(roster.querySelectorAll("li")).map((li) =>
      li.textContent?.includes("Alice") ? "Alice" : li.textContent?.includes("Jason Garrett") ? "Jason Garrett" : "?"
    );
    expect(names[0]).toBe("Alice");
  });

  it("valid profile route", () => {
    render(<TeamDetailReadOnlyContent members={[makeMember({ user: { id: "xyz", name: "Test", email: null, image: null } })]} stats={null} statsLoading={false} theme={theme} />);
    expect(screen.getByRole("link", { name: /Test/ }).getAttribute("href")).toBe("/profile/xyz");
  });

  it("empty ID has no route", () => {
    render(<TeamDetailReadOnlyContent members={[makeMember({ user: { id: "", name: "NoRoute", email: null, image: null } })]} stats={null} statsLoading={false} theme={theme} />);
    expect(screen.queryByRole("link", { name: /NoRoute/ })).toBeNull();
  });

  it("role badges render", () => {
    render(<TeamDetailReadOnlyContent members={[makeMember({ role: "admin" })]} stats={null} statsLoading={false} theme={theme} />);
    expect(screen.getByText("Admin")).toBeTruthy();
  });

  it("joined date renders when contributor data exists", () => {
    render(<TeamDetailReadOnlyContent members={[makeMember({ user: { id: "u1", name: "Jason Garrett", email: null, image: null } })]} stats={makeStats()} statsLoading={false} theme={theme} />);
    expect(screen.getByText(/Joined/)).toBeTruthy();
  });

  it("invalid joined date is omitted safely (no crash)", () => {
    const stats = makeStats({ topContributors: [{ userId: "u1", name: "Jason Garrett", image: null, role: "admin", joinedAt: "bad-date", earnedPoints: 10, puzzlesSolved: 1 }] });
    expect(() => render(<TeamDetailReadOnlyContent members={[makeMember({ user: { id: "u1", name: "Jason Garrett", email: null, image: null } })]} stats={stats} statsLoading={false} theme={theme} />)).not.toThrow();
  });

  it("metrics render when stats exist", () => {
    render(<TeamDetailReadOnlyContent members={[makeMember({ user: { id: "u1", name: "Jason Garrett", email: null, image: null } })]} stats={makeStats()} statsLoading={false} theme={theme} />);
    expect(screen.getByText(/2,000 pts/)).toBeTruthy();
  });

  it("metrics do not fabricate when stats are unavailable", () => {
    render(<TeamDetailReadOnlyContent members={[makeMember()]} stats={null} statsLoading={false} theme={theme} />);
    expect(screen.queryByText(/pts/)).toBeNull();
  });

  it("member action slot renders", () => {
    render(<TeamDetailReadOnlyContent members={[makeMember()]} stats={null} statsLoading={false} theme={theme} renderMemberAction={() => <button type="button">Remove</button>} />);
    expect(screen.getByRole("button", { name: "Remove" })).toBeTruthy();
  });

  it("no action container renders when the slot returns null", () => {
    render(<TeamDetailReadOnlyContent members={[makeMember()]} stats={null} statsLoading={false} theme={theme} renderMemberAction={() => null} />);
    expect(screen.queryByRole("button", { name: "Remove" })).toBeNull();
  });

  it("no fetch", () => {
    const originalFetch = global.fetch;
    const fetchMock = jest.fn();
    (global as any).fetch = fetchMock;
    render(<TeamDetailReadOnlyContent members={[makeMember()]} stats={makeStats()} statsLoading={false} theme={theme} />);
    expect(fetchMock).not.toHaveBeenCalled();
    (global as any).fetch = originalFetch;
  });

  it("no raw hex/RGB colors in source", () => {
    expect(RAW_HEX.test(SOURCE)).toBe(false);
    expect(RAW_RGB.test(SOURCE)).toBe(false);
  });

  it("no hard-coded emoji", () => {
    const { container } = render(<TeamDetailReadOnlyContent members={[makeMember()]} stats={makeStats()} statsLoading={false} theme={theme} />);
    expect(NO_EMOJI.test(container.textContent ?? "")).toBe(false);
  });

  it("no horizontal-scroll classes anywhere in source", () => {
    expect(SOURCE).not.toMatch(/overflow-x-auto/);
  });

  it("empty members state renders", () => {
    render(<TeamDetailReadOnlyContent members={[]} stats={null} statsLoading={false} theme={theme} />);
    expect(screen.getByText("No members to display.")).toBeTruthy();
  });
});
