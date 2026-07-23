import type { ReactNode } from "react";
import {
  Swords,
  Target,
  Lock,
  ShieldCheck,
  Clock,
  Ban,
  CircleCheck,
  TriangleAlert,
} from "lucide-react";

export type WarzChallengeStatusKind =
  | "own"
  | "open"
  | "direct"
  | "private"
  | "resume"
  | "in-progress-other"
  | "expired"
  | "cancelled"
  | "completed"
  | "insufficient-balance";

export interface WarzChallengeStatusProps {
  kind: WarzChallengeStatusKind;
  challengerName: string;
  invitedUserName?: string | null;
  requiredPoints: number;
  availablePoints: number;
}

interface StatusContent {
  eyebrow: string;
  icon: ReactNode;
  message: ReactNode;
}

/**
 * Purely presentational. Renders the classification eyebrow/message pair for
 * the current challenge state — no requests, no navigation, no point math,
 * no status mutation. The page derives `kind`; this component only displays it.
 */
export default function WarzChallengeStatus({
  kind,
  invitedUserName,
  requiredPoints,
  availablePoints,
}: WarzChallengeStatusProps) {
  const content = getStatusContent(kind, invitedUserName ?? null, requiredPoints, availablePoints);

  return (
    <div
      className="flex items-start gap-3 rounded-xl p-4"
      style={{ background: "var(--pw-surface-2)", border: "1px solid var(--pw-border-default)" }}
    >
      <span aria-hidden="true" style={{ color: "var(--pw-brand-secondary)" }}>
        {content.icon}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className="block text-xs font-bold uppercase tracking-wide"
          style={{ color: "var(--pw-brand-secondary)" }}
        >
          {content.eyebrow}
        </span>
        <span className="mt-1 block text-sm" style={{ color: "var(--pw-text-secondary)" }}>
          {content.message}
        </span>
      </span>
    </div>
  );
}

function getStatusContent(
  kind: WarzChallengeStatusKind,
  invitedUserName: string | null,
  requiredPoints: number,
  availablePoints: number
): StatusContent {
  switch (kind) {
    case "own":
      return {
        eyebrow: "YOUR CHALLENGE",
        icon: <ShieldCheck aria-hidden="true" size={20} />,
        message: "This is your challenge. Another eligible player must accept it before the battle can continue.",
      };
    case "open":
      return {
        eyebrow: "OPEN CHALLENGE",
        icon: <Swords aria-hidden="true" size={20} />,
        message: "Any eligible player may accept this battle.",
      };
    case "direct":
      return {
        eyebrow: "DIRECT CHALLENGE",
        icon: <Target aria-hidden="true" size={20} />,
        message: "This battle was sent specifically to you.",
      };
    case "private":
      return {
        eyebrow: "PRIVATE CHALLENGE",
        icon: <Lock aria-hidden="true" size={20} />,
        message: invitedUserName
          ? `This battle was sent to @${invitedUserName}.`
          : "This battle was sent to another player.",
      };
    case "resume":
      return {
        eyebrow: "BATTLE READY",
        icon: <ShieldCheck aria-hidden="true" size={20} />,
        message: "You have already accepted this challenge. Your wager is committed and the puzzle is ready.",
      };
    case "in-progress-other":
      return {
        eyebrow: "IN PROGRESS",
        icon: <Clock aria-hidden="true" size={20} />,
        message: "This battle is already in progress.",
      };
    case "expired":
      return {
        eyebrow: "EXPIRED",
        icon: <Clock aria-hidden="true" size={20} />,
        message: "This challenge has expired.",
      };
    case "cancelled":
      return {
        eyebrow: "CANCELLED",
        icon: <Ban aria-hidden="true" size={20} />,
        message: "This challenge was cancelled.",
      };
    case "completed":
      return {
        eyebrow: "COMPLETED",
        icon: <CircleCheck aria-hidden="true" size={20} />,
        message: "This battle has already finished.",
      };
    case "insufficient-balance":
      return {
        eyebrow: "OPEN CHALLENGE",
        icon: <TriangleAlert aria-hidden="true" size={20} />,
        message: (
          <>
            You need <span className="font-bold">{requiredPoints} Points</span> to accept this challenge.
            <br />
            Your current balance is <span className="font-bold">{availablePoints} Points</span>.
          </>
        ),
      };
    default:
      return {
        eyebrow: "UNAVAILABLE",
        icon: <TriangleAlert aria-hidden="true" size={20} />,
        message: "This challenge is not available.",
      };
  }
}
