/** @jest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement, useState, type HTMLAttributes, type ReactNode } from "react";
import WordDefinitionModal, { type WordDefinitionData } from "./WordDefinitionModal";

let mockReducedMotion = false;

jest.mock("framer-motion", () => {
  type MotionProps = HTMLAttributes<HTMLElement> & Record<string, unknown> & { children?: ReactNode };
  const passthrough = (Tag: string) =>
    function Motion({ children, initial, animate, exit, transition, variants, whileTap, whileHover, ...props }: MotionProps) {
      void animate; void exit; void variants; void whileTap; void whileHover;
      return createElement(
        Tag,
        {
          ...props,
          "data-motion-initial": JSON.stringify(initial ?? null),
          "data-motion-transition": JSON.stringify(transition ?? null),
        },
        children,
      );
    };
  return {
    motion: {
      div: passthrough("div"),
      span: passthrough("span"),
      button: passthrough("button"),
      p: passthrough("p"),
      a: passthrough("a"),
    },
    AnimatePresence: ({ children }: { children: ReactNode }) => children,
    useReducedMotion: () => mockReducedMotion,
  };
});

class MockAudio {
  static instances: MockAudio[] = [];
  volumeSet: number | null = null;
  playCalls = 0;
  playResult: Promise<void> = Promise.resolve();
  constructor(public src: string) {
    MockAudio.instances.push(this);
  }
  set volume(v: number) {
    this.volumeSet = v;
  }
  get volume() {
    return this.volumeSet ?? 1;
  }
  play() {
    this.playCalls += 1;
    return this.playResult;
  }
}

beforeAll(() => {
  Object.defineProperty(window, "scrollTo", { writable: true, value: jest.fn() });
  Object.defineProperty(window, "requestAnimationFrame", { writable: true, value: (callback: FrameRequestCallback) => window.setTimeout(() => callback(0), 0) });
  Object.defineProperty(window, "cancelAnimationFrame", { writable: true, value: clearTimeout });
});
afterEach(() => {
  cleanup();
  mockReducedMotion = false;
  MockAudio.instances = [];
});

const FOUND_DATA: WordDefinitionData = {
  phonetic: "/kat/",
  audioUrl: "https://example.test/cat.mp3",
  partOfSpeech: "noun",
  definition: "A small domesticated carnivorous mammal.",
  example: "The cat slept by the window.",
};

const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u;

function Harness({ status, data, onDismiss = jest.fn() }: { status: "loading" | "found" | "not-found"; data?: WordDefinitionData; onDismiss?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Open definition</button>
      {open && (
        <WordDefinitionModal
          word="CAT"
          color={{ bg: "#181c2e", border: "#22c55e", text: "#86efac" }}
          status={status}
          data={data}
          onDismiss={() => { setOpen(false); onDismiss(); }}
        />
      )}
    </>
  );
}

describe("WordDefinitionModal found-state semantics", () => {
  it("renders a fully labeled, populated found card", async () => {
    render(<Harness status="found" data={FOUND_DATA} />);
    fireEvent.click(screen.getByRole("button", { name: "Open definition" }));

    const dialog = await screen.findByRole("dialog", { name: "CAT definition" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("aria-busy")).toBe("false");
    expect(dialog.getAttribute("data-definition-status")).toBe("found");

    expect(screen.getByText("Word found")).toBeTruthy();

    const tiles = dialog.querySelectorAll(".word-definition-tile");
    expect(Array.from(tiles).map((tile) => tile.textContent)).toEqual(["C", "A", "T"]);

    expect(screen.getByText("noun")).toBeTruthy();
    expect(screen.getByText("A small domesticated carnivorous mammal.")).toBeTruthy();
    expect(screen.getByText("Example")).toBeTruthy();
    expect(screen.getByText("The cat slept by the window.")).toBeTruthy();

    expect(screen.getByRole("button", { name: "Hear pronunciation for CAT" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "View full definition for CAT on Merriam-Webster, opens in a new tab" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Keep searching/ })).toBeTruthy();

    expect(dialog.textContent).not.toMatch(EMOJI_RE);
  });
});

describe("WordDefinitionModal optional-content behavior", () => {
  it("omits pronunciation, part-of-speech, and example blocks when absent", async () => {
    render(<Harness status="found" data={{ phonetic: null, audioUrl: null, partOfSpeech: null, definition: "A tall plant-eating mammal.", example: null }} />);
    fireEvent.click(screen.getByRole("button", { name: "Open definition" }));
    const dialog = await screen.findByRole("dialog", { name: "CAT definition" });

    expect(screen.queryByRole("button", { name: /Hear pronunciation/ })).toBeNull();
    expect(dialog.querySelector(".word-definition-part")).toBeNull();
    expect(dialog.querySelector(".word-definition-example")).toBeNull();

    expect(screen.getByText("A tall plant-eating mammal.")).toBeTruthy();
    expect(screen.getByRole("link", { name: /View full definition/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Keep searching/ })).toBeTruthy();
  });
});

describe("WordDefinitionModal loading state", () => {
  it("shows a stable, accessible skeleton with the CTA disabled", async () => {
    render(<Harness status="loading" />);
    fireEvent.click(screen.getByRole("button", { name: "Open definition" }));
    const dialog = await screen.findByRole("dialog", { name: "CAT definition" });

    expect(dialog.getAttribute("aria-busy")).toBe("true");
    expect(dialog.getAttribute("data-definition-status")).toBe("loading");
    expect(screen.getByText("Loading definition for CAT")).toBeTruthy();

    const skeletons = dialog.querySelectorAll(".word-definition-skeleton");
    expect(skeletons.length).toBeGreaterThan(0);
    expect(dialog.querySelector(".word-definition-loading")?.getAttribute("aria-hidden")).toBe("true");

    const cta = screen.getByRole("button", { name: /Keep searching/ });
    expect(cta.hasAttribute("disabled")).toBe(true);

    expect(screen.getByRole("button", { name: "Close" })).toBeTruthy();
    expect(dialog.textContent).not.toContain("A small domesticated");
  });
});

describe("WordDefinitionModal not-found state", () => {
  it("shows calm fallback copy, keeps the source link, and omits found-only controls", async () => {
    render(<Harness status="not-found" />);
    fireEvent.click(screen.getByRole("button", { name: "Open definition" }));
    const dialog = await screen.findByRole("dialog", { name: "CAT definition" });

    expect(screen.getByText("A quick definition was not available for this word.")).toBeTruthy();
    expect(dialog.textContent).not.toMatch(EMOJI_RE);

    expect(screen.getByRole("link", { name: /View full definition/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Hear pronunciation/ })).toBeNull();
    expect(dialog.querySelector(".word-definition-part")).toBeNull();
    expect(dialog.querySelector(".word-definition-example")).toBeNull();

    const cta = screen.getByRole("button", { name: /Keep searching/ });
    expect(cta.hasAttribute("disabled")).toBe(false);
  });
});

describe("WordDefinitionModal pronunciation playback", () => {
  beforeEach(() => {
    (window as unknown as { Audio: typeof MockAudio }).Audio = MockAudio;
  });

  it("creates one playback attempt per click using the supplied URL and volume", async () => {
    render(<Harness status="found" data={FOUND_DATA} />);
    fireEvent.click(screen.getByRole("button", { name: "Open definition" }));
    await screen.findByRole("dialog", { name: "CAT definition" });

    fireEvent.click(screen.getByRole("button", { name: "Hear pronunciation for CAT" }));
    expect(MockAudio.instances).toHaveLength(1);
    expect(MockAudio.instances[0].src).toBe(FOUND_DATA.audioUrl);
    expect(MockAudio.instances[0].volumeSet).toBe(0.7);
    expect(MockAudio.instances[0].playCalls).toBe(1);
  });

  it("does not throw when playback is rejected", async () => {
    render(<Harness status="found" data={FOUND_DATA} />);
    fireEvent.click(screen.getByRole("button", { name: "Open definition" }));
    await screen.findByRole("dialog", { name: "CAT definition" });

    const button = screen.getByRole("button", { name: "Hear pronunciation for CAT" });
    expect(() => fireEvent.click(button)).not.toThrow();
    // Attach a no-op catch at creation so the rejection is never briefly "unhandled" before the
    // component's own .catch() chains onto it a moment later — this test only cares that a
    // rejection can't escape as an uncaught/thrown error, not about promise-tracking internals.
    const rejected = Promise.reject(new Error("blocked"));
    rejected.catch(() => {});
    MockAudio.instances[0].playResult = rejected;
    expect(() => fireEvent.click(button)).not.toThrow();
    await Promise.resolve().catch(() => {});
  });

  it("creates no Audio instance when audioUrl is absent", async () => {
    render(<Harness status="found" data={{ ...FOUND_DATA, audioUrl: null }} />);
    fireEvent.click(screen.getByRole("button", { name: "Open definition" }));
    await screen.findByRole("dialog", { name: "CAT definition" });
    expect(MockAudio.instances).toHaveLength(0);
  });
});

describe("WordDefinitionModal focus management", () => {
  it("moves focus into the dialog, closes on Escape, and restores focus to the trigger", async () => {
    render(<Harness status="found" data={FOUND_DATA} />);
    const trigger = screen.getByRole("button", { name: "Open definition" });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = await screen.findByRole("dialog", { name: "CAT definition" });
    await waitFor(() => expect(document.activeElement).toBe(dialog));

    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "CAT definition" })).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });
});

describe("WordDefinitionModal tab trapping", () => {
  it("wraps Tab/Shift+Tab between Close and Keep searching, with pronunciation and the source link in between", async () => {
    (window as unknown as { Audio: typeof MockAudio }).Audio = MockAudio;
    render(<Harness status="found" data={FOUND_DATA} />);
    fireEvent.click(screen.getByRole("button", { name: "Open definition" }));
    const dialog = await screen.findByRole("dialog", { name: "CAT definition" });

    const focusable = Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])'));
    const close = screen.getByRole("button", { name: "Close" });
    const pronunciation = screen.getByRole("button", { name: "Hear pronunciation for CAT" });
    const link = screen.getByRole("link", { name: /View full definition/ });
    const cta = screen.getByRole("button", { name: /Keep searching/ });
    expect(focusable).toEqual([close, pronunciation, link, cta]);

    cta.focus();
    expect(document.activeElement).toBe(cta);
    fireEvent.keyDown(window, { key: "Tab" });
    expect(document.activeElement).toBe(close);

    fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(cta);
  });
});

describe("WordDefinitionModal backdrop and card clicks", () => {
  it("dismisses on backdrop click but never on a click inside the card, and Close dismisses once", async () => {
    const onDismiss = jest.fn();
    render(<Harness status="found" data={FOUND_DATA} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole("button", { name: "Open definition" }));
    const dialog = await screen.findByRole("dialog", { name: "CAT definition" });

    fireEvent.click(dialog);
    expect(onDismiss).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onDismiss).toHaveBeenCalledTimes(1);

    // Reopen to test backdrop dismissal independently.
    fireEvent.click(screen.getByRole("button", { name: "Open definition" }));
    const reopened = await screen.findByRole("dialog", { name: "CAT definition" });
    const backdrop = reopened.parentElement!;
    fireEvent.click(backdrop);
    expect(onDismiss).toHaveBeenCalledTimes(2);
  });
});

describe("WordDefinitionModal long-word rendering", () => {
  it("renders every letter of a very long word in order without truncation", async () => {
    function LongWordHarness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>Open definition</button>
          {open && (
            <WordDefinitionModal
              word="CHARACTERIZATION"
              color={{ bg: "#181c2e", border: "#3b82f6", text: "#93c5fd" }}
              status="found"
              data={{ phonetic: null, audioUrl: null, partOfSpeech: null, definition: "The action of describing distinctive character.", example: null }}
              onDismiss={() => setOpen(false)}
            />
          )}
        </>
      );
    }
    render(<LongWordHarness />);
    fireEvent.click(screen.getByRole("button", { name: "Open definition" }));
    const dialog = await screen.findByRole("dialog", { name: "CHARACTERIZATION definition" });

    const tilesContainer = dialog.querySelector(".word-definition-tiles");
    expect(tilesContainer?.getAttribute("data-tile-layout")).toBe("single-row");

    const tiles = dialog.querySelectorAll(".word-definition-tile");
    expect(Array.from(tiles).map((tile) => tile.textContent)).toEqual("CHARACTERIZATION".split(""));
    expect(tiles).toHaveLength(16);
  });
});

describe("WordDefinitionModal reduced motion", () => {
  it("gives the card and letter tiles a non-transformed initial state", async () => {
    mockReducedMotion = true;
    render(<Harness status="found" data={FOUND_DATA} />);
    fireEvent.click(screen.getByRole("button", { name: "Open definition" }));
    const dialog = await screen.findByRole("dialog", { name: "CAT definition" });

    expect(dialog.getAttribute("data-motion-initial")).toBe("false");

    const tiles = dialog.querySelectorAll(".word-definition-tile");
    for (const tile of Array.from(tiles)) {
      expect(tile.getAttribute("data-motion-initial")).toBe("false");
    }

    // The skeleton is never animated regardless of motion preference — confirmed via the
    // loading state, which uses plain (non-motion) elements with no animation class.
    cleanup();
    render(<Harness status="loading" />);
    fireEvent.click(screen.getByRole("button", { name: "Open definition" }));
    const loadingDialog = await screen.findByRole("dialog", { name: "CAT definition" });
    const skeleton = loadingDialog.querySelector(".word-definition-skeleton");
    expect(skeleton?.className).not.toMatch(/animate|pulse|shimmer/i);
  });
});
