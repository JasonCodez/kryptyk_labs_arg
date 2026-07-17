"use client";

import { useState, useEffect, use } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import LoadingSpinner from "@/components/LoadingSpinner";
import Link from "next/link";
import GameButton from "@/components/game-ui/GameButton";

interface User {
  id: string;
  name: string | null;
  image: string | null;
}

interface Puzzle {
  id: string;
  title: string;
}

interface Comment {
  id: string;
  content: string;
  author: User;
  upvotes: number;
  downvotes: number;
  createdAt: string;
  replies?: Comment[];
}

interface ForumPost {
  id: string;
  title: string;
  content: string;
  author: User;
  puzzle: Puzzle | null;
  viewCount: number;
  replyCount: number;
  upvotes: number;
  downvotes: number;
  comments: Comment[];
  createdAt: string;
}

export default function ForumPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: session, status } = useSession();
  const router = useRouter();
  const [post, setPost] = useState<ForumPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [deletingPost, setDeletingPost] = useState(false);
  const [userVotes, setUserVotes] = useState<{ [key: string]: "up" | "down" | null }>({});

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
      return;
    }

    if (session) {
      fetchPost();
    }
  }, [status, router, session, id]);

  useEffect(() => {
    if (!session) {
      setIsAdmin(false);
      return;
    }

    let cancelled = false;

    const checkAdmin = async () => {
      try {
        const response = await fetch("/api/admin/check", { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled) {
          setIsAdmin(Boolean(data?.isAdmin));
        }
      } catch {
        if (!cancelled) {
          setIsAdmin(false);
        }
      }
    };

    checkAdmin();

    return () => {
      cancelled = true;
    };
  }, [session]);

  const fetchPost = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/forum/posts/${id}`);
      if (!response.ok) throw new Error("Failed to fetch post");
      const data = await response.json();
      setPost(data && typeof data === 'object' ? data : null);
    } catch (err) {
      console.error("Error fetching post:", err);
      setPost(null);
    } finally {
      setLoading(false);
    }
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setSubmitting(true);
    setError("");

    try {
      const response = await fetch(`/api/forum/posts/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newComment }),
      });

      if (!response.ok) throw new Error("Failed to post comment");

      setNewComment("");
      fetchPost();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to post comment");
    } finally {
      setSubmitting(false);
    }
  };

  const handleVote = async (
    type: "post" | "comment",
    id: string,
    voteType: "up" | "down"
  ) => {
    if (!session) {
      router.push("/auth/signin");
      return;
    }

    const endpoint =
      type === "post" ? "/api/forum/vote/post" : "/api/forum/vote/comment";
    const dataKey = type === "post" ? "postId" : "commentId";

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          [dataKey]: id,
          voteType,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to vote");
      }

      // Update local state
      setUserVotes((prev) => ({
        ...prev,
        [id]: prev[id] === voteType ? null : voteType,
      }));

      // Refresh post
      fetchPost();
    } catch (err) {
      console.error("Error voting:", err);
      setError(err instanceof Error ? err.message : "Failed to vote");
    }
  };

  const handleDeletePost = async () => {
    if (!post || !isAdmin || deletingPost) return;

    const confirmed = window.confirm(
      "Delete this forum post? This will permanently remove the post and all comments."
    );

    if (!confirmed) return;

    setDeletingPost(true);
    setDeleteError("");

    try {
      const response = await fetch(`/api/forum/posts/${post.id}`, {
        method: "DELETE",
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || "Failed to delete post");
      }

      router.push("/forum");
      router.refresh();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete post");
    } finally {
      setDeletingPost(false);
    }
  };

  if (loading) {
    return <LoadingSpinner size={180} />;
  }

  if (!post) {
    return (
      <>
        <div style={{ backgroundColor: '#170B26', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: '#C8B8E0', marginBottom: 24, fontSize: 15 }}>Post not found.</p>
            <Link href="/forum" style={{ textDecoration: 'none', display: 'inline-block' }}>
              <GameButton variant="pink">Back to Forum</GameButton>
            </Link>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div style={{ backgroundColor: '#170B26', minHeight: '100vh', paddingTop: 80 }}>
        <div style={{ maxWidth: 860, margin: '0 auto', padding: '40px 20px 80px' }}>

          {/* Back */}
          <Link href="/forum"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, color: '#C8B8E0', textDecoration: 'none', marginBottom: 28, transition: 'color 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#FFC93C')}
            onMouseLeave={e => (e.currentTarget.style.color = '#C8B8E0')}
          >
            ← Forum
          </Link>

          {/* Post card */}
          <div className="relative overflow-hidden shadow-skeu-panel" style={{ background: 'linear-gradient(160deg, #32205A, #241640 60%)', border: '1px solid rgba(255,79,163,0.18)', borderRadius: 14, padding: '28px', marginBottom: 20 }}>
            <span className="game-gloss-overlay" aria-hidden style={{ opacity: 0.5 }} />
            <div className="relative">
            {/* Title + puzzle tag */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 18, flexWrap: 'wrap' as const }}>
              <h1 style={{ flex: 1, fontSize: 'clamp(20px,3.5vw,28px)', fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', margin: 0, lineHeight: 1.25 }}>
                {post.title}
              </h1>
              {post.puzzle && (
                <span style={{ padding: '4px 12px', borderRadius: 999, background: 'rgba(47,230,224,0.1)', border: '1px solid rgba(47,230,224,0.3)', color: '#2FE6E0', fontSize: 12, fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap' as const }}>
                  {post.puzzle.title}
                </span>
              )}
            </div>

            {/* Author row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid rgba(255,79,163,0.12)' }}>
              {post.author.image && <img src={post.author.image} alt="" style={{ width: 32, height: 32, borderRadius: '50%' }} />}
              <div>
                <Link href={`/profile/${post.author.id}`} style={{ color: '#FFC93C', fontWeight: 600, fontSize: 14, textDecoration: 'none' }}>
                  {post.author.name}
                </Link>
                <p style={{ color: '#8C7BAD', fontSize: 12, margin: '2px 0 0' }}>
                  {post.createdAt ? new Date(post.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                </p>
              </div>
            </div>

            {isAdmin && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                <button
                  type="button"
                  onClick={handleDeletePost}
                  disabled={deletingPost}
                  style={{
                    padding: '7px 12px',
                    borderRadius: 7,
                    background: deletingPost ? 'rgba(255,90,90,0.08)' : 'rgba(255,90,90,0.14)',
                    border: '1px solid rgba(255,90,90,0.4)',
                    color: deletingPost ? 'rgba(255,90,90,0.6)' : '#FF5A5A',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: deletingPost ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {deletingPost ? 'Deleting…' : 'Delete Post'}
                </button>
              </div>
            )}

            {deleteError && (
              <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(255,90,90,0.08)', border: '1px solid rgba(255,90,90,0.2)', color: '#FF5A5A', fontSize: 13, marginBottom: 12 }}>
                {deleteError}
              </div>
            )}

            {/* Content */}
            <div style={{ color: '#E4D9FF', fontSize: 15, lineHeight: 1.75, whiteSpace: 'pre-wrap', marginBottom: 28 }}>
              {post.content}
            </div>

            {/* Stats + voting */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 20, borderTop: '1px solid rgba(255,79,163,0.12)' }}>
              <button
                onClick={() => handleVote("post", post.id, "up")}
                style={{ padding: '5px 12px', borderRadius: 6, background: userVotes[post.id] === 'up' ? 'rgba(62,217,122,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${userVotes[post.id] === 'up' ? 'rgba(62,217,122,0.4)' : 'rgba(255,79,163,0.15)'}`, color: userVotes[post.id] === 'up' ? '#3ED97A' : '#C8B8E0', fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s' }}
              >
                ▲ {post.upvotes}
              </button>
              <button
                onClick={() => handleVote("post", post.id, "down")}
                style={{ padding: '5px 12px', borderRadius: 6, background: userVotes[post.id] === 'down' ? 'rgba(255,90,90,0.12)' : 'rgba(255,255,255,0.04)', border: `1px solid ${userVotes[post.id] === 'down' ? 'rgba(255,90,90,0.35)' : 'rgba(255,79,163,0.15)'}`, color: userVotes[post.id] === 'down' ? '#FF5A5A' : '#C8B8E0', fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s' }}
              >
                ▼ {post.downvotes}
              </button>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 16, color: '#8C7BAD', fontSize: 13 }}>
                <span>👁 {post.viewCount}</span>
                <span>💬 {post.replyCount}</span>
              </div>
            </div>
            </div>
          </div>

          {/* Discussion */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: '#fff', margin: 0 }}>Discussion</h2>
              <span style={{ padding: '2px 9px', borderRadius: 999, background: 'rgba(255,79,163,0.1)', color: '#C8B8E0', fontSize: 12, fontFamily: 'ui-monospace,monospace' }}>
                {post.comments.length}
              </span>
            </div>

            {/* Comment form */}
            {session && (
              <form onSubmit={handleCommentSubmit} style={{ marginBottom: 20 }}>
                {error && (
                  <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(255,90,90,0.08)', border: '1px solid rgba(255,90,90,0.2)', color: '#FF5A5A', fontSize: 13, marginBottom: 10 }}>
                    {error}
                  </div>
                )}
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add your comment…"
                  rows={4}
                  style={{ width: '100%', padding: '12px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,79,163,0.15)', color: '#FFF6FB', fontSize: 14, outline: 'none', resize: 'vertical' as const, fontFamily: 'inherit', lineHeight: 1.6, boxSizing: 'border-box' as const, marginBottom: 10, transition: 'border-color 0.15s' }}
                  onFocus={e => (e.currentTarget.style.borderColor = 'rgba(255,201,60,0.45)')}
                  onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,79,163,0.15)')}
                />
                <GameButton type="submit" variant="pink" size="sm" disabled={submitting || !newComment.trim()}>
                  {submitting ? 'Posting…' : 'Post Comment'}
                </GameButton>
              </form>
            )}

            {/* Comments */}
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
              {!post.comments || post.comments.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#8C7BAD', fontSize: 14 }}>
                  No comments yet. Be the first to reply.
                </div>
              ) : (
                post.comments.map((comment) => (
                  <div
                    key={comment.id}
                    className="relative overflow-hidden shadow-skeu-raised-sm"
                    style={{ padding: '16px 18px', borderRadius: 10, background: 'linear-gradient(160deg, #32205A, #241640 60%)', border: '1px solid rgba(255,79,163,0.12)' }}
                  >
                    <span className="game-gloss-overlay" aria-hidden style={{ opacity: 0.5 }} />
                    <div className="relative">
                    {/* Comment header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      {comment.author.image && <img src={comment.author.image} alt="" style={{ width: 26, height: 26, borderRadius: '50%' }} />}
                      <div style={{ flex: 1 }}>
                        <Link href={`/profile/${comment.author.id}`} style={{ color: '#FFC93C', fontWeight: 600, fontSize: 13, textDecoration: 'none' }}>
                          {comment.author.name}
                        </Link>
                        <span style={{ color: '#8C7BAD', margin: '0 6px' }}>·</span>
                        <span style={{ color: '#8C7BAD', fontSize: 12 }}>
                          {new Date(comment.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      {/* Vote buttons */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <button
                          onClick={() => handleVote("comment", comment.id, "up")}
                          style={{ padding: '3px 8px', borderRadius: 5, background: userVotes[comment.id] === 'up' ? 'rgba(62,217,122,0.12)' : 'rgba(255,255,255,0.04)', border: `1px solid ${userVotes[comment.id] === 'up' ? 'rgba(62,217,122,0.35)' : 'rgba(255,79,163,0.1)'}`, color: userVotes[comment.id] === 'up' ? '#3ED97A' : '#8C7BAD', fontSize: 11, cursor: 'pointer', transition: 'all 0.15s' }}
                        >
                          ▲ {comment.upvotes}
                        </button>
                        <button
                          onClick={() => handleVote("comment", comment.id, "down")}
                          style={{ padding: '3px 8px', borderRadius: 5, background: userVotes[comment.id] === 'down' ? 'rgba(255,90,90,0.1)' : 'rgba(255,255,255,0.04)', border: `1px solid ${userVotes[comment.id] === 'down' ? 'rgba(255,90,90,0.3)' : 'rgba(255,79,163,0.1)'}`, color: userVotes[comment.id] === 'down' ? '#FF5A5A' : '#8C7BAD', fontSize: 11, cursor: 'pointer', transition: 'all 0.15s' }}
                        >
                          ▼ {comment.downvotes}
                        </button>
                      </div>
                    </div>

                    {/* Comment content */}
                    <p style={{ color: '#E4D9FF', fontSize: 14, lineHeight: 1.65, whiteSpace: 'pre-wrap', margin: 0 }}>
                      {comment.content}
                    </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
