"use client";

import { useSyncExternalStore } from "react";
import { prefersReducedMotion } from "@/lib/juice/prefs";

/**
 * Reactive reduced-motion preference: true when EITHER the OS media query
 * (prefers-reduced-motion: reduce) or the app's own accessibility toggle
 * (data-reduce-animations="true" on <html>, set by the settings page) asks for
 * less motion — and, unlike calling prefersReducedMotion() once per render,
 * already-mounted components re-render when either signal changes.
 *
 * One module-level MutationObserver + one media-query listener serve every
 * subscriber (no per-component observers); both are torn down when the last
 * subscriber unmounts. Server snapshot is `false`, so SSR markup renders the
 * motion-enabled variant and the client corrects itself after hydration
 * without a mismatch.
 */

const listeners = new Set<() => void>();
let observer: MutationObserver | null = null;
let mediaQuery: MediaQueryList | null = null;

function notifyAll() {
  for (const listener of listeners) listener();
}

function startWatching() {
  observer = new MutationObserver(notifyAll);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-reduce-animations"],
  });
  if (typeof window.matchMedia === "function") {
    mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    // addEventListener is missing on very old Safari MediaQueryList — skip
    // gracefully; the app toggle still works via the observer.
    mediaQuery.addEventListener?.("change", notifyAll);
  }
}

function stopWatching() {
  observer?.disconnect();
  observer = null;
  mediaQuery?.removeEventListener?.("change", notifyAll);
  mediaQuery = null;
}

function subscribe(onStoreChange: () => void): () => void {
  if (listeners.size === 0) startWatching();
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
    if (listeners.size === 0) stopWatching();
  };
}

const getServerSnapshot = () => false;

export function useAppReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, prefersReducedMotion, getServerSnapshot);
}
