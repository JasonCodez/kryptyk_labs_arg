"use client";

import { useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";

const CATEGORIES = [
  {
    label: "Getting Started",
    items: [
      {
        q: "What is PuzzleWarz?",
        a: "PuzzleWarz is a competitive online puzzle platform where you can solve logic puzzles, ciphers, and more — solo or with a team. Climb global leaderboards, earn achievements, and unlock cosmetics as you progress.",
      },
      {
        q: "Is PuzzleWarz free to play?",
        a: "Yes! Create a free account and access hundreds of puzzles at no cost. A Season Pass ($4.99) unlocks premium rewards, exclusive cosmetics, and bonus XP boosts each season.",
      },
      {
        q: "How do I create an account?",
        a: "Click 'Sign Up' on the homepage, enter a username, email address, and password. That's it — you can start solving immediately.",
      },
      {
        q: "Do I need to verify my email?",
        a: "Yes. Email verification is required to protect the platform from bots and abuse. After registering, a verification link will be sent to your inbox — click it to activate your account. If you don't see the email, check your spam folder or request a new one from the sign-in page.",
      },
    ],
  },
  {
    label: "Puzzles & Gameplay",
    items: [
      {
        q: "What types of puzzles are available?",
        a: "PuzzleWarz features a wide range of puzzle types including logic grids, cryptic ciphers, sudoku, and daily challenge puzzles that reset every 24 hours.",
      },
      {
        q: "How is scoring calculated?",
        a: "Solo puzzles award a fixed amount of points and XP upon completion — your speed has no effect on your reward. Some puzzles are time-based, meaning you must solve them before a countdown expires; the timer indicates how long you have left, not a scoring factor.",
      },
      {
        q: "What are daily puzzles?",
        a: "Each day a fresh puzzle is published at midnight UTC. Completing it awards a Daily Streak bonus that compounds the longer your unbroken streak runs. Missing a day resets your streak to zero.",
      },
      {
        q: "Can I hint a puzzle if I'm stuck?",
        a: "Yes. Most puzzles have a hint system. Using a hint does not affect your score or XP — it's there to help you when you're stuck without any penalty.",
      },
      {
        q: "How do leaderboards work?",
        a: "There are global leaderboards (all-time points), weekly leaderboards (points earned in the current week), and puzzle-specific speed leaderboards. Team leaderboards rank groups by their combined scores.",
      },
    ],
  },
  {
    label: "Teams",
    items: [
      {
        q: "How do I create or join a team?",
        a: "Head to the Teams section and click 'Create Team' to start your own, or search for existing teams and request to join. Team leaders can set their team as open (anyone can join) or invite-only.",
      },
      {
        q: "How many members can a team have?",
        a: "Teams can have up to 20 members. Each member's solved puzzles contribute to the team's total score on the team leaderboard.",
      },
      {
        q: "What is the team lobby?",
        a: "The team lobby is a shared space where your team can tackle co-operative puzzles together in real time, chat, and track each other's progress.",
      },
      {
        q: "Can I be on multiple teams?",
        a: "You can belong to only one team at a time. To join a different team you must first leave your current one.",
      },
    ],
  },
  {
    label: "Season Pass",
    items: [
      {
        q: "What is the Season Pass?",
        a: "The Season Pass is a seasonal progression track featuring free and premium reward tiers. As you earn XP by solving puzzles, you unlock cosmetics, tokens, and bonuses. The premium tier ($4.99 one-time per season) dramatically expands your rewards.",
      },
      {
        q: "How long does each season last?",
        a: "Seasons run for approximately 3 months. At the end of a season, unclaimed rewards expire and the new season track resets.",
      },
      {
        q: "Do my Season Pass rewards carry over?",
        a: "Cosmetics and items you have already claimed are permanently yours. Unclaimed tier rewards expire when the season ends, so make sure to claim everything before the season closes.",
      },
      {
        q: "Where do I equip exclusive cosmetics I earned?",
        a: "Go to your Profile, open the Cosmetics drawer, and switch to the ⭐ Exclusive tab. Items you've claimed from the Season Pass will appear there and can be equipped directly.",
      },
      {
        q: "Can I upgrade from free to premium mid-season?",
        a: "Yes. Purchasing the Season Pass at any point in the season retroactively unlocks all premium rewards for tiers you've already passed.",
      },
    ],
  },
  {
    label: "Account & Settings",
    items: [
      {
        q: "How do I change my username or avatar?",
        a: "Go to Settings → Profile to update your username, display name, bio, and avatar image. Username changes may be limited to once every 30 days.",
      },
      {
        q: "How do I reset my password?",
        a: "On the login page, click 'Forgot password?', enter your email address, and we'll send a reset link. The link expires after 1 hour.",
      },
      {
        q: "How do I delete my account?",
        a: "Go to Settings and use the Delete Account section to permanently remove your account. You can also email support@puzzlewarz.com if you cannot access your account. Deleted accounts cannot be recovered.",
      },
      {
        q: "How do I opt out of marketing emails?",
        a: "In Settings, scroll to the Notifications section and toggle off 'Marketing & promotions'. You can also click the unsubscribe link at the bottom of any marketing email we send.",
      },
    ],
  },
];

function AccordionItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      style={{
        borderBottom: "1px solid rgba(56,145,166,0.15)",
      }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-4 py-4 text-left"
        aria-expanded={open}
      >
        <span className="text-sm font-semibold" style={{ color: open ? "#3891A6" : "#ddd" }}>
          {q}
        </span>
        <span
          className="flex-shrink-0 transition-transform duration-200"
          style={{
            transform: open ? "rotate(45deg)" : "rotate(0deg)",
            color: "#3891A6",
            fontSize: "1.25rem",
            lineHeight: 1,
          }}
        >
          +
        </span>
      </button>
      {open && (
        <div
          className="pb-4 text-sm leading-relaxed"
          style={{ color: "#999" }}
        >
          {a}
        </div>
      )}
    </div>
  );
}

export default function FAQPage() {
  const [activeCategory, setActiveCategory] = useState(CATEGORIES[0].label);

  return (
    <>
      <Navbar />
      <main className="min-h-screen pt-24 pb-20 px-4" style={{ backgroundColor: "#020202" }}>
        <div className="max-w-3xl mx-auto">

          {/* Header */}
          <div className="mb-10 pb-8" style={{ borderBottom: "1px solid rgba(56,145,166,0.2)" }}>
            <p className="text-xs tracking-widest uppercase mb-3" style={{ color: "#3891A6" }}>Support</p>
            <h1 className="text-4xl font-black mb-4" style={{ color: "#fff" }}>Frequently Asked Questions</h1>
            <p className="text-sm leading-relaxed" style={{ color: "#888" }}>
              Can&apos;t find what you&apos;re looking for? Email us at{" "}
              <span style={{ color: "#3891A6" }}>support@puzzlewarz.com</span>{" "}
              and we&apos;ll get back to you.
            </p>
          </div>

          {/* Category tabs */}
          <div className="flex flex-wrap gap-2 mb-8">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.label}
                onClick={() => setActiveCategory(cat.label)}
                className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-150"
                style={
                  activeCategory === cat.label
                    ? { background: "#3891A6", color: "#fff" }
                    : { background: "rgba(56,145,166,0.1)", color: "#3891A6", border: "1px solid rgba(56,145,166,0.25)" }
                }
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Accordion */}
          {CATEGORIES.filter((c) => c.label === activeCategory).map((cat) => (
            <div key={cat.label}>
              {cat.items.map((item) => (
                <AccordionItem key={item.q} q={item.q} a={item.a} />
              ))}
            </div>
          ))}

          {/* Footer links */}
          <div className="mt-14 pt-8 flex flex-wrap gap-6" style={{ borderTop: "1px solid rgba(56,145,166,0.2)" }}>
            <Link href="/terms" className="text-sm hover:opacity-80 transition-opacity" style={{ color: "#3891A6" }}>
              Terms of Service
            </Link>
            <Link href="/dashboard" className="text-sm hover:opacity-80 transition-opacity" style={{ color: "#3891A6" }}>
              ← Back to dashboard
            </Link>
          </div>

        </div>
      </main>
    </>
  );
}
