import { redirect } from "next/navigation";

export default function TeamPlanningAliasPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { puzzleId?: string };
}) {
  const puzzleId = searchParams?.puzzleId;
  if (puzzleId) {
    redirect(`/teams/${params.id}/puzzle/${puzzleId}/planning`);
  }

  // No puzzle context provided; fall back to the team lobby.
  redirect(`/teams/${params.id}/lobby`);
}
