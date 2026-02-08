import { redirect } from "next/navigation";

export default function PuzzlePlanningAliasPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { teamId?: string };
}) {
  const teamId = searchParams?.teamId;
  if (teamId) {
    redirect(`/teams/${teamId}/puzzle/${params.id}/planning`);
  }

  // If a user lands here without a team context, send them to the puzzle page
  // rather than showing a 404.
  redirect(`/puzzles/${params.id}`);
}
