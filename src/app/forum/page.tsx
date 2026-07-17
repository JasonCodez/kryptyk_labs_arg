"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import GameButton from "@/components/game-ui/GameButton";

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
      <div style={{ backgroundColor: '#170B26', minHeight: '100vh', paddingTop: 80 }}>

        {/* Page header */}
        <div style={{ position: 'relative', overflow: 'hidden', padding: '48px 20px 36px', borderBottom: '1px solid rgba(255,79,163,0.12)' }}>
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle, rgba(255,201,60,0.3) 1px, transparent 1px)', backgroundSize: '30px 30px', opacity: 0.1 }} />
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 80% 60% at 50% 50%, transparent 40%, #170B26 100%)' }} />
          <div style={{ maxWidth: 1100, margin: '0 auto', position: 'relative' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '4px 12px', borderRadius: 999, background: 'rgba(62,217,122,0.07)', border: '1px solid rgba(62,217,122,0.2)', marginBottom: 14 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3ED97A' }} />
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' as const, color: '#3ED97A' }}>Community</span>
            </div>
            <h1 style={{ fontSize: 'clamp(28px,5vw,48px)', fontWeight: 900, color: '#fff', letterSpacing: '-0.03em', margin: '0 0 8px' }}>Forum</h1>
            <p style={{ color: '#C8B8E0', fontSize: 15, margin: 0 }}>Discuss puzzles, share strategies, and connect with other solvers.</p>
          </div>
        </div>

        {/* Controls bar */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,79,163,0.08)' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexWrap: 'wrap' as const, gap: 10, alignItems: 'center' }}>
            <select
              value={selectedPuzzleId || ""}
              onChange={(e) => { setSelectedPuzzleId(e.target.value || null); setPage(1); }}
              style={{ padding: '8px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,79,163,0.18)', color: '#FFF6FB', fontSize: 13, outline: 'none', cursor: 'pointer' }}
            >
              <option value="" style={{ background: '#241640' }}>All Puzzles</option>
              {Array.isArray(puzzles) && puzzles.map((puzzle) => (
                <option key={puzzle.id} value={puzzle.id} style={{ background: '#241640' }}>
                  {puzzle.title}
                </option>
              ))}
            </select>
            <Link href="/forum/create" style={{ marginLeft: 'auto', textDecoration: 'none' }}>
              <GameButton variant="pink" size="sm" icon="+">
                New Post
              </GameButton>
            </Link>
          </div>
        </div>

        {/* Posts list */}
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px 80px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '80px 0' }}>
              <p style={{ color: '#8C7BAD', fontSize: 13, letterSpacing: '0.1em', textTransform: 'uppercase' as const }}>Loading…</p>
            </div>
          ) : !posts || posts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 20px' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>💬</div>
              <p style={{ color: '#C8B8E0', fontSize: 16, marginBottom: 24 }}>No posts yet. Be the first to start a discussion.</p>
              <Link href="/forum/create" style={{ textDecoration: 'none', display: 'inline-block' }}>
                <GameButton variant="pink">Create First Post</GameButton>
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
                      className="shadow-skeu-raised-sm"
                      style={{ position: 'relative', overflow: 'hidden', display: 'flex', gap: 16, alignItems: 'flex-start', padding: '16px 18px', borderRadius: 10, background: 'linear-gradient(160deg, #32205A, #241640 60%)', border: '1px solid rgba(255,79,163,0.15)', transition: 'border-color 0.18s, background 0.18s', cursor: 'pointer' }}
                      onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'rgba(255,79,163,0.4)'; }}
                      onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'rgba(255,79,163,0.15)'; }}
                    >
                      <span className="game-gloss-overlay" aria-hidden style={{ opacity: 0.5 }} />
                      {/* Vote score */}
                      <div className="relative" style={{ flexShrink: 0, display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 1, minWidth: 36, paddingTop: 2 }}>
                        <span style={{ fontSize: 15, fontWeight: 800, fontFamily: 'ui-monospace,monospace', color: net > 0 ? '#3ED97A' : net < 0 ? '#FF5A5A' : '#8C7BAD' }}>
                          {net > 0 ? `+${net}` : net}
                        </span>
                        <span style={{ fontSize: 9, color: '#8C7BAD', letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>pts</span>
                      </div>

                      {/* Content */}
                      <div className="relative" style={{ flex: 1, minWidth: 0 }}>
                        <h3 style={{ color: '#FFF6FB', fontWeight: 700, fontSize: 15, margin: '0 0 5px', lineHeight: 1.35 }}>
                          {post.title}
                        </h3>
                        <p style={{ color: '#C8B8E0', fontSize: 13, margin: '0 0 10px', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
                          {post.content}
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' as const, gap: 8, fontSize: 12 }}>
                          {post.author.image && <img src={post.author.image} alt="" style={{ width: 16, height: 16, borderRadius: '50%' }} />}
                          <span
                            style={{ color: '#FFC93C', fontWeight: 600, cursor: 'pointer' }}
                            onClick={e => { e.preventDefault(); e.stopPropagation(); window.location.href = `/profile/${post.author.id}`; }}
                          >
                            {post.author.name}
                          </span>
                          <span style={{ color: '#8C7BAD' }}>·</span>
                          <span style={{ color: '#8C7BAD' }}>{timeAgo}</span>
                          {post.puzzle && (
                            <>
                              <span style={{ color: '#8C7BAD' }}>·</span>
                              <span style={{ padding: '2px 8px', borderRadius: 999, background: 'rgba(47,230,224,0.1)', border: '1px solid rgba(47,230,224,0.25)', color: '#2FE6E0', fontSize: 11 }}>
                                {post.puzzle.title}
                              </span>
                            </>
                          )}
                          <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, color: '#8C7BAD' }}>
                            <span>👁 {post.viewCount}</span>
                            <span style={{ color: post.replyCount > 0 ? '#C8B8E0' : '#8C7BAD' }}>💬 {post.replyCount}</span>
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
                style={{ padding: '8px 18px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,79,163,0.15)', color: page <= 1 ? '#8C7BAD' : '#FFF6FB', fontSize: 13, cursor: page <= 1 ? 'default' : 'pointer' }}
              >
                ← Prev
              </button>
              <span style={{ fontSize: 13, color: '#C8B8E0', fontFamily: 'ui-monospace,monospace' }}>{page} / {totalPages}</span>
              <button
                onClick={() => fetchPosts(page + 1)}
                disabled={page >= totalPages}
                style={{ padding: '8px 18px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,79,163,0.15)', color: page >= totalPages ? '#8C7BAD' : '#FFF6FB', fontSize: 13, cursor: page >= totalPages ? 'default' : 'pointer' }}
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
