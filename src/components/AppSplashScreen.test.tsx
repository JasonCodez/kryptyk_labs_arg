/** @jest-environment jsdom */

import { act, cleanup, render, screen } from "@testing-library/react";
import AppSplashScreen from "./AppSplashScreen";
import { APP_LAUNCH_SESSION_KEY, APP_LAUNCH_VERSION, APP_LAUNCH_VERSION_KEY } from "@/lib/appLaunch";

type MediaQueryOverrides = { standalone?: boolean; reducedMotion?: boolean };

function installMatchMedia({ standalone = false, reducedMotion = false }: MediaQueryOverrides) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: jest.fn((query: string) => {
      const matches = query.includes("display-mode: standalone") ? standalone : query.includes("prefers-reduced-motion") ? reducedMotion : false;
      return {
        matches,
        media: query,
        onchange: null,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        addListener: jest.fn(),
        removeListener: jest.fn(),
        dispatchEvent: jest.fn(),
      };
    }),
  });
}

function setStoredVersion(version: string | null) {
  if (version === null) {
    window.localStorage.removeItem(APP_LAUNCH_VERSION_KEY);
  } else {
    window.localStorage.setItem(APP_LAUNCH_VERSION_KEY, version);
  }
}

function setSessionSeen(seen: boolean) {
  if (seen) {
    window.sessionStorage.setItem(APP_LAUNCH_SESSION_KEY, "1");
  } else {
    window.sessionStorage.removeItem(APP_LAUNCH_SESSION_KEY);
  }
}

beforeEach(() => {
  jest.useFakeTimers();
  window.localStorage.clear();
  window.sessionStorage.clear();
  document.documentElement.removeAttribute("data-reduce-animations");
  document.documentElement.removeAttribute("data-pw-launch");
  installMatchMedia({});
});

afterEach(() => {
  act(() => {
    jest.runOnlyPendingTimers();
  });
  jest.useRealTimers();
  cleanup();
  document.documentElement.removeAttribute("data-reduce-animations");
  document.documentElement.removeAttribute("data-pw-launch");
  jest.restoreAllMocks();
});

describe("AppSplashScreen", () => {
  it("not a candidate: renders no overlay", () => {
    render(<AppSplashScreen launchCandidate={false} />);
    expect(screen.queryByTestId("app-launch-sequence")).toBeNull();
  });

  it("first valid standalone launch: full mode with tiles, logo, tagline, segments, and persisted markers", () => {
    installMatchMedia({ standalone: true });
    render(<AppSplashScreen launchCandidate={true} />);

    const overlay = screen.getByTestId("app-launch-sequence");
    expect(overlay.getAttribute("data-launch-mode")).toBe("full");
    expect(screen.getByTestId("app-launch-tiles")).toBeTruthy();
    expect(screen.getByTestId("app-launch-logo")).toBeTruthy();
    expect(screen.getByTestId("app-launch-tagline").textContent).toContain("CLASSIC PUZZLES. MODERN COMPETITION.");
    expect(screen.getByTestId("app-launch-segments")).toBeTruthy();

    expect(window.sessionStorage.getItem(APP_LAUNCH_SESSION_KEY)).toBe("1");
    expect(window.localStorage.getItem(APP_LAUNCH_VERSION_KEY)).toBe(APP_LAUNCH_VERSION);
  });

  it("returning cold launch: compact mode skips tile assembly and exits on the compact timeline", () => {
    installMatchMedia({ standalone: true });
    setStoredVersion(APP_LAUNCH_VERSION);
    render(<AppSplashScreen launchCandidate={true} />);

    const overlay = screen.getByTestId("app-launch-sequence");
    expect(overlay.getAttribute("data-launch-mode")).toBe("compact");
    expect(screen.queryByTestId("app-launch-tiles")).toBeNull();
    expect(screen.getByTestId("app-launch-logo")).toBeTruthy();
    expect(screen.getByTestId("app-launch-tagline")).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(950);
    });
    expect(screen.queryByTestId("app-launch-sequence")).toBeNull();
  });

  it("same-session launch: overlay never appears, no timers, no persistence changes", () => {
    installMatchMedia({ standalone: true });
    setSessionSeen(true);
    setStoredVersion(APP_LAUNCH_VERSION);
    render(<AppSplashScreen launchCandidate={true} />);

    expect(screen.queryByTestId("app-launch-sequence")).toBeNull();
    expect(window.localStorage.getItem(APP_LAUNCH_VERSION_KEY)).toBe(APP_LAUNCH_VERSION);

    // Advancing timers well past every phase's hard maximum must not cause
    // the overlay to appear later — it was never scheduled to begin with.
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(screen.queryByTestId("app-launch-sequence")).toBeNull();
  });

  it("normal browser: overlay never appears, no persistence changes", () => {
    installMatchMedia({ standalone: false });
    render(<AppSplashScreen launchCandidate={true} />);

    expect(screen.queryByTestId("app-launch-sequence")).toBeNull();
    expect(window.sessionStorage.getItem(APP_LAUNCH_SESSION_KEY)).toBeNull();
    expect(window.localStorage.getItem(APP_LAUNCH_VERSION_KEY)).toBeNull();
  });

  it("reduced motion: static logo/tagline, no tile stage, no light sweep, exits on the reduced timeline", () => {
    installMatchMedia({ standalone: true, reducedMotion: true });
    document.documentElement.setAttribute("data-reduce-animations", "true");
    render(<AppSplashScreen launchCandidate={true} />);

    const overlay = screen.getByTestId("app-launch-sequence");
    expect(overlay.getAttribute("data-launch-mode")).toBe("reduced");
    expect(screen.queryByTestId("app-launch-tiles")).toBeNull();
    expect(screen.queryByTestId("app-launch-sweep")).toBeNull();
    expect(screen.getByTestId("app-launch-logo")).toBeTruthy();
    expect(screen.getByTestId("app-launch-tagline")).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(550);
    });
    expect(screen.queryByTestId("app-launch-sequence")).toBeNull();
  });

  it("full timeout: overlay is gone once the full hard maximum has elapsed", () => {
    installMatchMedia({ standalone: true });
    render(<AppSplashScreen launchCandidate={true} />);
    expect(screen.getByTestId("app-launch-sequence")).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(2400);
    });
    expect(screen.queryByTestId("app-launch-sequence")).toBeNull();
  });

  it("compact timeout: overlay is gone once the compact hard maximum has elapsed", () => {
    installMatchMedia({ standalone: true });
    setStoredVersion(APP_LAUNCH_VERSION);
    render(<AppSplashScreen launchCandidate={true} />);
    expect(screen.getByTestId("app-launch-sequence")).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(1100);
    });
    expect(screen.queryByTestId("app-launch-sequence")).toBeNull();
  });

  it("storage failure: never throws, renders a fail-safe compact presentation, and still exits", () => {
    installMatchMedia({ standalone: true });
    const sessionGetSpy = jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage unavailable");
    });
    const sessionSetSpy = jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage unavailable");
    });

    expect(() => render(<AppSplashScreen launchCandidate={true} />)).not.toThrow();

    const overlay = screen.queryByTestId("app-launch-sequence");
    expect(overlay).not.toBeNull();
    expect(overlay!.getAttribute("data-launch-mode")).toBe("compact");

    act(() => {
      jest.advanceTimersByTime(1100);
    });
    expect(screen.queryByTestId("app-launch-sequence")).toBeNull();

    sessionGetSpy.mockRestore();
    sessionSetSpy.mockRestore();
  });

  it("scroll lock: applies overflow hidden while visible and restores it on unmount", () => {
    const originalOverflow = document.body.style.overflow;
    installMatchMedia({ standalone: true });
    const { unmount } = render(<AppSplashScreen launchCandidate={true} />);

    expect(document.body.style.overflow).toBe("hidden");

    unmount();
    expect(document.body.style.overflow).toBe(originalOverflow);
  });

  it("scroll lock: also restores if the component unmounts early, mid-sequence", () => {
    installMatchMedia({ standalone: true });
    const { unmount } = render(<AppSplashScreen launchCandidate={true} />);
    expect(document.body.style.overflow).toBe("hidden");

    act(() => {
      jest.advanceTimersByTime(300);
    });
    unmount();
    expect(document.body.style.overflow).toBe("");
  });

  it("contains no focusable controls", () => {
    installMatchMedia({ standalone: true });
    render(<AppSplashScreen launchCandidate={true} />);
    const overlay = screen.getByTestId("app-launch-sequence");

    for (const selector of ["a", "button", "input", "select", "textarea"]) {
      expect(overlay.querySelectorAll(selector).length).toBe(0);
    }
    overlay.querySelectorAll("[tabindex]").forEach((el) => {
      expect(Number(el.getAttribute("tabindex"))).toBeLessThanOrEqual(0);
    });
    expect(overlay.getAttribute("aria-hidden")).toBe("true");
  });
});
