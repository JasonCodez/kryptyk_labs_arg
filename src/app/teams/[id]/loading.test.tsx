/** @jest-environment jsdom */
import fs from "fs";
import path from "path";
import { render, screen } from "@testing-library/react";
import TeamDetailRouteLoading from "./loading";

const RAW_HEX = /#[0-9a-fA-F]{3,8}\b/;
const RAW_RGB = /rgba?\(/i;
const SOURCE = fs.readFileSync(path.join(__dirname, "loading.tsx"), "utf8");

describe("Team Detail route loading boundary", () => {
  it("uses a semantic background", () => {
    const { container } = render(<TeamDetailRouteLoading />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.background).toBe("var(--pw-bg-base)");
  });

  it("preserves Navbar clearance", () => {
    const { container } = render(<TeamDetailRouteLoading />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.paddingTop).toContain("56px");
  });

  it("uses PageContainer (size=catalog classes)", () => {
    const { container } = render(<TeamDetailRouteLoading />);
    expect(container.querySelector(".lg\\:max-w-7xl")).toBeTruthy();
  });

  it("uses a full-width bounded inner wrapper", () => {
    const { container } = render(<TeamDetailRouteLoading />);
    expect(container.querySelector(".mx-auto.w-full.max-w-5xl")).toBeTruthy();
  });

  it("renders TeamDetailLoadingState", () => {
    render(<TeamDetailRouteLoading />);
    expect(screen.getByTestId("team-detail-loading")).toBeTruthy();
  });

  it("renders exactly one status", () => {
    render(<TeamDetailRouteLoading />);
    expect(screen.getAllByRole("status")).toHaveLength(1);
  });

  it("renders no fake team data", () => {
    render(<TeamDetailRouteLoading />);
    expect(screen.queryByText(/Midnight Puzzle Society/)).toBeNull();
  });

  it("performs no request", () => {
    const originalFetch = global.fetch;
    const fetchMock = jest.fn();
    (global as any).fetch = fetchMock;
    render(<TeamDetailRouteLoading />);
    expect(fetchMock).not.toHaveBeenCalled();
    (global as any).fetch = originalFetch;
  });

  it("renders no duplicate Navbar", () => {
    const { container } = render(<TeamDetailRouteLoading />);
    expect(container.querySelectorAll("nav").length).toBe(0);
  });

  it("contains no raw colors in source", () => {
    expect(RAW_HEX.test(SOURCE)).toBe(false);
    expect(RAW_RGB.test(SOURCE)).toBe(false);
  });
});
