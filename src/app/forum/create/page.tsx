"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ForumRulesModal from "@/components/ForumRulesModal";
import { useForumRulesGate } from "@/hooks/useForumRulesGate";
import GameButton from "@/components/game-ui/GameButton";

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
      <ForumRulesModal
        open={rulesGate.modalOpen}
        accepting={rulesGate.accepting}
        onAccept={rulesGate.handleAccept}
        onClose={rulesGate.handleClose}
      />
      <div style={{ backgroundColor: '#170B26', minHeight: '100vh', paddingTop: 80 }}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '48px 20px 80px' }}>

          {/* Back + header */}
          <Link href="/forum"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#C8B8E0', textDecoration: 'none', marginBottom: 28, transition: 'color 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#FFC93C')}
            onMouseLeave={e => (e.currentTarget.style.color = '#C8B8E0')}
          >
            ← Forum
          </Link>

          <h1 style={{ fontSize: 'clamp(24px,4vw,38px)', fontWeight: 900, color: '#fff', letterSpacing: '-0.03em', margin: '0 0 6px' }}>New Post</h1>
          <p style={{ color: '#C8B8E0', fontSize: 14, marginBottom: 36 }}>Start a discussion with the community.</p>

          <div className="relative overflow-hidden shadow-skeu-panel" style={{ background: 'linear-gradient(160deg, #32205A, #241640 60%)', border: '1px solid rgba(255,79,163,0.18)', borderRadius: 14, padding: '32px 28px' }}>
            <span className="game-gloss-overlay" aria-hidden style={{ opacity: 0.5 }} />
            <div className="relative">

            {error && (
              <div style={{ padding: '12px 16px', borderRadius: 8, background: 'rgba(255,90,90,0.08)', border: '1px solid rgba(255,90,90,0.25)', color: '#FF5A5A', fontSize: 14, marginBottom: 20 }}>
                {error}
              </div>
            )}
            {success && (
              <div style={{ padding: '12px 16px', borderRadius: 8, background: 'rgba(62,217,122,0.08)', border: '1px solid rgba(62,217,122,0.25)', color: '#3ED97A', fontSize: 14, marginBottom: 20 }}>
                ✓ Post created! Redirecting…
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column' as const, gap: 22 }}>

              {/* Title */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: '#C8B8E0', marginBottom: 8 }}>
                  Title <span style={{ color: '#FF5A5A' }}>*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Help with today's cipher puzzle"
                  required
                  style={{ width: '100%', padding: '11px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,79,163,0.18)', color: '#FFF6FB', fontSize: 14, outline: 'none', boxSizing: 'border-box' as const, transition: 'border-color 0.15s' }}
                  onFocus={e => (e.currentTarget.style.borderColor = 'rgba(255,201,60,0.5)')}
                  onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,79,163,0.18)')}
                />
              </div>

              {/* Puzzle */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: '#C8B8E0', marginBottom: 8 }}>
                  Related Puzzle <span style={{ color: '#8C7BAD', fontWeight: 400, textTransform: 'none' as const, letterSpacing: 0 }}>(optional)</span>
                </label>
                <select
                  value={puzzleId}
                  onChange={(e) => setPuzzleId(e.target.value)}
                  style={{ width: '100%', padding: '11px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,79,163,0.18)', color: '#FFF6FB', fontSize: 14, outline: 'none', boxSizing: 'border-box' as const }}
                >
                  <option value="" style={{ background: '#241640' }}>— No specific puzzle —</option>
                  {Array.isArray(puzzles) && puzzles.map((puzzle) => (
                    <option key={puzzle.id} value={puzzle.id} style={{ background: '#241640' }}>
                      {puzzle.title}
                    </option>
                  ))}
                </select>
                <p style={{ fontSize: 12, color: '#8C7BAD', marginTop: 6 }}>Links your post to a puzzle so others can find related discussions.</p>
              </div>

              {/* Content */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: '#C8B8E0', marginBottom: 8 }}>
                  Content <span style={{ color: '#FF5A5A' }}>*</span>
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Share your thoughts, ask questions, or propose ideas…"
                  rows={10}
                  required
                  style={{ width: '100%', padding: '11px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,79,163,0.18)', color: '#FFF6FB', fontSize: 14, outline: 'none', resize: 'vertical' as const, fontFamily: 'ui-monospace,monospace', lineHeight: 1.65, boxSizing: 'border-box' as const, transition: 'border-color 0.15s' }}
                  onFocus={e => (e.currentTarget.style.borderColor = 'rgba(255,201,60,0.5)')}
                  onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,79,163,0.18)')}
                />
                <p style={{ fontSize: 12, color: '#8C7BAD', marginTop: 6 }}>Be respectful and constructive.</p>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 12, paddingTop: 4 }}>
                <GameButton type="submit" variant="pink" disabled={loading}>
                  {loading ? 'Creating…' : 'Publish Post'}
                </GameButton>
                <Link
                  href="/forum"
                  style={{ padding: '12px 24px', borderRadius: 8, background: 'transparent', border: '1px solid rgba(255,79,163,0.18)', color: '#C8B8E0', fontWeight: 600, fontSize: 14, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
                >
                  Cancel
                </Link>
              </div>
            </form>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
