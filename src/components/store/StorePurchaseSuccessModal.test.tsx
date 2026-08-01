/** @jest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement, forwardRef, useState, type HTMLAttributes, type ReactNode } from "react";
import StorePurchaseSuccessModal from "./StorePurchaseSuccessModal";

let mockReducedMotion = false;

jest.mock("framer-motion", () => {
  type MotionProps = HTMLAttributes<HTMLElement> & Record<string, unknown> & { children?: ReactNode };
  const passthrough = (Tag: string) =>
    forwardRef<HTMLElement, MotionProps>(function Motion(
      { children, initial, animate, exit, transition, variants, whileTap, whileHover, ...props },
      ref,
    ) {
      void initial; void animate; void exit; void variants; void whileTap; void whileHover;
      return createElement(Tag, { ...props, ref }, children as ReactNode);
    });
  return {
    motion: {
      div: passthrough("div"),
      span: passthrough("span"),
      button: passthrough("button"),
      p: passthrough("p"),
    },
    AnimatePresence: ({ children }: { children: ReactNode }) => children,
    useReducedMotion: () => mockReducedMotion,
  };
});

afterEach(() => {
  cleanup();
  mockReducedMotion = false;
});

function Harness({ onClose = jest.fn() }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open modal
      </button>
      {open && (
        <StorePurchaseSuccessModal
          points={1700}
          onClose={() => {
            setOpen(false);
            onClose();
          }}
        />
      )}
    </>
  );
}

describe("StorePurchaseSuccessModal content and semantics", () => {
  it("renders the locale-formatted point amount and celebration copy", () => {
    render(<StorePurchaseSuccessModal points={9000} onClose={jest.fn()} />);
    expect(screen.getByText("+9,000")).toBeTruthy();
    expect(screen.getByText("Thank you for your purchase!")).toBeTruthy();
    expect(screen.getByText("Points Added!")).toBeTruthy();
    expect(screen.getByText("points added to your balance")).toBeTruthy();
  });

  it("exposes an accessible dialog labeled by the visible success heading", () => {
    render(<StorePurchaseSuccessModal points={500} onClose={jest.fn()} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    const labelledBy = dialog.getAttribute("aria-labelledby");
    expect(labelledBy).toBeTruthy();
    const title = document.getElementById(labelledBy!);
    expect(title?.textContent).toBe("Points Added!");
  });
});

describe("StorePurchaseSuccessModal dismissal", () => {
  it("calls onClose exactly once when the Awesome! button is clicked", () => {
    const onClose = jest.fn();
    render(<StorePurchaseSuccessModal points={500} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /Awesome!/ }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when the backdrop is clicked", () => {
    const onClose = jest.fn();
    render(<StorePurchaseSuccessModal points={500} onClose={onClose} />);
    fireEvent.click(screen.getByRole("dialog").parentElement!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not call onClose when clicking inside the card", () => {
    const onClose = jest.fn();
    render(<StorePurchaseSuccessModal points={500} onClose={onClose} />);
    fireEvent.click(screen.getByRole("dialog"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("calls onClose when Escape is pressed", () => {
    const onClose = jest.fn();
    render(<StorePurchaseSuccessModal points={500} onClose={onClose} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("StorePurchaseSuccessModal focus management", () => {
  it("moves focus to the Awesome! button on mount", () => {
    render(<StorePurchaseSuccessModal points={500} onClose={jest.fn()} />);
    const button = screen.getByRole("button", { name: /Awesome!/ });
    expect(document.activeElement).toBe(button);
  });

  it("restores focus to the previously focused element on unmount", () => {
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "Open modal" });
    opener.focus();
    expect(document.activeElement).toBe(opener);

    fireEvent.click(opener);
    const closeButton = screen.getByRole("button", { name: /Awesome!/ });
    expect(document.activeElement).toBe(closeButton);

    fireEvent.click(closeButton);
    expect(document.activeElement).toBe(opener);
  });
});

describe("StorePurchaseSuccessModal reduced motion", () => {
  it("omits decorative particle and coin motion in reduced-motion mode", () => {
    mockReducedMotion = true;
    const { container } = render(<StorePurchaseSuccessModal points={500} onClose={jest.fn()} />);
    expect(container.querySelectorAll(".pointer-events-none.select-none").length).toBe(0);
    expect(container.querySelectorAll(".rounded-full.pointer-events-none").length).toBe(0);
  });

  it("renders celebration decoration in normal-motion mode", () => {
    mockReducedMotion = false;
    const { container } = render(<StorePurchaseSuccessModal points={500} onClose={jest.fn()} />);
    expect(container.querySelectorAll(".pointer-events-none.select-none").length).toBeGreaterThan(0);
    expect(container.querySelectorAll(".rounded-full.pointer-events-none").length).toBeGreaterThan(0);
  });
});
