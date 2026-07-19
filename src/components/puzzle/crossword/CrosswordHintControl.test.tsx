/** @jest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import CrosswordHintControl from "./CrosswordHintControl";

afterEach(cleanup);

describe("CrosswordHintControl", () => {
  it("shows Reveal Letter and the token count when available with a square selected", () => {
    render(<CrosswordHintControl tokens={28} loading={false} canReveal onReveal={jest.fn()} />);
    expect(screen.getByText("Reveal Letter")).toBeTruthy();
    expect(screen.getByText("28 tokens")).toBeTruthy();
  });

  it("calls onReveal when clicked", () => {
    const onReveal = jest.fn();
    render(<CrosswordHintControl tokens={5} loading={false} canReveal onReveal={onReveal} />);
    screen.getByRole("button").click();
    expect(onReveal).toHaveBeenCalledTimes(1);
  });

  it("is disabled while loading and shows Revealing…", () => {
    render(<CrosswordHintControl tokens={5} loading canReveal onReveal={jest.fn()} />);
    expect(screen.getByText("Revealing…")).toBeTruthy();
    const button = screen.getByRole("button") as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it("is disabled without a selected square", () => {
    render(<CrosswordHintControl tokens={5} loading={false} canReveal={false} onReveal={jest.fn()} />);
    const button = screen.getByRole("button") as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it("shows Select a square first without a selected square", () => {
    render(<CrosswordHintControl tokens={5} loading={false} canReveal={false} onReveal={jest.fn()} />);
    expect(screen.getByText("Reveal Letter")).toBeTruthy();
    expect(screen.getByText("Select a square first")).toBeTruthy();
  });

  it("shows No Hint Tokens and links to /store when tokens are zero", () => {
    render(<CrosswordHintControl tokens={0} loading={false} canReveal onReveal={jest.fn()} />);
    expect(screen.getByText("No Hint Tokens")).toBeTruthy();
    const link = screen.getByRole("link", { name: /Get Hint Tokens/ });
    expect(link.getAttribute("href")).toBe("/store");
  });

  it("disables the button when tokens are zero", () => {
    render(<CrosswordHintControl tokens={0} loading={false} canReveal onReveal={jest.fn()} />);
    const button = screen.getByRole("button") as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it("renders a decorative SVG (aria-hidden, not focusable)", () => {
    const { container } = render(<CrosswordHintControl tokens={5} loading={false} canReveal onReveal={jest.fn()} />);
    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThan(0);
    for (const svg of svgs) {
      expect(svg.getAttribute("aria-hidden")).toBe("true");
      expect(svg.getAttribute("focusable")).toBe("false");
    }
  });

  it("contains no emoji", () => {
    const { container } = render(<CrosswordHintControl tokens={5} loading={false} canReveal onReveal={jest.fn()} />);
    expect(container.textContent).not.toMatch(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u);
  });

  it("contains no GameButton classes or gloss overlay", () => {
    const { container } = render(<CrosswordHintControl tokens={5} loading={false} canReveal onReveal={jest.fn()} />);
    const html = container.innerHTML.toLowerCase();
    expect(html).not.toContain("game-button");
    expect(html).not.toContain("gloss");
  });

  it("contains no gold or yellow styling", () => {
    const { container } = render(<CrosswordHintControl tokens={5} loading={false} canReveal onReveal={jest.fn()} />);
    const html = container.innerHTML.toLowerCase();
    for (const legacy of ["fde74c", "fed007", "ffe55c", "fdae03", "gold", "yellow"]) {
      expect(html).not.toContain(legacy);
    }
  });
});
