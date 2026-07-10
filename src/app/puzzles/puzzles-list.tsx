"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import FilterBar from "@/components/puzzle/FilterBar";
import { StarRating } from "@/components/puzzle/StarRating";
import { detectWebGLSupport } from "@/lib/webglSupport";
import LoadingSpinner from "@/components/LoadingSpinner";
import { getPuzzleTypeLabel } from "@/lib/puzzleTypeLabels";

interface Puzzle {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  rarity?: string;
  order: number;
  pointsReward?: number;
  xpReward?: number;
  createdAt?: string;
  completionCount?: number;
  attemptCount?: number;
  puzzleType?: string;
  escapeRoom?: { id: string; roomTitle?: string; roomDescription?: string } | null;
  // server-reported escape-room history state
  escapeRoomFailed?: boolean;
  escapeRoomFailedReason?: string | null;
  // server-reported detective-case lockout state
  detectiveCaseFailed?: boolean;
  detectiveCaseFailedReason?: string | null;
  category: {
    id: string;
    name: string;
  };
  userProgress?: Array<{
    id: string;
    solved: boolean;
    attempts: number;
    totalTimeSpent?: number | null;
  }>;
  isTeamPuzzle?: boolean;
  // locally-annotated fields
  failed?: boolean;
  failedReason?: string | null;
  averageRating?: number;
  ratingCount?: number;
}

interface Category {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  puzzleCount: number;
}

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: "#10B981",
  medium: "#F59E0B",
  hard: "#EF4444",
  extreme: "#3891A6",
};

const CATEGORY_ICONS: Record<string, string> = {
  // Seeded categories
  escape: "🚪",
  mystery: "🕵️‍♂️",
  // Admin-form categories
  general: "🎯",
  sudoku: "🔢",
  arg: "🌐",
  jigsaw: "🧩",
  puzzle: "🎲",
  challenge: "🏆",
  word_crack: "💬",
  gridlock_file: "🔐",
  word_search: "🔍",
  crossword: "✏️",
  anagram_blitz: "🔀",
  code_master: "💻",
  crack_safe: "🔒",
  detective_case: "🕵️",
  jim_wyze_case: "🕵️",
  logic_grid: "🧠",
  // Generic fallbacks
  logic: "🧠",
  crypto: "🔐",
  word: "🔤",
  riddle: "❓",
  math: "➗",
  spatial: "📐",
  pattern: "🔁",
  memory: "💭",
  adventure: "🗺️",
  stealth: "🕶️",
};

function formatCategoryName(name: string): string {
  return name
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function getDisplayTitle(puzzle: Puzzle & { name?: unknown; summary?: unknown; content?: unknown }) {
  const puzzleTitle = typeof puzzle?.title === 'string' ? puzzle.title.trim() : '';
  const escapeTitle = typeof puzzle?.escapeRoom?.roomTitle === 'string' ? puzzle.escapeRoom.roomTitle.trim() : '';

  // Escape rooms should display their roomTitle even if the Puzzle row has a default fallback title.
  if ((puzzle?.puzzleType === 'escape_room' || puzzle?.puzzleType === 'jim_wyze_case') && escapeTitle) return escapeTitle;
  if ((puzzleTitle === '' || puzzleTitle === 'Untitled Puzzle') && escapeTitle) return escapeTitle;

  const raw = (puzzle && (puzzle.title ?? puzzle.name ?? puzzle?.escapeRoom?.roomTitle)) as unknown;
  const title = typeof raw === 'string' ? raw.trim() : '';
  return title || 'Untitled Puzzle';
}

function getDisplayDescription(puzzle: Puzzle & { name?: unknown; summary?: unknown; content?: unknown }): string {
  const raw = (puzzle && (puzzle.description ?? puzzle.summary ?? puzzle.content ?? puzzle?.escapeRoom?.roomDescription)) as unknown;
  const desc = typeof raw === 'string' ? raw.trim() : '';
  return desc;
}

function formatFailedReason(reason: string | null | undefined) {
  if (!reason) return null;
  if (reason === 'time_limit') return 'Time limit reached';
  if (reason === 'time_expired') return 'Time expired';
  if (reason === 'max_attempts') return 'Maximum submissions reached';
  if (reason === 'given_up') return 'Gave up';
  if (reason === 'incorrect_submission') return 'Wrong answer (case locked)';
  return 'Failed';
}

interface PuzzleCardProps {
  puzzle: Puzzle;
  totalUsers: number;
  onDescriptionExpand: (p: Puzzle) => void;
  onCardClick: (p: Puzzle) => void;
}

function GridPuzzleCard({ puzzle, totalUsers, onDescriptionExpand, onCardClick }: PuzzleCardProps) {
  const progress = puzzle.userProgress?.[0];
  const status = progress?.solved
    ? "solved"
    : puzzle.failed
    ? "failed"
    : progress?.attempts
    ? "in-progress"
    : "unsolved";
  const statusConfig: Record<string, { color: string; label: string }> = {
    solved: { color: "#38D399", label: "✓ Solved" },
    "in-progress": { color: "#FDE74C", label: "~ In Progress" },
    failed: { color: "#EF4444", label: "✗ Failed" },
    unsolved: { color: "#AB9F9D", label: "○ Unsolved" },
  };

  if (status === 'solved') {
    return (
      <Link
        id={`puzzle-${puzzle.id}`}
        href={`/puzzles/${puzzle.id}`}
        className="group rounded-lg border p-6 transition-all duration-300"
        style={{
          backgroundColor: 'rgba(56, 145, 166, 0.08)',
          borderColor: '#3891A6',
          borderWidth: '1px',
          opacity: 0.6,
          cursor: 'not-allowed'
        }}
      >
        <div className="mb-4">
          <div className="flex justify-between items-start mb-2">
            <h3 className="text-xl font-bold text-white flex-1">{getDisplayTitle(puzzle)}</h3>
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold px-2 py-1 rounded-full" style={{ backgroundColor: puzzle.isTeamPuzzle ? 'rgba(124,58,237,0.12)' : 'rgba(56,201,153,0.12)', color: puzzle.isTeamPuzzle ? '#7C3AED' : '#38D399' }}>
                {puzzle.isTeamPuzzle ? 'Team' : 'Solo'}
              </span>
              <div className="flex gap-2 flex-col items-end">
              {puzzle.order && puzzle.order > 0 ? (
                <span className="text-xs font-semibold px-2 py-1 rounded" style={{ backgroundColor: '#FDE74C', color: '#020202' }}>
                  #{puzzle.order}
                </span>
              ) : null}
              </div>
            </div>
          </div>
          <p className="text-xs font-semibold" style={{ color: '#AB9F9D' }}>✓ Puzzle Complete</p>
        </div>
        {getDisplayDescription(puzzle) && (<div className="mb-3">
          <p className="text-sm line-clamp-3" style={{ color: '#DDDBF1' }}>{getDisplayDescription(puzzle)}</p>
          {getDisplayDescription(puzzle).length > 120 && (
            <button type="button" onClick={(e) => { e.stopPropagation(); onDescriptionExpand(puzzle); }} className="text-xs mt-1 font-medium hover:underline" style={{ color: '#3891A6' }}>Read more →</button>
          )}
        </div>)}
        <div className="flex gap-2 flex-wrap mb-2">
          <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: 'rgba(253, 231, 76, 0.2)', color: '#FDE74C' }}>
            {puzzle.category?.name || 'General'}
          </span>
          <span className="text-xs px-2 py-1 rounded capitalize font-medium" style={{ backgroundColor: `${DIFFICULTY_COLORS[puzzle.difficulty]}20`, color: DIFFICULTY_COLORS[puzzle.difficulty] }}>
            {puzzle.difficulty.charAt(0) + puzzle.difficulty.slice(1).toLowerCase()}
          </span>
          <span className="text-xs px-2 py-1 rounded font-medium" style={{ backgroundColor: `${statusConfig[status].color}20`, color: statusConfig[status].color }}>
            {statusConfig[status].label}
          </span>
        </div>
        <div className="mb-2">
          <StarRating
            rating={puzzle.averageRating ?? 0}
            size="sm"
            ratingCount={puzzle.ratingCount}
            showText={(puzzle.averageRating ?? 0) > 0}
          />
          {(!puzzle.averageRating || puzzle.averageRating === 0) && (
            <p style={{ color: '#AB9F9D' }} className="text-xs mt-1">No ratings yet</p>
          )}
        </div>
          {puzzle.pointsReward && (
          <div style={{ color: '#FDE74C' }} className="text-xs font-semibold mb-2">
            ⭐ {puzzle.pointsReward} points
          </div>
        )}
        {(puzzle.userProgress?.[0]?.totalTimeSpent ?? 0) > 0 && (
          <div className="text-xs mt-2" style={{ color: '#AB9F9D' }}>
            Completed in <span style={{ color: '#FDE74C', fontWeight: 700 }}>{Math.floor((puzzle.userProgress![0].totalTimeSpent!)/60).toString().padStart(2,'0')}:{((puzzle.userProgress![0].totalTimeSpent!)%60).toString().padStart(2,'0')}</span>
          </div>
        )}
      </Link>
    );
  }

  if (status === 'failed') {
    return (
      <div
        id={`puzzle-${puzzle.id}`}
        className="group rounded-xl border p-4 sm:p-6 transition-all duration-300"
        style={{
          backgroundColor: 'rgba(239, 68, 68, 0.05)',
          borderColor: 'rgba(239,68,68,0.35)',
          borderWidth: '1px',
          opacity: 0.65,
          cursor: 'not-allowed'
        }}
      >
        <div className="mb-4">
          <div className="flex justify-between items-start mb-2">
            <h3 className="text-xl font-bold text-white flex-1">{getDisplayTitle(puzzle)}</h3>
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold px-2 py-1 rounded-full" style={{ backgroundColor: puzzle.isTeamPuzzle ? 'rgba(124,58,237,0.12)' : 'rgba(56,201,153,0.12)', color: puzzle.isTeamPuzzle ? '#7C3AED' : '#38D399' }}>
                {puzzle.isTeamPuzzle ? 'Team' : 'Solo'}
              </span>
              <div className="flex gap-2 flex-col items-end">
                {puzzle.order && puzzle.order > 0 ? (
                  <span className="text-xs font-semibold px-2 py-1 rounded" style={{ backgroundColor: '#FDE74C', color: '#020202' }}>
                    #{puzzle.order}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
          <p className="text-xs font-semibold" style={{ color: '#AB9F9D' }}>✗ Puzzle Failed</p>
          {puzzle.failedReason && (
            <p className="text-sm mt-1" style={{ color: '#FFB4B4' }}>
              Reason: {formatFailedReason(puzzle.failedReason) || 'Failed'}
            </p>
          )}
        </div>
        {getDisplayDescription(puzzle) && (<div className="mb-3">
          <p className="text-sm line-clamp-3" style={{ color: '#DDDBF1' }}>{getDisplayDescription(puzzle)}</p>
          {getDisplayDescription(puzzle).length > 120 && (
            <button type="button" onClick={(e) => { e.stopPropagation(); onDescriptionExpand(puzzle); }} className="text-xs mt-1 font-medium hover:underline" style={{ color: '#3891A6' }}>Read more →</button>
          )}
        </div>)}
        <div className="flex gap-2 flex-wrap mb-2">
          <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: 'rgba(253, 231, 76, 0.2)', color: '#FDE74C' }}>
            {puzzle.category?.name || 'General'}
          </span>
          <span className="text-xs px-2 py-1 rounded capitalize font-medium" style={{ backgroundColor: `${DIFFICULTY_COLORS[puzzle.difficulty]}20`, color: DIFFICULTY_COLORS[puzzle.difficulty] }}>
            {puzzle.difficulty.charAt(0) + puzzle.difficulty.slice(1).toLowerCase()}
          </span>
          <span className="text-xs px-2 py-1 rounded font-medium" style={{ backgroundColor: `${statusConfig[status].color}20`, color: statusConfig[status].color }}>
            {statusConfig[status].label}
          </span>
        </div>
        {(puzzle.xpReward || puzzle.pointsReward) && (
          <div className="flex items-center gap-3 text-xs font-semibold mb-2">
            {puzzle.xpReward ? <span style={{ color: '#FDE74C' }}>✦ {puzzle.xpReward} XP</span> : null}
            {puzzle.pointsReward ? <span style={{ color: '#38D399' }}>⭐ {puzzle.pointsReward} pts</span> : null}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      id={`puzzle-${puzzle.id}`}
      role="button"
      onClick={() => onCardClick(puzzle)}
      className="group rounded-xl border p-4 sm:p-6 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg"
      style={{
        backgroundColor: 'rgba(56, 145, 166, 0.06)',
        borderColor: 'rgba(56,145,166,0.28)',
        borderWidth: '1px',
        cursor: 'pointer',
        boxShadow: '0 0 0 0 transparent',
        transition: 'transform 0.2s, box-shadow 0.2s, border-color 0.2s',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#3891A6'; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 24px rgba(56,145,166,0.15)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(56,145,166,0.28)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 0 transparent'; }}
    >
      <div className="mb-4">
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-xl font-bold text-white flex-1">{getDisplayTitle(puzzle)}</h3>
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold px-2 py-1 rounded-full" style={{ backgroundColor: puzzle.isTeamPuzzle ? 'rgba(124,58,237,0.12)' : 'rgba(56,201,153,0.12)', color: puzzle.isTeamPuzzle ? '#7C3AED' : '#38D399' }}>
              {puzzle.isTeamPuzzle ? 'Team' : 'Solo'}
            </span>
            <div className="flex gap-2 flex-col items-end">
              {puzzle.order && puzzle.order > 0 ? (
                <span className="text-xs font-semibold px-2 py-1 rounded" style={{ backgroundColor: '#FDE74C', color: '#020202' }}>
                  #{puzzle.order}
                </span>
              ) : null}
            </div>
          </div>
        </div>
        {getDisplayDescription(puzzle) && (<div className="mb-3">
          <p className="text-sm line-clamp-3" style={{ color: '#DDDBF1' }}>{getDisplayDescription(puzzle)}</p>
          {getDisplayDescription(puzzle).length > 120 && (
            <button type="button" onClick={(e) => { e.stopPropagation(); onDescriptionExpand(puzzle); }} className="text-xs mt-1 font-medium hover:underline" style={{ color: '#3891A6' }}>Read more →</button>
          )}
        </div>)}
        <div className="flex gap-2 flex-wrap mb-2">
          <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: 'rgba(253, 231, 76, 0.2)', color: '#FDE74C' }}>
            {puzzle.category?.name || 'General'}
          </span>
          <span className="text-xs px-2 py-1 rounded capitalize font-medium" style={{ backgroundColor: `${DIFFICULTY_COLORS[puzzle.difficulty]}20`, color: DIFFICULTY_COLORS[puzzle.difficulty] }}>
            {puzzle.difficulty.charAt(0) + puzzle.difficulty.slice(1).toLowerCase()}
          </span>
          <span className="text-xs px-2 py-1 rounded font-medium" style={{ backgroundColor: `${statusConfig[status].color}20`, color: statusConfig[status].color }}>
            {statusConfig[status].label}
          </span>
        </div>
        <div className="mb-2">
          <StarRating
            rating={puzzle.averageRating ?? 0}
            size="sm"
            ratingCount={puzzle.ratingCount}
            showText={(puzzle.averageRating ?? 0) > 0}
          />
          {(!puzzle.averageRating || puzzle.averageRating === 0) && (
            <p style={{ color: '#AB9F9D' }} className="text-xs mt-1">No ratings yet</p>
          )}
        </div>
        {(puzzle.xpReward || puzzle.pointsReward) && (
          <div className="flex items-center gap-3 text-xs font-semibold mb-2">
            {puzzle.xpReward ? <span style={{ color: '#FDE74C' }}>✦ {puzzle.xpReward} XP</span> : null}
            {puzzle.pointsReward ? <span style={{ color: '#38D399' }}>⭐ {puzzle.pointsReward} pts</span> : null}
          </div>
        )}
      </div>
      <div className="mt-4 pt-4 space-y-2" style={{ borderTopColor: 'rgba(56, 145, 166, 0.2)', borderTopWidth: '1px' }}>
        <span className="text-sm font-semibold transition-all block" style={{ color: '#3891A6' }}>
          Solve Now →
        </span>
        <div className="space-y-1 text-xs">
          <div style={{ color: '#DDDBF1' }}>
            <span className="font-semibold" style={{ color: '#FDE74C' }}>
              {totalUsers > 0 ? Math.round((puzzle.attemptCount || 0) / totalUsers * 100) : 0}%
            </span>
            {' have attempted'}
          </div>
          <div style={{ color: '#DDDBF1' }}>
            <span className="font-semibold" style={{ color: '#38D399' }}>
              {(puzzle.attemptCount || 0) > 0 ? Math.round((puzzle.completionCount || 0) / (puzzle.attemptCount || 1) * 100) : 0}%
            </span>
            {' of attempted completed'}
          </div>
        </div>
      </div>
    </div>
  );
}

function ListPuzzleCard({ puzzle, totalUsers, onDescriptionExpand, onCardClick }: PuzzleCardProps) {
  const progress = puzzle.userProgress?.[0];
  const status = progress?.solved ? "solved" : puzzle.failed ? "failed" : progress?.attempts ? "in-progress" : "unsolved";
  const statusConfig: Record<string, { color: string; label: string }> = {
    solved: { color: "#38D399", label: "✓ Solved" },
    "in-progress": { color: "#FDE74C", label: "~ In Progress" },
    unsolved: { color: "#AB9F9D", label: "○ Unsolved" },
  };

  if (status === 'failed') {
    return (
      <div
        id={`puzzle-${puzzle.id}`}
        className="group rounded-xl border p-4 transition-all duration-300 block"
        style={{
          backgroundColor: 'rgba(239, 68, 68, 0.05)',
          borderColor: 'rgba(239,68,68,0.35)',
          borderWidth: '1px',
          opacity: 0.7,
          cursor: 'not-allowed'
        }}
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              {puzzle.order && puzzle.order > 0 ? (
                <span className="text-xs font-semibold px-2 py-1 rounded whitespace-nowrap" style={{ backgroundColor: '#FDE74C', color: '#020202' }}>
                  #{puzzle.order}
                </span>
              ) : null}
              <h3 className="text-lg font-bold text-white truncate">{getDisplayTitle(puzzle)}</h3>
              <span className="text-xs font-semibold px-2 py-1 rounded-full" style={{ backgroundColor: puzzle.isTeamPuzzle ? 'rgba(124,58,237,0.12)' : 'rgba(56,201,153,0.12)', color: puzzle.isTeamPuzzle ? '#7C3AED' : '#38D399' }}>
                {puzzle.isTeamPuzzle ? 'Team' : 'Solo'}
              </span>
              <span className="text-xs font-semibold px-2 py-1 rounded whitespace-nowrap" style={{ backgroundColor: 'rgba(239, 68, 68, 0.12)', color: '#EF4444' }}>
                ✗ Failed
              </span>
            </div>
            {getDisplayDescription(puzzle) && (<div className="mb-2">
              <p className="text-sm line-clamp-2" style={{ color: '#DDDBF1' }}>{getDisplayDescription(puzzle)}</p>
              {getDisplayDescription(puzzle).length > 120 && (
                <button type="button" onClick={(e) => { e.stopPropagation(); onDescriptionExpand(puzzle); }} className="text-xs mt-1 font-medium hover:underline" style={{ color: '#3891A6' }}>Read more →</button>
              )}
            </div>)}
            {puzzle.failedReason && (
                <p className="text-sm mt-1" style={{ color: '#FFB4B4' }}>
                  Reason: {formatFailedReason(puzzle.failedReason) || 'Failed'}
                </p>
              )}
          </div>
          <div style={{ color: '#AB9F9D' }} className="text-lg font-semibold flex-shrink-0">
            -
          </div>
        </div>
      </div>
    );
  }

  if (status === 'solved') {
    return (
      <div
        id={`puzzle-${puzzle.id}`}
        className="group rounded-xl border p-4 transition-all duration-300 block"
        style={{
          backgroundColor: 'rgba(56, 145, 166, 0.05)',
          borderColor: 'rgba(56,145,166,0.25)',
          borderWidth: '1px',
          opacity: 0.62,
          cursor: 'not-allowed'
        }}
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              {puzzle.order && puzzle.order > 0 ? (
                <span className="text-xs font-semibold px-2 py-1 rounded whitespace-nowrap" style={{ backgroundColor: '#FDE74C', color: '#020202' }}>
                  #{puzzle.order}
                </span>
              ) : null}
              <h3 className="text-lg font-bold text-white truncate">{getDisplayTitle(puzzle)}</h3>
              <span className="text-xs font-semibold px-2 py-1 rounded-full" style={{ backgroundColor: puzzle.isTeamPuzzle ? 'rgba(124,58,237,0.12)' : 'rgba(56,201,153,0.12)', color: puzzle.isTeamPuzzle ? '#7C3AED' : '#38D399' }}>
                {puzzle.isTeamPuzzle ? 'Team' : 'Solo'}
              </span>
              <span className="text-xs font-semibold px-2 py-1 rounded whitespace-nowrap" style={{ backgroundColor: 'rgba(56, 201, 153, 0.2)', color: '#38D399' }}>
                ✓ Complete
              </span>
            </div>
            {getDisplayDescription(puzzle) && (<div className="mb-2">
              <p className="text-sm line-clamp-2" style={{ color: '#DDDBF1' }}>{getDisplayDescription(puzzle)}</p>
              {getDisplayDescription(puzzle).length > 120 && (
                <button type="button" onClick={(e) => { e.stopPropagation(); onDescriptionExpand(puzzle); }} className="text-xs mt-1 font-medium hover:underline" style={{ color: '#3891A6' }}>Read more →</button>
              )}
            </div>)}
            <div className="flex flex-wrap gap-2 mb-2">
              <span className="text-xs px-2 py-1 rounded whitespace-nowrap" style={{ backgroundColor: 'rgba(253, 231, 76, 0.2)', color: '#FDE74C' }}>
                {puzzle.category?.name || 'General'}
              </span>
              <span className="text-xs px-2 py-1 rounded capitalize font-medium whitespace-nowrap" style={{ backgroundColor: `${DIFFICULTY_COLORS[puzzle.difficulty]}20`, color: DIFFICULTY_COLORS[puzzle.difficulty] }}>
                {puzzle.difficulty.charAt(0) + puzzle.difficulty.slice(1).toLowerCase()}
              </span>
              <span className="text-xs px-2 py-1 rounded font-medium whitespace-nowrap" style={{ backgroundColor: `${statusConfig[status].color}20`, color: statusConfig[status].color }}>
                {statusConfig[status].label}
              </span>
              {puzzle.xpReward ? (
                <span className="text-xs px-2 py-1 rounded whitespace-nowrap" style={{ backgroundColor: 'rgba(253,231,76,0.12)', color: '#FDE74C', border: '1px solid rgba(253,231,76,0.25)' }}>
                  ✦ {puzzle.xpReward} XP
                </span>
              ) : null}
              {puzzle.pointsReward ? (
                <span className="text-xs px-2 py-1 rounded whitespace-nowrap" style={{ backgroundColor: 'rgba(56,201,153,0.12)', color: '#38D399', border: '1px solid rgba(56,201,153,0.25)' }}>
                  ⭐ {puzzle.pointsReward} pts
                </span>
              ) : null}
            </div>
            <div className="mb-2">
              <StarRating
                rating={puzzle.averageRating ?? 0}
                size="sm"
                ratingCount={puzzle.ratingCount}
                showText={(puzzle.averageRating ?? 0) > 0}
              />
              {(!puzzle.averageRating || puzzle.averageRating === 0) && (
                <p style={{ color: '#AB9F9D' }} className="text-xs mt-1">No ratings yet</p>
              )}
            </div>
            <div className="text-xs mt-2 space-y-1" style={{ color: '#DDDBF1' }}>
              <div>
                <span className="font-semibold" style={{ color: '#FDE74C' }}>
                  {totalUsers > 0 ? Math.round((puzzle.attemptCount || 0) / totalUsers * 100) : 0}%
                </span>
                {' have attempted'}
              </div>
              <div>
                <span className="font-semibold" style={{ color: '#38D399' }}>
                  {(puzzle.attemptCount || 0) > 0 ? Math.round((puzzle.completionCount || 0) / (puzzle.attemptCount || 1) * 100) : 0}%
                </span>
                {' of attempted completed'}
              </div>
            </div>
            {(puzzle.userProgress?.[0]?.totalTimeSpent ?? 0) > 0 && (
              <div className="text-xs mt-2" style={{ color: '#AB9F9D' }}>
                Completed in <span style={{ color: '#FDE74C', fontWeight: 700 }}>{Math.floor((puzzle.userProgress![0].totalTimeSpent!)/60).toString().padStart(2,'0')}:{((puzzle.userProgress![0].totalTimeSpent!)%60).toString().padStart(2,'0')}</span>
              </div>
            )}
          </div>
          <div style={{ color: '#AB9F9D' }} className="text-lg font-semibold flex-shrink-0">
            -
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      id={`puzzle-${puzzle.id}`}
      role="button"
      onClick={() => onCardClick(puzzle)}
      className="group rounded-xl border p-4 transition-all duration-300 hover:translate-x-1 block"
      style={{
        backgroundColor: 'rgba(56, 145, 166, 0.06)',
        borderColor: 'rgba(56,145,166,0.28)',
        borderWidth: '1px',
        cursor: 'pointer'
      }}
    >
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            {puzzle.order && puzzle.order > 0 ? (
              <span className="text-xs font-semibold px-2 py-1 rounded whitespace-nowrap" style={{ backgroundColor: '#FDE74C', color: '#020202' }}>
                #{puzzle.order}
              </span>
            ) : null}
            <h3 className="text-lg font-bold text-white truncate">{getDisplayTitle(puzzle)}</h3>
            <span className="text-xs font-semibold px-2 py-1 rounded-full" style={{ backgroundColor: puzzle.isTeamPuzzle ? 'rgba(124,58,237,0.12)' : 'rgba(56,201,153,0.12)', color: puzzle.isTeamPuzzle ? '#7C3AED' : '#38D399' }}>
              {puzzle.isTeamPuzzle ? 'Team' : 'Solo'}
            </span>
          </div>
          {getDisplayDescription(puzzle) && (<div className="mb-2">
            <p className="text-sm line-clamp-2" style={{ color: '#DDDBF1' }}>{getDisplayDescription(puzzle)}</p>
            {getDisplayDescription(puzzle).length > 120 && (
              <button type="button" onClick={(e) => { e.stopPropagation(); onDescriptionExpand(puzzle); }} className="text-xs mt-1 font-medium hover:underline" style={{ color: '#3891A6' }}>Read more →</button>
            )}
          </div>)}
          <div className="flex flex-wrap gap-2 mb-2">
            <span className="text-xs px-2 py-1 rounded whitespace-nowrap" style={{ backgroundColor: 'rgba(253, 231, 76, 0.2)', color: '#FDE74C' }}>
              {puzzle.category?.name || 'General'}
            </span>
            <span className="text-xs px-2 py-1 rounded capitalize font-medium whitespace-nowrap" style={{ backgroundColor: `${DIFFICULTY_COLORS[puzzle.difficulty]}20`, color: DIFFICULTY_COLORS[puzzle.difficulty] }}>
              {puzzle.difficulty.charAt(0) + puzzle.difficulty.slice(1).toLowerCase()}
            </span>
            <span className="text-xs px-2 py-1 rounded font-medium whitespace-nowrap" style={{ backgroundColor: `${statusConfig[status].color}20`, color: statusConfig[status].color }}>
              {statusConfig[status].label}
            </span>
            {puzzle.pointsReward && (
              <span className="text-xs px-2 py-1 rounded whitespace-nowrap" style={{ backgroundColor: 'rgba(253, 231, 76, 0.2)', color: '#FDE74C' }}>
                ⭐ {puzzle.pointsReward} points
              </span>
            )}
          </div>
          <div className="mb-2">
            <StarRating
              rating={puzzle.averageRating ?? 0}
              size="sm"
              ratingCount={puzzle.ratingCount}
              showText={(puzzle.averageRating ?? 0) > 0}
            />
            {(!puzzle.averageRating || puzzle.averageRating === 0) && (
              <p style={{ color: '#AB9F9D' }} className="text-xs mt-1">No ratings yet</p>
            )}
          </div>
          <div className="text-xs mt-2" style={{ color: '#DDDBF1' }}>
            <span className="font-semibold" style={{ color: '#FDE74C' }}>
              {totalUsers > 0 ? Math.round((puzzle.completionCount || 0) / totalUsers * 100) : 0}%
            </span>
            {' of users have completed'}
          </div>
        </div>
        <div style={{ color: '#3891A6' }} className="text-lg font-semibold flex-shrink-0">
          →
        </div>
      </div>
    </div>
  );
}

export default function PuzzlesList({ initialCategory = "all" }: { initialCategory?: string }) {
  const { status } = useSession();
  const router = useRouter();
  const [puzzles, setPuzzles] = useState<Puzzle[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [filteredPuzzles, setFilteredPuzzles] = useState<Puzzle[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("unsolved");
  const [sortBy, setSortBy] = useState<string>("order");
  const [sortOrder, setSortOrder] = useState<string>("asc");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [totalUsers, setTotalUsers] = useState(0);
  
  const [focusedPuzzleId, setFocusedPuzzleId] = useState<string | null>(null);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [teamModalMessage, setTeamModalMessage] = useState("");
  const [teamModalTitle, setTeamModalTitle] = useState("Notice");
  const [teamModalConfirmText, setTeamModalConfirmText] = useState<string>("OK");
  const [teamModalCancelText, setTeamModalCancelText] = useState<string | null>(null);
  const [teamModalConfirmAction, setTeamModalConfirmAction] = useState<(() => void) | null>(null);
  const [descriptionModal, setDescriptionModal] = useState<Puzzle | null>(null);

  useEffect(function() {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
      return;
    }

    if (status === "authenticated") {
      fetchData();
    }
  }, [status, router]);

  // When arriving via hash (#puzzle-<id>), focus that puzzle card
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash || "";
    if (hash.startsWith("#puzzle-")) {
      const id = hash.replace("#puzzle-", "");
      if (id) {
        setFocusedPuzzleId(id);
        // Allow render to complete then scroll + highlight
        setTimeout(() => {
          const el = document.getElementById(`puzzle-${id}`);
          if (el) {
            try {
              el.scrollIntoView({ behavior: "smooth", block: "center" });
              el.classList.add("ring-4", "ring-yellow-400");
              // remove highlight after 3s
              setTimeout(() => {
                el.classList.remove("ring-4", "ring-yellow-400");
              }, 3000);
            } catch {
              // ignore
            }
          }
        }, 300);
      }
    }
  }, []);

  // Also respond to future hash changes (client-side navigation without remount)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleHash = () => {
      const hash = window.location.hash || "";
      if (hash.startsWith("#puzzle-")) {
        const id = hash.replace("#puzzle-", "");
        if (id) {
          setFocusedPuzzleId(id);
          // Allow render to complete then scroll + highlight
          setTimeout(() => {
            const el = document.getElementById(`puzzle-${id}`);
            if (el) {
              try {
                el.scrollIntoView({ behavior: "smooth", block: "center" });
                el.classList.add("ring-4", "ring-yellow-400");
                setTimeout(() => {
                  el.classList.remove("ring-4", "ring-yellow-400");
                }, 3000);
              } catch {
                // ignore
              }
            }
          }, 100);
        }
      } else {
        setFocusedPuzzleId(null);
      }
    };

    // run once and subscribe to future hash changes
    handleHash();
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, []);

  useEffect(() => {
    applyFilters();
    // applyFilters is a plain function redefined every render, but every value it reads is
    // already listed below — adding the function itself would just re-run this on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puzzles, selectedCategory, selectedDifficulty, selectedStatus, searchQuery, sortBy, sortOrder]);

  // Which puzzles to display: either focus a single puzzle (via hash) or the filtered list
  const displayed = focusedPuzzleId ? puzzles.filter((p) => p.id === focusedPuzzleId) : filteredPuzzles;

  async function fetchData() {
    try {
      const [puzzlesRes, categoriesRes, usersRes] = await Promise.all([
        fetch(`/api/puzzles?limit=500`),
        fetch("/api/puzzle-categories"),
        fetch("/api/users/count"),
      ]);

      if (puzzlesRes.ok) {
        const puzzlesData = await puzzlesRes.json();
        // Annotate puzzles with lockout state for puzzle types that remain permanently locked on failure.
        const annotated = puzzlesData.map((p: Puzzle) => {
          const detectiveCaseFailed = p?.detectiveCaseFailed === true;
          const baseFailedFlag = detectiveCaseFailed;
          const baseFailedReason: string | null = detectiveCaseFailed
            ? (p?.detectiveCaseFailedReason ?? 'incorrect_submission')
            : null;
          const failedFlag = baseFailedFlag;
          const failedReason: string | null = baseFailedReason;
          return { ...p, failed: failedFlag, failedReason };
        });
        setPuzzles(annotated);
        
        // Ratings are now included in the puzzle list response — no separate fetch needed
      }

      if (categoriesRes.ok) {
        const categoriesData = await categoriesRes.json();
        const filteredCategories = (categoriesData || []).filter((c: Category) => {
          const name = (c && c.name) ? String(c.name).toLowerCase().trim() : "";
          return name !== "team test" && (c.puzzleCount ?? 0) > 0;
        });
        setCategories(filteredCategories);
      }

      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setTotalUsers(usersData.count || 0);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  }

  async function launchTeamPuzzle(puzzle: Puzzle) {
    try {
      const response = await fetch(`/api/user/team-admin?puzzleId=${encodeURIComponent(puzzle.id)}`);

      if (response.status === 401) {
        router.push('/auth/signin');
        return;
      }

      const teamInfo = (await response.json().catch(() => null)) as {
        isMember?: boolean;
        teamId?: string | null;
        error?: string;
      } | null;

      if (!response.ok) {
        throw new Error(teamInfo?.error || response.statusText || 'Failed to verify team access.');
      }

      if (!teamInfo?.isMember || !teamInfo?.teamId) {
        setTeamModalTitle('Team Required');
        setTeamModalConfirmText('Go to Teams');
        setTeamModalCancelText('Cancel');
        setTeamModalConfirmAction(() => {
          return () => {
            router.push('/teams');
          };
        });
        setTeamModalMessage('This puzzle requires a team. Join or create a team first, then launch it from your team lobby.');
        setShowTeamModal(true);
        return;
      }

      router.push(`/teams/${teamInfo.teamId}/lobby?puzzleId=${encodeURIComponent(puzzle.id)}`);
    } catch (error) {
      console.error('Failed to launch team puzzle:', error);
      setTeamModalTitle('Unable to Launch');
      setTeamModalConfirmText('OK');
      setTeamModalCancelText(null);
      setTeamModalConfirmAction(null);
      setTeamModalMessage("We couldn't launch this team puzzle right now. Please try again.");
      setShowTeamModal(true);
    }
  }

  async function handlePuzzleClick(puzzle: Puzzle, opts?: { skipWebGLCheck?: boolean }) {
    const isEscapeRoom = puzzle?.puzzleType === 'escape_room' || !!puzzle?.escapeRoom;

    if (isEscapeRoom && !opts?.skipWebGLCheck) {
      const webgl = detectWebGLSupport();
      if (!webgl.available) {
        setTeamModalTitle('WebGL Unavailable');
        setTeamModalMessage(
          "Your browser doesn't currently have WebGL enabled/available. The escape room may run in compatibility mode (reduced visuals/performance). Continue anyway?"
        );
        setTeamModalConfirmText('Continue');
        setTeamModalCancelText('Cancel');
        setTeamModalConfirmAction(() => {
          return () => {
            void handlePuzzleClick(puzzle, { skipWebGLCheck: true });
          };
        });
        setShowTeamModal(true);
        return;
      }
    }

    const isDetectiveCase = puzzle?.puzzleType === 'detective_case';
    if (isDetectiveCase && puzzle.detectiveCaseFailed) {
      setTeamModalTitle('Locked');
      setTeamModalConfirmText('OK');
      setTeamModalCancelText(null);
      setTeamModalConfirmAction(null);
      setTeamModalMessage("You already made an incorrect submission on this case. It is locked forever and cannot be retried.");
      setShowTeamModal(true);
      return;
    }

    if (puzzle?.puzzleType === 'jim_wyze_case') {
      router.push(`/puzzles/${puzzle.id}`);
      return;
    }

    // Non-team puzzles: go to puzzle page
    if (!puzzle.isTeamPuzzle) {
      router.push(`/puzzles/${puzzle.id}`);
      return;
    }

    await launchTeamPuzzle(puzzle);
  }

  function closeTeamModal() {
    setShowTeamModal(false);
    setTeamModalMessage("");
    setTeamModalTitle('Notice');
    setTeamModalConfirmText('OK');
    setTeamModalCancelText(null);
    setTeamModalConfirmAction(null);
  }

  function onTeamModalConfirm() {
    const action = teamModalConfirmAction;
    closeTeamModal();
    try {
      action?.();
    } catch {
      // ignore
    }
  }

  function applyFilters() {
    let filtered = puzzles;

    // Filter by category
    if (selectedCategory !== "all") {
      filtered = filtered.filter((p) => p.category.id === selectedCategory);
    }

    // Filter by difficulty
    if (selectedDifficulty !== "all") {
      filtered = filtered.filter((p) => p.difficulty === selectedDifficulty);
    }

    // Filter by status
    if (selectedStatus !== "all") {
      if (selectedStatus === "solved") {
        filtered = filtered.filter((p) => p.userProgress && p.userProgress.length > 0 && p.userProgress[0].solved);
      } else if (selectedStatus === "in-progress") {
        filtered = filtered.filter(
          (p) =>
            p.userProgress &&
            p.userProgress.length > 0 &&
            !p.userProgress[0].solved &&
            (p.userProgress[0].attempts || 0) > 0
        );
      } else if (selectedStatus === "unsolved") {
        // Exclude puzzles that are marked as failed and only include truly unsolved puzzles
        filtered = filtered.filter(
          (p) =>
            p.failed !== true && (
              !p.userProgress ||
              p.userProgress.length === 0 ||
              (!p.userProgress[0]?.solved && (p.userProgress[0]?.attempts || 0) === 0)
            )
        );
      } else if (selectedStatus === "failed") {
        filtered = filtered.filter((p) => p.failed === true);
      }
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.title.toLowerCase().includes(query) ||
          p.description.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    if (sortBy === "points" && sortOrder === "desc") {
      filtered.sort((a, b) => (b.pointsReward || 0) - (a.pointsReward || 0));
    } else if (sortBy === "points" && sortOrder === "asc") {
      filtered.sort((a, b) => (a.pointsReward || 0) - (b.pointsReward || 0));
    } else if (sortBy === "difficulty") {
      const diffOrder: Record<string, number> = { easy: 1, medium: 2, hard: 3, extreme: 4 };
      filtered.sort((a, b) => {
        const orderA = diffOrder[a.difficulty.toLowerCase()] || 0;
        const orderB = diffOrder[b.difficulty.toLowerCase()] || 0;
        return sortOrder === "asc" ? orderA - orderB : orderB - orderA;
      });
    } else if (sortBy === "releaseDate") {
      filtered.sort((a, b) => {
        const dateA = new Date(a.createdAt || 0).getTime();
        const dateB = new Date(b.createdAt || 0).getTime();
        return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
      });
    } else {
      filtered.sort((a, b) => a.order - b.order);
    }

    setFilteredPuzzles(filtered);
  }

  if (status === "loading" || loading) {
    return <LoadingSpinner label="Loading puzzles…" size={180} />;
  }

  return (
    <div style={{ backgroundColor: '#020202' }} className="min-h-screen">
      {/* Header */}
      <div className="pt-24 pb-8 md:pb-16 px-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl md:text-5xl font-bold text-white mb-4">Puzzles</h1>
          <p style={{ color: '#DDDBF1' }}>Tackle challenges at your own pace. Win points solo or team up for collaborative solving</p>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-6 md:py-12 max-w-7xl mx-auto overflow-x-hidden">
        {/* Search and Filters */}
        <div className="mb-6 md:mb-12">
          {/* FilterBar Component */}
          <div>
            <FilterBar
              onSearch={setSearchQuery}
              onDifficultyChange={setSelectedDifficulty}
              onStatusChange={setSelectedStatus}
              onSortChange={(by, order) => {
                setSortBy(by);
                setSortOrder(order);
              }}
              currentSearch={searchQuery}
              currentDifficulty={selectedDifficulty}
              currentStatus={selectedStatus}
              currentSort={{ by: sortBy, order: sortOrder }}
            />
          </div>

          {/* Category Filters */}
          <div className="mt-6 mb-8">
            <h3 className="text-xs font-bold tracking-widest mb-3 uppercase" style={{ color: '#6baabb' }}>Categories</h3>
            <div className="-mx-4 px-4 sm:mx-0 sm:px-0">
              <div className="flex gap-2 overflow-x-auto pb-2 sm:flex-wrap sm:overflow-x-visible sm:pb-0 no-scrollbar">
              <button
                onClick={() => setSelectedCategory("all")}
                className={`flex-none px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-sm sm:text-base font-medium transition-all ${
                  selectedCategory === "all"
                    ? "scale-105"
                    : "opacity-70 hover:opacity-100"
                }`}
                style={{
                  backgroundColor: selectedCategory === "all" ? "#3891A6" : "rgba(56, 145, 166, 0.2)",
                  color: selectedCategory === "all" ? "#020202" : "#DDDBF1",
                }}
              >
                All
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`flex-none px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-sm sm:text-base font-medium transition-all ${
                    selectedCategory === cat.id
                      ? "scale-105"
                      : "opacity-70 hover:opacity-100"
                  }`}
                  style={{
                    backgroundColor: selectedCategory === cat.id ? (cat.color || "#3891A6") : "rgba(56, 145, 166, 0.2)",
                    color: selectedCategory === cat.id ? "#020202" : "#DDDBF1",
                    whiteSpace: "nowrap",
                  }}
                >
                  <span className="mr-1.5">{cat.icon || CATEGORY_ICONS[cat.name.toLowerCase()] || '🧩'}</span>
                  {formatCategoryName(cat.name)}
                </button>
              ))}
              </div>
            </div>
          </div>

          {/* View Mode Toggle and Results Count */}
          <div className="flex items-center justify-between mb-4">
            <p style={{ color: '#AB9F9D' }} className="text-sm">
              {filteredPuzzles.length} puzzle{filteredPuzzles.length !== 1 ? "s" : ""} found
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode("grid")}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-all`}
                style={{
                  backgroundColor: viewMode === "grid" ? "#3891A6" : "rgba(56, 145, 166, 0.2)",
                  color: viewMode === "grid" ? "#020202" : "#DDDBF1",
                  boxShadow: viewMode === "grid" ? "0 0 0 2px #FDE74C" : "none",
                  opacity: viewMode === "grid" ? 1 : 0.6,
                }}
              >
                Grid
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-all`}
                style={{
                  backgroundColor: viewMode === "list" ? "#3891A6" : "rgba(56, 145, 166, 0.2)",
                  color: viewMode === "list" ? "#020202" : "#DDDBF1",
                  boxShadow: viewMode === "list" ? "0 0 0 2px #FDE74C" : "none",
                  opacity: viewMode === "list" ? 1 : 0.6,
                }}
              >
                List
              </button>
            </div>
          </div>
        </div>

        {/* Puzzles Display */}
        {focusedPuzzleId && (
          <div className="mb-4">
            <button
              onClick={() => {
                setFocusedPuzzleId(null);
                // remove hash from URL
                try { history.replaceState(null, "", "/puzzles"); } catch {}
              }}
              className="px-3 py-1 rounded bg-slate-700 text-white text-sm mb-4"
            >
              Show all puzzles
            </button>
          </div>
        )}
        {displayed.length === 0 ? (
          <div className="text-center py-20">
            <p style={{ color: '#DDDBF1' }} className="text-lg mb-2">No puzzles match your filters</p>
            <p style={{ color: '#AB9F9D' }} className="text-sm">Try adjusting your search or filters</p>
          </div>
          ) : viewMode === "grid" ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {displayed.map((puzzle) => (
              <GridPuzzleCard key={puzzle.id} puzzle={puzzle} totalUsers={totalUsers} onDescriptionExpand={setDescriptionModal} onCardClick={handlePuzzleClick} />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {displayed.map((puzzle) => (
              <ListPuzzleCard key={puzzle.id} puzzle={puzzle} totalUsers={totalUsers} onDescriptionExpand={setDescriptionModal} onCardClick={handlePuzzleClick} />
            ))}
          </div>
        )}
      </div>
      {/* Description Modal */}
      {descriptionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black opacity-60" onClick={() => setDescriptionModal(null)}></div>
          <div className="relative bg-[#0b0b0b] rounded-lg p-6 max-w-lg mx-4 w-full max-h-[90vh] overflow-y-auto" style={{ border: '1px solid rgba(56, 145, 166, 0.3)' }}>
            <h3 className="text-xl font-bold text-white mb-3">{getDisplayTitle(descriptionModal)}</h3>
            <div className="flex flex-wrap gap-2 mb-4">
              <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: 'rgba(253, 231, 76, 0.2)', color: '#FDE74C' }}>
                {descriptionModal.category?.name || 'General'}
              </span>
              <span className="text-xs px-2 py-1 rounded capitalize font-medium" style={{ backgroundColor: `${DIFFICULTY_COLORS[descriptionModal.difficulty]}20`, color: DIFFICULTY_COLORS[descriptionModal.difficulty] }}>
                {descriptionModal.difficulty.charAt(0) + descriptionModal.difficulty.slice(1).toLowerCase()}
              </span>
              <span className="text-xs px-2 py-1 rounded capitalize font-medium" style={{ backgroundColor: 'rgba(56,145,166,0.15)', color: '#3891A6' }}>
                {descriptionModal.puzzleType ? getPuzzleTypeLabel(descriptionModal.puzzleType) : 'Puzzle'}
              </span>
            </div>
            {getDisplayDescription(descriptionModal) ? (
              <p className="text-sm whitespace-pre-wrap mb-6" style={{ color: '#DDDBF1' }}>{getDisplayDescription(descriptionModal)}</p>
            ) : (
              <p className="text-sm italic mb-6" style={{ color: '#64748b' }}>No description provided.</p>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDescriptionModal(null)}
                className="px-4 py-2 rounded bg-transparent text-white font-semibold"
                style={{ border: '1px solid rgba(221, 219, 241, 0.25)' }}
              >
                Close
              </button>
              <button
                onClick={() => { setDescriptionModal(null); handlePuzzleClick(descriptionModal); }}
                className="px-4 py-2 rounded bg-[#3891A6] text-black font-semibold"
              >
                Start Puzzle →
              </button>
            </div>
          </div>
        </div>
      )}
      {showTeamModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black opacity-60" onClick={closeTeamModal}></div>
          <div className="relative bg-[#0b0b0b] rounded-lg p-6 max-w-md mx-4 w-full max-h-[90vh] overflow-y-auto" style={{ border: '1px solid rgba(253, 231, 76, 0.15)' }}>
            <h3 className="text-lg font-bold text-white mb-2">{teamModalTitle}</h3>
            <p style={{ color: '#DDDBF1' }} className="mb-4">{teamModalMessage}</p>
            <div className="flex justify-end gap-2">
              {teamModalCancelText && (
                <button
                  onClick={closeTeamModal}
                  className="px-4 py-2 rounded bg-transparent text-white font-semibold"
                  style={{ border: '1px solid rgba(221, 219, 241, 0.25)' }}
                >
                  {teamModalCancelText}
                </button>
              )}
              <button onClick={onTeamModalConfirm} className="px-4 py-2 rounded bg-[#3891A6] text-black font-semibold">{teamModalConfirmText}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
