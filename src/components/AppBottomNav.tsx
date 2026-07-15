"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

const HIDDEN_PREFIXES = ["/auth", "/admin", "/coming-soon"];

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? "#3891A6" : "none"} stroke={active ? "#3891A6" : "#6b7280"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function CalendarIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "#3891A6" : "#6b7280"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
      {active && <circle cx="12" cy="16" r="2" fill="#3891A6" stroke="none" />}
    </svg>
  );
}

function GridIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "#3891A6" : "#6b7280"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </svg>
  );
}

function TrophyIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "#3891A6" : "#6b7280"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="8 21 12 21 16 21" />
      <line x1="12" y1="17" x2="12" y2="21" />
      <path d="M7 4H17L17 11a5 5 0 0 1-10 0V4z" />
      <path d="M7 4H4v3a3 3 0 0 0 3 3" />
      <path d="M17 4h3v3a3 3 0 0 1-3 3" />
    </svg>
  );
}

function UserIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "#3891A6" : "#6b7280"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

const TABS = [
  { href: "/",            label: "Home",       Icon: HomeIcon },
  { href: "/daily",       label: "Daily",      Icon: CalendarIcon },
  { href: "/puzzles",     label: "Puzzles",    Icon: GridIcon },
  { href: "/leaderboards",label: "Leaders",   Icon: TrophyIcon },
  { href: "/profile",     label: "Profile",    Icon: UserIcon },
];

export default function AppBottomNav() {
  const pathname = usePathname();
  const { data: session } = useSession();

  if (HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))) return null;

  return (
    <nav
      // Primary nav below the "nav:" breakpoint (1032px, see .pw-bottom-nav in
      // globals.css) — the same width Navbar switches from its mobile layout to
      // the full desktop link row — so the two nav systems hand off with no gap
      // or overlap. Desktop keeps the top nav only.
      className="pw-bottom-nav"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 200,
        background: "rgba(8,8,8,0.97)",
        borderTop: "1px solid rgba(56,145,166,0.18)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      {TABS.map(({ href, label, Icon }) => {
        const resolvedHref =
          href === "/profile" && !session
            ? "/auth/signin"
            : href;

        const isActive =
          href === "/" ? pathname === "/" : pathname.startsWith(href);

        return (
          <Link
            key={href}
            href={resolvedHref}
            className="pw-press"
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 3,
              padding: "10px 0 8px",
              textDecoration: "none",
              position: "relative",
            }}
          >
            {/* Active indicator bar */}
            {isActive && (
              <span style={{
                position: "absolute",
                top: 0,
                left: "20%",
                right: "20%",
                height: 2,
                borderRadius: "0 0 2px 2px",
                background: "linear-gradient(90deg, #3891A6, #38D399)",
              }} />
            )}
            <Icon active={isActive} />
            <span style={{
              fontSize: 10,
              fontWeight: isActive ? 700 : 500,
              color: isActive ? "#3891A6" : "#6b7280",
              letterSpacing: "0.02em",
            }}>
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
