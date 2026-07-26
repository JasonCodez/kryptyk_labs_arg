/** @jest-environment jsdom */

import { act, cleanup, render, screen } from "@testing-library/react";
import AppSplashScreen from "./AppSplashScreen";
import { APP_LAUNCH_VERSION, APP_LAUNCH_VERSION_KEY } from "@/lib/appLaunch";
import { APP_LAUNCH_BOOTSTRAP_SCRIPT } from "@/lib/appLaunchBootstrap";

const NATIVE_HANDOFF_BUFFER_MS = 700;
const MAX_HANDOFF_WAIT_MS = 5000;

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

function setUrl(pathname: string, search = "") {
  window.history.pushState({}, "", pathname + search);
}

function setStoredVersion(version: string | null) {
  if (version === null) {
    window.localStorage.removeItem(APP_LAUNCH_VERSION_KEY);
  } else {
    window.localStorage.setItem(APP_LAUNCH_VERSION_KEY, version);
  }
}

function setReadyState(state: DocumentReadyState) {
  Object.defineProperty(document, "readyState", { value: state, configurable: true });
}

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", { value: state, configurable: true });
}

function dispatchLoad() {
  act(() => {
    window.dispatchEvent(new Event("load"));
  });
}

function dispatchVisibilityChange() {
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

/** Advances timers far enough to clear both mocked rAF hops plus the full native-handoff buffer. */
function runHandoffBufferToCompletion() {
  act(() => {
    jest.advanceTimersByTime(NATIVE_HANDOFF_BUFFER_MS + 50);
  });
}

/** Standard happy-path sequence: dispatch load (document already visible/complete) and run the buffer. */
function completeHandoff() {
  dispatchLoad();
  runHandoffBufferToCompletion();
}

function runBootstrapScript() {
  new Function(APP_LAUNCH_BOOTSTRAP_SCRIPT)();
}

beforeEach(() => {
  jest.useFakeTimers();
  window.requestAnimationFrame = ((cb: FrameRequestCallback) => {
    return setTimeout(() => cb(performance.now()), 0) as unknown as number;
  }) as typeof window.requestAnimationFrame;
  window.cancelAnimationFrame = ((id: number) => clearTimeout(id)) as typeof window.cancelAnimationFrame;
  window.localStorage.clear();
  window.sessionStorage.clear();
  document.documentElement.removeAttribute("data-reduce-animations");
  document.documentElement.removeAttribute("data-pw-launch");
  delete (window as unknown as { __PW_APP_LAUNCH_PLAYED__?: boolean }).__PW_APP_LAUNCH_PLAYED__;
  delete (window as unknown as { __PW_APP_LAUNCH_BOOTSTRAP_TIMEOUT__?: unknown }).__PW_APP_LAUNCH_BOOTSTRAP_TIMEOUT__;
  setUrl("/", "?source=pwa");
  setReadyState("complete");
  setVisibility("visible");
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
  delete (window as unknown as { __PW_APP_LAUNCH_PLAYED__?: boolean }).__PW_APP_LAUNCH_PLAYED__;
  setUrl("/", "");
  jest.restoreAllMocks();
});

describe("AppSplashScreen — real-device regression: standalone is not a gate", () => {
  it("/?source=pwa is eligible even when display-mode: standalone is false", () => {
    setUrl("/", "?source=pwa");
    installMatchMedia({ standalone: false });
    render(<AppSplashScreen />);

    const overlay = screen.getByTestId("app-launch-sequence");
    expect(overlay.getAttribute("data-launch-stage")).toBe("handoff");
    expect(overlay.getAttribute("data-launch-mode")).not.toBe("none");

    completeHandoff();
    expect(screen.getByTestId("app-launch-sequence").getAttribute("data-launch-stage")).toBe("playing");
  });

  it("normal root URL has no overlay", () => {
    setUrl("/", "");
    installMatchMedia({ standalone: false });
    render(<AppSplashScreen />);
    expect(screen.queryByTestId("app-launch-sequence")).toBeNull();
  });
});

describe("AppSplashScreen — sessionStorage is fully retired", () => {
  it("an old session marker has no suppressing effect, and sessionStorage is never read or written", () => {
    window.sessionStorage.setItem("pw_app_launch_session", "1");
    const beforeSnapshot = JSON.stringify(window.sessionStorage);

    render(<AppSplashScreen />);
    completeHandoff();

    expect(screen.getByTestId("app-launch-sequence").getAttribute("data-launch-stage")).toBe("playing");
    // sessionStorage content is byte-for-byte unchanged — nothing in the
    // component reads or writes it.
    expect(JSON.stringify(window.sessionStorage)).toBe(beforeSnapshot);
    expect(window.sessionStorage.getItem("pw_app_launch_session")).toBe("1");
  });
});

describe("AppSplashScreen — version bump", () => {
  it("stored version 1 resolves full mode under version 2", () => {
    setStoredVersion("1");
    render(<AppSplashScreen />);
    completeHandoff();
    expect(screen.getByTestId("app-launch-sequence").getAttribute("data-launch-mode")).toBe("full");
    expect(APP_LAUNCH_VERSION).toBe("2");
  });
});

describe("AppSplashScreen — playback does not start during hydration", () => {
  it("stage stays handoff, static logo visible, nothing animated, nothing persisted before load", () => {
    render(<AppSplashScreen />);

    const overlay = screen.getByTestId("app-launch-sequence");
    expect(overlay.getAttribute("data-launch-stage")).toBe("handoff");
    expect(screen.getByTestId("app-launch-logo")).toBeTruthy();
    expect(screen.queryByTestId("app-launch-tiles")).toBeNull();
    expect(screen.queryByTestId("app-launch-sweep")).toBeNull();
    expect(screen.queryByTestId("app-launch-tagline")).toBeNull();

    expect(window.localStorage.getItem(APP_LAUNCH_VERSION_KEY)).toBeNull();
    expect((window as unknown as { __PW_APP_LAUNCH_PLAYED__?: boolean }).__PW_APP_LAUNCH_PLAYED__).not.toBe(true);
  });
});

describe("AppSplashScreen — load plus native-handoff buffer", () => {
  it("stays in handoff before the buffer elapses, then plays after load + 2 rAF + buffer", () => {
    render(<AppSplashScreen />);
    dispatchLoad();

    act(() => {
      jest.advanceTimersByTime(NATIVE_HANDOFF_BUFFER_MS - 200);
    });
    expect(screen.getByTestId("app-launch-sequence").getAttribute("data-launch-stage")).toBe("handoff");

    act(() => {
      jest.advanceTimersByTime(250);
    });

    const overlay = screen.getByTestId("app-launch-sequence");
    expect(overlay.getAttribute("data-launch-stage")).toBe("playing");
    expect((window as unknown as { __PW_APP_LAUNCH_PLAYED__?: boolean }).__PW_APP_LAUNCH_PLAYED__).toBe(true);
    expect(window.localStorage.getItem(APP_LAUNCH_VERSION_KEY)).toBe(APP_LAUNCH_VERSION);
    expect(screen.getByTestId("app-launch-tiles")).toBeTruthy();
  });
});

describe("AppSplashScreen — document hidden", () => {
  it("does not begin playback while hidden; resumes once visible", () => {
    setVisibility("hidden");
    render(<AppSplashScreen />);
    dispatchLoad();
    runHandoffBufferToCompletion();

    expect(screen.getByTestId("app-launch-sequence").getAttribute("data-launch-stage")).toBe("handoff");

    setVisibility("visible");
    dispatchVisibilityChange();
    runHandoffBufferToCompletion();

    expect(screen.getByTestId("app-launch-sequence").getAttribute("data-launch-stage")).toBe("playing");
  });
});

describe("AppSplashScreen — document already complete", () => {
  it("still waits through two animation frames and the full handoff buffer", () => {
    setReadyState("complete");
    setVisibility("visible");
    render(<AppSplashScreen />);

    act(() => {
      jest.advanceTimersByTime(NATIVE_HANDOFF_BUFFER_MS - 200);
    });
    expect(screen.getByTestId("app-launch-sequence").getAttribute("data-launch-stage")).toBe("handoff");

    act(() => {
      jest.advanceTimersByTime(250);
    });
    expect(screen.getByTestId("app-launch-sequence").getAttribute("data-launch-stage")).toBe("playing");
  });
});

describe("AppSplashScreen — unmount before playback", () => {
  it("clears listeners/timers, never marks played or persists version, restores body styles, sets skip", () => {
    const originalOverflow = document.body.style.overflow;
    const { unmount } = render(<AppSplashScreen />);
    expect(document.body.style.overflow).toBe("hidden");
    document.documentElement.dataset.pwLaunch = "pending";

    unmount();

    expect((window as unknown as { __PW_APP_LAUNCH_PLAYED__?: boolean }).__PW_APP_LAUNCH_PLAYED__).not.toBe(true);
    expect(window.localStorage.getItem(APP_LAUNCH_VERSION_KEY)).toBeNull();
    expect(document.body.style.overflow).toBe(originalOverflow);
    expect(document.documentElement.dataset.pwLaunch).toBe("skip");

    // Dispatching load after unmount must not throw or do anything further.
    expect(() => dispatchLoad()).not.toThrow();
  });
});

describe("AppSplashScreen — waiting-stage failsafe", () => {
  it("releases the overlay after 5s if load never arrives, without marking played or persisting", () => {
    // Never dispatch "load" — simulate a document that never finishes
    // loading, so the handoff-wait effect is genuinely stuck waiting.
    setReadyState("loading");
    render(<AppSplashScreen />);

    act(() => {
      jest.advanceTimersByTime(MAX_HANDOFF_WAIT_MS + 400);
    });

    expect(screen.queryByTestId("app-launch-sequence")).toBeNull();
    expect((window as unknown as { __PW_APP_LAUNCH_PLAYED__?: boolean }).__PW_APP_LAUNCH_PLAYED__).not.toBe(true);
    expect(window.localStorage.getItem(APP_LAUNCH_VERSION_KEY)).toBeNull();
  });
});

describe("AppSplashScreen — same-document replay prevention", () => {
  it("a second mount in the same window after a completed launch resolves to none", () => {
    const first = render(<AppSplashScreen />);
    completeHandoff();
    expect(screen.getByTestId("app-launch-sequence").getAttribute("data-launch-stage")).toBe("playing");
    first.unmount();

    render(<AppSplashScreen />);
    expect(screen.queryByTestId("app-launch-sequence")).toBeNull();
  });
});

describe("AppSplashScreen — bootstrap safety release", () => {
  it("clears to skip after the no-hydration timeout if hydration never clears it", () => {
    runBootstrapScript();
    expect(document.documentElement.dataset.pwLaunch).toBe("pending");

    act(() => {
      jest.advanceTimersByTime(8100);
    });
    expect(document.documentElement.dataset.pwLaunch).toBe("skip");
  });

  it("hydration (component mount) clears the bootstrap safety timeout", () => {
    runBootstrapScript();
    render(<AppSplashScreen />);

    act(() => {
      jest.advanceTimersByTime(8100);
    });
    // Attribute may still legitimately be "pending" this whole time (still in
    // handoff) — the point is the bootstrap's OWN forced-skip timer didn't
    // fire and stomp over the component's own control of the attribute.
    expect(document.documentElement.dataset.pwLaunch).toBe("pending");
  });
});

describe("AppSplashScreen — logo continuity", () => {
  it("exactly one logo element exists across handoff and playing, with stable dimensions", () => {
    render(<AppSplashScreen />);
    const handoffLogo = screen.getByTestId("app-launch-logo");
    const handoffRect = { width: handoffLogo.style.width, height: handoffLogo.style.height };

    completeHandoff();

    expect(screen.getAllByTestId("app-launch-logo")).toHaveLength(1);
    const playingLogo = screen.getByTestId("app-launch-logo");
    expect(playingLogo).toBe(handoffLogo);
    expect({ width: playingLogo.style.width, height: playingLogo.style.height }).toEqual(handoffRect);
  });
});

describe("AppSplashScreen — full sequence", () => {
  it("plays tiles, sweep, tagline, spinner, rotating message, and exits within the full hard maximum", () => {
    render(<AppSplashScreen />);
    completeHandoff();

    const overlay = screen.getByTestId("app-launch-sequence");
    expect(overlay.getAttribute("data-launch-mode")).toBe("full");
    expect(screen.getByTestId("app-launch-tiles")).toBeTruthy();
    expect(screen.getByTestId("app-launch-tagline").textContent).toContain("CLASSIC PUZZLES. MODERN COMPETITION.");
    expect(screen.queryByTestId("app-launch-segments")).toBeNull();
    expect(screen.getByTestId("app-launch-spinner")).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(800);
    });
    const firstMessage = screen.getByTestId("app-launch-message").textContent;
    expect(firstMessage).toBeTruthy();

    act(() => {
      // MESSAGE_INTERVAL_MS in the component — kept as a literal here rather
      // than importing an internal constant.
      jest.advanceTimersByTime(950);
    });
    const secondMessage = screen.getByTestId("app-launch-message").textContent;
    expect(secondMessage).toBeTruthy();
    expect(secondMessage).not.toBe(firstMessage);

    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(screen.queryByTestId("app-launch-sequence")).toBeNull();
  });
});

describe("AppSplashScreen — compact sequence", () => {
  it("skips tile assembly, still shows spinner + rotating message, and exits within the compact hard maximum", () => {
    setStoredVersion(APP_LAUNCH_VERSION);
    render(<AppSplashScreen />);
    completeHandoff();

    const overlay = screen.getByTestId("app-launch-sequence");
    expect(overlay.getAttribute("data-launch-mode")).toBe("compact");
    expect(screen.queryByTestId("app-launch-tiles")).toBeNull();
    expect(screen.getByTestId("app-launch-logo")).toBeTruthy();
    expect(screen.queryByTestId("app-launch-segments")).toBeNull();

    act(() => {
      jest.advanceTimersByTime(400);
    });
    expect(screen.getByTestId("app-launch-spinner")).toBeTruthy();
    expect(screen.getByTestId("app-launch-message")).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(screen.queryByTestId("app-launch-sequence")).toBeNull();
  });
});

describe("AppSplashScreen — reduced-motion sequence", () => {
  it("static logo/tagline, no tiles, no sweep, no spinner, no message, exits within the reduced hard maximum", () => {
    installMatchMedia({ reducedMotion: true });
    document.documentElement.setAttribute("data-reduce-animations", "true");
    render(<AppSplashScreen />);
    completeHandoff();

    const overlay = screen.getByTestId("app-launch-sequence");
    expect(overlay.getAttribute("data-launch-mode")).toBe("reduced");
    expect(screen.queryByTestId("app-launch-tiles")).toBeNull();
    expect(screen.queryByTestId("app-launch-sweep")).toBeNull();
    expect(screen.queryByTestId("app-launch-segments")).toBeNull();
    expect(screen.queryByTestId("app-launch-spinner")).toBeNull();
    expect(screen.queryByTestId("app-launch-message")).toBeNull();
    expect(screen.getByTestId("app-launch-tagline")).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(1100);
    });
    expect(screen.queryByTestId("app-launch-sequence")).toBeNull();
  });
});

describe("AppSplashScreen — local-storage failure", () => {
  it("falls back to compact mode, never full, and never throws", () => {
    const getSpy = jest.spyOn(Storage.prototype, "getItem").mockImplementation((key: string) => {
      if (key === APP_LAUNCH_VERSION_KEY) throw new Error("local storage unavailable");
      return null;
    });

    expect(() => render(<AppSplashScreen />)).not.toThrow();
    completeHandoff();
    expect(screen.getByTestId("app-launch-sequence").getAttribute("data-launch-mode")).toBe("compact");

    getSpy.mockRestore();
  });
});

describe("AppSplashScreen — HTML attribute cleanup", () => {
  it("becomes skip after normal removal, never skip while pending playback", () => {
    setStoredVersion(APP_LAUNCH_VERSION);
    render(<AppSplashScreen />);
    completeHandoff();

    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(document.documentElement.dataset.pwLaunch).toBe("skip");
  });

  it("becomes skip immediately when the resolver returns none", () => {
    setUrl("/", "");
    render(<AppSplashScreen />);
    expect(document.documentElement.dataset.pwLaunch).toBe("skip");
  });
});

describe("AppSplashScreen — no client-rendered script", () => {
  it("renders no script element and triggers no React script-tag warning", () => {
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    try {
      render(<AppSplashScreen />);

      const overlay = screen.getByTestId("app-launch-sequence");
      expect(overlay.querySelectorAll("script").length).toBe(0);
      expect(document.querySelectorAll("#pw-launch-bootstrap").length).toBe(0);

      const offendingCall = consoleErrorSpy.mock.calls.find((args) =>
        args.some((arg) => typeof arg === "string" && arg.includes("Encountered a script tag while rendering React component"))
      );
      expect(offendingCall).toBeUndefined();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});

describe("AppSplashScreen — scroll lock and accessibility", () => {
  it("locks scroll while visible and restores on unmount", () => {
    const originalOverflow = document.body.style.overflow;
    const { unmount } = render(<AppSplashScreen />);
    expect(document.body.style.overflow).toBe("hidden");
    unmount();
    expect(document.body.style.overflow).toBe(originalOverflow);
  });

  it("contains no focusable controls", () => {
    render(<AppSplashScreen />);
    const overlay = screen.getByTestId("app-launch-sequence");
    for (const selector of ["a", "button", "input", "select", "textarea"]) {
      expect(overlay.querySelectorAll(selector).length).toBe(0);
    }
    expect(overlay.getAttribute("aria-hidden")).toBe("true");
  });
});
