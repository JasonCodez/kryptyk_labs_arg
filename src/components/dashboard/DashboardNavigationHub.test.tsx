/** @jest-environment jsdom */

import { render, screen, within } from "@testing-library/react";
import DashboardNavigationHub from "./DashboardNavigationHub";

const DESTINATIONS: { title: string; href: string }[] = [
  { title: "Daily Challenge", href: "/daily" },
  { title: "Puzzle Library", href: "/puzzles" },
  { title: "Browse Categories", href: "/categories" },
  { title: "Warz", href: "/warz" },
  { title: "Leaderboards", href: "/leaderboards" },
  { title: "My Teams", href: "/teams" },
  { title: "Frequency", href: "/frequency" },
  { title: "Achievements", href: "/achievements" },
  { title: "My Profile", href: "/profile" },
  { title: "Activity Feed", href: "/dashboard/activity" },
  { title: "FAQ", href: "/faq" },
];

const TOUR_IDS = [
  "tour-card-daily",
  "tour-card-puzzles",
  "tour-card-warz",
  "tour-card-leaderboards",
  "tour-card-teams",
  "tour-card-frequency",
  "tour-card-achievements",
  "tour-card-profile",
];

// Emoji-range check — this hub uses inline SVGs for icons, never emoji glyphs.
const EMOJI_PATTERN = /\p{Extended_Pictographic}/u;

function linkFor(title: string): HTMLElement {
  // Anchor at the start of the accessible name — the link's name concatenates
  // title + chip + description, and some descriptions (e.g. Activity Feed's
  // "...PuzzleWarz activity.") contain other titles as substrings.
  return screen.getByRole("link", { name: new RegExp("^" + title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) });
}

describe("DashboardNavigationHub", () => {
  beforeEach(() => {
    render(<DashboardNavigationHub />);
  });

  it("renders without props", () => {
    expect(screen.getByRole("navigation", { name: "Dashboard navigation" })).toBeTruthy();
  });

  it("renders a navigation region", () => {
    expect(screen.getByRole("navigation")).toBeTruthy();
  });

  it("renders Play, Compete, Progress, and More headings", () => {
    expect(screen.getByRole("heading", { level: 2, name: "Play" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Compete" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Progress" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "More" })).toBeTruthy();
  });

  it("renders all eleven destinations with the correct hrefs", () => {
    for (const { title, href } of DESTINATIONS) {
      expect(linkFor(title).getAttribute("href")).toBe(href);
    }
    expect(screen.getAllByRole("link")).toHaveLength(DESTINATIONS.length);
  });

  it("shows Today on Daily Challenge", () => {
    const link = linkFor("Daily Challenge");
    expect(within(link).getByText("Today")).toBeTruthy();
  });

  it("shows Live on Warz", () => {
    const link = linkFor("Warz");
    expect(within(link).getByText("Live")).toBeTruthy();
  });

  it("shows New on Frequency", () => {
    const link = linkFor("Frequency");
    expect(within(link).getByText("New")).toBeTruthy();
  });

  it("marks Daily Challenge as featured in accessible text", () => {
    const link = linkFor("Daily Challenge");
    expect(link.textContent).toContain("Featured");
  });

  it("preserves all required DashboardTour IDs", () => {
    for (const id of TOUR_IDS) {
      expect(document.getElementById(id)).toBeTruthy();
    }
  });

  it("hides all icons from assistive technology", () => {
    const svgs = document.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThan(0);
    svgs.forEach((svg) => {
      expect(svg.getAttribute("aria-hidden")).toBe("true");
    });
  });

  it("uses no emoji as a navigation item's main icon", () => {
    for (const { title } of DESTINATIONS) {
      const link = linkFor(title);
      // The icon slot is an aria-hidden span; assert none of the rendered
      // text (title/desc/chip) contains an emoji glyph either.
      expect(EMOJI_PATTERN.test(link.textContent || "")).toBe(false);
    }
  });

  it("has no buttons — destinations are links", () => {
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
});
