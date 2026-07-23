/** @jest-environment jsdom */
import fs from "fs";
import path from "path";
import { render, screen } from "@testing-library/react";
import TeamDetailLoadingState from "./TeamDetailLoadingState";

const NO_EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
const RAW_HEX = /#[0-9a-fA-F]{3,8}\b/;
const RAW_RGB = /rgba?\(/i;
const SOURCE = fs.readFileSync(path.join(__dirname, "TeamDetailLoadingState.tsx"), "utf8");

describe("TeamDetailLoadingState", () => {
  it("renders exactly one role=status", () => {
    render(<TeamDetailLoadingState />);
    expect(screen.getAllByRole("status")).toHaveLength(1);
  });

  it("accessible name is 'Loading team details'", () => {
    render(<TeamDetailLoadingState />);
    expect(screen.getByRole("status", { name: "Loading team details" })).toBeTruthy();
  });

  it("has a stable test ID", () => {
    render(<TeamDetailLoadingState />);
    expect(screen.getByTestId("team-detail-loading")).toBeTruthy();
  });

  it("uses the shared Skeleton primitive", () => {
    const { container } = render(<TeamDetailLoadingState />);
    expect(container.querySelectorAll("[data-skeleton='true']").length).toBeGreaterThan(0);
  });

  it("skeleton shapes carry the pulse class", () => {
    const { container } = render(<TeamDetailLoadingState />);
    container.querySelectorAll("[data-skeleton='true']").forEach((el) => {
      expect(el.className).toMatch(/motion-safe:animate-pulse/);
    });
  });

  it("skeleton shapes carry the reduced-motion static class", () => {
    const { container } = render(<TeamDetailLoadingState />);
    container.querySelectorAll("[data-skeleton='true']").forEach((el) => {
      expect(el.className).toMatch(/motion-reduce:animate-none/);
    });
  });

  it("visual skeleton shapes are aria-hidden", () => {
    const { container } = render(<TeamDetailLoadingState />);
    container.querySelectorAll("[data-skeleton='true']").forEach((el) => {
      expect(el.getAttribute("aria-hidden")).toBe("true");
    });
  });

  it("hero geometry exists (avatar + identity lines)", () => {
    const { container } = render(<TeamDetailLoadingState />);
    expect(container.querySelector(".h-14.w-14, .rounded-full")).toBeTruthy();
  });

  it("shows five stat skeletons", () => {
    const { container } = render(<TeamDetailLoadingState />);
    const grid = container.querySelector(".grid.min-w-0.grid-cols-2");
    expect(grid?.children.length).toBe(5);
  });

  it("contributor panel geometry exists", () => {
    const { container } = render(<TeamDetailLoadingState />);
    const panels = container.querySelectorAll(".rounded-xl.border.p-5");
    expect(panels.length).toBeGreaterThanOrEqual(3);
  });

  it("activity panel geometry exists", () => {
    const { container } = render(<TeamDetailLoadingState />);
    expect(container.querySelectorAll(".rounded-xl.border.p-5").length).toBeGreaterThanOrEqual(3);
  });

  it("roster panel geometry exists with at least five rows", () => {
    const { container } = render(<TeamDetailLoadingState />);
    const rosterRows = container.querySelectorAll(".flex.items-center.gap-3.rounded-lg.border.p-3");
    expect(rosterRows.length).toBeGreaterThanOrEqual(5);
  });

  it("renders no fake team names", () => {
    render(<TeamDetailLoadingState />);
    expect(screen.queryByText(/Midnight Puzzle Society/)).toBeNull();
  });

  it("renders no fake rank", () => {
    render(<TeamDetailLoadingState />);
    expect(screen.queryByText(/^#\d+$/)).toBeNull();
  });

  it("renders no fake metrics", () => {
    render(<TeamDetailLoadingState />);
    expect(screen.queryByText(/\d,\d{3}/)).toBeNull();
  });

  it("contains no hard-coded emoji", () => {
    const { container } = render(<TeamDetailLoadingState />);
    expect(NO_EMOJI.test(container.textContent ?? "")).toBe(false);
  });

  it("contains no raw hex colors in source", () => {
    expect(RAW_HEX.test(SOURCE)).toBe(false);
  });

  it("contains no raw RGB/RGBA colors in source", () => {
    expect(RAW_RGB.test(SOURCE)).toBe(false);
  });

  it("renders no spinner element", () => {
    const { container } = render(<TeamDetailLoadingState />);
    expect(container.querySelector("[class*='spin']")).toBeNull();
  });

  it("performs no fetch", () => {
    const originalFetch = global.fetch;
    const fetchMock = jest.fn();
    (global as any).fetch = fetchMock;
    render(<TeamDetailLoadingState />);
    expect(fetchMock).not.toHaveBeenCalled();
    (global as any).fetch = originalFetch;
  });

  it("mobile layout is bounded (min-w-0)", () => {
    const { container } = render(<TeamDetailLoadingState />);
    expect(container.querySelectorAll(".min-w-0").length).toBeGreaterThan(0);
  });

  it("landscape remains vertically stackable (space-y layout)", () => {
    const { container } = render(<TeamDetailLoadingState />);
    expect(container.firstElementChild?.className).toMatch(/space-y-6/);
  });
});
