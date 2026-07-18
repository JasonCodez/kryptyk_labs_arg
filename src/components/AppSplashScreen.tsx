"use client";

import { useEffect, useState } from "react";

const SESSION_KEY = "pw_app_splash_shown";

export default function AppSplashScreen() {
  const [phase, setPhase] = useState<"hidden" | "visible" | "fading">("hidden");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
    if (!isStandalone) return;

    try {
      if (sessionStorage.getItem(SESSION_KEY)) return;
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      return;
    }

    setPhase("visible");
    const t1 = setTimeout(() => setPhase("fading"), 2200);
    const t2 = setTimeout(() => setPhase("hidden"), 2900);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  if (phase === "hidden") return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        backgroundColor: "var(--pw-bg-base)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 28,
        opacity: phase === "fading" ? 0 : 1,
        transition: "opacity 0.7s ease",
        pointerEvents: phase === "fading" ? "none" : "all",
      }}
    >
      <style>{`
        @keyframes pw-sp-ring {
          0%   { transform: scale(0.65); opacity: 0.55; }
          100% { transform: scale(2);    opacity: 0; }
        }
        @keyframes pw-sp-glow {
          0%, 100% { opacity: 0.55; transform: scale(1); }
          50%       { opacity: 1;    transform: scale(1.12); }
        }
        @keyframes pw-sp-logo {
          0%   { opacity: 0; transform: scale(0.75); }
          60%  { opacity: 1; transform: scale(1.05); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes pw-sp-tag {
          0%, 35% { opacity: 0; transform: translateY(8px); }
          100%    { opacity: 1; transform: translateY(0); }
        }
        @keyframes pw-sp-dot {
          0%, 80%, 100% { transform: scale(0); opacity: 0; }
          40%           { transform: scale(1); opacity: 1; }
        }
      `}</style>

      {/* Radial background glow */}
      <div style={{
        position: "absolute",
        inset: 0,
        background: "radial-gradient(ellipse at 50% 45%, rgba(3,172,244,0.12) 0%, transparent 60%)",
        pointerEvents: "none",
      }} />

      {/* Logo + rings */}
      <div style={{ position: "relative", width: 200, height: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {/* Expanding rings */}
        {[0, 0.45, 0.9].map((delay) => (
          <div
            key={delay}
            style={{
              position: "absolute",
              width: 180,
              height: 180,
              borderRadius: "50%",
              border: "1.5px solid rgba(3,172,244,0.45)",
              animation: `pw-sp-ring 2s ease-out ${delay}s infinite`,
            }}
          />
        ))}

        {/* Inner glow disc */}
        <div style={{
          position: "absolute",
          width: 148,
          height: 148,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(3,172,244,0.22) 0%, transparent 72%)",
          animation: "pw-sp-glow 2s ease-in-out infinite",
        }} />

        {/* Logo */}
        <img
          src="/images/puzzle_warz_logo.png"
          alt="Puzzle Warz"
          style={{
            width: 152,
            height: "auto",
            position: "relative",
            zIndex: 1,
            animation: "pw-sp-logo 0.75s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
            filter: "drop-shadow(0 0 28px rgba(3,172,244,0.65))",
          }}
        />
      </div>

      {/* Tagline */}
      <p style={{
        margin: 0,
        color: "var(--pw-text-muted)",
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        animation: "pw-sp-tag 1.4s ease forwards",
      }}>
        Ready to play?
      </p>

      {/* Loading dots */}
      <div style={{ display: "flex", gap: 8 }}>
        {[0, 0.18, 0.36].map((delay) => (
          <div
            key={delay}
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              backgroundColor: "var(--pw-brand-primary)",
              animation: `pw-sp-dot 1.1s ease-in-out ${delay}s infinite`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
