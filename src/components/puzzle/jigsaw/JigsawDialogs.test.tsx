/** @jest-environment jsdom */

import React, { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import JigsawPreviewDialog from "./JigsawPreviewDialog";
import JigsawResetDialog from "./JigsawResetDialog";

beforeAll(() => {
  window.requestAnimationFrame = (callback: FrameRequestCallback) => { callback(0); return 1; };
  window.cancelAnimationFrame = () => {};
  window.scrollTo = () => {};
});

test("Preview traps focus, closes with Escape, and restores board focus", () => {
  function Fixture() {
    const [open, setOpen] = useState(false);
    return <><button type="button" onClick={() => setOpen(true)}>Board</button>{open && <JigsawPreviewDialog imageUrl="/preview.png" puzzleTitle="Sunset" onClose={() => setOpen(false)} />}</>;
  }
  render(<Fixture />);
  const board = screen.getByRole("button", { name: "Board" });
  board.focus(); fireEvent.click(board);
  expect(screen.getByRole("dialog", { name: "Puzzle preview" })).toBeTruthy();
  expect(screen.getByRole("img", { name: "Completed image for Sunset" })).toBeTruthy();
  const closePreview = screen.getByRole("button", { name: "Back to Puzzle" });
  closePreview.focus(); fireEvent.keyDown(window, { key: "Tab" });
  expect(screen.getByRole("button", { name: "Close" })).toBe(document.activeElement);
  fireEvent.keyDown(window, { key: "Escape" });
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(board).toBe(document.activeElement);
});

test("Reset focuses the safe action and cannot submit twice", () => {
  const onReset = jest.fn(); const onClose = jest.fn();
  render(<JigsawResetDialog onReset={onReset} onClose={onClose} />);
  const keep = screen.getByRole("button", { name: "Keep Progress" });
  expect(keep).toBe(document.activeElement);
  const reset = screen.getByRole("button", { name: "Reset Puzzle" });
  fireEvent.click(reset); fireEvent.click(reset);
  expect(onReset).toHaveBeenCalledTimes(1);
  expect(onClose).toHaveBeenCalledTimes(1);
});
