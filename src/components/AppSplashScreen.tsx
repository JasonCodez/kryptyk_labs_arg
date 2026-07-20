"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Type, Grid3X3, Hash, Puzzle } from "lucide-react";
import { useAppReducedMotion } from "@/hooks/useAppReducedMotion";
import { prefersReducedMotion } from "@/lib/juice/prefs";
import {
  APP_LAUNCH_SESSION_KEY,
  APP_LAUNCH_VERSION,
  APP_LAUNCH_VERSION_KEY,
  resolveAppLaunchMode,
  type AppLaunchMode,
} from "@/lib/appLaunch";

/**
 * "The Puzzle Forge" — the branded launch sequence for a genuine root PWA
 * launch (?source=pwa in standalone display mode). Internal concept name
 * only; never shown to users.
 *
 * Timing is a deliberate one-time sequence (see PHASE_TIMING below), not a
 * loading indicator — it never waits on network/session/API state and always
 * exits via its own hard timeout.
 */

type Phase = "entering" | "holding" | "exiting";

const TILES = [
  { Icon: Type, label: "Word play" },
  { Icon: Grid3X3, label: "Grid play" },
  { Icon: Hash, label: "Crossword play" },
  { Icon: Puzzle, label: "Jigsaw play" },
];

const FULL_TIMING = {
  logoDelay: 650,
  taglineDelay: 1050,
  exitDelay: 1800,
  removeDelay: 2100,
  hardTimeout: 2400,
};

const COMPACT_TIMING = {
  logoDelay: 0,
  taglineDelay: 300,
  exitDelay: 650,
  removeDelay: 900,
  hardTimeout: 1100,
};

const REDUCED_TIMING = {
  exitDelay: 300,
  removeDelay: 500,
  hardTimeout: 650,
};

function readStandalone(): boolean {
  try {
    const nav = window.navigator as Navigator & { standalone?: boolean };
    return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
  } catch {
    return false;
  }
}

function readSessionSeen(): boolean {
  try {
    return sessionStorage.getItem(APP_LAUNCH_SESSION_KEY) === "1";
  } catch {
    // Unreadable session storage must never be treated as "already seen" —
    // that would silently and permanently suppress the sequence. Allow one
    // fail-safe presentation instead (downgraded to compact below).
    return false;
  }
}

function readStoredVersion(): { version: string | null; available: boolean } {
  try {
    return { version: localStorage.getItem(APP_LAUNCH_VERSION_KEY), available: true };
  } catch {
    return { version: null, available: false };
  }
}

function persistLaunch() {
  try {
    sessionStorage.setItem(APP_LAUNCH_SESSION_KEY, "1");
  } catch {
    // ignore — worst case the sequence can play again this "session"
  }
  try {
    localStorage.setItem(APP_LAUNCH_VERSION_KEY, APP_LAUNCH_VERSION);
  } catch {
    // ignore — worst case future launches stay in compact mode
  }
}

// Inline, synchronous pre-paint bootstrap: written into the initial HTML
// stream so it executes (and blocks parsing) before the rest of the document
// is parsed or painted. It only ever writes one narrowly-scoped attribute —
// no fetch, no auth, no global styling — so a launch-eligible session shows
// the overlay's static first frame immediately instead of the homepage
// flashing through first. Storage failures resolve to "skip" rather than
// throwing.
const BOOTSTRAP_SCRIPT = `(function(){try{var h=document.documentElement;var standalone=false;try{standalone=window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true;}catch(e){}var seen=true;try{seen=sessionStorage.getItem(${JSON.stringify(
  APP_LAUNCH_SESSION_KEY
)})==='1';}catch(e){}h.dataset.pwLaunch=(standalone&&!seen)?'pending':'skip';}catch(e){try{document.documentElement.dataset.pwLaunch='skip';}catch(e2){}}})();`;

export default function AppSplashScreen({ launchCandidate = false }: { launchCandidate?: boolean }) {
  const reducedMotion = useAppReducedMotion();
  const [mode, setMode] = useState<AppLaunchMode | null>(null);
  const [phase, setPhase] = useState<Phase>("entering");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const scrollLockRef = useRef<{ overflow: string; overscrollBehavior: string } | null>(null);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  // useLayoutEffect (not useEffect) so the real mode is resolved and applied
  // before the browser's next paint after hydration, rather than one frame
  // after — keeps the static pre-paint frame and the JS-driven frame visually
  // continuous instead of flickering between them.
  useLayoutEffect(() => {
    if (!launchCandidate) return;

    const standalone = readStandalone();
    const sessionSeen = readSessionSeen();
    const { version: storedVersion, available: localStorageAvailable } = readStoredVersion();
    // Read the accessibility signal directly (rather than trusting the
    // closed-over hook value) — useAppReducedMotion's client value can lag
    // one passive-effect tick behind its SSR-safe server snapshot, and the
    // mode decision below must not race that correction.
    const reducedMotionNow = reducedMotion || prefersReducedMotion();
    let resolved = resolveAppLaunchMode({
      launchCandidate,
      standalone,
      sessionSeen,
      storedVersion,
      reducedMotion: reducedMotionNow,
    });

    // Unreadable localStorage must never be assumed to mean "first-time
    // visitor" — fall back to the less conspicuous compact treatment.
    if (!localStorageAvailable && resolved === "full") {
      resolved = "compact";
    }

    if (resolved === "none") {
      setMode("none");
      return;
    }

    persistLaunch();
    setMode(resolved);

    const timing = resolved === "full" ? FULL_TIMING : resolved === "compact" ? COMPACT_TIMING : REDUCED_TIMING;

    const scheduleExit = () => setPhase("exiting");
    const scheduleRemove = () => setMode("none");

    if (resolved === "full" || resolved === "compact") {
      const holdDelay = resolved === "full" ? FULL_TIMING.taglineDelay : COMPACT_TIMING.taglineDelay;
      timers.current.push(setTimeout(() => setPhase("holding"), holdDelay));
    }
    timers.current.push(setTimeout(scheduleExit, timing.exitDelay));
    timers.current.push(setTimeout(scheduleRemove, timing.removeDelay));
    // Hard timeout: guarantees removal even if an animation/timer callback
    // above never fires for any reason.
    timers.current.push(setTimeout(scheduleRemove, timing.hardTimeout));

    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [launchCandidate]);

  // Scroll lock while any overlay content is actually visible.
  useLayoutEffect(() => {
    const visible = mode === "full" || mode === "compact" || mode === "reduced";
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
  }, [mode]);

  if (!launchCandidate) return null;
  if (mode === "none") return null;

  // Falls back to the least conspicuous look while the real mode is still
  // resolving post-hydration, so a compact/reduced launch never has to
  // downgrade away from a flashier "full" frame it briefly guessed wrong.
  const resolvedMode: AppLaunchMode = mode ?? "compact";
  const showTiles = resolvedMode === "full";
  const showLightSweep = resolvedMode !== "reduced";
  const animateSegments = resolvedMode === "full";
  const exiting = phase === "exiting";

  return (
    <>
      {/* Pre-paint bootstrap: only ever emitted for a server-known launch
          candidate route; decides "pending" vs "skip" before hydration. */}
      <script id="pw-launch-bootstrap" dangerouslySetInnerHTML={{ __html: BOOTSTRAP_SCRIPT }} />
      <style>{`
        html[data-pw-launch="pending"] [data-pw-launch-root] { display: flex !important; }
        @keyframes pw-launch-sweep {
          0%   { transform: translateX(-130%) skewX(-12deg); opacity: 0; }
          15%  { opacity: 1; }
          100% { transform: translateX(130%) skewX(-12deg); opacity: 0; }
        }
      `}</style>
      <div
        data-pw-launch-root
        data-testid="app-launch-sequence"
        data-launch-mode={resolvedMode}
        data-launch-phase={phase}
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          display: "none",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "clamp(20px, 4vh, 32px)",
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

        {showTiles && (
          <div
            data-testid="app-launch-tiles"
            style={{ position: "relative", display: "flex", gap: "clamp(10px, 2.5vw, 16px)" }}
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

        <motion.div
          data-testid="app-launch-logo"
          initial={resolvedMode === "reduced" ? { opacity: 1 } : { opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={
            resolvedMode === "reduced"
              ? { duration: 0 }
              : { type: "spring", stiffness: 260, damping: 22, delay: (resolvedMode === "full" ? FULL_TIMING.logoDelay : COMPACT_TIMING.logoDelay) / 1000 }
          }
          style={{
            position: "relative",
            width: "clamp(96px, 22vw, 148px)",
            aspectRatio: "1 / 1",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            filter: "drop-shadow(0 8px 24px color-mix(in srgb, var(--pw-brand-primary) 35%, transparent))",
          }}
        >
          <img
            src="/images/puzzle_warz_logo.png"
            alt="PuzzleWarz"
            width={148}
            height={148}
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
          />
          {showLightSweep && (
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
                  animation: `pw-launch-sweep 0.9s ease-out ${((resolvedMode === "full" ? FULL_TIMING.logoDelay : COMPACT_TIMING.logoDelay) + 120) / 1000}s 1 both`,
                }}
              />
            </div>
          )}
        </motion.div>

        <motion.div
          data-testid="app-launch-tagline"
          initial={resolvedMode === "reduced" ? { opacity: 1 } : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={
            resolvedMode === "reduced"
              ? { duration: 0 }
              : { duration: 0.5, delay: (resolvedMode === "full" ? FULL_TIMING.taglineDelay : COMPACT_TIMING.taglineDelay) / 1000 }
          }
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
                    ? { duration: 0.25, delay: (FULL_TIMING.taglineDelay + 120 + i * 90) / 1000 }
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
    </>
  );
}
