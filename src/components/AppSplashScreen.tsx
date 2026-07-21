"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Type, Grid3X3, Hash, Puzzle } from "lucide-react";
import { useAppReducedMotion } from "@/hooks/useAppReducedMotion";
import { prefersReducedMotion } from "@/lib/juice/prefs";
import { APP_LAUNCH_VERSION, APP_LAUNCH_VERSION_KEY, resolveAppLaunchMode, type AppLaunchMode } from "@/lib/appLaunch";

/**
 * "The Puzzle Forge" — the branded launch sequence for a genuine root PWA
 * launch (/?source=pwa). Internal concept name only; never shown to users.
 *
 * Scoped entirely to the homepage by virtue of only ever being rendered from
 * HomeClient — there is no server-known "is this a launch" signal (the
 * homepage route is static), so candidacy is decided entirely in the
 * browser, both by the pre-paint bootstrap script below and by this
 * component's own hydrated effect, using the exact same URL-only rule.
 *
 * `display-mode: standalone` and `navigator.standalone` are deliberately NOT
 * used to gate eligibility — real installed-TWA testing showed that signal
 * cannot be trusted to identify a genuine app launch reliably. The
 * `?source=pwa` URL the Android wrapper already opens is a sufficient and
 * far more reliable signal on its own.
 *
 * Playback never begins during hydration — an explicit `LaunchStage` model
 * (see below) holds a single, persistent, already-visible static logo
 * through "resolving" and "handoff" and only starts the puzzle-tile/sweep/
 * tagline animation once the browser has actually loaded, is visible, and a
 * short native-handoff buffer has elapsed — because the Android native
 * splash can still be covering the page for a short time after hydration
 * completes.
 */

type LaunchStage = "resolving" | "handoff" | "playing" | "exiting" | "finished";

const TILES = [
  { Icon: Type, label: "Word play" },
  { Icon: Grid3X3, label: "Grid play" },
  { Icon: Hash, label: "Crossword play" },
  { Icon: Puzzle, label: "Jigsaw play" },
];

// The Android wrapper's native splash fade is ~300ms. This buffer runs AFTER
// window `load` and AFTER two animation frames (so the browser has actually
// painted at least once), giving the native layer enough margin to finish
// removing itself, plus at least one guaranteed visible static-logo frame,
// before the web animation takes over. A single named constant (not an
// unexplained literal) in the middle of the 650-800ms range called for.
const NATIVE_HANDOFF_BUFFER_MS = 700;

// Hard safety ceiling on the whole "resolving/handoff" wait: if window load
// or visibility never resolves the way a normal launch would, the player
// must never be trapped behind a static logo indefinitely.
const MAX_HANDOFF_WAIT_MS = 5000;

// Timings below are all measured from the moment `playing` begins, not from
// component mount — the load wait and native-handoff buffer are excluded by
// construction, matching the requirement that visible-playback timers must
// never start counting during hydration or the native handoff.
const FULL_PLAYING_TIMING = {
  settleDelay: 350, // 300-450ms window: logo settle pulse + start of sweep
  sweepDelay: 420,
  taglineDelay: 720, // 650-800ms window
  exitDelay: 1850, // 1750-1950ms window
  removeDelay: 2150, // 2050-2250ms window
  hardTimeout: 2500,
};

const COMPACT_PLAYING_TIMING = {
  sweepDelay: 0,
  taglineDelay: 120,
  exitDelay: 880, // 800-950ms window
  removeDelay: 1150, // 1050-1200ms window
  hardTimeout: 1400,
};

const REDUCED_PLAYING_TIMING = {
  exitDelay: 450,
  removeDelay: 800, // 700-900ms window
  hardTimeout: 1100,
};

// A valid root PWA launch is exactly "/" with a literal ?source=pwa — deep
// links like /daily?source=pwa are intentional app shortcuts and must never
// be swept in. Shared verbatim between the pre-paint bootstrap script below
// and the hydrated resolver so the two can never disagree about candidacy.
// Deliberately URL-only: display-mode/navigator.standalone are not read here
// because real-device testing showed they cannot be trusted to gate a
// genuine TWA launch.
function readLaunchCandidate(): boolean {
  try {
    if (window.location.pathname !== "/") return false;
    return new URLSearchParams(window.location.search).get("source") === "pwa";
  } catch {
    return false;
  }
}

// Document-lifetime replay guard — deliberately NOT sessionStorage.
// Trusted Web Activity and Chrome process/tab reuse make sessionStorage an
// unreliable proxy for "has a launch already been shown"; a plain in-memory
// flag on `window` is exact for exactly what it needs to be exact about: has
// visible playback already happened in *this* loaded document.
type LaunchWindow = Window & { __PW_APP_LAUNCH_PLAYED__?: boolean };

function readAlreadyPlayedInDocument(): boolean {
  try {
    return (window as LaunchWindow).__PW_APP_LAUNCH_PLAYED__ === true;
  } catch {
    return false;
  }
}

function markPlayedInDocument() {
  try {
    (window as LaunchWindow).__PW_APP_LAUNCH_PLAYED__ = true;
  } catch {
    // ignore
  }
}

function readStoredVersion(): { version: string | null; available: boolean } {
  try {
    return { version: localStorage.getItem(APP_LAUNCH_VERSION_KEY), available: true };
  } catch {
    return { version: null, available: false };
  }
}

function persistLaunchVersion() {
  try {
    localStorage.setItem(APP_LAUNCH_VERSION_KEY, APP_LAUNCH_VERSION);
  } catch {
    // ignore — worst case future launches stay in compact mode
  }
}

function markLaunchSkipped() {
  try {
    document.documentElement.dataset.pwLaunch = "skip";
  } catch {
    // ignore
  }
}

type BootstrapWindow = Window & { __PW_APP_LAUNCH_BOOTSTRAP_TIMEOUT__?: ReturnType<typeof setTimeout> };

function clearBootstrapFailsafe() {
  try {
    const timeoutId = (window as BootstrapWindow).__PW_APP_LAUNCH_BOOTSTRAP_TIMEOUT__;
    if (timeoutId) clearTimeout(timeoutId);
  } catch {
    // ignore
  }
}

// Inline, synchronous pre-paint bootstrap: written into the initial HTML
// stream so it executes (and blocks parsing) before the rest of the document
// is parsed or painted. It only ever writes one narrowly-scoped attribute —
// no fetch, no auth, no session/local storage read, no display-mode check —
// so an eligible URL shows the overlay's static first frame immediately
// instead of the homepage flashing through first.
//
// Also arms an 8-second no-hydration failsafe: if the React component never
// takes over (a JS failure, a slow/broken bundle), the player must not stay
// trapped behind the static logo forever. AppSplashScreen clears this timer
// itself the moment its own hydration effect runs.
//
// Exported (test-only use) so its exact behavior can be unit-tested directly
// by evaluating the string, rather than only trusting a description of what
// it's supposed to do.
export const BOOTSTRAP_SCRIPT = `(function(){try{var candidate=false;try{candidate=window.location.pathname==='/'&&new URLSearchParams(window.location.search).get('source')==='pwa';}catch(e){}document.documentElement.dataset.pwLaunch=candidate?'pending':'skip';if(candidate){window.__PW_APP_LAUNCH_BOOTSTRAP_TIMEOUT__=setTimeout(function(){try{document.documentElement.dataset.pwLaunch='skip';}catch(e){}},8000);}}catch(e){try{document.documentElement.dataset.pwLaunch='skip';}catch(e2){}}})();`;

export default function AppSplashScreen() {
  const reducedMotion = useAppReducedMotion();
  const [mode, setMode] = useState<AppLaunchMode | null>(null);
  const [stage, setStage] = useState<LaunchStage>("resolving");
  const failsafeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollLockRef = useRef<{ overflow: string; overscrollBehavior: string } | null>(null);

  const beginExit = (fadeMs: number) => {
    setStage("exiting");
    setTimeout(() => {
      markLaunchSkipped();
      setStage("finished");
    }, fadeMs);
  };

  // EFFECT A — resolve eligibility once, before the browser's next paint
  // after hydration (useLayoutEffect, not useEffect), and arm the overall
  // handoff-wait failsafe.
  useLayoutEffect(() => {
    clearBootstrapFailsafe();

    const launchCandidate = readLaunchCandidate();
    const alreadyPlayedInDocument = readAlreadyPlayedInDocument();
    const { version: storedVersion, available: localStorageAvailable } = readStoredVersion();
    // Read the accessibility signal directly (rather than trusting the
    // closed-over hook value) — useAppReducedMotion's client value can lag
    // one passive-effect tick behind its SSR-safe server snapshot, and the
    // mode decision below must not race that correction.
    const reducedMotionNow = reducedMotion || prefersReducedMotion();
    const resolved = resolveAppLaunchMode({
      launchCandidate,
      alreadyPlayedInDocument,
      storedVersion,
      localStorageAvailable,
      reducedMotion: reducedMotionNow,
    });

    if (resolved === "none") {
      markLaunchSkipped();
      setMode("none");
      return;
    }

    setMode(resolved);
    setStage("handoff");

    failsafeTimer.current = setTimeout(() => {
      // Playback never started in time — release the static overlay rather
      // than beginning the full animation late or trapping the player.
      beginExit(350);
    }, MAX_HANDOFF_WAIT_MS);

    return () => {
      if (failsafeTimer.current) clearTimeout(failsafeTimer.current);
      // True-unmount cleanup (e.g. client-side navigation away mid-sequence)
      // — never leave a stale "pending" attribute behind, and never mark the
      // launch as played/persisted if it never actually played.
      markLaunchSkipped();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // EFFECT B — while in "handoff", wait for the page to actually be loaded
  // AND visible, then run two animation frames plus the native-handoff
  // buffer, then begin visible playback. Never gated on the Daily summary
  // API, auth, Continue Playing, the service worker, or anything else
  // outside the launch overlay itself.
  useLayoutEffect(() => {
    if (stage !== "handoff") return;

    let cancelled = false;
    const cleanups: Array<() => void> = [];
    const localTimers: ReturnType<typeof setTimeout>[] = [];

    const beginPlaying = () => {
      if (cancelled) return;
      if (failsafeTimer.current) {
        clearTimeout(failsafeTimer.current);
        failsafeTimer.current = null;
      }
      markPlayedInDocument();
      persistLaunchVersion();
      setStage("playing");
    };

    const runHandoffBuffer = () => {
      if (cancelled) return;
      requestAnimationFrame(() => {
        if (cancelled) return;
        requestAnimationFrame(() => {
          if (cancelled) return;
          const t = setTimeout(beginPlaying, NATIVE_HANDOFF_BUFFER_MS);
          localTimers.push(t);
        });
      });
    };

    const checkReadyAndWait = () => {
      if (cancelled) return;
      if (document.readyState !== "complete") {
        const onLoad = () => {
          window.removeEventListener("load", onLoad);
          checkReadyAndWait();
        };
        window.addEventListener("load", onLoad);
        cleanups.push(() => window.removeEventListener("load", onLoad));
        return;
      }
      if (document.visibilityState === "hidden") {
        const onVisible = () => {
          if (document.visibilityState !== "hidden") {
            document.removeEventListener("visibilitychange", onVisible);
            checkReadyAndWait();
          }
        };
        document.addEventListener("visibilitychange", onVisible);
        cleanups.push(() => document.removeEventListener("visibilitychange", onVisible));
        return;
      }
      runHandoffBuffer();
    };

    checkReadyAndWait();

    return () => {
      cancelled = true;
      cleanups.forEach((fn) => fn());
      localTimers.forEach(clearTimeout);
    };
  }, [stage]);

  // EFFECT C — playback timers. Never scheduled until stage is "playing".
  useLayoutEffect(() => {
    if (stage !== "playing" || mode === null || mode === "none") return;

    const timing = mode === "full" ? FULL_PLAYING_TIMING : mode === "compact" ? COMPACT_PLAYING_TIMING : REDUCED_PLAYING_TIMING;
    const exitTimer = setTimeout(() => beginExit(350), timing.exitDelay);
    const removeTimer = setTimeout(() => {
      markLaunchSkipped();
      setStage("finished");
    }, timing.removeDelay);
    // Hard timeout: guarantees removal even if an animation/timer callback
    // above never fires for any reason.
    const hardTimer = setTimeout(() => {
      markLaunchSkipped();
      setStage("finished");
    }, timing.hardTimeout);

    return () => {
      clearTimeout(exitTimer);
      clearTimeout(removeTimer);
      clearTimeout(hardTimer);
    };
  }, [stage, mode]);

  // Scroll lock while any overlay content is actually visible.
  useLayoutEffect(() => {
    const visible = mode !== null && mode !== "none" && stage !== "finished";
    if (!visible) return;

    if (!scrollLockRef.current) {
      scrollLockRef.current = {
        overflow: document.body.style.overflow,
        overscrollBehavior: document.body.style.overscrollBehavior,
      };
      document.body.style.overflow = "hidden";
      document.body.style.overscrollBehavior = "contain";
    }

    return () => {
      if (scrollLockRef.current) {
        document.body.style.overflow = scrollLockRef.current.overflow;
        document.body.style.overscrollBehavior = scrollLockRef.current.overscrollBehavior;
        scrollLockRef.current = null;
      }
    };
  }, [mode, stage]);

  // Definitively ineligible, or the sequence has fully completed/failsafed —
  // remove the whole overlay, script included, from the DOM.
  if (mode === "none" || stage === "finished") return null;

  const resolvedMode: AppLaunchMode = mode ?? "compact";
  const playing = stage === "playing" || stage === "exiting";
  const showTiles = playing && resolvedMode === "full";
  const showTagline = playing;
  const showSweep = playing && resolvedMode !== "reduced";
  const settled = playing && resolvedMode === "full";
  const animateSegments = resolvedMode === "full";
  const exiting = stage === "exiting";

  const sweepDelayMs = resolvedMode === "full" ? FULL_PLAYING_TIMING.sweepDelay : resolvedMode === "compact" ? COMPACT_PLAYING_TIMING.sweepDelay : 0;
  const settleDelayMs = resolvedMode === "full" ? FULL_PLAYING_TIMING.settleDelay : 0;
  const taglineDelayMs = resolvedMode === "full" ? FULL_PLAYING_TIMING.taglineDelay : resolvedMode === "compact" ? COMPACT_PLAYING_TIMING.taglineDelay : 0;

  return (
    <>
      {/* Pre-paint bootstrap: always emitted (this component only ever
          mounts on the homepage) — decides "pending" vs "skip" itself,
          entirely client-side and URL-only, before hydration. */}
      <script id="pw-launch-bootstrap" dangerouslySetInnerHTML={{ __html: BOOTSTRAP_SCRIPT }} />
      <style>{`
        html[data-pw-launch="pending"] [data-pw-launch-root] { display: flex !important; }
        @keyframes pw-launch-sweep {
          0%   { transform: translateX(-130%) skewX(-12deg); opacity: 0; }
          15%  { opacity: 1; }
          100% { transform: translateX(130%) skewX(-12deg); opacity: 0; }
        }
        @keyframes pw-launch-settle {
          0%   { transform: scale(1); }
          50%  { transform: scale(1.035); }
          100% { transform: scale(1); }
        }
      `}</style>
      <div
        data-pw-launch-root
        data-testid="app-launch-sequence"
        data-launch-mode={mode ?? "resolving"}
        data-launch-stage={stage}
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          display: "none",
          padding:
            "max(24px, env(safe-area-inset-top, 0px)) max(24px, env(safe-area-inset-right, 0px)) max(24px, env(safe-area-inset-bottom, 0px)) max(24px, env(safe-area-inset-left, 0px))",
          background: "var(--pw-bg-base)",
          opacity: exiting ? 0 : 1,
          transform: exiting ? "translateY(-6px)" : "translateY(0)",
          transition: exiting ? "opacity 0.35s ease, transform 0.35s ease" : undefined,
          pointerEvents: exiting ? "none" : "auto",
          overflow: "hidden",
        }}
      >
        {/* Base glow layer — restrained, static, no particle field. */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(560px 360px at 50% 38%, color-mix(in srgb, var(--pw-brand-primary) 16%, transparent), transparent 65%), radial-gradient(480px 320px at 78% 78%, color-mix(in srgb, var(--pw-brand-secondary) 7%, transparent), transparent 60%)",
            pointerEvents: "none",
          }}
        />

        {/* A single persistent logo box, pinned to the overlay's true center
            via its own absolute positioning — deliberately NOT a flex
            sibling of the tagline. A shared "center the whole group" flex
            layout would re-center (and visibly shift) the logo the instant
            the tagline mounts; anchoring the logo independently guarantees
            its center never moves regardless of what else mounts around it.
            Puzzle tiles are likewise absolutely positioned above it (out of
            normal flow) so inserting them at "playing" cannot push it either. */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "clamp(96px, 22vw, 148px)",
            aspectRatio: "1 / 1",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {showTiles && (
            <div
              data-testid="app-launch-tiles"
              style={{
                position: "absolute",
                bottom: "calc(100% + 16px)",
                left: "50%",
                transform: "translateX(-50%)",
                display: "flex",
                gap: "clamp(10px, 2.5vw, 16px)",
              }}
            >
              {TILES.map(({ Icon, label }, index) => (
                <motion.div
                  key={label}
                  initial={{ opacity: 0, scale: 0.4, y: index % 2 === 0 ? -16 : 16 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 340, damping: 18, delay: index * 0.07 }}
                  title={label}
                  style={{
                    width: "clamp(42px, 11vw, 54px)",
                    height: "clamp(42px, 11vw, 54px)",
                    borderRadius: 14,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "var(--pw-surface-2)",
                    border: "1px solid var(--pw-border-default)",
                    boxShadow: "inset 0 1px 0 color-mix(in srgb, white 8%, transparent)",
                  }}
                >
                  <Icon
                    aria-hidden="true"
                    size={22}
                    strokeWidth={2.25}
                    style={{ color: index === 2 ? "var(--pw-brand-accent)" : "var(--pw-brand-primary)" }}
                  />
                </motion.div>
              ))}
            </div>
          )}

          <div
            data-testid="app-launch-logo"
            style={{
              position: "relative",
              width: "100%",
              height: "100%",
              filter: "drop-shadow(0 8px 24px color-mix(in srgb, var(--pw-brand-primary) 35%, transparent))",
              animation: settled ? `pw-launch-settle 0.5s ease ${settleDelayMs}ms 1 both` : undefined,
            }}
          >
            <img
              src="/images/puzzle_warz_logo.png"
              alt="PuzzleWarz"
              width={148}
              height={148}
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
            />
            {showSweep && (
              <div
                data-testid="app-launch-sweep"
                aria-hidden="true"
                style={{
                  position: "absolute",
                  inset: 0,
                  overflow: "hidden",
                  borderRadius: 12,
                  pointerEvents: "none",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    bottom: 0,
                    width: "40%",
                    background:
                      "linear-gradient(75deg, transparent, color-mix(in srgb, white 55%, transparent), transparent)",
                    animation: `pw-launch-sweep 0.9s ease-out ${sweepDelayMs}ms 1 both`,
                  }}
                />
              </div>
            )}
          </div>
        </div>

        {showTagline && (
          // Static positioning wrapper (never touched by Framer Motion) is
          // deliberately separate from the animated inner motion.div —
          // Framer Motion owns the `transform` CSS property on any element
          // it animates x/y on, which would silently clobber a manually-set
          // `translateX(-50%)` centering transform on the same element.
          <div
            style={{
              position: "absolute",
              top: "calc(50% + (clamp(96px, 22vw, 148px) / 2) + 28px)",
              left: "50%",
              transform: "translateX(-50%)",
              width: "min(340px, calc(100vw - 48px))",
            }}
          >
            <motion.div
              data-testid="app-launch-tagline"
              initial={resolvedMode === "reduced" ? { opacity: 1 } : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={resolvedMode === "reduced" ? { duration: 0 } : { duration: 0.5, delay: taglineDelayMs / 1000 }}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}
            >
              <p
                style={{
                  margin: 0,
                  textAlign: "center",
                  color: "var(--pw-text-secondary)",
                  fontSize: "clamp(11px, 3vw, 13px)",
                  fontWeight: 700,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                }}
              >
                CLASSIC PUZZLES. MODERN COMPETITION.
              </p>

              <div data-testid="app-launch-segments" style={{ display: "flex", gap: 6 }}>
                {[0, 1, 2, 3, 4].map((i) => (
                  <motion.div
                    key={i}
                    initial={animateSegments ? { opacity: 0.25 } : { opacity: 1 }}
                    animate={{ opacity: 1 }}
                    transition={
                      animateSegments
                        ? { duration: 0.25, delay: (taglineDelayMs + 120 + i * 90) / 1000 }
                        : { duration: 0 }
                    }
                    style={{
                      width: 22,
                      height: 4,
                      borderRadius: 2,
                      background: "var(--pw-brand-secondary)",
                    }}
                  />
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </>
  );
}
