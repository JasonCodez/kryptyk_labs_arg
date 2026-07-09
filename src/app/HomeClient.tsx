"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import HomepageHiddenWordCard from "@/components/home/HomepageHiddenWordCard";

function useReveal(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, visible };
}

const fade = (visible: boolean, delay = 0, y = 28): CSSProperties => ({
  opacity: visible ? 1 : 0,
  transform: visible ? "translateY(0)" : `translateY(${y}px)`,
  transition: `opacity 0.7s ease ${delay}s, transform 0.7s ease ${delay}s`,
});

export default function HomeClient() {
  const [heroVisible, setHeroVisible] = useState(false);
  const { data: session } = useSession();
  const competeHref = session ? "/warz" : "/auth/register";

  const featuresReveal = useReveal();

  useEffect(() => {
    const timer = setTimeout(() => setHeroVisible(true), 60);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      <style>{`
        @keyframes pw-orb-float {
          0%,100% { transform: translate(0,0) scale(1); }
          33% { transform: translate(60px,-36px) scale(1.05); }
          66% { transform: translate(-24px,42px) scale(0.96); }
        }
        @keyframes pw-orb-float2 {
          0%,100% { transform: translate(0,0) scale(1); }
          40% { transform: translate(-52px,28px) scale(1.03); }
          70% { transform: translate(34px,-48px) scale(0.98); }
        }
        @keyframes pw-grid-in {
          from { opacity: 0; }
          to { opacity: 0.06; }
        }
        @keyframes pw-pulse-dot {
          0%,100% { box-shadow: 0 0 0 0 rgba(56,211,153,0.5); }
          50% { box-shadow: 0 0 0 7px rgba(56,211,153,0); }
        }
        @keyframes pw-shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .pw-shimmer-text {
          background: linear-gradient(90deg, #38D399 0%, #F4FFE8 34%, #FDE74C 68%, #38D399 100%);
          background-size: 220% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: pw-shimmer 4.2s linear infinite;
        }
        .pw-cta { position: relative; overflow: hidden; }
        .pw-cta::after {
          content: "";
          position: absolute;
          top: -50%;
          left: -60%;
          width: 38%;
          height: 200%;
          background: rgba(255,255,255,0.12);
          transform: skewX(-18deg);
          transition: left 0.5s ease;
        }
        .pw-cta:hover::after { left: 130%; }
        .pw-feature { transition: transform 0.25s, border-color 0.22s, box-shadow 0.22s; }
        .pw-feature:hover { transform: translateY(-4px); }
        @media (max-width: 640px) {
          .hw-hero {
            padding: 32px 16px 24px !important;
            min-height: 100vh !important;
            min-height: 100dvh !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: center !important;
            box-sizing: border-box !important;
          }
          .hw-orb-1 { width: 260px !important; height: 260px !important; top: 4% !important; left: -4% !important; }
          .hw-orb-2 { display: none !important; }
          .hw-hero-badge { margin-bottom: 12px !important; }
          .hw-hero-title { font-size: 30px !important; margin-bottom: 6px !important; }
          .hw-hero-subtitle { margin-bottom: 16px !important; font-size: 13px !important; }
          .hw-puzzle-card { padding: 16px !important; }
          .hw-hero-links { margin-top: 18px !important; }
          .hw-features-grid { grid-template-columns: 1fr !important; }
          .hw-features-section { padding: 48px 16px !important; }
          .hw-footer-inner { flex-direction: column !important; gap: 28px !important; align-items: center !important; text-align: center !important; }
          .hw-footer-nav { flex-direction: column !important; gap: 28px !important; align-items: center !important; text-align: center !important; }
          .hw-footer-bottom { flex-direction: column !important; align-items: center !important; text-align: center !important; gap: 4px !important; }
          .hw-badge { font-size: 9px !important; padding: 4px 10px !important; }
        }
        @media (max-width: 640px) and (max-height: 720px) {
          .hw-hero-subtitle { display: none !important; }
          .hw-hero-badge { margin-bottom: 8px !important; }
          .hw-hero-links { display: none !important; }
        }
      `}</style>

      <main style={{ backgroundColor: "#010101", minHeight: "100vh", overflowX: "hidden", fontFamily: "system-ui, -apple-system, sans-serif" }}>
        {/* ── Hero: puzzle-first ── */}
        <section className="hw-hero" style={{ position: "relative", padding: "100px 20px 64px", overflow: "hidden" }}>
          <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
            <div className="hw-orb-1" style={{ position: "absolute", top: "8%", left: "10%", width: 560, height: 560, borderRadius: "50%", background: "radial-gradient(circle, rgba(56,211,153,0.15) 0%, transparent 68%)", animation: "pw-orb-float 22s ease-in-out infinite", filter: "blur(2px)" }} />
            <div className="hw-orb-2" style={{ position: "absolute", top: "18%", right: "8%", width: 420, height: 420, borderRadius: "50%", background: "radial-gradient(circle, rgba(253,231,76,0.12) 0%, transparent 68%)", animation: "pw-orb-float2 25s ease-in-out infinite" }} />
            <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle, rgba(56,211,153,0.5) 1px, transparent 1px)", backgroundSize: "36px 36px", animation: "pw-grid-in 1.8s ease forwards" }} />
            <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 88% 72% at 50% 50%, transparent 24%, #010101 100%)" }} />
          </div>

          <div style={{ maxWidth: 580, margin: "0 auto", position: "relative", textAlign: "center" }}>
            {/* Badge */}
            <div className="hw-hero-badge" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: 999, background: "rgba(56,211,153,0.08)", border: "1px solid rgba(56,211,153,0.24)", marginBottom: 24, ...fade(heroVisible, 0) }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#38D399", animation: "pw-pulse-dot 1.5s ease-in-out infinite" }} />
              <span className="hw-badge" style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#38D399" }}>
                Daily Hidden Word is live
              </span>
            </div>

            {/* Title */}
            <h1 className="hw-hero-title" style={{ fontSize: "clamp(36px,7vw,56px)", fontWeight: 900, lineHeight: 1.05, letterSpacing: "-0.04em", color: "#fff", margin: "0 0 8px", ...fade(heroVisible, 0.06) }}>
              Daily <span className="pw-shimmer-text">Hidden Word</span>
            </h1>
            <p className="hw-hero-subtitle" style={{ fontSize: 15, color: "#9CA3AF", maxWidth: 440, margin: "0 auto 28px", lineHeight: 1.7, ...fade(heroVisible, 0.14) }}>
              Six guesses. One word.
            </p>

            {/* Puzzle card */}
            <div
              className="hw-puzzle-card"
              style={{
                borderRadius: 24,
                border: "1px solid rgba(255,255,255,0.09)",
                background: "linear-gradient(160deg, rgba(3,18,13,0.92) 0%, rgba(4,7,17,0.96) 100%)",
                padding: 24,
                boxShadow: "0 26px 80px rgba(0,0,0,0.45)",
                textAlign: "left",
                ...fade(heroVisible, 0.22, 18),
              }}
            >
              <HomepageHiddenWordCard />
            </div>

            {/* Quick links below the card */}
            <div className="hw-hero-links" style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center", marginTop: 28, ...fade(heroVisible, 0.34) }}>
              <Link href="/puzzles" style={{ padding: "12px 22px", borderRadius: 10, fontWeight: 700, fontSize: 14, color: "#E5E7EB", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.12)", textDecoration: "none", transition: "border-color 0.2s, background 0.2s" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.28)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.12)"; }}
              >Browse Puzzle Library</Link>
              <Link href={competeHref} style={{ padding: "12px 22px", borderRadius: 10, fontWeight: 700, fontSize: 14, color: "#9BD6E4", background: "transparent", border: "1px solid rgba(56,145,166,0.35)", textDecoration: "none", transition: "border-color 0.2s, background 0.2s" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(56,145,166,0.08)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(56,145,166,0.68)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(56,145,166,0.35)"; }}
              >Warz Battles</Link>
            </div>
          </div>
        </section>

        {/* ── Compact feature strip ── */}
        <section className="hw-features-section" ref={featuresReveal.ref} style={{ padding: "56px 20px 64px", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
          <div style={{ maxWidth: 900, margin: "0 auto" }}>
            <div className="hw-features-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
              {[
                {
                  icon: "🗓️",
                  title: "More Daily Puzzles",
                  tagColor: "#FDE74C",
                  body: "Sudoku, Crossword, Word Trove, and Jigsaw — a fresh set every day.",
                  href: "/daily",
                  cta: "View Daily Puzzles",
                },
                {
                  icon: "🧩",
                  title: "Full Catalog",
                  tagColor: "#9BD6E4",
                  body: "Crosswords, Word Troves, jigsaws, anagrams, detective cases, and more.",
                  href: "/puzzles",
                  cta: "Open Catalog",
                },
                {
                  icon: "⚔",
                  title: "Warz Battles",
                  tagColor: "#F97316",
                  body: "Head-to-head puzzle battles. Same puzzle, ranked pressure.",
                  href: competeHref,
                  cta: session ? "Enter Warz" : "Create Account",
                },
              ].map((feature, index) => (
                <div
                  key={feature.title}
                  className="pw-feature"
                  style={{
                    padding: "22px 18px",
                    borderRadius: 16,
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.07)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    ...fade(featuresReveal.visible, 0.04 + index * 0.08),
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = `${feature.tagColor}40`; (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 38px ${feature.tagColor}16`; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)"; (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
                >
                  <span style={{ fontSize: 22 }}>{feature.icon}</span>
                  <h3 style={{ color: "#fff", fontWeight: 800, fontSize: 16, margin: 0 }}>{feature.title}</h3>
                  <p style={{ color: "#9CA3AF", fontSize: 13, lineHeight: 1.65, flexGrow: 1, margin: 0 }}>{feature.body}</p>
                  <Link href={feature.href} style={{ fontSize: 12, fontWeight: 800, color: feature.tagColor, textDecoration: "none", borderBottom: `1px solid ${feature.tagColor}30`, paddingBottom: 2, alignSelf: "flex-start" }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = feature.tagColor)}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = `${feature.tagColor}30`)}
                  >{feature.cta} →</Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Footer ── */}
        <footer style={{ padding: "40px 20px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <div className="hw-footer-inner" style={{ maxWidth: 1100, margin: "0 auto", display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-start", gap: 40, marginBottom: 28 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <img src="/images/puzzle_warz_logo.png" alt="PuzzleWarz" style={{ height: 28, width: "auto" }} />
                <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#38D399" }}>PuzzleWarz</span>
              </div>
              <p style={{ color: "#9CA3AF", fontSize: 12, maxWidth: 250, lineHeight: 1.65 }}>
                Daily Hidden Word first. Full puzzle catalog right behind it.
              </p>
            </div>
            <div className="hw-footer-nav" style={{ display: "flex", gap: 48, fontSize: 14, flexWrap: "wrap" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#9CA3AF", marginBottom: 4 }}>Play</p>
                {[["Daily Hidden Word", "/daily"], ["Puzzle Library", "/puzzles"], ["Leaderboard", "/leaderboard"], ["Warz Battles", competeHref]].map(([label, href]) => (
                  <Link key={label} href={href} style={{ color: "#9CA3AF", textDecoration: "none", transition: "color 0.2s" }}
                    onMouseEnter={e => (e.currentTarget.style.color = "#fff")}
                    onMouseLeave={e => (e.currentTarget.style.color = "#9CA3AF")}
                  >{label}</Link>
                ))}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#9CA3AF", marginBottom: 4 }}>Account</p>
                {[["Sign Up Free", "/auth/register"], ["Sign In", "/auth/signin"], ["Achievements", "/auth/register"]].map(([label, href]) => (
                  <Link key={label} href={href} style={{ color: "#9CA3AF", textDecoration: "none", transition: "color 0.2s" }}
                    onMouseEnter={e => (e.currentTarget.style.color = "#fff")}
                    onMouseLeave={e => (e.currentTarget.style.color = "#9CA3AF")}
                  >{label}</Link>
                ))}
              </div>
            </div>
          </div>
          <div className="hw-footer-bottom" style={{ paddingTop: 20, borderTop: "1px solid rgba(255,255,255,0.04)", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <p style={{ color: "#6B7280", fontSize: 12 }}>&copy; 2026 PuzzleWarz · All rights reserved</p>
            <p style={{ color: "#6B7280", fontSize: 12 }}>Start fast. Stay sharp. Finish strong.</p>
          </div>
        </footer>
      </main>
    </>
  );
}
