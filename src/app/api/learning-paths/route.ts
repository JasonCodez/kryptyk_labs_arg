import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

// ─── Track ordering ──────────────────────────────────────────────────────────
// This controls the canonical display order regardless of DB insertion order.
const TRACK_ORDER: string[] = [
  "HTML Basics",
  "HTML Structure",
  "HTML Forms",
  "CSS Fundamentals",
  "CSS Layout",
  "CSS Animations",
  "JS Fundamentals",
  "JS DOM",
  "JS Async",
  "TypeScript",
  "Python",
];

const TRACK_ICONS: Record<string, string> = {
  "HTML Basics":      "🌐",
  "HTML Structure":   "🏗️",
  "HTML Forms":       "📋",
  "CSS Fundamentals": "🎨",
  "CSS Layout":       "📐",
  "CSS Animations":   "✨",
  "JS Fundamentals":  "⚡",
  "JS DOM":           "🖱️",
  "JS Async":         "🔄",
  "TypeScript":       "🔷",
  "Python":           "🐍",
};

const TRACK_DESCRIPTION: Record<string, string> = {
  "HTML Basics":      "Learn the building blocks of every web page.",
  "HTML Structure":   "Master semantic elements and document structure.",
  "HTML Forms":       "Build forms that capture and validate user input.",
  "CSS Fundamentals": "Style your pages with color, typography, and spacing.",
  "CSS Layout":       "Control layout with Flexbox and Grid.",
  "CSS Animations":   "Bring pages to life with transitions and keyframes.",
  "JS Fundamentals":  "Variables, functions, arrays, and logic.",
  "JS DOM":           "Query elements and respond to user events.",
  "JS Async":         "Promises, async/await, and fetching data.",
  "TypeScript":       "Add types to JavaScript for safer, clearer code.",
  "Python":           "Server-side scripting and algorithmic problem solving.",
};

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Fetch all active code_master puzzles that have a track set
    const puzzles = await prisma.puzzle.findMany({
      where: {
        isActive: true,
        puzzleType: "code_master",
      },
      select: {
        id: true,
        title: true,
        description: true,
        difficulty: true,
        data: true,
        solutions: {
          select: { points: true },
          take: 1,
        },
        userProgress: {
          where: { userId: user.id },
          select: { solved: true, attempts: true },
        },
      },
      orderBy: { order: "asc" },
    });

    // Group by track
    type TrackPuzzle = {
      id: string;
      title: string;
      description: string | null;
      difficulty: string;
      points: number | null;
      trackOrder: number;
      concepts: string[];
      solved: boolean;
      attempted: boolean;
    };

    const trackMap = new Map<string, TrackPuzzle[]>();

    for (const p of puzzles) {
      const data = (p.data || {}) as Record<string, unknown>;
      const track = typeof data.track === "string" && data.track.trim() ? data.track.trim() : null;
      if (!track) continue;

      const trackOrder = typeof data.trackOrder === "number" ? data.trackOrder : 999;
      const concepts = Array.isArray(data.concepts)
        ? (data.concepts as string[]).filter((c) => typeof c === "string")
        : [];
      const progress = p.userProgress[0] ?? null;
      const points = (p as any).solutions?.[0]?.points ?? null;

      if (!trackMap.has(track)) trackMap.set(track, []);

      trackMap.get(track)!.push({
        id: p.id,
        title: p.title || "Untitled",
        description: p.description ?? null,
        difficulty: p.difficulty || "medium",
        points,
        trackOrder,
        concepts,
        solved: progress?.solved ?? false,
        attempted: (progress?.attempts ?? 0) > 0,
      });
    }

    // Sort puzzles within each track by trackOrder
    for (const [, list] of trackMap) {
      list.sort((a, b) => a.trackOrder - b.trackOrder);
    }

    // Build output in canonical order
    const tracks = TRACK_ORDER
      .filter((name) => trackMap.has(name))
      .map((name) => {
        const puzzleList = trackMap.get(name)!;
        const completedCount = puzzleList.filter((p) => p.solved).length;
        return {
          name,
          icon: TRACK_ICONS[name] ?? "📘",
          description: TRACK_DESCRIPTION[name] ?? "",
          totalCount: puzzleList.length,
          completedCount,
          puzzles: puzzleList,
        };
      });

    // Append any tracks not in the canonical list (custom admin tracks)
    for (const [name, list] of trackMap) {
      if (TRACK_ORDER.includes(name)) continue;
      const completedCount = list.filter((p) => p.solved).length;
      tracks.push({
        name,
        icon: "📘",
        description: "",
        totalCount: list.length,
        completedCount,
        puzzles: list,
      });
    }

    return NextResponse.json({ tracks });
  } catch (error) {
    console.error("Failed to fetch learning paths:", error);
    return NextResponse.json({ error: "Failed to fetch learning paths" }, { status: 500 });
  }
}
