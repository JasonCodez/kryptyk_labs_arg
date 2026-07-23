/** @jest-environment jsdom */
import { render, screen } from "@testing-library/react";
import LeaderboardHeader from "./LeaderboardHeader";

jest.mock("framer-motion", () => ({
  motion: { header: ({ initial: _initial, animate: _animate, transition: _transition, ...props }: any) => <header {...props} /> },
}));
jest.mock("@/hooks/useAppReducedMotion", () => ({ useAppReducedMotion: () => true }));

const NO_EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
const RAW_HEX = /#[0-9a-fA-F]{3,8}\b/;
const RAW_RGB = /rgba?\(/i;

describe("LeaderboardHeader", () => {
  it("renders 'Leaderboards' as the main heading", () => {
    render(<LeaderboardHeader activeTab="global" />);
    expect(screen.getByRole("heading", { level: 1, name: "Leaderboards" })).toBeTruthy();
  });

  it("renders the competition eyebrow", () => {
    render(<LeaderboardHeader activeTab="global" />);
    expect(screen.getByText("PuzzleWarz Competition")).toBeTruthy();
  });

  it("renders Global supporting copy", () => {
    render(<LeaderboardHeader activeTab="global" />);
    expect(screen.getByText("See how your earned points compare across PuzzleWarz.")).toBeTruthy();
  });

  it("renders Weekly supporting copy", () => {
    render(<LeaderboardHeader activeTab="weekly" />);
    expect(screen.getByText("Climb this week’s rankings before the current period ends.")).toBeTruthy();
  });

  it("renders Monthly supporting copy", () => {
    render(<LeaderboardHeader activeTab="monthly" />);
    expect(screen.getByText("Build your strongest month and compete for the top positions.")).toBeTruthy();
  });

  it("renders Following supporting copy", () => {
    render(<LeaderboardHeader activeTab="following" />);
    expect(screen.getByText("Compare your progress with players you follow.")).toBeTruthy();
  });

  it("Back to Dashboard links to /dashboard", () => {
    render(<LeaderboardHeader activeTab="global" />);
    expect(screen.getByRole("link", { name: /Back to Dashboard/i }).getAttribute("href")).toBe("/dashboard");
  });

  it("Team Leaderboards links to /leaderboards/teams", () => {
    render(<LeaderboardHeader activeTab="global" />);
    expect(screen.getByRole("link", { name: /Team Leaderboards/i }).getAttribute("href")).toBe("/leaderboards/teams");
  });

  it("both header action targets are at least 44px tall (min-h-11 = 44px)", () => {
    render(<LeaderboardHeader activeTab="global" />);
    expect(screen.getByRole("link", { name: /Back to Dashboard/i }).className).toMatch(/min-h-11/);
    expect(screen.getByRole("link", { name: /Team Leaderboards/i }).className).toMatch(/min-h-11/);
  });

  it("uses Lucide icons for both header actions", () => {
    const { container } = render(<LeaderboardHeader activeTab="global" />);
    expect(container.querySelectorAll("svg").length).toBeGreaterThanOrEqual(2);
  });

  it("decorative icons are hidden from assistive technology", () => {
    const { container } = render(<LeaderboardHeader activeTab="global" />);
    const icons = container.querySelectorAll("svg");
    icons.forEach((icon) => expect(icon.getAttribute("aria-hidden")).toBe("true"));
  });

  it("contains no emoji", () => {
    const { container } = render(<LeaderboardHeader activeTab="global" />);
    expect(NO_EMOJI.test(container.textContent ?? "")).toBe(false);
  });

  it("contains no raw hex colors", () => {
    const { container } = render(<LeaderboardHeader activeTab="global" />);
    expect(RAW_HEX.test(container.innerHTML)).toBe(false);
  });

  it("contains no raw RGB or RGBA colors", () => {
    const { container } = render(<LeaderboardHeader activeTab="global" />);
    expect(RAW_RGB.test(container.innerHTML)).toBe(false);
  });

  it("keeps long supporting copy within a bounded container", () => {
    render(<LeaderboardHeader activeTab="monthly" />);
    const copy = screen.getByText("Build your strongest month and compete for the top positions.");
    expect(copy.className).toMatch(/max-w/);
  });

  it("performs no network request", () => {
    const originalFetch = global.fetch;
    const fetchMock = jest.fn();
    (global as any).fetch = fetchMock;
    render(<LeaderboardHeader activeTab="global" />);
    expect(fetchMock).not.toHaveBeenCalled();
    (global as any).fetch = originalFetch;
  });

  it("performs no client navigation outside its own two links", () => {
    render(<LeaderboardHeader activeTab="global" />);
    expect(screen.getAllByRole("link")).toHaveLength(2);
  });
});
