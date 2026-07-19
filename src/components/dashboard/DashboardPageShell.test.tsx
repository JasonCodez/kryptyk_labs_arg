/** @jest-environment jsdom */

import { cleanup, render, screen, within } from "@testing-library/react";
import DashboardPageShell from "./DashboardPageShell";
import DashboardLoadingState from "./DashboardLoadingState";

afterEach(() => {
  cleanup();
});

describe("DashboardPageShell", () => {
  it("renders a main element", () => {
    render(<DashboardPageShell>content</DashboardPageShell>);
    expect(screen.getByRole("main")).toBeTruthy();
  });

  it("renders its children", () => {
    render(
      <DashboardPageShell>
        <p>hub content</p>
      </DashboardPageShell>,
    );
    expect(screen.getByText("hub content")).toBeTruthy();
  });

  it("busy=true sets aria-busy=true on the main element", () => {
    render(<DashboardPageShell busy>content</DashboardPageShell>);
    expect(screen.getByRole("main").getAttribute("aria-busy")).toBe("true");
  });

  it("busy=false does not expose aria-busy=true", () => {
    render(<DashboardPageShell>content</DashboardPageShell>);
    expect(screen.getByRole("main").getAttribute("aria-busy")).not.toBe("true");
  });
});

describe("DashboardLoadingState", () => {
  it("exposes role=status with the Loading player hub text", () => {
    render(<DashboardLoadingState />);
    expect(screen.getByRole("status").textContent).toBe("Loading player hub");
  });

  it("marks the page shell busy", () => {
    render(<DashboardLoadingState />);
    expect(screen.getByRole("main").getAttribute("aria-busy")).toBe("true");
  });

  it("renders command, mission, stats, and navigation skeleton groups", () => {
    render(<DashboardLoadingState />);
    expect(screen.getByTestId("skeleton-command-header")).toBeTruthy();
    expect(screen.getByTestId("skeleton-featured-mission")).toBeTruthy();
    expect(screen.getByTestId("skeleton-stats")).toBeTruthy();
    expect(screen.getByTestId("skeleton-navigation")).toBeTruthy();
  });

  it("stats skeleton contains exactly four placeholders", () => {
    render(<DashboardLoadingState />);
    expect(screen.getByTestId("skeleton-stats").children).toHaveLength(4);
  });

  it("navigation skeleton contains two group panels", () => {
    render(<DashboardLoadingState />);
    expect(screen.getByTestId("skeleton-navigation").children).toHaveLength(2);
  });

  it("skeleton shapes are aria-hidden", () => {
    render(<DashboardLoadingState />);
    for (const id of [
      "skeleton-command-header",
      "skeleton-featured-mission",
      "skeleton-stats",
      "skeleton-navigation",
    ]) {
      expect(screen.getByTestId(id).getAttribute("aria-hidden")).toBe("true");
    }
  });

  it("skeleton groups contain no visible text", () => {
    render(<DashboardLoadingState />);
    const main = screen.getByRole("main");
    expect(within(main).getByRole("status").textContent).toBe("Loading player hub");
    expect(main.textContent).toBe("Loading player hub");
  });

  it("contains no legacy purple, magenta, or pink color strings", () => {
    const { container } = render(<DashboardLoadingState />);
    const html = container.innerHTML.toLowerCase();
    for (const legacy of ["8b3dff", "ff4fa3", "purple", "magenta", "pink", "139,61,255", "255,79,163", "#170b26"]) {
      expect(html).not.toContain(legacy);
    }
  });

  it("has no animation classes, keyframes, or inline animation styles", () => {
    const { container } = render(<DashboardLoadingState />);
    expect(container.innerHTML).not.toMatch(/animate-|@keyframes/);
    const animated = Array.from(container.querySelectorAll<HTMLElement>("*")).filter(
      (el) => el.style.animation || el.style.animationName,
    );
    expect(animated).toHaveLength(0);
  });

  it("contains no emoji", () => {
    const { container } = render(<DashboardLoadingState />);
    expect(container.textContent).not.toMatch(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u);
  });
});
