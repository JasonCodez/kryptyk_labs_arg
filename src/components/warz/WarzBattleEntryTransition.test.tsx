/** @jest-environment jsdom */

import fs from "fs";
import path from "path";
import { cleanup, render, screen } from "@testing-library/react";
import WarzBattleEntryTransition from "./WarzBattleEntryTransition";

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("data-reduce-animations");
});

describe("WarzBattleEntryTransition", () => {
  it("1. accepted mode shows CHALLENGE ACCEPTED", () => {
    render(<WarzBattleEntryTransition mode="accepted" />);
    expect(screen.getByText("Challenge Accepted")).toBeTruthy();
  });

  it("2. accepted mode shows Battle starting…", () => {
    render(<WarzBattleEntryTransition mode="accepted" />);
    expect(screen.getByText("Battle starting…")).toBeTruthy();
  });

  it("3. resume mode shows BATTLE READY", () => {
    render(<WarzBattleEntryTransition mode="resume" />);
    expect(screen.getByText("Battle Ready")).toBeTruthy();
  });

  it("4. resume mode shows Preparing your puzzle…", () => {
    render(<WarzBattleEntryTransition mode="resume" />);
    expect(screen.getByText("Preparing your puzzle…")).toBeTruthy();
  });

  it("5. uses Lucide icons", () => {
    const { container } = render(<WarzBattleEntryTransition mode="accepted" />);
    expect(container.querySelectorAll("svg").length).toBeGreaterThan(0);
  });

  it("6. decorative icons are hidden", () => {
    const { container } = render(<WarzBattleEntryTransition mode="resume" />);
    const icons = Array.from(container.querySelectorAll("svg"));
    expect(icons.length).toBeGreaterThan(0);
    for (const icon of icons) expect(icon.getAttribute("aria-hidden")).toBe("true");
  });

  it("7. contains no raw emoji", () => {
    const { container } = render(<WarzBattleEntryTransition mode="accepted" />);
    const emojiPattern = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
    expect(emojiPattern.test(container.textContent || "")).toBe(false);
  });

  it("8. contains no raw hex or RGBA colors", () => {
    const source = fs.readFileSync(path.join(__dirname, "WarzBattleEntryTransition.tsx"), "utf8");
    expect(/#[0-9a-fA-F]{3,8}\b/.test(source)).toBe(false);
    expect(/rgba?\(\s*\d/.test(source)).toBe(false);
  });

  it("9. reduced motion removes Y movement", () => {
    document.documentElement.setAttribute("data-reduce-animations", "true");
    const { container } = render(<WarzBattleEntryTransition mode="accepted" />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.transform).not.toMatch(/translateY/);
  });

  it("10. reduced motion removes scale movement", () => {
    document.documentElement.setAttribute("data-reduce-animations", "true");
    const { container } = render(<WarzBattleEntryTransition mode="accepted" />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.transform).not.toMatch(/scale/);
  });

  it("11. component performs no request", () => {
    const source = fs.readFileSync(path.join(__dirname, "WarzBattleEntryTransition.tsx"), "utf8");
    expect(source).not.toMatch(/fetch\(/);
  });

  it("12. component performs no navigation", () => {
    const source = fs.readFileSync(path.join(__dirname, "WarzBattleEntryTransition.tsx"), "utf8");
    expect(source).not.toMatch(/useRouter|router\.push|window\.location/);
  });

  it("13. component does not mount WarzPlayBoard", () => {
    const source = fs.readFileSync(path.join(__dirname, "WarzBattleEntryTransition.tsx"), "utf8");
    expect(source).not.toMatch(/import\s+WarzPlayBoard|<WarzPlayBoard/);
  });
});
