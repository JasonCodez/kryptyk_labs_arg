/** @jest-environment jsdom */

import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import WordSearchWordList, { WordSearchDesktopWordList } from "./WordSearchWordList";

jest.mock("framer-motion", () => ({
  motion: {
    div: ({ children, initial, animate, exit, transition, drag, dragConstraints, dragElastic, onDragEnd, ...props }: React.HTMLAttributes<HTMLDivElement> & Record<string, unknown>) => {
      void initial; void animate; void exit; void transition; void drag; void dragConstraints; void dragElastic; void onDragEnd;
      return <div {...props}>{children}</div>;
    },
    button: ({ children, whileTap, whileHover, transition, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & Record<string, unknown>) => {
      void whileTap; void whileHover; void transition;
      return <button {...props}>{children}</button>;
    },
    span: ({ children, ...props }: React.HTMLAttributes<HTMLSpanElement> & Record<string, unknown>) => <span {...props}>{children}</span>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  useReducedMotion: () => true,
}));

beforeAll(() => {
  Object.defineProperty(window, "scrollTo", { writable: true, value: jest.fn() });
  Object.defineProperty(window, "requestAnimationFrame", { writable: true, value: (callback: FrameRequestCallback) => window.setTimeout(() => callback(0), 0) });
  Object.defineProperty(window, "cancelAnimationFrame", { writable: true, value: clearTimeout });
});
afterEach(cleanup);

const WORDS = ["CAT", "DOG", "ELEPHANT"];

function Harness({ found = new Set<string>(), onOpenDefinition = jest.fn(), definitionsEnabled }: { found?: Set<string>; onOpenDefinition?: (word: string) => void; definitionsEnabled?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Words</button>
      <WordSearchWordList
        open={open}
        words={WORDS}
        foundWords={found}
        onClose={() => setOpen(false)}
        onOpenDefinition={onOpenDefinition}
        definitionsEnabled={definitionsEnabled}
      />
    </>
  );
}

describe("WordSearchWordList mobile sheet", () => {
  it("opens as a labeled, modal dialog with initial focus, count, and progress semantics", async () => {
    render(<Harness found={new Set(["CAT"])} />);
    fireEvent.click(screen.getByRole("button", { name: "Words" }));

    const dialog = await screen.findByRole("dialog", { name: "Words to find" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    await waitFor(() => expect(document.activeElement).toBe(dialog));

    expect(screen.getByText("1 of 3 found")).toBeTruthy();

    const progress = screen.getByRole("progressbar", { name: "Word progress" });
    expect(progress.getAttribute("aria-valuemin")).toBe("0");
    expect(progress.getAttribute("aria-valuemax")).toBe("3");
    expect(progress.getAttribute("aria-valuenow")).toBe("1");
    expect(progress.getAttribute("aria-valuetext")).toBe("1 of 3 words found");

    const closeButton = screen.getByRole("button", { name: "Close word list" });
    const svg = closeButton.querySelector("svg");
    expect(svg).toBeTruthy();
    expect(svg!.getAttribute("aria-hidden")).toBe("true");
    expect(svg!.getAttribute("focusable")).toBe("false");
  });

  it("does not produce NaN progress when there are zero words", async () => {
    function ZeroHarness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>Words</button>
          <WordSearchWordList open={open} words={[]} foundWords={new Set()} onClose={() => setOpen(false)} onOpenDefinition={jest.fn()} />
        </>
      );
    }
    render(<ZeroHarness />);
    fireEvent.click(screen.getByRole("button", { name: "Words" }));
    const progress = await screen.findByRole("progressbar", { name: "Word progress" });
    expect(progress.getAttribute("aria-valuemax")).toBe("0");
    expect(progress.getAttribute("aria-valuenow")).toBe("0");
    const fill = progress.querySelector<HTMLElement>(".word-search-list-progress-fill");
    expect(fill!.style.getPropertyValue("--word-progress")).toBe("0%");
  });
});

describe("WordSearchWordList word states", () => {
  it("preserves original order, disables unfound words, and marks CAT as found with a completion indicator", async () => {
    render(<Harness found={new Set(["CAT"])} />);
    fireEvent.click(screen.getByRole("button", { name: "Words" }));
    await screen.findByRole("dialog", { name: "Words to find" });

    const labels = Array.from(document.querySelectorAll(".word-search-word-item-label")).map((el) => el.textContent);
    expect(labels).toEqual(["CAT", "DOG", "ELEPHANT"]);

    const cat = screen.getByRole("button", { name: "CAT, found; open definition" });
    expect(cat.hasAttribute("disabled")).toBe(false);
    expect(cat.querySelector("svg")).toBeTruthy();
    expect(cat.querySelector(".word-search-word-item-definition-label")).toBeTruthy();
    expect(cat.querySelector(".word-search-word-item-chevron")).toBeTruthy();

    const dog = screen.getByRole("button", { name: "DOG, not found" });
    const elephant = screen.getByRole("button", { name: "ELEPHANT, not found" });
    expect(dog.hasAttribute("disabled")).toBe(true);
    expect(elephant.hasAttribute("disabled")).toBe(true);

    expect(document.body.textContent).not.toMatch(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u);
  });
});

describe("WordSearchWordList definitionsEnabled", () => {
  it("defaults to enabled: clicking the found word invokes onOpenDefinition", async () => {
    const onOpenDefinition = jest.fn();
    render(<Harness found={new Set(["CAT"])} onOpenDefinition={onOpenDefinition} />);
    fireEvent.click(screen.getByRole("button", { name: "Words" }));
    await screen.findByRole("dialog", { name: "Words to find" });

    fireEvent.click(screen.getByRole("button", { name: "CAT, found; open definition" }));
    await waitFor(() => expect(onOpenDefinition).toHaveBeenCalledWith("CAT"));
  });

  it("marks a found word informational-only when definitions are disabled (Warz)", async () => {
    const onOpenDefinition = jest.fn();
    render(<Harness found={new Set(["CAT"])} onOpenDefinition={onOpenDefinition} definitionsEnabled={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Words" }));
    await screen.findByRole("dialog", { name: "Words to find" });

    const cat = screen.getByRole("button", { name: "CAT, found" });
    expect(cat.getAttribute("aria-label")).not.toContain("open definition");
    expect(cat.getAttribute("data-found")).toBe("true");
    expect(cat.hasAttribute("disabled")).toBe(true);
    expect(cat.querySelector(".word-search-word-status svg")).toBeTruthy(); // completion check remains
    expect(cat.querySelector(".word-search-word-item-definition-label")).toBeNull();
    expect(cat.querySelector(".word-search-word-item-chevron")).toBeNull();

    fireEvent.click(cat);
    expect(onOpenDefinition).not.toHaveBeenCalled();
  });

  it("keeps an unfound word disabled and without a completion indicator when definitions are disabled", async () => {
    render(<Harness found={new Set(["CAT"])} definitionsEnabled={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Words" }));
    await screen.findByRole("dialog", { name: "Words to find" });

    const dog = screen.getByRole("button", { name: "DOG, not found" });
    expect(dog.hasAttribute("disabled")).toBe(true);
    expect(dog.querySelector("svg")).toBeNull();
    expect(dog.hasAttribute("data-found")).toBe(false);

    const labels = Array.from(document.querySelectorAll(".word-search-word-item-label")).map((el) => el.textContent);
    expect(labels).toEqual(["CAT", "DOG", "ELEPHANT"]);
  });

  it("applies the same informational-only found behavior on the desktop panel", () => {
    const onOpenDefinition = jest.fn();
    render(
      <WordSearchDesktopWordList
        words={WORDS}
        foundWords={new Set(["CAT"])}
        onOpenDefinition={onOpenDefinition}
        definitionsEnabled={false}
      />,
    );

    const cat = screen.getByRole("button", { name: "CAT, found" });
    expect(cat.getAttribute("aria-label")).not.toContain("open definition");
    expect(cat.hasAttribute("disabled")).toBe(true);
    expect(cat.getAttribute("data-found")).toBe("true");
    expect(cat.querySelector(".word-search-word-status svg")).toBeTruthy();
    expect(cat.querySelector(".word-search-word-item-definition-label")).toBeNull();
    expect(cat.querySelector(".word-search-word-item-chevron")).toBeNull();

    fireEvent.click(cat);
    expect(onOpenDefinition).not.toHaveBeenCalled();

    const dog = screen.getByRole("button", { name: "DOG, not found" });
    expect(dog.hasAttribute("disabled")).toBe(true);
  });
});

describe("WordSearchWordList mobile definition choreography", () => {
  it("closes the sheet before invoking onOpenDefinition exactly once, and never for an unfound word", async () => {
    const onOpenDefinition = jest.fn();
    render(<Harness found={new Set(["CAT"])} onOpenDefinition={onOpenDefinition} />);
    fireEvent.click(screen.getByRole("button", { name: "Words" }));
    await screen.findByRole("dialog", { name: "Words to find" });

    fireEvent.click(screen.getByRole("button", { name: "CAT, found; open definition" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Words to find" })).toBeNull());
    await waitFor(() => expect(onOpenDefinition).toHaveBeenCalledTimes(1));
    expect(onOpenDefinition).toHaveBeenCalledWith("CAT");

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(onOpenDefinition).toHaveBeenCalledTimes(1);
  });

  it("cannot invoke the callback for an unfound word", async () => {
    const onOpenDefinition = jest.fn();
    render(<Harness found={new Set(["CAT"])} onOpenDefinition={onOpenDefinition} />);
    fireEvent.click(screen.getByRole("button", { name: "Words" }));
    await screen.findByRole("dialog", { name: "Words to find" });

    fireEvent.click(screen.getByRole("button", { name: "DOG, not found" }));
    expect(onOpenDefinition).not.toHaveBeenCalled();
  });
});

describe("WordSearchWordList escape and focus restoration", () => {
  it("returns focus to the opening button after Escape closes the sheet", async () => {
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "Words" });
    opener.focus();
    fireEvent.click(opener);

    const dialog = await screen.findByRole("dialog", { name: "Words to find" });
    await waitFor(() => expect(document.activeElement).toBe(dialog));

    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Words to find" })).toBeNull());
    expect(document.activeElement).toBe(opener);
  });
});

describe("WordSearchWordList tab trapping", () => {
  it("wraps Tab and Shift+Tab between the close button and the found word, skipping disabled items", async () => {
    render(<Harness found={new Set(["CAT"])} />);
    fireEvent.click(screen.getByRole("button", { name: "Words" }));
    await screen.findByRole("dialog", { name: "Words to find" });

    const closeButton = screen.getByRole("button", { name: "Close word list" });
    const cat = screen.getByRole("button", { name: "CAT, found; open definition" });

    cat.focus();
    expect(document.activeElement).toBe(cat);
    fireEvent.keyDown(window, { key: "Tab" });
    expect(document.activeElement).toBe(closeButton);

    fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(cat);
  });
});

describe("WordSearchDesktopWordList", () => {
  it("renders a focusable, labeled aside with correct progress, order, and interaction", () => {
    const onOpenDefinition = jest.fn();
    const onEscape = jest.fn();
    render(
      <WordSearchDesktopWordList
        words={WORDS}
        foundWords={new Set(["CAT"])}
        onOpenDefinition={onOpenDefinition}
        onEscape={onEscape}
      />,
    );

    const aside = screen.getByRole("complementary", { name: "Words to find" });
    expect(aside.getAttribute("tabindex")).toBe("-1");
    expect(screen.getByText("1 of 3 found")).toBeTruthy();

    const progress = screen.getByRole("progressbar", { name: "Word progress" });
    expect(progress.getAttribute("aria-valuemin")).toBe("0");
    expect(progress.getAttribute("aria-valuemax")).toBe("3");
    expect(progress.getAttribute("aria-valuenow")).toBe("1");

    const cat = screen.getByRole("button", { name: "CAT, found; open definition" });
    expect(cat.hasAttribute("disabled")).toBe(false);
    fireEvent.click(cat);
    expect(onOpenDefinition).toHaveBeenCalledWith("CAT");

    const dog = screen.getByRole("button", { name: "DOG, not found" });
    expect(dog.hasAttribute("disabled")).toBe(true);

    fireEvent.keyDown(aside, { key: "Escape" });
    expect(onEscape).toHaveBeenCalledTimes(1);

    const labels = Array.from(document.querySelectorAll(".word-search-word-item-label")).map((el) => el.textContent);
    expect(labels).toEqual(["CAT", "DOG", "ELEPHANT"]);
  });
});
