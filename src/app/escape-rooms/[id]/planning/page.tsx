import { redirect } from "next/navigation";

export default function EscapeRoomPlanningAliasPage({
  params,
}: {
  params: { id: string };
}) {
  // There's not enough info in this URL shape to determine team + puzzle,
  // so fall back to the escape room detail page.
  redirect(`/escape-rooms/${params.id}`);
}
