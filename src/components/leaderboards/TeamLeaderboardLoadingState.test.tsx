/** @jest-environment jsdom */
import fs from "fs";
import path from "path";
import { render, screen } from "@testing-library/react";
import TeamLeaderboardLoadingState from "./TeamLeaderboardLoadingState";

const NO_EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
const RAW_HEX = /#[0-9a-fA-F]{3,8}\b/;
const RAW_RGB = /rgba?\(/i;

const SOURCE = fs.readFileSync(path.join(__dirname, "TeamLeaderboardLoadingState.tsx"), "utf8");

describe("TeamLeaderboardLoadingState", () => {
  it("renders exactly one role=status", () => {
    render(<TeamLeaderboardLoadingState />);
    expect(screen.getAllByRole("status")).toHaveLength(1);
  });

  it("accessible name is 'Loading team leaderboard'", () => {
    render(<TeamLeaderboardLoadingState />);
    expect(screen.getByRole("status", { name: "Loading team leaderboard" })).toBeTruthy();
  });

  it("has a stable test ID", () => {
    render(<TeamLeaderboardLoadingState />);
    expect(screen.getByTestId("team-leaderboard-loading")).toBeTruthy();
  });

  it("uses the shared Skeleton primitive", () => {
    const { container } = render(<TeamLeaderboardLoadingState />);
    expect(container.querySelectorAll("[data-skeleton='true']").length).toBeGreaterThan(0);
  });

  it("skeleton shapes carry the pulse class", () => {
    const { container } = render(<TeamLeaderboardLoadingState />);
    container.querySelectorAll("[data-skeleton='true']").forEach((el) => {
      expect(el.className).toMatch(/motion-safe:animate-pulse/);
    });
  });

  it("skeleton shapes carry the reduced-motion static class", () => {
    const { container } = render(<TeamLeaderboardLoadingState />);
    container.querySelectorAll("[data-skeleton='true']").forEach((el) => {
      expect(el.className).toMatch(/motion-reduce:animate-none/);
    });
  });

  it("visual skeleton shapes are aria-hidden", () => {
    const { container } = render(<TeamLeaderboardLoadingState />);
    container.querySelectorAll("[data-skeleton='true']").forEach((el) => {
      expect(el.getAttribute("aria-hidden")).toBe("true");
    });
  });

  it("shows one current-team rank summary skeleton", () => {
    const { container } = render(<TeamLeaderboardLoadingState />);
    // First skeleton block is the rank-summary shape (a single tall bar).
    const first = container.querySelector("[data-skeleton='true']");
    expect(first?.className).toMatch(/h-28/);
  });

  it("shows three featured card skeletons", () => {
    const { container } = render(<TeamLeaderboardLoadingState />);
    const cards = container.querySelectorAll(".rounded-xl.border.p-4, .rounded-xl.border.p-4.sm\\:p-5");
    const featuredCards = Array.from(cards).filter((el) => el.querySelectorAll("[data-skeleton='true']").length >= 3);
    expect(featuredCards.length).toBe(3);
  });

  it("shows four standard row skeletons", () => {
    const { container } = render(<TeamLeaderboardLoadingState />);
    const rows = container.querySelectorAll(".flex.items-center.gap-3.border-b");
    expect(rows.length).toBe(4);
  });

  it("shows three stats skeletons", () => {
    const { container } = render(<TeamLeaderboardLoadingState />);
    const statCards = container.querySelectorAll(".min-w-0.rounded-xl.border.p-4");
    expect(statCards.length).toBe(3);
  });

  it("renders no fake team names", () => {
    render(<TeamLeaderboardLoadingState />);
    expect(screen.queryByText(/Puzzle Masters|Solvers/)).toBeNull();
  });

  it("renders no fake ranks", () => {
    render(<TeamLeaderboardLoadingState />);
    expect(screen.queryByText(/^#\d+$/)).toBeNull();
  });

  it("renders no fake metrics", () => {
    render(<TeamLeaderboardLoadingState />);
    expect(screen.queryByText(/\d,\d{3}/)).toBeNull();
  });

  it("contains no emoji", () => {
    const { container } = render(<TeamLeaderboardLoadingState />);
    expect(NO_EMOJI.test(container.textContent ?? "")).toBe(false);
  });

  it("contains no raw hex colors", () => {
    const { container } = render(<TeamLeaderboardLoadingState />);
    expect(RAW_HEX.test(container.innerHTML)).toBe(false);
  });

  it("contains no raw RGB/RGBA colors", () => {
    const { container } = render(<TeamLeaderboardLoadingState />);
    expect(RAW_RGB.test(container.innerHTML)).toBe(false);
  });

  it("performs no request", () => {
    const originalFetch = global.fetch;
    const fetchMock = jest.fn();
    (global as any).fetch = fetchMock;
    render(<TeamLeaderboardLoadingState />);
    expect(fetchMock).not.toHaveBeenCalled();
    (global as any).fetch = originalFetch;
  });

  it("mobile layout is bounded (min-w-0)", () => {
    const { container } = render(<TeamLeaderboardLoadingState />);
    expect(container.querySelectorAll(".min-w-0").length).toBeGreaterThan(0);
  });

  it("landscape remains vertically stackable (space-y layout, no forced row overflow)", () => {
    const { container } = render(<TeamLeaderboardLoadingState />);
    expect(container.firstElementChild?.className).toMatch(/space-y-6/);
  });

  it("source contains no hard-coded emoji literal", () => {
    expect(/🥇|🥈|🥉|🏆|📊|🧩/.test(SOURCE)).toBe(false);
  });
});
