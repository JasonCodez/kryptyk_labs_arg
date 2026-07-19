/** @jest-environment jsdom */

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import DashboardInviteCard from "./DashboardInviteCard";

const LINK = "https://puzzlewarz.example/join?ref=ABC123";
const ERROR_MESSAGE =
  "Unable to copy automatically. Select the referral link and copy it manually.";

const writeTextMock = jest.fn();

beforeAll(() => {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: writeTextMock },
  });
});

function show(signedUp = 0, inviteLink = LINK) {
  return render(<DashboardInviteCard inviteLink={inviteLink} signedUp={signedUp} />);
}

function copyButton(): HTMLButtonElement {
  return screen.getByRole("button", { name: /copy invite link|copied/i }) as HTMLButtonElement;
}

async function clickCopy() {
  fireEvent.click(copyButton());
  // Flush the clipboard promise
  await act(async () => {});
}

describe("DashboardInviteCard", () => {
  beforeEach(() => {
    writeTextMock.mockReset();
    writeTextMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
    jest.useRealTimers();
  });

  it("renders the Invite Friends heading", () => {
    show();
    expect(screen.getByRole("heading", { level: 2, name: "Invite Friends" })).toBeTruthy();
  });

  it("renders the Grow the Arena eyebrow", () => {
    show();
    expect(screen.getByText("Grow the Arena")).toBeTruthy();
  });

  it("shows the default body when signedUp is zero", () => {
    show(0);
    expect(
      screen.getByText(
        "Share PuzzleWarz with another solver. Every new player makes the competition stronger.",
      ),
    ).toBeTruthy();
  });

  it("shows singular text for one joined player", () => {
    show(1);
    expect(screen.getByText("1 player has joined through your invite.")).toBeTruthy();
  });

  it("shows plural text for multiple joined players", () => {
    show(5);
    expect(screen.getByText("5 players have joined through your invite.")).toBeTruthy();
  });

  it("displays the exact invite link in a read-only, labeled input", () => {
    show();
    const input = screen.getByLabelText("Referral link") as HTMLInputElement;
    expect(input.value).toBe(LINK);
    expect(input.readOnly).toBe(true);
  });

  it("clicking Copy Invite Link writes the exact link to the clipboard", async () => {
    show();
    await clickCopy();
    expect(writeTextMock).toHaveBeenCalledTimes(1);
    expect(writeTextMock).toHaveBeenCalledWith(LINK);
  });

  it("successful copy changes the visible button label to Copied", async () => {
    show();
    await clickCopy();
    expect(screen.getByRole("button", { name: "Copied" })).toBeTruthy();
  });

  it("successful copy exposes a polite status message", async () => {
    const { container } = show();
    await clickCopy();
    const live = container.querySelector('[aria-live="polite"]');
    expect(live?.textContent).toBe("Copied");
  });

  it("button resets to Copy Invite Link after two seconds", async () => {
    jest.useFakeTimers();
    show();
    await clickCopy();
    expect(screen.getByRole("button", { name: "Copied" })).toBeTruthy();
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(screen.getByRole("button", { name: "Copy Invite Link" })).toBeTruthy();
  });

  it("clipboard rejection shows the manual-copy error as an alert", async () => {
    writeTextMock.mockRejectedValue(new Error("denied"));
    show();
    await clickCopy();
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toBe(ERROR_MESSAGE);
    // Input stays present and selectable for manual copy
    expect((screen.getByLabelText("Referral link") as HTMLInputElement).readOnly).toBe(true);
  });

  it("clipboard rejection does not show Copied", async () => {
    writeTextMock.mockRejectedValue(new Error("denied"));
    show();
    await clickCopy();
    expect(screen.queryByRole("button", { name: "Copied" })).toBeNull();
    expect(screen.getByRole("button", { name: "Copy Invite Link" })).toBeTruthy();
  });

  it("a later successful copy clears the previous error", async () => {
    writeTextMock.mockRejectedValueOnce(new Error("denied"));
    show();
    await clickCopy();
    expect(screen.getByRole("alert")).toBeTruthy();
    await clickCopy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("button", { name: "Copied" })).toBeTruthy();
  });

  it("renders a decorative SVG emblem that is aria-hidden and not focusable", () => {
    const { container } = show();
    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
    expect(svg!.getAttribute("aria-hidden")).toBe("true");
    expect(svg!.getAttribute("focusable")).toBe("false");
  });

  it("contains no emoji", () => {
    const { container } = show(3);
    expect(container.textContent).not.toMatch(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u);
  });

  it("contains no legacy purple, magenta, or pink color strings", () => {
    const { container } = show(3);
    const html = container.innerHTML.toLowerCase();
    for (const legacy of ["8b3dff", "ff4fa3", "purple", "magenta", "pink", "139,61,255", "255,79,163"]) {
      expect(html).not.toContain(legacy);
    }
  });

  it("has no animation classes or inline animation styles", () => {
    const { container } = show();
    expect(container.innerHTML).not.toMatch(/animate-|@keyframes/);
    const animated = Array.from(container.querySelectorAll<HTMLElement>("*")).filter(
      (el) => el.style.animation || el.style.animationName,
    );
    expect(animated).toHaveLength(0);
  });

  it("contains exactly one button and no navigation links", () => {
    show();
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.queryByRole("link")).toBeNull();
  });
});
