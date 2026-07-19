/** @jest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import DashboardCommandHeader from "./DashboardCommandHeader";

function show(overrides: Partial<React.ComponentProps<typeof DashboardCommandHeader>> = {}) {
  return render(
    <DashboardCommandHeader
      displayName="Jamie Rivera"
      initials="JR"
      totalPoints={12345}
      rank={7}
      {...overrides}
    />,
  );
}

describe("DashboardCommandHeader", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the first name in the heading", () => {
    show();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Ready for another round, Jamie?");
  });

  it("falls back to Player when displayName is empty", () => {
    show({ displayName: "" });
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Ready for another round, Player?");
  });

  it("shows formatted points", () => {
    show({ totalPoints: 12345 });
    expect(
      screen.getByText((_, node) => node?.tagName === "P" && node.textContent === "Rank #7 · 12,345 pts"),
    ).toBeTruthy();
  });

  it("shows Rank #N when ranked", () => {
    show({ rank: 42 });
    expect(
      screen.getByText((_, node) => node?.tagName === "P" && (node.textContent?.includes("Rank #42") ?? false)),
    ).toBeTruthy();
  });

  it("shows Unranked when rank is null", () => {
    show({ rank: null });
    expect(
      screen.getByText((_, node) => node?.tagName === "P" && (node.textContent?.includes("Unranked") ?? false)),
    ).toBeTruthy();
  });

  it("Play Daily links to /daily", () => {
    show();
    expect(screen.getByRole("link", { name: "Play Daily" }).getAttribute("href")).toBe("/daily");
  });

  it("Browse Puzzles links to /puzzles", () => {
    show();
    expect(screen.getByRole("link", { name: "Browse Puzzles" }).getAttribute("href")).toBe("/puzzles");
  });

  it("Profile links to /profile with the correct accessible label", () => {
    show();
    const profileLink = screen.getByRole("link", { name: "Open player profile" });
    expect(profileLink.getAttribute("href")).toBe("/profile");
  });

  it("shows initials as the avatar fallback", () => {
    show({ initials: "JR" });
    expect(screen.getByText("JR")).toBeTruthy();
  });

  it("applies the avatar URL when provided", () => {
    const { container } = show({ avatarUrl: "https://example.com/avatar.png" });
    const bgLayer = container.querySelector('[style*="avatar.png"]');
    expect(bgLayer).toBeTruthy();
  });

  it("keeps initials present even when an avatar URL is provided", () => {
    show({ avatarUrl: "https://example.com/avatar.png", initials: "JR" });
    expect(screen.getByText("JR")).toBeTruthy();
  });

  it("shows the Admin chip only when isAdmin is true", () => {
    show({ isAdmin: true });
    expect(screen.getByText("Admin")).toBeTruthy();
    cleanup();
    show({ isAdmin: false });
    expect(screen.queryByText("Admin")).toBeNull();
  });

  it("has both primary and secondary actions present", () => {
    show();
    expect(screen.getByRole("link", { name: "Play Daily" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Browse Puzzles" })).toBeTruthy();
  });

  it("contains exactly one h1", () => {
    show();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });
});
