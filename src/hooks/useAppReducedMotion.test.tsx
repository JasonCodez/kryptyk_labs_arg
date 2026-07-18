/** @jest-environment jsdom */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { useAppReducedMotion } from "./useAppReducedMotion";

function Probe() {
  const reduced = useAppReducedMotion();
  return <span data-testid="probe">{reduced ? "reduced" : "full"}</span>;
}

describe("useAppReducedMotion", () => {
  afterEach(() => {
    cleanup();
    document.documentElement.removeAttribute("data-reduce-animations");
  });

  it("reports full motion by default", () => {
    render(<Probe />);
    expect(screen.getByTestId("probe").textContent).toBe("full");
  });

  it("reads an already-enabled in-app setting at mount", () => {
    document.documentElement.setAttribute("data-reduce-animations", "true");
    render(<Probe />);
    expect(screen.getByTestId("probe").textContent).toBe("reduced");
  });

  it("reacts when the in-app setting changes AFTER mount, both directions", async () => {
    render(<Probe />);
    expect(screen.getByTestId("probe").textContent).toBe("full");

    document.documentElement.setAttribute("data-reduce-animations", "true");
    await waitFor(() => expect(screen.getByTestId("probe").textContent).toBe("reduced"));

    document.documentElement.setAttribute("data-reduce-animations", "false");
    await waitFor(() => expect(screen.getByTestId("probe").textContent).toBe("full"));
  });

  it("shares one observer across subscribers and updates all of them", async () => {
    render(
      <>
        <Probe />
        <Probe />
      </>
    );
    document.documentElement.setAttribute("data-reduce-animations", "true");
    await waitFor(() => {
      for (const probe of screen.getAllByTestId("probe")) {
        expect(probe.textContent).toBe("reduced");
      }
    });
  });

  it("cleans up on unmount — later attribute changes don't leak updates", async () => {
    const disconnect = jest.spyOn(MutationObserver.prototype, "disconnect");
    const { unmount } = render(<Probe />);
    unmount();
    // Last subscriber gone → the shared observer is disconnected.
    expect(disconnect).toHaveBeenCalled();
    disconnect.mockRestore();
    // And toggling afterwards must not throw or warn about state updates.
    document.documentElement.setAttribute("data-reduce-animations", "true");
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
});
