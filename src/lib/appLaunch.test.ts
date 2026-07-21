import { APP_LAUNCH_VERSION, resolveAppLaunchMode } from "./appLaunch";

const BASE = {
  launchCandidate: true,
  standalone: true,
  sessionSeen: false,
  sessionStorageAvailable: true,
  storedVersion: null as string | null,
  localStorageAvailable: true,
  reducedMotion: false,
};

describe("resolveAppLaunchMode", () => {
  it("non-candidate returns none", () => {
    expect(resolveAppLaunchMode({ ...BASE, launchCandidate: false })).toBe("none");
  });

  it("non-standalone returns none", () => {
    expect(resolveAppLaunchMode({ ...BASE, standalone: false })).toBe("none");
  });

  it("session already seen returns none", () => {
    expect(resolveAppLaunchMode({ ...BASE, sessionSeen: true })).toBe("none");
  });

  it("reduced motion returns reduced", () => {
    expect(resolveAppLaunchMode({ ...BASE, reducedMotion: true })).toBe("reduced");
  });

  it("missing stored version returns full", () => {
    expect(resolveAppLaunchMode({ ...BASE, storedVersion: null })).toBe("full");
  });

  it("old stored version returns full", () => {
    expect(resolveAppLaunchMode({ ...BASE, storedVersion: "0" })).toBe("full");
  });

  it("matching stored version returns compact", () => {
    expect(resolveAppLaunchMode({ ...BASE, storedVersion: APP_LAUNCH_VERSION })).toBe("compact");
  });

  it("reduced motion takes priority over version selection", () => {
    expect(
      resolveAppLaunchMode({ ...BASE, reducedMotion: true, storedVersion: APP_LAUNCH_VERSION })
    ).toBe("reduced");
  });

  it("session-seen takes priority over reduced motion", () => {
    expect(resolveAppLaunchMode({ ...BASE, sessionSeen: true, reducedMotion: true })).toBe("none");
  });

  it("requires both candidate and standalone to be true", () => {
    expect(resolveAppLaunchMode({ ...BASE, launchCandidate: false, standalone: false })).toBe("none");
    expect(resolveAppLaunchMode({ ...BASE, launchCandidate: true, standalone: false })).toBe("none");
    expect(resolveAppLaunchMode({ ...BASE, launchCandidate: false, standalone: true })).toBe("none");
  });

  it("unreadable session storage never suppresses an otherwise-eligible launch, even when a marker would have existed", () => {
    // sessionSeen is meaningless when sessionStorageAvailable is false — the
    // resolver must not use it to silently return "none".
    expect(
      resolveAppLaunchMode({ ...BASE, sessionSeen: true, sessionStorageAvailable: false })
    ).not.toBe("none");
  });

  it("session storage unavailable + normal motion -> compact", () => {
    expect(resolveAppLaunchMode({ ...BASE, sessionStorageAvailable: false })).toBe("compact");
  });

  it("session storage unavailable + reduced motion -> reduced", () => {
    expect(
      resolveAppLaunchMode({ ...BASE, sessionStorageAvailable: false, reducedMotion: true })
    ).toBe("reduced");
  });

  it("local storage unavailable + normal motion -> compact", () => {
    expect(resolveAppLaunchMode({ ...BASE, localStorageAvailable: false })).toBe("compact");
  });

  it("local storage unavailable + normal motion -> compact, never full, even with no stored version", () => {
    expect(
      resolveAppLaunchMode({ ...BASE, localStorageAvailable: false, storedVersion: null })
    ).toBe("compact");
  });

  it("both storages unavailable + normal motion -> compact", () => {
    expect(
      resolveAppLaunchMode({ ...BASE, sessionStorageAvailable: false, localStorageAvailable: false })
    ).toBe("compact");
  });

  it("both storages unavailable + reduced motion -> reduced", () => {
    expect(
      resolveAppLaunchMode({
        ...BASE,
        sessionStorageAvailable: false,
        localStorageAvailable: false,
        reducedMotion: true,
      })
    ).toBe("reduced");
  });
});
