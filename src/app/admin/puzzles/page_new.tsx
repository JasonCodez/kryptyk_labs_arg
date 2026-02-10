"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PuzzleTypeFields from "@/components/admin/PuzzleTypeFields";
import JigsawPuzzle from "@/components/puzzle/JigsawPuzzle";
import SudokuGenerator from "@/components/puzzle/SudokuGenerator";

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
  { value: 'riddle', label: 'Riddle' },
  { value: 'sudoku', label: 'Sudoku' },
  { value: 'jigsaw', label: 'Jigsaw Puzzle' },
  { value: 'code_master', label: 'Code Master' },
  { value: 'detective_case', label: 'Detective Case (Noir)' },
  { value: 'math', label: 'Math' },
  { value: 'arg', label: 'ARG' },
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
  const [jigsawImagePreview, setJigsawImagePreview] = useState<string>("");
  const [jigsawImageUrl, setJigsawImageUrl] = useState<string>("");
  const [jigsawImageFile, setJigsawImageFile] = useState<File | null>(null);
  const [jigsawImageObjectUrl, setJigsawImageObjectUrl] = useState<string>("");
  const [importingImage, setImportingImage] = useState(false);
  const [importImageResult, setImportImageResult] = useState<string | null>(null);
  const [importImageError, setImportImageError] = useState<string | null>(null);
  const [sudokuDifficulty, setSudokuDifficulty] = useState<'easy' | 'medium' | 'hard' | 'expert' | 'extreme'>('medium');
  const [sudokuPuzzle, setSudokuPuzzle] = useState<{ puzzle: number[][]; solution: number[][] } | null>(null);
  const [sudokuTimeLimit, setSudokuTimeLimit] = useState<number | undefined>(15 * 60);
  const [formData, setFormData] = useState<PuzzleFormData>({
    title: "",
    description: "",
    content: "",
    category: "general",
    difficulty: "medium",
    puzzleType: "riddle",
    correctAnswer: "",
    pointsReward: 100,
    hints: [],
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
    setFormData((prev) => {
      let next = {
        ...prev,
        puzzleData: {
          ...prev.puzzleData,
          [key]: value,
        },
      };
      // If the designerData (value) is an object with a title, sync it to formData.title
      if ((key === undefined || key === null) && value && typeof value === 'object' && 'title' in value && typeof (value as any).title === 'string') {
        next.title = (value as any).title;
      }
      return next;
    });
  };

  // File uploads removed — images are provided via external URL only

  const handleJigsawImageUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setJigsawImageUrl(e.target.value);
  };

  const handleJigsawImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.currentTarget.files?.[0] || null;
    setJigsawImageFile(f);
    setImportImageResult(null);
    setImportImageError(null);
    if (f) {
      const objUrl = URL.createObjectURL(f);
      setJigsawImageObjectUrl(objUrl);
      // For live preview before upload.
      setJigsawImagePreview(objUrl);
    } else {
      setJigsawImageObjectUrl('');
    }
    // Clear input to allow re-selecting same file.
    if (e.currentTarget) e.currentTarget.value = '';
  };

  useEffect(() => {
    return () => {
      try {
        if (jigsawImageObjectUrl) URL.revokeObjectURL(jigsawImageObjectUrl);
      } catch {
        // ignore
      }
    };
  }, [jigsawImageObjectUrl]);

  const uploadJigsawFile = async (targetPuzzleId: string, file: File) => {
    const formDataUpload = new FormData();
    formDataUpload.append('file', file);
    formDataUpload.append('puzzleId', targetPuzzleId);

    const res = await fetch('/api/admin/media', {
      method: 'POST',
      body: formDataUpload,
    }).catch((e) => {
      throw new Error(`Network error: ${e?.message || e}`);
    });

    let data: any = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    if (!res.ok) {
      const msg = (data && (data.error || data.message)) || `Upload failed (${res.status})`;
      throw new Error(msg);
    }
    const uploadedUrl = data?.url ? String(data.url) : '';
    if (uploadedUrl) {
      setJigsawImageUrl(uploadedUrl);
      setJigsawImagePreview(uploadedUrl);
      setImportImageResult(uploadedUrl);
    }
    return data;
  };

  const handleUseJigsawUrl = () => {
    if (!jigsawImageUrl) return;
    try {
      // Validate URL
      new URL(jigsawImageUrl);
      setJigsawImagePreview(jigsawImageUrl);
    } catch (err) {
      setFormError("Invalid image URL");
    }
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
      // Check if jigsaw puzzle has an image (URL required)
      if (formData.puzzleType === 'jigsaw') {
        if (!jigsawImageUrl && !jigsawImagePreview && !jigsawImageFile) {
          setFormError("Jigsaw puzzles require an image. Provide a URL or upload a file.");
          setSubmitting(false);
          return;
        }
      }

      // Title is now optional for all puzzle types

      const filteredHints = formData.hints.filter((h) => h.trim() !== "");

      console.log("[SUBMIT] Submitting puzzle data:", {
        title: formData.title,
        puzzleType: formData.puzzleType,
        hasDescription: !!formData.description,
        hasContent: !!formData.content,
      });

      // Remove any non-serializable properties from items in puzzleData
      let cleanedPuzzleData: any = formData.puzzleData || {};
      // If the escape-room Designer stored data under `escapeRoomData`, map it into the shape
      // expected by the puzzle persistence route (puzzleData.rooms -> layouts.hotspots)
      if (formData.puzzleType === 'escape_room') {
        const designer = formData.puzzleData?.escapeRoomData || formData.puzzleData;
        console.log('[SUBMIT] Escape room designer payload:', designer);
        if (designer && typeof designer === 'object') {
          const d = designer as any;
          if (Array.isArray(d.scenes)) {
            const rooms = d.scenes.map((scene: any) => {
              const layout = {
                title: scene.name || null,
                backgroundUrl: scene.backgroundUrl || null,
                width: scene.width || null,
                height: scene.height || null,
                hotspots: Array.isArray(scene.interactiveZones) ? scene.interactiveZones.map((z: any) => ({
                  x: Number(z.x) || 0,
                  y: Number(z.y) || 0,
                  w: Number(z.width) || Number(z.w) || 32,
                  h: Number(z.height) || Number(z.h) || 32,
                  type: z.actionType || 'modal',
                  targetId: z.collectItemId || null,
                  // Persist the fields the player modal needs (imageUrl/itemId/interactions).
                  // Keep any provided `z.meta` but ensure these keys exist.
                  meta: (() => {
                    const base = {
                      label: z.label,
                      modalContent: z.modalContent,
                      itemId: z.itemId,
                      imageUrl: z.imageUrl,
                      description: z.description,
                      interactions: z.interactions,
                      linkedPuzzleId: z.linkedPuzzleId,
                      eventId: z.eventId,
                      actionType: z.actionType,
                    };
                    if (z.meta && typeof z.meta === 'object') return { ...(z.meta as any), ...base };
                    // If `z.meta` was a string (already serialized), preserve it as-is.
                    if (typeof z.meta === 'string') return z.meta;
                    return base;
                  })(),
                })) : [],
              };
              return { layout, stages: scene.stages || [] };
            });
            cleanedPuzzleData = {
              ...cleanedPuzzleData,
              rooms,
              roomTitle: d.title || d.roomTitle || formData.title,
              roomDescription: d.description || d.roomDescription || formData.description,
              timeLimitSeconds: d.timeLimit || d.timeLimitSeconds || undefined,
            };
          }
        }
      } else {
        if (formData.puzzleData && Array.isArray(formData.puzzleData.scenes)) {
          cleanedPuzzleData = {
            ...formData.puzzleData,
            scenes: formData.puzzleData.scenes.map((scene: any) => ({
              ...scene,
              items: Array.isArray(scene.items) ? scene.items : [],
              interactiveZones: Array.isArray(scene.interactiveZones) ? scene.interactiveZones : [],
            })),
          };
        }
      }
      const submitBody: any = { ...formData, hints: filteredHints, puzzleData: cleanedPuzzleData };
      if (formData.puzzleType === 'sudoku' && sudokuPuzzle) {
        submitBody.sudokuGrid = sudokuPuzzle.puzzle;
        submitBody.sudokuSolution = sudokuPuzzle.solution;
        submitBody.sudokuDifficulty = sudokuDifficulty;
        submitBody.timeLimitSeconds = sudokuTimeLimit;
        // Sudoku answers are entered on the board; don't send a separate correctAnswer
        delete submitBody.correctAnswer;
      }
      if (formData.puzzleType === 'code_master') {
        delete submitBody.correctAnswer;
      }
      if (formData.puzzleType === 'detective_case') {
        delete submitBody.correctAnswer;
      }

      const response = await fetch("/api/admin/puzzles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(submitBody),
      }).catch(err => {
            console.log('[SUBMIT] Cleaned escape_room puzzleData:', cleanedPuzzleData);
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

      // If a local jigsaw image file was selected, upload it now (preferred over external URL).
      if (formData.puzzleType === 'jigsaw' && jigsawImageFile) {
        try {
          console.log('[SUBMIT] Uploading jigsaw image file to /api/admin/media');
          await uploadJigsawFile(createdPuzzle.id, jigsawImageFile);
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          console.error('[SUBMIT] Failed to upload jigsaw image file:', errorMsg);
          setFormError(`Failed to upload jigsaw image file: ${errorMsg}`);
        }
      }

      // If a jigsaw image URL was provided, post the URL to the media API
      if (formData.puzzleType === 'jigsaw' && jigsawImageUrl && !jigsawImageFile) {
        try {
          console.log("[SUBMIT] Posting jigsaw image URL to /api/admin/media:", jigsawImageUrl);
          const formDataUpload = new FormData();
          formDataUpload.append('url', jigsawImageUrl);
          formDataUpload.append('puzzleId', createdPuzzle.id);

          const uploadResponse = await fetch('/api/admin/media', {
            method: 'POST',
            body: formDataUpload,
          });

          if (!uploadResponse.ok) {
            const errorData = await uploadResponse.json().catch(() => ({ error: `HTTP ${uploadResponse.status}` }));
            throw new Error(errorData.error || `Upload failed with status ${uploadResponse.status}`);
          }

          const uploadedMedia = await uploadResponse.json();
          console.log('[SUBMIT] Jigsaw image URL uploaded successfully:', uploadedMedia);
          // Automatically import the external image into uploads so admins don't need to reopen the editor
          try {
            console.log('[SUBMIT] Attempting automatic import to uploads for jigsaw image...');
            const imp = await fetch('/api/admin/import-image', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ puzzleId: createdPuzzle.id, imageUrl: jigsawImageUrl }),
            }).catch((e) => { throw new Error(`Network error: ${e?.message || e}`); });

            const txt = await imp.text().catch(() => '');
            let impData: any = null;
            try { impData = txt ? JSON.parse(txt) : null; } catch (e) { impData = { raw: txt }; }
            console.log('[SUBMIT] import-image response', imp.status, impData);
            if (!imp.ok) {
              const errMsg = (impData && (impData.error || impData.message)) || `Import failed (${imp.status})`;
              console.error('[SUBMIT] automatic import failed:', errMsg);
              setFormError(`Import failed: ${errMsg}`);
            } else {
              const publicUrl = (impData && impData.imageUrl) || null;
              setImportImageResult(publicUrl);
              if (publicUrl) {
                setJigsawImagePreview(publicUrl);
                setJigsawImageUrl(publicUrl);
              }
            }
          } catch (impErr) {
            console.error('[SUBMIT] automatic import error', impErr);
            // non-fatal: leave uploaded external media record in place and show message
            setFormError((impErr instanceof Error) ? impErr.message : String(impErr));
          }
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          console.error('[SUBMIT] Failed to upload jigsaw image URL:', errorMsg);
          setFormError(`Failed to upload jigsaw image URL: ${errorMsg}`);
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
            <img src="/images/puzzle_warz_logo.png" alt="Puzzle Warz Logo" className="h-10 w-auto" />
            <div className="text-2xl font-bold" style={{ color: '#3891A6' }}>
              Puzzle Warz
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


                  {/* Only show the Escape Room Designer, Points, and Hints for escape_room */}
                  {formData.puzzleType === 'escape_room' ? (
                    <>
                      <PuzzleTypeFields
                        puzzleType={formData.puzzleType}
                        puzzleData={formData.puzzleData}
                        onDataChange={handlePuzzleDataChange}
                      />
                      {/* Submit button directly after designer for escape rooms */}
                      <div className="mt-8">
                        <button
                          type="submit"
                          disabled={submitting}
                          className="w-full px-6 py-3 rounded-lg bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-semibold transition"
                        >
                          {submitting ? "Creating..." : "🚀 Create Puzzle"}
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Title is now always optional */}
                      <div>
                        <label className="block text-sm font-semibold text-gray-300 mb-2">
                          Puzzle Title <span className="text-xs text-gray-400">(optional)</span>
                        </label>
                        <input
                          type="text"
                          name="title"
                          value={formData.title}
                          onChange={handleInputChange}
                          placeholder="Give your puzzle a captivating title"
                          className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-gray-500"
                        />
                      </div>
                      {/* Type-Specific Fields (exclude riddle, general, sudoku) */}
                      {formData.puzzleType !== 'general' && formData.puzzleType !== 'sudoku' && formData.puzzleType !== 'riddle' && (
                        <PuzzleTypeFields
                          puzzleType={formData.puzzleType}
                          puzzleData={formData.puzzleData}
                          onDataChange={handlePuzzleDataChange}
                        />
                      )}
                    </>
                  )}

                  {/* Sudoku generator (admin) */}
                  {formData.puzzleType === 'sudoku' && (
                    <div className="mt-4">
                      <SudokuGenerator
                        difficulty={sudokuDifficulty}
                        onDifficultyChange={setSudokuDifficulty}
                        onPuzzleGenerated={(puzzle, solution) => setSudokuPuzzle({ puzzle, solution })}
                      />
                      <div className="mt-3">
                        <label className="block text-sm font-semibold text-gray-300 mb-2">Time Limit (minutes, optional)</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            value={sudokuTimeLimit ? String(Math.floor(sudokuTimeLimit / 60)) : ''}
                            onChange={(e) => {
                              const v = e.target.value;
                              if (v === '') setSudokuTimeLimit(undefined);
                              else setSudokuTimeLimit(Number(v) > 0 ? Number(v) * 60 : 0);
                            }}
                            className="w-32 px-3 py-2 rounded bg-slate-700/50 border border-slate-600 text-white"
                          />
                          <div className="text-xs text-gray-400">Leave blank for no limit</div>
                        </div>
                      </div>
                    </div>
                  )}


                  {/* Jigsaw image upload and live preview (only for jigsaw puzzles) */}
                  {formData.puzzleType === 'jigsaw' && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-300 mb-2">Jigsaw Image {jigsawImagePreview ? <span className="text-xs text-green-300">(selected)</span> : <span className="text-xs text-gray-400">(required)</span>}</label>
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full">
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full">
                          <div className="flex flex-col gap-2 w-full">
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                              <input
                                type="file"
                                accept="image/*"
                                onChange={handleJigsawImageFileChange}
                                className="flex-1 min-w-0 px-3 py-2 rounded bg-slate-700/50 border border-slate-600 text-white"
                              />
                              <button
                                type="button"
                                disabled={!jigsawImageFile || !puzzleId || uploadingMedia}
                                onClick={async () => {
                                  setImportImageResult(null);
                                  setImportImageError(null);
                                  try {
                                    if (!jigsawImageFile) throw new Error('No file selected');
                                    if (!puzzleId) throw new Error('Save the puzzle first to upload');
                                    await uploadJigsawFile(puzzleId, jigsawImageFile);
                                  } catch (err) {
                                    const msg = err instanceof Error ? err.message : String(err);
                                    setImportImageError(msg);
                                  }
                                }}
                                className="px-3 py-1 rounded bg-emerald-700 text-white text-sm"
                              >
                                Upload file
                              </button>
                            </div>
                            <div className="text-xs text-gray-400">Or paste an external image URL:</div>
                          </div>
                          <input
                            type="text"
                            placeholder="Paste an external image URL"
                            value={jigsawImageUrl}
                            onChange={handleJigsawImageUrlChange}
                            className="flex-1 min-w-0 px-3 py-2 rounded bg-slate-700/50 border border-slate-600 text-white placeholder-gray-500"
                          />
                          <div className="flex gap-2 mt-2 sm:mt-0">
                            <button type="button" onClick={handleUseJigsawUrl} className="px-3 py-1 rounded bg-blue-600 text-white text-sm">Use URL</button>
                            
                            <button
                              type="button"
                              disabled={!jigsawImageUrl || !puzzleId || importingImage}
                              onClick={async () => {
                                setImportImageResult(null);
                                setImportImageError(null);
                                setImportingImage(true);
                                try {
                                  if (!jigsawImageUrl) throw new Error('No image URL provided');
                                  if (!puzzleId) throw new Error('Save the puzzle first to import image');

                                  console.log('[ADMIN] importing image for puzzle', puzzleId, jigsawImageUrl);
                                  const res = await fetch('/api/admin/import-image', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ puzzleId, imageUrl: jigsawImageUrl }),
                                  }).catch((e) => { throw new Error(`Network error: ${e?.message || e}`); });

                                  let data: any = null;
                                  const txt = await res.text().catch(() => '');
                                  try { data = txt ? JSON.parse(txt) : null; } catch (e) { data = { raw: txt }; }

                                  console.log('[ADMIN] import-image response', res.status, data);

                                  if (!res.ok) {
                                    const errMsg = (data && (data.error || data.message)) || `Import failed (${res.status})`;
                                    throw new Error(errMsg + (data && data.raw ? ` - ${String(data.raw).slice(0,200)}` : ''));
                                  }

                                  const imageUrlResp = (data && data.imageUrl) || null;
                                  setImportImageResult(imageUrlResp);
                                  if (imageUrlResp) {
                                    setJigsawImagePreview(imageUrlResp);
                                    setJigsawImageUrl(imageUrlResp);
                                  }
                                } catch (err) {
                                  const msg = err instanceof Error ? err.message : String(err);
                                  console.error('[ADMIN] import-image error', msg);
                                  setImportImageError(msg);
                                } finally {
                                  setImportingImage(false);
                                }
                              }}
                              className="px-3 py-1 rounded bg-amber-600 text-white text-sm"
                            >
                              {importingImage ? 'Importing…' : 'Import to uploads'}
                            </button>
                          </div>
                        </div>
                        {jigsawImagePreview && (
                          <div className="flex items-center gap-2 mt-2 sm:mt-0">
                            <img src={jigsawImagePreview} alt="preview" className="max-h-20 max-w-[160px] object-contain bg-[#111] rounded" />
                            <button type="button" onClick={() => { setJigsawImagePreview(''); }} className="px-3 py-1 rounded bg-red-700 text-white text-sm">Clear</button>
                          </div>
                        )}
                        {importImageResult && (
                          <div className="mt-2 text-sm text-green-300">Imported: {importImageResult}</div>
                        )}
                        {importImageError && (
                          <div className="mt-2 text-sm text-red-400">Error: {importImageError}</div>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-2">Recommended: landscape images around 800×600 for best results. The image is required when creating a jigsaw puzzle.</p>
 
                      {/* Live Jigsaw Puzzle Preview */}
                      {jigsawImagePreview && (
                        <div className="mt-6">
                          <label className="block text-sm font-semibold text-gray-300 mb-2">Live Jigsaw Puzzle Preview</label>
                          <div style={{ background: '#222', borderRadius: 8, padding: 12, width: '100%', minHeight: 260 }}>
                            <JigsawPuzzle
                              imageUrl={jigsawImagePreview}
                              rows={typeof formData.puzzleData.gridRows === 'number' && formData.puzzleData.gridRows > 1 ? formData.puzzleData.gridRows : 3}
                              cols={typeof formData.puzzleData.gridCols === 'number' && formData.puzzleData.gridCols > 1 ? formData.puzzleData.gridCols : 4}
                              onComplete={() => {}}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Show Difficulty/Category for non-escape_room types only */}
                  {formData.puzzleType !== 'escape_room' && (
                    formData.puzzleType === 'math' ? (
                      <div className="grid md:grid-cols-1 gap-4">
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
                    ) : formData.puzzleType === 'riddle' ? (
                      <div className="grid md:grid-cols-1 gap-4">
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
                    ) : formData.puzzleType === 'sudoku' ? (
                      <div className="grid md:grid-cols-1 gap-4">
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
                            <option value="sudoku">Sudoku</option>
                            <option value="arg">ARG</option>
                            <option value="jigsaw">Jigsaw</option>
                            <option value="puzzle">Puzzle</option>
                            <option value="challenge">Challenge</option>
                          </select>
                        </div>
                      </div>
                    ) : (
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
                            <option value="sudoku">Sudoku</option>
                            <option value="arg">ARG</option>
                            <option value="jigsaw">Jigsaw</option>
                            <option value="puzzle">Puzzle</option>
                            <option value="challenge">Challenge</option>
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
                    )
                  )}

                  {/* Correct Answer (not required for Sudoku; answers entered on the board) */}
                  {formData.puzzleType !== 'jigsaw' && formData.puzzleType !== 'sudoku' && formData.puzzleType !== 'escape_room' && formData.puzzleType !== 'code_master' && formData.puzzleType !== 'detective_case' && (
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

                  {/* Hints (hidden for Sudoku) */}
                  {formData.puzzleType !== 'sudoku' && (
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
                            {formData.hints.length > 0 && (
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
                  )}

                  {/* Submit button for non-escape_room types */}
                  {formData.puzzleType !== 'escape_room' && (
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full px-6 py-3 rounded-lg bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-semibold transition"
                    >
                      {submitting ? "Creating..." : "🚀 Create Puzzle"}
                    </button>
                  )}
                </form>
            </div>

            {/* Media Manager removed per request */}
          </div> {/* End grid */}
        </div>
      </div>

    </div>
  );

}
