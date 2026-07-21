import type { Metadata } from "next";
import { Suspense } from "react";
import CampaignWrapper from "./campaign-wrapper";
import LoadingSpinner from "@/components/LoadingSpinner";
import { getPuzzleTypeLabel } from "@/lib/puzzleTypeLabels";

type Props = { params: Promise<{ puzzleType: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { puzzleType } = await params;
  const label = getPuzzleTypeLabel(puzzleType);

  return {
    title: `${label} Campaign`,
    description: `Play the ${label} campaign, track your progress, and complete every challenge.`,
    alternates: { canonical: `https://puzzlewarz.com/puzzles/type/${puzzleType}` },
    openGraph: {
      title: `${label} Campaign | Puzzle Warz`,
      description: `Play the ${label} campaign, track your progress, and complete every challenge.`,
      url: `https://puzzlewarz.com/puzzles/type/${puzzleType}`,
      type: "website",
    },
  };
}

export default async function PuzzleTypeCampaignPage({ params }: Props) {
  const { puzzleType } = await params;

  return (
    <Suspense fallback={<LoadingSpinner label="Loading…" />}>
      <CampaignWrapper puzzleType={puzzleType} />
    </Suspense>
  );
}
