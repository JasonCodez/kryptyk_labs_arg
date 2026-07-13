"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import PuzzlesList from "./puzzles-list";
import PuzzlesHub from "./puzzles-hub";

export default function PuzzlesPageWrapper() {
  const searchParams = useSearchParams();
  const category = searchParams.get("category");

  // Notifications link to /puzzles#puzzle-<id> to focus a specific card, which only the flat
  // list knows how to do — detect that and skip the hub so the deep link still works.
  const [hasPuzzleHash, setHasPuzzleHash] = useState(false);
  useEffect(() => {
    setHasPuzzleHash(window.location.hash.startsWith("#puzzle-"));
  }, []);

  // Arriving from /categories with a specific category picked still gets the classic flat,
  // filterable list — the campaign hub below is the default landing experience otherwise.
  if (category || hasPuzzleHash) {
    return <PuzzlesList initialCategory={category || "all"} />;
  }

  return <PuzzlesHub />;
}
