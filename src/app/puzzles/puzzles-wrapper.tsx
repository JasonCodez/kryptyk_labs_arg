"use client";

import { useSearchParams } from "next/navigation";
import PuzzlesList from "./puzzles-list";

export default function PuzzlesPageWrapper() {
  const searchParams = useSearchParams();
  
  return <PuzzlesList initialCategory={searchParams.get("category") || "all"} />;
}
