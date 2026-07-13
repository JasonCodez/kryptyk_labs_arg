"use client";

import PuzzlesList from "../../puzzles-list";

export default function CampaignWrapper({ puzzleType }: { puzzleType: string }) {
  return <PuzzlesList puzzleType={puzzleType} />;
}
