"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";

/* ── Section data ──────────────────────────────────────────────────── */

interface TutorialSection {
  id: string;
  icon: string;
  accent: string;
  title: string;
  eyebrow: string;
  intro: string;
  details: { heading: string; body: string }[];
  tips: string[];
  cta: { label: string; href: string };
}

const SECTIONS: TutorialSection[] = [
  {
    id: "dashboard",
    icon: "🏠",
    accent: "#3891A6",
    title: "Your Dashboard",
    eyebrow: "Home Base",
    intro:
      "The Dashboard is your command center. Every time you log in, this is where you land. It gives you a snapshot of your progress and quick access to everything on the platform.",
    details: [
      {
        heading: "Stats at a Glance",
        body: "At the top you'll see four stat cards: Puzzles Solved, Total Points, Teams, and Global Rank. These update in real time as you play. Points are earned by solving puzzles, and your rank is calculated based on your all-time point total compared to every other player.",
      },
      {
        heading: "Quick-Action Cards",
        body: "Below your stats you'll find action cards that link directly to the features you use most — Daily Puzzle, Warz Mode, Browse Puzzles, Teams, Leaderboards, and more. Think of these as shortcuts so you never have to dig through menus.",
      },
      {
        heading: "Activity Feed",
        body: "Your recent activity is displayed here: puzzles you've solved, achievements you've unlocked, and milestones you've hit. It's a quick way to see what you've been up to and what to tackle next.",
      },
    ],
    tips: [
      "Your dashboard is personalized — the more you play, the more relevant the recommendations become.",
      "Check back daily to keep your streak alive and spot new featured puzzles.",
    ],
    cta: { label: "Go to Dashboard", href: "/dashboard" },
  },
  {
    id: "puzzles",
    icon: "🧩",
    accent: "#3891A6",
    title: "Solving Puzzles",
    eyebrow: "Core Gameplay",
    intro:
      "Puzzles are the heart of PuzzleWarz. We offer hundreds of challenges across many categories, from logic grids and cryptic ciphers to sudoku and coding challenges. Here's everything you need to know about finding and solving them.",
    details: [
      {
        heading: "Browsing & Filtering",
        body: "The Puzzles page lets you browse the full catalogue. You can filter by category (Logic, Cryptic, Code, etc.), difficulty level (Easy, Medium, Hard, Expert), and status (unsolved, solved, in progress). Use the search bar to find puzzles by name or keyword.",
      },
      {
        heading: "Difficulty Levels",
        body: "Each puzzle is rated Easy, Medium, Hard, or Expert. Harder puzzles award more points and XP. If you're new, start with Easy puzzles to learn the mechanics, then work your way up. There's no penalty for attempting a puzzle above your level.",
      },
      {
        heading: "Scoring & Points",
        body: "Every puzzle awards a fixed number of points and XP when you solve it. Your speed does not affect how many points you earn — so take your time. Some puzzles are timed, meaning you must solve them before a countdown runs out, but the timer is a pass/fail mechanic, not a scoring multiplier.",
      },
      {
        heading: "Hints",
        body: "Stuck? Most puzzles offer a hint system. Tapping the hint button reveals a clue to nudge you in the right direction. Using hints has zero penalty — you still earn the full points and XP. They're there to keep you moving forward, not to punish you.",
      },
      {
        heading: "Puzzle-Specific Leaderboards",
        body: "Many puzzles have a speed leaderboard that tracks how fast players solved them. Even though speed doesn't affect your point reward, topping a puzzle's speed board is a badge of honour.",
      },
    ],
    tips: [
      "Use the 'Learn' section if you want structured tracks that teach you concepts progressively.",
      "Each puzzle category has its own overall leaderboard, so specializing in one type can still earn you a top spot.",
    ],
    cta: { label: "Browse Puzzles", href: "/puzzles" },
  },
  {
    id: "daily",
    icon: "📅",
    accent: "#10b981",
    title: "Daily Challenges",
    eyebrow: "Come Back Every Day",
    intro:
      "PuzzleWarz features two daily activities designed to keep you engaged: the Daily Puzzle and the Frequency game. Both reset every 24 hours and reward consistent play.",
    details: [
      {
        heading: "Daily Puzzle",
        body: "Every day at midnight UTC, a brand-new featured puzzle goes live. It's available for exactly 24 hours. Solving it earns you standard points plus a Daily Streak bonus. Your streak counter tracks how many consecutive days you've completed the daily puzzle.",
      },
      {
        heading: "Streak Bonuses",
        body: "The longer your unbroken streak, the bigger your bonus. Missing even one day resets your streak to zero, so consistency is key. The streak bonus is added on top of the base puzzle reward.",
      },
      {
        heading: "Frequency",
        body: "Frequency is a daily opinion/prediction question. A new question drops every 24 hours. Your answer is compared against the community — it's part trivia, part social experiment. Building a Frequency streak earns its own set of bonus rewards.",
      },
    ],
    tips: [
      "Set a reminder if you want to maintain your streak — one missed day and it's back to zero.",
      "Daily puzzles tend to rotate between difficulty levels, so some days are easier than others.",
    ],
    cta: { label: "Today's Daily Puzzle", href: "/daily" },
  },
  {
    id: "warz",
    icon: "⚔️",
    accent: "#FDE74C",
    title: "Warz Mode",
    eyebrow: "Head-to-Head Battles",
    intro:
      "Warz Mode is PuzzleWarz's competitive multiplayer feature. Challenge another player to a head-to-head puzzle duel, wager your points, and see who solves it first.",
    details: [
      {
        heading: "How It Works",
        body: "You and your opponent are given the same puzzle at the same time. The first to solve it wins the wager. If neither solves it within the time limit, the match is a draw and wagers are returned.",
      },
      {
        heading: "Wagering Points",
        body: "Before a match begins, both players agree on a point wager. The winner takes the loser's wager. Choose your wager carefully — going all-in can be thrilling, but losing a high-stakes match stings.",
      },
      {
        heading: "Matchmaking",
        body: "You can challenge a specific player by username, or use the matchmaking queue to be paired with someone near your skill level. Matchmaking considers your total points and win/loss record.",
      },
      {
        heading: "Warz Record",
        body: "Your Warz win/loss record is tracked on your profile. A strong Warz record shows other players you're a serious competitor. There's no penalty beyond losing your wager, so don't be afraid to jump in.",
      },
    ],
    tips: [
      "Start with small wagers while you get the hang of competitive solving.",
      "Specialise in a puzzle category and challenge opponents to that type for an edge.",
    ],
    cta: { label: "Enter Warz Mode", href: "/warz" },
  },
  {
    id: "cipher-clash",
    icon: "🔐",
    accent: "#f59e0b",
    title: "Cipher Clash",
    eyebrow: "Decode & Deny",
    intro:
      "Cipher Clash is a unique word game exclusive to PuzzleWarz. You're given phrases encoded with a substitution cipher and must decode them under time pressure. Each phrase you crack claims its letter mappings — and in Warz Mode, your opponent loses access to those freebies.",
    details: [
      {
        heading: "Substitution Cipher",
        body: "Every letter in the alphabet is swapped for a different letter. The same swap applies consistently — if A becomes X in one word, it's X everywhere. Your job is to figure out the original phrases from the encoded text.",
      },
      {
        heading: "Claiming Mappings",
        body: "When you correctly decode a phrase, you 'claim' every letter mapping in it. Claimed mappings auto-reveal in all remaining phrases, making them progressively easier to solve. In Warz Mode, your opponent doesn't get these reveals — only you do.",
      },
      {
        heading: "Combo System",
        body: "Solving consecutive phrases without a mistake builds a combo multiplier. A 3x combo means triple bonus points. One wrong guess resets your combo to zero, so accuracy matters as much as speed.",
      },
      {
        heading: "Strategy",
        body: "Do you rush easy phrases to claim common letters (E, T, A) and starve your opponent? Or do you spend time cracking a long phrase that reveals many mappings at once? The tension between speed and strategy is what makes Cipher Clash unique.",
      },
    ],
    tips: [
      "Look for short words first — two and three-letter words have few possibilities and can reveal key mappings.",
      "Common letter patterns (TH, ING, TION, THE) are your best friends for cracking the cipher.",
    ],
    cta: { label: "Browse Puzzles", href: "/puzzles" },
  },
  {
    id: "teams",
    icon: "👥",
    accent: "#a78bfa",
    title: "Teams",
    eyebrow: "Strength in Numbers",
    intro:
      "Puzzle solving doesn't have to be a solo journey. Teams let you collaborate with other players, tackle co-op challenges, and compete as a group on the team leaderboard.",
    details: [
      {
        heading: "Creating a Team",
        body: "Head to the Teams page and click 'Create Team'. Choose a name, set a description, and decide whether your team is open (anyone can join) or invite-only. You become the team leader.",
      },
      {
        heading: "Joining a Team",
        body: "Browse existing teams and request to join one that interests you. Open teams let you join instantly; invite-only teams require approval from the leader. You can only belong to one team at a time.",
      },
      {
        heading: "Team Lobby",
        body: "Once you're on a team, the team lobby is your shared space. Here you can chat with teammates, see who's online, and launch co-operative puzzles that require multiple solvers working together.",
      },
      {
        heading: "Team Leaderboard",
        body: "Every puzzle your team members solve adds to your team's combined score. Teams are ranked on a dedicated leaderboard. Climb the ranks together and earn bragging rights.",
      },
      {
        heading: "Team Size",
        body: "Teams can have up to 20 members. Larger teams have more firepower for co-op puzzles, but every member's contribution counts.",
      },
    ],
    tips: [
      "To switch teams, you must leave your current team first.",
      "Active teams with regular players tend to climb the leaderboard fastest.",
    ],
    cta: { label: "Find a Team", href: "/teams" },
  },
  {
    id: "leaderboards",
    icon: "🏆",
    accent: "#f59e0b",
    title: "Leaderboards & Rankings",
    eyebrow: "Compete Globally",
    intro:
      "PuzzleWarz has multiple leaderboard systems so you can compete at every level — globally, weekly, by puzzle type, and as a team.",
    details: [
      {
        heading: "Global Leaderboard",
        body: "The all-time global leaderboard ranks every player by their total accumulated points. This is the definitive ranking and the one displayed on your profile.",
      },
      {
        heading: "Weekly Leaderboard",
        body: "The weekly board resets every Monday at midnight UTC. It tracks points earned in the current week only, giving newer players a chance to shine without competing against years of accumulated points.",
      },
      {
        heading: "Puzzle-Specific Leaderboards",
        body: "Many individual puzzles track the fastest solve times. If you crack a puzzle faster than anyone else, your name sits at the top of that puzzle's speed board.",
      },
      {
        heading: "Team Leaderboard",
        body: "Teams are ranked by the combined scores of all their members. This encourages active recruitment and collaboration — a strong team is one where everyone contributes.",
      },
    ],
    tips: [
      "The weekly leaderboard is your best shot at ranking high early on — focus your effort there.",
      "Puzzle speed boards don't affect your point earnings, but they're a great way to show off.",
    ],
    cta: { label: "View Leaderboards", href: "/leaderboards" },
  },
  {
    id: "xp",
    icon: "⬆️",
    accent: "#818cf8",
    title: "XP & Leveling Up",
    eyebrow: "Progression System",
    intro:
      "Every action on PuzzleWarz earns you XP (experience points). XP is separate from points — points determine your leaderboard rank, while XP determines your level.",
    details: [
      {
        heading: "How XP Works",
        body: "You earn XP by solving puzzles, completing daily challenges, maintaining streaks, and participating in Warz matches. Harder puzzles and longer streaks award more XP.",
      },
      {
        heading: "Leveling Up",
        body: "As you accumulate XP, you level up. Your current level and progress bar are displayed in the navigation bar and on your profile. Each level requires progressively more XP, so early levels come fast and later ones feel more earned.",
      },
      {
        heading: "Titles",
        body: "Certain level milestones unlock titles that appear next to your name. These are automatic — hit the required level and the title is yours. Higher titles signal experience and dedication.",
      },
      {
        heading: "XP vs Points",
        body: "Points and XP are two separate currencies. Points feed leaderboards and can be wagered in Warz Mode. XP is a permanent measure of your total activity — it never goes down, even if you lose points in a wager.",
      },
    ],
    tips: [
      "XP can never decrease, so every puzzle you attempt is forward progress.",
      "Daily streak bonuses are one of the fastest ways to gain XP consistently.",
    ],
    cta: { label: "View Your Profile", href: "/profile" },
  },
  {
    id: "season-pass",
    icon: "🏅",
    accent: "#ec4899",
    title: "Season Pass",
    eyebrow: "Seasonal Rewards",
    intro:
      "The Season Pass is a seasonal progression track that rewards you with cosmetics, tokens, and bonuses as you play. Each season lasts about 3 months and features both free and premium reward tiers.",
    details: [
      {
        heading: "Free vs Premium",
        body: "Every player gets the free track, which includes basic rewards at regular intervals. The premium track ($4.99 per season) dramatically expands the reward pool with exclusive cosmetics, bonus XP multipliers, and special items.",
      },
      {
        heading: "How to Progress",
        body: "The Season Pass advances based on XP earned. Every puzzle you solve, every streak you maintain, and every Warz match you play pushes you further along the track. There's no separate currency — just play normally and you'll progress.",
      },
      {
        heading: "Claiming Rewards",
        body: "As you reach each tier, a reward becomes available to claim. You must manually claim it from the Season Pass page. Unclaimed rewards expire when the season ends, so check back regularly.",
      },
      {
        heading: "Mid-Season Upgrade",
        body: "You can buy the premium pass at any point during the season. When you do, all premium rewards for tiers you've already passed are retroactively unlocked — you never miss out.",
      },
      {
        heading: "End of Season",
        body: "When a season ends, unclaimed rewards disappear and the track resets with a new theme and new rewards. Cosmetics you've already claimed are permanently yours.",
      },
    ],
    tips: [
      "If you play regularly, the premium pass easily pays for itself in exclusive cosmetics and XP boosts.",
      "Claim your rewards as you earn them — don't wait until the end of the season.",
    ],
    cta: { label: "View Season Pass", href: "/season-pass" },
  },
  {
    id: "achievements",
    icon: "🎖️",
    accent: "#f59e0b",
    title: "Achievements",
    eyebrow: "Milestones & Badges",
    intro:
      "Achievements are badges you unlock by hitting specific milestones. They're displayed on your profile and serve as proof of your accomplishments across the platform.",
    details: [
      {
        heading: "How to Unlock",
        body: "Achievements are triggered automatically when you meet their criteria — solve 10 puzzles, win 5 Warz matches, maintain a 7-day streak, etc. You'll get a notification when you unlock one.",
      },
      {
        heading: "Achievement Categories",
        body: "Achievements span every part of the platform: puzzle solving, Warz victories, streak milestones, team contributions, speed records, and more. Collecting them all is a long-term goal that gives you reasons to try every feature.",
      },
      {
        heading: "Profile Display",
        body: "Your unlocked achievements appear on your public profile. Other players can see what you've accomplished, and a high achievement count signals a well-rounded player.",
      },
    ],
    tips: [
      "Check the Achievements page to see which ones you're close to — sometimes you're one puzzle away from a new badge.",
      "Some achievements are hidden until unlocked, adding a surprise element to the grind.",
    ],
    cta: { label: "View Achievements", href: "/achievements" },
  },
  {
    id: "store",
    icon: "🛍️",
    accent: "#a78bfa",
    title: "Store & Cosmetics",
    eyebrow: "Customize Your Identity",
    intro:
      "The Store is where you can browse and acquire cosmetic items to personalize your profile. Avatars, titles, flairs, and other visual customizations are available here.",
    details: [
      {
        heading: "What's Available",
        body: "The store features avatar frames, profile flairs (emojis that appear next to your name), display titles, and other visual items. New items rotate in periodically, and seasonal exclusives appear during special events.",
      },
      {
        heading: "Equipping Cosmetics",
        body: "After acquiring a cosmetic, go to your Profile page and open the Cosmetics drawer. From there you can equip or swap items. Your equipped cosmetics are visible to everyone who views your profile or sees your name on leaderboards.",
      },
      {
        heading: "Exclusive Items",
        body: "Some cosmetics are earned through the Season Pass, achievements, or special events and can't be bought in the store. These are the rarest and most prestigious items you can own.",
      },
    ],
    tips: [
      "Check the store regularly — items rotate and limited-time offers won't last forever.",
      "Season Pass exclusives show everyone you were active during that season.",
    ],
    cta: { label: "Browse the Store", href: "/store" },
  },
  {
    id: "debrief",
    icon: "🔍",
    accent: "#7C3AED",
    title: "The Debrief",
    eyebrow: "Special Content",
    intro:
      "Beyond standard puzzles, PuzzleWarz offers immersive experiences that push your problem-solving skills to the limit.",
    details: [
      {
        heading: "The Debrief",
        body: "The Debrief presents detective-style case files. You're given an incident report to read, then asked timed questions about what you observed. It tests reading comprehension, attention to detail, and deductive reasoning.",
      },
    ],
    tips: [
      "Read the report carefully the first time — you won't be able to re-read it once questions start.",
    ],
    cta: { label: "Read The Debrief", href: "/debrief" },
  },
  {
    id: "community",
    icon: "💬",
    accent: "#3891A6",
    title: "Community & Social",
    eyebrow: "Connect with Players",
    intro:
      "PuzzleWarz isn't just about solving — it's about connecting with a community of puzzle enthusiasts. Here's how to engage with other players.",
    details: [
      {
        heading: "Forum",
        body: "The Forum is a discussion space where players share strategies, ask for help, discuss puzzle design, and connect. You can create posts, comment on others, and build your reputation in the community.",
      },
      {
        heading: "Direct Messages",
        body: "Send private messages to any player on the platform. Use DMs to coordinate with teammates, challenge rivals, or just chat about a tricky puzzle.",
      },
      {
        heading: "Player Profiles",
        body: "Every player has a public profile showing their stats, achievements, cosmetics, Warz record, and recent activity. Visit other players' profiles from leaderboards, the forum, or by searching their username.",
      },
      {
        heading: "Notifications",
        body: "The bell icon in the navigation bar shows your notifications — team invites, Warz challenges, achievement unlocks, and more. Check it regularly so you don't miss anything.",
      },
    ],
    tips: [
      "Being active on the forum is a great way to find teammates and learn new solving strategies.",
      "You can follow other players to keep track of their activity.",
    ],
    cta: { label: "Visit the Forum", href: "/forum" },
  },
];

/* ── Progress tracker (localStorage) ──────────────────────────────── */

function useReadSections() {
  const [read, setRead] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Reads browser-only storage after mount so server and first client render match;
    // deliberately synchronous — there's no external subscription to hook into.
    try {
      const stored = localStorage.getItem("pw_tutorial_read");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (stored) setRead(new Set(JSON.parse(stored)));
    } catch {}
  }, []);

  function markRead(id: string) {
    setRead((prev) => {
      const next = new Set(prev);
      next.add(id);
      try {
        localStorage.setItem("pw_tutorial_read", JSON.stringify([...next]));
      } catch {}
      return next;
    });
  }

  return { read, markRead };
}

/* ── Section card component ───────────────────────────────────────── */

function SectionCard({
  section,
  index,
  isRead,
  onMarkRead,
}: {
  section: TutorialSection;
  index: number;
  isRead: boolean;
  onMarkRead: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  function toggle() {
    const willExpand = !expanded;
    setExpanded(willExpand);
    if (willExpand) onMarkRead();
  }

  useEffect(() => {
    if (expanded && ref.current) {
      setTimeout(() => {
        ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
    }
  }, [expanded]);

  return (
    <div
      ref={ref}
      id={`section-${section.id}`}
      style={{
        background: expanded
          ? "linear-gradient(160deg, rgba(7,15,18,0.95) 0%, rgba(4,8,10,0.9) 60%, rgba(2,2,2,0.85) 100%)"
          : "rgba(255,255,255,0.02)",
        border: `1px solid ${expanded ? `${section.accent}55` : "rgba(255,255,255,0.06)"}`,
        borderRadius: 20,
        transition: "all 0.3s ease",
        boxShadow: expanded ? `0 0 40px ${section.accent}15, 0 16px 48px rgba(0,0,0,0.4)` : "none",
        scrollMarginTop: 80,
      }}
    >
      {/* Header (always visible) */}
      <button
        onClick={toggle}
        className="w-full text-left px-6 py-5 flex items-center gap-4"
        style={{ background: "none", border: "none", cursor: "pointer" }}
      >
        {/* Step number */}
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: isRead
              ? `linear-gradient(135deg, ${section.accent}30, ${section.accent}10)`
              : "rgba(255,255,255,0.04)",
            border: `1.5px solid ${isRead ? `${section.accent}55` : "rgba(255,255,255,0.08)"}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
            flexShrink: 0,
            transition: "all 0.3s",
          }}
        >
          {isRead ? (
            <span style={{ color: section.accent, fontSize: 16 }}>✓</span>
          ) : (
            <span style={{ color: "#6b7280", fontSize: 13, fontWeight: 700 }}>{index + 1}</span>
          )}
        </div>

        {/* Icon + title */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span style={{ fontSize: 18 }}>{section.icon}</span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: section.accent,
              }}
            >
              {section.eyebrow}
            </span>
          </div>
          <p className="text-base font-bold text-white truncate">{section.title}</p>
        </div>

        {/* Expand indicator */}
        <span
          style={{
            color: "#6b7280",
            fontSize: 20,
            transition: "transform 0.25s",
            transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
            flexShrink: 0,
          }}
        >
          ▾
        </span>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div
          className="px-6 pb-6"
          style={{
            animation: "tutorialFadeIn 0.3s ease",
          }}
        >
          {/* Accent line */}
          <div
            style={{
              height: 2,
              borderRadius: 1,
              background: `linear-gradient(90deg, ${section.accent}, transparent)`,
              marginBottom: 20,
              opacity: 0.4,
            }}
          />

          {/* Intro */}
          <p
            className="text-sm leading-relaxed mb-6"
            style={{ color: "#9ca3af" }}
          >
            {section.intro}
          </p>

          {/* Detail blocks */}
          <div className="flex flex-col gap-4 mb-6">
            {section.details.map((d) => (
              <div
                key={d.heading}
                style={{
                  padding: "16px 20px",
                  borderRadius: 14,
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.05)",
                }}
              >
                <p
                  className="text-sm font-bold mb-2"
                  style={{ color: "#e5e7eb" }}
                >
                  {d.heading}
                </p>
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: "#6b7280" }}
                >
                  {d.body}
                </p>
              </div>
            ))}
          </div>

          {/* Tips */}
          <div
            style={{
              padding: "16px 20px",
              borderRadius: 14,
              background: `${section.accent}08`,
              border: `1px solid ${section.accent}20`,
              marginBottom: 20,
            }}
          >
            <p
              className="text-xs font-bold mb-2"
              style={{
                color: section.accent,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}
            >
              Pro Tips
            </p>
            <ul className="flex flex-col gap-2">
              {section.tips.map((tip, i) => (
                <li
                  key={i}
                  className="text-sm leading-relaxed flex gap-2"
                  style={{ color: "#9ca3af" }}
                >
                  <span style={{ color: section.accent, flexShrink: 0 }}>
                    →
                  </span>
                  {tip}
                </li>
              ))}
            </ul>
          </div>

          {/* CTA */}
          <Link
            href={section.cta.href}
            className="inline-flex items-center gap-2 text-sm font-bold transition-all duration-200 hover:brightness-110"
            style={{
              padding: "10px 20px",
              borderRadius: 12,
              background: `linear-gradient(135deg, ${section.accent}, ${section.accent}cc)`,
              border: `1px solid ${section.accent}80`,
              boxShadow: `0 4px 16px ${section.accent}30`,
              color: "#fff",
              letterSpacing: "0.04em",
              textDecoration: "none",
            }}
          >
            {section.cta.label} →
          </Link>
        </div>
      )}
    </div>
  );
}

/* ── Sidebar nav (desktop) ────────────────────────────────────────── */

function SidebarNav({
  sections,
  readSet,
  activeId,
}: {
  sections: TutorialSection[];
  readSet: Set<string>;
  activeId: string | null;
}) {
  return (
    <nav
      className="hidden lg:flex flex-col gap-1 sticky top-20"
      style={{ width: 240, flexShrink: 0 }}
    >
      <p
        className="text-xs font-bold mb-3 px-3"
        style={{
          color: "#3891A6",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
        }}
      >
        Chapters
      </p>
      {sections.map((s) => {
        const isActive = activeId === s.id;
        const isRead = readSet.has(s.id);
        return (
          <a
            key={s.id}
            href={`#section-${s.id}`}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-200"
            style={{
              color: isActive ? "#fff" : isRead ? s.accent : "#6b7280",
              backgroundColor: isActive ? "rgba(56,145,166,0.1)" : "transparent",
              borderLeft: isActive ? `2px solid ${s.accent}` : "2px solid transparent",
              textDecoration: "none",
              fontWeight: isActive ? 700 : 500,
            }}
          >
            <span style={{ fontSize: 14 }}>{s.icon}</span>
            <span className="truncate">{s.title}</span>
            {isRead && !isActive && (
              <span style={{ color: s.accent, fontSize: 11, marginLeft: "auto" }}>✓</span>
            )}
          </a>
        );
      })}
    </nav>
  );
}

/* ── Main page ─────────────────────────────────────────────────────── */

export default function TutorialPage() {
  const { read, markRead } = useReadSections();
  const [activeId, setActiveId] = useState<string | null>(null);

  const progress = Math.round((read.size / SECTIONS.length) * 100);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const id = entry.target.id.replace("section-", "");
            setActiveId(id);
            break;
          }
        }
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0 }
    );

    const els = document.querySelectorAll('[id^="section-"]');
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <style>{`
        @keyframes tutorialFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <Navbar />
      <main
        className="min-h-screen pt-24 pb-20 px-4"
        style={{ backgroundColor: "#020202" }}
      >
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div
            className="mb-10 pb-8"
            style={{ borderBottom: "1px solid rgba(56,145,166,0.2)" }}
          >
            <p
              className="text-xs tracking-widest uppercase mb-3"
              style={{ color: "#3891A6" }}
            >
              Player&apos;s Handbook
            </p>
            <h1
              className="text-4xl font-black mb-4"
              style={{ color: "#fff", letterSpacing: "-0.02em" }}
            >
              How to Play PuzzleWarz
            </h1>
            <p
              className="text-sm leading-relaxed mb-6"
              style={{ color: "#888", maxWidth: 600 }}
            >
              Everything you need to know in one place. Read through each
              section at your own pace — your progress is saved automatically.
            </p>

            {/* Progress bar */}
            <div className="flex items-center gap-3" style={{ maxWidth: 400 }}>
              <div
                className="flex-1 h-2 rounded-full overflow-hidden"
                style={{ background: "rgba(56,145,166,0.12)" }}
              >
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${progress}%`,
                    background:
                      progress === 100
                        ? "linear-gradient(90deg, #10b981, #34d399)"
                        : "linear-gradient(90deg, #3891A6, #60a5fa)",
                  }}
                />
              </div>
              <span
                className="text-xs font-bold"
                style={{
                  color: progress === 100 ? "#10b981" : "#3891A6",
                  minWidth: 36,
                }}
              >
                {progress}%
              </span>
            </div>
            {progress === 100 && (
              <p className="text-xs mt-2" style={{ color: "#10b981" }}>
                You&apos;ve read every section — you&apos;re ready to dominate!
              </p>
            )}
          </div>

          {/* Layout: sidebar + sections */}
          <div className="flex gap-10">
            <SidebarNav
              sections={SECTIONS}
              readSet={read}
              activeId={activeId}
            />

            {/* Sections */}
            <div className="flex-1 flex flex-col gap-4 min-w-0">
              {SECTIONS.map((section, i) => (
                <SectionCard
                  key={section.id}
                  section={section}
                  index={i}
                  isRead={read.has(section.id)}
                  onMarkRead={() => markRead(section.id)}
                />
              ))}

              {/* Footer */}
              <div
                className="mt-10 pt-8 flex flex-wrap gap-6"
                style={{ borderTop: "1px solid rgba(56,145,166,0.2)" }}
              >
                <Link
                  href="/faq"
                  className="text-sm hover:opacity-80 transition-opacity"
                  style={{ color: "#3891A6" }}
                >
                  FAQ
                </Link>
                <Link
                  href="/learn"
                  className="text-sm hover:opacity-80 transition-opacity"
                  style={{ color: "#3891A6" }}
                >
                  Learning Paths
                </Link>
                <Link
                  href="/dashboard"
                  className="text-sm hover:opacity-80 transition-opacity"
                  style={{ color: "#3891A6" }}
                >
                  ← Back to Dashboard
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
