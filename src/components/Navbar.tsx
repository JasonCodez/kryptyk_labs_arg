"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useEffect, useState, useRef } from "react";
import NotificationBell from "@/components/notifications/NotificationBell";
import MessagesBell from "@/components/notifications/MessagesBell";
import { FEATURE_STORE_ENABLED, FEATURE_SEASONS_ENABLED } from "@/lib/featureFlags";

interface UserInfo {
  id: string;
  role: string;
  image?: string | null;
  level?: number;
  title?: string;
  currentXp?: number;
  nextLevelXp?: number;
  progress?: number;
  activeFlair?: string | null;
  activeTitle?: string | null;
  isPremium?: boolean;
  unclaimedSeasonRewards?: number;
}

/* Nav link config */
const ALL_NAV_LINKS = [
  { href: "/dashboard",   label: "Dashboard", emoji: null },
  { href: "/puzzles",     label: "Puzzles",   emoji: null },
  { href: "/daily",       label: "Daily",     emoji: "🟩" },
  // Accents must stay literal hex (not var()) — they get "bb" alpha suffixes
  // appended below. Values are the brand tokens: gold #FED007, primary #03ACF4.
  { href: "/warz",        label: "Warz",      emoji: "⚔️", accent: "#FED007" },
  { href: "/season-pass", label: "Season",    emoji: "🏅", accent: "#FED007", enabled: FEATURE_SEASONS_ENABLED, tourId: "tour-season" },
  { href: "/store",       label: "Store",     emoji: "🛍️", accent: "#03ACF4", enabled: FEATURE_STORE_ENABLED },
  { href: "/leaderboards",label: "Ranks",     emoji: null },
];
const NAV_LINKS = ALL_NAV_LINKS.filter(l => !('enabled' in l) || l.enabled);

const MORE_LINKS = [
  { href: "/debrief",      label: "The Debrief 🔍" },
  { href: "/frequency",    label: "Frequency 📡" },
  { href: "/forum",        label: "Forum 💬" },
  { href: "/teams",        label: "Teams" },
  { href: "/achievements", label: "Achievements" },
  { href: "/learn",        label: "Learn" },
  { href: "/tutorial",     label: "Tutorial 📖" },
  { href: "/faq",          label: "FAQ" },
  { href: "/report-bug",   label: "Report a Bug 🐞" },
];

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname.startsWith(href);
}

// In the installed app (standalone PWA), the top navbar is normally replaced entirely by
// AppBottomNav's tab bar. But the bottom bar only covers 5 fixed destinations, so on these
// pages — the individual puzzle-solving view, leaderboards, profile, and home — players had
// no way to reach Store, Settings, Search, Sign out, etc. Show a compact hamburger trigger
// (not the full bar) on just these pages so the rest of the app stays reachable.
function isStandaloneHamburgerPage(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname.startsWith("/puzzles/") ||
    pathname.startsWith("/leaderboards") ||
    pathname.startsWith("/profile")
  );
}

export default function Navbar({ isStandalone = false }: { isStandalone?: boolean }) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (session?.user?.email) {
      fetchUserInfo();
    } else {
      setLoading(false);
    }
  }, [session?.user?.email]);

  useEffect(() => {
    const handler = () => fetchUserInfo();
    window.addEventListener('puzzlewarz:xp-updated', handler);
    return () => window.removeEventListener('puzzlewarz:xp-updated', handler);
  }, []);

  const fetchUserInfo = async () => {
    try {
      const response = await fetch("/api/user/info");
      if (response.ok) {
        const data = await response.json();
        setUserInfo(data);
      }
    } catch (error) {
      console.error("Failed to fetch user info:", error);
    } finally {
      setLoading(false);
    }
  };

  const getUserId = () => {
    const sessionUser = session?.user as { id?: string } | undefined;
    return userInfo?.id || sessionUser?.id || "";
  };

  const handleSignOut = async () => {
    try {
      await signOut({ callbackUrl: '/auth/signin?logout=true' });
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const avatarSrc = userInfo?.image || "/images/default-avatar.svg";

  if (isStandalone && !isStandaloneHamburgerPage(pathname)) {
    return null;
  }

  return (
    <>
    {isStandalone ? (
      <button
        aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
        onClick={() => setMobileOpen(!mobileOpen)}
        className="flex flex-col justify-center items-center w-10 h-10"
        style={{
          position: "fixed",
          top: "calc(env(safe-area-inset-top, 0px) + 12px)",
          right: 12,
          zIndex: 50,
          borderRadius: 10,
          backgroundColor: "rgba(6, 8, 14, 0.88)",
          backdropFilter: "blur(16px) saturate(1.4)",
          WebkitBackdropFilter: "blur(16px) saturate(1.4)",
          border: "1px solid var(--pw-border-default)",
        }}
      >
        <span
          className={`block h-0.5 w-5 rounded bg-white transition-all duration-300 ${mobileOpen ? 'rotate-45 translate-y-1.5' : ''}`}
        ></span>
        <span
          className={`block h-0.5 w-5 rounded bg-white my-1 transition-all duration-300 ${mobileOpen ? 'opacity-0' : ''}`}
        ></span>
        <span
          className={`block h-0.5 w-5 rounded bg-white transition-all duration-300 ${mobileOpen ? '-rotate-45 -translate-y-1.5' : ''}`}
        ></span>
      </button>
    ) : (
    <nav
      id="global-nav"
      className={`fixed w-full top-0 z-50${mobileOpen ? ' nav-mobile-open' : ''}`}
      style={{
        background: "linear-gradient(180deg, rgba(19,24,41,0.94), rgba(11,14,26,0.94))",
        backdropFilter: "blur(16px) saturate(1.4)",
        WebkitBackdropFilter: "blur(16px) saturate(1.4)",
        borderBottom: "1px solid color-mix(in srgb, var(--pw-brand-primary) 35%, transparent)",
        boxShadow: "0 1px 0 color-mix(in srgb, var(--pw-brand-secondary) 25%, transparent), 0 10px 30px -12px color-mix(in srgb, var(--pw-brand-primary) 45%, transparent)",
      }}
    >
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Logo */}
        {session ? (
          <div className="flex items-center gap-2.5 select-none shrink-0" aria-disabled="true" role="img" tabIndex={-1}>
            <img src="/images/puzzle_warz_logo.png" alt="Puzzle Warz Logo" className="h-8 w-auto" />
            <span
              className="text-sm font-black tracking-widest uppercase hidden sm:block"
              style={{ color: "var(--pw-brand-secondary)", textShadow: "0 0 16px color-mix(in srgb, var(--pw-brand-secondary) 45%, transparent)" }}
            >
              Puzzle Warz
            </span>
          </div>
        ) : (
          <Link href="/" className="flex items-center gap-2.5 hover:opacity-80 transition shrink-0">
            <img src="/images/puzzle_warz_logo.png" alt="Puzzle Warz Logo" className="h-8 w-auto" />
            <span
              className="text-sm font-black tracking-widest uppercase hidden sm:block"
              style={{ color: "var(--pw-brand-secondary)", textShadow: "0 0 16px color-mix(in srgb, var(--pw-brand-secondary) 45%, transparent)" }}
            >
              Puzzle Warz
            </span>
          </Link>
        )}

        {/* Mobile utility strip. Primary nav lives in AppBottomNav below the "nav:"
            breakpoint; overflow (Forum, Store, Warz, Season Pass, Teams, Achievements,
            Settings, Sign out, etc.) lives in this drawer under "More" — the menu
            button below is the only way to open that drawer on mobile web (the
            standalone/installed-app hamburger above is a separate trigger for a
            different display mode, not a substitute for this one). */}
        {!mobileOpen && (
          <div className="mobile-nav-utility flex items-center gap-1.5">
            {session && !loading ? (
              <>
                <Link
                  href="/search"
                  aria-label="Search puzzles"
                  className="w-9 h-9 flex items-center justify-center rounded-lg transition-all duration-200 text-zinc-400 hover:text-white"
                  style={{ backgroundColor: isActive(pathname, "/search") ? "color-mix(in srgb, var(--pw-brand-primary) 15%, transparent)" : "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                  </svg>
                </Link>
                <NotificationBell />
                <MessagesBell />
                <button
                  type="button"
                  aria-label="Open menu"
                  onClick={() => setMobileOpen(true)}
                  className="w-9 h-9 flex items-center justify-center rounded-lg transition-all duration-200 text-zinc-400 hover:text-white"
                  style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="18" x2="20" y2="18" />
                  </svg>
                </button>
              </>
            ) : !loading ? (
              <>
                <Link href="/auth/signin" className="px-3 py-1.5 rounded-lg text-sm font-medium text-zinc-300 transition-all hover:text-white hover:bg-white/5">
                  Sign In
                </Link>
                <Link
                  href="/auth/register"
                  className="px-3 py-1.5 rounded-lg text-sm font-bold transition-all hover:brightness-110"
                  style={{
                    background: "linear-gradient(135deg, var(--pw-brand-primary-light), var(--pw-brand-primary))",
                    color: "var(--pw-text-on-primary)",
                    boxShadow: "0 0 12px color-mix(in srgb, var(--pw-brand-primary) 50%, transparent)",
                  }}
                >
                  Join
                </Link>
              </>
            ) : null}
          </div>
        )}

        {/* Center nav links (desktop) */}
        {session && !mobileOpen && (
          <div className="desktop-nav hidden nav:flex items-center gap-0.5 mx-auto">
            {NAV_LINKS.map((link) => {
              const active = isActive(pathname, link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  id={'tourId' in link ? (link as any).tourId : undefined}
                  className="relative px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-1"
                  style={{
                    color: active
                      ? (link.accent ?? "#fff")
                      : (link.accent ? `${link.accent}bb` : "#9ca3af"),
                    backgroundColor: active ? "color-mix(in srgb, var(--pw-brand-primary) 12%, transparent)" : "transparent",
                  }}
                  onMouseEnter={(e) => {
                    if (!active) e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.05)";
                  }}
                  onMouseLeave={(e) => {
                    if (!active) e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  {link.emoji && <span className="text-sm">{link.emoji}</span>}
                  {link.label}
                  {link.href === "/season-pass" && (userInfo?.unclaimedSeasonRewards ?? 0) > 0 && (
                    <span className="ml-0.5 w-2 h-2 rounded-full animate-pulse flex-shrink-0" style={{ background: "var(--pw-brand-secondary)", boxShadow: "0 0 6px color-mix(in srgb, var(--pw-brand-secondary) 80%, transparent)" }} title={`${userInfo!.unclaimedSeasonRewards} unclaimed reward${userInfo!.unclaimedSeasonRewards !== 1 ? 's' : ''}`} />
                  )}
                  {/* Active indicator bar */}
                  {active && (
                    <span
                      className="absolute -bottom-[9px] left-3 right-3 h-[3px] rounded-full"
                      style={{
                        background: link.accent
                          ? `linear-gradient(90deg, ${link.accent}, ${link.accent}66)`
                          : "linear-gradient(90deg, var(--pw-brand-primary), color-mix(in srgb, var(--pw-brand-primary) 40%, transparent))",
                        boxShadow: `0 0 14px ${link.accent ?? "var(--pw-brand-primary)"}`,
                      }}
                    />
                  )}
                </Link>
              );
            })}
            {/* More dropdown */}
            <div className="relative" ref={moreRef}>
              <button
                onClick={() => setMoreOpen(o => !o)}
                className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-1"
                style={{
                  color: MORE_LINKS.some(l => isActive(pathname, l.href)) ? "#fff" : "#9ca3af",
                  backgroundColor: MORE_LINKS.some(l => isActive(pathname, l.href)) ? "color-mix(in srgb, var(--pw-brand-primary) 12%, transparent)" : "transparent",
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.05)"}
                onMouseLeave={(e) => {
                  if (!MORE_LINKS.some(l => isActive(pathname, l.href)))
                    e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                More
                <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" className={`transition-transform duration-200 ${moreOpen ? "rotate-180" : ""}`}>
                  <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {MORE_LINKS.some(l => isActive(pathname, l.href)) && (
                  <span
                    className="absolute -bottom-[9px] left-3 right-3 h-[2px] rounded-full"
                    style={{ background: "linear-gradient(90deg, var(--pw-brand-primary), color-mix(in srgb, var(--pw-brand-primary) 40%, transparent))", boxShadow: "0 0 8px color-mix(in srgb, var(--pw-brand-primary) 33%, transparent)" }}
                  />
                )}
              </button>
              {moreOpen && (
                <div
                  className="absolute top-full left-1/2 -translate-x-1/2 mt-3 rounded-xl py-1.5 z-50 min-w-[160px] overflow-hidden"
                  style={{ backgroundColor: 'color-mix(in srgb, var(--pw-bg-elevated) 98%, transparent)', border: '1px solid var(--pw-border-default)', boxShadow: '0 12px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,0,0,0.3)', backdropFilter: "blur(12px)" }}
                >
                  {MORE_LINKS.map((link) => {
                    const active = isActive(pathname, link.href);
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        className="block px-4 py-2 text-sm transition-colors"
                        style={{ color: active ? "var(--pw-brand-primary)" : "#9ca3af", backgroundColor: active ? "color-mix(in srgb, var(--pw-brand-primary) 8%, transparent)" : "transparent" }}
                        onClick={() => setMoreOpen(false)}
                        onMouseEnter={(e) => { if (!active) { e.currentTarget.style.color = "#fff"; e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.04)"; }}}
                        onMouseLeave={(e) => { if (!active) { e.currentTarget.style.color = "#9ca3af"; e.currentTarget.style.backgroundColor = "transparent"; }}}
                      >
                        {link.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Right side (desktop) */}
        {!mobileOpen && (
          <div className="desktop-nav hidden nav:flex items-center gap-2 shrink-0">
            {session && !loading ? (
              <>
                <Link
                  href="/search"
                  aria-label="Search puzzles"
                  className="w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-200 text-zinc-400 hover:text-white"
                  style={{ backgroundColor: isActive(pathname, "/search") ? "color-mix(in srgb, var(--pw-brand-primary) 15%, transparent)" : "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                  </svg>
                </Link>
                <NotificationBell onActivate={() => setMobileOpen(false)} />
                <MessagesBell onActivate={() => setMobileOpen(false)} />

                {/* User avatar dropdown */}
                <div className="relative" ref={profileRef}>
                  <button
                    onClick={() => setProfileOpen(o => !o)}
                    className="flex items-center gap-2 pl-2 pr-1.5 py-1 rounded-full transition-all duration-200"
                    style={{
                      backgroundColor: profileOpen ? "color-mix(in srgb, var(--pw-brand-primary) 15%, transparent)" : "rgba(255,255,255,0.04)",
                      border: `1px solid ${profileOpen ? "color-mix(in srgb, var(--pw-brand-primary) 40%, transparent)" : "rgba(255,255,255,0.08)"}`,
                    }}
                    onMouseEnter={(e) => { if (!profileOpen) e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.07)"; }}
                    onMouseLeave={(e) => { if (!profileOpen) e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.04)"; }}
                  >
                    <span className="text-sm font-medium text-zinc-300 max-w-[100px] truncate hidden lg:block">
                      {session.user?.name || "Player"}{userInfo?.isPremium ? " 💎" : ""}
                    </span>
                    <img
                      src={avatarSrc}
                      alt="Avatar"
                      className="h-7 w-7 rounded-full object-cover"
                      style={{ border: "1px solid color-mix(in srgb, var(--pw-brand-primary) 40%, transparent)" }}
                      onError={(e) => { const img = e.currentTarget as HTMLImageElement; img.onerror = null; img.src = '/images/default-avatar.svg'; }}
                    />
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" className={`text-zinc-500 transition-transform duration-200 ${profileOpen ? "rotate-180" : ""}`}>
                      <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>

                  {profileOpen && (
                    <div
                      className="absolute top-full right-0 mt-2 w-64 rounded-xl overflow-hidden z-50"
                      style={{ backgroundColor: 'color-mix(in srgb, var(--pw-bg-elevated) 98%, transparent)', border: '1px solid var(--pw-border-default)', boxShadow: '0 12px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,0,0,0.3)', backdropFilter: "blur(12px)" }}
                    >
                      {/* User info header */}
                      <div className="px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                        <div className="flex items-center gap-3">
                          <img
                            src={avatarSrc}
                            alt="Avatar"
                            className="h-10 w-10 rounded-full object-cover border-2"
                            style={{ borderColor: "var(--pw-brand-primary)", boxShadow: "0 0 10px color-mix(in srgb, var(--pw-brand-primary) 45%, transparent)" }}
                            onError={(e) => { const img = e.currentTarget as HTMLImageElement; img.onerror = null; img.src = '/images/default-avatar.svg'; }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-white truncate">
                              {session.user?.name || session.user?.email}{userInfo?.isPremium ? " 💎" : ""}
                              {userInfo?.activeFlair ? <span style={{ display: 'inline-block', transform: 'translateY(-1px)' }}> {userInfo.activeFlair}</span> : ""}
                            </p>
                            {userInfo?.level !== undefined ? (
                              <p className="text-xs" style={{ color: "var(--pw-brand-primary)" }}>Lv.{userInfo.level} · {userInfo.title}{userInfo.activeTitle === 'founder' ? ' · ⚜️ Founder' : ''}</p>
                            ) : (
                              <p className="text-xs" style={{ color: "var(--pw-brand-primary)" }}>Player</p>
                            )}
                          </div>
                        </div>
                        {/* XP bar */}
                        {userInfo?.level !== undefined && (
                          <div className="mt-2.5">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs" style={{ color: "var(--pw-text-muted)" }}>{userInfo.currentXp} / {userInfo.nextLevelXp} XP</span>
                              <span className="text-xs font-medium" style={{ color: "var(--pw-brand-primary)" }}>{userInfo.progress ?? 0}%</span>
                            </div>
                            <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: "color-mix(in srgb, var(--pw-brand-primary) 12%, transparent)" }}>
                              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${userInfo.progress ?? 0}%`, background: "linear-gradient(90deg, var(--pw-brand-primary), var(--pw-brand-secondary))" }} />
                            </div>
                          </div>
                        )}
                      </div>
                      {/* Dropdown links */}
                      <div className="py-1.5">
                        <Link
                          href="/profile"
                          className="flex items-center gap-2.5 px-4 py-2 text-sm text-zinc-300 transition-colors"
                          onClick={() => setProfileOpen(false)}
                          onMouseEnter={(e) => { e.currentTarget.style.color = "#fff"; e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.04)"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = "#d4d4d8"; e.currentTarget.style.backgroundColor = "transparent"; }}
                        >
                          <span className="text-base w-5 text-center">👤</span> My Profile
                        </Link>

                        <Link
                          href="/settings"
                          className="flex items-center gap-2.5 px-4 py-2 text-sm text-zinc-300 transition-colors"
                          onClick={() => setProfileOpen(false)}
                          onMouseEnter={(e) => { e.currentTarget.style.color = "#fff"; e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.04)"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = "#d4d4d8"; e.currentTarget.style.backgroundColor = "transparent"; }}
                        >
                          <span className="text-base w-5 text-center">⚙️</span> Settings
                        </Link>

                        {userInfo?.role === "ADMIN" && (
                          <Link
                            href="/admin"
                            className="flex items-center gap-2.5 px-4 py-2 text-sm transition-colors"
                            style={{ color: "var(--pw-brand-secondary)" }}
                            onClick={() => setProfileOpen(false)}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "rgba(253,231,76,0.06)"}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                          >
                            <span className="text-base w-5 text-center">🛡️</span> Admin Panel
                          </Link>
                        )}
                      </div>
                      {/* Sign out */}
                      <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }} className="py-1.5">
                        <button
                          onClick={() => { setProfileOpen(false); handleSignOut(); }}
                          className="flex items-center gap-2.5 px-4 py-2 text-sm w-full text-left transition-colors"
                          style={{ color: "var(--pw-error-text)" }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "rgba(220,38,38,0.08)"}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                        >
                          <span className="text-base w-5 text-center">🚪</span> Sign Out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : !loading ? (
              <div className="flex items-center gap-2">
                <Link href="/auth/signin" className="px-3.5 py-1.5 rounded-lg text-sm font-medium text-zinc-300 transition-all hover:text-white hover:bg-white/5">
                  Sign In
                </Link>
                <Link
                  href="/auth/register"
                  className="px-3.5 py-1.5 rounded-lg text-sm font-bold transition-all hover:brightness-110 hover:-translate-y-px"
                  style={{
                    background: "linear-gradient(135deg, var(--pw-brand-primary-light), var(--pw-brand-primary))",
                    color: "var(--pw-text-on-primary)",
                    boxShadow: "0 0 18px color-mix(in srgb, var(--pw-brand-primary) 50%, transparent), 0 2px 0 rgba(255,255,255,0.15) inset",
                  }}
                >
                  Join Now
                </Link>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </nav>
    )}

    {/* Mobile Menu Overlay — z above AppBottomNav (z:200) so the drawer isn't obscured by the
        bottom tab bar when opened from the standalone-mode hamburger trigger. */}
    <div
      className={`fixed inset-0 z-[250] transition-opacity duration-300 ${mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
      style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
      onClick={() => setMobileOpen(false)}
      aria-hidden={!mobileOpen}
    />

    {/* Mobile Menu Drawer */}
    <div
      className={`fixed top-0 right-0 h-full w-full sm:w-80 max-w-full z-[260] shadow-2xl transform transition-transform duration-300 ${mobileOpen ? 'translate-x-0' : 'translate-x-full'}`}
      style={{ background: 'linear-gradient(160deg, var(--pw-surface-2), var(--pw-bg-base))', borderLeft: '1px solid var(--pw-border-default)', boxShadow: '-10px 0 30px -12px color-mix(in srgb, var(--pw-brand-primary) 40%, transparent)', isolation: 'isolate' }}
      role="dialog"
      aria-modal="true"
      aria-label="Mobile navigation menu"
    >
      <div className="flex flex-col h-full overflow-y-auto">
        {/* Drawer header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-2">
            <img src="/images/puzzle_warz_logo.png" alt="Puzzle Warz Logo" className="h-9 w-auto" />
            <span className="text-sm font-black tracking-widest uppercase" style={{ color: 'var(--pw-brand-secondary)', textShadow: '0 0 16px color-mix(in srgb, var(--pw-brand-secondary) 45%, transparent)' }}>Puzzle Warz</span>
          </div>
          <button onClick={() => setMobileOpen(false)} aria-label="Close menu" className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white transition-colors" style={{ backgroundColor: "rgba(255,255,255,0.05)" }}>
            ✕
          </button>
        </div>

        {/* User card (mobile) */}
        {session && !loading && (
          <div className="px-5 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="flex items-center gap-3">
              <img
                src={avatarSrc}
                alt="Avatar"
                className="h-10 w-10 rounded-full object-cover border-2"
                style={{ borderColor: "var(--pw-brand-primary)", boxShadow: "0 0 10px color-mix(in srgb, var(--pw-brand-primary) 45%, transparent)" }}
                onError={(e) => { const img = e.currentTarget as HTMLImageElement; img.onerror = null; img.src = '/images/default-avatar.svg'; }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">
                  {session.user?.name || session.user?.email}{userInfo?.isPremium ? " 💎" : ""}
                  {userInfo?.activeFlair ? <span style={{ display: 'inline-block', transform: 'translateY(-1px)' }}> {userInfo.activeFlair}</span> : ""}
                </p>
                {userInfo?.level !== undefined ? (
                  <>
                    <p className="text-xs" style={{ color: "var(--pw-brand-primary)" }}>Lv.{userInfo.level} · {userInfo.title}</p>
                    <div className="mt-1.5 h-1.5 w-full rounded-full overflow-hidden" style={{ background: "color-mix(in srgb, var(--pw-brand-primary) 12%, transparent)" }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${userInfo.progress ?? 0}%`, background: "linear-gradient(90deg, var(--pw-brand-primary), var(--pw-brand-secondary))" }} />
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: "var(--pw-text-muted)" }}>{userInfo.currentXp} / {userInfo.nextLevelXp} XP</p>
                  </>
                ) : (
                  <p className="text-xs" style={{ color: "var(--pw-brand-primary)" }}>Player</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <NotificationBell onActivate={() => setMobileOpen(false)} />
              <MessagesBell onActivate={() => setMobileOpen(false)} />
            </div>
          </div>
        )}

        {/* Nav links (mobile) */}
        <nav className="flex-1 px-3 py-3">
          {session ? (
            <div className="flex flex-col gap-0.5">
              {[...NAV_LINKS, ...MORE_LINKS].map((link) => {
                const active = isActive(pathname, link.href);
                const accent = 'accent' in link ? (link as typeof NAV_LINKS[number]).accent : undefined;
                const emoji = 'emoji' in link ? (link as typeof NAV_LINKS[number]).emoji : undefined;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-base font-medium transition-all duration-200"
                    style={{
                      color: active ? (accent ?? "#fff") : (accent ? `${accent}bb` : "#9ca3af"),
                      backgroundColor: active ? "color-mix(in srgb, var(--pw-brand-primary) 10%, transparent)" : "transparent",
                      borderLeft: active ? `2px solid ${accent ?? "var(--pw-brand-primary)"}` : "2px solid transparent",
                    }}
                    onClick={() => setMobileOpen(false)}
                  >
                    {emoji && <span>{emoji}</span>}
                    {link.label}
                    {link.href === "/season-pass" && (userInfo?.unclaimedSeasonRewards ?? 0) > 0 && (
                      <span className="ml-auto w-2 h-2 rounded-full animate-pulse flex-shrink-0" style={{ background: "var(--pw-brand-secondary)", boxShadow: "0 0 6px color-mix(in srgb, var(--pw-brand-secondary) 80%, transparent)" }} />
                    )}
                  </Link>
                );
              })}
              <Link
                href="/search"
                className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-base font-medium transition-all duration-200"
                style={{
                  color: isActive(pathname, "/search") ? "var(--pw-brand-primary)" : "#9ca3af",
                  backgroundColor: isActive(pathname, "/search") ? "color-mix(in srgb, var(--pw-brand-primary) 10%, transparent)" : "transparent",
                  borderLeft: isActive(pathname, "/search") ? "2px solid var(--pw-brand-primary)" : "2px solid transparent",
                }}
                onClick={() => setMobileOpen(false)}
              >
                🔍 Search Puzzles
              </Link>
              <div className="my-2" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }} />
              <Link
                href="/profile"
                className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-base font-medium transition-all duration-200"
                style={{
                  color: isActive(pathname, "/profile") ? "var(--pw-brand-primary)" : "#9ca3af",
                  backgroundColor: isActive(pathname, "/profile") ? "color-mix(in srgb, var(--pw-brand-primary) 10%, transparent)" : "transparent",
                  borderLeft: isActive(pathname, "/profile") ? "2px solid var(--pw-brand-primary)" : "2px solid transparent",
                }}
                onClick={() => setMobileOpen(false)}
              >
                👤 My Profile
              </Link>

              <Link
                href="/settings"
                className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-base font-medium transition-all duration-200"
                style={{
                  color: isActive(pathname, "/settings") ? "var(--pw-brand-primary)" : "#9ca3af",
                  backgroundColor: isActive(pathname, "/settings") ? "color-mix(in srgb, var(--pw-brand-primary) 10%, transparent)" : "transparent",
                  borderLeft: isActive(pathname, "/settings") ? "2px solid var(--pw-brand-primary)" : "2px solid transparent",
                }}
                onClick={() => setMobileOpen(false)}
              >
                ⚙️ Settings
              </Link>

              {userInfo?.role === "ADMIN" && (
                <Link
                  href="/admin"
                  className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-base font-medium transition-all duration-200"
                  style={{ color: "var(--pw-brand-secondary)" }}
                  onClick={() => setMobileOpen(false)}
                >
                  🛡️ Admin Panel
                </Link>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-0.5">
              <Link href="/auth/signin" className="px-4 py-2.5 rounded-lg text-base font-medium text-zinc-300 hover:text-white transition-colors" onClick={() => setMobileOpen(false)}>Sign In</Link>
              <Link href="/auth/register" className="px-4 py-2.5 rounded-lg text-base font-bold transition-all hover:brightness-110" style={{ background: 'linear-gradient(135deg, var(--pw-brand-primary-light), var(--pw-brand-primary))', color: 'var(--pw-text-on-primary)', boxShadow: '0 0 18px color-mix(in srgb, var(--pw-brand-primary) 50%, transparent)' }} onClick={() => setMobileOpen(false)}>Join Now</Link>
            </div>
          )}
        </nav>

        {/* Sign out (mobile) */}
        {session && (
          <div className="px-5 py-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <button
              onClick={() => { setMobileOpen(false); handleSignOut(); }}
              className="flex items-center gap-2 w-full px-4 py-2.5 rounded-lg text-sm font-medium transition-all"
              style={{ color: "var(--pw-error-text)", backgroundColor: "rgba(220,38,38,0.06)" }}
            >
              🚪 Sign Out
            </button>
          </div>
        )}
      </div>
    </div>
    </>
  );
}
