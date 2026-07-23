/** @jest-environment jsdom */
import fs from "fs";
import path from "path";
import { render, screen } from "@testing-library/react";
import TeamDetailHero, { type TeamDetailHeroProps } from "./TeamDetailHero";
import { getThemeConfig } from "@/lib/profileThemes";

const RAW_HEX = /#[0-9a-fA-F]{3,8}\b/;
const RAW_RGB = /rgba?\(/i;
const NO_EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
const SOURCE = fs.readFileSync(path.join(__dirname, "TeamDetailHero.tsx"), "utf8");

const theme = getThemeConfig("default");

function makeProps(overrides: Partial<TeamDetailHeroProps> = {}): TeamDetailHeroProps {
  return {
    teamId: "team-abc12345",
    name: "Midnight Puzzle Society",
    description: "A team that solves puzzles together.",
    isPublic: true,
    createdAt: "2026-01-14T12:00:00.000Z",
    userRole: null,
    rank: 4,
    totalTeams: 28,
    theme,
    ...overrides,
  };
}

describe("TeamDetailHero — navigation", () => {
  it("Back to Teams links to exact route", () => {
    render(<TeamDetailHero {...makeProps()} />);
    expect(screen.getByRole("link", { name: /Back to Teams/ }).getAttribute("href")).toBe("/teams");
  });

  it("Team Leaderboards links to exact route", () => {
    render(<TeamDetailHero {...makeProps()} />);
    expect(screen.getByRole("link", { name: /Team Leaderboards/ }).getAttribute("href")).toBe("/leaderboards/teams");
  });

  it("both are real links", () => {
    render(<TeamDetailHero {...makeProps()} />);
    expect(screen.getByRole("link", { name: /Back to Teams/ }).tagName).toBe("A");
    expect(screen.getByRole("link", { name: /Team Leaderboards/ }).tagName).toBe("A");
  });

  it("both have at least 44px target classes", () => {
    render(<TeamDetailHero {...makeProps()} />);
    expect(screen.getByRole("link", { name: /Back to Teams/ }).className).toMatch(/min-h-11/);
    expect(screen.getByRole("link", { name: /Team Leaderboards/ }).className).toMatch(/min-h-11/);
  });

  it("both have focus-visible classes", () => {
    render(<TeamDetailHero {...makeProps()} />);
    expect(screen.getByRole("link", { name: /Back to Teams/ }).className).toMatch(/focus-visible/);
    expect(screen.getByRole("link", { name: /Team Leaderboards/ }).className).toMatch(/focus-visible/);
  });
});

describe("TeamDetailHero — identity", () => {
  it("valid name renders", () => {
    render(<TeamDetailHero {...makeProps({ name: "Midnight Puzzle Society" })} />);
    expect(screen.getByText("Midnight Puzzle Society")).toBeTruthy();
  });

  it("null name becomes Unnamed Team", () => {
    render(<TeamDetailHero {...makeProps({ name: null })} />);
    expect(screen.getByText("Unnamed Team")).toBeTruthy();
  });

  it("empty name becomes Unnamed Team", () => {
    render(<TeamDetailHero {...makeProps({ name: "" })} />);
    expect(screen.getByText("Unnamed Team")).toBeTruthy();
  });

  it("two-word initials", () => {
    render(<TeamDetailHero {...makeProps({ name: "Puzzle Masters" })} />);
    expect(screen.getByText("PM")).toBeTruthy();
  });

  it("one-word initials", () => {
    render(<TeamDetailHero {...makeProps({ name: "Solvers" })} />);
    expect(screen.getByText("S")).toBeTruthy();
  });

  it("null initials fallback to T", () => {
    render(<TeamDetailHero {...makeProps({ name: null })} />);
    expect(screen.getByText("T")).toBeTruthy();
  });

  it("description renders", () => {
    render(<TeamDetailHero {...makeProps({ description: "A great team." })} />);
    expect(screen.getByText("A great team.")).toBeTruthy();
  });

  it("null description omits an empty paragraph", () => {
    const { container } = render(<TeamDetailHero {...makeProps({ description: null })} />);
    expect(container.querySelectorAll("p").length).toBe(0);
  });

  it("long name wraps (break-words)", () => {
    const longName = "A".repeat(80);
    render(<TeamDetailHero {...makeProps({ name: longName })} />);
    expect(screen.getByText(longName).className).toMatch(/break-words/);
  });

  it("long description wraps (break-words)", () => {
    const longDescription = "B".repeat(200);
    render(<TeamDetailHero {...makeProps({ description: longDescription })} />);
    expect(screen.getByText(longDescription).className).toMatch(/break-words/);
  });
});

describe("TeamDetailHero — status", () => {
  it("public badge renders", () => {
    render(<TeamDetailHero {...makeProps({ isPublic: true })} />);
    expect(screen.getByText("Public")).toBeTruthy();
  });

  it("private badge renders", () => {
    render(<TeamDetailHero {...makeProps({ isPublic: false })} />);
    expect(screen.getByText("Private")).toBeTruthy();
  });

  it("public icon (UsersRound) renders", () => {
    const { container } = render(<TeamDetailHero {...makeProps({ isPublic: true })} />);
    expect(container.querySelector("svg.lucide-users-round")).toBeTruthy();
  });

  it("private icon (Lock) renders", () => {
    const { container } = render(<TeamDetailHero {...makeProps({ isPublic: false })} />);
    expect(container.querySelector("svg.lucide-lock")).toBeTruthy();
  });

  it("status is visible text, not color-only", () => {
    render(<TeamDetailHero {...makeProps({ isPublic: false })} />);
    expect(screen.getByText("Private").textContent).toBe("Private");
  });
});

describe("TeamDetailHero — rank", () => {
  it("valid rank renders", () => {
    render(<TeamDetailHero {...makeProps({ rank: 4, totalTeams: null })} />);
    expect(screen.getByText(/Rank #4/)).toBeTruthy();
  });

  it("total-team context renders", () => {
    render(<TeamDetailHero {...makeProps({ rank: 4, totalTeams: 28 })} />);
    expect(screen.getByText(/of 28 teams/)).toBeTruthy();
  });

  it("invalid rank is omitted", () => {
    render(<TeamDetailHero {...makeProps({ rank: 0 })} />);
    expect(screen.queryByText(/Rank/)).toBeNull();
  });

  it("no #0 ever renders", () => {
    render(<TeamDetailHero {...makeProps({ rank: 0 })} />);
    expect(screen.queryByText("#0")).toBeNull();
  });

  it("no NaN ever renders", () => {
    render(<TeamDetailHero {...makeProps({ rank: Number.NaN })} />);
    expect(screen.queryByText(/NaN/)).toBeNull();
  });
});

describe("TeamDetailHero — metadata", () => {
  it("valid created date renders", () => {
    render(<TeamDetailHero {...makeProps({ createdAt: "2026-01-14T12:00:00.000Z" })} />);
    expect(screen.getByText("January 14, 2026")).toBeTruthy();
  });

  it("invalid created date falls back", () => {
    render(<TeamDetailHero {...makeProps({ createdAt: "not-a-date" })} />);
    expect(screen.getByText("Date unavailable")).toBeTruthy();
  });

  it("admin role renders", () => {
    render(<TeamDetailHero {...makeProps({ userRole: "admin" })} />);
    expect(screen.getByText("Admin")).toBeTruthy();
  });

  it("moderator role renders", () => {
    render(<TeamDetailHero {...makeProps({ userRole: "moderator" })} />);
    expect(screen.getByText("Moderator")).toBeTruthy();
  });

  it("member role renders", () => {
    render(<TeamDetailHero {...makeProps({ userRole: "member" })} />);
    expect(screen.getByText("Member")).toBeTruthy();
  });

  it("not-a-member role renders", () => {
    render(<TeamDetailHero {...makeProps({ userRole: null })} />);
    expect(screen.getByText("Not a member")).toBeTruthy();
  });

  it("role icons render", () => {
    const { container } = render(<TeamDetailHero {...makeProps({ userRole: "admin" })} />);
    expect(container.querySelector("svg.lucide-crown")).toBeTruthy();
  });

  it("member sees team code", () => {
    render(<TeamDetailHero {...makeProps({ userRole: "member", teamId: "abcdefgh12345" })} />);
    expect(screen.getByText("Team code")).toBeTruthy();
  });

  it("nonmember does not see team code", () => {
    render(<TeamDetailHero {...makeProps({ userRole: null })} />);
    expect(screen.queryByText("Team code")).toBeNull();
  });

  it("team code is first eight characters", () => {
    render(<TeamDetailHero {...makeProps({ userRole: "admin", teamId: "abcdefgh12345" })} />);
    expect(screen.getByText("abcdefgh")).toBeTruthy();
  });
});

describe("TeamDetailHero — actions", () => {
  it("action slot renders when provided", () => {
    render(<TeamDetailHero {...makeProps({ actions: <button type="button">Leave Team</button> })} />);
    expect(screen.getByRole("button", { name: "Leave Team" })).toBeTruthy();
  });

  it("empty action slot leaves no empty wrapper", () => {
    const { container } = render(<TeamDetailHero {...makeProps({ actions: undefined })} />);
    // The action wrapper div (mt-5 flex flex-wrap gap-2) should not exist when actions is absent.
    expect(container.querySelector(".mt-5.flex.flex-wrap.gap-2")).toBeNull();
  });

  it("hero performs no fetch", () => {
    const originalFetch = global.fetch;
    const fetchMock = jest.fn();
    (global as any).fetch = fetchMock;
    render(<TeamDetailHero {...makeProps()} />);
    expect(fetchMock).not.toHaveBeenCalled();
    (global as any).fetch = originalFetch;
  });

  it("no raw hex/RGB colors in source", () => {
    expect(RAW_HEX.test(SOURCE)).toBe(false);
    expect(RAW_RGB.test(SOURCE)).toBe(false);
  });

  it("no hard-coded emoji", () => {
    const { container } = render(<TeamDetailHero {...makeProps()} />);
    expect(NO_EMOJI.test(container.textContent ?? "")).toBe(false);
  });
});
