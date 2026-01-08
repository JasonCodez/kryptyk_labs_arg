"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PuzzleTypeFields from "@/components/admin/PuzzleTypeFields";
import JigsawPuzzle from "@/components/puzzle/JigsawPuzzle";

interface PuzzleFormData {
  title: string;
  description: string;
  content: string;
  category: string;
  difficulty: string;
  puzzleType: string;
  correctAnswer: string;
  pointsReward: number;
  hints: string[];
  isMultiPart: boolean;
  parts: PuzzlePart[];
  puzzleData: Record<string, unknown>;
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

const PUZZLE_TYPES = [
  { value: 'general', label: 'General Riddle' },
  { value: 'jigsaw', label: 'Jigsaw Puzzle' },
  { value: 'cipher', label: 'Cipher' },
  { value: 'text_extraction', label: 'Text Extraction' },
  { value: 'coordinates', label: 'Coordinates' },
  { value: 'image_analysis', label: 'Image Analysis' },
  { value: 'audio_spectrum', label: 'Audio Spectrum' },
  { value: 'morse_code', label: 'Morse Code' },
  { value: 'steganography', label: 'Steganography' },
  { value: 'multi_step', label: 'Multi-Step' },
  { value: 'math', label: 'Math Problem' },
  { value: 'pattern', label: 'Pattern Matching' },
  { value: 'escape_room', label: 'Escape Room' },
];

export default function AdminPuzzlesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [puzzleId, setPuzzleId] = useState<string | null>(null);
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [jigsawImage, setJigsawImage] = useState<File | null>(null);
  const [jigsawImagePreview, setJigsawImagePreview] = useState<string>("");
  const [formData, setFormData] = useState<PuzzleFormData>({
    title: "",
    description: "",
    content: "",
    category: "general",
    difficulty: "medium",
    puzzleType: "general",
    correctAnswer: "",
    pointsReward: 100,
    hints: ["", "", ""],
    isMultiPart: false,
    parts: [
      { title: "Part 1", content: "", answer: "", points: 50 },
      { title: "Part 2", content: "", answer: "", points: 50 },
    ],
    puzzleData: {},
  });
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
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

  const handleAddHint = () => {
    setFormData((prev) => ({
      ...prev,
      hints: [...prev.hints, ""],
    }));
  };

  const handleRemoveHint = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      hints: prev.hints.filter((_, i) => i !== index),
    }));
  };

  const handlePuzzleDataChange = (key: string, value: unknown) => {
    setFormData((prev) => ({
      ...prev,
      puzzleData: {
        ...prev.puzzleData,
        [key]: value,
      },
    }));
  };

  const handleJigsawImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    if (!file) return;

    console.log(`[JIGSAW IMAGE] File selected: ${file.name}, size: ${file.size}, type: ${file.type}`);

    setJigsawImage(file);

    // Create preview
    const reader = new FileReader();
    reader.onload = () => {
      const preview = reader.result as string;
      setJigsawImagePreview(preview);
      console.log(`[JIGSAW IMAGE] Preview created`);
    };
    reader.readAsDataURL(file);
  };

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (!files) return;

    setUploadingMedia(true);
    setFormError("");

    try {
      const promises: Promise<void>[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        console.log(`[MEDIA UPLOAD] Processing file ${i + 1}/${files.length}: ${file.name} (${file.type})`);
        
        if (puzzleId) {
          console.log(`[MEDIA UPLOAD] Puzzle exists (${puzzleId}), uploading to API`);
          
          const uploadPromise = (async () => {
            const formDataUpload = new FormData();
            formDataUpload.append("file", file);
            formDataUpload.append("puzzleId", puzzleId);

            const response = await fetch("/api/admin/media", {
              method: "POST",
              body: formDataUpload,
            }).catch(err => {
              console.error(`[MEDIA UPLOAD] Fetch failed for ${file.name}:`, err);
              throw new Error(`Network error uploading ${file.name}`);
            });

            if (!response.ok) {
              const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
              console.error(`[MEDIA UPLOAD] Upload failed:`, error);
              throw new Error(error.error || "Failed to upload file");
            }

            const mediaData = await response.json();
            console.log(`[MEDIA UPLOAD] Upload successful:`, mediaData);
            setMediaFiles((prev) => [...prev, mediaData]);
          })();
          
          promises.push(uploadPromise);
        } else {
          console.log(`[MEDIA UPLOAD] No puzzle ID yet, creating temporary data URL`);
          
          const tempPromise = new Promise<void>((resolve, reject) => {
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
              console.log(`[MEDIA UPLOAD] Temporary media created:`, tempMedia);
              setMediaFiles((prev) => [...prev, tempMedia]);
              resolve();
            };
            
            reader.onerror = () => {
              console.error(`[MEDIA UPLOAD] FileReader error for ${file.name}`);
              reject(new Error(`Failed to read file: ${file.name}`));
            };
            
            reader.readAsDataURL(file);
          });
          
          promises.push(tempPromise);
        }
      }
      
      await Promise.all(promises);
      console.log("[MEDIA UPLOAD] All files processed successfully");
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Upload failed";
      console.error("[MEDIA UPLOAD] Error:", errorMsg);
      setFormError(errorMsg);
    } finally {
      setUploadingMedia(false);
      // Clear the file input
      if (e.currentTarget) {
        e.currentTarget.value = "";
      }
    }
  };

  const handleDeleteMedia = async (mediaId: string) => {
    if (!confirm("Delete this media file?")) return;

    try {
      if (mediaId.startsWith("temp-")) {
        setMediaFiles((prev) => prev.filter((m) => m.id !== mediaId));
      } else {
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
      // Check if jigsaw puzzle has an image
      if (formData.puzzleType === 'jigsaw') {
        if (!jigsawImage) {
          setFormError("Jigsaw puzzles require an image. Please upload an image before creating.");
          setSubmitting(false);
          return;
        }
      }

      const filteredHints = formData.hints.filter((h) => h.trim() !== "");

      console.log("[SUBMIT] Submitting puzzle data:", {
        title: formData.title,
        puzzleType: formData.puzzleType,
        hasDescription: !!formData.description,
        hasContent: !!formData.content,
      });

      const response = await fetch("/api/admin/puzzles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          hints: filteredHints,
        }),
      }).catch(err => {
        console.error("[SUBMIT] Fetch failed:", err);
        throw new Error(`Network error: ${err.message || 'Failed to connect to server'}`);
      });

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          errorData = { error: `HTTP ${response.status}: ${response.statusText}` };
        }
        throw new Error(errorData.error || "Failed to create puzzle");
      }

      const createdPuzzle = await response.json();
      console.log("[SUBMIT] Puzzle created:", createdPuzzle);
      setPuzzleId(createdPuzzle.id);

      // Upload jigsaw image if present
      if (formData.puzzleType === 'jigsaw' && jigsawImage) {
        try {
          console.log("[SUBMIT] Uploading jigsaw image:", jigsawImage.name);
          
          const formDataUpload = new FormData();
          formDataUpload.append("file", jigsawImage);
          formDataUpload.append("puzzleId", createdPuzzle.id);
          formDataUpload.append("mediaType", "image");

          console.log("[SUBMIT] Posting to /api/admin/media");
          const uploadResponse = await fetch("/api/admin/media", {
            method: "POST",
            body: formDataUpload,
          });

          if (!uploadResponse.ok) {
            const errorData = await uploadResponse.json().catch(() => ({ error: `HTTP ${uploadResponse.status}` }));
            throw new Error(errorData.error || `Upload failed with status ${uploadResponse.status}`);
          }

          const uploadedMedia = await uploadResponse.json();
          console.log("[SUBMIT] Jigsaw image uploaded successfully:", uploadedMedia);
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          console.error("[SUBMIT] Failed to upload jigsaw image:", errorMsg);
          setFormError(`Failed to upload jigsaw image: ${errorMsg}`);
        }
      }

      // Upload other temporary media files if any
      const tempMediaFiles = mediaFiles.filter((m) => m.isTemporary);
      console.log("[SUBMIT] Temporary media files to upload:", tempMediaFiles.length);
      
      if (tempMediaFiles.length > 0) {
        for (const tempMedia of tempMediaFiles) {
          try {
            console.log(`[SUBMIT] Uploading temp media: ${tempMedia.fileName}`);
            
            let blob: Blob;
            
            // Handle data URL conversion
            if (tempMedia.url && tempMedia.url.startsWith('data:')) {
              console.log(`[SUBMIT] Converting data URL to blob for ${tempMedia.fileName}`);
              try {
                const response = await fetch(tempMedia.url);
                if (!response.ok) {
                  throw new Error(`Failed to fetch data URL: ${response.status}`);
                }
                blob = await response.blob();
              } catch (e) {
                console.error(`[SUBMIT] Data URL fetch failed, using alternative method`);
                // Fallback: convert data URL directly
                const parts = tempMedia.url.split(',');
                const header = parts[0] || '';
                const data = parts[1] || '';
                const binaryString = data ? atob(data) : '';
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                  bytes[i] = binaryString.charCodeAt(i);
                }
                const mimeMatch = header.match(/:(.*?);/);
                const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
                blob = new Blob([bytes], { type: mimeType });
              }
            } else if (tempMedia.url) {
              console.log(`[SUBMIT] Fetching blob from URL: ${tempMedia.url}`);
              const response = await fetch(tempMedia.url);
              if (!response.ok) {
                throw new Error(`Failed to fetch URL: ${response.status}`);
              }
              blob = await response.blob();
            } else {
              console.warn(`[SUBMIT] Skipping temp media with empty URL: ${tempMedia.fileName}`);
              continue;
            }
            
            console.log(`[SUBMIT] Blob created: ${blob.size} bytes, type: ${blob.type}`);
            
            const formDataUpload = new FormData();
            formDataUpload.append("file", blob, tempMedia.fileName);
            formDataUpload.append("puzzleId", createdPuzzle.id);

            console.log(`[SUBMIT] Uploading to /api/admin/media`);
            const uploadResponse = await fetch("/api/admin/media", {
              method: "POST",
              body: formDataUpload,
            });

            if (!uploadResponse.ok) {
              const errorData = await uploadResponse.json().catch(() => ({ error: `HTTP ${uploadResponse.status}` }));
              throw new Error(errorData.error || `Upload failed with status ${uploadResponse.status}`);
            }

            const uploadedMedia = await uploadResponse.json();
            console.log(`[SUBMIT] Upload successful:`, uploadedMedia);
            setMediaFiles((prev) =>
              prev.map((m) => (m.id === tempMedia.id ? uploadedMedia : m))
            );
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            console.error(`[SUBMIT] Failed to upload temporary media ${tempMedia.fileName}:`, errorMsg);
            setFormError(`Failed to upload ${tempMedia.fileName}: ${errorMsg}`);
          }
        }
      }

      console.log("[SUBMIT] All uploads completed");
      // Post-creation: verify jigsaw imageUrl is set
      if (formData.puzzleType === 'jigsaw') {
        try {
          const verifyRes = await fetch(`/api/puzzles/${createdPuzzle.id}`);
          if (verifyRes.ok) {
            const verifyData = await verifyRes.json();
            if (!verifyData.jigsaw || !verifyData.jigsaw.imageUrl) {
              setFormError("⚠️ Jigsaw puzzle was created, but the image is not linked. Please check the image upload and try again.");
              setFormSuccess("");
            } else {
              setFormSuccess("✅ Puzzle created successfully!");
            }
          } else {
            setFormError("⚠️ Puzzle created, but failed to verify image link.");
            setFormSuccess("");
          }
        } catch (e) {
          setFormError("⚠️ Puzzle created, but error verifying image link.");
          setFormSuccess("");
        }
      } else {
        setFormSuccess("✅ Puzzle created successfully!");
      }

      // Wait a bit longer for media to settle, then reset form
      setTimeout(() => {
        console.log("[SUBMIT] Resetting form");
        setFormData({
          title: "",
          description: "",
          content: "",
          category: "general",
          difficulty: "medium",
          puzzleType: "general",
          correctAnswer: "",
          pointsReward: 100,
          hints: ["", "", ""],
          isMultiPart: false,
          parts: [
            { title: "Part 1", content: "", answer: "", points: 50 },
            { title: "Part 2", content: "", answer: "", points: 50 },
          ],
          puzzleData: {},
        });
        setMediaFiles([]);
        setJigsawImage(null);
        setJigsawImagePreview("");
        setPuzzleId(null);
      }, 3000);
    } catch (err) {
      let errorMsg = "An error occurred";
      if (err instanceof Error) {
        errorMsg = err.message;
      } else if (typeof err === 'string') {
        errorMsg = err;
      }
      
      // Check if it's a network error
      if (errorMsg.includes("Failed to fetch") || errorMsg.includes("Network")) {
        errorMsg = "Network error: Unable to connect to server. Make sure the development server is running.";
      }
      
      console.error("Puzzle creation error:", errorMsg, err);
      setFormError(errorMsg);
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
          <p style={{ color: '#DDDBF1' }} className="mb-6">You don&apos;t have permission to access the admin panel.</p>
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
      {/* Header */}
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
              href="/admin/arg"
              className="px-4 py-2 rounded-lg border text-white hover:opacity-90 transition-all"
              style={{ backgroundColor: 'rgba(56, 145, 166, 0.2)', borderColor: '#3891A6', color: '#3891A6' }}
            >
              🎮 ARG Manager
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
        <div className="max-w-6xl mx-auto px-4">
          <h1 className="text-4xl font-bold text-white mb-2">🧩 Universal Puzzle Maker</h1>
          <p className="text-[#9BD1D6] mb-8">Create any type of puzzle with advanced tools and testing capabilities</p>

          <div className="grid md:grid-cols-3 gap-8 mb-12">
            {/* Form */}
            <div className="md:col-span-3">
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

                  {/* Puzzle Type */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">
                      Puzzle Type *
                    </label>
                    <select
                      name="puzzleType"
                      value={formData.puzzleType}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white"
                    >
                      {PUZZLE_TYPES.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>

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
                      placeholder="Give your puzzle a captivating title"
                      className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-500"
                      required
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">
                      Description
                    </label>

                    <textarea

                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      placeholder="Describe your puzzle (optional)"
                      className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-500"
                    />
                  </div>

                  {/* Type-Specific Fields */}
                  {formData.puzzleType !== 'general' && (
                    <PuzzleTypeFields
                      puzzleType={formData.puzzleType}
                      puzzleData={formData.puzzleData}
                      onDataChange={handlePuzzleDataChange}
                    />
                  )}


                  {/* Jigsaw image upload and live preview (only for jigsaw puzzles) */}
                  {formData.puzzleType === 'jigsaw' && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-300 mb-2">Jigsaw Image {jigsawImage ? <span className="text-xs text-green-300">(selected)</span> : <span className="text-xs text-gray-400">(required)</span>}</label>
                      <div className="flex items-center gap-3">
                        <input type="file" accept="image/*" onChange={handleJigsawImageChange} />
                        {jigsawImagePreview && (
                          <div className="flex items-center gap-2">
                            <img src={jigsawImagePreview} alt="preview" style={{ maxHeight: 80, maxWidth: 160, objectFit: 'contain', background: '#111', borderRadius: 4 }} />
                            <button type="button" onClick={() => { setJigsawImage(null); setJigsawImagePreview(''); }} className="px-3 py-1 rounded bg-red-700 text-white text-sm">Clear</button>
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-2">Recommended: landscape images around 800×600 for best results. The image is required when creating a jigsaw puzzle.</p>

                      {/* Live Jigsaw Puzzle Preview */}
                      {jigsawImagePreview && (
                        <div className="mt-6">
                          <label className="block text-sm font-semibold text-gray-300 mb-2">Live Jigsaw Puzzle Preview</label>
                          <div style={{ background: '#222', borderRadius: 8, padding: 12, width: '100%' }}>
                            <JigsawPuzzle
                              imageUrl={jigsawImagePreview}
                              rows={typeof formData.puzzleData.gridRows === 'number' && formData.puzzleData.gridRows > 1 ? formData.puzzleData.gridRows : 3}
                              cols={typeof formData.puzzleData.gridCols === 'number' && formData.puzzleData.gridCols > 1 ? formData.puzzleData.gridCols : 4}
                              onComplete={() => {}}
                              containerStyle={{ width: '100%', height: 'auto', display: 'block' }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Category & Difficulty */}
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-300 mb-2">
                        Category
                      </label>
                      <select
                        name="category"
                        value={formData.category}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white"
                      >
                        <option value="general">General</option>
                        <option value="arg">ARG</option>
                        <option value="puzzle">Puzzle</option>
                        <option value="challenge">Challenge</option>
                        <option value="riddle">Riddle</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-300 mb-2">
                        Difficulty
                      </label>
                      <select
                        name="difficulty"
                        value={formData.difficulty}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white"
                      >
                        <option value="easy">Easy</option>
                        <option value="medium">Medium</option>
                        <option value="hard">Hard</option>
                        <option value="extreme">Extreme</option>
                      </select>
                    </div>
                  </div>

                  {/* Correct Answer */}
                  {formData.puzzleType !== 'jigsaw' && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-300 mb-2">
                        Correct Answer *
                      </label>
                      <input
                        type="text"
                        name="correctAnswer"
                        value={formData.correctAnswer}
                        onChange={handleInputChange}
                        placeholder="The correct answer players need to find"
                        className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-500"
                        required
                      />
                    </div>
                  )}

                  {/* Points */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">
                      Points Reward
                    </label>
                    <input
                      type="number"
                      name="pointsReward"
                      value={formData.pointsReward}
                      onChange={handleInputChange}
                      min="1"
                      className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white"
                    />
                  </div>

                  {/* Hints */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">
                      Hints ({formData.hints.filter(h => h.trim()).length})
                    </label>
                    <div className="space-y-2 mb-3">
                      {formData.hints.map((hint, index) => (
                        <div key={index} className="flex gap-2">
                          <input
                            type="text"
                            value={hint}
                            onChange={(e) => handleHintChange(index, e.target.value)}
                            placeholder={`Hint ${index + 1}`}
                            className="flex-1 px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-500"
                          />
                          {formData.hints.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveHint(index)}
                              className="px-3 py-2 rounded-lg bg-red-900/30 text-red-300 hover:bg-red-900/50"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={handleAddHint}
                      className="w-full px-4 py-2 rounded-lg bg-slate-600/50 border border-slate-500 text-gray-300 hover:bg-slate-600"
                    >
                      + Add Hint
                    </button>
                  </div>

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full px-6 py-3 rounded-lg bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-semibold transition"

                  >
                    {submitting ? "Creating..." : "🚀 Create Puzzle"}
                  </button>
                </form>
            </div>

            {/* Media Manager removed per request */}
          </div> {/* End grid */}
        </div>
      </div>

    </div>
  );

}
