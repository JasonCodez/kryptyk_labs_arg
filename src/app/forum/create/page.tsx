"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import Link from "next/link";

export default function CreateForumPostPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
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
      <div style={{ backgroundColor: '#020202', backgroundImage: 'linear-gradient(135deg, #020202 0%, #0a0a0a 50%, #020202 100%)' }} className="min-h-screen pt-16">
        <div className="max-w-3xl mx-auto px-4 py-12">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">Create New Forum Post</h1>
            <p style={{ color: '#DDDBF1' }}>Start a discussion with the community</p>
          </div>

          <form onSubmit={handleSubmit} className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-6 space-y-6">
            {error && (
              <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-200">
                {error}
              </div>
            )}

            {success && (
              <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20 text-green-200">
                ✓ Post created! Redirecting...
              </div>
            )}

            {/* Title */}
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                Post Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Help with cipher puzzle or Looking for team mates"
                className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3891A6]"
                required
              />
            </div>

            {/* Puzzle Selection */}
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                Related Puzzle (optional)
              </label>
              <select
                value={puzzleId}
                onChange={(e) => setPuzzleId(e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-[#3891A6]"
              >
                <option value="">-- Select a puzzle or leave blank --</option>
                {Array.isArray(puzzles) && puzzles.map((puzzle) => (
                  <option key={puzzle.id} value={puzzle.id}>
                    {puzzle.title}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-2">
                Selecting a puzzle makes it easier for others to find related discussions
              </p>
            </div>

            {/* Content */}
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                Post Content *
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Share your thoughts, ask questions, or propose ideas..."
                rows={10}
                className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3891A6] font-mono text-sm"
                required
              />
              <p className="text-xs text-gray-400 mt-2">
                Be respectful and constructive in your discussion
              </p>
            </div>

            {/* Buttons */}
            <div className="flex gap-4">
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-3 bg-gradient-to-r from-[#3891A6] to-[#FDE74C] hover:from-[#2a7f8f] hover:to-[#FDE74C] disabled:from-gray-500 disabled:to-gray-500 text-white font-semibold rounded-lg transition-all"
              >
                {loading ? "Creating..." : "Create Post"}
              </button>
              <Link
                href="/forum"
                className="px-6 py-3 bg-slate-700/50 hover:bg-slate-700 border border-slate-600 text-white font-semibold rounded-lg transition-all"
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
