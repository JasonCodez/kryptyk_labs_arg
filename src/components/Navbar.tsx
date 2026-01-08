"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import NotificationBell from "@/components/notifications/NotificationBell";

interface UserInfo {
  id: string;
  role: string;
  image?: string | null;
}

export default function Navbar() {
  const { data: session } = useSession();
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);

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
      // Call custom logout endpoint to clear session
      await fetch("/api/auth/logout");
    } catch (error) {
      console.error("Logout error:", error);
    }
    // Redirect to signin page
    window.location.href = "/auth/signin?logout=true";
  };

  return (
    <nav
      className="fixed w-full top-0 z-50"
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

        {/* Center Navigation - Only for authenticated users */}
        {session && (
          <div className="hidden md:flex items-center gap-1">
            <Link
              href="/dashboard"
              className="px-3 py-2 rounded text-white text-sm transition hover:opacity-90"
              style={{ backgroundColor: "rgba(56, 145, 166, 0.1)" }}
            >
              Dashboard
            </Link>
            <Link
              href="/puzzles"
              className="px-3 py-2 rounded text-white text-sm transition hover:opacity-90"
              style={{ backgroundColor: "rgba(56, 145, 166, 0.1)" }}
            >
              Puzzles
            </Link>
            <Link
              href="/forum"
              className="px-3 py-2 rounded text-white text-sm transition hover:opacity-90"
              style={{ backgroundColor: "rgba(56, 145, 166, 0.1)" }}
            >
              Forum
            </Link>
            <Link
              href="/leaderboards"
              className="px-3 py-2 rounded text-white text-sm transition hover:opacity-90"
              style={{ backgroundColor: "rgba(56, 145, 166, 0.1)" }}
            >
              Leaderboards
            </Link>
            <Link
              href="/teams"
              className="px-3 py-2 rounded text-white text-sm transition hover:opacity-90"
              style={{ backgroundColor: "rgba(56, 145, 166, 0.1)" }}
            >
              Teams
            </Link>
            <Link
              href="/achievements"
              className="px-3 py-2 rounded text-white text-sm transition hover:opacity-90"
              style={{ backgroundColor: "rgba(56, 145, 166, 0.1)" }}
            >
              Achievements
            </Link>
          </div>
        )}

        {/* Right Side */}
        {session && !loading ? (
          // Authenticated user - show user info on right
          <div className="flex items-center gap-4">
            <NotificationBell />
            {userInfo?.image && (
              <img
                src={userInfo.image}
                alt="Avatar"
                className="h-8 w-8 rounded-full object-cover"
              />
            )}
            <div className="hidden sm:block text-right">
              <p className="text-white font-semibold text-sm">{session.user?.name || session.user?.email}</p>
              <p style={{ color: "#3891A6" }} className="text-xs">
                Player
              </p>
            </div>
            <Link
              href={`/profile/${getUserId()}`}
              className="px-3 py-2 rounded text-white text-sm transition hover:opacity-90"
              style={{ backgroundColor: "rgba(56, 145, 166, 0.6)" }}
            >
              Profile
            </Link>
            <button
              onClick={handleSignOut}
              className="px-3 py-2 rounded text-white text-sm transition hover:opacity-90"
              style={{ backgroundColor: "#AB9F9D" }}
            >
              Sign Out
            </button>
          </div>
        ) : (
          // Unauthenticated user - show sign in/register buttons
          <div className="flex gap-2 items-center">
            <Link
              href="/auth/signin"
              className="px-3 py-2 rounded text-white text-sm transition hover:opacity-90"
              style={{ backgroundColor: "rgba(56, 145, 166, 0.8)" }}
            >
              Sign In
            </Link>
            <Link
              href="/auth/register"
              className="px-3 py-2 rounded text-white text-sm font-semibold transition hover:opacity-90"
              style={{ backgroundColor: "#3891A6" }}
            >
              Join Now
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}
