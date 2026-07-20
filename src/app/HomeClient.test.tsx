/** @jest-environment jsdom */

import { act, cleanup, render } from "@testing-library/react";
import HomeClient from "./HomeClient";

const mockUseSession = jest.fn();
jest.mock("next-auth/react", () => ({
  useSession: () => mockUseSession(),
}));

// jsdom has no IntersectionObserver; framer-motion's whileInView needs one.
beforeAll(() => {
  class StubIntersectionObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() { return []; }
  }
  Object.defineProperty(window, "IntersectionObserver", {
    configurable: true,
    value: StubIntersectionObserver,
  });
});

function mockFetch() {
  // Continue-playing + daily summary fetches — return empty/null shapes.
  global.fetch = jest.fn((input: RequestInfo | URL) => {
    const url = String(input);
    const body = url.includes("continue-playing") ? { puzzle: null } : null;
    return Promise.resolve({ ok: body !== null, json: () => Promise.resolve(body) } as Response);
  }) as jest.Mock;
}

async function renderHome() {
  render(<HomeClient />);
  await act(async () => {
    await Promise.resolve();
  });
}

describe("HomeClient", () => {
  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
  });

  it("routes the daily hero and feature cards; Warz goes to registration when signed out", async () => {
    mockUseSession.mockReturnValue({ data: null, status: "unauthenticated" });
    mockFetch();
    await renderHome();

    expect(document.querySelector('a[href="/daily"]')).not.toBeNull();
    expect(document.querySelector('a[href="/puzzles"]')).not.toBeNull();
    const registerLink = document.querySelector('a[href="/auth/register"]');
    expect(registerLink).not.toBeNull();
    expect(document.querySelector('a[href="/warz"]')).toBeNull();
    expect(registerLink!.textContent).toContain("Create Account");
  });

  it("routes Warz directly for signed-in players", async () => {
    mockUseSession.mockReturnValue({ data: { user: { name: "Ada" } }, status: "authenticated" });
    mockFetch();
    await renderHome();

    const warzLink = document.querySelector('a[href="/warz"]');
    expect(warzLink).not.toBeNull();
    expect(warzLink!.textContent).toContain("Enter Warz");
  });

  it("gives the daily hero the primary play affordance", async () => {
    mockUseSession.mockReturnValue({ data: null, status: "unauthenticated" });
    mockFetch();
    await renderHome();

    const hero = document.querySelector('a[href="/daily"]')!;
    // Pass 3: Daily hero CTA copy is now state-driven ("Start Daily Run" /
    // "Continue Daily Run" / "View Results") rather than the old "Play Now".
    expect(hero.textContent).toContain("Start Daily Run");
  });
});
