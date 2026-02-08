import { redirect } from "next/navigation";

export default function PlanningAliasPage({
  params,
}: {
  params: { id: string; puzzleId: string };
}) {
  redirect(`/teams/${params.id}/puzzle/${params.puzzleId}/planning`);
}
