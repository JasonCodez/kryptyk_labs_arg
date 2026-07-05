import { ImageResponse } from "next/og";
import prisma from "@/lib/prisma";
import { getPuzzleTypeLabel } from "@/lib/puzzleTypeLabels";

export const runtime = "edge";
export const alt = "Puzzle Warz — Puzzle Preview";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

function TypeBadge({ label }: { label: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 18px",
        borderRadius: 999,
        border: "1px solid rgba(255,208,0,0.35)",
        background: "rgba(255,208,0,0.08)",
      }}
    >
      <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#FFD700", display: "flex" }} />
      <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#FFD700" }}>
        {label} · Puzzle Warz
      </span>
    </div>
  );
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const puzzle = await prisma.puzzle.findUnique({
    where: { id },
    select: {
      title: true,
      difficulty: true,
      puzzleType: true,
      category: { select: { name: true } },
      jigsaw: { select: { imageUrl: true } },
    },
  }).catch(() => null);

  const title = puzzle?.title ?? "Puzzle Warz";
  const typeLabel = getPuzzleTypeLabel(puzzle?.puzzleType ?? "general");
  const category = puzzle?.category?.name ?? "General";
  const difficulty = puzzle?.difficulty ?? "medium";
  const difficultyLabel = difficulty.charAt(0).toUpperCase() + difficulty.slice(1);

  // Only jigsaw puzzles currently have an actual picture attached to the puzzle record —
  // every other type shows the branded text layout below instead of a placeholder image.
  const rawImageUrl = puzzle?.jigsaw?.imageUrl ?? null;
  const previewImageUrl = rawImageUrl
    ? rawImageUrl.startsWith("http") ? rawImageUrl : `https://puzzlewarz.com${rawImageUrl}`
    : null;

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: "flex",
          background: "#010101",
          fontFamily: "system-ui, sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Background dot grid */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: "radial-gradient(circle, rgba(255,208,0,0.3) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
            opacity: 0.06,
            display: "flex",
          }}
        />
        {/* Gold glow orb */}
        <div
          style={{
            position: "absolute",
            top: -120,
            left: "50%",
            marginLeft: -400,
            width: 800,
            height: 500,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(255,208,0,0.18) 0%, transparent 65%)",
            display: "flex",
          }}
        />

        {previewImageUrl ? (
          <>
            <div style={{ width: 520, height: 630, display: "flex", alignItems: "center", justifyContent: "center", padding: 44 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewImageUrl}
                width={432}
                height={432}
                style={{
                  objectFit: "cover",
                  borderRadius: 20,
                  border: "3px solid rgba(255,208,0,0.5)",
                  boxShadow: "0 0 60px rgba(255,208,0,0.22)",
                }}
              />
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 20, padding: "0 56px 0 8px" }}>
              <TypeBadge label={typeLabel} />
              <span style={{ fontSize: 52, fontWeight: 900, color: "#ffffff", letterSpacing: "-0.02em", lineHeight: 1.08, display: "flex" }}>
                {title}
              </span>
              <span style={{ fontSize: 20, color: "#9CA3AF", letterSpacing: "0.02em", display: "flex" }}>
                {category} · {difficultyLabel} difficulty
              </span>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 22 }}>
            <TypeBadge label={typeLabel} />
            <span
              style={{
                fontSize: 68,
                fontWeight: 900,
                color: "#ffffff",
                letterSpacing: "-0.03em",
                lineHeight: 1.1,
                textAlign: "center",
                maxWidth: 1000,
                display: "flex",
              }}
            >
              {title}
            </span>
            <span style={{ fontSize: 22, color: "#9CA3AF", letterSpacing: "0.02em", display: "flex" }}>
              {category} · {difficultyLabel} difficulty
            </span>
          </div>
        )}

        {/* Bottom brand strip */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 64,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 48px",
            borderTop: "1px solid rgba(255,255,255,0.06)",
            background: "rgba(255,255,255,0.015)",
          }}
        >
          <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#FFD700" }}>
            PUZZLEWARZ.COM
          </span>
          <span style={{ fontSize: 14, color: "#4B5563", letterSpacing: "0.06em" }}>
            Train your mind. Earn your rank.
          </span>
        </div>
      </div>
    ),
    { ...size },
  );
}
