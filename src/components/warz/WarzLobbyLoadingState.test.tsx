/** @jest-environment jsdom */

import { render, screen } from "@testing-library/react";
import WarzLobbyLoadingState from "./WarzLobbyLoadingState";

describe("WarzLobbyLoadingState", () => {
  it("owns one stable, full-width loading status", () => {
    render(<WarzLobbyLoadingState />);
    expect(screen.getAllByRole("status")).toHaveLength(1);
    const root = screen.getByTestId("warz-lobby-loading");
    expect(root.getAttribute("aria-label")).toBe("Loading Warz arena");
    expect([...root.classList]).toEqual(expect.arrayContaining(["w-full", "min-w-0"]));
  });

  it("preserves lobby geometry", () => {
    const { container } = render(<WarzLobbyLoadingState />);
    const shapes = container.querySelectorAll("[data-skeleton='true']");
    expect(shapes).toHaveLength(10);
    expect(container.querySelectorAll("li [data-skeleton='true']")).toHaveLength(3);
    expect(container.querySelectorAll(".h-11")).toHaveLength(3);
    expect(container.querySelectorAll(".h-24")).toHaveLength(4);
  });

  it("uses hidden shared skeletons with safe motion", () => {
    const { container } = render(<WarzLobbyLoadingState />);
    for (const shape of container.querySelectorAll("[data-skeleton='true']")) {
      expect(shape.getAttribute("aria-hidden")).toBe("true");
      expect([...shape.classList]).toEqual(expect.arrayContaining(["motion-safe:animate-pulse", "motion-reduce:animate-none"]));
    }
  });

  it("contains no fake challenge data, raw colors, emoji, or requests", () => {
    const originalFetch = global.fetch;
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    const { container } = render(<WarzLobbyLoadingState />);
    expect(container.textContent).toBe("Loading the Warz arena…");
    expect(container.innerHTML).not.toMatch(/#[\da-f]{3,8}\b|rgba?\(/i);
    expect(container.textContent).not.toMatch(/\b\d+\b|[\u{1F000}-\u{1FAFF}]/u);
    expect(fetchMock).not.toHaveBeenCalled();
    global.fetch = originalFetch;
  });
});
