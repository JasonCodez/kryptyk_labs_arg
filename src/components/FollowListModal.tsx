"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import type { ThemeConfig } from "@/lib/profileThemes";

interface FollowListUser {
  id: string;
  name: string | null;
  image: string | null;
  isSelf: boolean;
  isFollowing: boolean;
}

export default function FollowListModal({
  userId,
  type,
  theme,
  onClose,
  onFollowChange,
}: {
  userId: string;
  type: "followers" | "following";
  theme: ThemeConfig;
  onClose: () => void;
  /** Called after a follow/unfollow succeeds so the page behind the modal can refresh its counts. */
  onFollowChange?: () => void;
}) {
  const { status } = useSession();
  const isAuthenticated = status === "authenticated";

  const [users, setUsers] = useState<FollowListUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const fetchPage = useCallback(async (cursor: string | null) => {
    const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
    const res = await fetch(`/api/users/${userId}/${type}${query}`, { credentials: "same-origin" });
    if (!res.ok) throw new Error("Failed to load");
    return res.json() as Promise<{ users: FollowListUser[]; nextCursor: string | null }>;
  }, [userId, type]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    fetchPage(null)
      .then((data) => {
        if (cancelled) return;
        setUsers(data.users);
        setNextCursor(data.nextCursor);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load list.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchPage]);

  const handleLoadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await fetchPage(nextCursor);
      setUsers((prev) => [...prev, ...data.users]);
      setNextCursor(data.nextCursor);
    } catch {
      setError("Failed to load more.");
    } finally {
      setLoadingMore(false);
    }
  };

  const handleToggleFollow = async (target: FollowListUser) => {
    if (pendingId) return;
    setPendingId(target.id);
    try {
      const res = await fetch(`/api/users/${target.id}/follow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ action: target.isFollowing ? "unfollow" : "follow" }),
      });
      if (res.ok) {
        setUsers((prev) => prev.map((u) => (u.id === target.id ? { ...u, isFollowing: !u.isFollowing } : u)));
        onFollowChange?.();
      }
    } catch {
      // Network error -- leave the row's state untouched so it doesn't lie about the outcome.
    } finally {
      setPendingId(null);
    }
  };

  const title = type === "followers" ? "Followers" : "Following";

  return (
    <div className="fixed inset-0 z-[70]">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          className="w-full max-w-sm rounded-xl border shadow-xl flex flex-col"
          style={{ backgroundColor: "rgba(2,2,2,0.97)", borderColor: theme.primary, maxHeight: "80vh" }}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: `${theme.primary}30` }}>
            <h2 className="text-lg font-bold text-white">{title}</h2>
            <button onClick={onClose} className="text-white/50 hover:text-white text-xl leading-none transition-colors cursor-pointer">✕</button>
          </div>

          <div className="overflow-y-auto px-3 py-2 flex-1">
            {loading ? (
              <p className="text-sm text-center py-8" style={{ color: theme.subtleText }}>Loading...</p>
            ) : error ? (
              <p className="text-sm text-center py-8 text-red-400">{error}</p>
            ) : users.length === 0 ? (
              <p className="text-sm text-center py-8" style={{ color: theme.subtleText }}>
                {type === "followers" ? "No followers yet." : "Not following anyone yet."}
              </p>
            ) : (
              <div className="space-y-1">
                {users.map((u) => (
                  <div key={u.id} className="flex items-center gap-3 px-2 py-2 rounded-lg">
                    <Link
                      href={`/profile/${u.id}`}
                      onClick={onClose}
                      className="flex items-center gap-3 flex-1 min-w-0 rounded-lg px-2 py-1 -mx-2 -my-1 cursor-pointer hover:bg-white/10 transition-colors"
                    >
                      <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 flex items-center justify-center" style={{ backgroundColor: theme.primaryMuted }}>
                        {u.image ? (
                          <img
                            src={u.image}
                            alt={u.name ?? "Player"}
                            className="w-full h-full object-cover"
                            onError={(e) => { const img = e.currentTarget as HTMLImageElement; img.onerror = null; img.src = "/images/default-avatar.svg"; }}
                          />
                        ) : (
                          <span className="text-base">👤</span>
                        )}
                      </div>
                      <span className="text-sm font-semibold text-white truncate">{u.name || "Player"}</span>
                    </Link>
                    {isAuthenticated && !u.isSelf && (
                      <button
                        onClick={() => handleToggleFollow(u)}
                        disabled={pendingId === u.id}
                        className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 hover:opacity-80"
                        style={u.isFollowing
                          ? { backgroundColor: "rgba(239,68,68,0.12)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.3)" }
                          : { background: theme.btnPrimary, color: theme.btnPrimaryText }}
                      >
                        {pendingId === u.id ? "…" : u.isFollowing ? "Unfollow" : "Follow"}
                      </button>
                    )}
                  </div>
                ))}
                {nextCursor && (
                  <button
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="w-full text-center text-xs font-semibold py-3 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 hover:opacity-80 transition-opacity"
                    style={{ color: theme.primary }}
                  >
                    {loadingMore ? "Loading…" : "Load more"}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
