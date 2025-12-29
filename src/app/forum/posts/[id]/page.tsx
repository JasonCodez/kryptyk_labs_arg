"use client";

import { useState, useEffect, use } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
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

  if (loading) {
    return (
      <>
        <Navbar />
        <div style={{ backgroundColor: '#020202' }} className="min-h-screen pt-16 flex items-center justify-center">
          <div style={{ color: '#FDE74C' }} className="text-lg">Loading...</div>
        </div>
      </>
    );
  }

  if (!post) {
    return (
      <>
        <Navbar />
        <div style={{ backgroundColor: '#020202' }} className="min-h-screen pt-16 flex items-center justify-center">
          <div className="text-center">
            <div className="text-4xl text-white mb-4">❌</div>
            <p style={{ color: '#DDDBF1' }} className="mb-6">Post not found</p>
            <Link
              href="/forum"
              className="inline-block px-6 py-3 rounded-lg text-white font-semibold"
              style={{ backgroundColor: '#3891A6' }}
            >
              Back to Forum
            </Link>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div style={{ backgroundColor: '#020202', backgroundImage: 'linear-gradient(135deg, #020202 0%, #0a0a0a 50%, #020202 100%)' }} className="min-h-screen pt-16">
        <div className="max-w-4xl mx-auto px-4 py-12">
          {/* Back Link */}
          <Link href="/forum" className="text-sm" style={{ color: '#FDE74C' }}>
            ← Back to Forum
          </Link>

          {/* Post */}
          <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-6 mt-4 mb-8">
            <h1 className="text-3xl font-bold text-white mb-4">{post?.title || "Untitled"}</h1>

            {/* Post Meta */}
            <div className="flex items-center gap-3 mb-6" style={{ borderBottomColor: '#3891A6', borderBottomWidth: '1px', paddingBottom: '1rem' }}>
              {post?.author?.image && (
                <img
                  src={post.author.image}
                  alt={post.author.name || "User"}
                  className="w-10 h-10 rounded-full"
                />
              )}
              <div>
                <Link href={`/profile/${post?.author?.id}`}>
                  <p className="text-white font-semibold hover:opacity-80 cursor-pointer transition-opacity">{post?.author?.name || "Unknown"}</p>
                </Link>
                <p style={{ color: '#DDDBF1' }} className="text-xs">
                  {post?.createdAt ? new Date(post.createdAt).toLocaleDateString() : ""}
                </p>
              </div>
              {post?.puzzle && (
                <div className="ml-auto px-3 py-2 rounded text-sm" style={{ backgroundColor: 'rgba(253, 231, 76, 0.2)', color: '#FDE74C' }}>
                  📌 {post.puzzle.title}
                </div>
              )}
            </div>

            {/* Post Content */}
            <div className="prose prose-invert max-w-none mb-6">
              <p style={{ color: '#DDDBF1' }} className="whitespace-pre-wrap text-base leading-relaxed">
                {post?.content || ""}
              </p>
            </div>

            {/* Post Stats & Voting */}
            <div className="flex items-center gap-4 pt-4" style={{ borderTopColor: '#3891A6', borderTopWidth: '1px' }}>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleVote("post", post?.id || "", "up")}
                  className="text-xl hover:scale-125 transition-transform"
                  title="Upvote"
                >
                  👍
                </button>
                <span style={{ color: '#DDDBF1' }} className="text-sm font-semibold">
                  {post?.upvotes || 0}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleVote("post", post?.id || "", "down")}
                  className="text-xl hover:scale-125 transition-transform"
                  title="Downvote"
                >
                  👎
                </button>
                <span style={{ color: '#DDDBF1' }} className="text-sm font-semibold">
                  {post?.downvotes || 0}
                </span>
              </div>
              <div className="ml-auto flex items-center gap-4 text-sm" style={{ color: '#DDDBF1' }}>
                <span>👁️ {post?.viewCount || 0} views</span>
                <span>💬 {post?.replyCount || 0} replies</span>
              </div>
            </div>
          </div>

          {/* Comments Section */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-6">💬 Discussion ({post.comments.length})</h2>

            {/* New Comment Form */}
            {session && (
              <form onSubmit={handleCommentSubmit} className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-4 mb-6">
                {error && (
                  <div className="p-3 rounded bg-red-500/10 border border-red-500/20 text-red-200 text-sm mb-4">
                    {error}
                  </div>
                )}
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add your comment..."
                  rows={4}
                  className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3891A6] mb-3"
                />
                <button
                  type="submit"
                  disabled={submitting || !newComment.trim()}
                  className="px-6 py-2 bg-gradient-to-r from-[#3891A6] to-[#FDE74C] hover:from-[#2a7f8f] hover:to-[#FDE74C] disabled:from-gray-500 disabled:to-gray-500 text-white font-semibold rounded-lg transition-all"
                >
                  {submitting ? "Posting..." : "Post Comment"}
                </button>
              </form>
            )}

            {/* Comments List */}
            <div className="space-y-4">
              {!post.comments || post.comments.length === 0 ? (
                <div className="text-center py-8">
                  <p style={{ color: '#DDDBF1' }}>No comments yet. Be the first to comment!</p>
                </div>
              ) : (
                (post.comments || []).map((comment) => (
                  <div
                    key={comment.id}
                    className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-4"
                  >
                    {/* Comment Header */}
                    <div className="flex items-center gap-3 mb-2">
                      {comment.author.image && (
                        <img
                          src={comment.author.image}
                          alt={comment.author.name || "User"}
                          className="w-8 h-8 rounded-full"
                        />
                      )}
                      <div>
                        <Link href={`/profile/${comment.author.id}`}>
                          <p className="text-white font-semibold text-sm hover:opacity-80 cursor-pointer transition-opacity">
                            {comment.author.name}
                          </p>
                        </Link>
                        <p style={{ color: '#DDDBF1' }} className="text-xs">
                          {new Date(comment.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    {/* Comment Content */}
                    <p
                      style={{ color: '#DDDBF1' }}
                      className="text-sm mb-3 whitespace-pre-wrap leading-relaxed"
                    >
                      {comment.content}
                    </p>

                    {/* Comment Voting */}
                    <div className="flex items-center gap-3 text-sm">
                      <button
                        onClick={() => handleVote("comment", comment.id, "up")}
                        className="flex items-center gap-1 hover:scale-110 transition-transform"
                        title="Upvote"
                      >
                        <span>👍</span>
                        <span style={{ color: '#DDDBF1' }}>{comment.upvotes}</span>
                      </button>
                      <button
                        onClick={() => handleVote("comment", comment.id, "down")}
                        className="flex items-center gap-1 hover:scale-110 transition-transform"
                        title="Downvote"
                      >
                        <span>👎</span>
                        <span style={{ color: '#DDDBF1' }}>{comment.downvotes}</span>
                      </button>
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
