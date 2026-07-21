import type { Metadata } from "next";
import { Suspense } from "react";
import PuzzlesWrapper from "./puzzles-wrapper";
import LoadingSpinner from "@/components/LoadingSpinner";

export const metadata: Metadata = {
  title: "Puzzle Library",
  description:
    "Browse PuzzleWarz campaigns, continue your progress, and find your next puzzle challenge.",
  alternates: { canonical: "https://puzzlewarz.com/puzzles" },
  openGraph: {
    title: "Puzzle Library | Puzzle Warz",
    description:
      "Browse PuzzleWarz campaigns, continue your progress, and find your next puzzle challenge.",
    url: "https://puzzlewarz.com/puzzles",
    type: "website",
  },
};

export default function PuzzlesPage() {
  return (
    <Suspense fallback={<LoadingSpinner label="Loading puzzles…" />}>
      <PuzzlesWrapper />
    </Suspense>
  );
}

