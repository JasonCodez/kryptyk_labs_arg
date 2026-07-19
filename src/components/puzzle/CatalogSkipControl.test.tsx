/** @jest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import CatalogSkipControl from "./CatalogSkipControl";

afterEach(cleanup);

describe("CatalogSkipControl", () => {
  it("shows singular token text", () => {
    render(<CatalogSkipControl tokens={1} skipping={false} onSkip={jest.fn()} />);
    expect(screen.getByText("1 token")).toBeTruthy();
  });

  it("shows plural token text", () => {
    render(<CatalogSkipControl tokens={29} skipping={false} onSkip={jest.fn()} />);
    expect(screen.getByText("29 tokens")).toBeTruthy();
  });

  it("calls onSkip when clicked", () => {
    const onSkip = jest.fn();
    render(<CatalogSkipControl tokens={2} skipping={false} onSkip={onSkip} />);
    screen.getByRole("button").click();
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it("disables the button while skipping", () => {
    render(<CatalogSkipControl tokens={2} skipping onSkip={jest.fn()} />);
    const button = screen.getByRole("button") as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it("shows the skipping label while skipping", () => {
    render(<CatalogSkipControl tokens={2} skipping onSkip={jest.fn()} />);
    expect(screen.getByText("Skipping…")).toBeTruthy();
  });

  it("links to the store when there are zero tokens", () => {
    render(<CatalogSkipControl tokens={0} skipping={false} onSkip={jest.fn()} />);
    const link = screen.getByRole("link", { name: /Get Skip Tokens/ });
    expect(link.getAttribute("href")).toBe("/store");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("renders a decorative SVG (aria-hidden, not focusable)", () => {
    const { container } = render(<CatalogSkipControl tokens={2} skipping={false} onSkip={jest.fn()} />);
    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThan(0);
    for (const svg of svgs) {
      expect(svg.getAttribute("aria-hidden")).toBe("true");
      expect(svg.getAttribute("focusable")).toBe("false");
    }
  });

  it("contains no emoji", () => {
    const { container } = render(<CatalogSkipControl tokens={2} skipping={false} onSkip={jest.fn()} />);
    expect(container.textContent).not.toMatch(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u);
  });

  it("contains no legacy purple, magenta, or pink color strings", () => {
    const { container } = render(<CatalogSkipControl tokens={0} skipping={false} onSkip={jest.fn()} />);
    const html = container.innerHTML.toLowerCase();
    for (const legacy of ["8b3dff", "ff4fa3", "purple", "magenta", "pink", "139,61,255", "255,79,163", "139,92,246", "167,139,250"]) {
      expect(html).not.toContain(legacy);
    }
  });

  it("contains no GameButton classes or gloss overlay", () => {
    const { container } = render(<CatalogSkipControl tokens={2} skipping={false} onSkip={jest.fn()} />);
    expect(container.innerHTML).not.toMatch(/game-btn--/);
    expect(container.querySelector(".game-gloss-overlay")).toBeNull();
  });

  it("contains no gold or yellow styling when tokens are available", () => {
    const { container } = render(<CatalogSkipControl tokens={2} skipping={false} onSkip={jest.fn()} />);
    const html = container.innerHTML.toLowerCase();
    for (const legacy of ["fde74c", "fed007", "ffe55c", "fdae03", "gold", "yellow"]) {
      expect(html).not.toContain(legacy);
    }
  });

  it("contains no gold or yellow styling with zero tokens", () => {
    const { container } = render(<CatalogSkipControl tokens={0} skipping={false} onSkip={jest.fn()} />);
    const html = container.innerHTML.toLowerCase();
    for (const legacy of ["fde74c", "fed007", "ffe55c", "fdae03", "gold", "yellow"]) {
      expect(html).not.toContain(legacy);
    }
  });
});
