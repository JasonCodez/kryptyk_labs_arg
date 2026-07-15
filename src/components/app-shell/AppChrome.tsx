"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getAppMode } from "@/lib/appMode";

const Navbar = dynamic(() => import("@/components/Navbar"), { ssr: false });
const AppBottomNav = dynamic(() => import("@/components/AppBottomNav"), { ssr: false });
const IOSInstallBanner = dynamic(() => import("@/components/IOSInstallBanner"), { ssr: false });
const EarlyAccessBanner = dynamic(() => import("@/components/EarlyAccessBanner"), { ssr: false });

/**
 * The single owner of global navigation chrome (top Navbar, AppBottomNav) and
 * promotional banners — nothing else should render these.
 *
 * Route-aware via getAppMode, one rule per mode:
 *   browse — standard Navbar, mobile AppBottomNav, eligible promo banners.
 *   play   — Navbar hidden on mobile (< 1032px), preserved on desktop; no
 *            AppBottomNav or banners. Pages supply their own top bar via
 *            PuzzlePlayShell / PuzzleHeader.
 *   auth   — no Navbar, no AppBottomNav, no banners.
 *   admin  — no Navbar, no AppBottomNav, no banners; the admin section owns
 *            its own in-page navigation (back-links, etc.) instead.
 */
export default function AppChrome() {
  const pathname = usePathname();
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(display-mode: standalone)");
    setIsStandalone(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsStandalone(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const mode = getAppMode(pathname);
  const isPlay = mode === "play";
  const showNavbar = pathname !== "/coming-soon" && (mode === "browse" || mode === "play");
  const showBrowseChrome = mode === "browse";

  // Expose the mode to CSS so global rules (e.g. body bottom padding reserved for
  // the now-hidden bottom nav, and the cookie banner) can respond without prop
  // drilling. See .pw-play / html[data-app-mode="play"] rules in globals.css.
  useEffect(() => {
    document.documentElement.dataset.appMode = mode;
  }, [mode]);

  return (
    <>
      {showNavbar && (
        // In play mode the top navbar is hidden below 1032px (CSS) but preserved
        // on desktop — the wrapper is what the media query targets. In browse
        // mode the wrapper is a no-op (always visible).
        <div className={isPlay ? "pw-chrome-hide-mobile" : undefined}>
          <Navbar isStandalone={isStandalone} />
        </div>
      )}
      {showBrowseChrome && <AppBottomNav />}
      {showBrowseChrome && !isStandalone && <IOSInstallBanner />}
      {showBrowseChrome && !isStandalone && <EarlyAccessBanner />}
    </>
  );
}
