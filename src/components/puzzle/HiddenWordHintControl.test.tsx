/** @jest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import HiddenWordHintControl from "./HiddenWordHintControl";

afterEach(cleanup);

describe("HiddenWordHintControl", () => {
  it("shows Reveal a Letter and the token count when unused with tokens available", () => {
    render(<HiddenWordHintControl tokens={28} loading={false} used={false} onReveal={jest.fn()} />);
    expect(screen.getByText("Reveal a Letter")).toBeTruthy();
    expect(screen.getByText("28 tokens")).toBeTruthy();
  });

  it("calls onReveal when clicked", () => {
    const onReveal = jest.fn();
    render(<HiddenWordHintControl tokens={5} loading={false} used={false} onReveal={onReveal} />);
    screen.getByRole("button").click();
    expect(onReveal).toHaveBeenCalledTimes(1);
  });

  it("shows Revealing… and disables the button while loading", () => {
    render(<HiddenWordHintControl tokens={5} loading used={false} onReveal={jest.fn()} />);
    expect(screen.getByText("Revealing…")).toBeTruthy();
    const button = screen.getByRole("button") as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it("shows No Hint Tokens and links to /store when tokens are zero", () => {
    render(<HiddenWordHintControl tokens={0} loading={false} used={false} onReveal={jest.fn()} />);
    expect(screen.getByText("No Hint Tokens")).toBeTruthy();
    const link = screen.getByRole("link", { name: /Get Hint Tokens/ });
    expect(link.getAttribute("href")).toBe("/store");
  });

  it("disables the button when tokens are zero", () => {
    render(<HiddenWordHintControl tokens={0} loading={false} used={false} onReveal={jest.fn()} />);
    const button = screen.getByRole("button") as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it("shows the revealed position and letter when used", () => {
    const { container } = render(
      <HiddenWordHintControl
        tokens={4}
        loading={false}
        used
        revealedPosition={2}
        revealedLetter="R"
        onReveal={jest.fn()}
      />
    );
    expect(container.textContent).toContain("Position 3 is R");
    expect(screen.getByText("Hint used")).toBeTruthy();
  });

  it("renders a decorative SVG (aria-hidden, not focusable)", () => {
    const { container } = render(<HiddenWordHintControl tokens={5} loading={false} used={false} onReveal={jest.fn()} />);
    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThan(0);
    for (const svg of svgs) {
      expect(svg.getAttribute("aria-hidden")).toBe("true");
      expect(svg.getAttribute("focusable")).toBe("false");
    }
  });

  it("contains no emoji", () => {
    const { container } = render(<HiddenWordHintControl tokens={5} loading={false} used={false} onReveal={jest.fn()} />);
    expect(container.textContent).not.toMatch(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u);
  });

  it("contains no gold or yellow styling when tokens are available", () => {
    const { container } = render(<HiddenWordHintControl tokens={5} loading={false} used={false} onReveal={jest.fn()} />);
    const html = container.innerHTML.toLowerCase();
    for (const legacy of ["fde74c", "fed007", "ffe55c", "fdae03", "gold", "yellow"]) {
      expect(html).not.toContain(legacy);
    }
  });

  it("does not look disabled when tokens are available (button is enabled)", () => {
    render(<HiddenWordHintControl tokens={5} loading={false} used={false} onReveal={jest.fn()} />);
    const button = screen.getByRole("button") as HTMLButtonElement;
    expect(button.disabled).toBe(false);
  });
});
