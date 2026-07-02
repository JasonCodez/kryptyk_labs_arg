"use client";

import { useEffect, useState } from "react";

const DISMISSED_KEY = "pw-ios-install-banner-dismissed";

function isIOSDevice(): boolean {
  const ua = window.navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream) return true;
  // iPadOS 13+ reports as "MacIntel" but has touch support, unlike a real Mac.
  return window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1;
}

function isStandaloneDisplay(): boolean {
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || window.matchMedia("(display-mode: standalone)").matches;
}

export default function IOSInstallBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.pathname === "/coming-soon") return;
    if (isStandaloneDisplay()) return;
    if (!isIOSDevice()) return;
    try {
      if (localStorage.getItem(DISMISSED_KEY)) return;
    } catch {
      // ignore
    }

    const t = window.setTimeout(() => setVisible(true), 2500);
    return () => window.clearTimeout(t);
  }, []);

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // ignore
    }
  };

  if (!visible) return null;

  return (
    <div
      role="status"
      style={{
        position: "fixed",
        left: 12,
        right: 12,
        bottom: "calc(12px + env(safe-area-inset-bottom, 0px))",
        zIndex: 9500,
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 14px",
        borderRadius: 14,
        background: "rgba(6, 8, 14, 0.96)",
        border: "1px solid rgba(253,231,76,0.35)",
        boxShadow: "0 10px 32px rgba(0,0,0,0.5)",
        backdropFilter: "blur(8px)",
      }}
    >
      <img src="/apple-icon.png" alt="" width={40} height={40} style={{ borderRadius: 10, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, color: "#fff", fontSize: 13, fontWeight: 700 }}>
          Install Puzzle Warz
        </p>
        <p style={{ margin: "2px 0 0", color: "#9CA3AF", fontSize: 12, lineHeight: 1.4 }}>
          Tap <span style={{ color: "#FDE74C", fontWeight: 700 }}>Share</span>{" "}
          <span aria-hidden style={{ color: "#FDE74C" }}>⬆️</span> then{" "}
          <span style={{ color: "#FDE74C", fontWeight: 700 }}>&quot;Add to Home Screen&quot;</span>
        </p>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        style={{
          flexShrink: 0,
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.12)",
          color: "#9CA3AF",
          borderRadius: 999,
          width: 26,
          height: 26,
          display: "grid",
          placeItems: "center",
          cursor: "pointer",
          fontSize: 14,
          lineHeight: 1,
        }}
      >
        ×
      </button>
    </div>
  );
}
