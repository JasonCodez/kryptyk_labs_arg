import type { Metadata } from "next";
import { Suspense } from "react";
import PuzzlesWrapper from "./puzzles-wrapper";
import LoadingSpinner from "@/components/LoadingSpinner";

export const metadata: Metadata = {
  title: "Campaigns",
  description:
    "Pick a puzzle campaign — Sudoku, escape rooms, cryptic challenges, and more — and work through it start to finish.",
  alternates: { canonical: "https://puzzlewarz.com/puzzles" },
  openGraph: {
    title: "Campaigns | Puzzle Warz",
    description:
      "Pick a puzzle campaign and work through it start to finish.",
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

