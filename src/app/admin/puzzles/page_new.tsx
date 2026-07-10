"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PuzzleTypeFields from "@/components/admin/PuzzleTypeFields";
import JigsawPuzzle from "@/components/puzzle/JigsawPuzzle";
import SudokuGenerator from "@/components/puzzle/SudokuGenerator";
import { createDefaultGridlockFileData, getGridlockFileData } from "@/lib/gridlockFile";
import { validateCrosswordPuzzleData } from "@/lib/crosswordCore";
import { getTodayDayNumber } from "@/lib/dailyPuzzle";
import LoadingSpinner from "@/components/LoadingSpinner";

interface HintEntry {
  text: string;
  costPoints: number;
}

interface PuzzleFormData {
  title: string;
  description: string;
  content: string;
  category: string;
  difficulty: string;
  puzzleType: string;
  correctAnswer: string;
  pointsReward: number;
  xpReward: number;
  hints: HintEntry[];
  isMultiPart: boolean;
  parts: PuzzlePart[];
  puzzleData: Record<string, unknown>;
  isWarzExclusive: boolean;
  gridlockReleaseAt: string; // ISO date string YYYY-MM-DD, gridlock_file only
  debriefReleaseAt: string; // ISO date string, debrief only
  dailySlotDayNumber: string; // daily-rotation day number, sudoku/crossword/word_search/jigsaw only
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
  { value: 'general', label: 'General' },
  { value: 'sudoku', label: 'Sudoku' },
  { value: 'jigsaw', label: 'Jigsaw Puzzle' },
  { value: 'code_master', label: 'Code Master' },
  { value: 'detective_case', label: 'Wise Up' },
  { value: 'crime_rpg', label: 'Crime Case RPG 🔎' },
  { value: 'parasite_code', label: 'Parasite Code 🦠' },
  { value: 'gridlock_file', label: 'Gridlock File 🔐' },
  { value: 'debrief', label: 'The Debrief 📋' },
  { value: 'crack_safe', label: 'Crack the Safe 🔐' },
  { value: 'word_crack', label: 'Hidden Word 🟩' },
  { value: 'word_search', label: 'Word Trove 🔍' },
  { value: 'crossword', label: 'Crossword ✏️' },
  { value: 'logic_grid', label: 'Logic Grid 🧠' },
  { value: 'anagram_blitz', label: 'Anagram Blitz 🔀' },
  { value: 'blackout', label: 'Blackout ⬛' },
  { value: 'vault', label: 'The Vault 🔐' },
  { value: 'cipher_clash', label: 'Cipher Clash 🔐' },
  { value: 'arg', label: 'ARG' },
  { value: 'escape_room', label: 'Escape Room' },
  { value: 'jim_wyze_case', label: 'Jim Wyze Case 🕵️' },
];

interface PuzzleListItem {
  id: string;
  title: string;
  puzzleType: string;
  difficulty: string;
  isActive: boolean;
  isWarzExclusive: boolean;
  createdAt: string;
  category: { name: string } | null;
  escapeRoom?: { roomTitle: string } | null;
  dailySlots?: { dayNumber: number }[];
}

// Shape of a puzzle as returned by GET /api/admin/puzzles/:id — used only to load an existing
// puzzle into the edit form, so this only declares the fields loadPuzzleForEdit actually reads.
interface RawPuzzleEdit {
  title?: string;
  description?: string;
  content?: string;
  category?: { name?: string };
  difficulty?: string;
  puzzleType?: string;
  solutions?: { answer?: string; points?: number }[];
  xpReward?: number;
  hints?: { text: string; costPoints?: number }[];
  data?: Record<string, unknown>;
  isWarzExclusive?: boolean;
  schedule?: { releaseAt?: string } | null;
  dailySlots?: { dayNumber?: number | string }[];
  jigsaw?: {
    gridRows?: number;
    gridCols?: number;
    snapTolerance?: number;
    rotationEnabled?: boolean;
    imageUrl?: string;
  };
}

export default function AdminPuzzlesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [puzzleId, setPuzzleId] = useState<string | null>(null);
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  // Puzzle list / delete
  const [allPuzzles, setAllPuzzles] = useState<PuzzleListItem[]>([]);
  const [fetchingPuzzles, setFetchingPuzzles] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [togglingActiveId, setTogglingActiveId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [jigsawImagePreview, setJigsawImagePreview] = useState<string>("");
  const [jigsawBoardDims, setJigsawBoardDims] = useState<{ w: number; h: number }>({ w: 640, h: 480 });
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
    puzzleType: "general",
    correctAnswer: "",
    pointsReward: 100,
    xpReward: 50,
    hints: [],
    isMultiPart: false,
    parts: [
      { title: "Part 1", content: "", answer: "", points: 50 },
      { title: "Part 2", content: "", answer: "", points: 50 },
    ],
    puzzleData: {},
    isWarzExclusive: false,
    gridlockReleaseAt: "",
    debriefReleaseAt: "",
    dailySlotDayNumber: "",
  });
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Manage Puzzles filters
  const [filterTitle, setFilterTitle] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterDifficulty, setFilterDifficulty] = useState("all");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
      return;
    }

    if (session?.user?.email) {
      checkAdminStatus();
    }
    // checkAdminStatus is a plain function redefined every render — intentionally omitted so
    // this only re-runs on an actual session/status change, not every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, status, router]);

  const checkAdminStatus = async () => {
    try {
      const response = await fetch("/api/admin/check");
      if (response.ok) {
        const data = await response.json();
        setIsAdmin(data.isAdmin);
        if (data.isAdmin) fetchPuzzles();
      }
    } catch (error) {
      console.error("Failed to check admin status:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPuzzles = async () => {
    setFetchingPuzzles(true);
    try {
      const res = await fetch("/api/admin/puzzles");
      if (res.ok) setAllPuzzles(await res.json());
    } catch (e) {
      console.error("Failed to fetch puzzle list", e);
    } finally {
      setFetchingPuzzles(false);
    }
  };

  const handleDeletePuzzle = async (id: string) => {
    setDeletingId(id);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/admin/puzzles/${id}`, { method: "DELETE" });
      if (res.ok) {
        setAllPuzzles((prev) => prev.filter((p) => p.id !== id));
        setDeleteConfirmId(null);
      } else {
        const data = await res.json().catch(() => ({}));
        setDeleteError(data.error || "Delete failed");
      }
    } catch {
      setDeleteError("Network error — could not delete puzzle");
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleActive = async (puzzle: PuzzleListItem) => {
    setTogglingActiveId(puzzle.id);
    setDeleteError(null);
    const nextActive = !puzzle.isActive;
    try {
      const res = await fetch(`/api/admin/puzzles/${puzzle.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: nextActive }),
      });
      if (res.ok) {
        setAllPuzzles((prev) => prev.map((p) => (p.id === puzzle.id ? { ...p, isActive: nextActive } : p)));
      } else {
        const data = await res.json().catch(() => ({}));
        setDeleteError(data.error || "Failed to update puzzle status");
      }
    } catch {
      setDeleteError("Network error — could not update puzzle status");
    } finally {
      setTogglingActiveId(null);
    }
  };

  const loadPuzzleForEdit = async (id: string) => {
    setLoadingEdit(true);
    setFormError("");
    setFormSuccess("");
    try {
      const res = await fetch(`/api/admin/puzzles/${id}`);
      if (!res.ok) throw new Error("Failed to load puzzle data");
      const p = (await res.json()) as RawPuzzleEdit;

      const baseData: PuzzleFormData = {
        title: p.title || "",
        description: p.description || "",
        content: p.content || "",
        category: p.category?.name || "general",
        difficulty: p.difficulty || "medium",
        puzzleType: p.puzzleType || "general",
        correctAnswer: p.solutions?.[0]?.answer || "",
        pointsReward: p.solutions?.[0]?.points || 100,
        xpReward: p.xpReward || 50,
        hints: p.hints?.map((h) => ({ text: h.text, costPoints: h.costPoints ?? 10 })) || [],
        isMultiPart: false,
        parts: [
          { title: "Part 1", content: "", answer: "", points: 50 },
          { title: "Part 2", content: "", answer: "", points: 50 },
        ],
        puzzleData: p.data || {},
        isWarzExclusive: p.isWarzExclusive === true,
        gridlockReleaseAt: p.schedule?.releaseAt && p.puzzleType === 'gridlock_file'
          ? (() => {
              const d = new Date(p.schedule!.releaseAt!);
              const pad = (n: number) => String(n).padStart(2, '0');
              return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
            })()
          : "",
        debriefReleaseAt: p.schedule?.releaseAt && p.puzzleType === 'debrief'
          ? (() => {
              const d = new Date(p.schedule!.releaseAt!);
              const pad = (n: number) => String(n).padStart(2, '0');
              return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
            })()
          : "",
        dailySlotDayNumber: Array.isArray(p.dailySlots) && p.dailySlots[0]
          ? String(p.dailySlots[0].dayNumber)
          : "",
      };

      // Merge jigsaw config into puzzleData
      if (p.jigsaw) {
        baseData.puzzleData = {
          ...baseData.puzzleData,
          gridRows: p.jigsaw.gridRows,
          gridCols: p.jigsaw.gridCols,
          snapTolerance: p.jigsaw.snapTolerance,
          rotationEnabled: p.jigsaw.rotationEnabled,
          // Restore shape designer params from puzzle.data JSON if present
          ...(p.data && typeof p.data === 'object' ? {
            pieceExtFrac:       (p.data as Record<string, unknown>).pieceExtFrac,
            pieceRFrac:         (p.data as Record<string, unknown>).pieceRFrac,
            pieceNHalfFrac:     (p.data as Record<string, unknown>).pieceNHalfFrac,
            pieceShoulderStart: (p.data as Record<string, unknown>).pieceShoulderStart,
          } : {}),
        };
        if (p.jigsaw.imageUrl) {
          setJigsawImageUrl(p.jigsaw.imageUrl);
          setJigsawImagePreview(p.jigsaw.imageUrl);
        }
      }

      setFormData(baseData);
      setEditingId(id);
      setPuzzleId(id);

      setTimeout(() => {
        document.querySelector("form")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to load puzzle for editing");
    } finally {
      setLoadingEdit(false);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setPuzzleId(null);
    setFormData({
      title: "",
      description: "",
      content: "",
      category: "general",
      difficulty: "medium",
      puzzleType: "general",
      correctAnswer: "",
      pointsReward: 100,
      xpReward: 50,
      hints: [],
      isMultiPart: false,
      parts: [
        { title: "Part 1", content: "", answer: "", points: 50 },
        { title: "Part 2", content: "", answer: "", points: 50 },
      ],
      puzzleData: {},
      isWarzExclusive: false,
      gridlockReleaseAt: "",
      debriefReleaseAt: "",
      dailySlotDayNumber: "",
    });
    setJigsawImageUrl("");
    setJigsawImagePreview("");
    setJigsawImageFile(null);
    setFormError("");
    setFormSuccess("");
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const nextValue = name === "pointsReward" || name === "xpReward" ? parseInt(value) : value;
      const nextState = {
        ...prev,
        [name]: nextValue,
      };

      if (name === "puzzleType" && value === "gridlock_file") {
        const parsedGridlock = getGridlockFileData(prev.puzzleData);
        nextState.puzzleData = {
          ...prev.puzzleData,
          gridlockFile: parsedGridlock ?? createDefaultGridlockFileData(),
        };
      }

      return nextState;
    });
  };

  const handleHintChange = (index: number, field: keyof HintEntry, value: string | number) => {
    const newHints = [...formData.hints];
    newHints[index] = { ...newHints[index], [field]: value };
    setFormData((prev) => ({
      ...prev,
      hints: newHints,
    }));
  };

  const handleAddHint = () => {
    setFormData((prev) => ({
      ...prev,
      hints: [...prev.hints, { text: "", costPoints: 10 }],
    }));
  };

  const handleRemoveHint = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      hints: prev.hints.filter((_, i) => i !== index),
    }));
  };

  const handlePuzzleDataChange = useCallback((key: string, value: unknown) => {
    setFormData((prev) => {
      const next = {
        ...prev,
        puzzleData: {
          ...prev.puzzleData,
          [key]: value,
        },
      };
      // If the designerData (value) is an object with a title, sync it to formData.title
      if ((key === undefined || key === null) && value && typeof value === 'object' && 'title' in value) {
        const maybeTitle = (value as Record<string, unknown>).title;
        if (typeof maybeTitle === 'string') {
          next.title = maybeTitle;
        }
      }
      return next;
    });
  }, []);

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

  // Detect natural image dimensions whenever the preview URL changes so we can pass
  // matching boardWidth/boardHeight to JigsawPuzzle (prevents piece distortion).
  useEffect(() => {
    if (!jigsawImagePreview) return;
    const img = new window.Image();
    img.onload = () => {
      const MAX = 640;
      const { naturalWidth: nw, naturalHeight: nh } = img;
      if (!nw || !nh) return;
      const scale = Math.min(MAX / nw, MAX / nh, 1);
      setJigsawBoardDims({ w: Math.round(nw * scale), h: Math.round(nh * scale) });
    };
    img.src = jigsawImagePreview;
  }, [jigsawImagePreview]);

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

    let data: { url?: string; error?: string; message?: string } | null = null;
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
    } catch {
      setFormError("Invalid image URL");
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

      const filteredHints = formData.hints.filter((h) => h.text.trim() !== "");

      console.log("[SUBMIT] Submitting puzzle data:", {
        title: formData.title,
        puzzleType: formData.puzzleType,
        hasDescription: !!formData.description,
        hasContent: !!formData.content,
      });

      // Remove any non-serializable properties from items in puzzleData
      let cleanedPuzzleData: Record<string, unknown> = formData.puzzleData || {};
      // If the escape-room Designer stored data under `escapeRoomData`, map it into the shape
      // expected by the puzzle persistence route (puzzleData.rooms -> layouts.hotspots)
      if (formData.puzzleType === 'escape_room' || formData.puzzleType === 'jim_wyze_case') {
        const designer = formData.puzzleData?.escapeRoomData || formData.puzzleData;
        console.log('[SUBMIT] Escape room designer payload:', designer);
        if (designer && typeof designer === 'object') {
          const d = designer as Record<string, unknown>;
          if (Array.isArray(d.scenes)) {
            const rooms = d.scenes.map((scene: Record<string, unknown>) => {
              const layout = {
                title: scene.name || null,
                backgroundUrl: scene.backgroundUrl || null,
                width: scene.width || null,
                height: scene.height || null,
                hotspots: Array.isArray(scene.interactiveZones) ? (scene.interactiveZones as Record<string, unknown>[]).map((z) => ({
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
                      // Collect / pickup animation fields
                      pickupAnimationPreset: z.pickupAnimationPreset,
                      pickupAnimationUrl: z.pickupAnimationUrl,
                      // Sound effects per interaction
                      sfx: z.sfx,
                      // Item-use gate and effects
                      requiresItems: z.requiresItems,
                      requiredItemKey: z.requiredItemKey,
                      requiredItemId: z.requiredItemId,
                      useEffect: z.useEffect,
                      // Time penalty on failure
                      penaltySeconds: z.penaltySeconds,
                      // Mini-puzzle and code-entry configs
                      miniPuzzle: z.miniPuzzle,
                      codeEntry: z.codeEntry,
                    };
                    if (z.meta && typeof z.meta === 'object') return { ...(z.meta as Record<string, unknown>), ...base };
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
              minTeamSize: (typeof d.minTeamSize === 'number' && d.minTeamSize > 0) ? d.minTeamSize : 1,
              maxTeamSize: (typeof d.maxTeamSize === 'number' && d.maxTeamSize > 0) ? d.maxTeamSize : 8,
            };
          }
        }
      } else {
        if (formData.puzzleData && Array.isArray(formData.puzzleData.scenes)) {
          cleanedPuzzleData = {
            ...formData.puzzleData,
            scenes: (formData.puzzleData.scenes as Record<string, unknown>[]).map((scene) => ({
              ...scene,
              items: Array.isArray(scene.items) ? scene.items : [],
              interactiveZones: Array.isArray(scene.interactiveZones) ? scene.interactiveZones : [],
            })),
          };
        }
      }
      if (formData.puzzleType === 'gridlock_file') {
        const parsedGridlock = getGridlockFileData(cleanedPuzzleData);
        if (!parsedGridlock) {
          throw new Error('Gridlock File puzzles require a valid gridlockFile payload. Check grid, correctAnswers, ruleExplanation, and primary rule metadata in the admin JSON editor.');
        }
        cleanedPuzzleData = {
          ...cleanedPuzzleData,
          gridlockFile: parsedGridlock,
        };
      }
      const submitBody: Record<string, unknown> = { ...formData, hints: filteredHints, puzzleData: cleanedPuzzleData };
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
      if (formData.puzzleType === 'jim_wyze_case') {
        delete submitBody.correctAnswer;
      }
      if (formData.puzzleType === 'crime_rpg') {
        delete submitBody.correctAnswer;
      }
      if (formData.puzzleType === 'crack_safe') {
        // Code is stored in puzzleData.safecode — no separate correctAnswer needed
        delete submitBody.correctAnswer;
      }
      if (formData.puzzleType === 'vault') {
        delete submitBody.correctAnswer;
      }
      if (formData.puzzleType === 'gridlock_file') {
        // Answers are stored in puzzleData.gridlockFile.correctAnswers
        delete submitBody.correctAnswer;
        // Include releaseAt for scheduling — convert datetime-local (local time) to UTC ISO string
        if (formData.gridlockReleaseAt) {
          submitBody.gridlockReleaseAt = new Date(formData.gridlockReleaseAt).toISOString();
        }
      }
      if (formData.puzzleType === 'debrief') {
        delete submitBody.correctAnswer;
        if (formData.debriefReleaseAt) {
          submitBody.debriefReleaseAt = new Date(formData.debriefReleaseAt).toISOString();
        }
      }
      if (['sudoku', 'crossword', 'word_search', 'jigsaw'].includes(formData.puzzleType)) {
        submitBody.dailySlotDayNumber = formData.dailySlotDayNumber || null;
      }
      if (formData.puzzleType === 'parasite_code') {
        delete submitBody.correctAnswer;
      }
      if (formData.puzzleType === 'cipher_clash') {
        delete submitBody.correctAnswer;
      }
      if (formData.puzzleType === 'crossword') {
        delete submitBody.correctAnswer;

        const crosswordValidation = validateCrosswordPuzzleData(submitBody.puzzleData, {
          requireAnswers: true,
          enforceStyle: false,
        });
        if (!crosswordValidation.valid) {
          setFormError(crosswordValidation.error || 'Crossword layout is invalid. Ensure every white cell is fully crossed.');
          setSubmitting(false);
          return;
        }
      }

      // ── EDIT mode: PUT to existing puzzle ─────────────────────────────
      if (editingId) {
        const response = await fetch(`/api/admin/puzzles/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(submitBody),
        }).catch((err) => {
          throw new Error(`Network error: ${err.message || "Failed to connect to server"}`);
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
          throw new Error(errorData.error || "Failed to update puzzle");
        }

        const result = await response.json();
        const updatedPuzzle = result.puzzle;
        setAllPuzzles((prev) =>
          prev.map((p) =>
            p.id === editingId
              ? {
                  ...p,
                  title: updatedPuzzle.title,
                  difficulty: updatedPuzzle.difficulty,
                  puzzleType: updatedPuzzle.puzzleType,
                  category: updatedPuzzle.category,
                }
              : p
          )
        );
        setFormSuccess("✅ Puzzle updated successfully!");
        setSubmitting(false);
        return;
      }
      // ── CREATE mode: POST new puzzle ───────────────────────────────────

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
        let errorData: { error?: string; details?: string; raw?: string } | null = null;
        let rawText = "";
        try {
          rawText = await response.text();
          errorData = rawText ? JSON.parse(rawText) : null;
        } catch {
          errorData = rawText ? { raw: rawText } : null;
        }
        console.error("[SUBMIT] Puzzle creation error response:",
          response.status, response.statusText,
          "body:", rawText || "(empty)",
          "parsed:", errorData
        );
        throw new Error(
          errorData?.details
            ? `${errorData.error || "Failed to create puzzle"}: ${errorData.details}`
            : (errorData?.error || rawText || `HTTP ${response.status}: ${response.statusText}` || "Failed to create puzzle")
        );
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
            let impData: { error?: string; message?: string; imageUrl?: string; raw?: string } | null = null;
            try { impData = txt ? JSON.parse(txt) : null; } catch { impData = { raw: txt }; }
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
              } catch {
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
        } catch {
          setFormError("⚠️ Puzzle created, but error verifying image link.");
          setFormSuccess("");
        }
      } else {
        setFormSuccess("✅ Puzzle created successfully!");
      }

      // Clear the escape-room Designer localStorage draft so a new room starts fresh
      try { localStorage.removeItem('escape-room-designer-draft'); } catch {}

      // Refresh the puzzle list so the new puzzle appears immediately
      fetchPuzzles();

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
          xpReward: 50,
          hints: [{ text: "", costPoints: 10 }, { text: "", costPoints: 10 }, { text: "", costPoints: 10 }],
          isMultiPart: false,
          parts: [
            { title: "Part 1", content: "", answer: "", points: 50 },
            { title: "Part 2", content: "", answer: "", points: 50 },
          ],
          puzzleData: {},
          isWarzExclusive: false,
          gridlockReleaseAt: "",
          debriefReleaseAt: "",
          dailySlotDayNumber: "",
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
    return <LoadingSpinner size={180} />;
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
      <div className="pt-24">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex justify-between items-start mb-2">
            <h1 className="text-4xl font-bold text-white">🧩 Universal Puzzle Maker</h1>
            <div className="flex gap-2">
              <Link
                href="/admin/daily-scheduler"
                className="px-4 py-2 rounded text-white text-sm transition hover:opacity-90 whitespace-nowrap"
                style={{ backgroundColor: '#3891A6' }}
              >
                📅 Weekly Daily Scheduler
              </Link>
              <Link
                href="/admin/teams"
                className="px-4 py-2 rounded text-white text-sm transition hover:opacity-90 whitespace-nowrap"
                style={{ backgroundColor: '#3891A6' }}
              >
                👥 Manage Teams
              </Link>
              <Link
                href="/admin/reports"
                className="px-4 py-2 rounded text-white text-sm transition hover:opacity-90 whitespace-nowrap"
                style={{ backgroundColor: '#3891A6' }}
              >
                🚩 Abuse Reports
              </Link>
            </div>
          </div>
          <p className="text-[#9BD1D6] mb-8">Create any type of puzzle with advanced tools and testing capabilities</p>

          <div className="grid md:grid-cols-3 gap-8 mb-12">
            {/* Form */}
            <div className="md:col-span-3">
              <form
                onSubmit={handleSubmit}
                className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-6 space-y-6"
              >
                  {editingId && (
                    <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-200 flex items-center justify-between">
                      <span className="text-sm">✏️ <strong>Editing puzzle</strong> — changes will overwrite the existing puzzle</span>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="px-3 py-1 rounded text-xs bg-slate-600 hover:bg-slate-500 text-gray-300 ml-4"
                      >
                        ✕ Cancel Edit
                      </button>
                    </div>
                  )}

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

                  {/* Debrief: release date scheduler */}
                  {formData.puzzleType === 'debrief' && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-300 mb-2">📅 Go-Live Date &amp; Time (your local time)</label>
                      <input
                        type="datetime-local"
                        value={formData.debriefReleaseAt}
                        onChange={e => setFormData(prev => ({ ...prev, debriefReleaseAt: e.target.value }))}
                        className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white"
                      />
                      <p className="text-xs text-gray-500 mt-1">Leave blank to make it live immediately.</p>
                    </div>
                  )}

                  {/* Gridlock File: optional daily scheduler */}
                  {formData.puzzleType === 'gridlock_file' && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-300 mb-2">📅 Daily Gridlock Release Date &amp; Time (optional)</label>
                      <input
                        type="datetime-local"
                        value={formData.gridlockReleaseAt}
                        onChange={e => setFormData(prev => ({ ...prev, gridlockReleaseAt: e.target.value }))}
                        className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white"
                      />
                      <p className="text-xs text-gray-500 mt-1">Leave blank to publish this as a normal catalog puzzle. Add a time in <strong className="text-gray-400">your local timezone</strong> only when this file should drive the daily Gridlock slot.</p>
                    </div>
                  )}

                  {/* Daily rotation slot: word_crack/sudoku/crossword/word_search/jigsaw only */}
                  {['word_crack', 'sudoku', 'crossword', 'word_search', 'jigsaw'].includes(formData.puzzleType) && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-300 mb-2">
                        📅 Assign as Daily #N (optional)
                        <span className="ml-2 font-normal text-amber-300">— today is day #{getTodayDayNumber()}</span>
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={formData.dailySlotDayNumber}
                        onChange={e => setFormData(prev => ({ ...prev, dailySlotDayNumber: e.target.value }))}
                        placeholder={`e.g. ${getTodayDayNumber()} for today`}
                        className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white"
                      />
                      <p className="text-xs text-gray-500 mt-1">Leave blank to publish this as a normal catalog puzzle. Set a day number to make this the daily {formData.puzzleType.replace('_', ' ')} puzzle for that day — it&apos;ll automatically be hidden from the regular puzzle browser. Check the puzzle list below for the 📅 Daily badge to confirm it saved.</p>
                    </div>
                  )}

                  {/* Destination */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">
                      Puzzle Destination *
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, isWarzExclusive: false }))}
                        className={`flex items-center gap-3 px-4 py-3 rounded-lg border-2 text-left transition-all ${
                          !formData.isWarzExclusive
                            ? "border-blue-500 bg-blue-500/15 text-blue-200"
                            : "border-slate-600 bg-slate-700/40 text-gray-400 hover:border-slate-500"
                        }`}
                      >
                        <span className="text-2xl">🧩</span>
                        <div>
                          <div className="font-semibold text-sm">Regular Puzzles</div>
                          <div className="text-xs opacity-70">Shown on the main puzzle page</div>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, isWarzExclusive: true }))}
                        className={`flex items-center gap-3 px-4 py-3 rounded-lg border-2 text-left transition-all ${
                          formData.isWarzExclusive
                            ? "border-yellow-500 bg-yellow-500/15 text-yellow-200"
                            : "border-slate-600 bg-slate-700/40 text-gray-400 hover:border-slate-500"
                        }`}
                      >
                        <span className="text-2xl">⚔️</span>
                        <div>
                          <div className="font-semibold text-sm">Warz Only</div>
                          <div className="text-xs opacity-70">Exclusive to battle challenges</div>
                        </div>
                      </button>
                    </div>
                  </div>


                  {/* Escape-canvas puzzle types use the same designer/play data model. */}
                  {formData.puzzleType === 'escape_room' || formData.puzzleType === 'jim_wyze_case' ? (
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
                          {submitting ? (editingId ? "Saving..." : "Creating...") : editingId ? "💾 Update Puzzle" : "🚀 Create Puzzle"}
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
                        onDifficultyChange={(d) => {
                          setSudokuDifficulty(d);
                          const rewards: Record<string, { pts: number; xp: number }> = {
                            easy:    { pts: 50,  xp: 25  },
                            medium:  { pts: 100, xp: 50  },
                            hard:    { pts: 150, xp: 75  },
                            expert:  { pts: 200, xp: 100 },
                            extreme: { pts: 200, xp: 100 },
                          };
                          const r = rewards[d] ?? rewards.medium;
                          setFormData(prev => ({ ...prev, pointsReward: r.pts, xpReward: r.xp }));
                        }}
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
                      <label className="block text-sm font-semibold text-gray-300 mb-3">
                        Jigsaw Image{" "}
                        {jigsawImagePreview
                          ? <span className="text-xs text-green-300">(selected)</span>
                          : <span className="text-xs text-gray-400">(required)</span>}
                      </label>

                      <div className="space-y-3">
                        {/* ── Option 1: Upload a file ── */}
                        <div className="rounded-lg border border-slate-600 bg-slate-700/30 p-3">
                          <p className="text-xs font-semibold text-gray-300 mb-2">📁 Upload from file</p>
                          <div className="flex flex-col sm:flex-row gap-2">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleJigsawImageFileChange}
                              className="flex-1 min-w-0 px-3 py-2 rounded bg-slate-700/50 border border-slate-600 text-white text-sm"
                            />
                            <button
                              type="button"
                              disabled={!jigsawImageFile || !puzzleId || uploadingMedia}
                              onClick={async () => {
                                setImportImageResult(null);
                                setImportImageError(null);
                                setUploadingMedia(true);
                                try {
                                  if (!jigsawImageFile) throw new Error('No file selected');
                                  if (!puzzleId) throw new Error('Save the puzzle first to upload');
                                  await uploadJigsawFile(puzzleId, jigsawImageFile);
                                } catch (err) {
                                  const msg = err instanceof Error ? err.message : String(err);
                                  setImportImageError(msg);
                                } finally {
                                  setUploadingMedia(false);
                                }
                              }}
                              className="px-4 py-2 rounded bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 text-white text-sm font-semibold whitespace-nowrap"
                            >
                              {uploadingMedia ? 'Uploading…' : 'Upload file'}
                            </button>
                          </div>
                          {!puzzleId && jigsawImageFile && (
                            <p className="text-xs text-amber-400 mt-1">Save the puzzle first, then upload the file.</p>
                          )}
                        </div>

                        {/* ── Option 2: Use an image URL ── */}
                        <div className="rounded-lg border border-slate-600 bg-slate-700/30 p-3">
                          <p className="text-xs font-semibold text-gray-300 mb-2">🔗 Use an image URL</p>
                          <div className="flex flex-col sm:flex-row gap-2">
                            <input
                              type="text"
                              placeholder="https://example.com/image.jpg"
                              value={jigsawImageUrl}
                              onChange={handleJigsawImageUrlChange}
                              className="flex-1 min-w-0 px-3 py-2 rounded bg-slate-700/50 border border-slate-600 text-white placeholder-gray-500 text-sm"
                            />
                            <button
                              type="button"
                              disabled={!jigsawImageUrl}
                              onClick={handleUseJigsawUrl}
                              className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-semibold whitespace-nowrap"
                            >
                              Use URL
                            </button>
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
                                  const res = await fetch('/api/admin/import-image', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ puzzleId, imageUrl: jigsawImageUrl }),
                                  }).catch((e) => { throw new Error(`Network error: ${e?.message || e}`); });
                                  let data: { error?: string; message?: string; imageUrl?: string; raw?: string } | null = null;
                                  const txt = await res.text().catch(() => '');
                                  try { data = txt ? JSON.parse(txt) : null; } catch { data = { raw: txt }; }
                                  if (!res.ok) {
                                    const errMsg = (data && (data.error || data.message)) || `Import failed (${res.status})`;
                                    throw new Error(errMsg + (data?.raw ? ` - ${String(data.raw).slice(0, 200)}` : ''));
                                  }
                                  const imageUrlResp = (data && data.imageUrl) || null;
                                  setImportImageResult(imageUrlResp);
                                  if (imageUrlResp) {
                                    setJigsawImagePreview(imageUrlResp);
                                    setJigsawImageUrl(imageUrlResp);
                                  }
                                } catch (err) {
                                  const msg = err instanceof Error ? err.message : String(err);
                                  setImportImageError(msg);
                                } finally {
                                  setImportingImage(false);
                                }
                              }}
                              className="px-4 py-2 rounded bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white text-sm font-semibold whitespace-nowrap"
                            >
                              {importingImage ? 'Importing…' : 'Import to uploads'}
                            </button>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            <strong className="text-gray-400">Use URL</strong> — links directly to the external image.{" "}
                            <strong className="text-gray-400">Import to uploads</strong> — copies the image to your own storage (save puzzle first).
                          </p>
                        </div>

                        {/* ── Feedback & preview ── */}
                        {importImageResult && (
                          <p className="text-sm text-green-300">✓ Imported: {importImageResult}</p>
                        )}
                        {importImageError && (
                          <p className="text-sm text-red-400">⚠ {importImageError}</p>
                        )}
                        {jigsawImagePreview && (
                          <div className="flex items-center gap-3">
                            {/* next/image can't render blob: object URLs (used here for local file previews before upload) */}
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={jigsawImagePreview} alt="preview" className="max-h-20 max-w-[160px] object-contain bg-[#111] rounded border border-slate-600" />
                            <button
                              type="button"
                              onClick={() => setJigsawImagePreview('')}
                              className="px-3 py-1 rounded bg-red-700 hover:bg-red-600 text-white text-sm"
                            >
                              Clear
                            </button>
                          </div>
                        )}
                      </div>

                      <p className="text-xs text-gray-400 mt-2">Recommended: landscape images around 800×600 for best results. The image is required when creating a jigsaw puzzle.</p>
 
                      {/* Live Jigsaw Puzzle Preview */}
                      {jigsawImagePreview && (
                        <div className="mt-6">
                          <label className="block text-sm font-semibold text-gray-300 mb-2">Live Jigsaw Puzzle Preview</label>
                          <div style={{ background: '#222', borderRadius: 8, padding: 12, width: '100%', overflow: 'hidden' }}>
                            <JigsawPuzzle
                              imageUrl={jigsawImagePreview}
                              boardWidth={jigsawBoardDims.w}
                              boardHeight={jigsawBoardDims.h}
                              rows={typeof formData.puzzleData.gridRows === 'number' && formData.puzzleData.gridRows > 1 ? formData.puzzleData.gridRows : 3}
                              cols={typeof formData.puzzleData.gridCols === 'number' && formData.puzzleData.gridCols > 1 ? formData.puzzleData.gridCols : 4}
                              pieceExtFrac={typeof formData.puzzleData.pieceExtFrac === 'number' ? formData.puzzleData.pieceExtFrac : undefined}
                              pieceRFrac={typeof formData.puzzleData.pieceRFrac === 'number' ? formData.puzzleData.pieceRFrac : undefined}
                              pieceNHalfFrac={typeof formData.puzzleData.pieceNHalfFrac === 'number' ? formData.puzzleData.pieceNHalfFrac : undefined}
                              pieceShoulderStart={typeof formData.puzzleData.pieceShoulderStart === 'number' ? formData.puzzleData.pieceShoulderStart : undefined}
                              containerStyle={{ maxHeight: '420px' }}
                              onComplete={() => {}}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Show Difficulty/Category for non-escape-canvas and non-mode-locked types only */}
                  {formData.puzzleType !== 'escape_room' && formData.puzzleType !== 'jim_wyze_case' && formData.puzzleType !== 'crime_rpg' && formData.puzzleType !== 'parasite_code' && formData.puzzleType !== 'gridlock_file' && formData.puzzleType !== 'debrief' && (
                    formData.puzzleType === 'sudoku' ? (
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
                            <option value="word_crack">Hidden Word</option>
                            <option value="word_search">Word Trove</option>
                            <option value="crossword">Crossword</option>
                            <option value="anagram_blitz">Anagram Blitz</option>
                            <option value="cipher_clash">Cipher Clash</option>
                            <option value="blackout">Blackout</option>
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
                            <option value="word_crack">Hidden Word</option>
                            <option value="word_search">Word Trove</option>
                            <option value="crossword">Crossword</option>
                            <option value="anagram_blitz">Anagram Blitz</option>
                            <option value="cipher_clash">Cipher Clash</option>
                            <option value="blackout">Blackout</option>
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

                  {/* Correct Answer is hidden for puzzle types that store/validate answers elsewhere. */}
                  {formData.puzzleType !== 'jigsaw' && formData.puzzleType !== 'sudoku' && formData.puzzleType !== 'escape_room' && formData.puzzleType !== 'jim_wyze_case' && formData.puzzleType !== 'code_master' && formData.puzzleType !== 'detective_case' && formData.puzzleType !== 'crime_rpg' && formData.puzzleType !== 'parasite_code' && formData.puzzleType !== 'gridlock_file' && formData.puzzleType !== 'debrief' && formData.puzzleType !== 'crack_safe' && formData.puzzleType !== 'word_crack' && formData.puzzleType !== 'word_search' && formData.puzzleType !== 'anagram_blitz' && formData.puzzleType !== 'blackout' && formData.puzzleType !== 'vault' && formData.puzzleType !== 'crossword' && formData.puzzleType !== 'cipher_clash' && (
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
                  <div className="grid grid-cols-2 gap-4">
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
                    <div>
                      <label className="block text-sm font-semibold text-gray-300 mb-2">
                        XP Reward
                      </label>
                      <input
                        type="number"
                        name="xpReward"
                        value={formData.xpReward}
                        onChange={handleInputChange}
                        min="1"
                        className="w-full px-4 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-white"
                      />
                      <p className="text-xs text-gray-500 mt-1">Easy=25 · Medium=50 · Hard=100 · Extreme=175</p>
                    </div>
                  </div>

                  {/* Hints (hidden for Sudoku) */}
                  {formData.puzzleType !== 'sudoku' && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-300 mb-2">
                        Hints ({formData.hints.filter(h => h.text.trim()).length})
                      </label>
                      <p className="text-xs text-gray-500 mb-3">Each hint costs the player 1 hint token to reveal (purchased in the Store).</p>
                      <div className="space-y-2 mb-3">
                        {formData.hints.map((hint, index) => (
                          <div key={index} className="flex gap-2 items-center">
                            <input
                              type="text"
                              value={hint.text}
                              onChange={(e) => handleHintChange(index, 'text', e.target.value)}
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

                  {/* Submit button for non-escape-canvas types */}
                  {formData.puzzleType !== 'escape_room' && formData.puzzleType !== 'jim_wyze_case' && (
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full px-6 py-3 rounded-lg bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-semibold transition"
                    >
                      {submitting ? (editingId ? "Saving..." : "Creating...") : editingId ? "💾 Update Puzzle" : "🚀 Create Puzzle"}
                    </button>
                  )}
                </form>
            </div>

            {/* Media Manager removed per request */}
          </div> {/* End grid */}

          {/* ── Manage Puzzles ─────────────────────────────── */}
          <div className="mt-16 mb-12">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-white">Manage Puzzles</h2>
              <button
                type="button"
                onClick={fetchPuzzles}
                disabled={fetchingPuzzles}
                className="px-3 py-1.5 rounded text-sm bg-slate-700 text-gray-300 hover:bg-slate-600 border border-slate-600 disabled:opacity-50"
              >
                {fetchingPuzzles ? "Loading…" : "↻ Refresh"}
              </button>
            </div>

            {/* Filter bar */}
            <div className="flex flex-wrap gap-3 mb-4">
              <input
                type="text"
                value={filterTitle}
                onChange={(e) => setFilterTitle(e.target.value)}
                placeholder="Search by title…"
                className="flex-1 min-w-[180px] px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white placeholder-gray-500 text-sm"
              />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-gray-300 text-sm"
              >
                <option value="all">All Types</option>
                {PUZZLE_TYPES.map((pt) => (
                  <option key={pt.value} value={pt.value}>{pt.label}</option>
                ))}
              </select>
              <select
                value={filterDifficulty}
                onChange={(e) => setFilterDifficulty(e.target.value)}
                className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-gray-300 text-sm"
              >
                <option value="all">All Difficulties</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
                <option value="extreme">Extreme</option>
              </select>
              {(filterTitle || filterType !== 'all' || filterDifficulty !== 'all') && (
                <button
                  type="button"
                  onClick={() => { setFilterTitle(''); setFilterType('all'); setFilterDifficulty('all'); }}
                  className="px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-gray-400 hover:text-white text-sm"
                >
                  ✕ Clear
                </button>
              )}
            </div>

            {deleteError && (
              <div className="mb-3 p-3 rounded bg-red-500/10 border border-red-500/30 text-red-300 text-sm flex items-center justify-between">
                <span>⚠ {deleteError}</span>
                <button type="button" onClick={() => setDeleteError(null)} className="ml-4 text-red-400 hover:text-white">✕</button>
              </div>
            )}

            {fetchingPuzzles ? (
              <p className="text-gray-400 text-sm">Loading puzzles…</p>
            ) : allPuzzles.length === 0 ? (
              <p className="text-gray-500 text-sm">No puzzles yet. Create one above.</p>
            ) : (() => {
              const filteredPuzzles = allPuzzles.filter((p) => {
                const titleMatch = !filterTitle ||
                  (p.escapeRoom?.roomTitle || p.title || '').toLowerCase().includes(filterTitle.toLowerCase());
                const typeMatch = filterType === 'all' || p.puzzleType === filterType;
                const diffMatch = filterDifficulty === 'all' || p.difficulty === filterDifficulty;
                return titleMatch && typeMatch && diffMatch;
              });
              return filteredPuzzles.length === 0 ? (
                <p className="text-gray-500 text-sm">No puzzles match your filters.</p>
              ) : (
                <>
                  <p className="text-xs text-gray-500 mb-2">{filteredPuzzles.length} of {allPuzzles.length} puzzles</p>
                  <div className="overflow-auto rounded-lg border border-slate-700">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-slate-800 text-gray-400 uppercase text-xs tracking-wider">
                        <tr>
                          <th className="px-4 py-3 font-semibold">Title</th>
                          <th className="px-4 py-3 font-semibold">Type</th>
                          <th className="px-4 py-3 font-semibold">Difficulty</th>
                          <th className="px-4 py-3 font-semibold">Category</th>
                          <th className="px-4 py-3 font-semibold">Destination</th>
                          <th className="px-4 py-3 font-semibold">Created</th>
                          <th className="px-4 py-3 font-semibold">Status</th>
                          <th className="px-4 py-3 font-semibold text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700/60">
                        {filteredPuzzles.map((p) => (
                          <tr key={p.id} className="bg-slate-800/40 hover:bg-slate-800/70 transition-colors">
                            <td className="px-4 py-3 text-white font-medium max-w-[220px] truncate" title={p.title}>{(() => {
                                const escapeTitle = p.escapeRoom?.roomTitle?.trim() || '';
                                const t = p.title?.trim() || '';
                                const display = ((p.puzzleType === 'escape_room' || p.puzzleType === 'jim_wyze_case') && escapeTitle)
                                  ? escapeTitle
                                  : (!t || t === 'Untitled Puzzle') && escapeTitle
                                  ? escapeTitle
                                  : t || escapeTitle || '';
                                return display ? display : <span className="text-gray-500 italic">Untitled</span>;
                              })()}</td>
                            <td className="px-4 py-3 text-gray-300 capitalize">{p.puzzleType.replace(/_/g, ' ')}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wide ${
                                p.difficulty === 'easy' ? 'bg-green-500/20 text-green-300' :
                                p.difficulty === 'medium' ? 'bg-yellow-500/20 text-yellow-300' :
                                p.difficulty === 'hard' ? 'bg-red-500/20 text-red-300' :
                                'bg-purple-500/20 text-purple-300'
                              }`}>{p.difficulty}</span>
                            </td>
                            <td className="px-4 py-3 text-gray-400">{p.category?.name || '—'}</td>
                            <td className="px-4 py-3">
                              {p.isWarzExclusive ? (
                                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-yellow-500/20 text-yellow-300">⚔️ Warz</span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-500/20 text-blue-300">🧩 Regular</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{new Date(p.createdAt).toLocaleDateString()}</td>
                            <td className="px-4 py-3">
                              <button
                                type="button"
                                disabled={togglingActiveId === p.id}
                                onClick={() => handleToggleActive(p)}
                                title={p.isActive ? 'Click to deactivate' : 'Click to activate'}
                                className={`px-2 py-0.5 rounded text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-wait ${
                                  p.isActive
                                    ? 'bg-green-500/20 text-green-300 hover:bg-green-500/30'
                                    : 'bg-gray-500/20 text-gray-400 hover:bg-gray-500/30'
                                }`}
                              >
                                {togglingActiveId === p.id ? '…' : p.isActive ? 'Active' : 'Inactive'}
                              </button>
                              {Array.isArray(p.dailySlots) && p.dailySlots.length > 0 && (
                                <span className="ml-1 px-2 py-0.5 rounded text-xs font-semibold bg-amber-500/20 text-amber-300">
                                  📅 Daily #{p.dailySlots.map(s => s.dayNumber).join(', #')}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right whitespace-nowrap">
                              {deleteConfirmId === p.id ? (
                                <span className="inline-flex items-center gap-2">
                                  <span className="text-red-300 text-xs">Confirm delete?</span>
                                  <button
                                    type="button"
                                    disabled={deletingId === p.id}
                                    onClick={() => handleDeletePuzzle(p.id)}
                                    className="px-2 py-1 rounded text-xs bg-red-600 hover:bg-red-700 text-white disabled:opacity-60"
                                  >
                                    {deletingId === p.id ? "Deleting…" : "Yes, delete"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDeleteConfirmId(null)}
                                    className="px-2 py-1 rounded text-xs bg-slate-600 hover:bg-slate-500 text-gray-300"
                                  >
                                    Cancel
                                  </button>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-2">
                                  <button
                                    type="button"
                                    disabled={loadingEdit}
                                    onClick={() => loadPuzzleForEdit(p.id)}
                                    className={`px-3 py-1 rounded text-xs border transition-colors ${
                                      editingId === p.id
                                        ? 'bg-blue-600/40 text-blue-200 border-blue-500/60'
                                        : 'bg-blue-900/30 hover:bg-blue-700/50 text-blue-300 hover:text-white border-blue-700/40'
                                    }`}
                                  >
                                    {loadingEdit && editingId === null ? '…' : editingId === p.id ? '✏️ Editing' : '✏️ Edit'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => { setDeleteConfirmId(p.id); setDeleteError(null); }}
                                    className="px-3 py-1 rounded text-xs bg-red-900/40 hover:bg-red-700/60 text-red-300 hover:text-white border border-red-700/40 transition-colors"
                                  >
                                    🗑 Delete
                                  </button>
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              );
            })()}
          </div>
          {/* ── End Manage Puzzles ──────────────────────────── */}

        </div>
      </div>

    </div>
  );

}
