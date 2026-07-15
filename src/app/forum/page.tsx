"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface ForumPost {
  id: string;
  title: string;
  content: string;
  author: {
    id: string;
    name: string | null;
    image: string | null;
  };
  puzzle: {
    id: string;
    title: string;
  } | null;
  viewCount: number;
  replyCount: number;
  upvotes: number;
  downvotes: number;
  createdAt: string;
  updatedAt: string;
}

export default function ForumPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPuzzleId, setSelectedPuzzleId] = useState<string | null>(null);
  const [puzzles, setPuzzles] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
      return;
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchPosts(1);
      fetchPuzzles();
    }
  }, [session, selectedPuzzleId]);

  const fetchPosts = async (pageNum: number) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: "10",
      });
      if (selectedPuzzleId) {
        params.append("puzzleId", selectedPuzzleId);
      }

      const response = await fetch(`/api/forum/posts?${params}`);
      if (!response.ok) {
        throw new Error("Failed to fetch posts");
      }
      const data = await response.json();
      setPosts(Array.isArray(data.posts) ? data.posts : []);
      setTotalPages(data.pages || 1);
      setPage(pageNum);
    } catch (error) {
      console.error("Error fetching posts:", error);
      setPosts([]);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  const fetchPuzzles = async () => {
    try {
      const response = await fetch("/api/puzzles?limit=1000");
      if (response.ok) {
        const data = await response.json();
        setPuzzles(Array.isArray(data) ? data : []);
      } else {
        setPuzzles([]);
      }
    } catch (error) {
      console.error("Error fetching puzzles:", error);
      setPuzzles([]);
    }
  };

  return (
    <>
      <div style={{ backgroundColor: '#010101', minHeight: '100vh', paddingTop: 80 }}>

        {/* Page header */}
        <div style={{ position: 'relative', overflow: 'hidden', padding: '48px 20px 36px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle, rgba(255,208,0,0.3) 1px, transparent 1px)', backgroundSize: '30px 30px', opacity: 0.1 }} />
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 80% 60% at 50% 50%, transparent 40%, #010101 100%)' }} />
          <div style={{ maxWidth: 1100, margin: '0 auto', position: 'relative' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '4px 12px', borderRadius: 999, background: 'rgba(57,212,110,0.07)', border: '1px solid rgba(57,212,110,0.2)', marginBottom: 14 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#39D46E' }} />
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' as const, color: '#39D46E' }}>Community</span>
            </div>
            <h1 style={{ fontSize: 'clamp(28px,5vw,48px)', fontWeight: 900, color: '#fff', letterSpacing: '-0.03em', margin: '0 0 8px' }}>Forum</h1>
            <p style={{ color: '#6B7280', fontSize: 15, margin: 0 }}>Discuss puzzles, share strategies, and connect with other solvers.</p>
          </div>
        </div>

        {/* Controls bar */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexWrap: 'wrap' as const, gap: 10, alignItems: 'center' }}>
            <select
              value={selectedPuzzleId || ""}
              onChange={(e) => { setSelectedPuzzleId(e.target.value || null); setPage(1); }}
              style={{ padding: '8px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#e5e7eb', fontSize: 13, outline: 'none', cursor: 'pointer' }}
            >
              <option value="" style={{ background: '#111' }}>All Puzzles</option>
              {Array.isArray(puzzles) && puzzles.map((puzzle) => (
                <option key={puzzle.id} value={puzzle.id} style={{ background: '#111' }}>
                  {puzzle.title}
                </option>
              ))}
            </select>
            <Link
              href="/forum/create"
              style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 20px', borderRadius: 8, background: '#FFD700', color: '#000', fontWeight: 700, fontSize: 13, textDecoration: 'none', letterSpacing: '0.03em' }}
            >
              + New Post
            </Link>
          </div>
        </div>

        {/* Posts list */}
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px 80px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '80px 0' }}>
              <p style={{ color: '#4B5563', fontSize: 13, letterSpacing: '0.1em', textTransform: 'uppercase' as const }}>Loading…</p>
            </div>
          ) : !posts || posts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 20px' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>💬</div>
              <p style={{ color: '#6B7280', fontSize: 16, marginBottom: 24 }}>No posts yet. Be the first to start a discussion.</p>
              <Link href="/forum/create" style={{ display: 'inline-block', padding: '12px 28px', borderRadius: 8, background: '#3891A6', color: '#fff', fontWeight: 600, textDecoration: 'none', fontSize: 14 }}>
                Create First Post
              </Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 3 }}>
              {Array.isArray(posts) && posts.map((post) => {
                const net = post.upvotes - post.downvotes;
                const diff = Date.now() - new Date(post.createdAt).getTime();
                const mins = Math.floor(diff / 60000);
                const timeAgo = mins < 60 ? `${mins}m ago` : mins < 1440 ? `${Math.floor(mins / 60)}h ago` : `${Math.floor(mins / 1440)}d ago`;
                return (
                  <Link key={post.id} href={`/forum/posts/${post.id}`} style={{ textDecoration: 'none' }}>
                    <div
                      style={{ display: 'flex', gap: 16, alignItems: 'flex-start', padding: '16px 18px', borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', transition: 'border-color 0.18s, background 0.18s', cursor: 'pointer' }}
                      onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'rgba(255,208,0,0.28)'; el.style.background = 'rgba(255,208,0,0.025)'; }}
                      onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'rgba(255,255,255,0.06)'; el.style.background = 'rgba(255,255,255,0.02)'; }}
                    >
                      {/* Vote score */}
                      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 1, minWidth: 36, paddingTop: 2 }}>
                        <span style={{ fontSize: 15, fontWeight: 800, fontFamily: 'ui-monospace,monospace', color: net > 0 ? '#39D46E' : net < 0 ? '#f87171' : '#4B5563' }}>
                          {net > 0 ? `+${net}` : net}
                        </span>
                        <span style={{ fontSize: 9, color: '#6B7280', letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>pts</span>
                      </div>

                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h3 style={{ color: '#f3f4f6', fontWeight: 700, fontSize: 15, margin: '0 0 5px', lineHeight: 1.35 }}>
                          {post.title}
                        </h3>
                        <p style={{ color: '#6B7280', fontSize: 13, margin: '0 0 10px', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
                          {post.content}
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' as const, gap: 8, fontSize: 12 }}>
                          {post.author.image && <img src={post.author.image} alt="" style={{ width: 16, height: 16, borderRadius: '50%' }} />}
                          <span
                            style={{ color: '#FFD700', fontWeight: 600, cursor: 'pointer' }}
                            onClick={e => { e.preventDefault(); e.stopPropagation(); window.location.href = `/profile/${post.author.id}`; }}
                          >
                            {post.author.name}
                          </span>
                          <span style={{ color: '#4B5563' }}>·</span>
                          <span style={{ color: '#4B5563' }}>{timeAgo}</span>
                          {post.puzzle && (
                            <>
                              <span style={{ color: '#4B5563' }}>·</span>
                              <span style={{ padding: '2px 8px', borderRadius: 999, background: 'rgba(56,145,166,0.1)', border: '1px solid rgba(56,145,166,0.25)', color: '#38bdf8', fontSize: 11 }}>
                                {post.puzzle.title}
                              </span>
                            </>
                          )}
                          <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, color: '#4B5563' }}>
                            <span>👁 {post.viewCount}</span>
                            <span style={{ color: post.replyCount > 0 ? '#9ca3af' : '#4B5563' }}>💬 {post.replyCount}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 40 }}>
              <button
                onClick={() => fetchPosts(page - 1)}
                disabled={page <= 1}
                style={{ padding: '8px 18px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', color: page <= 1 ? '#4B5563' : '#e5e7eb', fontSize: 13, cursor: page <= 1 ? 'default' : 'pointer' }}
              >
                ← Prev
              </button>
              <span style={{ fontSize: 13, color: '#6B7280', fontFamily: 'ui-monospace,monospace' }}>{page} / {totalPages}</span>
              <button
                onClick={() => fetchPosts(page + 1)}
                disabled={page >= totalPages}
                style={{ padding: '8px 18px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', color: page >= totalPages ? '#4B5563' : '#e5e7eb', fontSize: 13, cursor: page >= totalPages ? 'default' : 'pointer' }}
              >
                Next →
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
