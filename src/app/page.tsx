import type { Metadata } from "next";
import HomeClient from "./HomeClient";

export const metadata: Metadata = {
  title: "Puzzle Warz - Daily Hidden Word, Puzzle Library & Leaderboards",
  description:
    "Start with the daily Hidden Word, then dive into Gridlock files, crosswords, and the full Puzzle Warz library. Earn points, climb leaderboards, and jump into Warz battles.",
  alternates: { canonical: "https://puzzlewarz.com" },
  openGraph: {
    title: "Puzzle Warz - Daily Hidden Word, Puzzle Library & Leaderboards",
    description:
      "Start with the daily Hidden Word, then dive into Gridlock files, crosswords, and the full Puzzle Warz library. Earn points, climb leaderboards, and jump into Warz battles.",
    url: "https://puzzlewarz.com",
    type: "website",
  },
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ source?: string | string[] }>;
}) {
  const { source } = await searchParams;
  const launchCandidate = source === "pwa";
  return <HomeClient launchCandidate={launchCandidate} />;
}