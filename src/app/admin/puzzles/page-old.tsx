"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import Link from "next/link";

interface PuzzleFormData {
  title: string;
  description: string;
  category: string;
  correctAnswer: string;
  pointsReward: number;
  hints: string[];
}

export default function AdminPuzzlesPage() {
  const { data: session, status } = useSession();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState<PuzzleFormData>({
    title: "",
    description: "",
    category: "general",
    correctAnswer: "",
    pointsReward: 100,
    hints: ["", "", ""],
  });
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      redirect("/auth/signin");
      return;
    }

    // Check if user is admin
    const checkAdminStatus = async () => {
      try {
        const response = await fetch("/api/admin/check");
        if (response.ok) {
          const data = await response.json();
          setIsAdmin(data.isAdmin);
        }
      } catch (error) {
        console.error("Failed to check admin status:", error);
      } finally {
        setLoading(false);
      }
    };

    if (session?.user?.email) {
      checkAdminStatus();
    }
  }, [session, status]);

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <p className="text-white text-lg">Loading...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-4">❌ Access Denied</h1>
          <p className="text-gray-300 mb-6">You don't have permission to access the admin panel.</p>
          <Link
            href="/dashboard"
            className="inline-block px-6 py-3 bg-gradient-to-r from-[#3891A6] to-[#FDE74C] hover:from-[#2a7f8f] hover:to-[#FDE74C] text-white font-semibold rounded-lg transition-all"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "pointsReward" ? parseInt(value) : value,
    }));
  };

  const handleHintChange = (index: number, value: string) => {
    const newHints = [...formData.hints];
    newHints[index] = value;
    setFormData((prev) => ({
      ...prev,
      hints: newHints,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError("");
    setFormSuccess("");

    try {
      // Filter out empty hints
      const filteredHints = formData.hints.filter((h) => h.trim() !== "");

      const response = await fetch("/api/admin/puzzles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          hints: filteredHints,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create puzzle");
      }

      setFormSuccess("Puzzle created successfully!");
      setFormData({
        title: "",
        description: "",
        category: "general",
        correctAnswer: "",
        pointsReward: 100,
        hints: ["", "", ""],
      });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 pt-20">
      <div className="container mx-auto px-4 py-8">
        <Link
          href="/dashboard"
          className="inline-block mb-6 px-4 py-2 rounded-lg bg-slate-800/50 border border-[#3891A6]/20 text-[#9BD1D6] hover:bg-slate-800 transition-all"
        >
          ← Back to Dashboard
        </Link>

        <div className="max-w-2xl mx-auto">
          <h1 className="text-4xl font-bold text-white mb-2">Create Puzzle</h1>
          <p className="text-[#9BD1D6] mb-8">Add a new puzzle to the game</p>

          <form
            onSubmit={handleSubmit}
            className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-6 space-y-6"
          >
            {formError && (
              <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-200">
                {formError}
              </div>
            )}

            {formSuccess && (
              <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20 text-green-200">
                {formSuccess}
              </div>
            )}

            {/* Title */}
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                Puzzle Title *
              </label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                required
                placeholder="e.g., The Hidden Message"
                className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                Description *
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                required
                rows={4}
                placeholder="Describe the puzzle and how to solve it..."
                className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                Category *
              </label>
              <select
                name="category"
                value={formData.category}
                onChange={handleInputChange}
                className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="general">General</option>
                <option value="cryptography">Cryptography</option>
                <option value="steganography">Steganography</option>
                <option value="logic">Logic</option>
                <option value="code">Code</option>
                <option value="history">History</option>
                <option value="science">Science</option>
              </select>
            </div>

            {/* Correct Answer */}
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                Correct Answer *
              </label>
              <input
                type="text"
                name="correctAnswer"
                value={formData.correctAnswer}
                onChange={handleInputChange}
                required
                placeholder="The correct answer (case-insensitive)"
                className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {/* Points Reward */}
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                Points Reward *
              </label>
              <input
                type="number"
                name="pointsReward"
                value={formData.pointsReward}
                onChange={handleInputChange}
                required
                min="10"
                max="1000"
                className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {/* Hints */}
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                Hints (optional)
              </label>
              <div className="space-y-2">
                {formData.hints.map((hint, index) => (
                  <input
                    key={index}
                    type="text"
                    value={hint}
                    onChange={(e) => handleHintChange(index, e.target.value)}
                    placeholder={`Hint ${index + 1} (leave blank to skip)`}
                    className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                ))}
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full px-6 py-3 bg-gradient-to-r from-[#3891A6] to-[#FDE74C] hover:from-[#2a7f8f] hover:to-[#FDE74C] disabled:from-gray-500 disabled:to-gray-500 text-white font-semibold rounded-lg transition-all"
            >
              {submitting ? "Creating..." : "Create Puzzle"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
