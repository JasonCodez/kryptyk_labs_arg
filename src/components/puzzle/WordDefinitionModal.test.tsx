/** @jest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import WordDefinitionModal from "./WordDefinitionModal";

jest.mock("framer-motion", () => ({
  motion: {
    div: ({ children, variants, initial, animate, exit, transition, ...props }: React.HTMLAttributes<HTMLDivElement> & Record<string, unknown>) => { void variants; void initial; void animate; void exit; void transition; return <div {...props}>{children}</div>; },
    span: ({ children, variants, initial, animate, transition, ...props }: React.HTMLAttributes<HTMLSpanElement> & Record<string, unknown>) => { void variants; void initial; void animate; void transition; return <span {...props}>{children}</span>; },
    button: ({ children, variants, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & Record<string, unknown>) => { void variants; return <button {...props}>{children}</button>; },
    p: ({ children, variants, ...props }: React.HTMLAttributes<HTMLParagraphElement> & Record<string, unknown>) => { void variants; return <p {...props}>{children}</p>; },
    a: ({ children, variants, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & Record<string, unknown>) => { void variants; return <a {...props}>{children}</a>; },
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

function Harness() {
  const [open, setOpen] = useState(false);
  return <><button type="button" onClick={() => setOpen(true)}>Open definition</button>{open && <WordDefinitionModal word="CAT" color={{ bg: "#111", border: "#0f0", text: "#fff" }} status="found" data={{ phonetic: null, audioUrl: null, partOfSpeech: "noun", definition: "A small animal.", example: null }} onDismiss={() => setOpen(false)} />}</>;
}

test("definition dialog traps Escape and restores trigger focus", async () => {
  render(<Harness />); const trigger = screen.getByRole("button", { name: "Open definition" }); trigger.focus(); fireEvent.click(trigger);
  const dialog = await screen.findByRole("dialog", { name: "CAT definition" }); await waitFor(() => expect(document.activeElement).toBe(dialog));
  fireEvent.keyDown(window, { key: "Escape" }); await waitFor(() => expect(screen.queryByRole("dialog", { name: "CAT definition" })).toBeNull());
  expect(document.activeElement).toBe(trigger);
});
