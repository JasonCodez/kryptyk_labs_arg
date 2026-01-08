"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
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
      <Navbar />
      <div style={{ backgroundColor: '#020202', backgroundImage: 'linear-gradient(135deg, #020202 0%, #0a0a0a 50%, #020202 100%)' }} className="min-h-screen pt-16">
        <div className="max-w-6xl mx-auto px-4 py-12">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">💬 Puzzle Forum</h1>
            <p style={{ color: '#DDDBF1' }}>
              Discuss puzzles, ask questions, and collaborate with other players
            </p>
          </div>

          {/* Create Post Button & Filters */}
          <div className="flex flex-col md:flex-row gap-4 mb-8">
            <Link
              href="/forum/create"
              className="px-6 py-3 rounded-lg text-white font-semibold transition-all hover:opacity-90"
              style={{ backgroundColor: '#FDE74C', color: '#000' }}
            >
              + Create Post
            </Link>

            {/* Puzzle Filter */}
            <select
              value={selectedPuzzleId || ""}
              onChange={(e) => {
                setSelectedPuzzleId(e.target.value || null);
                setPage(1);
              }}
              className="px-4 py-3 rounded-lg bg-slate-800/50 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-[#3891A6]"
            >
              <option value="">All Puzzles</option>
              {Array.isArray(puzzles) && puzzles.map((puzzle) => (
                <option key={puzzle.id} value={puzzle.id}>
                  {puzzle.title}
                </option>
              ))}
            </select>
          </div>

          {/* Posts List */}
          {loading ? (
            <div className="text-center py-12">
              <div style={{ color: '#FDE74C' }} className="text-lg">Loading posts...</div>
            </div>
          ) : !posts || posts.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-5xl mb-4">💬</div>
              <p style={{ color: '#DDDBF1' }} className="text-lg mb-6">
                No posts yet. Be the first to start a discussion!
              </p>
              <Link
                href="/forum/create"
                className="inline-block px-6 py-3 rounded-lg text-white font-semibold transition-all hover:opacity-90"
                style={{ backgroundColor: '#3891A6' }}
              >
                Create First Post
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {Array.isArray(posts) && posts.map((post) => (
                <Link key={post.id} href={`/forum/posts/${post.id}`}>
                  <div className="border rounded-lg p-6 hover:shadow-lg transition-all cursor-pointer" style={{ backgroundColor: 'rgba(56, 145, 166, 0.1)', borderColor: '#3891A6' }}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-white mb-2">
                          {post.title}
                        </h3>
                        <p style={{ color: '#DDDBF1' }} className="text-sm line-clamp-2">
                          {post.content}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center flex-wrap gap-3 pt-4" style={{ borderTopColor: '#3891A6', borderTopWidth: '1px' }}>
                      <div className="flex items-center gap-2">
                        {post.author.image && (
                          <img
                            src={post.author.image}
                            alt={post.author.name || "User"}
                            className="w-6 h-6 rounded-full"
                          />
                        )}
                        <span
                          style={{ color: '#FDE74C' }}
                          className="text-xs font-semibold hover:opacity-80 cursor-pointer transition-opacity"
                          onClick={e => {
                            e.stopPropagation();
                            window.location.href = `/profile/${post.author.id}`;
                          }}
                          role="link"
                          tabIndex={0}
                          onKeyDown={e => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              window.location.href = `/profile/${post.author.id}`;
                            }
                          }}
                        >
                          {post.author.name}
                        </span>
                      </div>

                      {post.puzzle && (
                        <span className="px-2 py-1 rounded text-xs" style={{ backgroundColor: 'rgba(253, 231, 76, 0.2)', color: '#FDE74C' }}>
                          📌 {post.puzzle.title}
                        </span>
                      )}

                      <div className="ml-auto flex items-center gap-4 text-xs" style={{ color: '#DDDBF1' }}>
                        <span>👁️ {post.viewCount}</span>
                        <span>💬 {post.replyCount}</span>
                        <span>👍 {post.upvotes - post.downvotes}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-8">
              {page > 1 && (
                <button
                  onClick={() => fetchPosts(page - 1)}
                  className="px-4 py-2 rounded bg-slate-800/50 border border-slate-600 text-white hover:opacity-90"
                >
                  ← Previous
                </button>
              )}
              <div className="px-4 py-2 text-white">
                Page {page} of {totalPages}
              </div>
              {page < totalPages && (
                <button
                  onClick={() => fetchPosts(page + 1)}
                  className="px-4 py-2 rounded bg-slate-800/50 border border-slate-600 text-white hover:opacity-90"
                >
                  Next →
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
