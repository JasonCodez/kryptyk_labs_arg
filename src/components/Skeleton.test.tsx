/** @jest-environment jsdom */

import { render } from "@testing-library/react";
import { PuzzlePageSkeleton, Skeleton } from "./Skeleton";

describe("Skeleton", () => {
  it("renders an accessible-tree-hidden semantic skeleton with safe motion", () => {
    const { container } = render(<Skeleton className="h-8 custom" style={{ width: 42 }} />);
    const shape = container.firstElementChild as HTMLElement;
    expect(shape.getAttribute("data-skeleton")).toBe("true");
    expect(shape.getAttribute("aria-hidden")).toBe("true");
    expect([...shape.classList]).toEqual(expect.arrayContaining(["motion-safe:animate-pulse", "motion-reduce:animate-none", "custom"]));
    expect(shape.className.split(/\s+/)).not.toContain("animate-pulse");
    expect(shape.style.width).toBe("42px");
    expect(shape.style.background).toBe("var(--pw-surface-2)");
    expect(shape.textContent).toBe("");
  });

  it("contains no raw colors, spinner, shimmer, or custom keyframes", () => {
    const { container } = render(<Skeleton />);
    expect(container.innerHTML).not.toMatch(/#[\da-f]{3,8}\b|rgba?\(|animate-spin|shimmer|@keyframes/i);
  });

  it("PuzzlePageSkeleton retains all five shapes and animation delays", () => {
    const { container } = render(<PuzzlePageSkeleton />);
    const shapes = container.querySelectorAll("[data-skeleton='true']");
    expect(shapes).toHaveLength(5);
    expect((shapes[2] as HTMLElement).style.animationDelay).toBe("80ms");
    expect((shapes[3] as HTMLElement).style.animationDelay).toBe("120ms");
    expect((shapes[4] as HTMLElement).style.animationDelay).toBe("160ms");
  });

  it("performs no fetch", () => {
    const originalFetch = global.fetch;
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    render(<PuzzlePageSkeleton />);
    expect(fetchMock).not.toHaveBeenCalled();
    global.fetch = originalFetch;
  });
});
