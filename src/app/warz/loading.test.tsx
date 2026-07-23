/** @jest-environment jsdom */

import { render, screen } from "@testing-library/react";
import WarzLoading from "./loading";

jest.mock("@/components/warz/WarzLobbyLoadingState", () => ({
  __esModule: true,
  default: () => <div role="status" aria-label="Loading Warz arena" data-testid="warz-lobby-loading" />,
}));

describe("Warz route loading boundary", () => {
  it("renders one lobby status in the catalog container", () => {
    const { container } = render(<WarzLoading />);
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByTestId("warz-lobby-loading")).toBeTruthy();
    expect(container.querySelector(".lg\\:max-w-7xl")).toBeTruthy();
    expect(container.querySelector(".w-full.max-w-5xl")).toBeTruthy();
  });

  it("uses semantic background and Navbar clearance", () => {
    const { container } = render(<WarzLoading />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.background).toBe("var(--pw-bg-base)");
    expect(root.style.paddingTop).toContain("56px");
  });

  it("performs no request and renders no fake content", () => {
    const originalFetch = global.fetch;
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    const { container } = render(<WarzLoading />);
    expect(container.textContent).toBe("");
    expect(fetchMock).not.toHaveBeenCalled();
    global.fetch = originalFetch;
  });
});
