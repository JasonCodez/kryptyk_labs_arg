/** @jest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import DashboardAdminHub from "./DashboardAdminHub";

const EXPECTED_LINKS: Array<[string, string]> = [
  ["Analytics", "/admin/analytics"],
  ["Create Puzzle", "/admin/puzzles"],
  ["Frequency Admin", "/admin/frequency"],
  ["Abuse Reports", "/admin/reports"],
  ["Bug Reports", "/admin/bug-reports"],
];

afterEach(() => {
  cleanup();
});

describe("DashboardAdminHub", () => {
  it("renders without props", () => {
    render(<DashboardAdminHub />);
    expect(screen.getByText("Admin Tools")).toBeTruthy();
  });

  it("renders Admin Tools, Manage, and Moderate headings", () => {
    render(<DashboardAdminHub />);
    expect(screen.getByRole("heading", { name: "Admin Tools" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Manage" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Moderate" })).toBeTruthy();
  });

  it("renders all five destinations with the correct hrefs", () => {
    render(<DashboardAdminHub />);
    for (const [title, href] of EXPECTED_LINKS) {
      const link = screen.getByRole("link", { name: new RegExp(title) });
      expect(link.getAttribute("href")).toBe(href);
    }
  });

  it("contains exactly five links and no buttons", () => {
    render(<DashboardAdminHub />);
    expect(screen.getAllByRole("link")).toHaveLength(5);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("all SVGs are decorative (aria-hidden, not focusable)", () => {
    const { container } = render(<DashboardAdminHub />);
    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThan(0);
    for (const svg of svgs) {
      expect(svg.getAttribute("aria-hidden")).toBe("true");
      expect(svg.getAttribute("focusable")).toBe("false");
    }
  });

  it("contains no emoji", () => {
    const { container } = render(<DashboardAdminHub />);
    expect(container.textContent).not.toMatch(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u);
  });

  it("contains no legacy purple, magenta, or pink color strings", () => {
    const { container } = render(<DashboardAdminHub />);
    const html = container.innerHTML.toLowerCase();
    for (const legacy of ["8b3dff", "ff4fa3", "purple", "magenta", "pink", "139,61,255", "255,79,163"]) {
      expect(html).not.toContain(legacy);
    }
  });

  it("has no animation classes, keyframes, or inline animation styles", () => {
    const { container } = render(<DashboardAdminHub />);
    expect(container.innerHTML).not.toMatch(/animate-|@keyframes/);
    const animated = Array.from(container.querySelectorAll<HTMLElement>("*")).filter(
      (el) => el.style.animation || el.style.animationName,
    );
    expect(animated).toHaveLength(0);
  });
});
