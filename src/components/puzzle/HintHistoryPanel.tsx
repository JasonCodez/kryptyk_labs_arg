"use client";

import React, { useState } from "react";
import { Clock, Zap, CheckCircle, XCircle, ChevronDown, ChevronUp } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

interface HistoryEntry {
  id: string;
  pointsCost: number;
  revealedAt: Date | string;
  solvedAt: Date | string | null;
  timeToSolve: number | null;
  leadToSolve: boolean;
}

interface HintHistoryPanelProps {
  historyEntries: HistoryEntry[];
  puzzleId: string;
  totalCostSoFar?: number;
}

export default function HintHistoryPanel({
  historyEntries,
  puzzleId,
  totalCostSoFar = 0,
}: HintHistoryPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (historyEntries.length === 0) {
    return null;
  }

  // Convert string dates to Date objects if needed
  const entries = historyEntries.map((entry) => ({
    ...entry,
    revealedAt:
      typeof entry.revealedAt === "string"
        ? new Date(entry.revealedAt)
        : entry.revealedAt,
    solvedAt:
      typeof entry.solvedAt === "string"
        ? new Date(entry.solvedAt)
        : entry.solvedAt,
  }));

  // Calculate total cost
  const totalCost = entries.reduce((sum, entry) => sum + entry.pointsCost, 0);

  return (
    <div className="border rounded-lg overflow-hidden" style={{ borderColor: "#3891A6" }}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center justify-between hover:opacity-80 transition-colors"
        style={{
          backgroundColor: "rgba(56, 145, 166, 0.1)",
        }}
      >
        <div className="flex items-center gap-3">
          <Clock size={18} style={{ color: "#3891A6" }} />
          <div className="text-left">
            <p className="font-semibold" style={{ color: "#3891A6" }}>
              Hint History
            </p>
            <p className="text-xs" style={{ color: "#AB9F9D" }}>
              {entries.length} hint{entries.length !== 1 ? "s" : ""} used •{" "}
              <span style={{ color: "#FDE74C" }}>{totalCost} points</span>
            </p>
          </div>
        </div>
        <div style={{ color: "#3891A6" }}>
          {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div
          className="space-y-2 p-4"
          style={{ backgroundColor: "rgba(10, 10, 10, 0.3)", borderTopColor: "#3891A6", borderTopWidth: "1px" }}
        >
          {entries.map((entry, index) => (
            <div
              key={entry.id}
              className="p-3 rounded-lg border flex items-start justify-between"
              style={{
                backgroundColor: entry.leadToSolve
                  ? "rgba(56, 211, 153, 0.08)"
                  : "rgba(171, 159, 157, 0.05)",
                borderColor: entry.leadToSolve
                  ? "rgba(56, 211, 153, 0.2)"
                  : "rgba(171, 159, 157, 0.2)",
              }}
            >
              <div className="flex-1">
                {/* Timeline */}
                <div className="flex items-start gap-3">
                  <div className="pt-1">
                    {entry.leadToSolve ? (
                      <CheckCircle
                        size={16}
                        style={{ color: "#38D399" }}
                      />
                    ) : (
                      <XCircle
                        size={16}
                        style={{ color: "#AB9F9D" }}
                      />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Reveal Time */}
                    <p
                      className="text-sm font-medium"
                      style={{ color: "#DDDBF1" }}
                    >
                      {format(entries[entries.length - 1 - index].revealedAt, "MMM d, h:mm a")}
                    </p>

                    {/* Time Since Reveal */}
                    <p className="text-xs mt-1" style={{ color: "#AB9F9D" }}>
                      {formatDistanceToNow(entries[entries.length - 1 - index].revealedAt, { addSuffix: true })}
                    </p>

                    {/* Time to Solve Info */}
                    {entry.solvedAt && entry.timeToSolve && (
                      <p className="text-xs mt-1" style={{ color: "#3891A6" }}>
                        ⏱ Solved in {entry.timeToSolve} seconds
                      </p>
                    )}

                    {/* Status */}
                    {entry.leadToSolve ? (
                      <p className="text-xs mt-1" style={{ color: "#38D399" }}>
                        ✓ Led to solution
                      </p>
                    ) : entry.solvedAt ? (
                      <p className="text-xs mt-1" style={{ color: "#AB9F9D" }}>
                        Puzzle not solved after this hint
                      </p>
                    ) : (
                      <p className="text-xs mt-1" style={{ color: "#AB9F9D" }}>
                        Puzzle not yet solved
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Cost Badge */}
              <div
                className="ml-3 px-2 py-1 rounded text-xs font-semibold flex items-center gap-1"
                style={{
                  backgroundColor: "rgba(253, 231, 76, 0.15)",
                  color: "#FDE74C",
                }}
              >
                <Zap size={12} />
                {entry.pointsCost}
              </div>
            </div>
          ))}

          {/* Total Summary */}
          <div
            className="mt-3 p-3 rounded-lg border"
            style={{
              backgroundColor: "rgba(253, 231, 76, 0.08)",
              borderColor: "#FDE74C",
            }}
          >
            <div className="flex justify-between items-center">
              <span className="text-sm" style={{ color: "#AB9F9D" }}>
                Total Cost:
              </span>
              <span className="font-bold flex items-center gap-1" style={{ color: "#FDE74C" }}>
                <Zap size={14} />
                {totalCost} points
              </span>
            </div>
            <div className="flex justify-between items-center mt-1 text-xs">
              <span style={{ color: "#AB9F9D" }}>Led to solve:</span>
              <span style={{ color: "#38D399" }} className="font-semibold">
                {entries.filter((e) => e.leadToSolve).length} / {entries.length}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
