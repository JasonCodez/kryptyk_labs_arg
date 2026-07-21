"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Search,
  X,
  ListFilter,
  Library,
  Puzzle as PuzzleIcon,
  CircleCheck,
  ArrowRight,
  RefreshCw,
  AlertTriangle,
  Target,
  CircleHelp,
  Calculator,
  Grid3X3,
  MessageSquareText,
  Shuffle,
  LockKeyhole,
  KeyRound,
  DoorOpen,
  SearchCheck,
  ScanSearch,
  ShieldAlert,
  Dna,
  FileLock2,
  EyeOff,
  Code2,
  Globe2,
  BrainCircuit,
  SquarePen,
} from "lucide-react";
import PageContainer from "@/components/ui/PageContainer";
import PressableCard from "@/components/ui/PressableCard";
import { useAppReducedMotion } from "@/hooks/useAppReducedMotion";
import { getPuzzleTypeLabel } from "@/lib/puzzleTypeLabels";

interface HubPuzzle {
  id: string;
  puzzleType?: string;
  isBossPuzzle?: boolean;
  userProgress?: Array<{ solved: boolean }>;
}

interface CampaignSummary {
  puzzleType: string;
  total: number;
  solved: number;
  hasBossPuzzle: boolean;
}

type CampaignState = "in-progress" | "not-started" | "completed";
type StatusFilter = "all" | CampaignState;
type FetchStatus = "loading" | "ready" | "error";

const BACKGROUND_STYLE: CSSProperties = {
  background:
    "radial-gradient(1200px 700px at 15% -10%, color-mix(in srgb, var(--pw-brand-primary) 12%, transparent), transparent 62%), radial-gradient(1000px 650px at 90% 0%, color-mix(in srgb, var(--pw-brand-secondary) 8%, transparent), transparent 58%), var(--pw-bg-base)",
};

const CAMPAIGN_ICONS: Record<string, LucideIcon> = {
  general: Target,
  riddle: CircleHelp,
  math: Calculator,
  jigsaw: PuzzleIcon,
  sudoku: Grid3X3,
  word_search: Search,
  word_crack: MessageSquareText,
  anagram_blitz: Shuffle,
  crack_safe: LockKeyhole,
  vault: KeyRound,
  escape_room: DoorOpen,
  jim_wyze_case: SearchCheck,
  detective_case: ScanSearch,
  crime_rpg: ShieldAlert,
  parasite_code: Dna,
  gridlock_file: FileLock2,
  blackout: EyeOff,
  code_master: Code2,
  arg: Globe2,
  logic_grid: BrainCircuit,
  crossword: SquarePen,
  cipher_clash: KeyRound,
};

function getCampaignIcon(puzzleType: string): LucideIcon {
  return CAMPAIGN_ICONS[puzzleType] ?? PuzzleIcon;
}

// Concise, honest one-sentence descriptions — never claim mechanics (rewards,
// timers, multiplayer, daily availability) the data doesn't guarantee.
const CAMPAIGN_DESCRIPTIONS: Record<string, string> = {
  general: "A mixed set of classic puzzle challenges.",
  riddle: "Untangle wordplay and lateral-thinking riddles.",
  math: "Work through number and logic puzzles.",
  jigsaw: "Piece together visual challenges at your own pace.",
  sudoku: "Fill every row, column, and grid through pure logic.",
  word_search: "Search the grid and uncover every hidden word.",
  word_crack: "Crack hidden words from a shrinking set of clues.",
  anagram_blitz: "Rearrange letters fast to reveal the answer.",
  crack_safe: "Deduce the combination from a trail of clues.",
  vault: "Work through a locked sequence of vault challenges.",
  escape_room: "Solve linked puzzles to escape the room.",
  jim_wyze_case: "Follow the clues through a Jim Wyze investigation.",
  detective_case: "Piece together evidence to solve the case.",
  crime_rpg: "Investigate a case through branching puzzle scenes.",
  parasite_code: "Decode a layered biological cipher sequence.",
  gridlock_file: "Crack layered clue files and unlock the solution.",
  blackout: "Reveal a redacted file one clue at a time.",
  code_master: "Break codes and ciphers under pressure.",
  arg: "Follow an alternate-reality trail across linked clues.",
  logic_grid: "Use pure deduction to fill in the logic grid.",
  crossword: "Fill the grid using crossing clues.",
  cipher_clash: "Break the cipher before it breaks you.",
};

function getCampaignDescription(puzzleType: string): string {
  return CAMPAIGN_DESCRIPTIONS[puzzleType] ?? `A focused series of ${getPuzzleTypeLabel(puzzleType)} challenges.`;
}

function summarize(puzzles: HubPuzzle[]): CampaignSummary[] {
  const byType = new Map<string, HubPuzzle[]>();
  for (const p of puzzles) {
    if (!p.puzzleType) continue;
    const list = byType.get(p.puzzleType);
    if (list) list.push(p);
    else byType.set(p.puzzleType, [p]);
  }

  const summaries: CampaignSummary[] = [];
  for (const [puzzleType, group] of byType) {
    summaries.push({
      puzzleType,
      total: group.length,
      solved: group.filter((p) => p.userProgress?.[0]?.solved).length,
      hasBossPuzzle: group.some((p) => p.isBossPuzzle),
    });
  }
  return summaries;
}

function campaignState(s: CampaignSummary): CampaignState {
  if (s.solved === s.total && s.total > 0) return "completed";
  if (s.solved > 0 && s.solved < s.total) return "in-progress";
  return "not-started";
}

function completionRatio(s: CampaignSummary): number {
  return s.total > 0 ? s.solved / s.total : 0;
}

function byLabel(a: CampaignSummary, b: CampaignSummary): number {
  return getPuzzleTypeLabel(a.puzzleType).localeCompare(getPuzzleTypeLabel(b.puzzleType));
}

/** In-progress first (highest completion, then label), then not-started (label), then completed (label). Never mutates the input. */
function orderCampaigns(list: CampaignSummary[]): CampaignSummary[] {
  const inProgress: CampaignSummary[] = [];
  const notStarted: CampaignSummary[] = [];
  const completed: CampaignSummary[] = [];
  for (const s of list) {
    const state = campaignState(s);
    if (state === "in-progress") inProgress.push(s);
    else if (state === "completed") completed.push(s);
    else notStarted.push(s);
  }
  inProgress.sort((a, b) => completionRatio(b) - completionRatio(a) || byLabel(a, b));
  notStarted.sort(byLabel);
  completed.sort(byLabel);
  return [...inProgress, ...notStarted, ...completed];
}

/** Highest completion %, then highest solved count, then alphabetical label. Deterministic — never random. */
function selectContinueCampaign(summaries: CampaignSummary[]): CampaignSummary | null {
  const inProgress = summaries.filter((s) => campaignState(s) === "in-progress");
  if (inProgress.length === 0) return null;
  return [...inProgress].sort(
    (a, b) => completionRatio(b) - completionRatio(a) || b.solved - a.solved || byLabel(a, b)
  )[0];
}

const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "in-progress", label: "In Progress" },
  { value: "not-started", label: "Not Started" },
  { value: "completed", label: "Completed" },
];

const FOCUS_VISIBLE = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";

function SummaryStat({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: number }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-1 py-3 rounded-xl text-center"
      style={{ background: "var(--pw-surface-2)", border: "1px solid var(--pw-border-subtle)" }}
    >
      <Icon aria-hidden="true" size={18} style={{ color: "var(--pw-brand-primary)" }} />
      <span className="text-lg font-extrabold" style={{ color: "var(--pw-text-primary)" }}>{value}</span>
      <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--pw-text-secondary)" }}>
        {label}
      </span>
    </div>
  );
}

function ContinueSpotlight({
  summary,
  icon: Icon,
  reduceMotion,
}: {
  summary: CampaignSummary;
  icon: LucideIcon;
  reduceMotion: boolean;
}) {
  const label = getPuzzleTypeLabel(summary.puzzleType);
  const pct = summary.total > 0 ? Math.round((summary.solved / summary.total) * 100) : 0;

  return (
    <PressableCard href={`/puzzles/type/${summary.puzzleType}`} accent="primary" padding="lg">
      <div className="flex items-start gap-4" data-testid="continue-campaign">
        <div
          className="inline-flex items-center justify-center w-12 h-12 rounded-xl shrink-0"
          style={{ background: "color-mix(in srgb, var(--pw-brand-primary) 18%, transparent)" }}
        >
          <Icon aria-hidden="true" size={24} strokeWidth={2.25} style={{ color: "var(--pw-brand-primary)" }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--pw-brand-primary)" }}>
            Continue Campaign
          </p>
          <h3 className="text-lg font-extrabold mb-1" style={{ color: "var(--pw-text-primary)" }}>{label}</h3>
          <p className="text-sm mb-3" style={{ color: "var(--pw-text-secondary)" }}>{getCampaignDescription(summary.puzzleType)}</p>
          <div
            role="progressbar"
            aria-label={`${label} progress`}
            aria-valuemin={0}
            aria-valuemax={summary.total}
            aria-valuenow={summary.solved}
            className="h-2 w-full rounded-full overflow-hidden mb-2"
            style={{ background: "color-mix(in srgb, var(--pw-text-secondary) 18%, transparent)" }}
          >
            <div
              className={reduceMotion ? "h-full rounded-full" : "h-full rounded-full transition-all duration-500"}
              style={{ width: `${pct}%`, background: "var(--pw-brand-primary)" }}
            />
          </div>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs font-semibold" style={{ color: "var(--pw-text-secondary)" }}>
              {summary.solved} of {summary.total} cleared &middot; {pct}%
            </span>
            <span className="text-sm font-bold inline-flex items-center gap-1" style={{ color: "var(--pw-brand-primary)" }}>
              Continue <ArrowRight size={14} aria-hidden="true" />
            </span>
          </div>
        </div>
      </div>
    </PressableCard>
  );
}

function CampaignCard({
  summary,
  icon: Icon,
  reduceMotion,
}: {
  summary: CampaignSummary;
  icon: LucideIcon;
  reduceMotion: boolean;
}) {
  const state = campaignState(summary);
  const label = getPuzzleTypeLabel(summary.puzzleType);
  const pct = summary.total > 0 ? Math.round((summary.solved / summary.total) * 100) : 0;

  const cardAccent = state === "completed" ? "success" : state === "in-progress" ? "primary" : "neutral";
  // Visual identity (icon tile + state badge) reads neutral for not-started
  // even though the (invisible, zero-width) progress fill stays primary —
  // a not-started campaign must never visually read as "in progress".
  const identityToken =
    state === "completed" ? "var(--pw-success)" : state === "in-progress" ? "var(--pw-brand-primary)" : "var(--pw-text-secondary)";
  const fillToken = state === "completed" ? "var(--pw-success)" : "var(--pw-brand-primary)";
  const stateLabel = state === "completed" ? "Completed" : state === "in-progress" ? "In Progress" : "Ready";
  const cta = state === "completed" ? "View campaign" : state === "in-progress" ? "Continue" : "Start campaign";

  return (
    <PressableCard href={`/puzzles/type/${summary.puzzleType}`} accent={cardAccent} padding="md">
      <div className="flex items-start justify-between mb-3">
        <div
          className="inline-flex items-center justify-center w-10 h-10 rounded-xl"
          style={{ background: `color-mix(in srgb, ${identityToken} 16%, transparent)` }}
        >
          <Icon aria-hidden="true" size={20} strokeWidth={2.25} style={{ color: identityToken }} />
        </div>
        <div className="flex flex-col items-end gap-1">
          <span
            className="text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded"
            style={{ background: `color-mix(in srgb, ${identityToken} 15%, transparent)`, color: identityToken }}
          >
            {stateLabel}
          </span>
          {summary.hasBossPuzzle && (
            <span
              className="text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded"
              style={{ background: "color-mix(in srgb, var(--pw-brand-accent) 15%, transparent)", color: "var(--pw-brand-accent-light)" }}
            >
              Boss finale
            </span>
          )}
        </div>
      </div>
      <h3 className="text-base font-extrabold mb-1" style={{ color: "var(--pw-text-primary)" }}>{label}</h3>
      <p className="text-sm leading-relaxed mb-3" style={{ color: "var(--pw-text-secondary)" }}>
        {getCampaignDescription(summary.puzzleType)}
      </p>
      <p className="text-xs font-semibold mb-2" style={{ color: "var(--pw-text-secondary)" }}>
        {summary.solved} of {summary.total} cleared
      </p>
      <div
        role="progressbar"
        aria-label={`${label} progress`}
        aria-valuemin={0}
        aria-valuemax={summary.total}
        aria-valuenow={summary.solved}
        className="h-1.5 w-full rounded-full overflow-hidden mb-3"
        style={{ background: "color-mix(in srgb, var(--pw-text-secondary) 15%, transparent)" }}
      >
        <div
          className={reduceMotion ? "h-full rounded-full" : "h-full rounded-full transition-all duration-500"}
          style={{ width: `${pct}%`, background: fillToken }}
        />
      </div>
      <span className="text-sm font-bold inline-flex items-center gap-1" style={{ color: "var(--pw-text-primary)" }}>
        {cta} <ArrowRight size={14} aria-hidden="true" />
      </span>
    </PressableCard>
  );
}

function LoadingSkeleton() {
  return (
    <div style={{ ...BACKGROUND_STYLE, minHeight: "100vh" }} role="status" aria-label="Loading puzzle library">
      <div style={{ paddingTop: "calc(56px + env(safe-area-inset-top, 0px))" }}>
        <PageContainer as="section" size="catalog" className="pt-8 pb-16">
          <div className="h-3 w-32 rounded mb-4" style={{ background: "var(--pw-surface-2)" }} />
          <div className="h-9 w-72 max-w-full rounded mb-4" style={{ background: "var(--pw-surface-2)" }} />
          <div className="h-4 w-full max-w-md rounded mb-8" style={{ background: "var(--pw-surface-2)" }} />
          <div className="grid grid-cols-3 gap-3 mb-8">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 rounded-xl" style={{ background: "var(--pw-surface-2)" }} />
            ))}
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-48 rounded-2xl" style={{ background: "var(--pw-surface-2)" }} />
            ))}
          </div>
        </PageContainer>
      </div>
    </div>
  );
}

export default function PuzzlesHub() {
  const { status: sessionStatus } = useSession();
  const router = useRouter();
  const reduceMotion = useAppReducedMotion();

  const [summaries, setSummaries] = useState<CampaignSummary[]>([]);
  const [fetchStatus, setFetchStatus] = useState<FetchStatus>("loading");
  const [retryToken, setRetryToken] = useState(0);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (sessionStatus === "unauthenticated") {
      router.push("/auth/signin");
      return;
    }
    if (sessionStatus !== "authenticated") return;

    let cancelled = false;

    fetch("/api/puzzles?limit=500")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load puzzle library");
        return res.json();
      })
      .then((data: HubPuzzle[]) => {
        if (cancelled) return;
        setSummaries(summarize(data));
        setFetchStatus("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setFetchStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [sessionStatus, router, retryToken]);

  const continueCampaign = useMemo(() => selectContinueCampaign(summaries), [summaries]);

  const totals = useMemo(
    () => ({
      campaigns: summaries.length,
      puzzles: summaries.reduce((sum, s) => sum + s.total, 0),
      cleared: summaries.reduce((sum, s) => sum + s.solved, 0),
    }),
    [summaries]
  );

  const normalizedQuery = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    return summaries.filter((s) => {
      if (statusFilter !== "all" && campaignState(s) !== statusFilter) return false;
      if (!normalizedQuery) return true;
      const label = getPuzzleTypeLabel(s.puzzleType).toLowerCase();
      const description = getCampaignDescription(s.puzzleType).toLowerCase();
      return label.includes(normalizedQuery) || description.includes(normalizedQuery);
    });
  }, [summaries, statusFilter, normalizedQuery]);

  const ordered = useMemo(() => orderCampaigns(filtered), [filtered]);

  const handleClearFilters = () => {
    setQuery("");
    setStatusFilter("all");
  };

  if (sessionStatus === "loading" || fetchStatus === "loading") {
    return <LoadingSkeleton />;
  }

  return (
    <div style={{ ...BACKGROUND_STYLE, minHeight: "100vh" }}>
      <div style={{ paddingTop: "calc(56px + env(safe-area-inset-top, 0px))" }}>
        <PageContainer as="section" size="catalog" className="pt-8 pb-6">
          <p className="text-xs font-bold tracking-widest mb-3" style={{ color: "var(--pw-brand-primary)" }}>
            PUZZLE LIBRARY
          </p>
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 mb-3">
            <h1 className="text-3xl sm:text-4xl font-extrabold leading-tight" style={{ color: "var(--pw-text-primary)" }}>
              Find your next challenge
            </h1>
            <Link
              href="/puzzles?category=all"
              className={`inline-flex items-center gap-2 text-sm font-bold min-h-[44px] px-1 hover:opacity-80 transition-opacity ${FOCUS_VISIBLE}`}
              style={{ color: "var(--pw-brand-primary)", outlineColor: "var(--pw-focus-ring)" }}
            >
              <ListFilter aria-hidden="true" size={16} />
              Browse individual puzzles
            </Link>
          </div>
          <p className="text-base leading-relaxed max-w-[34rem]" style={{ color: "var(--pw-text-secondary)" }}>
            Explore every PuzzleWarz campaign, continue your progress, or discover something new.
          </p>
        </PageContainer>

        <PageContainer as="section" size="catalog" className="pb-16">
          {fetchStatus === "error" ? (
            <div className="text-center py-20">
              <AlertTriangle aria-hidden="true" size={40} style={{ color: "var(--pw-error)", margin: "0 auto 16px" }} />
              <p className="text-lg font-bold mb-2" style={{ color: "var(--pw-text-primary)" }}>We couldn&apos;t load the puzzle library</p>
              <p className="text-sm mb-6" style={{ color: "var(--pw-text-secondary)" }}>Check your connection and try again.</p>
              <button
                type="button"
                onClick={() => {
                  setFetchStatus("loading");
                  setRetryToken((t) => t + 1);
                }}
                className={`inline-flex items-center justify-center gap-2 min-h-[44px] px-5 rounded-xl text-sm font-bold ${FOCUS_VISIBLE}`}
                style={{ background: "var(--pw-brand-primary)", color: "var(--pw-text-on-primary)", outlineColor: "var(--pw-focus-ring)" }}
              >
                <RefreshCw aria-hidden="true" size={16} />
                Try again
              </button>
            </div>
          ) : summaries.length === 0 ? (
            <div className="text-center py-20">
              <Library aria-hidden="true" size={40} style={{ color: "var(--pw-text-muted)", margin: "0 auto 16px" }} />
              <p className="text-lg font-bold mb-2" style={{ color: "var(--pw-text-primary)" }}>No campaigns available yet</p>
              <p className="text-sm mb-6" style={{ color: "var(--pw-text-secondary)" }}>
                New puzzle campaigns are on the way. Try today&apos;s daily puzzles in the meantime.
              </p>
              <Link
                href="/daily"
                className={`inline-flex items-center justify-center min-h-[44px] px-5 rounded-xl text-sm font-bold ${FOCUS_VISIBLE}`}
                style={{ background: "var(--pw-brand-primary)", color: "var(--pw-text-on-primary)", outlineColor: "var(--pw-focus-ring)" }}
              >
                Play Daily Puzzles
              </Link>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3 mb-8" aria-label="Library progress summary">
                <SummaryStat icon={Library} label="Campaigns" value={totals.campaigns} />
                <SummaryStat icon={PuzzleIcon} label="Puzzles" value={totals.puzzles} />
                <SummaryStat icon={CircleCheck} label="Cleared" value={totals.cleared} />
              </div>

              {continueCampaign && (
                <div className="mb-8">
                  <ContinueSpotlight
                    summary={continueCampaign}
                    icon={getCampaignIcon(continueCampaign.puzzleType)}
                    reduceMotion={reduceMotion}
                  />
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <div className="relative flex-1">
                  <Search
                    aria-hidden="true"
                    size={18}
                    style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--pw-text-muted)" }}
                  />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") setQuery("");
                    }}
                    placeholder="Search campaigns"
                    aria-label="Search campaigns"
                    className={`w-full h-11 rounded-xl pl-11 pr-11 text-sm ${FOCUS_VISIBLE}`}
                    style={{
                      background: "var(--pw-surface-2)",
                      border: "1px solid var(--pw-border-default)",
                      color: "var(--pw-text-primary)",
                      outlineColor: "var(--pw-focus-ring)",
                    }}
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={() => setQuery("")}
                      aria-label="Clear search"
                      className={`absolute inline-flex items-center justify-center rounded-lg ${FOCUS_VISIBLE}`}
                      style={{ right: 4, top: "50%", transform: "translateY(-50%)", width: 40, height: 40, outlineColor: "var(--pw-focus-ring)" }}
                    >
                      <X aria-hidden="true" size={16} style={{ color: "var(--pw-text-secondary)" }} />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-8" role="group" aria-label="Filter campaigns by status">
                {STATUS_FILTERS.map((f) => {
                  const active = statusFilter === f.value;
                  return (
                    <button
                      key={f.value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setStatusFilter(f.value)}
                      className={`px-4 min-h-[44px] rounded-full text-sm font-bold ${FOCUS_VISIBLE}`}
                      style={{
                        background: active ? "var(--pw-brand-primary)" : "var(--pw-surface-2)",
                        color: active ? "var(--pw-text-on-primary)" : "var(--pw-text-secondary)",
                        border: `1px solid ${active ? "var(--pw-brand-primary)" : "var(--pw-border-default)"}`,
                        outlineColor: "var(--pw-focus-ring)",
                      }}
                    >
                      {f.label}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-extrabold" style={{ color: "var(--pw-text-primary)" }}>All Campaigns</h2>
                <p aria-live="polite" className="text-sm font-semibold" style={{ color: "var(--pw-text-secondary)" }}>
                  {ordered.length} {ordered.length === 1 ? "campaign" : "campaigns"}
                </p>
              </div>

              {ordered.length === 0 ? (
                <div className="text-center py-16">
                  <p className="text-lg font-bold mb-2" style={{ color: "var(--pw-text-primary)" }}>No campaigns found</p>
                  <p className="text-sm mb-6" style={{ color: "var(--pw-text-secondary)" }}>Try a different search or clear your filters.</p>
                  <button
                    type="button"
                    onClick={handleClearFilters}
                    className={`inline-flex items-center justify-center min-h-[44px] px-5 rounded-xl text-sm font-bold ${FOCUS_VISIBLE}`}
                    style={{
                      background: "var(--pw-surface-2)",
                      color: "var(--pw-text-primary)",
                      border: "1px solid var(--pw-border-default)",
                      outlineColor: "var(--pw-focus-ring)",
                    }}
                  >
                    Clear filters
                  </button>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6" data-testid="campaign-grid">
                  {ordered.map((s) => (
                    <CampaignCard key={s.puzzleType} summary={s} icon={getCampaignIcon(s.puzzleType)} reduceMotion={reduceMotion} />
                  ))}
                </div>
              )}
            </>
          )}
        </PageContainer>
      </div>
    </div>
  );
}
