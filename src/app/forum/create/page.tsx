"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import Link from "next/link";
import ForumRulesModal from "@/components/ForumRulesModal";
import { useForumRulesGate } from "@/hooks/useForumRulesGate";

export default function CreateForumPostPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const rulesGate = useForumRulesGate();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [puzzleId, setPuzzleId] = useState<string>("");
  const [puzzles, setPuzzles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
      return;
    }

    fetchPuzzles();
  }, [status, router]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);

    try {
      if (!title.trim()) {
        throw new Error("Title is required");
      }
      if (!content.trim()) {
        throw new Error("Content is required");
      }

      const rulesAccepted = await rulesGate.ensureAccepted();
      if (!rulesAccepted) return;

      const response = await fetch("/api/forum/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          content,
          puzzleId: puzzleId || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create post");
      }

      const post = await response.json();
      setSuccess(true);
      setTimeout(() => {
        router.push(`/forum/posts/${post.id}`);
      }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Navbar />
      <ForumRulesModal
        open={rulesGate.modalOpen}
        accepting={rulesGate.accepting}
        onAccept={rulesGate.handleAccept}
        onClose={rulesGate.handleClose}
      />
      <div style={{ backgroundColor: '#010101', minHeight: '100vh', paddingTop: 80 }}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '48px 20px 80px' }}>

          {/* Back + header */}
          <Link href="/forum"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#6B7280', textDecoration: 'none', marginBottom: 28, transition: 'color 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#FFD700')}
            onMouseLeave={e => (e.currentTarget.style.color = '#6B7280')}
          >
            ← Forum
          </Link>

          <h1 style={{ fontSize: 'clamp(24px,4vw,38px)', fontWeight: 900, color: '#fff', letterSpacing: '-0.03em', margin: '0 0 6px' }}>New Post</h1>
          <p style={{ color: '#6B7280', fontSize: 14, marginBottom: 36 }}>Start a discussion with the community.</p>

          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '32px 28px' }}>

            {error && (
              <div style={{ padding: '12px 16px', borderRadius: 8, background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', color: '#fca5a5', fontSize: 14, marginBottom: 20 }}>
                {error}
              </div>
            )}
            {success && (
              <div style={{ padding: '12px 16px', borderRadius: 8, background: 'rgba(57,212,110,0.08)', border: '1px solid rgba(57,212,110,0.25)', color: '#6ee7b7', fontSize: 14, marginBottom: 20 }}>
                ✓ Post created! Redirecting…
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column' as const, gap: 22 }}>

              {/* Title */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: '#9ca3af', marginBottom: 8 }}>
                  Title <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Help with today's cipher puzzle"
                  required
                  style={{ width: '100%', padding: '11px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#f3f4f6', fontSize: 14, outline: 'none', boxSizing: 'border-box' as const, transition: 'border-color 0.15s' }}
                  onFocus={e => (e.currentTarget.style.borderColor = 'rgba(255,208,0,0.4)')}
                  onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')}
                />
              </div>

              {/* Puzzle */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: '#9ca3af', marginBottom: 8 }}>
                  Related Puzzle <span style={{ color: '#4B5563', fontWeight: 400, textTransform: 'none' as const, letterSpacing: 0 }}>(optional)</span>
                </label>
                <select
                  value={puzzleId}
                  onChange={(e) => setPuzzleId(e.target.value)}
                  style={{ width: '100%', padding: '11px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#e5e7eb', fontSize: 14, outline: 'none', boxSizing: 'border-box' as const }}
                >
                  <option value="" style={{ background: '#111' }}>— No specific puzzle —</option>
                  {Array.isArray(puzzles) && puzzles.map((puzzle) => (
                    <option key={puzzle.id} value={puzzle.id} style={{ background: '#111' }}>
                      {puzzle.title}
                    </option>
                  ))}
                </select>
                <p style={{ fontSize: 12, color: '#4B5563', marginTop: 6 }}>Links your post to a puzzle so others can find related discussions.</p>
              </div>

              {/* Content */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: '#9ca3af', marginBottom: 8 }}>
                  Content <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Share your thoughts, ask questions, or propose ideas…"
                  rows={10}
                  required
                  style={{ width: '100%', padding: '11px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#f3f4f6', fontSize: 14, outline: 'none', resize: 'vertical' as const, fontFamily: 'ui-monospace,monospace', lineHeight: 1.65, boxSizing: 'border-box' as const, transition: 'border-color 0.15s' }}
                  onFocus={e => (e.currentTarget.style.borderColor = 'rgba(255,208,0,0.4)')}
                  onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')}
                />
                <p style={{ fontSize: 12, color: '#4B5563', marginTop: 6 }}>Be respectful and constructive.</p>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 12, paddingTop: 4 }}>
                <button
                  type="submit"
                  disabled={loading}
                  style={{ padding: '12px 28px', borderRadius: 8, background: loading ? 'rgba(255,255,255,0.06)' : '#FFD700', color: loading ? '#6B7280' : '#000', fontWeight: 700, fontSize: 14, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', transition: 'background 0.15s' }}
                >
                  {loading ? 'Creating…' : 'Publish Post'}
                </button>
                <Link
                  href="/forum"
                  style={{ padding: '12px 24px', borderRadius: 8, background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', color: '#9ca3af', fontWeight: 600, fontSize: 14, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
                >
                  Cancel
                </Link>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
