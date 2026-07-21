import { APP_LAUNCH_VERSION, resolveAppLaunchMode } from "./appLaunch";

const BASE = {
  launchCandidate: true,
  alreadyPlayedInDocument: false,
  storedVersion: null as string | null,
  localStorageAvailable: true,
  reducedMotion: false,
};

describe("resolveAppLaunchMode", () => {
  it("non-candidate returns none", () => {
    expect(resolveAppLaunchMode({ ...BASE, launchCandidate: false })).toBe("none");
  });

  it("already played in this document returns none", () => {
    expect(resolveAppLaunchMode({ ...BASE, alreadyPlayedInDocument: true })).toBe("none");
  });

  it("reduced motion returns reduced", () => {
    expect(resolveAppLaunchMode({ ...BASE, reducedMotion: true })).toBe("reduced");
  });

  it("local storage unavailable returns compact", () => {
    expect(resolveAppLaunchMode({ ...BASE, localStorageAvailable: false })).toBe("compact");
  });

  it("missing stored version returns full", () => {
    expect(resolveAppLaunchMode({ ...BASE, storedVersion: null })).toBe("full");
  });

  it("old stored version returns full", () => {
    expect(resolveAppLaunchMode({ ...BASE, storedVersion: "1" })).toBe("full");
  });

  it('stored version "2" returns compact', () => {
    expect(resolveAppLaunchMode({ ...BASE, storedVersion: APP_LAUNCH_VERSION })).toBe("compact");
    expect(APP_LAUNCH_VERSION).toBe("2");
  });

  it("reduced motion takes priority over local-storage failure", () => {
    expect(
      resolveAppLaunchMode({ ...BASE, reducedMotion: true, localStorageAvailable: false })
    ).toBe("reduced");
  });

  it("already-played takes priority over reduced motion", () => {
    expect(
      resolveAppLaunchMode({ ...BASE, alreadyPlayedInDocument: true, reducedMotion: true })
    ).toBe("none");
  });

  it("standalone mode is no longer an accepted input", () => {
    // @ts-expect-error — standalone must not exist on AppLaunchInputs anymore.
    resolveAppLaunchMode({ ...BASE, standalone: true });
  });

  it("session storage is no longer an accepted input", () => {
    // @ts-expect-error — sessionSeen/sessionStorageAvailable must not exist
    // on AppLaunchInputs anymore.
    resolveAppLaunchMode({ ...BASE, sessionSeen: false, sessionStorageAvailable: true });
  });
});
