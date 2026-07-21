"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  Puzzle as PuzzleIcon,
  CircleCheck,
  ListChecks,
  Gauge,
  Crown,
  Layers3,
  Check,
  Play,
  CirclePlay,
  Lock,
  CircleX,
  Sparkles,
  Star,
} from "lucide-react";
import PageContainer from "@/components/ui/PageContainer";
import Card from "@/components/ui/Card";
import GameButton from "@/components/game-ui/GameButton";
import SolvedIconOverlay from "@/components/puzzle/SolvedIconOverlay";
import { useAppReducedMotion } from "@/hooks/useAppReducedMotion";
import { getPuzzleTypeLabel } from "@/lib/puzzleTypeLabels";

export interface CampaignPuzzle {
  id: string;
  title: string;
  description?: string | null;
  difficulty?: string;
  order: number;
  createdAt?: string;
  pointsReward?: number;
  xpReward?: number;
  puzzleType?: string;
  locked?: boolean;
  unlocksAfterTitle?: string | null;
  isBossPuzzle?: boolean;
  isTeamPuzzle?: boolean;
  failed?: boolean;
  failedReason?: string | null;
  userProgress?: Array<{ solved: boolean }>;
}

export interface CampaignPathProps {
  puzzleType: string;
  puzzles: CampaignPuzzle[];
  justCompletedId?: string | null;
  onActivatePuzzle: (puzzleId: string) => void;
}

type ChallengeStatus = "completed" | "up-next" | "available" | "locked" | "failed";

function getDisplayTitle(puzzle: CampaignPuzzle): string {
  const raw = typeof puzzle.title === "string" ? puzzle.title.trim() : "";
  return raw || "Untitled Puzzle";
}

// Intentionally duplicated verbatim from PuzzlesList's formatFailedReason —
// there is no shared helpers file in this pass's allowed scope, and the
// wording itself must not change, so a local copy (not a rewrite) is the
// safer choice over reaching into an unlisted file.
function formatFailedReason(reason: string | null | undefined): string | null {
  if (!reason) return null;
  if (reason === "time_limit") return "Time limit reached";
  if (reason === "time_expired") return "Time expired";
  if (reason === "max_attempts") return "Maximum submissions reached";
  if (reason === "given_up") return "Gave up";
  if (reason === "incorrect_submission") return "Wrong answer (case locked)";
  return "Failed";
}

function capitalize(value: string): string {
  return value.length > 0 ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

function isSolved(puzzle: CampaignPuzzle): boolean {
  return puzzle.userProgress?.[0]?.solved === true;
}

function isPlayable(puzzle: CampaignPuzzle): boolean {
  return !isSolved(puzzle) && !puzzle.failed && !puzzle.locked;
}

/** order asc, then createdAt asc, then original array position — never mutates the input. */
function orderPuzzles(puzzles: CampaignPuzzle[]): CampaignPuzzle[] {
  return puzzles
    .map((puzzle, index) => ({ puzzle, index }))
    .sort((a, b) => {
      if (a.puzzle.order !== b.puzzle.order) return a.puzzle.order - b.puzzle.order;
      const aTime = a.puzzle.createdAt ? new Date(a.puzzle.createdAt).getTime() : 0;
      const bTime = b.puzzle.createdAt ? new Date(b.puzzle.createdAt).getTime() : 0;
      if (aTime !== bTime) return aTime - bTime;
      return a.index - b.index;
    })
    .map(({ puzzle }) => puzzle);
}

/** Solved -> Locked -> Failed -> Playable, matching PuzzlesList's existing precedence. */
function getChallengeStatus(puzzle: CampaignPuzzle, nextPlayableId: string | null): ChallengeStatus {
  if (isSolved(puzzle)) return "completed";
  if (puzzle.locked) return "locked";
  if (puzzle.failed) return "failed";
  return puzzle.id === nextPlayableId ? "up-next" : "available";
}

const STATUS_META: Record<ChallengeStatus, { text: string; token: string; Icon: typeof Check }> = {
  completed: { text: "Completed", token: "var(--pw-success)", Icon: Check },
  "up-next": { text: "Up next", token: "var(--pw-brand-primary)", Icon: Play },
  available: { text: "Available", token: "var(--pw-text-secondary)", Icon: CirclePlay },
  locked: { text: "Locked", token: "var(--pw-text-muted)", Icon: Lock },
  failed: { text: "Failed", token: "var(--pw-error-text)", Icon: CircleX },
};

const FOCUS_VISIBLE = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";

function RewardChips({ puzzle }: { puzzle: CampaignPuzzle }) {
  if (!puzzle.xpReward && !puzzle.pointsReward) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {!!puzzle.xpReward && (
        <span
          className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg"
          style={{ background: "color-mix(in srgb, var(--pw-brand-secondary) 15%, transparent)", color: "var(--pw-brand-secondary-light)" }}
        >
          <Sparkles aria-hidden="true" size={12} /> {puzzle.xpReward} XP
        </span>
      )}
      {!!puzzle.pointsReward && (
        <span
          className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg"
          style={{ background: "color-mix(in srgb, var(--pw-brand-primary) 15%, transparent)", color: "var(--pw-brand-primary-light)" }}
        >
          <Star aria-hidden="true" size={12} /> {puzzle.pointsReward} points
        </span>
      )}
    </div>
  );
}

function StatChip({ icon: Icon, value, label }: { icon: typeof CircleCheck; value: string | number; label: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-1 py-3 rounded-xl text-center"
      style={{ background: "var(--pw-surface-2)", border: "1px solid var(--pw-border-subtle)" }}
    >
      <Icon aria-hidden="true" size={16} style={{ color: "var(--pw-brand-primary)" }} />
      <span className="text-base font-extrabold" style={{ color: "var(--pw-text-primary)" }}>{value}</span>
      <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--pw-text-secondary)" }}>{label}</span>
    </div>
  );
}

interface ChallengeNodeProps {
  puzzle: CampaignPuzzle;
  index: number;
  isLast: boolean;
  status: ChallengeStatus;
  justCompleted: boolean;
  onActivate: () => void;
}

// No local transition exists on a challenge entry to gate behind reduced
// motion — the only animation here is the reused, frozen SolvedIconOverlay,
// used exactly as-is (see the campaign-page.spec.ts note on its behavior).
function ChallengeNode({ puzzle, index, isLast, status, justCompleted, onActivate }: ChallengeNodeProps) {
  const label = getDisplayTitle(puzzle);
  const meta = STATUS_META[status];
  const interactive = status === "completed" || status === "up-next" || status === "available";
  const failureText = status === "failed" ? formatFailedReason(puzzle.failedReason) : null;

  const cardContent = (
    <>
      <div className="flex items-center gap-2 flex-wrap mb-1">
        <span className="text-xs font-bold" style={{ color: "var(--pw-text-muted)" }}>#{index + 1}</span>
        <h3 className="text-base font-extrabold" style={{ color: "var(--pw-text-primary)" }}>{label}</h3>
        {puzzle.isBossPuzzle && (
          <span
            className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded"
            style={{ background: "color-mix(in srgb, var(--pw-brand-accent) 15%, transparent)", color: "var(--pw-brand-accent-light)" }}
          >
            <Crown aria-hidden="true" size={11} /> Boss
          </span>
        )}
      </div>
      <p className="text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: meta.token }}>{meta.text}</p>
      {puzzle.description && (
        <p className="text-sm mb-2 leading-relaxed" style={{ color: "var(--pw-text-secondary)" }}>{puzzle.description}</p>
      )}
      <p className="text-xs font-semibold mb-2 flex flex-wrap gap-x-2 gap-y-0.5" style={{ color: "var(--pw-text-secondary)" }}>
        {puzzle.difficulty && <span>{capitalize(puzzle.difficulty)}</span>}
        <span>{puzzle.isTeamPuzzle ? "Team" : "Solo"}</span>
      </p>
      {status === "locked" && (
        <p className="text-xs" style={{ color: "var(--pw-text-muted)" }}>
          {puzzle.unlocksAfterTitle ? <>Complete &quot;{puzzle.unlocksAfterTitle}&quot; first</> : "Complete the previous challenge first"}
        </p>
      )}
      {status === "failed" && failureText && failureText !== meta.text && (
        <p className="text-xs font-semibold" style={{ color: "var(--pw-error-text)" }}>{failureText}</p>
      )}
      {status !== "locked" && <RewardChips puzzle={puzzle} />}
    </>
  );

  const cardStyle = {
    background: "var(--pw-surface-2)",
    border: `1px solid ${status === "up-next" ? meta.token : "var(--pw-border-default)"}`,
    outlineColor: "var(--pw-focus-ring)",
  };

  return (
    <div className="flex items-stretch gap-4" id={`puzzle-${puzzle.id}`}>
      {/* Sequence node + connector spine — purely decorative; status is
          already communicated as visible text inside the card. */}
      <div aria-hidden="true" className="flex flex-col items-center shrink-0" style={{ width: 40 }}>
        <div
          className="rounded-full flex items-center justify-center relative shrink-0"
          style={{
            width: 40,
            height: 40,
            background: `color-mix(in srgb, ${meta.token} 18%, transparent)`,
            border: `2px solid ${meta.token}`,
          }}
        >
          <meta.Icon size={18} style={{ color: meta.token }} />
          {status === "completed" && <SolvedIconOverlay animateIn={justCompleted} size={16} />}
        </div>
        {!isLast && (
          <div style={{ width: 2, flex: 1, minHeight: 16, marginTop: 4, background: "var(--pw-border-default)" }} />
        )}
      </div>

      {interactive ? (
        <button
          type="button"
          onClick={onActivate}
          aria-label={`${label} — ${meta.text}`}
          className={`flex-1 min-w-0 text-left rounded-2xl p-4 mb-4 min-h-[44px] hover:opacity-90 transition-opacity ${FOCUS_VISIBLE}`}
          style={cardStyle}
        >
          {cardContent}
        </button>
      ) : (
        <div aria-disabled="true" className="flex-1 min-w-0 rounded-2xl p-4 mb-4" style={{ ...cardStyle, opacity: 0.75 }}>
          {cardContent}
        </div>
      )}
    </div>
  );
}

function EmptyChallenges() {
  return (
    <div className="text-center py-16">
      <PuzzleIcon aria-hidden="true" size={40} style={{ color: "var(--pw-text-muted)", margin: "0 auto 16px" }} />
      <p className="text-lg font-bold mb-2" style={{ color: "var(--pw-text-primary)" }}>No challenges available</p>
      <p className="text-sm mb-6" style={{ color: "var(--pw-text-secondary)" }}>
        This campaign does not have any playable challenges yet.
      </p>
      <Link
        href="/puzzles"
        className={`inline-flex items-center justify-center min-h-[44px] px-5 rounded-xl text-sm font-bold ${FOCUS_VISIBLE}`}
        style={{ background: "var(--pw-brand-primary)", color: "var(--pw-text-on-primary)", outlineColor: "var(--pw-focus-ring)" }}
      >
        Back to Puzzle Library
      </Link>
    </div>
  );
}

export default function CampaignPath({ puzzleType, puzzles, justCompletedId, onActivatePuzzle }: CampaignPathProps) {
  const reduceMotion = useAppReducedMotion();
  const label = getPuzzleTypeLabel(puzzleType);

  const ordered = useMemo(() => orderPuzzles(puzzles), [puzzles]);
  const totalChallenges = ordered.length;
  const solvedCount = useMemo(() => ordered.filter(isSolved).length, [ordered]);
  const completionPercentage = totalChallenges > 0 ? Math.round((solvedCount / totalChallenges) * 100) : 0;
  const hasBossPuzzle = useMemo(() => ordered.some((p) => p.isBossPuzzle), [ordered]);
  const nextPlayablePuzzle = useMemo(() => ordered.find((p) => isPlayable(p)) ?? null, [ordered]);
  const allCompleted = totalChallenges > 0 && solvedCount === totalChallenges;

  const backLink = (
    <Link
      href="/puzzles"
      className={`inline-flex items-center gap-1.5 text-sm font-bold min-h-[44px] px-1 mb-4 hover:opacity-80 transition-opacity ${FOCUS_VISIBLE}`}
      style={{ color: "var(--pw-brand-primary)", outlineColor: "var(--pw-focus-ring)" }}
    >
      <ChevronLeft aria-hidden="true" size={18} />
      Puzzle Library
    </Link>
  );

  if (totalChallenges === 0) {
    return (
      <div style={{ paddingTop: "calc(56px + env(safe-area-inset-top, 0px))" }}>
        <PageContainer as="section" size="catalog" className="pt-8 pb-16">
          {backLink}
          <EmptyChallenges />
        </PageContainer>
      </div>
    );
  }

  const overviewAccent = allCompleted ? "success" : solvedCount > 0 ? "primary" : "neutral";
  const progressFillToken = allCompleted ? "var(--pw-success)" : "var(--pw-brand-primary)";

  return (
    <div style={{ paddingTop: "calc(56px + env(safe-area-inset-top, 0px))" }}>
      <PageContainer as="section" size="catalog" className="pt-8 pb-16">
        {backLink}

        <div className="mb-6">
          <p className="inline-flex items-center gap-1.5 text-xs font-bold tracking-widest mb-3" style={{ color: "var(--pw-brand-primary)" }}>
            <PuzzleIcon aria-hidden="true" size={14} strokeWidth={2.5} />
            PUZZLE CAMPAIGN
          </p>
          <h1 className="text-3xl sm:text-4xl font-extrabold leading-tight mb-3" style={{ color: "var(--pw-text-primary)" }}>
            {label}
          </h1>
          <p className="text-base leading-relaxed max-w-[34rem]" style={{ color: "var(--pw-text-secondary)" }}>
            Complete each challenge, track your progress, and work your way through the campaign.
          </p>
        </div>

        <Card accent={overviewAccent} padding="lg" className="mb-8 max-w-5xl">
          <div className="grid sm:grid-cols-2 gap-6">
            <div>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <StatChip icon={CircleCheck} value={solvedCount} label="Cleared" />
                <StatChip icon={ListChecks} value={totalChallenges} label="Challenges" />
                <StatChip icon={Gauge} value={`${completionPercentage}%`} label="Complete" />
              </div>
              <div
                role="progressbar"
                aria-label={`${label} campaign progress`}
                aria-valuemin={0}
                aria-valuemax={totalChallenges}
                aria-valuenow={solvedCount}
                className="h-2 w-full rounded-full overflow-hidden mb-3"
                style={{ background: "color-mix(in srgb, var(--pw-text-secondary) 18%, transparent)" }}
              >
                <div
                  className={reduceMotion ? "h-full rounded-full" : "h-full rounded-full transition-all duration-500"}
                  style={{ width: `${completionPercentage}%`, background: progressFillToken }}
                />
              </div>
              <p
                className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide"
                style={{ color: hasBossPuzzle ? "var(--pw-brand-accent-light)" : "var(--pw-text-secondary)" }}
              >
                {hasBossPuzzle ? <Crown aria-hidden="true" size={14} /> : <Layers3 aria-hidden="true" size={14} />}
                {hasBossPuzzle ? "Boss finale" : "Open collection"}
              </p>
            </div>

            <div>
              {allCompleted ? (
                <div>
                  <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest mb-1.5" style={{ color: "var(--pw-success)" }}>
                    <CircleCheck aria-hidden="true" size={14} />
                    Campaign complete
                  </p>
                  <p className="text-sm" style={{ color: "var(--pw-text-secondary)" }}>
                    Every challenge in this campaign has been cleared.
                  </p>
                </div>
              ) : nextPlayablePuzzle ? (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--pw-brand-primary)" }}>
                    Up next
                  </p>
                  <p className="text-lg font-extrabold mb-1.5" style={{ color: "var(--pw-text-primary)" }}>
                    {getDisplayTitle(nextPlayablePuzzle)}
                  </p>
                  <p className="text-xs font-semibold mb-3 flex flex-wrap gap-x-2 gap-y-0.5" style={{ color: "var(--pw-text-secondary)" }}>
                    {nextPlayablePuzzle.difficulty && <span>{capitalize(nextPlayablePuzzle.difficulty)}</span>}
                    <span>{nextPlayablePuzzle.isTeamPuzzle ? "Team" : "Solo"}</span>
                    {nextPlayablePuzzle.isBossPuzzle && (
                      <span className="inline-flex items-center gap-1">
                        <Crown aria-hidden="true" size={12} /> Boss
                      </span>
                    )}
                  </p>
                  <div className="mb-3">
                    <RewardChips puzzle={nextPlayablePuzzle} />
                  </div>
                  <GameButton onClick={() => onActivatePuzzle(nextPlayablePuzzle.id)} variant="primary" size="md">
                    {solvedCount === 0 ? "Start campaign" : "Continue campaign"}
                  </GameButton>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-bold mb-1.5" style={{ color: "var(--pw-text-primary)" }}>
                    No challenge is currently available
                  </p>
                  <p className="text-xs" style={{ color: "var(--pw-text-secondary)" }}>
                    Complete the required challenge or review the lock details below.
                  </p>
                </div>
              )}
            </div>
          </div>
        </Card>

        <h2 className="text-xl font-extrabold mb-4" style={{ color: "var(--pw-text-primary)" }}>Campaign Path</h2>

        <div className="max-w-5xl" data-testid="campaign-challenge-path">
          {ordered.map((puzzle, index) => (
            <ChallengeNode
              key={puzzle.id}
              puzzle={puzzle}
              index={index}
              isLast={index === ordered.length - 1}
              status={getChallengeStatus(puzzle, nextPlayablePuzzle?.id ?? null)}
              justCompleted={puzzle.id === justCompletedId}
              onActivate={() => onActivatePuzzle(puzzle.id)}
            />
          ))}
        </div>
      </PageContainer>
    </div>
  );
}
