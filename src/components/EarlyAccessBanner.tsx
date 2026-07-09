"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const DISMISSED_KEY = "pw-early-access-banner-dismissed";

export default function EarlyAccessBanner() {
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.pathname === "/coming-soon") return;
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    try {
      if (localStorage.getItem(DISMISSED_KEY)) return;
    } catch {
      // ignore
    }

    const t = window.setTimeout(() => setVisible(true), 600);
    return () => window.clearTimeout(t);
  }, []);

  const dismiss = () => {
    setClosing(true);
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // ignore
    }
    window.setTimeout(() => setVisible(false), 260);
  };

  if (!visible) return null;

  return (
    <div
      role="status"
      style={{
        position: "fixed",
        top: "calc(66px + env(safe-area-inset-top, 0px))",
        left: 12,
        right: 12,
        zIndex: 9400,
        display: "flex",
        justifyContent: "center",
        pointerEvents: "none",
        opacity: closing ? 0 : 1,
        transform: closing ? "translateY(-10px)" : "translateY(0)",
        transition: "opacity 0.26s ease, transform 0.26s ease",
      }}
    >
      <div
        style={{
          pointerEvents: "auto",
          display: "flex",
          alignItems: "center",
          gap: 12,
          maxWidth: 560,
          width: "100%",
          padding: "11px 14px",
          borderRadius: 14,
          background: "linear-gradient(135deg, rgba(10,12,20,0.97) 0%, rgba(20,16,8,0.97) 100%)",
          border: "1px solid rgba(253,231,76,0.3)",
          boxShadow: "0 12px 36px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,0,0,0.2)",
          backdropFilter: "blur(10px)",
        }}
      >
        <span
          aria-hidden
          style={{
            flexShrink: 0,
            width: 30,
            height: 30,
            borderRadius: 9,
            display: "grid",
            placeItems: "center",
            fontSize: 15,
            background: "rgba(253,231,76,0.12)",
            border: "1px solid rgba(253,231,76,0.3)",
          }}
        >
          🚀
        </span>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, color: "#fff", fontSize: 13, fontWeight: 700, lineHeight: 1.3 }}>
            You&apos;re early —{" "}
            <span style={{ color: "#FDE74C" }}>Puzzle Warz is in Early Access</span>
          </p>
          <p style={{ margin: "2px 0 0", color: "#9CA3AF", fontSize: 12, lineHeight: 1.4 }}>
            We&apos;re shipping fast and squashing bugs as we go.{" "}
            <Link href="/forum" style={{ color: "#9BD6E4", fontWeight: 600, textDecoration: "underline" }}>
              Got feedback? Tell us
            </Link>
            .
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
    </div>
  );
}
