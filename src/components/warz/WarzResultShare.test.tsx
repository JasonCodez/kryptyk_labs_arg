/** @jest-environment jsdom */

import { act, fireEvent, render, screen } from "@testing-library/react";
import WarzResultShare from "./WarzResultShare";

const props = {
  title: "Puzzle Warz Battle Result",
  text: "I won in 42s.",
  url: "https://puzzlewarz.test/warz/challenge/challenge-1",
};

function setNavigatorMethod(name: "share" | "clipboard", value: unknown) {
  Object.defineProperty(navigator, name, { configurable: true, value });
}

beforeEach(() => {
  jest.useFakeTimers();
  setNavigatorMethod("share", undefined);
  setNavigatorMethod("clipboard", { writeText: jest.fn().mockResolvedValue(undefined) });
});

afterEach(() => {
  jest.useRealTimers();
});

describe("WarzResultShare", () => {
  it("uses native share with the exact title, text, and URL", async () => {
    const share = jest.fn().mockResolvedValue(undefined);
    setNavigatorMethod("share", share);
    render(<WarzResultShare {...props} />);

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Share Result" })));
    expect(share).toHaveBeenCalledWith(props);
    expect(screen.getByRole("button", { name: "Shared" })).toBeTruthy();
  });

  it("does not copy after the user cancels native share", async () => {
    const abort = new DOMException("cancelled", "AbortError");
    setNavigatorMethod("share", jest.fn().mockRejectedValue(abort));
    const writeText = jest.fn().mockResolvedValue(undefined);
    setNavigatorMethod("clipboard", { writeText });
    render(<WarzResultShare {...props} />);

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Share Result" })));
    expect(writeText).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Share Result" })).toBeTruthy();
  });

  it("falls back to the clipboard when native sharing fails or is unavailable", async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    setNavigatorMethod("share", jest.fn().mockRejectedValue(new Error("not supported")));
    setNavigatorMethod("clipboard", { writeText });
    render(<WarzResultShare {...props} />);

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Share Result" })));
    expect(writeText).toHaveBeenCalledWith(`${props.text}\n${props.url}`);
    expect(screen.getByRole("button", { name: "Copied" })).toBeTruthy();

    act(() => jest.advanceTimersByTime(2_000));
    expect(screen.getByRole("button", { name: "Share Result" })).toBeTruthy();
  });

  it("reports clipboard failure in its polite live region", async () => {
    setNavigatorMethod("clipboard", { writeText: jest.fn().mockRejectedValue(new Error("denied")) });
    render(<WarzResultShare {...props} />);

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Share Result" })));
    expect(screen.getByText(/couldn.t share this result/i).getAttribute("aria-live")).toBe("polite");
  });

  it("synchronously guards rapid clicks while sharing", async () => {
    let resolveShare!: () => void;
    const share = jest.fn(() => new Promise<void>((resolve) => { resolveShare = resolve; }));
    setNavigatorMethod("share", share);
    render(<WarzResultShare {...props} />);
    const button = screen.getByRole("button", { name: "Share Result" });

    fireEvent.click(button);
    fireEvent.click(button);
    expect(share).toHaveBeenCalledTimes(1);
    expect((screen.getByRole("button", { name: /Sharing/ }) as HTMLButtonElement).disabled).toBe(true);

    await act(async () => resolveShare());
  });

  it("is disabled when sharing is unavailable and clears timers on unmount", async () => {
    const { unmount } = render(<WarzResultShare {...props} disabled />);
    const disabled = screen.getByRole("button", { name: "Share Result" });
    expect((disabled as HTMLButtonElement).disabled).toBe(true);
    expect(disabled.style.minHeight).toBe("48px");
    fireEvent.click(disabled);
    unmount();
    expect(jest.getTimerCount()).toBe(0);
  });
});
