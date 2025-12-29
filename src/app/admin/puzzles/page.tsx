"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import Link from "next/link";

interface PuzzleFormData {
  title: string;
  description: string;
  content: string;
  category: string;
  difficulty: string;
  correctAnswer: string;
  pointsReward: number;
  hints: string[];
  isMultiPart: boolean;
  parts: PuzzlePart[];
}

interface PuzzlePart {
  title: string;
  content: string;
  answer: string;
  points: number;
}

interface MediaFile {
  id: string;
  type: string;
  url: string;
  fileName: string;
  title?: string;
  fileSize: number;
  isTemporary?: boolean;
}

export default function AdminPuzzlesPageV2() {
  const { data: session, status } = useSession();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [puzzleId, setPuzzleId] = useState<string | null>(null);
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [formData, setFormData] = useState<PuzzleFormData>({
    title: "",
    description: "",
    content: "",
    category: "general",
    difficulty: "medium",
    correctAnswer: "",
    pointsReward: 100,
    hints: ["", "", ""],
    isMultiPart: false,
    parts: [
      { title: "Part 1", content: "", answer: "", points: 50 },
      { title: "Part 2", content: "", answer: "", points: 50 },
    ],
  });
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      redirect("/auth/signin");
      return;
    }

    if (session?.user?.email) {
      checkAdminStatus();
    }
  }, [session, status]);

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

  const handleMultiPartToggle = () => {
    setFormData((prev) => ({
      ...prev,
      isMultiPart: !prev.isMultiPart,
    }));
  };

  const handlePartChange = (index: number, field: string, value: string | number) => {
    const newParts = [...formData.parts];
    newParts[index] = {
      ...newParts[index],
      [field]: value,
    };
    setFormData((prev) => ({
      ...prev,
      parts: newParts,
    }));
  };

  const addPuzzlePart = () => {
    setFormData((prev) => ({
      ...prev,
      parts: [
        ...prev.parts,
        { title: `Part ${prev.parts.length + 1}`, content: "", answer: "", points: 50 },
      ],
    }));
  };

  const removePuzzlePart = (index: number) => {
    if (formData.parts.length > 2) {
      setFormData((prev) => ({
        ...prev,
        parts: prev.parts.filter((_, i) => i !== index),
      }));
    }
  };

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (!files) return;

    setUploadingMedia(true);
    setFormError("");

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        if (puzzleId) {
          // Upload directly if puzzle exists
          const formDataUpload = new FormData();
          formDataUpload.append("file", file);
          formDataUpload.append("puzzleId", puzzleId);

          const response = await fetch("/api/admin/media", {
            method: "POST",
            body: formDataUpload,
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || "Failed to upload file");
          }

          const mediaData = await response.json();
          setMediaFiles((prev) => [...prev, mediaData]);
        } else {
          // Create temporary media preview
          const reader = new FileReader();
          reader.onload = () => {
            const tempMedia: MediaFile = {
              id: `temp-${Date.now()}-${i}`,
              fileName: file.name,
              fileSize: file.size,
              url: reader.result as string,
              type: file.type.startsWith("image/") ? "image" : 
                    file.type.startsWith("video/") ? "video" :
                    file.type.startsWith("audio/") ? "audio" : "document",
              isTemporary: true,
            };
            setMediaFiles((prev) => [...prev, tempMedia]);
          };
          reader.readAsDataURL(file);
        }
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingMedia(false);
      e.currentTarget.value = "";
    }
  };

  const handleDeleteMedia = async (mediaId: string) => {
    if (!confirm("Delete this media file?")) return;

    try {
      if (mediaId.startsWith("temp-")) {
        // Just remove from local state if temporary
        setMediaFiles((prev) => prev.filter((m) => m.id !== mediaId));
      } else {
        // Delete from server if already persisted
        const response = await fetch(`/api/admin/media?id=${mediaId}`, {
          method: "DELETE",
        });

        if (!response.ok) throw new Error("Failed to delete media");

        setMediaFiles((prev) => prev.filter((m) => m.id !== mediaId));
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError("");
    setFormSuccess("");

    try {
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

      const createdPuzzle = await response.json();
      setPuzzleId(createdPuzzle.id);

      // Upload temporary media files
      const tempMediaFiles = mediaFiles.filter((m) => m.isTemporary);
      if (tempMediaFiles.length > 0) {
        for (const tempMedia of tempMediaFiles) {
          try {
            const formDataUpload = new FormData();
            // Fetch the blob from the data URL
            const response = await fetch(tempMedia.url);
            const blob = await response.blob();
            formDataUpload.append("file", blob, tempMedia.fileName);
            formDataUpload.append("puzzleId", createdPuzzle.id);

            const uploadResponse = await fetch("/api/admin/media", {
              method: "POST",
              body: formDataUpload,
            });

            if (uploadResponse.ok) {
              const uploadedMedia = await uploadResponse.json();
              setMediaFiles((prev) =>
                prev.map((m) => (m.id === tempMedia.id ? uploadedMedia : m))
              );
            }
          } catch (err) {
            console.error("Failed to upload temporary media:", err);
          }
        }
      }

      setFormSuccess("✅ Puzzle created! Media files have been uploaded.");
      setFormData({
        title: "",
        description: "",
        content: "",
        category: "general",
        difficulty: "medium",
        correctAnswer: "",
        pointsReward: 100,
        hints: ["", "", ""],
        isMultiPart: false,
        parts: [
          { title: "Part 1", content: "", answer: "", points: 50 },
          { title: "Part 2", content: "", answer: "", points: 50 },
        ],
      });
      // Keep media files so user can see what was uploaded
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#020202' }}>
        <p style={{ color: '#FDE74C' }} className="text-lg">Loading...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#020202' }}>
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-4">❌ Access Denied</h1>
          <p style={{ color: '#DDDBF1' }} className="mb-6">You don't have permission to access the admin panel.</p>
          <Link
            href="/dashboard"
            className="inline-block px-6 py-3 text-white font-semibold rounded-lg transition-all hover:opacity-90"
            style={{ backgroundColor: '#3891A6' }}
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: '#020202', backgroundImage: 'linear-gradient(135deg, #020202 0%, #0a0a0a 50%, #020202 100%)' }} className="min-h-screen">
      {/* Header with Logo */}
      <nav className="backdrop-blur-md" style={{ borderBottomColor: '#3891A6', borderBottomWidth: '1px', backgroundColor: 'rgba(76, 91, 92, 0.7)' }}>
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/dashboard" className="flex items-center gap-3 hover:opacity-80 transition">
            <img src="/images/logo.png" alt="Kryptyk Labs Logo" className="h-10 w-auto" />
            <div className="text-2xl font-bold" style={{ color: '#3891A6' }}>
              Kryptyk Labs
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/admin/analytics"
              className="px-4 py-2 rounded-lg border text-white hover:opacity-90 transition-all"
              style={{ backgroundColor: 'rgba(253, 231, 76, 0.2)', borderColor: '#FDE74C', color: '#FDE74C' }}
            >
              📊 Analytics
            </Link>
            <Link
              href="/dashboard"
              className="px-4 py-2 rounded-lg border text-white hover:opacity-90 transition-all"
              style={{ backgroundColor: '#2a3a3b', borderColor: '#3891A6' }}
            >
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </nav>
      
      <div className="pt-20">

        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-white mb-2">🧩 Create Puzzle</h1>
          <p className="text-[#9BD1D6] mb-8">Add a new ARG puzzle with rich media support</p>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Main Form */}
            <div className="md:col-span-2">
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
                    className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3891A6]"
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
                    rows={3}
                    placeholder="Brief description of the puzzle..."
                    className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3891A6]"
                  />
                </div>

                {/* Content - Rich Editor Style */}
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">
                    Puzzle Content / Story *
                  </label>
                  <textarea
                    name="content"
                    value={formData.content}
                    onChange={handleInputChange}
                    required
                    rows={6}
                    placeholder="Full puzzle description, story, or instructions. You can add HTML formatting and reference media using [media-id] tags..."
                    className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3891A6] font-mono text-sm"
                  />
                  <p className="text-xs text-gray-400 mt-2">
                    💡 Tip: Use &lt;br/&gt;, &lt;strong&gt;, &lt;em&gt; tags. Upload media first, then reference by ID.
                  </p>
                </div>

                {/* Category & Difficulty */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">
                      Category *
                    </label>
                    <select
                      name="category"
                      value={formData.category}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-[#3891A6]"
                    >
                      <option value="general">General</option>
                      <option value="cryptography">Cryptography</option>
                      <option value="steganography">Steganography</option>
                      <option value="logic">Logic</option>
                      <option value="code">Code</option>
                      <option value="history">History</option>
                      <option value="science">Science</option>
                      <option value="media">Media Analysis</option>
                      <option value="social">Social Engineering</option>
                      <option value="technical">Technical</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">
                      Difficulty *
                    </label>
                    <select
                      name="difficulty"
                      value={formData.difficulty}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-[#3891A6]"
                    >
                      <option value="easy">🟢 Easy</option>
                      <option value="medium">🟡 Medium</option>
                      <option value="hard">🔴 Hard</option>
                      <option value="extreme">⚫ Extreme</option>
                    </select>
                  </div>
                </div>

                {/* Answer & Points */}
                <div className="grid grid-cols-2 gap-4">
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
                      placeholder="The answer (case-insensitive)"
                      className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3891A6]"
                    />
                  </div>
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
                      className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-[#3891A6]"
                    />
                  </div>
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
                        className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3891A6]"
                      />
                    ))}
                  </div>
                </div>

                {/* Multi-Part Toggle */}
                <div>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isMultiPart}
                      onChange={handleMultiPartToggle}
                      className="w-5 h-5 rounded bg-slate-700/50 border border-slate-600 text-[#3891A6] focus:ring-2 focus:ring-[#3891A6]"
                    />
                    <span className="text-sm font-semibold text-gray-300">
                      Make this a multi-step puzzle (ARG Challenge)
                    </span>
                  </label>
                  <p className="text-xs text-gray-400 mt-2">
                    Create a puzzle with multiple sequential steps/parts that users must complete in order.
                  </p>
                </div>

                {/* Multi-Part Puzzle Editor */}
                {formData.isMultiPart && (
                  <div className="border-t border-slate-700 pt-6">
                    <div className="flex items-center justify-between mb-4">
                      <label className="text-sm font-semibold text-gray-300">
                        Puzzle Steps ({formData.parts.length})
                      </label>
                      <button
                        type="button"
                        onClick={addPuzzlePart}
                        className="px-3 py-1 text-sm bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
                      >
                        + Add Step
                      </button>
                    </div>

                    <div className="space-y-6">
                      {formData.parts.map((part, index) => (
                        <div
                          key={index}
                          className="bg-slate-700/30 rounded-lg p-4 border border-slate-600"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-bold text-gray-200">
                              Step {index + 1}
                            </h4>
                            {formData.parts.length > 2 && (
                              <button
                                type="button"
                                onClick={() => removePuzzlePart(index)}
                                className="text-red-400 hover:text-red-300 text-xs font-semibold"
                              >
                                Remove
                              </button>
                            )}
                          </div>

                          {/* Part Title */}
                          <input
                            type="text"
                            value={part.title}
                            onChange={(e) =>
                              handlePartChange(index, "title", e.target.value)
                            }
                            placeholder="Step title (e.g., 'Find the cipher')"
                            className="w-full px-3 py-2 rounded bg-slate-700/50 border border-slate-600 text-white placeholder-gray-400 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-[#3891A6]"
                          />

                          {/* Part Content */}
                          <textarea
                            value={part.content}
                            onChange={(e) =>
                              handlePartChange(index, "content", e.target.value)
                            }
                            placeholder="Content/instructions for this step..."
                            rows={3}
                            className="w-full px-3 py-2 rounded bg-slate-700/50 border border-slate-600 text-white placeholder-gray-400 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-[#3891A6]"
                          />

                          {/* Part Answer & Points */}
                          <div className="grid grid-cols-2 gap-3">
                            <input
                              type="text"
                              value={part.answer}
                              onChange={(e) =>
                                handlePartChange(index, "answer", e.target.value)
                              }
                              placeholder="Step answer"
                              className="px-3 py-2 rounded bg-slate-700/50 border border-slate-600 text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-[#3891A6]"
                            />
                            <input
                              type="number"
                              value={part.points}
                              onChange={(e) =>
                                handlePartChange(index, "points", parseInt(e.target.value))
                              }
                              placeholder="Points"
                              min="10"
                              max="500"
                              className="px-3 py-2 rounded bg-slate-700/50 border border-slate-600 text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-[#3891A6]"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={submitting || (formData.isMultiPart && formData.parts.some(p => !p.answer))}
                  className="w-full px-6 py-3 bg-gradient-to-r from-[#3891A6] to-[#FDE74C] hover:from-[#2a7f8f] hover:to-[#FDE74C] disabled:from-gray-500 disabled:to-gray-500 text-white font-semibold rounded-lg transition-all"
                >
                  {submitting ? "Creating..." : "Create Puzzle"}
                </button>
              </form>
            </div>

            {/* Media Sidebar */}
            <div className="md:col-span-1">
              <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-6 sticky top-20">
                <h2 className="text-xl font-bold text-white mb-4">📁 Media Files</h2>

                <div className="mb-4">
                  <label className="block text-sm font-semibold text-gray-300 mb-2">
                    Upload Media (Audio, Video, Images)
                  </label>
                  <input
                    type="file"
                    multiple
                    onChange={handleMediaUpload}
                    disabled={uploadingMedia}
                    accept="image/*,video/*,audio/*,.pdf"
                    className="w-full px-3 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#3891A6] file:bg-[#3891A6] file:text-white file:rounded file:border-0 file:px-3 file:py-1 file:cursor-pointer"
                  />
                  <p className="text-xs text-gray-400 mt-2">
                    Max 500MB per file. Supports: images, video, audio, PDF
                  </p>
                  {!puzzleId && (
                    <p className="text-xs text-yellow-300 mt-2">
                      💡 Upload media now, it will be associated when you create the puzzle.
                    </p>
                  )}
                </div>

                {uploadingMedia && (
                  <div className="text-yellow-300 text-sm mb-4">⏳ Uploading...</div>
                )}

                {mediaFiles.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-gray-300">
                      Uploaded ({mediaFiles.length})
                    </h3>
                    {mediaFiles.map((media) => (
                      <div
                        key={media.id}
                        className={`rounded p-3 text-sm border ${
                          media.isTemporary
                            ? "bg-yellow-500/10 border-yellow-500/30"
                            : "bg-slate-700/50 border-slate-600"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-medium truncate">
                              {media.type === "image" && "🖼️"}
                              {media.type === "video" && "🎬"}
                              {media.type === "audio" && "🎵"}
                              {media.type === "document" && "📄"}
                              {" "}
                              {media.fileName}
                              {media.isTemporary && " (pending)"}
                            </p>
                            <p className="text-gray-400 text-xs">
                              {(media.fileSize / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                          <button
                            onClick={() => handleDeleteMedia(media.id)}
                            className="text-red-400 hover:text-red-300 text-xs whitespace-nowrap"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
