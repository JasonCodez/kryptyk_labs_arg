"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import NotificationBell from "@/components/notifications/NotificationBell";

function Hamburger({ open, setOpen }: { open: boolean; setOpen: (v: boolean) => void }) {
  return (
    <button
      className="hamburger-button flex nav:hidden flex-col justify-center items-center w-10 h-10 focus:outline-none"
      aria-label={open ? 'Close menu' : 'Open menu'}
      onClick={() => setOpen(!open)}
    >
      <span
        className={`block h-0.5 w-6 rounded bg-white transition-all duration-300 ${open ? 'rotate-45 translate-y-2' : ''}`}
      ></span>
      <span
        className={`block h-0.5 w-6 rounded bg-white my-1 transition-all duration-300 ${open ? 'opacity-0' : ''}`}
      ></span>
      <span
        className={`block h-0.5 w-6 rounded bg-white transition-all duration-300 ${open ? '-rotate-45 -translate-y-2' : ''}`}
      ></span>
    </button>
  );
}

interface UserInfo {
  id: string;
  role: string;
  image?: string | null;
}


export default function Navbar() {
  const { data: session } = useSession();
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (session?.user?.email) {
      fetchUserInfo();
    } else {
      setLoading(false);
    }
  }, [session?.user?.email]);

  const fetchUserInfo = async () => {
    try {
      const response = await fetch("/api/user/info");
      if (response.ok) {
        const data = await response.json();
        console.log("User info fetched:", data);
        setUserInfo(data);
      } else {
        console.error("Failed to fetch user info:", response.status, response.statusText);
      }
    } catch (error) {
      console.error("Failed to fetch user info:", error);
    } finally {
      setLoading(false);
    }
  };

  const getUserId = () => {
    const id = userInfo?.id || (session?.user as any)?.id || "";
    console.log("getUserId:", { userInfoId: userInfo?.id, sessionId: (session?.user as any)?.id, finalId: id });
    return id;
  };

  const handleSignOut = async () => {
    try {
      // Use NextAuth client signOut to properly clear cookies and session
      await signOut({ callbackUrl: '/auth/signin?logout=true' });
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <nav
      className={`fixed w-full top-0 z-50${mobileOpen ? ' nav-mobile-open' : ''}`}
      style={{
        backgroundColor: "rgba(2, 2, 2, 0.95)",
        borderBottomColor: "#3891A6",
        borderBottomWidth: "1px",
      }}
    >
      <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
        {/* Logo: disabled link when signed in */}
        {session ? (
          <div className="flex items-center gap-3 opacity-80 select-none" aria-disabled="true" role="img" tabIndex={-1}>
            <img src="/images/logo.png" alt="Kryptyk Labs Logo" className="h-8 w-auto" />
            <div className="text-lg font-bold" style={{ color: "#3891A6" }}>
              Kryptyk Labs
            </div>
          </div>
        ) : (
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition">
            <img src="/images/logo.png" alt="Kryptyk Labs Logo" className="h-8 w-auto" />
            <div className="text-lg font-bold" style={{ color: "#3891A6" }}>
              Kryptyk Labs
            </div>
          </Link>
        )}

        {/* Hamburger for mobile */}
        <Hamburger open={mobileOpen} setOpen={setMobileOpen} />

        {/* Center Navigation - Only for authenticated users (desktop) */}
        {session && !mobileOpen && (
          <div className="desktop-nav hidden nav:flex items-center gap-1">
            <Link href="/dashboard" className="px-3 py-2 rounded text-white text-sm transition hover:opacity-90" style={{ backgroundColor: "rgba(56, 145, 166, 0.1)" }}>Dashboard</Link>
            <Link href="/puzzles" className="px-3 py-2 rounded text-white text-sm transition hover:opacity-90" style={{ backgroundColor: "rgba(56, 145, 166, 0.1)" }}>Puzzles</Link>
            <Link href="/forum" className="px-3 py-2 rounded text-white text-sm transition hover:opacity-90" style={{ backgroundColor: "rgba(56, 145, 166, 0.1)" }}>Forum</Link>
            <Link href="/leaderboards" className="px-3 py-2 rounded text-white text-sm transition hover:opacity-90" style={{ backgroundColor: "rgba(56, 145, 166, 0.1)" }}>Leaderboards</Link>
            <Link href="/teams" className="px-3 py-2 rounded text-white text-sm transition hover:opacity-90" style={{ backgroundColor: "rgba(56, 145, 166, 0.1)" }}>Teams</Link>
            <Link href="/achievements" className="px-3 py-2 rounded text-white text-sm transition hover:opacity-90" style={{ backgroundColor: "rgba(56, 145, 166, 0.1)" }}>Achievements</Link>
          </div>
        )}

        {/* Right Side (desktop) */}
        {!mobileOpen && (
          <div className="desktop-nav hidden nav:flex items-center gap-4">
            {session && !loading ? (
              <>
                <NotificationBell />
                {userInfo?.image && (
                  <img src={userInfo.image} alt="Avatar" className="h-8 w-8 rounded-full object-cover" />
                )}
                <div className="hidden sm:block text-right">
                  <p className="text-white font-semibold text-sm">{session.user?.name || session.user?.email}</p>
                  <p style={{ color: "#3891A6" }} className="text-xs">Player</p>
                </div>
                <Link href={`/profile/${getUserId()}`} className="px-3 py-2 rounded text-white text-sm transition hover:opacity-90" style={{ backgroundColor: "rgba(56, 145, 166, 0.6)" }}>Profile</Link>
                <button onClick={handleSignOut} className="px-3 py-2 rounded text-white text-sm transition hover:opacity-90" style={{ backgroundColor: "#AB9F9D" }}>Sign Out</button>
              </>
            ) : (
              <>
                <Link href="/auth/signin" className="px-3 py-2 rounded text-white text-sm transition hover:opacity-90" style={{ backgroundColor: "rgba(56, 145, 166, 0.8)" }}>Sign In</Link>
                <Link href="/auth/register" className="px-3 py-2 rounded text-white text-sm font-semibold transition hover:opacity-90" style={{ backgroundColor: "#3891A6" }}>Join Now</Link>
              </>
            )}
          </div>
        )}
      </div>

      {/* Mobile Menu Overlay */}
      <div
        className={`fixed inset-0 z-40 bg-black bg-opacity-60 transition-opacity duration-300 ${mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setMobileOpen(false)}
        aria-hidden={!mobileOpen}
      ></div>
      {/* Mobile Menu Drawer */}
      <div
        className={`fixed top-0 right-0 h-full w-72 max-w-full z-50 bg-[#181b1e] shadow-2xl transform transition-transform duration-300 ${mobileOpen ? 'translate-x-0' : 'translate-x-full'}`}
        style={{ borderLeft: '2px solid #3891A6' }}
        role="dialog"
        aria-modal="true"
        aria-label="Mobile navigation menu"
      >
        <div className="flex flex-col h-full p-6 gap-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <img src="/images/logo.png" alt="Kryptyk Labs Logo" className="h-7 w-auto" />
              <span className="text-lg font-bold" style={{ color: '#3891A6' }}>Kryptyk Labs</span>
            </div>
            <button onClick={() => setMobileOpen(false)} aria-label="Close menu" className="text-white text-2xl focus:outline-none">&times;</button>
          </div>
          <nav className="flex flex-col gap-3">
            {session ? (
              <>
                <Link href="/dashboard" className="py-2 px-4 rounded text-white text-base font-medium hover:bg-brand-teal/20 transition" onClick={() => setMobileOpen(false)}>Dashboard</Link>
                <Link href="/puzzles" className="py-2 px-4 rounded text-white text-base font-medium hover:bg-brand-teal/20 transition" onClick={() => setMobileOpen(false)}>Puzzles</Link>
                <Link href="/forum" className="py-2 px-4 rounded text-white text-base font-medium hover:bg-brand-teal/20 transition" onClick={() => setMobileOpen(false)}>Forum</Link>
                <Link href="/leaderboards" className="py-2 px-4 rounded text-white text-base font-medium hover:bg-brand-teal/20 transition" onClick={() => setMobileOpen(false)}>Leaderboards</Link>
                <Link href="/teams" className="py-2 px-4 rounded text-white text-base font-medium hover:bg-brand-teal/20 transition" onClick={() => setMobileOpen(false)}>Teams</Link>
                <Link href="/achievements" className="py-2 px-4 rounded text-white text-base font-medium hover:bg-brand-teal/20 transition" onClick={() => setMobileOpen(false)}>Achievements</Link>
                <Link href={`/profile/${getUserId()}`} className="py-2 px-4 rounded text-white text-base font-medium hover:bg-brand-teal/20 transition" onClick={() => setMobileOpen(false)}>Profile</Link>
                <button onClick={() => { setMobileOpen(false); handleSignOut(); }} className="py-2 px-4 rounded text-white text-base font-medium bg-brand-accent hover:bg-brand-teal/80 transition">Sign Out</button>
              </>
            ) : (
              <>
                <Link href="/auth/signin" className="py-2 px-4 rounded text-white text-base font-medium hover:bg-brand-teal/20 transition" onClick={() => setMobileOpen(false)}>Sign In</Link>
                <Link href="/auth/register" className="py-2 px-4 rounded text-white text-base font-medium hover:bg-brand-teal/20 transition" onClick={() => setMobileOpen(false)}>Join Now</Link>
              </>
            )}
          </nav>
          {session && !loading && (
            <div className="mt-auto flex items-center gap-3 border-t border-brand-teal pt-4">
              <NotificationBell />
              {userInfo?.image && (
                <img src={userInfo.image} alt="Avatar" className="h-8 w-8 rounded-full object-cover" />
              )}
              <div>
                <p className="text-white font-semibold text-sm">{session.user?.name || session.user?.email}</p>
                <p style={{ color: "#3891A6" }} className="text-xs">Player</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
