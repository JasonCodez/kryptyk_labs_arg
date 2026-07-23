/** @jest-environment jsdom */

import { render, screen } from "@testing-library/react";
import WarzSetupLoading from "./loading";

jest.mock("@/components/warz/WarzSetupLoadingState", () => ({
  __esModule: true,
  default: () => <div role="status" aria-label="Loading challenge setup" data-testid="warz-setup-loading" />,
}));

describe("Warz setup route loading boundary", () => {
  it("renders one setup status in a non-collapsing wrapper", () => {
    const { container } = render(<WarzSetupLoading />);
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByTestId("warz-setup-loading")).toBeTruthy();
    expect(container.querySelector(".w-full.min-w-0.max-w-xl")).toBeTruthy();
  });

  it("uses semantic background and Navbar clearance", () => {
    const { container } = render(<WarzSetupLoading />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.background).toBe("var(--pw-bg-base)");
    expect(root.style.paddingTop).toContain("56px");
  });

  it("aligns the loading root to the top of the viewport, not the center", () => {
    const { container } = render(<WarzSetupLoading />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toMatch(/\bitems-start\b/);
    expect(root.className).not.toMatch(/\bitems-center\b/);
  });

  it("has bottom padding so the last placeholder never touches the viewport edge", () => {
    const { container } = render(<WarzSetupLoading />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toMatch(/\bpb-8\b/);
  });

  it("adds extra top clearance beyond the bare Navbar height", () => {
    const { container } = render(<WarzSetupLoading />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.paddingTop).toContain("56px");
    expect(root.style.paddingTop).toContain("1rem");
  });

  it("keeps the wrapper bounded (w-full min-w-0 max-w-xl)", () => {
    const { container } = render(<WarzSetupLoading />);
    expect(container.querySelector(".w-full.min-w-0.max-w-xl")).toBeTruthy();
  });

  it("performs no request and renders no fake content", () => {
    const originalFetch = global.fetch;
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    const { container } = render(<WarzSetupLoading />);
    expect(container.textContent).toBe("");
    expect(fetchMock).not.toHaveBeenCalled();
    global.fetch = originalFetch;
  });
});
