"use client";

import { useState, useEffect, use } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import LoadingSpinner from "@/components/LoadingSpinner";
import Link from "next/link";

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
        <div style={{ backgroundColor: '#010101', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: '#6B7280', marginBottom: 24, fontSize: 15 }}>Post not found.</p>
            <Link href="/forum" style={{ display: 'inline-block', padding: '11px 24px', borderRadius: 8, background: '#3891A6', color: '#fff', fontWeight: 600, textDecoration: 'none', fontSize: 14 }}>
              Back to Forum
            </Link>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div style={{ backgroundColor: '#010101', minHeight: '100vh', paddingTop: 80 }}>
        <div style={{ maxWidth: 860, margin: '0 auto', padding: '40px 20px 80px' }}>

          {/* Back */}
          <Link href="/forum"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, color: '#6B7280', textDecoration: 'none', marginBottom: 28, transition: 'color 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#FFD700')}
            onMouseLeave={e => (e.currentTarget.style.color = '#6B7280')}
          >
            ← Forum
          </Link>

          {/* Post card */}
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '28px', marginBottom: 20 }}>
            {/* Title + puzzle tag */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 18, flexWrap: 'wrap' as const }}>
              <h1 style={{ flex: 1, fontSize: 'clamp(20px,3.5vw,28px)', fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', margin: 0, lineHeight: 1.25 }}>
                {post.title}
              </h1>
              {post.puzzle && (
                <span style={{ padding: '4px 12px', borderRadius: 999, background: 'rgba(56,145,166,0.1)', border: '1px solid rgba(56,145,166,0.3)', color: '#38bdf8', fontSize: 12, fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap' as const }}>
                  {post.puzzle.title}
                </span>
              )}
            </div>

            {/* Author row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              {post.author.image && <img src={post.author.image} alt="" style={{ width: 32, height: 32, borderRadius: '50%' }} />}
              <div>
                <Link href={`/profile/${post.author.id}`} style={{ color: '#FFD700', fontWeight: 600, fontSize: 14, textDecoration: 'none' }}>
                  {post.author.name}
                </Link>
                <p style={{ color: '#4B5563', fontSize: 12, margin: '2px 0 0' }}>
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
                    background: deletingPost ? 'rgba(248,113,113,0.08)' : 'rgba(248,113,113,0.14)',
                    border: '1px solid rgba(248,113,113,0.4)',
                    color: deletingPost ? '#fca5a5' : '#f87171',
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
              <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', color: '#fca5a5', fontSize: 13, marginBottom: 12 }}>
                {deleteError}
              </div>
            )}

            {/* Content */}
            <div style={{ color: '#d1d5db', fontSize: 15, lineHeight: 1.75, whiteSpace: 'pre-wrap', marginBottom: 28 }}>
              {post.content}
            </div>

            {/* Stats + voting */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <button
                onClick={() => handleVote("post", post.id, "up")}
                style={{ padding: '5px 12px', borderRadius: 6, background: userVotes[post.id] === 'up' ? 'rgba(57,212,110,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${userVotes[post.id] === 'up' ? 'rgba(57,212,110,0.4)' : 'rgba(255,255,255,0.1)'}`, color: userVotes[post.id] === 'up' ? '#39D46E' : '#9ca3af', fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s' }}
              >
                ▲ {post.upvotes}
              </button>
              <button
                onClick={() => handleVote("post", post.id, "down")}
                style={{ padding: '5px 12px', borderRadius: 6, background: userVotes[post.id] === 'down' ? 'rgba(248,113,113,0.12)' : 'rgba(255,255,255,0.04)', border: `1px solid ${userVotes[post.id] === 'down' ? 'rgba(248,113,113,0.35)' : 'rgba(255,255,255,0.1)'}`, color: userVotes[post.id] === 'down' ? '#f87171' : '#9ca3af', fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s' }}
              >
                ▼ {post.downvotes}
              </button>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 16, color: '#4B5563', fontSize: 13 }}>
                <span>👁 {post.viewCount}</span>
                <span>💬 {post.replyCount}</span>
              </div>
            </div>
          </div>

          {/* Discussion */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: '#fff', margin: 0 }}>Discussion</h2>
              <span style={{ padding: '2px 9px', borderRadius: 999, background: 'rgba(255,255,255,0.06)', color: '#9ca3af', fontSize: 12, fontFamily: 'ui-monospace,monospace' }}>
                {post.comments.length}
              </span>
            </div>

            {/* Comment form */}
            {session && (
              <form onSubmit={handleCommentSubmit} style={{ marginBottom: 20 }}>
                {error && (
                  <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', color: '#fca5a5', fontSize: 13, marginBottom: 10 }}>
                    {error}
                  </div>
                )}
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add your comment…"
                  rows={4}
                  style={{ width: '100%', padding: '12px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.09)', color: '#f3f4f6', fontSize: 14, outline: 'none', resize: 'vertical' as const, fontFamily: 'inherit', lineHeight: 1.6, boxSizing: 'border-box' as const, marginBottom: 10, transition: 'border-color 0.15s' }}
                  onFocus={e => (e.currentTarget.style.borderColor = 'rgba(255,208,0,0.35)')}
                  onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)')}
                />
                <button
                  type="submit"
                  disabled={submitting || !newComment.trim()}
                  style={{ padding: '10px 24px', borderRadius: 8, background: submitting || !newComment.trim() ? 'rgba(255,255,255,0.06)' : '#FFD700', color: submitting || !newComment.trim() ? '#4B5563' : '#000', fontWeight: 700, fontSize: 13, border: 'none', cursor: submitting || !newComment.trim() ? 'not-allowed' : 'pointer', transition: 'background 0.15s' }}
                >
                  {submitting ? 'Posting…' : 'Post Comment'}
                </button>
              </form>
            )}

            {/* Comments */}
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
              {!post.comments || post.comments.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#4B5563', fontSize: 14 }}>
                  No comments yet. Be the first to reply.
                </div>
              ) : (
                post.comments.map((comment) => (
                  <div
                    key={comment.id}
                    style={{ padding: '16px 18px', borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
                  >
                    {/* Comment header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      {comment.author.image && <img src={comment.author.image} alt="" style={{ width: 26, height: 26, borderRadius: '50%' }} />}
                      <div style={{ flex: 1 }}>
                        <Link href={`/profile/${comment.author.id}`} style={{ color: '#FFD700', fontWeight: 600, fontSize: 13, textDecoration: 'none' }}>
                          {comment.author.name}
                        </Link>
                        <span style={{ color: '#4B5563', margin: '0 6px' }}>·</span>
                        <span style={{ color: '#4B5563', fontSize: 12 }}>
                          {new Date(comment.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      {/* Vote buttons */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <button
                          onClick={() => handleVote("comment", comment.id, "up")}
                          style={{ padding: '3px 8px', borderRadius: 5, background: userVotes[comment.id] === 'up' ? 'rgba(57,212,110,0.12)' : 'rgba(255,255,255,0.04)', border: `1px solid ${userVotes[comment.id] === 'up' ? 'rgba(57,212,110,0.35)' : 'rgba(255,255,255,0.08)'}`, color: userVotes[comment.id] === 'up' ? '#39D46E' : '#6B7280', fontSize: 11, cursor: 'pointer', transition: 'all 0.15s' }}
                        >
                          ▲ {comment.upvotes}
                        </button>
                        <button
                          onClick={() => handleVote("comment", comment.id, "down")}
                          style={{ padding: '3px 8px', borderRadius: 5, background: userVotes[comment.id] === 'down' ? 'rgba(248,113,113,0.1)' : 'rgba(255,255,255,0.04)', border: `1px solid ${userVotes[comment.id] === 'down' ? 'rgba(248,113,113,0.3)' : 'rgba(255,255,255,0.08)'}`, color: userVotes[comment.id] === 'down' ? '#f87171' : '#6B7280', fontSize: 11, cursor: 'pointer', transition: 'all 0.15s' }}
                        >
                          ▼ {comment.downvotes}
                        </button>
                      </div>
                    </div>

                    {/* Comment content */}
                    <p style={{ color: '#d1d5db', fontSize: 14, lineHeight: 1.65, whiteSpace: 'pre-wrap', margin: 0 }}>
                      {comment.content}
                    </p>
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
